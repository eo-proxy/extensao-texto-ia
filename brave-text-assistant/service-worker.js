import { getProvider } from "./providers.mjs";
import { initializeStorage, getSettings, getSettingsForPage, selectProvider, saveProviderSettings, disableRemembering, removeProviderKey, markVerified } from "./settings.mjs";
import { listProviderModels, rewriteWithProvider, apiFailure } from "./provider-api.mjs";

const ready = initializeStorage().then(() => true, () => false);
const PRIVILEGED = new Set(["GET_SETTINGS", "SELECT_PROVIDER", "SAVE_PROVIDER_SETTINGS", "DISABLE_REMEMBERING", "REMOVE_PROVIDER_KEY", "LIST_PROVIDER_MODELS", "TEST_PROVIDER"]);
const jobs = new Map();
const blockedUntil = new Map();

function trustedPage(sender) {
  return sender.id === chrome.runtime.id && sender.url?.split(/[?#]/)[0] === chrome.runtime.getURL("sidepanel.html");
}
function requestScope(sender) { return String(sender.tab?.id ?? "popup") + ":" + String(sender.frameId ?? 0); }
function cancelJobs() { for (const job of jobs.values()) job.controller.abort(); jobs.clear(); }
async function requirePermission(provider) {
  if (!await chrome.permissions.contains({ origins: [getProvider(provider).host] })) throw new Error("Abra Configuração e autorize o acesso a este provedor.");
}
function publicError(error) {
  return {
    error: error?.message || "Não foi possível concluir a operação.",
    code: /^[A-Z_]{1,30}$/.test(error?.code || "") ? error.code : "ERROR",
    httpStatus: Number.isInteger(error?.httpStatus) ? error.httpStatus : 0,
    retryAfterMs: Number.isFinite(error?.retryAfterMs) ? error.retryAfterMs : 0
  };
}
async function diagnose(settings, startedAt, outcome) {
  const { diagnostics = {} } = await chrome.storage.session.get("diagnostics");
  // Não grave prompts, respostas, chaves, URL visitada ou mensagens brutas da API.
  diagnostics[settings.provider] = {
    provider: settings.provider, model: settings.model || "", revision: settings.revision || "", at: Date.now(),
    durationMs: Math.max(0, Date.now() - startedAt),
    code: outcome.code || "OK", httpStatus: outcome.httpStatus || 200
  };
  await chrome.storage.session.set({ diagnostics });
}
async function generate(message, sender, test = false) {
  const settings = await getSettings(test ? message.provider : undefined);
  await requirePermission(settings.provider);
  const key = requestScope(sender);
  if (jobs.has(key)) jobs.get(key).controller.abort();
  const job = { controller: new AbortController(), id: message.requestId || "manual" };
  jobs.set(key, job);
  const startedAt = Date.now();
  try {
    const block = blockedUntil.get(settings.revision);
    if (block?.until > Date.now()) throw apiFailure("A API pediu uma pausa. Aguarde " + Math.ceil((block.until - Date.now()) / 1000) + " s antes de tentar novamente.", block.code, block.status, block.until - Date.now());
    const suggestion = await rewriteWithProvider(
      settings, test ? "Olá, este é um teste de conexão." : message.text,
      test ? "Corrija apenas a ortografia." : message.instruction,
      { signal: job.controller.signal }
    );
    if (job.controller.signal.aborted || (await getSettings()).revision !== settings.revision) throw apiFailure("Revisão cancelada.", "CANCELLED");
    await diagnose(settings, startedAt, { code: "OK", httpStatus: 200 });
    if (test) { await markVerified(settings); return { tested: true, durationMs: Date.now() - startedAt }; }
    return { suggestion, durationMs: Date.now() - startedAt };
  } catch (error) {
    if (error.code !== "CANCELLED" && !job.controller.signal.aborted) {
      await diagnose(settings, startedAt, publicError(error));
      if (error.retryAfterMs > 0) blockedUntil.set(settings.revision, { until: Date.now() + error.retryAfterMs, code: error.code, status: error.httpStatus });
    }
    if (job.controller.signal.aborted) throw apiFailure("Revisão cancelada.", "CANCELLED");
    throw error;
  } finally { if (jobs.get(key) === job) jobs.delete(key); }
}
async function handleMessage(message, sender) {
  if (!await ready) throw new Error("Não foi possível preparar a extensão. Recarregue-a no navegador.");
  if (PRIVILEGED.has(message.type) && !trustedPage(sender)) throw new Error("Esta operação só pode ser feita nas configurações da extensão.");
  if (message.type === "GET_SETTINGS") return getSettingsForPage();
  if (message.type === "SELECT_PROVIDER") {
    cancelJobs();
    await selectProvider(message.provider);
    return getSettingsForPage();
  }
  if (message.type === "SAVE_PROVIDER_SETTINGS") {
    const previous = await getSettings();
    const profile = await saveProviderSettings(message);
    if (previous.revision !== profile.revision) cancelJobs();
    return { profile };
  }
  if (message.type === "DISABLE_REMEMBERING") { await disableRemembering(message.provider); return {}; }
  if (message.type === "REMOVE_PROVIDER_KEY") {
    cancelJobs();
    await removeProviderKey(message.provider);
    return {};
  }
  if (message.type === "LIST_PROVIDER_MODELS") {
    const settings = await getSettings(message.provider);
    await requirePermission(settings.provider);
    return listProviderModels(settings, { includeExperimental: message.includeExperimental === true });
  }
  if (message.type === "TEST_PROVIDER") return generate(message, sender, true);
  if (message.type === "CANCEL_REWRITE") {
    const job = jobs.get(requestScope(sender));
    if (job && job.id === message.requestId) job.controller.abort();
    return {};
  }
  if (message.type === "GET_WIDGET_CONFIG") {
    const settings = await getSettings();
    const prefs = await chrome.storage.local.get(["autoEnabled", "autoApplyEnabled", "widgetEnabled", "widgetInstruction", "widgetPosition"]);
    const permitted = await chrome.permissions.contains({ origins: [getProvider(settings.provider).host] });
    return {
      configured: Boolean(settings.apiKey && settings.model && permitted),
      provider: settings.provider, model: settings.model || "", revision: settings.revision || "",
      autoEnabled: prefs.autoEnabled !== false, autoApplyEnabled: prefs.autoApplyEnabled === true,
      widgetEnabled: prefs.widgetEnabled !== false, widgetInstruction: prefs.widgetInstruction || "professional",
      widgetPosition: prefs.widgetPosition || null
    };
  }
  if (message.type === "SET_WIDGET_PREFS") {
    const updates = {};
    for (const name of ["autoEnabled", "autoApplyEnabled", "widgetEnabled"]) if (typeof message[name] === "boolean") updates[name] = message[name];
    if (["professional", "technical", "correct"].includes(message.widgetInstruction)) updates.widgetInstruction = message.widgetInstruction;
    if (message.widgetPosition && Number.isFinite(message.widgetPosition.x) && Number.isFinite(message.widgetPosition.y)) updates.widgetPosition = { x: message.widgetPosition.x, y: message.widgetPosition.y };
    await chrome.storage.local.set(updates);
    return {};
  }
  if (message.type === "AI_REWRITE") return generate(message, sender);
  throw new Error("Operação desconhecida.");
}
const ALLOWED = new Set([...PRIVILEGED, "GET_WIDGET_CONFIG", "SET_WIDGET_PREFS", "AI_REWRITE", "CANCEL_REWRITE"]);
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !ALLOWED.has(message.type)) return;
  if (sender.id !== chrome.runtime.id) { sendResponse({ ok: false, error: "Origem da solicitação inválida." }); return; }
  handleMessage(message, sender).then((result) => sendResponse({ ...result, ok: true }))
    .catch((error) => sendResponse({ ok: false, ...publicError(error) }));
  return true;
});
async function notifyWidgets() {
  try {
    const tabs = await chrome.tabs.query({});
    await Promise.allSettled(tabs.filter((tab) => tab.id != null).map((tab) => chrome.tabs.sendMessage(tab.id, { type: "WIDGET_CONFIG_CHANGED" })));
  } catch (_) {}
}
chrome.storage.onChanged.addListener((changes, area) => {
  const prefs = ["provider", "providerProfiles", "autoEnabled", "autoApplyEnabled", "widgetEnabled", "widgetInstruction"];
  if ((area === "local" && prefs.some((key) => Object.hasOwn(changes, key))) || (area === "session" && changes.activeProviderProfile)) notifyWidgets();
});
chrome.permissions.onAdded.addListener(notifyWidgets);
chrome.permissions.onRemoved.addListener(() => { cancelJobs(); notifyWidgets(); });


