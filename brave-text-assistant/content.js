(() => {
  if (window.__braveTextAssistantInstalled) return;
  window.__braveTextAssistantInstalled = true;
  let activeElement = null, lastRange = null, undoRecord = null, undoSerial = 0, applyingText = false;
  let siteAccess = false;
  const historyListeners = new Set();
  function fieldText(element) { return element.isContentEditable ? element.innerText || element.textContent || "" : element.value; }
  function notifyHistory(action) { for (const listener of historyListeners) { try { listener(action); } catch (_) {} } }
  function clearUndo() { if (undoRecord) { undoRecord = null; notifyHistory("invalidated"); } }
  function getUndoState() {
    const record = undoRecord;
    if (record && (!record.element.isConnected || !isEditable(record.element) || fieldText(record.element) !== record.afterText || (record.element.isContentEditable && record.element.innerHTML !== record.afterMarkup))) clearUndo();
    const canUndo = Boolean(undoRecord && activeElement === undoRecord.element);
    return { canUndo, undoId: canUndo ? undoRecord.id : null };
  }
  function undoText(undoId) {
    const state = getUndoState();
    if (!state.canUndo) throw new Error("Não há uma sugestão para desfazer neste campo. O texto pode ter sido editado ou enviado.");
    if (undoId !== state.undoId) throw new Error("Há uma alteração mais recente. Abra novamente o assistente para desfazer.");
    const record = undoRecord, element = record.element;
    element.focus();
    if (!getUndoState().canUndo) throw new Error("O campo mudou. O texto atual foi preservado.");
    undoRecord = null; lastRange = null;
    if (element.isContentEditable) {
      element.replaceChildren(...record.beforeNodes);
      element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "historyUndo", data: null }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      setNativeValue(element, record.beforeText, "historyUndo");
      try { element.setSelectionRange(record.selectionStart, record.selectionEnd); } catch (_) {}
    }
    notifyHistory("undone");
    return getUndoState();
  }
  function isSensitive(element) {
    if (element.closest?.("[data-texto-ia-ignore]")) return true;
    return /(?:^|\s)(current-password|new-password|one-time-code|cc-\S+)(?:\s|$)/i.test(element.getAttribute?.("autocomplete") || "");
  }
  function isEditable(element) {
    if (!(element instanceof HTMLElement) || isSensitive(element)) return false;
    if (element.matches("textarea, input:not([type]), input[type=text], input[type=search], input[type=email], input[type=url], input[type=tel]")) return !element.disabled && !element.readOnly;
    return element.isContentEditable;
  }
  function editableTarget(element) {
    if (!isEditable(element)) return null;
    if (!element.isContentEditable) return element;
    let root = element;
    while (root.parentElement?.isContentEditable) root = root.parentElement;
    return isSensitive(root) ? null : root;
  }
  function rangeBelongsTo(element, range) {
    return Boolean(element && range && element.contains(range.startContainer) && element.contains(range.endContainer));
  }
  function track(event) {
    const target = editableTarget(event.target);
    if (target) { if (target !== activeElement) lastRange = null; activeElement = target; notifyHistory("focus"); }
  }
  activeElement = editableTarget(document.activeElement);
  document.addEventListener("focusin", track, true);
  document.addEventListener("input", (event) => {
    if (!event.isTrusted || applyingText) return;
    if (undoRecord && (event.target === undoRecord.element || undoRecord.element.contains(event.target))) clearUndo();
    track(event);
  }, true);
  document.addEventListener("selectionchange", () => {
    if (!activeElement?.isContentEditable) return;
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    lastRange = rangeBelongsTo(activeElement, range) ? range.cloneRange() : null;
  }, true);
  function readText() {
    if (!siteAccess) throw new Error("Ative Usar IA neste site no robô ou em Revisar texto.");
    if (!isEditable(activeElement) || !activeElement.isConnected) activeElement = editableTarget(document.activeElement);
    if (!activeElement) throw new Error("Clique primeiro no campo de texto que deseja revisar.");
    if (activeElement.isContentEditable) {
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      if (rangeBelongsTo(activeElement, range) && selection.toString().trim()) {
        lastRange = range.cloneRange();
        return { text: selection.toString(), selectedOnly: true };
      }
      return { text: activeElement.innerText || activeElement.textContent || "", selectedOnly: false };
    }
    const start = activeElement.selectionStart, end = activeElement.selectionEnd;
    if (typeof start === "number" && end > start) return { text: activeElement.value.slice(start, end), selectedOnly: true, start, end };
    return { text: activeElement.value || "", selectedOnly: false, start: 0, end: (activeElement.value || "").length };
  }
  function setNativeValue(element, value, inputType = "insertReplacementText") {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(element, value); else element.value = value;
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType, data: inputType === "historyUndo" ? null : value }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function applyText(text, snapshot, targetElement = activeElement, selectedRange = lastRange) {
    if (!siteAccess) throw new Error("A revisão está desativada neste site.");
    if (typeof text !== "string" || !text.trim() || text.length > 32000) throw new Error("A sugestão não contém um texto válido.");
    if (!targetElement?.isConnected || !isEditable(targetElement)) throw new Error("O campo original não está disponível para edição.");
    if (targetElement.isContentEditable && snapshot?.selectedOnly && !rangeBelongsTo(targetElement, selectedRange)) throw new Error("A seleção original mudou. Gere outra sugestão.");
    if (!targetElement.isContentEditable && snapshot?.selectedOnly && (!Number.isInteger(snapshot.start) || !Number.isInteger(snapshot.end) || snapshot.start < 0 || snapshot.end < snapshot.start || snapshot.end > targetElement.value.length)) throw new Error("A seleção original mudou. Gere outra sugestão.");
    const current = targetElement.isContentEditable
      ? snapshot?.selectedOnly ? selectedRange.toString() : targetElement.innerText || targetElement.textContent || ""
      : snapshot?.selectedOnly ? targetElement.value.slice(snapshot.start, snapshot.end) : targetElement.value;
    if (typeof snapshot?.originalText !== "string" || current !== snapshot.originalText) throw new Error("O texto mudou desde a sugestão. Gere uma nova versão.");
    const previous = {
      element: targetElement, beforeText: fieldText(targetElement), beforeMarkup: targetElement.isContentEditable ? targetElement.innerHTML : null,
      beforeNodes: targetElement.isContentEditable ? [...targetElement.childNodes].map((node) => node.cloneNode(true)) : null,
      selectionStart: targetElement.selectionStart, selectionEnd: targetElement.selectionEnd
    };
    activeElement = targetElement;
    targetElement.focus();
    if (fieldText(targetElement) !== previous.beforeText) throw new Error("O campo mudou ao receber foco. Gere outra sugestão.");
    applyingText = true;
    try {
      if (targetElement.isContentEditable) {
        const selection = window.getSelection();
        const range = snapshot.selectedOnly ? selectedRange : document.createRange();
        if (!snapshot.selectedOnly) range.selectNodeContents(targetElement);
        selection.removeAllRanges(); selection.addRange(range);
        if (!document.execCommand("insertText", false, text)) {
          range.deleteContents(); range.insertNode(document.createTextNode(text));
          range.collapse(false); selection.removeAllRanges(); selection.addRange(range);
          targetElement.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: text }));
        }
      } else {
        const start = snapshot.selectedOnly ? snapshot.start : 0;
        const end = snapshot.selectedOnly ? snapshot.end : targetElement.value.length;
        setNativeValue(targetElement, targetElement.value.slice(0, start) + text + targetElement.value.slice(end));
        try { targetElement.setSelectionRange(start + text.length, start + text.length); } catch (_) {}
      }
      const afterText = fieldText(targetElement), afterMarkup = targetElement.isContentEditable ? targetElement.innerHTML : null;
      if (afterText !== previous.beforeText || afterMarkup !== previous.beforeMarkup) undoRecord = { ...previous, id: ++undoSerial, afterText, afterMarkup };
      notifyHistory("applied");
      return getUndoState();
    } finally { applyingText = false; }
  }
  window.__braveTextAssistantApi = {
    readText, applyText, undoText, getUndoState, setSiteAccess: enabled => { siteAccess = enabled === true; }, onHistoryChange: (listener) => { historyListeners.add(listener); return () => historyListeners.delete(listener); }, isEditable, getActiveElement: () => activeElement,
    getLastRange: () => lastRange?.cloneRange() || null,
    isAutoEditable: (element) => {
      const target = editableTarget(element);
      return target instanceof HTMLTextAreaElement || Boolean(target?.isContentEditable);
    }
  };
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!["READ_ACTIVE_TEXT", "APPLY_TEXT", "GET_UNDO_STATE", "UNDO_APPLIED_TEXT"].includes(message?.type)) return;
    if (_sender.id !== chrome.runtime.id || _sender.url?.split(/[?#]/)[0] !== chrome.runtime.getURL("sidepanel.html")) { sendResponse({ ok: false, error: "Origem da solicitação inválida." }); return; }
    (async () => {
      if (["READ_ACTIVE_TEXT", "APPLY_TEXT"].includes(message.type)) {
        const config = await chrome.runtime.sendMessage({ type: "GET_WIDGET_CONFIG" });
        siteAccess = config?.ok === true && config.siteEnabled === true;
      }
      if (message.type === "READ_ACTIVE_TEXT") return { ...readText() };
      if (message.type === "GET_UNDO_STATE") return getUndoState();
      if (message.type === "UNDO_APPLIED_TEXT") return undoText(message.undoId);
      return applyText(message.text, message.snapshot);
    })().then(result => sendResponse({ ...result, ok: true })).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  });
})();
