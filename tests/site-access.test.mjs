import test from "node:test";
import assert from "node:assert/strict";
import { mockChrome } from "./mock-chrome.mjs";
import { siteOrigin, getSitePreference, saveSitePreference } from "../brave-text-assistant/site-preferences.mjs";
const env = mockChrome({ storageSchema: 2, provider: "openai", providerProfiles: { openai: { provider: "openai", apiKey: "fixture-secret", model: "gpt-test", rememberCredentials: true, revision: "provider-test" } } });
globalThis.chrome = env.chrome;
await import("../brave-text-assistant/service-worker.js");
env.permissions.add("https://api.openai.com/*");
const page = { id: env.chrome.runtime.id, url: env.chrome.runtime.getURL("sidepanel.html") };
const a = { id: env.chrome.runtime.id, url: "https://site-a.example/chat?secret=query", tab: { id: 20, url: "https://site-a.example/chat?secret=query" }, frameId: 0 };
const b = { ...a, url: "https://site-b.example/", tab: { id: 21, url: "https://site-b.example/" } };
env.chrome.tabs.query = async options => options.active ? [{ id: 20, url: a.url }] : [];
const send = (message, sender = a) => new Promise(resolve => env.listeners.message(message, sender, resolve));
const flush = () => new Promise(setImmediate);
const success = { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "Revisado" }] }] };

test("Site novo permanece sem decisão e nenhuma revisão é enviada à API", async () => {
  const config = await send({ type: "GET_WIDGET_CONFIG" });
  assert.equal(config.siteEnabled, false); assert.equal(config.siteDecided, false);
  let calls = 0; const original = globalThis.fetch; globalThis.fetch = async () => { calls++; throw Error(); };
  try { assert.equal((await send({ type: "AI_REWRITE", text: "Texto privado" })).code, "SITE_BLOCKED"); assert.equal(calls, 0); }
  finally { globalThis.fetch = original; }
});

test("Não fica salvo, sem caminhos ou parâmetros, e não altera outro site", async () => {
  const saved = await send({ type: "SET_SITE_PREFERENCE", enabled: false, siteOrigin: "https://site-b.example" });
  assert.equal(saved.siteDecided, true); assert.equal(saved.siteEnabled, false);
  assert.equal((await send({ type: "GET_WIDGET_CONFIG" }, { ...a, url: "https://site-a.example/outro" })).siteDecided, true);
  assert.equal((await send({ type: "GET_WIDGET_CONFIG" }, b)).siteDecided, false);
  assert.ok(!JSON.stringify(env.state).includes("secret=query"));
  assert.equal(Object.keys(env.state).filter(key => key.startsWith("sitePreference:")).length, 1);
});

test("Checkbox reativa o site e o envio passa a ser permitido", async () => {
  await send({ type: "SET_SITE_PREFERENCE", enabled: true });
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: true, json: async () => success }; };
  try { const result = await send({ type: "AI_REWRITE", text: "Texto" }); assert.equal(result.suggestion, "Revisado"); assert.equal(calls, 1); }
  finally { globalThis.fetch = original; }
});

test("Escolhas sobrevivem à sessão e ao reinício do serviço da extensão", async () => {
  await env.chrome.storage.session.clear();
  await import("../brave-text-assistant/service-worker.js?site-restart");
  const config = await send({ type: "GET_WIDGET_CONFIG" });
  assert.equal(config.siteEnabled, true); assert.equal(config.siteDecided, true);
  assert.equal(env.chrome.accessLevels.local, "TRUSTED_CONTEXTS");
  assert.equal(env.chrome.accessLevels.session, "TRUSTED_CONTEXTS");
});

test("Desativar cancela chamada pendente e reativar não recupera a resposta antiga", async () => {
  const original = globalThis.fetch; let complete, signal;
  globalThis.fetch = async (_url, options) => { signal = options.signal; return new Promise(resolve => { complete = resolve; }); };
  try {
    const pending = send({ type: "AI_REWRITE", text: "Texto", forceRefresh: true, requestId: "site-disable" }); await until(() => signal);
    await send({ type: "SET_SITE_PREFERENCE", enabled: false }); assert.equal(signal.aborted, true);
    await send({ type: "SET_SITE_PREFERENCE", enabled: true });
    complete({ ok: true, json: async () => success }); assert.equal((await pending).code, "CANCELLED");
  } finally { globalThis.fetch = original; }
});

test("Mudar outro site não cancela a chamada autorizada deste site", async () => {
  const original = globalThis.fetch; let complete, signal;
  globalThis.fetch = async (_url, options) => { signal = options.signal; return new Promise(resolve => { complete = resolve; }); };
  try {
    const pending = send({ type: "AI_REWRITE", text: "Texto", forceRefresh: true, requestId: "another-site" }); await until(() => signal);
    await send({ type: "SET_SITE_PREFERENCE", enabled: false }, b); assert.equal(signal.aborted, false);
    complete({ ok: true, json: async () => success }); assert.equal((await pending).ok, true);
  } finally { globalThis.fetch = original; }
});

test("Popup usa a aba atual e rejeita revisão ligada a outra aba", async () => {
  const context = await send({ type: "GET_SITE_CONTEXT" }, page);
  assert.equal(context.siteOrigin, "https://site-a.example"); assert.equal(context.tabId, 20);
  assert.equal((await send({ type: "AI_REWRITE", tabId: 999, text: "Texto" }, page)).ok, false);
  assert.equal((await send({ type: "SET_SITE_PREFERENCE", tabId: 999, enabled: false }, page)).ok, false);
  assert.equal((await send({ type: "GET_SITE_CONTEXT" })).ok, false);
});

test("Origens falsas, frames e tipos inválidos não alteram escolhas", async () => {
  for (const sender of [{ ...a, frameId: 1 }, { ...a, url: "https://outro.example" }, { ...a, url: "file:///private", tab: { id: 20 } }, { id: a.id, url: a.url }]) {
    assert.equal((await send({ type: "SET_SITE_PREFERENCE", enabled: true }, sender)).ok, false);
  }
  assert.equal((await send({ type: "SET_SITE_PREFERENCE", enabled: "false" })).ok, false);
  assert.equal((await send({ type: "GET_WIDGET_CONFIG" })).siteEnabled, true);
  for (const value of [null, {}, "__proto__", "javascript:alert(1)", "file:///private", "https://name:secret@example.com/"]) assert.throws(() => siteOrigin(value));
});

test("Preferências são independentes por origem e não revelam chave ou lista de sites", async () => {
  await Promise.all([saveSitePreference("https://site-a.example/page", true), saveSitePreference("https://site-b.example/other", false)]);
  assert.equal((await getSitePreference("https://site-a.example/new")).siteEnabled, true);
  assert.equal((await getSitePreference("http://site-a.example/")).siteDecided, false);
  assert.equal((await getSitePreference("https://site-a.example:8443/")).siteDecided, false);
  const config = await send({ type: "GET_WIDGET_CONFIG" });
  assert.ok(!JSON.stringify(config).includes("fixture-secret"));
  assert.ok(!JSON.stringify(config).includes("site-b.example"));
});

test("Apagar os dados devolve o site ao estado de primeira visita", async () => {
  await env.chrome.storage.local.remove("sitePreference:https://site-a.example");
  const config = await send({ type: "GET_WIDGET_CONFIG" });
  assert.equal(config.siteDecided, false); assert.equal(config.siteEnabled, false);
});

test("Popup não envia texto lido em outra origem, mesmo com as duas autorizadas", async () => {
  await send({ type: "SET_SITE_PREFERENCE", enabled: true });
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: true, json: async () => success }; };
  try {
    const response = await send({ type: "AI_REWRITE", tabId: 20, siteOrigin: "https://site-b.example", text: "Texto de outro site" }, page);
    assert.equal(response.ok, false); assert.equal(calls, 0);
    assert.ok(!JSON.stringify(response).includes("fixture-secret"));
  } finally { globalThis.fetch = original; }
});

test("Trocar a escolha enquanto a permissão é verificada bloqueia a chamada antes do envio", async () => {
  const originalFetch = globalThis.fetch, originalContains = env.chrome.permissions.contains;
  let continuePermission, calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: true, json: async () => success }; };
  env.chrome.permissions.contains = () => new Promise(resolve => { continuePermission = resolve; });
  try {
    await send({ type: "SET_SITE_PREFERENCE", enabled: true });
    const pending = send({ type: "AI_REWRITE", text: "Privado" }); await flush();
    assert.equal(typeof continuePermission, "function");
    await send({ type: "SET_SITE_PREFERENCE", enabled: false });
    await send({ type: "SET_SITE_PREFERENCE", enabled: true });
    continuePermission(true);
    assert.equal((await pending).code, "CANCELLED"); assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; env.chrome.permissions.contains = originalContains; }
});

test("Encerrar a conexão não apaga as decisões salvas para os sites", async () => {
  await send({ type: "SET_SITE_PREFERENCE", enabled: false }, b);
  await send({ type: "REMOVE_PROVIDER_KEY", provider: "openai" }, page);
  assert.equal((await getSitePreference(a.url)).siteEnabled, true);
  assert.equal((await getSitePreference(b.url)).siteDecided, true);
  assert.equal((await getSitePreference(b.url)).siteEnabled, false);
});

async function until(predicate) {
  const deadline = Date.now() + 2000;
  while (!predicate()) { if (Date.now() > deadline) throw new Error("Condição assíncrona não ocorreu"); await new Promise(resolve => setTimeout(resolve, 2)); }
}
