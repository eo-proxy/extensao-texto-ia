import test from "node:test";
import assert from "node:assert/strict";
import { mockChrome } from "./mock-chrome.mjs";

const env = mockChrome({
  provider: "openai",
  providerProfiles: { openai: { apiKey: "test-openai-secret", model: "gpt-test" } }
});
globalThis.chrome = env.chrome;
await import("../brave-text-assistant/service-worker.js");
const page = { id: env.chrome.runtime.id, url: env.chrome.runtime.getURL("sidepanel.html") };
const contentScript = { id: env.chrome.runtime.id, url: "https://example.com", tab: { id: 3 } };
const send = (message, sender = page) => new Promise((resolve) => env.listeners.message(message, sender, resolve));

test("Páginas visitadas não podem consultar, apagar ou alterar perfis e chaves", async () => {
  for (const type of ["GET_SETTINGS", "SAVE_PROVIDER_SETTINGS", "REMOVE_PROVIDER_KEY", "LIST_PROVIDER_MODELS", "TEST_PROVIDER"]) {
    const response = await send({ type, provider: "openai" }, contentScript);
    assert.equal(response.ok, false);
    assert.match(response.error, /só pode ser feita/);
    assert.ok(!JSON.stringify(response).includes("test-openai-secret"));
  }
});

test("O widget recebe só preferências públicas e só fica pronto após autorizar", async () => {
  const before = await send({ type: "GET_WIDGET_CONFIG" }, contentScript);
  assert.equal(before.configured, false);
  assert.equal(before.autoApplyEnabled, false);
  assert.ok(!JSON.stringify(before).includes("test-openai-secret"));
  env.permissions.add("https://api.openai.com/*");
  const after = await send({ type: "GET_WIDGET_CONFIG" }, contentScript);
  assert.equal(after.configured, true);
  assert.equal(env.chrome.accessLevel, "TRUSTED_CONTEXTS");
});

test("Solicitações de outra extensão são recusadas", async () => {
  const response = await send({ type: "GET_SETTINGS" }, { ...page, id: "another-extension" });
  assert.equal(response.ok, false);
});

test("Preferências do widget não permitem sobrescrever credenciais", async () => {
  const result = await send({ type: "SET_WIDGET_PREFS", apiKey: "bad", provider: "claude", autoApplyEnabled: true }, contentScript);
  assert.equal(result.ok, true);
  assert.equal(env.state.provider, "openai");
  assert.equal(env.state.providerProfiles.openai.apiKey, "test-openai-secret");
  assert.equal(env.state.autoApplyEnabled, true);
});

test("Teste de conexão usa frase fixa e marca a configuração salva", async () => {
  const oldFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, options) => {
      assert.equal(JSON.parse(options.body).input, "Olá, este é um teste de conexão.");
      return { ok: true, json: async () => ({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "Teste." }] }] }) };
    };
    const result = await send({ type: "TEST_PROVIDER", provider: "openai", text: "Conteúdo da página não deve ser usado" });
    assert.equal(result.ok, true);
    assert.ok(env.state.providerProfiles.openai.verifiedAt);
  } finally { globalThis.fetch = oldFetch; }
});

