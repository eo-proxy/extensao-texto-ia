import { PROVIDERS, getProvider, normalizeModel, validateKey } from "./providers.mjs";

const $ = (id) => document.getElementById(id);
let snapshot = null;
let sourceText = "";
let sourceTabId = null;
let selectedProvider = "openai";
let activeProvider = "openai";
let profiles = {};
const drafts = {};
const modelCatalogs = {};
let settingsBusy = false;
let permissionGranted = false;
let renderVersion = 0;

const settingsPanel = $("settings");
const status = $("status");
const settingsStatus = $("settingsStatus");

function setStatus(message = "", isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
}
function setSettingsStatus(message = "", isError = false) {
  settingsStatus.textContent = message;
  settingsStatus.classList.toggle("error", isError);
}
function openSettings() {
  settingsPanel.classList.remove("hidden");
  requestAnimationFrame(() => {
    settingsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    $("provider").focus({ preventScroll: true });
  });
}
function providerName(id) { return getProvider(id).name; }
async function send(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || "A extensão não respondeu. Recarregue-a no Brave.");
  return response;
}
function currentDraft() {
  return { apiKey: $("apiKey").value.trim(), model: $("model").value.trim() };
}
function rememberDraft() { drafts[selectedProvider] = currentDraft(); }
function updateSettingsButtons() {
  const values = currentDraft();
  const saved = profiles[selectedProvider];
  const savedKey = Boolean(saved?.apiKey && saved.apiKey === values.apiKey);
  $("authorizeProvider").hidden = permissionGranted;
  $("authorizeProvider").disabled = settingsBusy || !savedKey;
  $("loadModels").disabled = settingsBusy || !permissionGranted || !values.apiKey;
  $("testProvider").disabled = settingsBusy || !permissionGranted || !values.apiKey || !values.model;
  for (const id of ["provider", "apiKey", "model", "modelChoice", "saveSettings", "forgetKey"]) $(id).disabled = settingsBusy;
  $("permissionHint").textContent = permissionGranted
    ? "Acesso a este provedor autorizado no Brave."
    : "Salve a chave primeiro e depois clique em Autorizar acesso. O aviso do Brave pode fechar esta janela; os dados salvos continuam aqui.";
}
function setBusy(value) { settingsBusy = value; updateSettingsButtons(); }

function renderModelCatalog() {
  const select = $("modelChoice");
  select.replaceChildren();
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "Escolha um modelo ou informe o ID abaixo";
  select.append(blank);
  const catalog = modelCatalogs[selectedProvider];
  const models = catalog?.key === $("apiKey").value.trim() ? catalog.models : [];
  for (const model of models || []) {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = model.label === model.id ? model.id : model.label + " — " + model.id;
    select.append(option);
  }
  select.value = $("model").value.trim();
  $("modelChoiceWrap").classList.toggle("hidden", !models?.length);
}

async function renderProvider() {
  const version = ++renderVersion;
  const info = getProvider(selectedProvider);
  const values = drafts[selectedProvider] || profiles[selectedProvider] || {};
  $("provider").value = selectedProvider;
  $("providerGuideTitle").textContent = "Configurar " + info.name;
  $("providerSteps").replaceChildren();
  for (const step of info.steps) {
    const li = document.createElement("li");
    li.textContent = step;
    $("providerSteps").append(li);
  }
  $("providerNote").textContent = info.note;
  $("getKeyLink").href = info.keyUrl;
  $("getKeyLink").textContent = info.keyLink;
  $("providerDocsLink").href = info.docsUrl;
  $("apiKeyLabel").textContent = info.keyLabel;
  $("apiKey").placeholder = info.keyPlaceholder;
  $("apiKey").value = values.apiKey || "";
  $("model").placeholder = info.modelPlaceholder;
  $("model").value = values.model || "";
  $("modelHelp").textContent = info.modelNote;
  $("forgetKey").textContent = "Apagar chave de " + info.name;
  $("apiKey").type = "password";
  $("showKey").textContent = "Mostrar";
  $("showKey").setAttribute("aria-pressed", "false");
  renderModelCatalog();
  permissionGranted = false;
  updateSettingsButtons();
  const granted = await chrome.permissions.contains({ origins: [info.host] });
  if (version === renderVersion) { permissionGranted = granted; updateSettingsButtons(); }
}

async function refreshSummary() {
  const info = getProvider(activeProvider);
  const profile = profiles[activeProvider];
  const permitted = await chrome.permissions.contains({ origins: [info.host] });
  const configured = Boolean(profile?.apiKey && profile?.model && permitted);
  $("setupNotice").classList.toggle("hidden", configured);
  $("providerLabel").textContent = !profile?.apiKey ? "Nenhum provedor configurado"
    : !permitted ? info.name + " · falta autorizar"
    : !profile.model ? info.name + " · escolha o modelo"
    : info.name + (profile.verifiedAt ? " · conexão testada" : " · não testado");
  $("setupTitle").textContent = !profile?.apiKey ? "Configure sua IA para começar"
    : !permitted ? "Autorize o acesso à sua IA" : "Escolha o modelo da sua IA";
  $("setupDescription").textContent = !profile?.apiKey
    ? "Cada pessoa configura a própria chave. Selecione o provedor para ver as instruções."
    : "Os dados já estão salvos. Abra as configurações para concluir a etapa indicada.";
  $("setupButton").textContent = "Abrir configuração";
}

async function loadSettings(initial = false) {
  const stored = await send({ type: "GET_SETTINGS" });
  profiles = stored.profiles;
  activeProvider = Object.hasOwn(PROVIDERS, stored.provider) ? stored.provider : "openai";
  if (initial) selectedProvider = activeProvider;
  $("widgetEnabled").checked = stored.widgetEnabled;
  await renderProvider();
  await refreshSummary();
  if (initial && !profiles[activeProvider]?.apiKey) openSettings();
}

async function persistCurrent() {
  const info = getProvider(selectedProvider);
  const apiKey = validateKey($("apiKey").value);
  const model = normalizeModel(selectedProvider, $("model").value);
  await send({ type: "SAVE_PROVIDER_SETTINGS", provider: selectedProvider, apiKey, model });
  const previous = profiles[selectedProvider];
  profiles[selectedProvider] = { apiKey, model, verifiedAt: previous?.apiKey === apiKey && previous?.model === model ? previous.verifiedAt : null };
  $("model").value = model;
  drafts[selectedProvider] = { apiKey, model };
  activeProvider = selectedProvider;
  await refreshSummary();
  return info;
}

$("provider").addEventListener("change", async () => {
  rememberDraft();
  selectedProvider = $("provider").value;
  setSettingsStatus("");
  try { await renderProvider(); }
  catch (_) { setSettingsStatus("Não consegui consultar as permissões. Reabra a extensão.", true); }
});
for (const id of ["apiKey", "model"]) {
  $(id).addEventListener("input", () => { rememberDraft(); setSettingsStatus(""); renderModelCatalog(); updateSettingsButtons(); });
}
$("modelChoice").addEventListener("change", () => {
  if ($("modelChoice").value) $("model").value = $("modelChoice").value;
  rememberDraft();
  setSettingsStatus("Clique em Salvar ou Testar conexão para usar este modelo.");
  updateSettingsButtons();
});
$("showKey").addEventListener("click", () => {
  const visible = $("apiKey").type === "password";
  $("apiKey").type = visible ? "text" : "password";
  $("showKey").textContent = visible ? "Ocultar" : "Mostrar";
  $("showKey").setAttribute("aria-pressed", String(visible));
});
$("settingsToggle").addEventListener("click", () => {
  if (settingsPanel.classList.contains("hidden")) openSettings();
  else settingsPanel.classList.add("hidden");
});
$("setupButton").addEventListener("click", openSettings);
$("closeSettings").addEventListener("click", () => settingsPanel.classList.add("hidden"));

$("widgetEnabled").addEventListener("change", async () => {
  try {
    await send({ type: "SET_WIDGET_PREFS", widgetEnabled: $("widgetEnabled").checked });
    setStatus($("widgetEnabled").checked ? "Botão flutuante ativado." : "Botão flutuante oculto.");
  } catch (error) { setStatus(error.message, true); }
});
$("saveSettings").addEventListener("click", async () => {
  setBusy(true);
  try {
    await persistCurrent();
    setSettingsStatus(!permissionGranted ? "Dados salvos. Clique em Autorizar acesso para continuar."
      : !$("model").value ? "Chave salva. Consulte os modelos e escolha um para continuar."
      : "Configuração salva. Use Testar conexão para confirmar que este modelo responde.");
  } catch (error) { setSettingsStatus(error.message, true); }
  finally { setBusy(false); }
});
$("authorizeProvider").addEventListener("click", () => {
  // Solicite a permissão no próprio gesto, com os dados já salvos.
  const permission = chrome.permissions.request({ origins: [getProvider(selectedProvider).host] });
  setBusy(true);
  permission.then(async (granted) => {
    permissionGranted = granted;
    await refreshSummary();
    setSettingsStatus(granted ? "Acesso autorizado. Consulte os modelos ou teste a conexão."
      : "Acesso negado. Sua chave continua salva; você pode autorizar depois.", !granted);
  }).catch(() => setSettingsStatus("Não consegui pedir a permissão. Sua chave continua salva.", true))
    .finally(() => setBusy(false));
});
$("loadModels").addEventListener("click", async () => {
  setBusy(true);
  setSettingsStatus("Consultando os modelos na sua conta…");
  try {
    await persistCurrent();
    const response = await send({ type: "LIST_PROVIDER_MODELS", provider: selectedProvider });
    modelCatalogs[selectedProvider] = { key: $("apiKey").value.trim(), models: response.models };
    renderModelCatalog();
    setSettingsStatus(response.models.length + " modelos encontrados" + (response.partial ? " (lista parcial)" : "") + ". Escolha um e clique em Testar conexão.");
  } catch (error) { setSettingsStatus(error.message, true); }
  finally { setBusy(false); }
});
$("testProvider").addEventListener("click", async () => {
  setBusy(true);
  setSettingsStatus("Testando a geração com um texto de exemplo…");
  try {
    await persistCurrent();
    await send({ type: "TEST_PROVIDER", provider: selectedProvider });
    profiles[selectedProvider].verifiedAt = Date.now();
    await refreshSummary();
    setSettingsStatus("Conexão testada: " + providerName(selectedProvider) + " respondeu com o modelo " + $("model").value + ".");
  } catch (error) { setSettingsStatus(error.message, true); }
  finally { setBusy(false); }
});
$("forgetKey").addEventListener("click", async () => {
  setBusy(true);
  try {
    await send({ type: "REMOVE_PROVIDER_KEY", provider: selectedProvider });
    delete drafts[selectedProvider];
    delete modelCatalogs[selectedProvider];
    delete profiles[selectedProvider];
    await renderProvider();
    await refreshSummary();
    setSettingsStatus("Chave deste provedor apagada. Os outros provedores foram preservados.");
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
  const provider = activeProvider;
  const apiKey = profiles[provider]?.apiKey;
  if (!apiKey) { openSettings(); return setSettingsStatus("Configure seu provedor antes de gerar a sugestão.", true); }
  const button = $("rewriteButton");
  button.disabled = true;
  button.textContent = "Gerando…";
  setStatus(`Enviando texto para ${providerName(provider)}…`);
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

