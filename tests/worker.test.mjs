import test from "node:test";
import assert from "node:assert/strict";
import { mockChrome } from "./mock-chrome.mjs";
const env = mockChrome({
  "sitePreference:https://example.com": { enabled: true, revision: "site-test" },
  storageSchema: 2, provider: "openai",
  providerProfiles: { openai: { provider: "openai", apiKey: "test-openai-secret", model: "gpt-test", rememberCredentials: true, revision: "initial-revision" } }
});
globalThis.chrome = env.chrome;
await import("../brave-text-assistant/service-worker.js");
const page = { id: env.chrome.runtime.id, url: env.chrome.runtime.getURL("sidepanel.html") };
const script = { id: env.chrome.runtime.id, url: "https://example.com", tab: { id: 3 }, frameId: 0 };
const send = (message, sender = page) => new Promise((resolve) => env.listeners.message(message, sender, resolve));
const flush = () => new Promise(setImmediate);
const success = { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "Revisado" }] }] };
test("Sites não podem ler nem alterar conexões e chaves", async () => {
  for (const type of ["GET_SETTINGS", "SELECT_PROVIDER", "SAVE_PROVIDER_SETTINGS", "DISABLE_REMEMBERING", "REMOVE_PROVIDER_KEY", "LIST_PROVIDER_MODELS", "TEST_PROVIDER"]) {
    const response = await send({ type, provider: "openai" }, script);
    assert.equal(response.ok, false); assert.match(response.error, /só pode ser feita/);
    assert.ok(!JSON.stringify(response).includes("test-openai-secret"));
  }
});
test("Configuração pública do widget não revela chave e exige a permissão", async () => {
  const before = await send({ type: "GET_WIDGET_CONFIG" }, script);
  assert.equal(before.configured, false); assert.equal(before.autoApplyEnabled, false);
  assert.ok(!JSON.stringify(before).includes("test-openai-secret"));
  env.permissions.add("https://api.openai.com/*");
  assert.equal((await send({ type: "GET_WIDGET_CONFIG" }, script)).configured, true);
});
test("Outras extensões são recusadas e preferências não sobrescrevem chaves", async () => {
  assert.equal((await send({ type: "GET_SETTINGS" }, { ...page, id: "other" })).ok, false);
  await send({ type: "SET_WIDGET_PREFS", apiKey: "bad", provider: "claude", autoApplyEnabled: true }, script);
  assert.equal(env.state.providerProfiles.openai.apiKey, "test-openai-secret");
  assert.equal(env.state.provider, "openai");
});
test("Teste usa frase fixa e diagnóstico não armazena prompt, chave ou resposta", async () => {
  const old = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, options) => {
      assert.equal(JSON.parse(options.body).input, "Olá, este é um teste de conexão.");
      return { ok: true, json: async () => success };
    };
    const response = await send({ type: "TEST_PROVIDER", provider: "openai", text: "Texto confidencial" });
    assert.equal(response.ok, true);
    const diag = env.sessionState.diagnostics.openai;
    assert.deepEqual(Object.keys(diag).sort(), ["at", "code", "durationMs", "httpStatus", "model", "provider", "revision"]);
    assert.ok(!JSON.stringify(diag).includes("test-openai-secret"));
    assert.equal(diag.code, "OK");
  } finally { globalThis.fetch = old; }
});
test("Cancelar interrompe fetch e uma outra aba não consegue cancelar esta chamada", async () => {
  const old = globalThis.fetch;
  let signal;
  try {
    globalThis.fetch = async (_url, options) => { signal = options.signal; return new Promise((_, reject) => signal.addEventListener("abort", () => reject(Object.assign(new Error(), { name: "AbortError" })))); };
    const pending = send({ type: "AI_REWRITE", requestId: "cancel-test", text: "Texto" }, script);
    await flush();
    await send({ type: "CANCEL_REWRITE", requestId: "cancel-test" }, { ...script, tab: { id: 999 } });
    assert.equal(signal.aborted, false);
    await send({ type: "CANCEL_REWRITE", requestId: "cancel-test" }, script);
    assert.equal(signal.aborted, true);
    assert.equal((await pending).code, "CANCELLED");
  } finally { globalThis.fetch = old; }
});
test("Resposta antiga é rejeitada ao mudar a conexão mesmo se fetch ignorar abort", async () => {
  const old = globalThis.fetch;
  let resolve;
  try {
    globalThis.fetch = async () => new Promise((done) => { resolve = done; });
    const pending = send({ type: "AI_REWRITE", requestId: "change-test", text: "Texto" }, script);
    await flush();
    await send({ type: "SAVE_PROVIDER_SETTINGS", provider: "openai", apiKey: "new-test-key", model: "gpt-new" });
    resolve({ ok: true, json: async () => success });
    assert.equal((await pending).code, "CANCELLED");
  } finally { globalThis.fetch = old; }
});
test("429 respeita a pausa informada sem repetir a chamada em sequência", async () => {
  const old = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => { calls += 1; return { ok: false, status: 429, headers: { get: () => "30" }, json: async () => ({ error: { code: "rate_limit_exceeded" } }) }; };
    const first = await send({ type: "AI_REWRITE", text: "Texto" }, script);
    assert.equal(first.code, "RATE_LIMIT"); assert.ok(first.retryAfterMs >= 30000);
    const second = await send({ type: "AI_REWRITE", text: "Outro texto" }, script);
    assert.equal(second.code, "RATE_LIMIT"); assert.equal(calls, 1);
  } finally { globalThis.fetch = old; }
});
