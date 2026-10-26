import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { initializeStorage, getSettings, saveProviderSettings, removeProviderKey, markVerified } from "../brave-text-assistant/settings.mjs";
import { mockChrome } from "./mock-chrome.mjs";

let env;
beforeEach(() => { env = mockChrome(); globalThis.chrome = env.chrome; });

test("Migração preserva chave e modelo existentes e restringe o acesso ao storage", async () => {
  env.state.provider = "gemini";
  env.state.apiKey = "test-old-key";
  env.state.model = "gemini-saved";
  await initializeStorage();
  assert.equal(env.chrome.accessLevel, "TRUSTED_CONTEXTS");
  assert.equal((await getSettings()).apiKey, "test-old-key");
  assert.equal((await getSettings()).model, "gemini-saved");
  assert.equal(env.state.apiKey, undefined);
  await initializeStorage();
  assert.equal((await getSettings()).apiKey, "test-old-key", "A migração pode ser repetida sem perder dados");
});

test("Salvar provedores em sequência ou concorrência não mistura nem apaga chaves", async () => {
  await Promise.all([
    saveProviderSettings({ provider: "openai", apiKey: "test-openai", model: "gpt-one" }),
    saveProviderSettings({ provider: "gemini", apiKey: "test-google", model: "models/gemini-one" }),
    saveProviderSettings({ provider: "claude", apiKey: "test-anthropic", model: "claude-one" })
  ]);
  assert.equal((await getSettings("openai")).apiKey, "test-openai");
  assert.equal((await getSettings("gemini")).model, "gemini-one");
  assert.equal((await getSettings("claude")).apiKey, "test-anthropic");
  await removeProviderKey("gemini");
  assert.equal((await getSettings("gemini")).apiKey, undefined);
  assert.equal((await getSettings("openai")).apiKey, "test-openai");
});

test("Chave pode ser salva antes de escolher modelo ou conceder permissão", async () => {
  await saveProviderSettings({ provider: "openai", apiKey: "test-key", model: "" });
  assert.equal((await getSettings()).apiKey, "test-key");
  assert.equal((await getSettings()).model, "");
});

test("Alterar modelo invalida a confirmação de teste, e resposta antiga não verifica configuração nova", async () => {
  await saveProviderSettings({ provider: "openai", apiKey: "test-key", model: "gpt-one" });
  const original = await getSettings();
  await markVerified(original);
  assert.ok((await getSettings()).verifiedAt);
  await saveProviderSettings({ provider: "openai", apiKey: "test-key", model: "gpt-two" });
  await markVerified(original);
  assert.equal((await getSettings()).verifiedAt, null);
});

