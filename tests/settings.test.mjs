import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { initializeStorage, getSettings, saveProviderSettings, selectProvider, disableRemembering, removeProviderKey, markVerified } from "../brave-text-assistant/settings.mjs";
import { mockChrome } from "./mock-chrome.mjs";
let env;
beforeEach(() => { env = mockChrome(); globalThis.chrome = env.chrome; });

test("Por padrão a chave fica só na sessão e é descartada ao trocar de provedor", async () => {
  await initializeStorage();
  await saveProviderSettings({ provider: "gemini", apiKey: "test-key", model: "gemini-test" });
  assert.equal((await getSettings()).rememberCredentials, false);
  assert.ok(!JSON.stringify(env.state).includes("test-key"));
  assert.equal(env.sessionState.activeProviderProfile.apiKey, "test-key");
  await initializeStorage();
  assert.equal((await getSettings()).apiKey, "test-key", "Reiniciar o worker não perde a sessão");
  await selectProvider("openai");
  await selectProvider("gemini");
  assert.equal((await getSettings()).apiKey, undefined);
  assert.equal(env.chrome.accessLevels.local, "TRUSTED_CONTEXTS");
  assert.equal(env.chrome.accessLevels.session, "TRUSTED_CONTEXTS");
});
test("Marcar lembrar persiste; desmarcar apaga a cópia permanente imediatamente", async () => {
  await saveProviderSettings({ provider: "gemini", apiKey: "test-key", model: "gemini-test", rememberCredentials: true });
  await selectProvider("openai"); await selectProvider("gemini");
  assert.equal((await getSettings()).apiKey, "test-key");
  await disableRemembering("gemini");
  assert.equal(env.state.providerProfiles.gemini, undefined);
  assert.equal((await getSettings()).apiKey, "test-key", "A conexão continua em memória");
  await env.chrome.storage.session.clear();
  assert.equal((await getSettings()).apiKey, undefined);
});
test("Atualização retira credenciais antigas sem consentimento do disco", async () => {
  Object.assign(env.state, {
    provider: "gemini", apiKey: "legacy-key", model: "legacy-model",
    providerProfiles: {
      gemini: { apiKey: "old-gemini", model: "gemini-saved" },
      openai: { apiKey: "old-openai", model: "gpt-saved" }
    }
  });
  await initializeStorage();
  assert.equal((await getSettings()).apiKey, "old-gemini");
  assert.equal((await getSettings()).rememberCredentials, false);
  assert.deepEqual(env.state.providerProfiles, {});
  assert.equal(env.state.apiKey, undefined);
  assert.equal(env.state.model, undefined);
  await selectProvider("openai"); await selectProvider("gemini");
  assert.equal((await getSettings()).apiKey, undefined);
});
test("Perfis lembrados continuam separados inclusive em gravações concorrentes", async () => {
  await Promise.all(["openai", "gemini", "claude"].map((provider) => saveProviderSettings({
    provider, apiKey: "test-" + provider, model: provider === "gemini" ? "models/gemini-one" : provider + "-one", rememberCredentials: true
  })));
  assert.equal((await getSettings("gemini")).model, "gemini-one");
  await removeProviderKey("gemini");
  assert.equal((await getSettings("gemini")).apiKey, undefined);
  assert.equal((await getSettings("openai")).apiKey, "test-openai");
});
test("Verificação antiga não aprova modelo novo nem reativa provedor abandonado", async () => {
  await saveProviderSettings({ provider: "openai", apiKey: "test-key", model: "gpt-one" });
  const original = await getSettings();
  await markVerified(original);
  assert.ok((await getSettings()).verifiedAt);
  await saveProviderSettings({ provider: "openai", apiKey: "test-key", model: "gpt-two" });
  await markVerified(original);
  assert.equal((await getSettings()).verifiedAt, null);
  await selectProvider("gemini");
  await markVerified(original);
  assert.equal((await getSettings()).provider, "gemini");
  assert.equal((await getSettings()).apiKey, undefined);
});
test("Provedor inválido e URL no modelo são rejeitados", async () => {
  assert.throws(() => selectProvider("__proto__"));
  assert.throws(() => saveProviderSettings({ provider: "gemini", apiKey: "test-key", model: "https://evil.local/" }));
});

