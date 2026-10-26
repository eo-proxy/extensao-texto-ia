import { getProvider } from "./providers.mjs";
import { initializeStorage, getSettings, saveProviderSettings, removeProviderKey, markVerified } from "./settings.mjs";
import { listProviderModels, rewriteWithProvider } from "./provider-api.mjs";

const ready = initializeStorage().then(() => true, () => false);
const PRIVILEGED = new Set(["GET_SETTINGS", "SAVE_PROVIDER_SETTINGS", "REMOVE_PROVIDER_KEY", "LIST_PROVIDER_MODELS", "TEST_PROVIDER"]);

function trustedPage(sender) {
  return sender.id === chrome.runtime.id && sender.url?.split(/[?#]/)[0] === chrome.runtime.getURL("sidepanel.html");
}

async function requirePermission(provider) {
  const permitted = await chrome.permissions.contains({ origins: [getProvider(provider).host] });
  if (!permitted) throw new Error("Sua chave está salva. Abra as configurações e clique em Autorizar acesso para este provedor.");
}

async function handleMessage(message, sender) {
  if (!await ready) throw new Error("Não foi possível preparar o armazenamento seguro da extensão. Recarregue a extensão no Brave.");
  if (PRIVILEGED.has(message.type) && !trustedPage(sender)) throw new Error("Esta operação só pode ser feita nas configurações da extensão.");

  if (message.type === "GET_SETTINGS") {
    const stored = await chrome.storage.local.get(["provider", "providerProfiles", "widgetEnabled"]);
    return { provider: stored.provider || "openai", profiles: stored.providerProfiles || {}, widgetEnabled: stored.widgetEnabled !== false };
  }
  if (message.type === "SAVE_PROVIDER_SETTINGS") {
    await saveProviderSettings(message);
    return {};
  }
  if (message.type === "REMOVE_PROVIDER_KEY") {
    await removeProviderKey(message.provider);
    return {};
  }
  if (message.type === "LIST_PROVIDER_MODELS" || message.type === "TEST_PROVIDER") {
    const settings = await getSettings(message.provider);
    await requirePermission(settings.provider);
    if (message.type === "LIST_PROVIDER_MODELS") return listProviderModels(settings);
    // Teste solicitado pelo usuário com texto fixo, nunca com conteúdo da página.
    await rewriteWithProvider(settings, "Olá, este é um teste de conexão.", "Corrija apenas a ortografia.");
    await markVerified(settings);
    return { tested: true };
  }
  if (message.type === "GET_WIDGET_CONFIG") {
    const settings = await getSettings();
    const prefs = await chrome.storage.local.get(["autoEnabled", "autoApplyEnabled", "widgetEnabled", "widgetInstruction", "widgetPosition"]);
    const permitted = await chrome.permissions.contains({ origins: [getProvider(settings.provider).host] });
    return {
      configured: Boolean(settings.apiKey && settings.model && permitted),
      provider: settings.provider,
      model: settings.model || "",
      autoEnabled: prefs.autoEnabled !== false,
      autoApplyEnabled: prefs.autoApplyEnabled === true,
      widgetEnabled: prefs.widgetEnabled !== false,
      widgetInstruction: prefs.widgetInstruction || "professional",
      widgetPosition: prefs.widgetPosition || null
    };
  }
  if (message.type === "SET_WIDGET_PREFS") {
    const updates = {};
    if (typeof message.autoEnabled === "boolean") updates.autoEnabled = message.autoEnabled;
    if (typeof message.autoApplyEnabled === "boolean") updates.autoApplyEnabled = message.autoApplyEnabled;
    if (typeof message.widgetEnabled === "boolean") updates.widgetEnabled = message.widgetEnabled;
    if (["professional", "technical", "correct"].includes(message.widgetInstruction)) updates.widgetInstruction = message.widgetInstruction;
    if (message.widgetPosition && Number.isFinite(message.widgetPosition.x) && Number.isFinite(message.widgetPosition.y)) {
      updates.widgetPosition = { x: message.widgetPosition.x, y: message.widgetPosition.y };
    }
    await chrome.storage.local.set(updates);
    return {};
  }
  if (message.type === "AI_REWRITE") {
    const settings = await getSettings();
    await requirePermission(settings.provider);
    const suggestion = await rewriteWithProvider(settings, message.text, message.instruction);
    return { suggestion };
  }
  throw new Error("Operação desconhecida.");
}

const ALLOWED = new Set([...PRIVILEGED, "GET_WIDGET_CONFIG", "SET_WIDGET_PREFS", "AI_REWRITE"]);
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !ALLOWED.has(message.type)) return;
  if (sender.id !== chrome.runtime.id) {
    sendResponse({ ok: false, error: "Origem da solicitação inválida." });
    return;
  }
  handleMessage(message, sender)
    .then((result) => sendResponse({ ...result, ok: true }))
    .catch((error) => sendResponse({ ok: false, error: error?.message || "Não foi possível concluir a operação." }));
  return true;
});

async function notifyWidgets() {
  try {
    const tabs = await chrome.tabs.query({});
    await Promise.allSettled(tabs.filter((tab) => tab.id != null).map((tab) =>
      chrome.tabs.sendMessage(tab.id, { type: "WIDGET_CONFIG_CHANGED" })
    ));
  } catch (_) { /* Abas protegidas ou fechadas não recebem o aviso. */ }
}

chrome.storage.onChanged.addListener((changes, area) => {
  const watched = ["provider", "providerProfiles", "autoEnabled", "autoApplyEnabled", "widgetEnabled", "widgetInstruction"];
  if (area === "local" && watched.some((key) => Object.hasOwn(changes, key))) notifyWidgets();
});
chrome.permissions.onAdded.addListener(notifyWidgets);
chrome.permissions.onRemoved.addListener(notifyWidgets);


