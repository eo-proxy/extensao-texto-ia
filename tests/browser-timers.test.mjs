import test from "node:test";
import assert from "node:assert/strict";
import { RevisionCache } from "../brave-text-assistant/revision-cache.mjs";
import { mockChrome } from "./mock-chrome.mjs";
// Node aceita receptores arbitrários; APIs nativas do navegador não aceitam.
function browserTimers() {
  const original = { set: globalThis.setTimeout, clear: globalThis.clearTimeout };
  const calls = { set: 0, clear: 0 };
  globalThis.setTimeout = function (...args) {
    if (this !== undefined && this !== globalThis) throw new TypeError("Illegal invocation");
    calls.set++; return Reflect.apply(original.set, globalThis, args);
  };
  globalThis.clearTimeout = function (...args) {
    if (this !== undefined && this !== globalThis) throw new TypeError("Illegal invocation");
    calls.clear++; return Reflect.apply(original.clear, globalThis, args);
  };
  return { calls, restore() { globalThis.setTimeout = original.set; globalThis.clearTimeout = original.clear; } };
}
test("Cache chama criação e cancelamento de temporizador com contexto de navegador", () => {
  const timers = browserTimers(), cache = new RevisionCache();
  try {
    assert.throws(() => ({ delay: globalThis.setTimeout }).delay(() => {}, 1), /Illegal invocation/);
    assert.throws(() => ({ cancel: globalThis.clearTimeout }).cancel(1), /Illegal invocation/);
    cache.set("a", "h", "Revisado", { tabId: 1, origin: "https://a.example" });
    assert.equal(cache.get("a", "h"), "Revisado");
    cache.set("a", "h", "Novo", { tabId: 1, origin: "https://a.example" });
    cache.clearTab(1);
    cache.set("b", "h", "Revisado", { tabId: 2, origin: "https://b.example" }); cache.clearOrigin("https://b.example");
    cache.set("c", "h", "Revisado", { tabId: 3, origin: "https://c.example" }); cache.clear();
    assert.equal(timers.calls.set, 4); assert.equal(timers.calls.clear, 4);
  } finally { timers.restore(); cache.clear(); }
});
const env = mockChrome({ storageSchema: 2, provider: "openai", "sitePreference:https://example.com": { enabled: true, revision: "site-fixture" } });
globalThis.chrome = env.chrome;
const initialTimers = browserTimers();
try { await import("../brave-text-assistant/service-worker.js"); } finally { initialTimers.restore(); }
const page = { id: env.chrome.runtime.id, url: env.chrome.runtime.getURL("sidepanel.html") };
const script = { id: page.id, url: "https://example.com", tab: { id: 7, url: "https://example.com" }, frameId: 0 };
const send = (message, sender = script) => new Promise(resolve => env.listeners.message(message, sender, resolve));
for (const provider of ["openai", "gemini", "claude"]) test(provider + ": resposta recebida chega à interface e cache funciona com temporizadores de navegador", async () => {
  const originalFetch = globalThis.fetch, timers = browserTimers(); let calls = 0;
  try {
    const config = await send({ type: "SAVE_PROVIDER_SETTINGS", provider, apiKey: "fixture-key", model: provider === "openai" ? "gpt-test" : provider + "-test" }, page);
    assert.equal(config.ok, true);
    env.permissions.add({ openai: "https://api.openai.com/*", gemini: "https://generativelanguage.googleapis.com/*", claude: "https://api.anthropic.com/*" }[provider]);
    globalThis.fetch = async () => {
      calls++;
      const payload = provider === "openai" ? { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "Revisado" }] }] }
        : provider === "gemini" ? { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "Revisado" }] } }] }
        : { stop_reason: "end_turn", content: [{ type: "text", text: "Revisado" }] };
      return { ok: true, json: async () => payload };
    };
    const request = { type: "AI_REWRITE", text: "Original", requestId: provider };
    const first = await send(request); assert.equal(first.ok, true, first.error); assert.equal(first.suggestion, "Revisado"); assert.equal(first.source, "api");
    assert.equal((await send(request)).source, "memory"); assert.equal(calls, 1);
    env.listeners.tabUpdated(7, { status: "loading" });
    assert.equal((await send(request)).source, "api"); assert.equal(calls, 2);
    env.listeners.tabRemoved(7);
  } finally { timers.restore(); globalThis.fetch = originalFetch; env.listeners.tabRemoved(7); }
});
