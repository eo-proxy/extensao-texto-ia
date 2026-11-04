import { RevisionCache, revisionFingerprint } from "./revision-cache.mjs";
import { SITE_KEY_PREFIX, siteOrigin, getSitePreference, saveSitePreference } from "./site-preferences.mjs";
import { getProvider } from "./providers.mjs";
import { initializeStorage, getSettings, getSettingsForPage, selectProvider, saveProviderSettings, disableRemembering, removeProviderKey, markVerified } from "./settings.mjs";
import { listProviderModels, rewriteWithProvider, apiFailure, validateRewriteInput, reviewInstructions } from "./provider-api.mjs";

const ready = initializeStorage().then(() => true, () => false);
const PRIVILEGED = new Set(["GET_SITE_CONTEXT", "GET_SETTINGS", "SELECT_PROVIDER", "SAVE_PROVIDER_SETTINGS", "DISABLE_REMEMBERING", "REMOVE_PROVIDER_KEY", "LIST_PROVIDER_MODELS", "TEST_PROVIDER"]);
const jobs = new Map();
const revisionCache = new RevisionCache();
const blockedUntil = new Map();

function trustedPage(sender) {
  return sender.id === chrome.runtime.id && sender.url?.split(/[?#]/)[0] === chrome.runtime.getURL("sidepanel.html");
}
function contentSite(sender) {
  if (!Number.isInteger(sender.tab?.id) || (sender.frameId ?? 0) !== 0) throw new Error("Origem da página inválida.");
  const origin = siteOrigin(sender.url || sender.tab.url);
  if (sender.tab.url && siteOrigin(sender.tab.url) !== origin) throw new Error("Origem da página inválida.");
  return { origin, tabId: sender.tab.id };
}
async function currentSite(sender, expectedTab) {
  if (trustedPage(sender)) {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab || !Number.isInteger(tab.id)) throw new Error("Abra uma página comum para escolher a revisão por site.");
    if (expectedTab !== undefined && (!Number.isInteger(expectedTab) || tab.id !== expectedTab)) throw new Error("Volte à aba onde o texto foi lido para revisar.");
    return { origin: siteOrigin(tab.url), tabId: tab.id };
  }
  return contentSite(sender);
}
async function requireSiteEnabled(origin, revision) {
  const preference = await getSitePreference(origin);
  if (!preference.siteEnabled) throw apiFailure("Ative Usar IA neste site no robô ou em Revisar texto.", "SITE_BLOCKED");
  if (revision !== undefined && preference.siteRevision !== revision) throw apiFailure("A escolha para este site mudou. Gere outra sugestão.", "CANCELLED");
  return preference;
}
function cancelSiteJobs(origin) { revisionCache.clearOrigin(origin); for (const job of jobs.values()) if (job.siteOrigin === origin) job.controller.abort(); }
function requestScope(sender) { return String(sender.tab?.id ?? "popup") + ":" + String(sender.frameId ?? 0); }
function cancelJobs() { revisionCache.clear(); for (const job of jobs.values()) job.controller.abort(); jobs.clear(); }
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
    code: outcome.code || "OK", httpStatus: outcome.httpStatus || 200,
    ...(outcome.usage ? { usage: outcome.usage } : {})
  };
  await chrome.storage.session.set({ diagnostics });
}
async function assertCurrent(job, settings, site, siteRevision) {
  if (job.controller.signal.aborted || (await getSettings()).revision !== settings.revision) throw apiFailure("Revisão cancelada.", "CANCELLED");
  if (site) await requireSiteEnabled(site.origin, siteRevision);
  if (job.controller.signal.aborted) throw apiFailure("Revisão cancelada.", "CANCELLED");
}
function generate(message, sender, test = false) {
  const input = validateRewriteInput(test ? "Olá, este é um teste de conexão." : message.text, test ? "Corrija apenas a ortografia." : message.instruction);
  const key = requestScope(sender), id = message.requestId ?? "manual";
  if (typeof id !== "string" || !id || id.length > 128) throw new Error("Identificador de revisão inválido.");
  if (!trustedPage(sender)) contentSite(sender);
  const origin = test ? null : siteOrigin(trustedPage(sender) ? message.siteOrigin : sender.url || sender.tab?.url);
  const tabId = test ? null : trustedPage(sender) ? message.tabId : sender.tab?.id;
  if (!test && !Number.isInteger(tabId)) throw new Error("Abra a aba original para revisar.");
  const forceRefresh = test || message.forceRefresh === true;
  const existing = jobs.get(key);
  if (!forceRefresh && !test && existing && !existing.test && !existing.controller.signal.aborted && existing.siteOrigin === origin && existing.tabId === tabId && existing.text === input.text && existing.instruction === input.instruction && existing.forceRefresh === forceRefresh) {
    if (existing.ids.size >= 64 && !existing.ids.has(id)) throw new Error("Aguarde a revisão em andamento.");
    existing.ids.add(id);
    return existing.promise.then(result => ({ ...result, source: "inflight", usage: null, apiRequest: false }));
  }
  existing?.controller.abort();
  const job = { controller: new AbortController(), ids: new Set([id]), siteOrigin: origin, tabId, text: input.text, instruction: input.instruction, forceRefresh, test };
  jobs.set(key, job);
  job.promise = runGeneration(job, message, sender).finally(() => { if (jobs.get(key) === job) jobs.delete(key); });
  return job.promise;
}
async function runGeneration(job, message, sender) {
  let settings, site, preference;
  const startedAt = Date.now();
  try {
    site = job.test ? null : await currentSite(sender, message.tabId);
    if (site && (site.origin !== job.siteOrigin || site.tabId !== job.tabId)) throw apiFailure("A página mudou. Leia o campo novamente antes de revisar.", "SITE_BLOCKED");
    preference = site ? await requireSiteEnabled(site.origin) : null;
    settings = await getSettings(job.test ? message.provider : undefined);
    await requirePermission(settings.provider);
    await assertCurrent(job, settings, site, preference?.siteRevision);
    const scope = site ? JSON.stringify([site.tabId, sender.frameId ?? 0, site.origin]) : null;
    const fingerprint = site ? await revisionFingerprint([settings.provider, settings.model, settings.revision, settings.geminiSpeed, preference.siteRevision, reviewInstructions(job.instruction), job.text]) : null;
    await assertCurrent(job, settings, site, preference?.siteRevision);
    if (site && !job.forceRefresh) {
      const cached = revisionCache.get(scope, fingerprint);
      if (cached !== null) return { suggestion: cached, durationMs: Date.now() - startedAt, source: "memory", usage: null, apiRequest: false };
    }
    const block = blockedUntil.get(settings.revision);
    if (block?.until > Date.now()) throw apiFailure("A API pediu uma pausa. Aguarde " + Math.ceil((block.until - Date.now()) / 1000) + " s antes de tentar novamente.", block.code, block.status, block.until - Date.now());
    let usage = null;
    const suggestion = await rewriteWithProvider(settings, job.text, job.instruction, { signal: job.controller.signal, onUsage: value => { usage = value; } });
    await assertCurrent(job, settings, site, preference?.siteRevision);
    await diagnose(settings, startedAt, { code: "OK", httpStatus: 200, usage }).catch(() => {});
    if (job.test) {
      await markVerified(settings); await assertCurrent(job, settings, null);
      return { tested: true, durationMs: Date.now() - startedAt, usage, source: "api", apiRequest: true };
    }
    await assertCurrent(job, settings, site, preference.siteRevision);
    revisionCache.set(scope, fingerprint, suggestion, { tabId: site.tabId, origin: site.origin });
    return { suggestion, durationMs: Date.now() - startedAt, usage, source: "api", apiRequest: true };
  } catch (error) {
    if (settings && !["CANCELLED", "SITE_BLOCKED"].includes(error.code) && !job.controller.signal.aborted) {
      await diagnose(settings, startedAt, publicError(error)).catch(() => {});
      if (["AUTH", "PERMISSION"].includes(error.code)) revisionCache.clear();
      if (error.retryAfterMs > 0) blockedUntil.set(settings.revision, { until: Date.now() + error.retryAfterMs, code: error.code, status: error.httpStatus });
    }
    if (job.controller.signal.aborted) throw apiFailure("Revisão cancelada.", "CANCELLED");
    throw error;
  }
}
async function handleMessage(message, sender) {
  if (!await ready) throw new Error("Não foi possível preparar a extensão. Recarregue-a no navegador.");
  if (PRIVILEGED.has(message.type) && !trustedPage(sender)) throw new Error("Esta operação só pode ser feita nas configurações da extensão.");
  if (message.type === "AI_REWRITE") return generate(message, sender);
  if (!trustedPage(sender)) await currentSite(sender);
  if (message.type === "GET_SITE_CONTEXT") {
    const site = await currentSite(sender);
    return { ...(await getSitePreference(site.origin)), tabId: site.tabId };
  }
  if (message.type === "SET_SITE_PREFERENCE") {
    const site = await currentSite(sender, trustedPage(sender) ? message.tabId : undefined);
    const preference = await saveSitePreference(site.origin, message.enabled);
    cancelSiteJobs(site.origin);
    return { ...preference, tabId: site.tabId };
  }
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
    if (job && job.ids.has(message.requestId)) job.controller.abort();
    return {};
  }
  if (message.type === "GET_WIDGET_CONFIG") {
    const settings = await getSettings();
    const prefs = await chrome.storage.local.get(["autoEnabled", "autoApplyEnabled", "widgetEnabled", "widgetInstruction", "widgetPosition"]);
    const permitted = await chrome.permissions.contains({ origins: [getProvider(settings.provider).host] });
    return {
      ...(await getSitePreference((await currentSite(sender)).origin)),
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
  throw new Error("Operação desconhecida.");
}
const ALLOWED = new Set([...PRIVILEGED, "GET_WIDGET_CONFIG", "SET_WIDGET_PREFS", "SET_SITE_PREFERENCE", "AI_REWRITE", "CANCEL_REWRITE"]);
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
  const siteKeys = area === "local" ? Object.keys(changes).filter(key => key.startsWith(SITE_KEY_PREFIX)) : [];
  if (siteKeys.length) { for (const key of siteKeys) revisionCache.clearOrigin(key.slice(SITE_KEY_PREFIX.length)); for (const job of jobs.values()) if (siteKeys.includes(SITE_KEY_PREFIX + job.siteOrigin)) job.controller.abort(); notifyWidgets(); }
  const prefs = ["provider", "providerProfiles", "autoEnabled", "autoApplyEnabled", "widgetEnabled", "widgetInstruction"];
  if ((area === "local" && prefs.some((key) => Object.hasOwn(changes, key))) || (area === "session" && changes.activeProviderProfile)) { revisionCache.clear(); notifyWidgets(); }
});
chrome.permissions.onAdded.addListener(notifyWidgets);
chrome.permissions.onRemoved.addListener(() => { cancelJobs(); notifyWidgets(); });

function forgetTab(tabId) { revisionCache.clearTab(tabId); for (const job of jobs.values()) if (job.tabId === tabId) job.controller.abort(); }
chrome.tabs.onRemoved?.addListener(forgetTab);
chrome.tabs.onUpdated?.addListener((tabId, changes) => { if (changes.status === "loading" || changes.url) forgetTab(tabId); });
