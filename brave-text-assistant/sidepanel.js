import { PROVIDERS, getProvider, normalizeModel, validateKey } from "./providers.mjs";

const $ = (id) => document.getElementById(id);
let snapshot = null, sourceText = "", sourceTabId = null;
let selectedProvider = "openai", profiles = {}, diagnostics = {}, modelCatalog = [];
let settingsBusy = false, permissionGranted = false, renderVersion = 0;

function setStatus(message = "", error = false) { $("status").textContent = message; $("status").classList.toggle("error", error); }
function setSettingsStatus(message = "", error = false) { $("settingsStatus").textContent = message; $("settingsStatus").classList.toggle("error", error); }
async function send(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || "A extensão não respondeu. Recarregue-a no Brave.");
  return response;
}
function showView(settings) {
  $("settings").classList.toggle("hidden", !settings);
  $("reviewView").classList.toggle("hidden", settings);
  $("settingsToggle").setAttribute("aria-selected", String(settings));
  $("reviewTab").setAttribute("aria-selected", String(!settings));
  $("settingsToggle").classList.toggle("active", settings);
  $("reviewTab").classList.toggle("active", !settings);
  window.scrollTo?.({ top: 0, behavior: "instant" });
}
function openSettings() { showView(true); }
function currentValues() {
  return {
    apiKey: $("apiKey").value.trim(), model: $("model").value.trim(),
    rememberCredentials: $("rememberCredentials").checked,
    geminiSpeed: $("geminiSpeed").value || "fast"
  };
}
function updateButtons() {
  const values = currentValues();
  const profile = profiles[selectedProvider];
  $("authorizeProvider").hidden = permissionGranted;
  $("authorizeProvider").disabled = settingsBusy || !profile?.apiKey || profile.apiKey !== values.apiKey;
  $("loadModels").disabled = settingsBusy || !permissionGranted || !values.apiKey;
  $("testProvider").disabled = settingsBusy || !permissionGranted || !values.apiKey || !values.model;
  for (const id of ["provider", "apiKey", "model", "modelChoice", "saveSettings", "forgetKey", "rememberCredentials", "geminiSpeed", "includeExperimental"]) $(id).disabled = settingsBusy;
  $("permissionHint").textContent = permissionGranted
    ? "O Brave já permite o acesso a esta API."
    : "Clique em Usar esta IA para preparar a conexão. Depois autorize o acesso no Brave.";
}
function setBusy(value) { settingsBusy = value; updateButtons(); }
function renderModelCatalog() {
  const select = $("modelChoice");
  select.replaceChildren();
  const blank = document.createElement("option");
  blank.value = ""; blank.textContent = "Escolha um modelo da sua conta";
  select.append(blank);
  for (const model of modelCatalog) {
    const option = document.createElement("option");
    option.value = model.id;
    const fast = /flash-lite|haiku|nano|mini|flash/.test(model.id);
    option.textContent = (model.label === model.id ? model.id : model.label + " — " + model.id) + (fast ? " · rápido" : "");
    select.append(option);
  }
  select.value = $("model").value.trim();
  $("modelChoiceWrap").classList.toggle("hidden", !modelCatalog.length);
}
function renderDiagnostic() {
  const diagnostic = diagnostics[selectedProvider];
  $("lastDiagnostic").textContent = diagnostic
    ? "Última chamada: " + (diagnostic.code === "OK" ? "sucesso" : diagnostic.code) +
      " · " + (diagnostic.durationMs / 1000).toFixed(1) + " s" +
      (diagnostic.httpStatus ? " · HTTP " + diagnostic.httpStatus : "") + " · " + diagnostic.model
    : "O teste envia apenas uma frase de exemplo. Nenhum texto ou chave entra no diagnóstico.";
}
async function refreshSummary() {
  const profile = profiles[selectedProvider];
  const info = getProvider(selectedProvider);
  const configured = Boolean(profile?.apiKey && profile?.model && permissionGranted);
  $("setupNotice").classList.toggle("hidden", configured);
  const label = !profile?.apiKey ? "Conecte sua IA" : !permissionGranted ? "Falta autorizar" : !profile.model ? "Escolha um modelo" : profile.verifiedAt ? "Modelo testado" : "Pronto para revisar";
  $("connectionState").textContent = label;
  $("connectionState").classList.toggle("ready", configured);
  $("providerLabel").textContent = info.name + (profile?.apiKey ? profile.rememberCredentials ? " · chave lembrada" : " · nesta sessão" : "");
  renderDiagnostic();
}
async function renderProvider() {
  const version = ++renderVersion;
  const info = getProvider(selectedProvider), profile = profiles[selectedProvider] || {};
  $("provider").value = selectedProvider;
  $("providerGuideTitle").textContent = "Como conectar " + info.name;
  $("providerSteps").replaceChildren();
  for (const step of info.steps) { const li = document.createElement("li"); li.textContent = step; $("providerSteps").append(li); }
  $("providerNote").textContent = info.note;
  $("getKeyLink").href = info.keyUrl; $("getKeyLink").textContent = info.keyLink;
  $("providerDocsLink").href = info.docsUrl;
  $("apiKeyLabel").textContent = info.keyLabel; $("apiKey").placeholder = info.keyPlaceholder;
  $("apiKey").value = profile.apiKey || ""; $("apiKey").type = "password";
  $("showKey").textContent = "Mostrar"; $("showKey").setAttribute("aria-pressed", "false");
  $("model").placeholder = info.modelPlaceholder; $("model").value = profile.model || "";
  $("rememberCredentials").checked = profile.rememberCredentials === true;
  $("geminiSpeed").value = profile.geminiSpeed || "fast";
  $("geminiOptions").classList.toggle("hidden", selectedProvider !== "gemini");
  $("modelHelp").textContent = info.modelNote;
  $("includeExperimental").checked = false;
  modelCatalog = []; renderModelCatalog(); permissionGranted = false; updateButtons();
  const granted = await chrome.permissions.contains({ origins: [info.host] });
  if (version === renderVersion) { permissionGranted = granted; updateButtons(); await refreshSummary(); }
}
async function loadSettings(initial = false) {
  const stored = await send({ type: "GET_SETTINGS" });
  profiles = stored.profiles || {}; diagnostics = stored.diagnostics || {};
  selectedProvider = Object.hasOwn(PROVIDERS, stored.provider) ? stored.provider : "openai";
  $("widgetEnabled").checked = stored.widgetEnabled;
  $("autoEnabled").checked = stored.autoEnabled !== false;
  $("autoApplyEnabled").checked = stored.autoApplyEnabled === true;
  await renderProvider();
  if (initial && !profiles[selectedProvider]?.apiKey) openSettings();
}
async function useCurrent() {
  const values = currentValues();
  values.apiKey = validateKey(values.apiKey);
  values.model = normalizeModel(selectedProvider, values.model);
  const result = await send({ type: "SAVE_PROVIDER_SETTINGS", provider: selectedProvider, ...values });
  profiles[selectedProvider] = result.profile || { ...values };
  $("model").value = values.model;
  await refreshSummary();
}
$("provider").addEventListener("change", async () => {
  const target = $("provider").value;
  $("apiKey").value = ""; $("model").value = ""; modelCatalog = [];
  setBusy(true); setSettingsStatus("");
  try {
    const response = await send({ type: "SELECT_PROVIDER", provider: target });
    selectedProvider = response.provider; profiles = response.profiles || {}; diagnostics = response.diagnostics || {};
    await renderProvider();
  } catch (error) { setSettingsStatus(error.message, true); }
  finally { setBusy(false); }
});
for (const id of ["apiKey", "model"]) $(id).addEventListener("input", () => {
  if (id === "apiKey") { modelCatalog = []; renderModelCatalog(); }
  setSettingsStatus(""); updateButtons();
});
$("rememberCredentials").addEventListener("change", async () => {
  if ($("rememberCredentials").checked) { setSettingsStatus("A chave será lembrada depois de clicar em Usar esta IA."); return; }
  if (!profiles[selectedProvider]?.rememberCredentials) return;
  setBusy(true);
  try {
    await send({ type: "DISABLE_REMEMBERING", provider: selectedProvider });
    profiles[selectedProvider].rememberCredentials = false;
    await refreshSummary();
    setSettingsStatus("Chave removida do armazenamento permanente. Ela funciona só nesta sessão.");
  } catch (error) { setSettingsStatus(error.message, true); }
  finally { setBusy(false); }
});
$("modelChoice").addEventListener("change", () => {
  if ($("modelChoice").value) $("model").value = $("modelChoice").value;
  setSettingsStatus("Modelo escolhido. Clique em Usar esta IA ou Testar modelo."); updateButtons();
});
$("showKey").addEventListener("click", () => {
  const visible = $("apiKey").type === "password";
  $("apiKey").type = visible ? "text" : "password"; $("showKey").textContent = visible ? "Ocultar" : "Mostrar";
  $("showKey").setAttribute("aria-pressed", String(visible));
});
$("settingsToggle").addEventListener("click", openSettings);
$("setupButton").addEventListener("click", openSettings);
$("closeSettings").addEventListener("click", () => showView(false));
$("reviewTab").addEventListener("click", () => showView(false));
for (const name of ["widgetEnabled", "autoEnabled", "autoApplyEnabled"]) $(name).addEventListener("change", async () => {
  try { await send({ type: "SET_WIDGET_PREFS", [name]: $(name).checked }); setStatus("Preferência atualizada."); }
  catch (error) { setStatus(error.message, true); }
});
$("saveSettings").addEventListener("click", async () => {
  setBusy(true);
  try {
    await useCurrent();
    setSettingsStatus(!permissionGranted ? "Conexão preparada. Autorize o acesso no botão abaixo."
      : !$("model").value ? "Chave pronta para uso. Consulte e escolha um modelo."
      : $("rememberCredentials").checked ? "Configuração ativada e lembrada neste dispositivo."
      : "Configuração ativada apenas nesta sessão. Ao trocar de IA, estes dados serão descartados.");
  } catch (error) { setSettingsStatus(error.message, true); }
  finally { setBusy(false); }
});
$("authorizeProvider").addEventListener("click", () => {
  const promise = chrome.permissions.request({ origins: [getProvider(selectedProvider).host] });
  setBusy(true);
  promise.then(async (granted) => {
    permissionGranted = granted; await refreshSummary();
    setSettingsStatus(granted ? "Autorizado. Agora consulte os modelos ou teste o escolhido." : "Acesso negado. Você pode autorizar depois.", !granted);
  }).catch(() => setSettingsStatus("Não foi possível pedir a permissão. Reabra a extensão.", true)).finally(() => setBusy(false));
});
$("loadModels").addEventListener("click", async () => {
  setBusy(true); setSettingsStatus("Consultando modelos de texto na API da sua conta…");
  try {
    await useCurrent();
    const response = await send({ type: "LIST_PROVIDER_MODELS", provider: selectedProvider, includeExperimental: $("includeExperimental").checked });
    modelCatalog = response.models; renderModelCatalog();
    setSettingsStatus(response.models.length + " modelos de texto encontrados. Selecione um abaixo e teste.");
  } catch (error) { setSettingsStatus(error.message, true); }
  finally { setBusy(false); }
});
$("testProvider").addEventListener("click", async () => {
  setBusy(true); setSettingsStatus("Testando o modelo com uma frase de exemplo…");
  try {
    await useCurrent();
    const response = await send({ type: "TEST_PROVIDER", provider: selectedProvider });
    profiles[selectedProvider].verifiedAt = Date.now();
    const latest = await send({ type: "GET_SETTINGS" }); diagnostics = latest.diagnostics || {};
    await refreshSummary();
    setSettingsStatus("Modelo respondeu em " + (response.durationMs / 1000).toFixed(1) + " s. Conexão pronta.");
  } catch (error) {
    try { const latest = await send({ type: "GET_SETTINGS" }); diagnostics = latest.diagnostics || {}; renderDiagnostic(); } catch (_) {}
    setSettingsStatus(error.message, true);
  } finally { setBusy(false); }
});
$("forgetKey").addEventListener("click", async () => {
  setBusy(true);
  try {
    await send({ type: "REMOVE_PROVIDER_KEY", provider: selectedProvider });
    delete profiles[selectedProvider]; await renderProvider();
    setSettingsStatus("Chave e conexão deste provedor removidas.");
  } catch (error) { setSettingsStatus(error.message, true); }
  finally { setBusy(false); }
});

async function sendToActiveTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) throw new Error("Não encontrei uma aba ativa.");
  if (message.type === "APPLY_TEXT" && tab.id !== sourceTabId) throw new Error("Volte à aba onde o texto foi lido para aplicar a sugestão.");
  try { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js", "widget.js"] }); }
  catch (_) { throw new Error("Esta página não permite a leitura do texto. Experimente em um site comum."); }
  let response;
  try { response = await chrome.tabs.sendMessage(tab.id, message); }
  catch (_) { throw new Error("Não consegui comunicar com o campo de texto desta página."); }
  if (!response?.ok) throw new Error(response?.error || "Não consegui ler o campo de texto.");
  return { ...response, tabId: tab.id };
}

$("readButton").addEventListener("click", async () => {
  try {
    const response = await sendToActiveTab({ type: "READ_ACTIVE_TEXT" });
    sourceTabId = response.tabId;
    snapshot = { selectedOnly: response.selectedOnly, start: response.start, end: response.end, originalText: response.text || "" };
    sourceText = response.text || "";
    if (!sourceText.trim()) return setStatus("O campo está vazio. Digite ou selecione um trecho primeiro.", true);
    $("sourceText").textContent = sourceText;
    $("sourceWrap").classList.remove("hidden");
    $("rewriteButton").classList.remove("hidden");
    $("suggestionWrap").classList.add("hidden");
    setStatus(response.selectedOnly ? "Trecho selecionado carregado." : "Texto do campo carregado.");
  } catch (error) { setStatus(error.message, true); }
});

$("rewriteButton").addEventListener("click", async () => {
  const provider = selectedProvider;
  const apiKey = profiles[provider]?.apiKey;
  if (!apiKey) { openSettings(); return setSettingsStatus("Configure seu provedor antes de gerar a sugestão.", true); }
  const button = $("rewriteButton");
  button.disabled = true;
  button.textContent = "Gerando…";
  setStatus(`Enviando texto para ${getProvider(provider).name}…`);
  try {
    const response = await chrome.runtime.sendMessage({
      type: "AI_REWRITE",
      instruction: $("instruction").value.trim(),
      text: sourceText
    });
    if (!response?.ok) throw new Error(response?.error || "Falha ao gerar a sugestão.");
    $("suggestion").value = response.suggestion;
    $("suggestionWrap").classList.remove("hidden");
    setStatus("Sugestão pronta. Edite se quiser e aplique quando estiver satisfeito.");
  } catch (error) { setStatus(error.message, true); }
  finally { button.disabled = false; button.textContent = "Gerar sugestão"; }
});

$("applyButton").addEventListener("click", async () => {
  try {
    await sendToActiveTab({ type: "APPLY_TEXT", text: $("suggestion").value, snapshot });
    $("suggestionWrap").classList.add("hidden");
    setStatus("Texto aplicado ao campo original.");
  } catch (error) { setStatus(error.message, true); }
});

$("discardButton").addEventListener("click", () => {
  $("suggestion").value = "";
  $("suggestionWrap").classList.add("hidden");
  setStatus("Sugestão descartada; o campo original não foi alterado.");
});

$("clearButton").addEventListener("click", () => {
  snapshot = null; sourceText = ""; sourceTabId = null;
  $("sourceText").textContent = "";
  $("sourceWrap").classList.add("hidden");
  $("rewriteButton").classList.add("hidden");
  $("suggestionWrap").classList.add("hidden");
  setStatus("");
});

document.querySelectorAll(".chip").forEach((chip) => chip.addEventListener("click", () => {
  document.querySelectorAll(".chip").forEach((item) => item.classList.remove("active"));
  chip.classList.add("active");
  $("instruction").value = chip.dataset.instruction;
}));

loadSettings(true).catch((error) => setSettingsStatus(error.message || "Não consegui carregar a configuração.", true));


