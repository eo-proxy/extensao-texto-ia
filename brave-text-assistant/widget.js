(() => {
  if (window.__braveTextAssistantWidgetInstalled) return;
  const editor = window.__braveTextAssistantApi;
  if (!editor || !document.documentElement) return;
  window.__braveTextAssistantWidgetInstalled = true;

  const MIN_AUTO_LENGTH = 40;
  const MAX_LENGTH = 4000;
  const IDLE_MS = 2800;
  const AUTO_COOLDOWN_MS = 12000;
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
      .bubble img { display: block; width: 40px; height: 40px; object-fit: contain; pointer-events: none; }
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
    <section class="panel" hidden aria-label="Assistente de texto">
      <div class="header"><img src="${logoUrl}" alt="Texto IA, por GHS Studio"><button class="minimize" type="button" title="Recolher" aria-label="Recolher">−</button></div>
      <div class="body">
        <div class="row">
          <label><input class="auto" type="checkbox" checked> Automático</label>
          <select class="instruction" aria-label="Estilo da revisão">
            <option value="professional">Profissional</option>
            <option value="technical">Técnico</option>
            <option value="correct">Corrigir</option>
          </select>
        </div>
        <div class="row"><label><input class="auto-apply" type="checkbox"> Aplicar sugestões automaticamente</label></div>
        <p class="hint">Se ativado, o texto revisado substitui o original assim que a IA responder, sem pedir confirmação.</p>
        <p class="status" role="status" aria-live="polite">Digite em um campo de texto para começar.</p>
        <div class="suggestion-wrap" hidden>
          <label class="suggestion-label" for="assistant-suggestion">Sugestão editável</label>
          <textarea id="assistant-suggestion" class="suggestion"></textarea>
          <div class="actions"><button class="apply primary" type="button">Aplicar</button><button class="discard secondary" type="button">Descartar</button></div>
        </div>
        <div class="actions"><button class="generate secondary" type="button">Gerar agora</button></div>
        <p class="hint">Arraste pelo topo para mover. Com a aplicação automática desligada, revise antes de clicar em Aplicar.</p>
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
  const autoInput = $(".auto");
  const autoApplyInput = $(".auto-apply");
  const instructionSelect = $(".instruction");

  let configured = false;
  let lastConfiguration = "";
  let autoEnabled = true;
  let autoApplyEnabled = false;
  let widgetEnabled = true;
  let busy = false;
  let draft = null;
  let timer = null;
  let nextAutoAt = 0;
  let lastRequestedElement = null;
  let lastRequestedText = "";
  let requestVersion = 0;
  let composing = false;
  let applying = false;
  let drag = null;
  let dragged = false;
  let bubblePosition = null;
  let autoOpenedForSuggestion = false;
  let resumeAfterRequest = false;

  function setStatus(message, error = false) {
    status.textContent = message;
    status.classList.toggle("error", error);
  }

  function clampPosition() {
    const rect = host.getBoundingClientRect();
    const x = Math.min(Math.max(8, Number.parseFloat(host.style.left) || 8), Math.max(8, window.innerWidth - rect.width - 8));
    const y = Math.min(Math.max(8, Number.parseFloat(host.style.top) || 8), Math.max(8, window.innerHeight - rect.height - 8));
    host.style.left = `${x}px`;
    host.style.top = `${y}px`;
  }

  function expand(forSuggestion = false) {
    if (!host.classList.contains("expanded")) {
      bubblePosition = { x: Number.parseFloat(host.style.left), y: Number.parseFloat(host.style.top) };
      autoOpenedForSuggestion = forSuggestion;
    }
    bubble.hidden = true;
    panel.hidden = false;
    host.classList.add("expanded");
    requestAnimationFrame(clampPosition);
  }

  function collapse() {
    panel.hidden = true;
    bubble.hidden = false;
    host.classList.remove("expanded");
    autoOpenedForSuggestion = false;
    if (bubblePosition) {
      host.style.left = `${bubblePosition.x}px`;
      host.style.top = `${bubblePosition.y}px`;
      bubblePosition = null;
    }
    requestAnimationFrame(clampPosition);
  }

  async function savePreferences(preferences) {
    try {
      const response = await chrome.runtime.sendMessage({ type: "SET_WIDGET_PREFS", ...preferences });
      if (!response?.ok) throw new Error(response?.error || "Falha ao salvar.");
    }
    catch (_) { setStatus("Não consegui salvar a preferência.", true); }
  }

  async function loadConfig() {
    try {
      const config = await chrome.runtime.sendMessage({ type: "GET_WIDGET_CONFIG" });
      if (!config?.ok) return;
      const signature = [config.provider, config.model, config.configured, config.widgetInstruction].join("|");
      if (lastConfiguration && signature !== lastConfiguration) {
        clearTimeout(timer);
        requestVersion += 1;
        lastRequestedText = "";
        draft = null;
        suggestionWrap.hidden = true;
      }
      lastConfiguration = signature;
      configured = config.configured;
      autoEnabled = config.autoEnabled;
      autoApplyEnabled = config.autoApplyEnabled;
      widgetEnabled = config.widgetEnabled;
      host.style.display = widgetEnabled ? "block" : "none";
      if (!widgetEnabled) {
        clearTimeout(timer);
        requestVersion += 1;
        draft = null;
        suggestionWrap.hidden = true;
        collapse();
      }
      autoInput.checked = autoEnabled;
      autoApplyInput.checked = autoApplyEnabled;
      instructionSelect.value = config.widgetInstruction;
      if (config.widgetPosition) {
        host.style.left = `${config.widgetPosition.x}px`;
        host.style.top = `${config.widgetPosition.y}px`;
      }
      requestAnimationFrame(clampPosition);
      if (!configured) {
        clearTimeout(timer);
        draft = null;
        suggestionWrap.hidden = true;
        setStatus("Configure a chave, o modelo e a permissão pelo ícone da extensão no Brave.");
      }
    } catch (_) { /* A extensão pode ter sido recarregada com esta página aberta. */ }
  }

  function captureDraft() {
    const read = editor.readText();
    const element = editor.getActiveElement();
    return {
      element,
      range: editor.getLastRange(),
      text: read.text,
      snapshot: { selectedOnly: read.selectedOnly, start: read.start, end: read.end, originalText: read.text }
    };
  }

  function draftIsCurrent(item) {
    if (!item?.element?.isConnected) return false;
    if (item.element.isContentEditable) {
      return (item.snapshot.selectedOnly && item.range
        ? item.range.toString()
        : (item.element.innerText || item.element.textContent || "")) === item.text;
    }
    return (item.snapshot.selectedOnly
      ? item.element.value.slice(item.snapshot.start, item.snapshot.end)
      : item.element.value) === item.text;
  }

  function scheduleAutomaticSuggestion() {
    clearTimeout(timer);
    if (!widgetEnabled || !autoEnabled || !configured || composing || busy || document.visibilityState !== "visible") return;
    let current;
    try { current = captureDraft(); } catch (_) { return; }
    if (!editor.isAutoEditable(current.element)) return;
    if (current.text.trim().length < MIN_AUTO_LENGTH || current.text.length > MAX_LENGTH) return;
    if (current.element === lastRequestedElement && current.text === lastRequestedText) return;
    const delay = Math.max(IDLE_MS, nextAutoAt - Date.now());
    timer = setTimeout(() => generateSuggestion(false), delay);
  }

  function resumeAutomaticSuggestion() {
    if (document.visibilityState !== "visible") return;
    if (busy) { resumeAfterRequest = true; return; }
    scheduleAutomaticSuggestion();
  }

  function rememberAppliedText(element) {
    lastRequestedElement = element;
    try { lastRequestedText = editor.readText().text; }
    catch (_) { lastRequestedText = ""; }
  }

  function finishSuggestion(message) {
    draft = null;
    suggestionInput.value = "";
    suggestionWrap.hidden = true;
    setStatus(message);
    if (autoOpenedForSuggestion) collapse();
  }

  async function generateSuggestion(manual) {
    clearTimeout(timer);
    if (busy) return;
    let current;
    try { current = captureDraft(); }
    catch (error) { if (manual) expand(); return setStatus(error.message, true); }
    if (!current.text.trim()) { if (manual) expand(); return setStatus("Digite algum texto antes de pedir uma sugestão.", true); }
    if (current.text.length > MAX_LENGTH) { if (manual) expand(); return setStatus("O texto é longo demais para esta versão. Use até 4.000 caracteres.", true); }
    if (!manual && (!widgetEnabled || !autoEnabled || !configured || !editor.isAutoEditable(current.element) || current.text.trim().length < MIN_AUTO_LENGTH)) return;
    if (!configured) { await loadConfig(); if (!configured) { expand(); return setStatus("Configure a chave, o modelo e a permissão pelo ícone da extensão no Brave.", true); } }
    if (!manual && current.element === lastRequestedElement && current.text === lastRequestedText) return;

    busy = true;
    draft = null;
    requestVersion += 1;
    const version = requestVersion;
    if (!manual) nextAutoAt = Date.now() + AUTO_COOLDOWN_MS;
    suggestionWrap.hidden = true;
    generateButton.disabled = true;
    setStatus("Gerando sugestão…");
    let timeoutId;
    let retryWhenVisible = false;
    try {
      const response = await Promise.race([
        chrome.runtime.sendMessage({
          type: "AI_REWRITE",
          text: current.text,
          instruction: INSTRUCTIONS[instructionSelect.value]
        }),
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error("A IA demorou demais para responder. Tente novamente.")), 45000);
        })
      ]);
      if (!response?.ok) throw new Error(response?.error || "A IA não respondeu.");
      if (version !== requestVersion || !draftIsCurrent(current) || editor.getActiveElement() !== current.element) {
        setStatus("O texto mudou enquanto a sugestão era gerada. Aguardando a nova versão.");
        retryWhenVisible = true;
        return;
      }
      if (document.visibilityState !== "visible") {
        retryWhenVisible = true;
        return;
      }
      if (autoApplyEnabled) {
        applying = true;
        try {
          editor.applyText(response.suggestion, current.snapshot, current.element, current.range);
          rememberAppliedText(current.element);
          setStatus("Sugestão aplicada automaticamente ao campo.");
        } finally { applying = false; }
        return;
      }
      lastRequestedElement = current.element;
      lastRequestedText = current.text;
      draft = current;
      suggestionInput.value = response.suggestion;
      suggestionWrap.hidden = false;
      expand(true);
      setStatus("Revise a sugestão e clique em Aplicar se quiser usar.");
      requestAnimationFrame(clampPosition);
    } catch (error) {
      setStatus(error.message || "Não foi possível gerar a sugestão.", true);
      if (manual) expand();
    } finally {
      clearTimeout(timeoutId);
      busy = false;
      generateButton.disabled = false;
      const shouldResume = resumeAfterRequest || retryWhenVisible || !draftIsCurrent(current) || editor.getActiveElement() !== current.element;
      resumeAfterRequest = false;
      if (shouldResume && autoEnabled && document.visibilityState === "visible") scheduleAutomaticSuggestion();
    }
  }

  function onInput(event) {
    if (!widgetEnabled || applying || !event.isTrusted || !editor.isAutoEditable(event.target)) return;
    if (draft) {
      draft = null;
      suggestionWrap.hidden = true;
      setStatus("Texto alterado. Aguardando uma nova sugestão.");
    }
    scheduleAutomaticSuggestion();
  }

  document.addEventListener("input", onInput, true);
  document.addEventListener("compositionstart", (event) => { if (editor.isAutoEditable(event.target)) { composing = true; clearTimeout(timer); } }, true);
  document.addEventListener("compositionend", (event) => { if (editor.isAutoEditable(event.target)) { composing = false; if (event.isTrusted) scheduleAutomaticSuggestion(); } }, true);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") clearTimeout(timer);
    else resumeAutomaticSuggestion();
  }, true);
  window.addEventListener("focus", resumeAutomaticSuggestion);
  window.addEventListener("pageshow", () => { loadConfig().then(resumeAutomaticSuggestion); });
  window.addEventListener("resize", clampPosition);
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "WIDGET_CONFIG_CHANGED") return;
    loadConfig().then(() => sendResponse({ ok: true }));
    return true;
  });

  function beginDrag(event) {
    if (event.button !== 0 || event.target.closest("button:not(.bubble), input, select")) return;
    drag = { x: event.clientX, y: event.clientY, left: Number.parseFloat(host.style.left), top: Number.parseFloat(host.style.top) };
    dragged = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }
  function moveDrag(event) {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) dragged = true;
    if (!dragged) return;
    host.style.left = `${drag.left + dx}px`;
    host.style.top = `${drag.top + dy}px`;
    clampPosition();
  }
  function endDrag(event) {
    if (!drag) return;
    drag = null;
    if (dragged) {
      const position = { x: Number.parseFloat(host.style.left), y: Number.parseFloat(host.style.top) };
      if (event.currentTarget !== bubble) bubblePosition = position;
      savePreferences({ widgetPosition: position });
    }
    else if (event.type === "pointerup" && event.currentTarget === bubble) expand();
  }
  for (const handle of [bubble, $(".header")]) {
    handle.addEventListener("pointerdown", beginDrag);
    handle.addEventListener("pointermove", moveDrag);
    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);
  }
  bubble.addEventListener("click", (event) => { if (event.detail === 0) expand(); });
  $(".minimize").addEventListener("click", collapse);
  $(".hide-widget").addEventListener("click", () => {
    widgetEnabled = false;
    clearTimeout(timer);
    requestVersion += 1;
    draft = null;
    suggestionWrap.hidden = true;
    collapse();
    host.style.display = "none";
    savePreferences({ widgetEnabled: false });
  });
  autoInput.addEventListener("change", () => {
    autoEnabled = autoInput.checked;
    savePreferences({ autoEnabled });
    if (autoEnabled) scheduleAutomaticSuggestion();
    else { clearTimeout(timer); setStatus("Sugestões automáticas pausadas. Use Gerar agora quando quiser."); }
  });
  autoApplyInput.addEventListener("change", () => {
    autoApplyEnabled = autoApplyInput.checked;
    savePreferences({ autoApplyEnabled });
    setStatus(autoApplyEnabled ? "As próximas sugestões serão aplicadas sem confirmação." : "Revise as próximas sugestões antes de aplicar.");
  });
  instructionSelect.addEventListener("change", () => {
    lastRequestedText = "";
    savePreferences({ widgetInstruction: instructionSelect.value });
    if (autoEnabled) scheduleAutomaticSuggestion();
  });
  generateButton.addEventListener("click", () => generateSuggestion(true));
  $(".discard").addEventListener("click", () => {
    finishSuggestion("Sugestão descartada. O texto original continua no campo.");
  });
  $(".apply").addEventListener("click", () => {
    if (!draft) return;
    try {
      applying = true;
      editor.applyText(suggestionInput.value, draft.snapshot, draft.element, draft.range);
      rememberAppliedText(draft.element);
      finishSuggestion("Sugestão aplicada ao campo.");
    } catch (error) { setStatus(error.message, true); }
    finally { applying = false; }
  });

  loadConfig();
})();


