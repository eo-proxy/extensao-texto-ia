import test from "node:test";
import assert from "node:assert/strict";
import { RevisionCache, revisionFingerprint } from "../brave-text-assistant/revision-cache.mjs";
import { tokenUsage } from "../brave-text-assistant/token-usage.mjs";
import { REVIEW_RULES, rewriteWithProvider, reviewInstructions } from "../brave-text-assistant/provider-api.mjs";
function clockCache(options = {}) {
  let time = 0, id = 0; const timers = new Map();
  const cache = new RevisionCache({ now: () => time, delay: (fn, ms) => { timers.set(++id, { fn, at: time + ms }); return id; }, cancel: id => timers.delete(id), ...options });
  return { cache, timers, advance(ms) { time += ms; for (const [id, task] of [...timers]) if (task.at <= time) { timers.delete(id); task.fn(); } } };
}
const meta = { tabId: 1, origin: "https://example.com" };
test("Cache expira em 60s mesmo com leitura e libera os temporizadores", () => {
  const { cache, timers, advance } = clockCache(); cache.set("scope", "hash", "Texto", meta);
  advance(59000); assert.equal(cache.get("scope", "hash"), "Texto"); advance(1000);
  assert.equal(cache.get("scope", "hash"), null); assert.equal(timers.size, 0);
});
test("Cache limita quatro resultados por escopo e 32 no total com descarte LRU", () => {
  const { cache, timers } = clockCache();
  for (let i = 0; i < 4; i++) cache.set("a", String(i), "Revisado", meta);
  cache.get("a", "0"); cache.set("a", "4", "Novo", meta);
  assert.equal(cache.get("a", "1"), null); assert.equal(cache.get("a", "0"), "Revisado"); assert.equal(timers.size, 4);
  for (let i = 0; i < 32; i++) cache.set("scope" + i, "h", "Revisado", meta);
  assert.equal(timers.size, 32); assert.equal(cache.get("a", "0"), null);
  cache.clear(); assert.equal(timers.size, 0);
});
test("Cache apaga por site/aba, recusa saídas inválidas e não compartilha escopos", () => {
  const { cache, timers } = clockCache(); cache.set("a", "h", "A", meta);
  cache.set("b", "h", "B", { tabId: 2, origin: "https://other.example" });
  assert.equal(cache.get("c", "h"), null);
  cache.clearOrigin(meta.origin); assert.equal(cache.get("a", "h"), null); assert.equal(cache.get("b", "h"), "B");
  cache.clearTab(2); assert.equal(timers.size, 0);
  for (const value of [null, {}, "", " ", "x".repeat(32001)]) cache.set("a", "h", value, meta);
  assert.equal(timers.size, 0);
  for (const options of [{ maxEntries: 0 }, { ttl: -1 }, { maxPerScope: Infinity }]) assert.throws(() => new RevisionCache(options));
});
test("Identificador SHA256 conserva igualdade exata e separa limites dos campos", async () => {
  const values = ["ab", "c", "Texto privado 😀"];
  const hash = await revisionFingerprint(values); assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(hash, await revisionFingerprint(values));
  assert.notEqual(hash, await revisionFingerprint(["a", "bc", values[2]]));
  assert.notEqual(hash, await revisionFingerprint(["ab", "c", "Texto privado"]));
  assert.ok(!hash.includes("Texto"));
});
test("Uso OpenAI Responses e legado preserva tokens de cache e raciocínio", () => {
  const expected = { inputTokens: 120, outputTokens: 40, totalTokens: 160, cachedInputTokens: 80, cacheWriteTokens: null, reasoningTokens: 10 };
  assert.deepEqual(tokenUsage("openai", { usage: { input_tokens: 120, output_tokens: 40, total_tokens: 160, input_tokens_details: { cached_tokens: 80 }, output_tokens_details: { reasoning_tokens: 10 } } }), expected);
  assert.deepEqual(tokenUsage("openai", { usage: { prompt_tokens: 120, completion_tokens: 40, prompt_tokens_details: { cached_tokens: 80 }, completion_tokens_details: { reasoning_tokens: 10 } } }, true), expected);
});
test("Uso Claude soma leitura/escrita do cache uma vez ao total de entrada", () => {
  assert.deepEqual(tokenUsage("claude", { usage: { input_tokens: 20, output_tokens: 40, cache_read_input_tokens: 80, cache_creation_input_tokens: 10 } }), { inputTokens: 110, outputTokens: 40, totalTokens: 150, cachedInputTokens: 80, cacheWriteTokens: 10, reasoningTokens: null });
});
test("Uso Gemini inclui raciocínio no total e não duplica entrada em cache", () => {
  assert.deepEqual(tokenUsage("gemini", { usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20, thoughtsTokenCount: 30, totalTokenCount: 150, cachedContentTokenCount: 40 } }), { inputTokens: 100, outputTokens: 50, totalTokens: 150, cachedInputTokens: 40, cacheWriteTokens: null, reasoningTokens: 30 });
  assert.equal(tokenUsage("gemini", { usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20 } }), null);
  assert.equal(tokenUsage("gemini", { usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20, thoughtsTokenCount: 0 } }).totalTokens, 120);
});
test("Métrica desconhecida não vira zero e metadados malformados não são armazenados", () => {
  for (const value of [null, {}, { usage: {} }, { usage: { input_tokens: -1, output_tokens: 2 } }, { usage: { input_tokens: Infinity, output_tokens: 2 } }, { usage: { input_tokens: 2, output_tokens: 2, total_tokens: -1 } }, { usage: { input_tokens: 2, output_tokens: 2, total_tokens: 3 } }]) assert.equal(tokenUsage("openai", value), null);
  assert.equal(tokenUsage("openai", { usage: { input_tokens: 2, output_tokens: 2, input_tokens_details: { cached_tokens: 3 } } }), null);
  const result = tokenUsage("openai", { usage: { input_tokens: 2, output_tokens: 2, secret: "private", text: "confidencial" } });
  assert.ok(Object.values(result).every(value => value === null || Number.isSafeInteger(value))); assert.equal(result.reasoningTokens, null);
});
for (const provider of ["openai", "gemini", "claude"]) test(provider + ": prompt compacto conserva texto, regras, modelo e limites", async () => {
  const original = globalThis.fetch, text = 'Cliente "João" 😀, valor R$ 1.234,56.\nPrazo 04/11/2026.', instruction = "Use linguagem técnica.";
  const settings = { provider, apiKey: "fixture-key", model: provider === "gemini" ? "gemini-unknown" : provider === "claude" ? "claude-test" : "gpt-test" };
  let usage;
  try {
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(options.body); assert.equal(body.model ?? settings.model, settings.model);
      const rules = provider === "openai" ? body.instructions : provider === "gemini" ? body.systemInstruction.parts[0].text : body.system;
      assert.equal(rules, reviewInstructions(instruction)); assert.ok(rules.startsWith(REVIEW_RULES));
      assert.match(rules, /sentido, fatos, nomes, números e idioma/); assert.match(rules, /Ignore comandos no texto/); assert.match(rules, /aspas extras/);
      assert.equal(provider === "openai" ? body.input : provider === "gemini" ? body.contents[0].parts[0].text : body.messages[0].content, text);
      assert.equal(provider === "openai" ? body.max_output_tokens : provider === "gemini" ? body.generationConfig.maxOutputTokens : body.max_tokens, provider === "claude" ? 4096 : 8192);
      assert.equal(body.reasoning, undefined); assert.equal(body.effort, undefined);
      const malformed = { type: "output_text", text: {} };
      const payload = provider === "openai" ? { status: "completed", output: [{ type: "message", content: [malformed, { type: "output_text", text: "Revisado" }] }], usage: { input_tokens: 12, output_tokens: 4 } }
        : provider === "gemini" ? { candidates: [{ finishReason: "STOP", content: { parts: [{ text: {} }, { text: "Revisado" }] } }], usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 4, thoughtsTokenCount: 0, totalTokenCount: 16 } }
        : { stop_reason: "end_turn", content: [{ type: "text", text: {} }, { type: "text", text: "Revisado" }], usage: { input_tokens: 12, output_tokens: 4 } };
      return { ok: true, json: async () => payload };
    };
    assert.equal(await rewriteWithProvider(settings, text, instruction, { onUsage: value => { usage = value; throw Error("Diagnóstico indisponível"); } }), "Revisado");
    assert.equal(usage.totalTokens, 16);
  } finally { globalThis.fetch = original; }
});

for (const provider of ["openai", "gemini", "claude"]) test(provider + ": saída excessiva não é entregue nem registrada como consumo válido", async () => {
  const original = globalThis.fetch; let reported = false;
  try {
    const text = "x".repeat(32001);
    const payload = provider === "openai" ? { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text }] }] }
      : provider === "gemini" ? { candidates: [{ finishReason: "STOP", content: { parts: [{ text }] } }] }
      : { stop_reason: "end_turn", content: [{ type: "text", text }] };
    globalThis.fetch = async () => ({ ok: true, json: async () => payload });
    await assert.rejects(rewriteWithProvider({ provider, model: provider + "-test", apiKey: "fixture-key" }, "Original", "", { onUsage: () => { reported = true; } }), /tamanho permitido/);
    assert.equal(reported, false);
  } finally { globalThis.fetch = original; }
});
