import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getProvider } from "../brave-text-assistant/providers.mjs";

class Element {
  constructor(id = "") {
    this.id = id; this.value = ""; this.textContent = ""; this.disabled = false; this.hidden = false; this.type = "password"; this.children = []; this.listeners = {};
    const classes = new Set(["hidden"]);
    this.classList = { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c), toggle: (c, on) => on ? classes.add(c) : classes.delete(c) };
  }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  fire(name) { return this.listeners[name]?.({ target: this }); }
  replaceChildren() { this.children = []; }
  append(item) { this.children.push(item); }
  setAttribute(name, value) { this[name] = value; }
  scrollIntoView() { this.scrolled = true; }
  focus() {}
}
const html = await readFile(new URL("../brave-text-assistant/sidepanel.html", import.meta.url), "utf8");
const elements = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map((match) => [match[1], new Element(match[1])]));
const state = { provider: "openai", profiles: {}, widgetEnabled: true };
const messages = [];
const permissions = new Set();
let requests = 0;
globalThis.document = { getElementById: (id) => elements[id], createElement: () => new Element(), querySelectorAll: () => [] };
globalThis.requestAnimationFrame = (callback) => callback();
globalThis.chrome = {
  runtime: { sendMessage: async (message) => {
    messages.push(message);
    if (message.type === "GET_SETTINGS") return { ok: true, ...structuredClone(state) };
    if (message.type === "SAVE_PROVIDER_SETTINGS") { state.provider = message.provider; state.profiles[message.provider] = { apiKey: message.apiKey, model: message.model }; }
    if (message.type === "LIST_PROVIDER_MODELS") return { ok: true, models: [{ id: "gemini-first", label: "Gemini First" }] };
    return { ok: true };
  } },
  permissions: {
    contains: async ({ origins }) => origins.every((origin) => permissions.has(origin)),
    request: async ({ origins }) => { requests += 1; origins.forEach((origin) => permissions.add(origin)); return true; }
  }
};
await import("../brave-text-assistant/sidepanel.js");
const flush = () => new Promise(setImmediate);
await flush();

test("Configuração inicial abre e mostra instruções oficiais específicas para cada provedor", async () => {
  assert.equal(elements.settings.classList.contains("hidden"), false);
  assert.equal(elements.getKeyLink.href, "https://platform.openai.com/api-keys");
  elements.apiKey.value = "unsaved-openai";
  elements.apiKey.fire("input");
  elements.provider.value = "gemini";
  await elements.provider.fire("change");
  assert.equal(elements.getKeyLink.href, "https://aistudio.google.com/apikey");
  assert.match(elements.apiKeyLabel.textContent, /Google AI Studio/);
  assert.match(elements.modelHelp.textContent, /models\//);
  assert.equal(elements.apiKey.value, "");
  elements.provider.value = "openai";
  await elements.provider.fire("change");
  assert.equal(elements.apiKey.value, "unsaved-openai", "Alternar provedor não perde campos ainda não salvos");
  elements.provider.value = "claude";
  await elements.provider.fire("change");
  assert.equal(elements.getKeyLink.href, "https://platform.claude.com/settings/keys");
});

test("Salvar persiste antes de pedir permissão e os campos continuam após autorizar", async () => {
  elements.provider.value = "gemini";
  await elements.provider.fire("change");
  elements.apiKey.value = "test-google-key";
  elements.apiKey.fire("input");
  await elements.saveSettings.fire("click");
  assert.equal(state.profiles.gemini.apiKey, "test-google-key");
  assert.equal(requests, 0, "Salvar não abre permissão antes de persistir");
  elements.authorizeProvider.fire("click");
  await flush();
  assert.equal(requests, 1);
  assert.equal(elements.apiKey.value, "test-google-key");
});

test("Consultar modelos não gera texto e testar salva o modelo escolhido", async () => {
  await elements.loadModels.fire("click");
  assert.equal(elements.modelChoice.children[1].value, "gemini-first");
  elements.modelChoice.value = "gemini-first";
  elements.modelChoice.fire("change");
  await elements.testProvider.fire("click");
  assert.equal(state.profiles.gemini.model, "gemini-first");
  const call = messages.findLast((message) => message.type === "TEST_PROVIDER");
  assert.equal(call.provider, "gemini");
  assert.equal(call.apiKey, undefined);
  assert.match(elements.settingsStatus.textContent, /Conexão testada/);
  assert.equal(getProvider("gemini").host, "https://generativelanguage.googleapis.com/*");
});

