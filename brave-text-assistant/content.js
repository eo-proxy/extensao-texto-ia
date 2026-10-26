(() => {
  if (window.__braveTextAssistantInstalled) return;
  window.__braveTextAssistantInstalled = true;

  let activeElement = null;
  let lastRange = null;

  function isEditable(element) {
    if (!(element instanceof HTMLElement)) return false;
    if (element.matches("textarea, input:not([type]), input[type=text], input[type=search], input[type=email], input[type=url], input[type=tel]")) {
      return !element.disabled && !element.readOnly;
    }
    return element.isContentEditable;
  }

  function editableTarget(element) {
    if (!isEditable(element)) return null;
    if (!element.isContentEditable) return element;
    let root = element;
    while (root.parentElement?.isContentEditable) root = root.parentElement;
    return root;
  }

  activeElement = editableTarget(document.activeElement);

  function onFocus(event) {
    const target = editableTarget(event.target);
    if (target) activeElement = target;
  }
  document.addEventListener("focusin", onFocus, true);
  document.addEventListener("selectionchange", () => {
    if (activeElement?.isContentEditable) {
      const selection = window.getSelection();
      if (selection?.rangeCount) lastRange = selection.getRangeAt(0).cloneRange();
    }
  }, true);

  function readText() {
    if (!isEditable(activeElement) || !activeElement.isConnected) {
      activeElement = editableTarget(document.activeElement);
    }
    if (!activeElement) throw new Error("Clique primeiro no campo de texto que deseja revisar.");

    if (activeElement.isContentEditable) {
      const selection = window.getSelection();
      const selected = selection?.toString() || "";
      if (selected.trim()) {
        lastRange = selection.getRangeAt(0).cloneRange();
        return { text: selected, selectedOnly: true };
      }
      return { text: activeElement.innerText || activeElement.textContent || "", selectedOnly: false };
    }

    const start = activeElement.selectionStart;
    const end = activeElement.selectionEnd;
    if (typeof start === "number" && end > start) {
      return { text: activeElement.value.slice(start, end), selectedOnly: true, start, end };
    }
    return { text: activeElement.value || "", selectedOnly: false, start: 0, end: (activeElement.value || "").length };
  }

  function setNativeValue(element, value) {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(element, value);
    else element.value = value;
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: value }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function applyText(text, snapshot, targetElement = activeElement, selectedRange = lastRange) {
    if (!targetElement?.isConnected) throw new Error("O campo original não está mais disponível. Selecione-o novamente.");
    if (typeof snapshot?.originalText === "string") {
      let currentText;
      if (targetElement.isContentEditable) {
        currentText = snapshot.selectedOnly && selectedRange ? selectedRange.toString() : (targetElement.innerText || targetElement.textContent || "");
      } else {
        currentText = snapshot.selectedOnly
          ? targetElement.value.slice(snapshot.start, snapshot.end)
          : targetElement.value;
      }
      if (currentText !== snapshot.originalText) throw new Error("O texto mudou desde a sugestão. Gere uma nova versão antes de aplicar.");
    }
    activeElement = targetElement;
    targetElement.focus();
    if (targetElement.isContentEditable) {
      const selection = window.getSelection();
      if (snapshot?.selectedOnly && selectedRange) {
        selection.removeAllRanges();
        selection.addRange(selectedRange);
      } else {
        const range = document.createRange();
        range.selectNodeContents(targetElement);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      if (!document.execCommand("insertText", false, text)) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(text));
        targetElement.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: text }));
      }
    } else {
      const start = snapshot?.start ?? 0;
      const end = snapshot?.end ?? targetElement.value.length;
      const before = targetElement.value.slice(0, start);
      const after = targetElement.value.slice(end);
      setNativeValue(targetElement, before + text + after);
      try { targetElement.setSelectionRange(start + text.length, start + text.length); }
      catch (_) { /* Alguns tipos de input não aceitam seleção programática. */ }
    }
  }

  window.__braveTextAssistantApi = {
    readText,
    applyText,
    getActiveElement: () => activeElement,
    getLastRange: () => lastRange?.cloneRange() || null,
    isAutoEditable: (element) => element instanceof HTMLTextAreaElement || Boolean(element?.isContentEditable)
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!["READ_ACTIVE_TEXT", "APPLY_TEXT"].includes(message?.type)) return;
    try {
      if (message?.type === "READ_ACTIVE_TEXT") sendResponse({ ok: true, ...readText() });
      if (message?.type === "APPLY_TEXT") {
        applyText(message.text, message.snapshot);
        sendResponse({ ok: true });
      }
    } catch (error) {
      sendResponse({ ok: false, error: error.message });
    }
    return true;
  });
})();

