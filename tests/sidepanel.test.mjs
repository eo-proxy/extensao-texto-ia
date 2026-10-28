import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mockChrome } from "./mock-chrome.mjs";
class Element {
  constructor(id = "") {
    Object.assign(this, { id, value: "", textContent: "", disabled: false, hidden: false, type: "password", checked: false, children: [], listeners: {} });
    const classes = new Set(["hidden"]);
    this.classList = { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c), toggle: (c, on) => on ? classes.add(c) : classes.delete(c) };
  }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  fire(name) { return this.listeners[name]?.({ target: this }); }
  replaceChildren() { this.children = []; }
  append(item) { this.children.push(item); }
  setAttribute(name, value) { this[name] = value; }
}
const html = await readFile(new URL("../brave-text-assistant/sidepanel.html", import.meta.url), "utf8");
const elements = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map((match) => [match[1], new Element(match[1])]));
const env = mockChrome();
globalThis.chrome = env.chrome;
await import("../brave-text-assistant/service-worker.js");
const sent = [];
env.chrome.runtime.sendMessage = (message) => {
  sent.push(message);
  return new Promise((resolve) => env.listeners.message(message, { id: env.chrome.runtime.id, url: env.chrome.runtime.getURL("sidepanel.html") }, resolve));
};
globalThis.document = { getElementById: (id) => elements[id], createElement: () => new Element(), querySelectorAll: () => [] };
globalThis.window = { scrollTo() {} };
await import("../brave-text-assistant/sidepanel.js");
const flush = () => new Promise(setImmediate);
await flush();
test("Aba inicial e salvamento padrão são claros e desligados", async () => {
  assert.equal(elements.settings.classList.contains("hidden"), false);
  assert.equal(elements.rememberCredentials.checked, false);
  assert.equal(elements.getKeyLink.href, "https://platform.openai.com/api-keys");
});
test("Trocar de IA descarta dados não lembrados, inclusive rascunhos não conectados", async () => {
  elements.apiKey.value = "unsaved-key";
  elements.provider.value = "gemini"; await elements.provider.fire("change");
  assert.equal(elements.apiKey.value, "");
  assert.equal(elements.getKeyLink.href, "https://aistudio.google.com/apikey");
  elements.provider.value = "openai"; await elements.provider.fire("change");
  assert.equal(elements.apiKey.value, "");
});
test("Conectar usa sessão e a permissão não perde o campo", async () => {
  elements.provider.value = "gemini"; await elements.provider.fire("change");
  elements.apiKey.value = "test-google-key";
  await elements.saveSettings.fire("click");
  assert.equal(env.state.providerProfiles.gemini, undefined);
  assert.equal(env.sessionState.activeProviderProfile.apiKey, "test-google-key");
  elements.authorizeProvider.fire("click"); await flush();
  assert.equal(elements.apiKey.value, "test-google-key");
});
test("Consulta usa chave da sessão, escolhe modelo e testa sem persistência implícita", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => ({ ok: true, json: async () => url.includes(":generateContent")
      ? { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "Teste." }] } }] }
      : { models: [{ name: "models/gemini-3.6-flash", supportedGenerationMethods: ["generateContent"] }] }
    });
    await elements.loadModels.fire("click");
    assert.equal(elements.modelChoice.children[1].value, "gemini-3.6-flash");
    elements.modelChoice.value = "gemini-3.6-flash"; elements.modelChoice.fire("change");
    await elements.testProvider.fire("click");
    assert.match(elements.settingsStatus.textContent, /Conexão pronta/);
    assert.equal(env.state.providerProfiles.gemini, undefined);
    assert.equal(sent.findLast((message) => message.type === "TEST_PROVIDER").apiKey, undefined);
  } finally { globalThis.fetch = original; }
});
test("Lembrar exige escolha explícita e permite recuperar o provedor depois", async () => {
  elements.rememberCredentials.checked = true;
  await elements.saveSettings.fire("click");
  assert.equal(env.state.providerProfiles.gemini.rememberCredentials, true);
  elements.provider.value = "openai"; await elements.provider.fire("change");
  elements.provider.value = "gemini"; await elements.provider.fire("change");
  assert.equal(elements.apiKey.value, "test-google-key");
  assert.equal(elements.rememberCredentials.checked, true);
  elements.rememberCredentials.checked = false; await elements.rememberCredentials.fire("change");
  assert.equal(env.state.providerProfiles.gemini, undefined);
});


test("Interface mostra estado e diagnóstico verdes depois de uma resposta positiva", async () => {
  assert.equal(elements.connectionState.textContent, "Conectado");
  assert.equal(elements.connectionState.classList.contains("connected"), true);
  assert.equal(elements.connectionDiagnostic.classList.contains("success"), true);
  assert.equal(elements.connectionDiagnostic.classList.contains("error"), false);
});
test("Falha no teste muda imediatamente os dois indicadores para vermelho", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({ error: { code: "UNAVAILABLE" } }) });
    await elements.testProvider.fire("click");
    assert.equal(elements.connectionState.textContent, "Desconectado");
    assert.equal(elements.connectionState.classList.contains("disconnected"), true);
    assert.equal(elements.connectionState.classList.contains("connected"), false);
    assert.equal(elements.connectionDiagnostic.classList.contains("error"), true);
    assert.equal(elements.connectionDiagnostic.classList.contains("success"), false);
  } finally { globalThis.fetch = original; }
});
test("Desconectar apaga a chave e mantém o indicador desconectado", async () => {
  await elements.forgetKey.fire("click");
  assert.equal(elements.apiKey.value, "");
  assert.equal(elements.connectionState.textContent, "Desconectado");
  assert.equal(elements.connectionState.classList.contains("disconnected"), true);
});
test("Menu e apresentação usam os textos simplificados e não têm botão Voltar", () => {
  assert.match(html, /aria-controls="settings">Configuração/);
  assert.match(html, /<h1>Conexão<\/h1>/);
  assert.match(html, /id="forgetKey" class="disconnect-button"/);
  assert.ok(!html.includes('id="closeSettings"'));
  assert.ok(!html.includes("40 px"));
  assert.ok(!html.includes("NO SEU CAMPO DE TEXTO"));
  assert.ok(!html.includes("Sua IA, do seu jeito."));
});
