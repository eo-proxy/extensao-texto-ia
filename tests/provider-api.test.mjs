import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { listProviderModels, rewriteWithProvider } from "../brave-text-assistant/provider-api.mjs";
import { normalizeModel, validateKey } from "../brave-text-assistant/providers.mjs";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const settings = (provider) => ({ provider, apiKey: "test-" + provider + "-key", model: provider === "gemini" ? "models/gemini-test" : provider === "claude" ? "claude-test" : "gpt-test" });
const respond = (payload, status = 200) => ({ ok: status < 400, status, json: async () => payload });
const completeOpenAI = (text) => ({ status: "completed", output: [{ type: "reasoning" }, { type: "message", content: [{ type: "output_text", text }] }] });

test("OpenAI: Responses, Bearer, store false e extração além do primeiro item", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    assert.equal(options.headers.Authorization, "Bearer test-openai-key");
    const body = JSON.parse(options.body);
    assert.equal(body.input, "Texto original");
    assert.match(body.instructions, /sem introduções/);
    assert.equal(body.store, false);
    assert.equal(options.redirect, "error");
    assert.equal(options.credentials, "omit");
    return respond(completeOpenAI("Texto revisado"));
  };
  assert.equal(await rewriteWithProvider(settings("openai"), "Texto original"), "Texto revisado");
});

test("OpenAI: modelo antigo continua usando Chat Completions", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/chat/completions");
    assert.equal(JSON.parse(options.body).messages[1].content, "Texto");
    return respond({ choices: [{ finish_reason: "stop", message: { content: "Revisado" } }] });
  };
  assert.equal(await rewriteWithProvider({ ...settings("openai"), model: "gpt-4-turbo" }, "Texto"), "Revisado");
});

test("Gemini: cabeçalho próprio, prefixo models/ e conteúdo sem pensamentos", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent");
    assert.equal(options.headers["x-goog-api-key"], "test-gemini-key");
    assert.equal(options.headers.Authorization, undefined);
    assert.ok(!url.includes("test-gemini-key"));
    const body = JSON.parse(options.body);
    assert.equal(body.contents[0].parts[0].text, "Texto");
    assert.ok(body.systemInstruction.parts[0].text);
    return respond({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "Raciocínio", thought: true }, { text: "Revisado" }] } }] });
  };
  assert.equal(await rewriteWithProvider(settings("gemini"), "Texto"), "Revisado");
});

test("Claude: Messages com versão explícita e blocos de texto", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.anthropic.com/v1/messages");
    assert.equal(options.headers.Authorization, "Bearer test-claude-key");
    assert.equal(options.headers["anthropic-version"], "2023-06-01");
    assert.equal(options.headers["anthropic-dangerous-direct-browser-access"], "true");
    assert.ok(JSON.parse(options.body).max_tokens >= 4000);
    return respond({ stop_reason: "end_turn", content: [{ type: "thinking", thinking: "Não exibir" }, { type: "text", text: "Revisado" }] });
  };
  assert.equal(await rewriteWithProvider(settings("claude"), "Texto"), "Revisado");
});

for (const [provider, response] of [
  ["openai", { status: "incomplete", output: [{ type: "message", content: [{ type: "output_text", text: "Cortado" }] }] }],
  ["gemini", { candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "Cortado" }] } }] }],
  ["claude", { stop_reason: "max_tokens", content: [{ type: "text", text: "Cortado" }] }]
]) {
  test(provider + ": não aplica resposta incompleta", async () => {
    globalThis.fetch = async () => respond(response);
    await assert.rejects(rewriteWithProvider(settings(provider), "Texto"), /não concluiu/);
  });
}

test("Bloqueio de segurança Gemini e recusa OpenAI não viram sugestão", async () => {
  globalThis.fetch = async () => respond({ promptFeedback: { blockReason: "SAFETY" } });
  await assert.rejects(rewriteWithProvider(settings("gemini"), "Texto"), /bloqueou/);
  globalThis.fetch = async () => respond({ status: "completed", output: [{ type: "message", content: [{ type: "refusal" }] }] });
  await assert.rejects(rewriteWithProvider(settings("openai"), "Texto"), /recusou/);
});

test("Listagem Gemini percorre páginas, filtra embeddings e modelos sem generateContent", async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    return calls.length === 1
      ? respond({ models: [
        { name: "models/gemini-good", displayName: "Gemini Good", supportedGenerationMethods: ["generateContent"] },
        { name: "models/gemini-image", supportedGenerationMethods: ["generateContent"] },
        { name: "models/gemini-embedding", supportedGenerationMethods: ["embedContent"] }
      ], nextPageToken: "next token" })
      : respond({ models: [{ name: "models/gemini-second", supportedGenerationMethods: ["generateContent"] }] });
  };
  const result = await listProviderModels(settings("gemini"));
  assert.deepEqual(result.models.map((model) => model.id), ["gemini-good", "gemini-second"]);
  assert.ok(calls[1].includes("pageToken=next+token"));
  assert.equal(result.partial, false);
});

test("OpenAI consulta modelos sem gerar texto nem listar áudio ou imagens", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/models");
    assert.equal(options.method, "GET");
    assert.equal(options.body, undefined);
    return respond({ data: [{ id: "gpt-text" }, { id: "gpt-audio" }, { id: "gpt-image" }, { id: "text-embedding" }, { id: "o3" }] });
  };
  assert.deepEqual((await listProviderModels(settings("openai"))).models.map((model) => model.id), ["gpt-text", "o3"]);
});

test("Listagem Claude percorre cursor e ignora modelos retirados", async () => {
  let page = 0;
  globalThis.fetch = async (url) => {
    page += 1;
    if (page === 1) return respond({ data: [{ id: "claude-a", display_name: "Claude A" }], has_more: true, last_id: "claude-a" });
    assert.match(url, /after_id=claude-a/);
    return respond({ data: [{ id: "claude-b" }, { id: "claude-old", lifecycle: "retired" }], has_more: false });
  };
  assert.equal((await listProviderModels(settings("claude"))).models.length, 2);
});

for (const [status, code, expected] of [
  [401, "invalid_api_key", /chave inválida/],
  [403, "PERMISSION_DENIED", /acesso negado/],
  [404, "NOT_FOUND", /modelo indisponível/],
  [429, "RESOURCE_EXHAUSTED", /limite ou cota/],
  [429, "insufficient_quota", /créditos/],
  [503, "UNAVAILABLE", /temporariamente indisponível/]
]) {
  test("Erros HTTP " + status + "/" + code + " orientam sem expor chave", async () => {
    globalThis.fetch = async () => respond({ error: { code, message: "raw test-gemini-key must stay private" } }, status);
    await assert.rejects(rewriteWithProvider(settings("gemini"), "Texto"), (error) => {
      assert.match(error.message, expected);
      assert.ok(!error.message.includes("test-gemini-key"));
      return true;
    });
  });
}

test("Validação rejeita URL no ID, chave com quebra de linha e entradas inválidas antes da rede", async () => {
  globalThis.fetch = () => { throw new Error("A rede não deve ser chamada"); };
  assert.equal(normalizeModel("gemini", "models/gemini-test"), "gemini-test");
  assert.throws(() => normalizeModel("gemini", "https://outro.local/modelo"), /apenas o ID/);
  assert.throws(() => validateKey("uma\nchave"), /caracteres inválidos/);
  await assert.rejects(rewriteWithProvider({ ...settings("openai"), model: "" }, "Texto"), /Selecione um modelo/);
  await assert.rejects(rewriteWithProvider(settings("claude"), "x".repeat(4001)), /4.000/);
  await assert.rejects(rewriteWithProvider(settings("claude"), { text: "Objeto" }), /texto no campo/);
});

test("Abort e resposta não JSON produzem orientação sem conteúdo bruto", async () => {
  globalThis.fetch = async () => { throw Object.assign(new Error("raw"), { name: "AbortError" }); };
  await assert.rejects(rewriteWithProvider(settings("openai"), "Texto"), /demorou demais/);
  globalThis.fetch = async () => ({ ok: true, json: async () => { throw new Error("segredo"); } });
  await assert.rejects(rewriteWithProvider(settings("claude"), "Texto"), /resposta inválida/);
});

