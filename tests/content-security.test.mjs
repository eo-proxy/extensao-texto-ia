import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const source = fs.readFileSync(new URL("../brave-text-assistant/content.js", import.meta.url), "utf8");
function harness({ type = "textarea", autocomplete = "", editable = false } = {}) {
  const listeners = {}, inputs = [], insertedNodes = [];
  let doc, selectionRange;
  class HTMLElement {
    constructor() { this.isConnected = true; this.disabled = false; this.readOnly = false; this.isContentEditable = editable; this.innerText = "Original"; this.textContent = "Original"; this.selectionStart = 0; this.selectionEnd = 0; }
    matches() { return type === "textarea" || ["text", "search", "email", "url", "tel", ""].includes(type); }
    closest() { return null; }
    getAttribute(name) { return name === "autocomplete" ? autocomplete : null; }
    contains(node) { return node === this || node?.owner === this; }
    focus() { doc.activeElement = this; }
    dispatchEvent(event) { inputs.push(event); }
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
  }
  class HTMLTextAreaElement extends HTMLElement { get value() { return this._value || ""; } set value(value) { this._value = value; } }
  class HTMLInputElement extends HTMLTextAreaElement {}
  const field = type === "textarea" ? new HTMLTextAreaElement() : type === "contenteditable" ? new HTMLElement() : new HTMLInputElement();
  field.value = "Original";
  const range = {
    startContainer: { owner: field }, endContainer: { owner: field },
    cloneRange() { return { ...this }; }, toString: () => "Original",
    selectNodeContents() {}, deleteContents() { field.innerText = ""; },
    insertNode(node) { insertedNodes.push(node); field.innerText = node.text; }, collapse() {}
  };
  const selection = {
    rangeCount: 0, toString: () => "Texto de fora",
    getRangeAt: () => selectionRange || range,
    removeAllRanges() {}, addRange(value) { selectionRange = value; }
  };
  doc = {
    activeElement: field, addEventListener: (name, fn) => { listeners[name] = fn; },
    createRange: () => range, createTextNode: (text) => ({ text, nodeType: 3 }), execCommand: () => false
  };
  const window = { getSelection: () => selection };
  vm.runInNewContext(source, { window, document: doc, chrome: { runtime: { onMessage: { addListener() {} } } }, HTMLElement, HTMLTextAreaElement, HTMLInputElement, InputEvent: class { constructor(type, options) { this.type = type; Object.assign(this, options); } }, Event: class {} });
  return { api: window.__braveTextAssistantApi, field, selection, range, insertedNodes, inputs, setRange(value) { selectionRange = value; }, listeners };
}
test("Senha, código de acesso e campos de cartão não são lidos automaticamente", () => {
  for (const options of [{ type: "password" }, { autocomplete: "one-time-code" }, { autocomplete: "cc-number" }, { autocomplete: "new-password" }]) {
    const h = harness(options);
    assert.equal(h.api.isAutoEditable(h.field), false);
    assert.throws(() => h.api.readText(), /Clique primeiro/);
  }
});
test("Campo desabilitado ou somente leitura não recebe sugestão", () => {
  const h = harness();
  const read = h.api.readText();
  h.field.readOnly = true;
  assert.equal(h.api.isAutoEditable(h.field), false);
  assert.throws(() => h.api.applyText("Novo", { ...read, originalText: read.text }), /não está disponível/);
  assert.equal(h.field.value, "Original");
});
test("Seleção fora do editor não é enviada nem substituída", () => {
  const h = harness({ type: "contenteditable", editable: true });
  h.selection.rangeCount = 1;
  h.setRange({ startContainer: {}, endContainer: {}, cloneRange() { return this; }, toString: () => "Texto de fora" });
  const read = h.api.readText();
  assert.equal(read.text, "Original"); assert.equal(read.selectedOnly, false);
  assert.throws(() => h.api.applyText("Novo", { selectedOnly: true, originalText: "Texto de fora" }, h.field, h.selection.getRangeAt()), /seleção original mudou/);
  assert.equal(h.field.innerText, "Original");
});
test("HTML retornado pela IA é inserido como texto, sem interpretar marcação", () => {
  const h = harness({ type: "contenteditable", editable: true });
  const markup = '<img src=x onerror="alert(1)">';
  h.api.applyText(markup, { selectedOnly: false, originalText: "Original" });
  assert.equal(h.field.innerText, markup);
  assert.equal(h.insertedNodes[0].nodeType, 3);
});
test("Mudança no texto e limites de seleção invalidam a aplicação", () => {
  const h = harness();
  h.field.value = "Alterado";
  assert.throws(() => h.api.applyText("Novo", { selectedOnly: false, originalText: "Original" }), /texto mudou/);
  assert.throws(() => h.api.applyText("Novo", { selectedOnly: true, start: -1, end: 3, originalText: "" }), /seleção original mudou/);
  assert.equal(h.field.value, "Alterado");
});

