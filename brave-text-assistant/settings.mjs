import { getProvider, normalizeModel, validateKey } from "./providers.mjs";

let writes = Promise.resolve();
function serialize(callback) {
  const pending = writes.then(callback);
  writes = pending.catch(() => {});
  return pending;
}
export async function initializeStorage() {
  await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  await chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  const previous = await chrome.storage.local.get(["storageSchema", "provider", "providerProfiles", "apiKey", "model"]);
  if (previous.storageSchema === 2) return;
  const provider = previous.provider || "openai";
  getProvider(provider);
  const profiles = previous.providerProfiles || {};
  const active = profiles[provider] || (previous.apiKey ? { apiKey: previous.apiKey, model: previous.model || "" } : null);
  const remembered = Object.fromEntries(Object.entries(profiles).filter(([id, profile]) =>
    ["openai", "gemini", "claude"].includes(id) && profile.rememberCredentials === true
  ));
  // Versões anteriores salvavam sem consentimento: mantenha só a conexão ativa em memória.
  if (active?.apiKey && active.rememberCredentials !== true) {
    await chrome.storage.session.set({ activeProviderProfile: {
      ...active, provider, rememberCredentials: false, geminiSpeed: active.geminiSpeed || "fast",
      revision: crypto.randomUUID(), verifiedAt: null
    } });
  }
  await chrome.storage.local.set({ storageSchema: 2, provider, providerProfiles: remembered });
  await chrome.storage.local.remove(["apiKey", "model"]);
}
export async function getSettings(provider) {
  const [local, session] = await Promise.all([
    chrome.storage.local.get(["provider", "providerProfiles"]),
    chrome.storage.session.get("activeProviderProfile")
  ]);
  const selected = provider || local.provider || "openai";
  getProvider(selected);
  const active = session.activeProviderProfile;
  const profile = active?.provider === selected ? active : local.providerProfiles?.[selected];
  return { provider: selected, ...(profile || {}), rememberCredentials: profile?.rememberCredentials === true };
}
export async function getSettingsForPage() {
  const local = await chrome.storage.local.get(["provider", "providerProfiles", "widgetEnabled", "autoEnabled", "autoApplyEnabled"]);
  const active = await getSettings();
  const profiles = { ...(local.providerProfiles || {}) };
  if (active.apiKey) profiles[active.provider] = active;
  const { diagnostics = {} } = await chrome.storage.session.get("diagnostics");
  return {
    provider: active.provider, profiles, widgetEnabled: local.widgetEnabled !== false,
    autoEnabled: local.autoEnabled !== false, autoApplyEnabled: local.autoApplyEnabled === true,
    diagnostics
  };
}
export function selectProvider(provider) {
  getProvider(provider);
  return serialize(async () => {
    const current = await getSettings();
    if (current.provider !== provider) await chrome.storage.session.remove("activeProviderProfile");
    await chrome.storage.local.set({ provider });
  });
}
export function saveProviderSettings({ provider, apiKey, model, rememberCredentials = false, geminiSpeed = "fast" }) {
  getProvider(provider);
  const key = validateKey(apiKey);
  const modelId = normalizeModel(provider, model);
  if (!["fast", "standard"].includes(geminiSpeed)) throw new Error("Escolha um modo Gemini válido.");
  return serialize(async () => {
    const current = await getSettings(provider);
    const unchanged = current.apiKey === key && current.model === modelId && current.geminiSpeed === geminiSpeed;
    const profile = {
      provider, apiKey: key, model: modelId, geminiSpeed,
      rememberCredentials: rememberCredentials === true,
      revision: unchanged && current.revision ? current.revision : crypto.randomUUID(),
      verifiedAt: unchanged ? current.verifiedAt || null : null
    };
    const { providerProfiles = {} } = await chrome.storage.local.get("providerProfiles");
    if (profile.rememberCredentials) providerProfiles[provider] = profile;
    else delete providerProfiles[provider];
    // Grave na sessão antes de tocar no estado persistente: o popup pode fechar ao autorizar.
    await chrome.storage.session.set({ activeProviderProfile: profile });
    await chrome.storage.local.set({ provider, providerProfiles });
    return profile;
  });
}
export function disableRemembering(provider) {
  getProvider(provider);
  return serialize(async () => {
    const current = await getSettings(provider);
    const { providerProfiles = {} } = await chrome.storage.local.get("providerProfiles");
    delete providerProfiles[provider];
    if (current.apiKey) await chrome.storage.session.set({ activeProviderProfile: { ...current, rememberCredentials: false } });
    await chrome.storage.local.set({ providerProfiles });
  });
}
export function removeProviderKey(provider) {
  getProvider(provider);
  return serialize(async () => {
    const { providerProfiles = {} } = await chrome.storage.local.get("providerProfiles");
    delete providerProfiles[provider];
    const { activeProviderProfile } = await chrome.storage.session.get("activeProviderProfile");
    if (activeProviderProfile?.provider === provider) await chrome.storage.session.remove("activeProviderProfile");
    await chrome.storage.local.set({ providerProfiles });
  });
}
export function markVerified(settings) {
  return serialize(async () => {
    if ((await getSettings()).provider !== settings.provider) return;
    const current = await getSettings(settings.provider);
    if (current.revision !== settings.revision || current.apiKey !== settings.apiKey || current.model !== settings.model) return;
    const profile = { ...current, verifiedAt: Date.now() };
    await chrome.storage.session.set({ activeProviderProfile: profile });
    if (profile.rememberCredentials) {
      const { providerProfiles = {} } = await chrome.storage.local.get("providerProfiles");
      providerProfiles[profile.provider] = profile;
      await chrome.storage.local.set({ providerProfiles });
    }
  });
}


