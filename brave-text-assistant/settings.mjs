import { getProvider, normalizeModel, validateKey } from "./providers.mjs";

export async function initializeStorage() {
  // Chaves acessíveis apenas às páginas da extensão e ao service worker.
  await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  const previous = await chrome.storage.local.get(["provider", "providerProfiles", "apiKey", "model"]);
  if (previous.apiKey) {
    const provider = previous.provider || "openai";
    getProvider(provider);
    const profiles = previous.providerProfiles || {};
    if (!profiles[provider]?.apiKey) {
      profiles[provider] = { apiKey: previous.apiKey, model: previous.model || "", verifiedAt: null };
      await chrome.storage.local.set({ provider, providerProfiles: profiles });
    }
    await chrome.storage.local.remove(["apiKey", "model"]);
  }
}

let writes = Promise.resolve();
function updateProfiles(callback) {
  const pending = writes.then(async () => {
    const { providerProfiles = {} } = await chrome.storage.local.get("providerProfiles");
    await callback(providerProfiles);
  });
  writes = pending.catch(() => {});
  return pending;
}

export async function getSettings(provider) {
  const stored = await chrome.storage.local.get(["provider", "providerProfiles"]);
  const selected = provider || stored.provider || "openai";
  getProvider(selected);
  return { provider: selected, ...(stored.providerProfiles?.[selected] || {}) };
}

export function saveProviderSettings({ provider, apiKey, model }) {
  getProvider(provider);
  const key = validateKey(apiKey);
  const modelId = normalizeModel(provider, model);
  return updateProfiles(async (profiles) => {
    const previous = profiles[provider];
    const unchanged = previous?.apiKey === key && previous?.model === modelId;
    profiles[provider] = { apiKey: key, model: modelId, verifiedAt: unchanged ? previous.verifiedAt || null : null };
    await chrome.storage.local.set({ provider, providerProfiles: profiles });
  });
}

export function removeProviderKey(provider) {
  getProvider(provider);
  return updateProfiles(async (profiles) => {
    delete profiles[provider];
    await chrome.storage.local.set({ providerProfiles: profiles });
  });
}

export function markVerified(settings) {
  return updateProfiles(async (profiles) => {
    const current = profiles[settings.provider];
    if (current?.apiKey === settings.apiKey && current?.model === settings.model) {
      current.verifiedAt = Date.now();
      await chrome.storage.local.set({ providerProfiles: profiles });
    }
  });
}

