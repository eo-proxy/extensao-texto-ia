import fs from "node:fs";
import vm from "node:vm";
const source = fs.readFileSync(new URL("../brave-text-assistant/content.js", import.meta.url), "utf8");
export function contentHarness({ type = "textarea", autocomplete = "", editable = false } = {}) {
  const listeners = {}, inputs = [], insertedNodes = [];
  let doc, selectionRange, runtimeListener;
  class TextNode { constructor(text, tag = "") { this.text = text; this.tag = tag; this.nodeType = 3; } get textContent() { return this.text; } cloneNode() { return new TextNode(this.text, this.tag); } }
  class HTMLElement {
    get innerText() { return (this.childNodes || []).map((node) => node.textContent).join(""); }
    set innerText(text) { this.childNodes = [new TextNode(text)]; }
    get textContent() { return this.innerText; }
    set textContent(text) { this.innerText = text; }
    get innerHTML() { return this.childNodes.map(node => node.tag ? '<' + node.tag + '>' + node.textContent + '</' + node.tag + '>' : node.textContent).join(''); }
    replaceChildren(...nodes) { this.childNodes = nodes; }
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
    createRange: () => range, createTextNode: (text) => new TextNode(text), execCommand: () => false
  };
  const window = { getSelection: () => selection };
  vm.runInNewContext(source, { window, document: doc, chrome: { runtime: { onMessage: { addListener(fn) { runtimeListener = fn; } } } }, HTMLElement, HTMLTextAreaElement, HTMLInputElement, InputEvent: class { constructor(type, options) { this.type = type; Object.assign(this, options); } }, Event: class {} });
  return { api: window.__braveTextAssistantApi, field, selection, range, insertedNodes, inputs, document: doc, HTMLElement, TextNode, message(message) { let result; runtimeListener(message, {}, value => { result = value; }); return result; }, setRange(value) { selectionRange = value; }, listeners };
}
