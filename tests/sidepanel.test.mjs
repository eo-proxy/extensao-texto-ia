import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mockChrome } from "./mock-chrome.mjs";
import { contentHarness } from "./content-harness.mjs";
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
const env = mockChrome({ "sitePreference:https://example.com": { enabled: true, revision: "site-test" } });
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

test("Troca de abas reinicia apenas a rolagem do conteúdo e atualiza a navegação", async () => {
  elements.panelContent.scrollTop = 260;
  await elements.reviewTab.fire("click");
  assert.equal(elements.panelContent.scrollTop, 0);
  assert.equal(elements.reviewView.classList.contains("hidden"), false);
  assert.equal(elements.settings.classList.contains("hidden"), true);
  assert.equal(elements.reviewTab["aria-selected"], "true");
  elements.panelContent.scrollTop = 180;
  await elements.settingsToggle.fire("click");
  assert.equal(elements.panelContent.scrollTop, 0);
  assert.equal(elements.reviewView.classList.contains("hidden"), true);
  assert.equal(elements.settings.classList.contains("hidden"), false);
  assert.equal(elements.settingsToggle["aria-selected"], "true");
});

test("Popup aplica e desfaz usando o script do campo e recupera Desfazer ao voltar à aba", async () => {
  const content = contentHarness();
  const originalQuery = env.chrome.tabs.query, originalMessage = env.chrome.tabs.sendMessage;
  env.chrome.scripting = { executeScript: async () => {} };
  env.chrome.tabs.query = async () => [{ id: 7, url: "https://example.com/page" }];
  env.chrome.tabs.sendMessage = async (_tab, message) => content.message(message);
  try {
    await elements.readButton.fire("click"); elements.suggestion.value = "Revisado";
    await elements.applyButton.fire("click");
    assert.equal(content.field.value, "Revisado");
    assert.equal(elements.undoButton.classList.contains("hidden"), false);
    elements.undoButton.classList.add("hidden");
    elements.reviewTab.fire("click"); await flush();
    assert.equal(elements.undoButton.classList.contains("hidden"), false);
    await elements.undoButton.fire("click");
    assert.equal(content.field.value, "Original");
    assert.equal(elements.undoButton.classList.contains("hidden"), true);
    assert.equal(elements.suggestionWrap.classList.contains("hidden"), true);
    assert.match(elements.status.textContent, /Texto anterior restaurado/);
  } finally { env.chrome.tabs.query = originalQuery; env.chrome.tabs.sendMessage = originalMessage; delete env.chrome.scripting; }
});

test("Popup permite desfazer aplicação feita pelo robô, inclusive após reabrir a revisão", async () => {
  const content = contentHarness();
  content.api.applyText("Automático", { selectedOnly: false, originalText: "Original" });
  const originalQuery = env.chrome.tabs.query, originalMessage = env.chrome.tabs.sendMessage;
  env.chrome.scripting = { executeScript: async () => {} };
  env.chrome.tabs.query = async () => [{ id: 8, url: "https://example.com/page" }];
  env.chrome.tabs.sendMessage = async (_tab, message) => content.message(message);
  try {
    elements.reviewTab.fire("click"); await flush();
    assert.equal(elements.undoButton.classList.contains("hidden"), false);
    await elements.undoButton.fire("click"); assert.equal(content.field.value, "Original");
  } finally { env.chrome.tabs.query = originalQuery; env.chrome.tabs.sendMessage = originalMessage; delete env.chrome.scripting; }
});

test("Popup preserva edições posteriores e recusa Desfazer em uma outra aba", async () => {
  const first = contentHarness(), other = contentHarness(); let tabId = 9;
  const originalQuery = env.chrome.tabs.query, originalMessage = env.chrome.tabs.sendMessage;
  env.chrome.scripting = { executeScript: async () => {} };
  env.chrome.tabs.query = async () => [{ id: tabId, url: "https://example.com/page" }];
  env.chrome.tabs.sendMessage = async (id, message) => (id === 9 ? first : other).message(message);
  try {
    first.api.applyText("Revisado", { selectedOnly: false, originalText: "Original" });
    elements.reviewTab.fire("click"); await flush();
    tabId = 10; await elements.undoButton.fire("click");
    assert.equal(first.field.value, "Revisado"); assert.equal(other.field.value, "Original");
    assert.match(elements.status.textContent, /Volte à aba/);
    tabId = 9; elements.reviewTab.fire("click"); await flush();
    first.field.value = "Texto novo digitado";
    await elements.undoButton.fire("click");
    assert.equal(first.field.value, "Texto novo digitado");
    assert.equal(elements.undoButton.classList.contains("hidden"), true);
  } finally { env.chrome.tabs.query = originalQuery; env.chrome.tabs.sendMessage = originalMessage; delete env.chrome.scripting; }
});

test("Desfazer no popup invalida uma geração manual que termina depois", async () => {
  const content = contentHarness();
  content.api.applyText("Aplicado", { selectedOnly: false, originalText: "Original" });
  const originalQuery = env.chrome.tabs.query, originalMessage = env.chrome.tabs.sendMessage, originalFetch = globalThis.fetch;
  env.chrome.scripting = { executeScript: async () => {} };
  env.chrome.tabs.query = async () => [{ id: 11, url: "https://example.com/page" }];
  env.chrome.tabs.sendMessage = async (_tab, message) => content.message(message);
  let resolveGeneration;
  try {
    elements.apiKey.value = "test-google-key"; elements.model.value = "gemini-3.6-flash";
    await elements.saveSettings.fire("click");
    await elements.readButton.fire("click");
    elements.reviewTab.fire("click"); await flush();
    globalThis.fetch = () => new Promise(resolve => { resolveGeneration = resolve; });
    const generating = elements.rewriteButton.fire("click"); await until(() => resolveGeneration);
    assert.equal(typeof resolveGeneration, "function");
    await elements.undoButton.fire("click"); assert.equal(content.field.value, "Original");
    resolveGeneration({ ok: true, json: async () => ({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "Atrasada" }] } }] }) });
    await generating;
    assert.equal(elements.suggestionWrap.classList.contains("hidden"), true);
    assert.equal(content.field.value, "Original");
  } finally { env.chrome.tabs.query = originalQuery; env.chrome.tabs.sendMessage = originalMessage; globalThis.fetch = originalFetch; delete env.chrome.scripting; }
});

test("Checkbox do popup salva Sim/Não e bloqueia leitura e aplicação em site desativado", async () => {
  const content = contentHarness();
  const originalQuery = env.chrome.tabs.query, originalMessage = env.chrome.tabs.sendMessage;
  env.chrome.scripting = { executeScript: async () => {} };
  env.chrome.tabs.query = async () => [{ id: 12, url: "https://popup-site.example/chat" }];
  let reads = 0;
  env.chrome.tabs.sendMessage = async (_tab, message) => { if (message.type === "READ_ACTIVE_TEXT") reads++; return content.message(message); };
  try {
    elements.reviewTab.fire("click"); await flush();
    assert.equal(elements.siteEnabled.checked, false); assert.equal(elements.siteEnabled.disabled, false);
    await elements.readButton.fire("click"); assert.equal(reads, 0); assert.match(elements.status.textContent, /Ative/);
    elements.siteEnabled.checked = true; await elements.siteEnabled.fire("change");
    assert.equal(env.state["sitePreference:https://popup-site.example"].enabled, true);
    await elements.readButton.fire("click"); assert.equal(reads, 1);
    elements.suggestion.value = "Revisado"; await elements.applyButton.fire("click");
    assert.equal(content.field.value, "Revisado");
    elements.siteEnabled.checked = false; await elements.siteEnabled.fire("change");
    assert.equal(env.state["sitePreference:https://popup-site.example"].enabled, false);
    assert.equal(elements.siteEnabled.checked, false); assert.equal(elements.suggestionWrap.classList.contains("hidden"), true);
    await elements.applyButton.fire("click"); assert.equal(content.field.value, "Revisado");
  } finally { env.chrome.tabs.query = originalQuery; env.chrome.tabs.sendMessage = originalMessage; delete env.chrome.scripting; }
});

test("Popup recusa aplicação depois de navegar para outro site na mesma aba", async () => {
  const content = contentHarness(); let url = "https://origin-a.example/";
  env.state["sitePreference:https://origin-a.example"] = { enabled: true, revision: "origin-a" };
  env.state["sitePreference:https://origin-b.example"] = { enabled: true, revision: "origin-b" };
  const originalQuery = env.chrome.tabs.query, originalMessage = env.chrome.tabs.sendMessage;
  env.chrome.scripting = { executeScript: async () => {} };
  env.chrome.tabs.query = async () => [{ id: 14, url }];
  env.chrome.tabs.sendMessage = async (_tab, message) => content.message(message);
  try {
    await elements.readButton.fire("click"); url = "https://origin-b.example/";
    elements.suggestion.value = "Novo"; await elements.applyButton.fire("click");
    assert.equal(content.field.value, "Original"); assert.match(elements.status.textContent, /página mudou/);
  } finally { env.chrome.tabs.query = originalQuery; env.chrome.tabs.sendMessage = originalMessage; delete env.chrome.scripting; }
});

async function until(predicate) {
  const deadline = Date.now() + 2000;
  while (!predicate()) { if (Date.now() > deadline) throw new Error("Condição assíncrona não ocorreu"); await new Promise(resolve => setTimeout(resolve, 2)); }
}
