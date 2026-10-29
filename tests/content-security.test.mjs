import test from "node:test";
import assert from "node:assert/strict";
import { contentHarness as harness } from "./content-harness.mjs";

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


test("Desfazer restaura o texto inteiro, a seleção e emite historyUndo", () => {
  const h = harness(); h.field.selectionStart = 2; h.field.selectionEnd = 5;
  const result = h.api.applyText("Revisado", { selectedOnly: false, originalText: "Original" });
  assert.equal(result.canUndo, true); assert.equal(h.field.value, "Revisado");
  h.api.undoText(result.undoId);
  assert.equal(h.field.value, "Original");
  assert.deepEqual([h.field.selectionStart, h.field.selectionEnd], [2, 5]);
  assert.equal(h.inputs.findLast(event => event.type === "input").inputType, "historyUndo");
  assert.equal(h.api.getUndoState().canUndo, false);
});

test("Desfazer um trecho preserva o restante do campo e aceita original vazio", () => {
  const h = harness(); h.field.value = "Antes Original Depois";
  const result = h.api.applyText("Novo", { selectedOnly: true, start: 6, end: 14, originalText: "Original" });
  assert.equal(h.field.value, "Antes Novo Depois"); h.api.undoText(result.undoId);
  assert.equal(h.field.value, "Antes Original Depois");
  h.field.value = "";
  const empty = h.api.applyText("Novo", { selectedOnly: false, originalText: "" });
  h.api.undoText(empty.undoId); assert.equal(h.field.value, "");
});

test("Desfazer em contenteditable restaura os nós originais e a formatação", () => {
  const h = harness({ type: "contenteditable", editable: true });
  h.field.replaceChildren(new h.TextNode("Original", "strong"));
  const originalMarkup = h.field.innerHTML;
  const result = h.api.applyText("Novo", { selectedOnly: false, originalText: "Original" });
  assert.equal(h.field.innerText, "Novo");
  h.api.undoText(result.undoId);
  assert.equal(h.field.innerText, "Original"); assert.equal(h.field.innerHTML, originalMarkup);
});

test("Edição posterior, inclusive se o texto voltar ao mesmo valor, invalida Desfazer", () => {
  const h = harness();
  const result = h.api.applyText("Novo", { selectedOnly: false, originalText: "Original" });
  h.field.value = "Novo editado"; h.listeners.input({ target: h.field, isTrusted: true });
  h.field.value = "Novo";
  assert.throws(() => h.api.undoText(result.undoId), /Não há uma sugestão/);
  assert.equal(h.field.value, "Novo");
});

test("Desfazer preserva mudanças do site e recusa campo removido ou bloqueado", () => {
  for (const alter of [h => { h.field.value = "Mudado pelo site"; }, h => { h.field.isConnected = false; }, h => { h.field.readOnly = true; }]) {
    const h = harness(); const result = h.api.applyText("Novo", { selectedOnly: false, originalText: "Original" });
    alter(h); const text = h.field.value;
    assert.throws(() => h.api.undoText(result.undoId), /Não há uma sugestão/);
    assert.equal(h.field.value, text);
  }
});

test("Desfazer atua somente no campo original e na última aplicação", () => {
  const h = harness();
  const first = h.api.applyText("Primeira", { selectedOnly: false, originalText: "Original" });
  const second = h.api.applyText("Segunda", { selectedOnly: false, originalText: "Primeira" });
  assert.throws(() => h.api.undoText(first.undoId), /alteração mais recente/);
  const other = new h.HTMLElement(); h.listeners.focusin({ target: other });
  assert.equal(h.api.getUndoState().canUndo, false); assert.throws(() => h.api.undoText(second.undoId));
  h.listeners.focusin({ target: h.field }); h.api.undoText(second.undoId);
  assert.equal(h.field.value, "Primeira"); assert.equal(h.api.getUndoState().canUndo, false);
});

test("Popup consulta e desfaz sem receber o texto guardado na memória da página", () => {
  const h = harness(); const events = []; h.api.onHistoryChange(action => events.push(action));
  const applied = h.message({ type: "APPLY_TEXT", text: "Novo", snapshot: { selectedOnly: false, originalText: "Original" } });
  assert.equal(applied.ok, true);
  const state = h.message({ type: "GET_UNDO_STATE" });
  assert.deepEqual(Object.keys(state).sort(), ["canUndo", "ok", "undoId"]);
  assert.equal(h.message({ type: "UNDO_APPLIED_TEXT", undoId: state.undoId }).ok, true);
  assert.equal(h.field.value, "Original"); assert.deepEqual(events, ["applied", "undone"]);
});

test("Mudança de formatação posterior também impede desfazer em contenteditable", () => {
  const h = harness({ type: "contenteditable", editable: true });
  const result = h.api.applyText("Novo", { selectedOnly: false, originalText: "Original" });
  h.field.replaceChildren(new h.TextNode("Novo", "em"));
  assert.equal(h.api.getUndoState().canUndo, false);
  assert.throws(() => h.api.undoText(result.undoId)); assert.equal(h.field.innerHTML, "<em>Novo</em>");
});

test("Aplicação sem mudança mantém a última alteração disponível para desfazer", () => {
  const h = harness();
  const first = h.api.applyText("Novo", { selectedOnly: false, originalText: "Original" });
  const second = h.api.applyText("Novo", { selectedOnly: false, originalText: "Novo" });
  assert.equal(second.undoId, first.undoId);
  h.api.undoText(second.undoId); assert.equal(h.field.value, "Original");
});

test("Eventos de edição do próprio contenteditable não apagam a restauração anterior", () => {
  const h = harness({ type: "contenteditable", editable: true });
  h.document.execCommand = () => {
    h.field.innerText = "Novo"; h.listeners.input({ target: h.field, isTrusted: true }); return true;
  };
  const first = h.api.applyText("Novo", { selectedOnly: false, originalText: "Original" });
  const second = h.api.applyText("Novo", { selectedOnly: false, originalText: "Novo" });
  assert.equal(second.undoId, first.undoId);
  h.api.undoText(second.undoId); assert.equal(h.field.innerText, "Original");
});
