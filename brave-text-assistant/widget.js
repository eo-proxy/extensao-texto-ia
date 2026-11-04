(() => {
  if (window.__braveTextAssistantWidgetInstalled) return;
  const editor = window.__braveTextAssistantApi;
  if (!editor || !document.documentElement) return;
  window.__braveTextAssistantWidgetInstalled = true;

  const MIN_AUTO_LENGTH = 1;
  const MAX_LENGTH = 4000;
  const IDLE_MS = 2500;

  const INSTRUCTIONS = {
    professional: "Torne o texto mais claro e profissional, sem mudar o significado.",
    technical: "Reescreva o texto em linguagem mais técnica e precisa, sem inventar informações.",
    correct: "Corrija gramática, ortografia e pontuação, preservando o estilo original."
  };

  const host = document.createElement("div");
  host.id = "brave-text-assistant-widget";
  host.style.left = `${Math.max(8, window.innerWidth - 56)}px`;
  host.style.top = `${Math.max(8, window.innerHeight - 56)}px`;
  host.style.display = "none";
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: "closed" });
  const logoUrl = chrome.runtime.getURL("assets/texto-ia-logo.svg");
  const iconUrl = chrome.runtime.getURL("assets/icon-128.png");
  shadow.innerHTML = `
    <style>
      :host { all: initial; position: fixed !important; z-index: 2147483647 !important; display: block; width: 40px; height: 40px; font-family: Arial, sans-serif; color: #edf5ff; }
      :host(.expanded) { width: min(350px, calc(100vw - 16px)); height: auto; }
      * { box-sizing: border-box; }
      button, select, textarea, input { font: inherit; }
      .bubble { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; padding: 0; border: 0; border-radius: 10px; background: transparent; box-shadow: 0 6px 18px rgba(0, 0, 0, .3); cursor: grab; user-select: none; }
      .bubble.busy { outline: 2px solid #72baff; outline-offset: 3px; }
      .bubble img { display: block; width: 40px; height: 40px; object-fit: contain; pointer-events: none; }
      .site-prompt { position: absolute; bottom: 50px; left: 0; width: min(258px, calc(100vw - 16px)); padding: 13px; border: 1px solid #4977ab; border-radius: 13px; background: #142843; color: #eaf3ff; box-shadow: 0 8px 26px #0006; font-size: 12px; line-height: 1.5; }
      .site-prompt p { margin: 0; }
      .site-prompt::after { content: ""; position: absolute; bottom: -6px; left: var(--pointer, 20px); width: 10px; height: 10px; background: #142843; border-right: 1px solid #4977ab; border-bottom: 1px solid #4977ab; transform: rotate(45deg); }
      .site-prompt.below::after { bottom: auto; top: -6px; border: 0; border-left: 1px solid #4977ab; border-top: 1px solid #4977ab; }
      .site-control { margin-bottom: 12px; padding: 10px; border: 1px solid #345779; border-radius: 9px; background: #13283f; }
      .site-control label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 700; }
      .site-control input { accent-color: #4e9df7; }
      .site-label { display: block; margin: 5px 0 0 22px; color: #9ebbdc; font-size: 10px; overflow-wrap: anywhere; }
      .bubble.paused { opacity: .75; }
      .panel { width: 100%; max-height: min(500px, calc(100vh - 16px)); overflow-y: auto; border: 1px solid #385477; border-radius: 16px; background: #101e32; box-shadow: 0 12px 38px rgba(0, 0, 0, .4); font-size: 12px; }
      .header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 12px; border-bottom: 1px solid #2a4262; background: #142843; cursor: grab; user-select: none; }
      .header img { display: block; width: 124px; height: 38px; object-fit: contain; pointer-events: none; }
      .header button { border: 0; background: transparent; font-size: 20px; color: #c5dcfa; cursor: pointer; }
      .body { padding: 13px; }
      .row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
      .row label { display: inline-flex; align-items: center; gap: 7px; cursor: pointer; }
      .row input { accent-color: #4e9df7; }
      .row select { max-width: 162px; padding: 6px; border: 1px solid #395779; border-radius: 8px; background: #192c47; color: #e8f3ff; font-size: 11px; }
      .status { margin: 0 0 11px; color: #b2c9e4; line-height: 1.45; }
      .status.error { color: #ff9d9d; }
      .suggestion-label { display: block; margin-bottom: 7px; font-weight: 700; }
      textarea { display: block; width: 100%; min-height: 110px; max-height: 220px; padding: 9px; resize: vertical; border: 1px solid #3a5677; border-radius: 9px; background: #0c1a2c; color: #edf5ff; line-height: 1.5; }
      .actions { display: flex; gap: 7px; margin-top: 10px; }
      .actions button { flex: 1; padding: 9px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer; }
      .primary { border: 1px solid #4e9df7; background: #2879df; color: white; }
      .secondary { border: 1px solid #3b5574; background: #1a2e49; color: #e4f0ff; }
      button:disabled { opacity: .55; cursor: wait; }
      .hint { margin: 10px 0 0; color: #8fa9c8; font-size: 10px; line-height: 1.4; }
      .hide-widget { display: block; margin: 8px 0 0; padding: 3px 0; border: 0; background: transparent; color: #9cc7fb; font-size: 10px; cursor: pointer; }
      .creator { margin: 10px 0 0; padding-top: 9px; border-top: 1px solid #2a4262; color: #a7c3e4; font-size: 10px; text-align: right; }
      [hidden] { display: none !important; }
    </style>
    <button class="bubble" type="button" title="Abrir Texto IA. Arraste para mover." aria-label="Abrir Texto IA"><img src="${iconUrl}" alt="Robô com lupa do Texto IA"></button>
    <div class="site-prompt" hidden role="group" aria-label="Revisão neste site"><p>Quer usar a revisão de texto neste site?</p><div class="actions"><button class="site-yes primary" type="button">Sim, ativar</button><button class="site-no secondary" type="button">Não</button></div></div>
    <section class="panel" hidden aria-label="Assistente de texto">
      <div class="header"><img src="${logoUrl}" alt="Texto IA, por GHS Studio"><button class="minimize" type="button" title="Recolher" aria-label="Recolher">−</button></div>
      <div class="body">
        <div class="site-control"><label><input class="site-enabled" type="checkbox"> Usar IA neste site</label><span class="site-label"></span></div>
        <div class="row">
          <label><input class="auto" type="checkbox" checked> Revisar ao parar de digitar</label>
          <select class="instruction" aria-label="Estilo da revisão">
            <option value="professional">Profissional</option>
            <option value="technical">Técnico</option>
            <option value="correct">Corrigir</option>
          </select>
        </div>
        <div class="row"><label><input class="auto-apply" type="checkbox"> Aplicar sem confirmação</label></div>
        <p class="hint">Se ativado, o texto revisado substitui o original assim que a IA responder, sem pedir confirmação.</p>
        <p class="status" role="status" aria-live="polite">Digite em um campo de texto para começar.</p>
        <div class="suggestion-wrap" hidden>
          <label class="suggestion-label" for="assistant-suggestion">Sugestão editável</label>
          <textarea id="assistant-suggestion" class="suggestion"></textarea>
          <div class="actions"><button class="apply primary" type="button">Aplicar</button><button class="discard secondary" type="button">Descartar</button></div>
        </div>
        <div class="actions"><button class="generate secondary" type="button">Revisar agora</button></div>
        <div class="actions undo-actions" hidden><button class="undo secondary" type="button">↶ Desfazer sugestão</button></div>
        <p class="hint">Digite para recolher. Após 2,5 s de pausa, uma nova revisão começa.</p>
        <button class="hide-widget" type="button">Ocultar botão · reative pelo ícone da extensão</button>
        <p class="creator">Criado por GHS Studio</p>
      </div>
    </section>`;

  const $ = (selector) => shadow.querySelector(selector);
  const bubble = $(".bubble");
  const panel = $(".panel");
  const status = $(".status");
  const suggestionWrap = $(".suggestion-wrap");
  const suggestionInput = $(".suggestion");
  const generateButton = $(".generate");
  const undoActions = $(".undo-actions");
  const sitePrompt = $(".site-prompt"), siteInput = $(".site-enabled"), siteLabel = $(".site-label");
  const siteYes = $(".site-yes"), siteNo = $(".site-no");
  const autoInput = $(".auto");
  const autoApplyInput = $(".auto-apply");
  const instructionSelect = $(".instruction");

  let configured = false, autoEnabled = true, autoApplyEnabled = false, widgetEnabled = true;
  let siteEnabled = false, siteDecided = false, siteSaving = false;
  let fieldWatch = null, displayedElement = null;
  let draft = null, timer = null, currentRequest = null, serial = 0, configLoad = 0;
  let lastConfiguration = "", lastRequestedElement = null, lastRequestedText = "";
  let lastInputAt = 0, pendingUserInput = false, blockedUntil = 0;
  let composing = false, composingElement = null, applying = false, drag = null, dragged = false;
  let bubblePosition = null, autoOpenedForSuggestion = false;

  function positionSitePrompt() {
    if (sitePrompt.hidden) return;
    const x = Number.parseFloat(host.style.left) || 8, y = Number.parseFloat(host.style.top) || 8;
    const rect = sitePrompt.getBoundingClientRect();
    const left = Math.max(8, Math.min(x + 40 - rect.width, window.innerWidth - rect.width - 8));
    const below = y < rect.height + 18;
    sitePrompt.style.left = (left - x) + "px";
    sitePrompt.style.top = below ? "50px" : "auto";
    sitePrompt.style.bottom = below ? "auto" : "50px";
    sitePrompt.style.setProperty("--pointer", Math.max(10, Math.min(rect.width - 20, x + 15 - left)) + "px");
    sitePrompt.classList.toggle("below", below);
  }
  function updateSiteUi() {
    siteInput.checked = siteEnabled; siteInput.disabled = siteSaving;
    siteYes.disabled = siteSaving; siteNo.disabled = siteSaving;
    sitePrompt.hidden = siteDecided || siteSaving || !widgetEnabled || host.classList.contains("expanded");
    bubble.classList.toggle("paused", !siteEnabled);
    generateButton.disabled = !siteEnabled || siteSaving || Boolean(currentRequest);
    autoInput.disabled = !siteEnabled; autoApplyInput.disabled = !siteEnabled; instructionSelect.disabled = !siteEnabled;
    $(".apply").disabled = !siteEnabled;
    positionSitePrompt();
  }
  async function saveSiteChoice(enabled) {
    if (siteSaving) return;
    const previous = { siteEnabled, siteDecided };
    ++configLoad; siteSaving = true;
    if (!enabled) { resetComposition(); siteEnabled = false; editor.setSiteAccess(false); clearTimeout(timer); cancelCurrent(); clearSuggestion(); pendingUserInput = false; collapse(); }
    updateSiteUi();
    try {
      const result = await chrome.runtime.sendMessage({ type: "SET_SITE_PREFERENCE", enabled });
      if (!result?.ok || typeof result.siteEnabled !== "boolean") throw new Error("Não consegui salvar a escolha para este site. Tente novamente.");
      siteEnabled = result.siteEnabled; siteDecided = result.siteDecided;
      editor.setSiteAccess(siteEnabled); lastRequestedText = ""; lastRequestedElement = null; pendingUserInput = false;
      setStatus(siteEnabled ? "Ativado neste site. Digite para receber sugestões." : "Desativado neste site. Marque Usar IA neste site para reativar.");
    } catch (error) { siteEnabled = previous.siteEnabled; siteDecided = previous.siteDecided; editor.setSiteAccess(siteEnabled); setStatus(error.message, true); }
    finally { siteSaving = false; updateSiteUi(); requestAnimationFrame(clampPosition); }
  }
  function watchReviewedField() {
    clearTimeout(fieldWatch); fieldWatch = null;
    const element = currentRequest?.element || draft?.element || displayedElement;
    if (!siteEnabled || !widgetEnabled || document.visibilityState !== "visible" || !element) return;
    const text = element.isContentEditable ? element.innerText || element.textContent || "" : element.value || "";
    if (!element.isConnected || !text.trim()) {
      clearTimeout(timer); pendingUserInput = false; cancelCurrent(); clearSuggestion(); displayedElement = null; collapse();
      lastRequestedText = ""; setStatus("Campo vazio. Digite para receber sugestões."); return;
    }
    fieldWatch = setTimeout(watchReviewedField, 300);
  }
  function updateUndoButton() { undoActions.hidden = !editor.getUndoState().canUndo; }
  editor.onHistoryChange((action) => {
    updateUndoButton();
    if (action === "undone" || (action === "applied" && !applying)) {
      clearTimeout(timer); cancelCurrent(); clearSuggestion(); rememberAppliedText(editor.getActiveElement());
      if (autoOpenedForSuggestion) collapse();
      setStatus(action === "undone" ? "Texto anterior restaurado." : "Sugestão aplicada. Use Desfazer se quiser voltar ao texto anterior.");
    }
  });
  function setStatus(message, error = false) {
    status.textContent = message;
    status.classList.toggle("error", error);
    bubble.title = message || "Abrir Texto IA. Arraste para mover.";
  }
  function clampPosition() {
    const rect = host.getBoundingClientRect();
    host.style.left = Math.min(Math.max(8, Number.parseFloat(host.style.left) || 8), Math.max(8, window.innerWidth - rect.width - 8)) + "px";
    host.style.top = Math.min(Math.max(8, Number.parseFloat(host.style.top) || 8), Math.max(8, window.innerHeight - rect.height - 8)) + "px";
    positionSitePrompt();
  }
  function expand(forSuggestion = false) {
    if (!host.classList.contains("expanded")) {
      bubblePosition = { x: Number.parseFloat(host.style.left), y: Number.parseFloat(host.style.top) };
      autoOpenedForSuggestion = forSuggestion;
    }
    bubble.hidden = true; panel.hidden = false; host.classList.add("expanded");
    updateUndoButton(); updateSiteUi(); watchReviewedField();
    requestAnimationFrame(clampPosition);
  }
  function collapse() {
    panel.hidden = true; bubble.hidden = false; host.classList.remove("expanded");
    autoOpenedForSuggestion = false; displayedElement = null;
    if (!currentRequest && !draft) { clearTimeout(fieldWatch); fieldWatch = null; }
    updateSiteUi();
    if (bubblePosition) { host.style.left = bubblePosition.x + "px"; host.style.top = bubblePosition.y + "px"; bubblePosition = null; }
    requestAnimationFrame(clampPosition);
  }
  function clearSuggestion() { draft = null; suggestionInput.value = ""; suggestionWrap.hidden = true; }
  function finishSuggestion(message) {
    clearSuggestion(); setStatus(message); pendingUserInput = false;
    if (autoOpenedForSuggestion) collapse();
  }
  function cancelCurrent() {
    if (currentRequest) {
      const old = currentRequest;
      currentRequest = null;
      clearTimeout(old.timeout);
      chrome.runtime.sendMessage({ type: "CANCEL_REWRITE", requestId: old.id }).catch(() => {});
    }
    generateButton.disabled = !siteEnabled || siteSaving;
    bubble.classList.remove("busy");
  }
  async function savePreferences(preferences) {
    try {
      const response = await chrome.runtime.sendMessage({ type: "SET_WIDGET_PREFS", ...preferences });
      if (!response?.ok) throw new Error();
    } catch (_) { setStatus("Não consegui guardar esta preferência. Reabra a extensão.", true); }
  }
  async function loadConfig() {
    const load = ++configLoad;
    try {
      const config = await chrome.runtime.sendMessage({ type: "GET_WIDGET_CONFIG" });
      if (!config?.ok || load !== configLoad) return;
      const signature = [config.provider, config.model, config.revision, config.configured, config.widgetInstruction, config.siteEnabled, config.siteDecided, config.siteRevision].join("|");
      if (lastConfiguration && signature !== lastConfiguration) {
        clearTimeout(timer); cancelCurrent(); clearSuggestion(); collapse();
        lastRequestedText = ""; blockedUntil = 0;
      }
      lastConfiguration = signature;
      configured = config.configured;
      siteEnabled = config.siteEnabled === true; siteDecided = config.siteDecided === true;
      editor.setSiteAccess(siteEnabled); siteLabel.textContent = config.siteLabel || "Este site";
      autoEnabled = config.autoEnabled !== false;
      autoApplyEnabled = config.autoApplyEnabled === true;
      widgetEnabled = config.widgetEnabled !== false;
      autoInput.checked = autoEnabled; autoApplyInput.checked = autoApplyEnabled;
      instructionSelect.value = config.widgetInstruction || "professional";
      host.style.display = widgetEnabled ? "block" : "none";
      if (!widgetEnabled || !autoEnabled || !configured || !siteEnabled) {
        clearTimeout(timer); cancelCurrent();
        if (!widgetEnabled || !configured || !siteEnabled) { resetComposition(); clearSuggestion(); collapse(); pendingUserInput = false; }
      }
      if (config.widgetPosition && !host.classList.contains("expanded")) {
        host.style.left = config.widgetPosition.x + "px"; host.style.top = config.widgetPosition.y + "px";
      }
      requestAnimationFrame(clampPosition);
      updateSiteUi();
      if (!siteEnabled) setStatus(siteDecided ? "Revisão desativada neste site. Use a checkbox para reativar." : "Escolha se deseja usar a revisão neste site.");
      else if (!configured) setStatus("Abra o ícone da extensão e abra Configuração para começar.");
      else if (pendingUserInput) scheduleAutomaticSuggestion();
    } catch (_) { setStatus("A extensão foi atualizada. Recarregue esta página para continuar.", true); }
  }
  function captureDraft() {
    const read = editor.readText();
    return {
      element: editor.getActiveElement(), range: editor.getLastRange(), text: read.text,
      snapshot: { selectedOnly: read.selectedOnly, start: read.start, end: read.end, originalText: read.text }
    };
  }
  function draftIsCurrent(item) {
    if (!item?.element?.isConnected || !(editor.isEditable ? editor.isEditable(item.element) : editor.isAutoEditable(item.element))) return false;
    if (item.element.isContentEditable) return (item.snapshot.selectedOnly && item.range ? item.range.toString() : item.element.innerText || item.element.textContent || "") === item.text;
    return (item.snapshot.selectedOnly ? item.element.value.slice(item.snapshot.start, item.snapshot.end) : item.element.value) === item.text;
  }
  function scheduleAutomaticSuggestion() {
    clearTimeout(timer);
    if (!pendingUserInput || !siteEnabled || !widgetEnabled || !autoEnabled || !configured || composing || currentRequest || document.visibilityState !== "visible") return;
    let current;
    try { current = captureDraft(); } catch (_) { return; }
    if (!editor.isAutoEditable(current.element) || current.text.trim().length < MIN_AUTO_LENGTH || current.text.length > MAX_LENGTH) return;
    if (current.element === lastRequestedElement && current.text === lastRequestedText) return;
    const delay = Math.max(0, IDLE_MS - (Date.now() - lastInputAt), blockedUntil - Date.now());
    timer = setTimeout(() => generateSuggestion(false), delay);
  }
  function resetComposition() { composing = false; composingElement = null; }
  function resumeAutomaticSuggestion() {
    if (document.visibilityState !== "visible") return;
    resetComposition(); watchReviewedField();
    if (pendingUserInput) { lastInputAt = Date.now(); scheduleAutomaticSuggestion(); }
  }
  function rememberAppliedText(element) {
    lastRequestedElement = element;
    try { lastRequestedText = editor.readText().text; } catch (_) { lastRequestedText = ""; }
    pendingUserInput = false;
  }
  async function generateSuggestion(manual) {
    clearTimeout(timer);
    if (currentRequest || !widgetEnabled || !siteEnabled || siteSaving) return;
    if (!manual && (!autoEnabled || !configured || composing || document.visibilityState !== "visible")) return;
    let current;
    try { current = captureDraft(); }
    catch (error) { if (manual) { expand(); setStatus(error.message, true); } return; }
    if (!current.text.trim() || current.text.length > MAX_LENGTH) {
      if (manual) { expand(); setStatus("Use um texto de até 4.000 caracteres no campo ativo.", true); } return;
    }
    if (!configured) { expand(); setStatus("Abra Configuração pelo ícone da extensão.", true); return; }
    if (!manual && current.element === lastRequestedElement && current.text === lastRequestedText) return;
    const request = { id: Date.now() + "-" + (++serial), element: current.element, manual, timeout: null };
    currentRequest = request; displayedElement = current.element; watchReviewedField();
    clearSuggestion(); generateButton.disabled = true; bubble.classList.add("busy");
    setStatus("Revisando o texto… Você pode continuar digitando para cancelar.");
    try {
      const response = await Promise.race([
        chrome.runtime.sendMessage({ type: "AI_REWRITE", forceRefresh: manual, requestId: request.id, text: current.text, instruction: INSTRUCTIONS[instructionSelect.value] }),
        new Promise((_, reject) => { request.timeout = setTimeout(() => reject(new Error("A revisão demorou demais. Tente novamente ou escolha um modelo rápido.")), 30000); })
      ]);
      if (currentRequest !== request) return;
      if (!response?.ok) {
        if (response?.code === "CANCELLED") return;
        if (response?.retryAfterMs) blockedUntil = Date.now() + response.retryAfterMs;
        throw new Error(response?.error || "Não foi possível revisar. Confira Configuração na extensão.");
      }
      if (!draftIsCurrent(current) || editor.getActiveElement() !== current.element || document.visibilityState !== "visible") return;
      lastRequestedElement = current.element; lastRequestedText = current.text;
      pendingUserInput = false;
      if (autoApplyEnabled) {
        applying = true;
        try {
          editor.applyText(response.suggestion, current.snapshot, current.element, current.range);
          rememberAppliedText(current.element);
          setStatus("Texto corrigido automaticamente.");
        } finally { applying = false; }
        return;
      }
      draft = current; suggestionInput.value = response.suggestion; suggestionWrap.hidden = false;
      expand(true);
      setStatus("Sugestão pronta. Revise e escolha Aplicar ou Descartar.");
    } catch (error) {
      if (currentRequest !== request) return;
      lastRequestedElement = current.element; lastRequestedText = current.text;
      setStatus(error.message || "Não consegui revisar agora.", true);
      expand(true);
    } finally {
      clearTimeout(request.timeout);
      if (currentRequest === request) {
        currentRequest = null; generateButton.disabled = !siteEnabled || siteSaving; bubble.classList.remove("busy");
        if (!host.classList.contains("expanded") && !draft) { displayedElement = null; clearTimeout(fieldWatch); fieldWatch = null; }
        if (pendingUserInput && !draftIsCurrent(current)) scheduleAutomaticSuggestion();
      }
    }
  }
  function onInput(event) {
    if (!widgetEnabled || applying) return;
    const editable = editor.isEditable ? editor.isEditable(event.target) : editor.isAutoEditable(event.target);
    if (!editable) return;
    if (!event.isTrusted) { if (event.target === (currentRequest?.element || draft?.element || displayedElement)) watchReviewedField(); return; }
    clearTimeout(timer); cancelCurrent(); clearSuggestion(); collapse();
    if (!siteEnabled) { pendingUserInput = false; return; }
    // A entrada confirmada encerra uma composição antiga mesmo se compositionend não chegar.
    if (event.isComposing === false) resetComposition();
    else if (event.isComposing === true) { composing = true; composingElement = editor.getActiveElement(); }
    lastInputAt = Date.now(); pendingUserInput = editor.isAutoEditable(event.target);
    clearTimeout(timer); cancelCurrent(); clearSuggestion(); collapse();
    setStatus("Aguardando 2,5 segundos sem digitar…");
    scheduleAutomaticSuggestion();
  }
  document.addEventListener("input", onInput, true);
  document.addEventListener("compositionstart", (event) => {
    if (event.isTrusted && widgetEnabled && siteEnabled && editor.isAutoEditable(event.target)) { composing = true; composingElement = editor.getActiveElement(); clearTimeout(timer); cancelCurrent(); clearSuggestion(); collapse(); }
  }, true);
  document.addEventListener("compositionend", (event) => {
    if (!event.isTrusted) return;
    if (editor.isAutoEditable(event.target)) { resetComposition(); onInput(event); }
    else if (composing && composingElement === editor.getActiveElement()) {
      resetComposition();
      if (pendingUserInput) { lastInputAt = Date.now(); scheduleAutomaticSuggestion(); }
    }
  }, true);
  document.addEventListener("keydown", event => {
    if (!event.isTrusted || !composing || event.isComposing !== false || event.keyCode === 229 || ["Process", "Shift", "Control", "Alt", "Meta"].includes(event.key) || composingElement !== editor.getActiveElement()) return;
    resetComposition();
    if (pendingUserInput) { lastInputAt = Date.now(); scheduleAutomaticSuggestion(); }
  }, true);
  document.addEventListener("focusin", () => {
    if (composing && composingElement !== editor.getActiveElement()) resetComposition();
    if (currentRequest || draft) {
      const target = currentRequest?.element || draft?.element;
      if (target && editor.getActiveElement() !== target) { cancelCurrent(); clearSuggestion(); collapse(); }
    }
  }, true);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { clearTimeout(timer); clearTimeout(fieldWatch); cancelCurrent(); }
    else resumeAutomaticSuggestion();
  }, true);
  for (const name of ["reset", "submit", "change"]) document.addEventListener(name, () => { if (currentRequest || draft || displayedElement) setTimeout(watchReviewedField, 0); }, true);
  window.addEventListener("blur", () => { clearTimeout(timer); cancelCurrent(); });
  window.addEventListener("focus", resumeAutomaticSuggestion);
  window.addEventListener("pageshow", () => loadConfig().then(resumeAutomaticSuggestion));
  window.addEventListener("resize", clampPosition);
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "WIDGET_CONFIG_CHANGED" || _sender.id !== chrome.runtime.id) return;
    loadConfig().then(() => sendResponse({ ok: true })); return true;
  });
  function beginDrag(event) {
    if (event.button !== 0 || event.target.closest("button:not(.bubble), input, select")) return;
    drag = { x: event.clientX, y: event.clientY, left: Number.parseFloat(host.style.left), top: Number.parseFloat(host.style.top) };
    dragged = false; event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault();
  }
  function moveDrag(event) {
    if (!drag) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) dragged = true;
    if (!dragged) return;
    host.style.left = drag.left + dx + "px"; host.style.top = drag.top + dy + "px"; clampPosition();
  }
  function endDrag(event) {
    if (!drag) return; drag = null;
    if (dragged) {
      const position = { x: Number.parseFloat(host.style.left), y: Number.parseFloat(host.style.top) };
      if (event.currentTarget !== bubble) bubblePosition = position;
      savePreferences({ widgetPosition: position });
    } else if (event.type === "pointerup" && event.currentTarget === bubble) expand();
  }
  for (const handle of [bubble, $(".header")]) {
    handle.addEventListener("pointerdown", beginDrag); handle.addEventListener("pointermove", moveDrag);
    handle.addEventListener("pointerup", endDrag); handle.addEventListener("pointercancel", endDrag);
  }
  bubble.addEventListener("click", (event) => { if (event.detail === 0) expand(); });
  $(".minimize").addEventListener("click", collapse);
  $(".hide-widget").addEventListener("click", () => {
    widgetEnabled = false; clearTimeout(timer); cancelCurrent(); clearSuggestion(); collapse();
    host.style.display = "none"; savePreferences({ widgetEnabled: false });
  });
  autoInput.addEventListener("change", () => {
    autoEnabled = autoInput.checked; savePreferences({ autoEnabled });
    if (autoEnabled) { lastInputAt = Date.now(); scheduleAutomaticSuggestion(); }
    else { clearTimeout(timer); cancelCurrent(); setStatus("Revisão automática pausada. Use Revisar agora."); }
  });
  autoApplyInput.addEventListener("change", () => {
    autoApplyEnabled = autoApplyInput.checked; savePreferences({ autoApplyEnabled });
    setStatus(autoApplyEnabled ? "Próximas correções serão aplicadas sem confirmação." : "Você decide quando aplicar cada sugestão.");
  });
  instructionSelect.addEventListener("change", () => {
    cancelCurrent(); clearSuggestion(); lastRequestedText = ""; lastInputAt = Date.now();
    savePreferences({ widgetInstruction: instructionSelect.value }); scheduleAutomaticSuggestion();
  });
  siteYes.addEventListener("click", event => { if (event.isTrusted) return saveSiteChoice(true); });
  siteNo.addEventListener("click", event => { if (event.isTrusted) return saveSiteChoice(false); });
  siteInput.addEventListener("change", event => { if (event.isTrusted) return saveSiteChoice(siteInput.checked); });
  $(".undo").addEventListener("click", () => {
    applying = true;
    try { editor.undoText(editor.getUndoState().undoId); }
    catch (error) { setStatus(error.message, true); updateUndoButton(); }
    finally { applying = false; }
  });
  generateButton.addEventListener("click", () => generateSuggestion(true));
  $(".discard").addEventListener("click", () => finishSuggestion("Sugestão descartada."));
  $(".apply").addEventListener("click", () => {
    if (!draft || !siteEnabled) return;
    try {
      applying = true; editor.applyText(suggestionInput.value, draft.snapshot, draft.element, draft.range);
      rememberAppliedText(draft.element); finishSuggestion("Sugestão aplicada.");
    } catch (error) { setStatus(error.message, true); }
    finally { applying = false; }
  });
  updateUndoButton();
  loadConfig();
})();
