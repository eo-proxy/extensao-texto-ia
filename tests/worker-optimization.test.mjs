import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mockChrome } from "./mock-chrome.mjs";
const env = mockChrome({ storageSchema: 2, provider: "openai", "sitePreference:https://example.com": { enabled: true, revision: "site-fixture" } });
globalThis.chrome = env.chrome;
await import("../brave-text-assistant/service-worker.js");
const page = { id: env.chrome.runtime.id, url: env.chrome.runtime.getURL("sidepanel.html") };
const script = { id: page.id, url: "https://example.com/page", tab: { id: 5, url: "https://example.com/page" }, frameId: 0 };
const send = (message, sender = script) => new Promise(resolve => env.listeners.message(message, sender, resolve));
const request = (extra = {}, sender = script) => send({ type: "AI_REWRITE", text: "Original confidencial 😀", instruction: "Preserve os fatos.", requestId: "request", ...extra }, sender);
const originalFetch = globalThis.fetch;
function payload(provider, text = "Revisão confidencial 😀") {
  if (provider === "openai") return { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text }] }], usage: { input_tokens: 120, output_tokens: 30, total_tokens: 150, secret: "never-copy" } };
  if (provider === "gemini") return { candidates: [{ finishReason: "STOP", content: { parts: [{ text }] } }], usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 20, thoughtsTokenCount: 10, totalTokenCount: 150 } };
  return { stop_reason: "end_turn", content: [{ type: "text", text }], usage: { input_tokens: 120, output_tokens: 30 } };
}
const response = provider => ({ ok: true, json: async () => payload(provider) });
async function configure(provider = "openai", extra = {}) {
  const models = { openai: "gpt-test", gemini: "gemini-test", claude: "claude-test" };
  const result = await send({ type: "SAVE_PROVIDER_SETTINGS", provider, apiKey: "fixture-" + provider + "-key", model: models[provider], ...extra }, page);
  assert.equal(result.ok, true);
  env.permissions.add({ openai: "https://api.openai.com/*", gemini: "https://generativelanguage.googleapis.com/*", claude: "https://api.anthropic.com/*" }[provider]);
}
async function until(predicate) {
  const deadline = Date.now() + 2000;
  while (!predicate()) { if (Date.now() > deadline) throw new Error("Condição assíncrona não ocorreu"); await new Promise(resolve => setTimeout(resolve, 2)); }
}
beforeEach(async () => { await configure(); env.listeners.tabRemoved(5); });
afterEach(() => { globalThis.fetch = originalFetch; });
for (const provider of ["openai", "gemini", "claude"]) test(provider + ": dez revisões automáticas idênticas usam uma chamada, manuais e testes consultam novamente", async () => {
  await configure(provider); let calls = 0;
  globalThis.fetch = async () => { calls++; return response(provider); };
  const first = await request(); assert.equal(first.source, "api"); assert.equal(first.usage.totalTokens, 150);
  const diag = structuredClone(env.sessionState.diagnostics[provider]);
  for (let i = 0; i < 9; i++) { const hit = await request({ requestId: String(i) }); assert.equal(hit.source, "memory"); assert.equal(hit.apiRequest, false); assert.equal(hit.usage, null); assert.equal(hit.suggestion, first.suggestion); }
  assert.equal(calls, 1); assert.deepEqual(env.sessionState.diagnostics[provider], diag);
  assert.equal((await request({ forceRefresh: true })).source, "api"); assert.equal(calls, 2);
  assert.equal((await send({ type: "TEST_PROVIDER", provider }, page)).tested, true); assert.equal(calls, 3);
  assert.equal((await send({ type: "TEST_PROVIDER", provider }, page)).tested, true); assert.equal(calls, 4);
  const stored = JSON.stringify([env.state, env.sessionState]);
  for (const text of ["Original confidencial", "Revisão confidencial", "never-copy"]) assert.ok(!stored.includes(text));
  assert.ok(Object.values(diag.usage).every(value => value === null || Number.isSafeInteger(value)));
});
test("Cache exige igualdade exata de texto/instrução/aba e configuração", async () => {
  let calls = 0; globalThis.fetch = async () => { calls++; return response("openai"); };
  await request(); await request({ text: "Original confidencial 😃" }); await request({ instruction: "Só ortografia." });
  await request({}, { ...script, tab: { ...script.tab, id: 6 } });
  assert.equal(calls, 4);
  await configure("openai", { model: "gpt-other" }); await request(); assert.equal(calls, 5);
  await configure("openai", { model: "gpt-other", apiKey: "fixture-new-key" }); await request(); assert.equal(calls, 6);
});
test("Chamadas automáticas idênticas em andamento compartilham uma resposta", async () => {
  let calls = 0, complete;
  globalThis.fetch = () => { calls++; return new Promise(resolve => { complete = resolve; }); };
  const first = request({ requestId: "a" }); await until(() => complete);
  const second = request({ requestId: "b" }); await new Promise(setImmediate);
  complete(response("openai"));
  const results = await Promise.all([first, second]);
  assert.equal(calls, 1); assert.equal(results[0].source, "api"); assert.equal(results[1].source, "inflight"); assert.equal(results[1].usage, null);
});
test("Qualquer identificador associado cancela a revisão compartilhada", async () => {
  let complete, signal;
  globalThis.fetch = (_url, options) => { signal = options.signal; return new Promise(resolve => { complete = resolve; }); };
  const first = request({ requestId: "a" }); await until(() => complete);
  const second = request({ requestId: "b" }); await new Promise(setImmediate);
  await send({ type: "CANCEL_REWRITE", requestId: "b" }); assert.equal(signal.aborted, true);
  complete(response("openai"));
  for (const result of await Promise.all([first, second])) assert.equal(result.code, "CANCELLED");
});
test("Novo texto cancela trabalho anterior e resposta antiga não entra no cache", async () => {
  let complete, calls = 0; globalThis.fetch = () => { calls++; if (calls === 1) return new Promise(resolve => { complete = resolve; }); return Promise.resolve(response("openai")); };
  const old = request(); await until(() => complete);
  assert.equal((await request({ text: "Novo texto" })).ok, true);
  complete(response("openai")); assert.equal((await old).code, "CANCELLED");
  await request(); assert.equal(calls, 3);
});
test("Cancelamento durante a permissão impede envio antes da rede", async () => {
  const original = env.chrome.permissions.contains; let release, calls = 0;
  env.chrome.permissions.contains = () => new Promise(resolve => { release = resolve; });
  globalThis.fetch = async () => { calls++; return response("openai"); };
  try {
    const pending = request({ requestId: "setup" }); await until(() => release);
    await send({ type: "CANCEL_REWRITE", requestId: "setup" }); release(true);
    assert.equal((await pending).code, "CANCELLED"); assert.equal(calls, 0);
  } finally { env.chrome.permissions.contains = original; }
});
test("Site desativado bloqueia inclusive resultado pronto e reativação exige consulta nova", async () => {
  let calls = 0; globalThis.fetch = async () => { calls++; return response("openai"); };
  await request(); await send({ type: "SET_SITE_PREFERENCE", enabled: false });
  assert.equal((await request()).code, "SITE_BLOCKED"); assert.equal(calls, 1);
  await send({ type: "SET_SITE_PREFERENCE", enabled: true }); assert.equal((await request()).source, "api"); assert.equal(calls, 2);
});
test("Origem/frame inconsistentes não conseguem aderir a chamada em andamento", async () => {
  let complete, calls = 0; globalThis.fetch = () => { calls++; return new Promise(resolve => { complete = resolve; }); };
  const pending = request(); await until(() => complete);
  const wrong = { ...script, tab: { ...script.tab, url: "https://other.example" } };
  assert.equal((await request({}, wrong)).ok, false); assert.equal((await request({}, { ...script, frameId: 1 })).ok, false);
  complete(response("openai")); assert.equal((await pending).ok, true); assert.equal(calls, 1);
});
test("Navegação/fechamento/alterações de preferências descartam resultados em memória", async () => {
  let calls = 0; globalThis.fetch = async () => { calls++; return response("openai"); };
  await request(); env.listeners.tabUpdated(5, { status: "loading" }); await request(); assert.equal(calls, 2);
  env.listeners.tabRemoved(5); await request(); assert.equal(calls, 3);
  env.listeners.storageChanged({ "sitePreference:https://example.com": {} }, "local"); await request(); assert.equal(calls, 4);
  env.listeners.storageChanged({ activeProviderProfile: {} }, "session"); await request(); assert.equal(calls, 5);
});
test("Navegar durante geração impede resultado e cache mesmo se fetch ignorar abort", async () => {
  let complete; globalThis.fetch = () => new Promise(resolve => { complete = resolve; });
  const pending = request(); await until(() => complete); env.listeners.tabUpdated(5, { url: "https://other.example" });
  complete(response("openai")); assert.equal((await pending).code, "CANCELLED");
});
test("Revogar permissão impede aproveitar cache e remover chave encerra o acesso", async () => {
  let calls = 0; globalThis.fetch = async () => { calls++; return response("openai"); };
  await request(); env.permissions.delete("https://api.openai.com/*"); env.listeners.permissionRemoved();
  assert.equal((await request()).ok, false); assert.equal(calls, 1);
  env.permissions.add("https://api.openai.com/*"); await request(); assert.equal(calls, 2);
  await send({ type: "REMOVE_PROVIDER_KEY", provider: "openai" }, page); assert.equal((await request()).ok, false); assert.equal(calls, 2);
});
test("Falhas e respostas incompletas não são reaproveitadas nem repetidas silenciosamente", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: true, json: async () => ({ status: "incomplete", output: [] }) }; };
  assert.equal((await request()).ok, false); assert.equal(calls, 1);
  globalThis.fetch = async () => { calls++; return response("openai"); };
  assert.equal((await request()).source, "api"); assert.equal(calls, 2);
});

test("Falha ao gravar diagnóstico não perde revisão paga nem exige novo pedido", async () => {
  const original = env.chrome.storage.session.set; let calls = 0;
  globalThis.fetch = async () => { calls++; return response("openai"); };
  env.chrome.storage.session.set = async updates => { if (updates.diagnostics) throw Error("Diagnóstico indisponível"); return original(updates); };
  try {
    assert.equal((await request()).source, "api"); assert.equal((await request()).source, "memory"); assert.equal(calls, 1);
  } finally { env.chrome.storage.session.set = original; }
});
