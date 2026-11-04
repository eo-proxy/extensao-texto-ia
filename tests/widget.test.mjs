import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const source = fs.readFileSync(new URL("../brave-text-assistant/widget.js", import.meta.url), "utf8");
class Element {
  constructor() {
    this.style = { setProperty(name, value) { this[name] = value; } }; this.hidden = false; this.value = ""; this.isConnected = true; this.listeners = new Map();
    const classes = new Set();
    this.classList = { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c), toggle: (c, on) => on ? classes.add(c) : classes.delete(c) };
  }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  fire(name, data = {}) { return this.listeners.get(name)?.({ target: this, currentTarget: this, isTrusted: true, ...data }); }
  getBoundingClientRect() { return { width: this.classList.contains("expanded") ? 350 : 40, height: this.classList.contains("expanded") ? 300 : 40 }; }
}
const flush = async () => { await new Promise(setImmediate); await new Promise(setImmediate); };
async function harness({ pending = false, siteEnabled = true, siteDecided = true, sharedPreferences = null, failSiteSave = false, autoEditable = true } = {}) {
  const controls = Object.fromEntries([".bubble", ".panel", ".status", ".suggestion-wrap", ".suggestion", ".generate", ".auto", ".auto-apply", ".instruction", ".header", ".minimize", ".hide-widget", ".discard", ".apply", ".undo-actions", ".undo", ".site-prompt", ".site-enabled", ".site-label", ".site-yes", ".site-no"].map((key) => [key, new Element()]));
  controls[".site-prompt"].getBoundingClientRect = () => ({ width: 258, height: 114 });
  controls[".panel"].hidden = true; controls[".instruction"].value = "professional";
  const host = new Element(); host.attachShadow = () => ({ querySelector: (selector) => controls[selector] });
  const field = { isConnected: true, value: "" }, docListeners = {}, winListeners = {}, requests = [], cancelled = [];
  let now = 1000, timerId = 0, applied = 0, runtimeListener;
  const timers = new Map();
  const config = { ok: true, provider: "gemini", model: "gemini-3.6-flash", revision: "test", configured: true, autoEnabled: true, autoApplyEnabled: false, widgetEnabled: true, widgetInstruction: "professional" };
  let undo = null, undoSerial = 0; const historyListeners = [];
  const notifyHistory = action => historyListeners.forEach(listener => listener(action));
  let siteAccess = false, reads = 0; const siteDecisions = [];
  Object.assign(config, sharedPreferences || { siteEnabled, siteDecided, siteRevision: "site-test", siteLabel: "example.com" });
  const editor = {
    readText: () => { reads += 1; if (!siteAccess) throw Error("Site desativado."); return { text: field.value, selectedOnly: false, start: 0, end: field.value.length }; },
    setSiteAccess: enabled => { siteAccess = enabled; }, isEditable: element => element === field,
    getActiveElement: () => field, getLastRange: () => null, isAutoEditable: (element) => autoEditable && element === field,
    getUndoState: () => ({ canUndo: Boolean(undo && field.value === undo.after), undoId: undo?.id ?? null }),
    onHistoryChange: listener => { historyListeners.push(listener); },
    undoText: id => {
      if (!undo || undo.id !== id || field.value !== undo.after) throw new Error("Não há sugestão para desfazer.");
      field.value = undo.before; undo = null; notifyHistory("undone");
    },
    applyText: text => { undo = { id: ++undoSerial, before: field.value, after: text }; field.value = text; applied += 1; notifyHistory("applied"); }
  };
  const document = { documentElement: { appendChild() {} }, visibilityState: "visible", createElement: () => host, addEventListener: (name, fn) => { docListeners[name] = fn; } };
  const window = { innerWidth: 1000, innerHeight: 800, __braveTextAssistantApi: editor, addEventListener: (name, fn) => { winListeners[name] = fn; } };
  const chrome = { runtime: { id: "test-extension",
    getURL: (path) => path, onMessage: { addListener: (fn) => { runtimeListener = fn; } },
    sendMessage: async (message) => {
      if (message.type === "GET_WIDGET_CONFIG") return { ...config };
      if (message.type === "SET_SITE_PREFERENCE") {
        siteDecisions.push(message.enabled);
        if (failSiteSave) return { ok: false, error: "Falha ao salvar." };
        const preference = { siteEnabled: message.enabled, siteDecided: true, siteRevision: "site-" + siteDecisions.length, siteLabel: "example.com" };
        Object.assign(config, preference); if (sharedPreferences) Object.assign(sharedPreferences, preference);
        return { ok: true, ...preference };
      }
      if (message.type === "SET_WIDGET_PREFS") { Object.assign(config, message); return { ok: true }; }
      if (message.type === "CANCEL_REWRITE") { cancelled.push(message.requestId); return { ok: true }; }
      if (message.type === "AI_REWRITE") {
        const item = { message };
        requests.push(item);
        if (pending) return new Promise((resolve) => { item.resolve = resolve; });
        return { ok: true, suggestion: "Revisado " + requests.length };
      }
      throw new Error("Mensagem inesperada");
    }
  } };
  vm.runInNewContext(source, {
    document, window, chrome, Date: { now: () => now }, console,
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout: (id) => timers.delete(id), requestAnimationFrame: (callback) => callback()
  });
  await flush();
  return {
    controls, field, requests, cancelled, config, host, siteDecisions, get reads() { return reads; }, get applied() { return applied; },
    input(text, isTrusted = true) { if (isTrusted) { undo = null; notifyHistory("invalidated"); } field.value = text; docListeners.input({ target: field, isTrusted }); },
    async advance(ms) {
      const target = now + ms;
      while (true) {
        const next = [...timers.entries()].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        timers.delete(next[0]); now = next[1].at; next[1].callback(); await flush();
      }
      now = target; await flush();
    },
    visibility(value) { document.visibilityState = value; docListeners.visibilitychange(); },
    composition(type) { docListeners[type]({ target: field, isTrusted: true }); },
    async reloadConfig() { runtimeListener({ type: "WIDGET_CONFIG_CHANGED" }, { id: chrome.runtime.id }, () => {}); await flush(); },
    open() { controls[".bubble"].fire("click", { detail: 0 }); },
    expanded() { return host.classList.contains("expanded"); },
    resize() { winListeners.resize(); }, clearFromSite(text = "", fireInput = false) { field.value = text; if (fireInput) docListeners.input({ target: field, isTrusted: false }); }
  };
}
test("Revisão começa exatamente após 2,5 s, inclusive para texto curto", async () => {
  const h = await harness();
  assert.equal(h.controls[".auto-apply"].checked, false);
  h.input("Olá"); await h.advance(2499); assert.equal(h.requests.length, 0);
  await h.advance(1); assert.equal(h.requests.length, 1); assert.equal(h.expanded(), true);
});
test("Digitar novamente recolhe a sugestão e reinicia 2,5 s sem espera extra de 12 s", async () => {
  const h = await harness();
  h.input("Primeiro"); await h.advance(2500); assert.equal(h.expanded(), true);
  h.input("Segundo"); assert.equal(h.expanded(), false);
  await h.advance(2000); h.input("Terceiro");
  await h.advance(2499); assert.equal(h.requests.length, 1);
  await h.advance(1); assert.equal(h.requests.length, 2);
  assert.equal(h.requests[1].message.text, "Terceiro");
});
test("Nova digitação cancela a chamada e ignora sua resposta atrasada", async () => {
  const h = await harness({ pending: true });
  h.input("Antigo"); await h.advance(2500);
  h.input("Novo"); assert.equal(h.cancelled.length, 1);
  await h.advance(2500); assert.equal(h.requests.length, 2);
  h.requests[0].resolve({ ok: true, suggestion: "Versão antiga" }); await flush();
  assert.equal(h.expanded(), false);
  h.requests[1].resolve({ ok: true, suggestion: "Versão nova" }); await flush();
  assert.equal(h.controls[".suggestion"].value, "Versão nova"); assert.equal(h.expanded(), true);
});
test("Aplicar ou descartar recolhe o painel que abriu sozinho", async () => {
  const h = await harness();
  h.input("Primeiro"); await h.advance(2500);
  h.controls[".apply"].fire("click"); assert.equal(h.expanded(), false); assert.equal(h.applied, 1);
  h.input("Outro"); await h.advance(2500);
  h.controls[".discard"].fire("click"); assert.equal(h.expanded(), false);
});
test("Painel aberto pelo usuário após digitar permanece aberto depois da decisão", async () => {
  const h = await harness();
  h.input("Texto"); h.open(); await h.advance(2500);
  h.controls[".discard"].fire("click"); assert.equal(h.expanded(), true);
});
test("Aplicação automática exige opção e não abre painel nem cria ciclos", async () => {
  const h = await harness();
  h.controls[".auto-apply"].checked = true; h.controls[".auto-apply"].fire("change");
  h.input("Texto"); await h.advance(2500);
  assert.equal(h.applied, 1); assert.equal(h.field.value, "Revisado 1"); assert.equal(h.expanded(), false);
  await h.advance(10000); assert.equal(h.requests.length, 1);
});
test("Saiu da página: cancela; voltou: retoma o texto mais recente", async () => {
  const h = await harness({ pending: true });
  h.input("Texto"); await h.advance(2500); h.visibility("hidden");
  assert.equal(h.cancelled.length, 1); await h.advance(5000); assert.equal(h.requests.length, 1);
  h.visibility("visible"); await h.advance(2500); assert.equal(h.requests.length, 2);
});
test("Eventos sintéticos, composição e modo pausado não disparam revisões indevidas", async () => {
  const h = await harness();
  h.input("Sintético", false); await h.advance(3000); assert.equal(h.requests.length, 0);
  h.composition("compositionstart"); h.input("Compondo"); await h.advance(3000); assert.equal(h.requests.length, 0);
  h.composition("compositionend"); await h.advance(2500); assert.equal(h.requests.length, 1);
  h.controls[".auto"].checked = false; h.controls[".auto"].fire("change");
  h.input("Pausado"); await h.advance(5000); assert.equal(h.requests.length, 1);
});
test("Mudança de conexão invalida chamadas e sugestões antigas", async () => {
  const h = await harness({ pending: true });
  h.input("Texto"); await h.advance(2500);
  h.config.revision = "changed"; h.config.configured = false; await h.reloadConfig();
  assert.equal(h.cancelled.length, 1);
  h.requests[0].resolve({ ok: true, suggestion: "Antiga" }); await flush();
  assert.equal(h.expanded(), false); assert.equal(h.applied, 0);
});
test("Chamada sem resposta não bloqueia a próxima revisão", async () => {
  const h = await harness({ pending: true });
  h.input("Primeiro"); await h.advance(2500); await h.advance(30000);
  assert.equal(h.expanded(), true);
  h.input("Novo"); assert.equal(h.expanded(), false);
  await h.advance(2500); assert.equal(h.requests.length, 2);
});


test("Botão Desfazer restaura aplicação manual e não inicia outra revisão", async () => {
  const h = await harness();
  h.input("Meu texto"); await h.advance(2500); h.controls[".apply"].fire("click");
  assert.equal(h.controls[".undo-actions"].hidden, false);
  h.open(); h.controls[".undo"].fire("click");
  assert.equal(h.field.value, "Meu texto"); assert.equal(h.controls[".undo-actions"].hidden, true);
  await h.advance(10000); assert.equal(h.requests.length, 1);
});

test("Botão Desfazer também restaura uma correção aplicada automaticamente", async () => {
  const h = await harness();
  h.controls[".auto-apply"].checked = true; h.controls[".auto-apply"].fire("change");
  h.input("Meu original"); await h.advance(2500);
  assert.equal(h.field.value, "Revisado 1"); h.open(); h.controls[".undo"].fire("click");
  assert.equal(h.field.value, "Meu original");
  await h.advance(10000); assert.equal(h.requests.length, 1);
});

test("Desfazer cancela revisão em andamento e ignora a resposta atrasada", async () => {
  const h = await harness({ pending: true });
  h.input("Original"); await h.advance(2500);
  h.requests[0].resolve({ ok: true, suggestion: "Versão aplicada" }); await flush();
  h.controls[".apply"].fire("click"); h.open(); h.controls[".generate"].fire("click");
  assert.equal(h.requests.length, 2);
  h.controls[".undo"].fire("click"); assert.equal(h.field.value, "Original");
  assert.equal(h.cancelled.length, 1);
  h.requests[1].resolve({ ok: true, suggestion: "Atrasada" }); await flush();
  assert.equal(h.controls[".suggestion-wrap"].hidden, true); assert.equal(h.field.value, "Original");
});

test("Site novo mostra convite sem expandir, ler o campo ou enviar texto", async () => {
  const h = await harness({ siteEnabled: false, siteDecided: false });
  assert.equal(h.expanded(), false); assert.equal(h.controls[".site-prompt"].hidden, false);
  h.input("Não autorizado"); await h.advance(10000);
  assert.equal(h.requests.length, 0); assert.equal(h.reads, 0);
  await h.controls[".site-yes"].fire("click");
  assert.equal(h.controls[".site-prompt"].hidden, true); assert.equal(h.expanded(), false);
  h.input("Autorizado"); await h.advance(2500); assert.equal(h.requests.length, 1);
});

test("Não permanece salvo na próxima visita e checkbox permite reativar", async () => {
  const saved = { siteEnabled: false, siteDecided: false, siteRevision: "", siteLabel: "example.com" };
  const first = await harness({ sharedPreferences: saved }); await first.controls[".site-no"].fire("click");
  const second = await harness({ sharedPreferences: saved });
  assert.equal(second.controls[".site-prompt"].hidden, true); assert.equal(second.controls[".site-enabled"].checked, false);
  second.input("Texto"); await second.advance(3000); assert.equal(second.requests.length, 0);
  second.open(); second.controls[".site-enabled"].checked = true; await second.controls[".site-enabled"].fire("change");
  second.input("Novo"); await second.advance(2500); assert.equal(second.requests.length, 1);
  const third = await harness({ sharedPreferences: saved });
  assert.equal(third.controls[".site-prompt"].hidden, true); assert.equal(third.controls[".site-enabled"].checked, true);
});

test("Checkbox desativa e cancela chamada pendente sem aceitar resposta tardia", async () => {
  const h = await harness({ pending: true }); h.input("Texto"); await h.advance(2500);
  h.open(); h.controls[".site-enabled"].checked = false; await h.controls[".site-enabled"].fire("change");
  assert.equal(h.cancelled.length, 1); assert.equal(h.expanded(), false);
  h.requests[0].resolve({ ok: true, suggestion: "Antiga" }); await flush();
  assert.equal(h.expanded(), false); assert.equal(h.applied, 0);
  h.input("Outro"); await h.advance(3000); assert.equal(h.requests.length, 1);
});

test("Falha ao salvar não ativa o site e eventos artificiais não dão consentimento", async () => {
  const h = await harness({ siteEnabled: false, siteDecided: false, failSiteSave: true });
  await h.controls[".site-yes"].fire("click", { isTrusted: false }); assert.equal(h.siteDecisions.length, 0);
  await h.controls[".site-yes"].fire("click");
  assert.equal(h.controls[".site-enabled"].checked, false); assert.equal(h.controls[".site-prompt"].hidden, false);
  h.input("Texto"); await h.advance(3000); assert.equal(h.requests.length, 0);
});

test("Convite acompanha o robô e se ajusta quando falta espaço acima", async () => {
  const h = await harness({ siteEnabled: false, siteDecided: false });
  h.host.style.left = "8px"; h.host.style.top = "8px"; h.resize();
  assert.equal(h.controls[".site-prompt"].classList.contains("below"), true);
  assert.equal(h.controls[".site-prompt"].style.left, "0px");
  h.host.style.left = "952px"; h.host.style.top = "744px"; h.resize();
  assert.equal(h.controls[".site-prompt"].classList.contains("below"), false);
  assert.ok(Number.parseFloat(h.controls[".site-prompt"].style.left) < 0);
});

test("Limpeza do site, mesmo sem evento input, recolhe a sugestão", async () => {
  const h = await harness(); h.input("Texto"); await h.advance(2500); assert.equal(h.expanded(), true);
  h.clearFromSite(); await h.advance(300);
  assert.equal(h.expanded(), false); assert.equal(h.controls[".suggestion-wrap"].hidden, true);
  await h.advance(10000); assert.equal(h.requests.length, 1);
});

test("Campo esvaziado cancela revisão pendente e não reabre o painel", async () => {
  const h = await harness({ pending: true }); h.input("Texto"); await h.advance(2500);
  h.clearFromSite("", true); assert.equal(h.cancelled.length, 1);
  h.requests[0].resolve({ ok: true, suggestion: "Atrasada" }); await flush();
  assert.equal(h.expanded(), false); assert.equal(h.applied, 0);
});

test("Apagar texto de um input revisado manualmente também recolhe", async () => {
  const h = await harness({ autoEditable: false }); h.input("Texto");
  await h.controls[".generate"].fire("click"); assert.equal(h.expanded(), true);
  h.input(""); assert.equal(h.expanded(), false);
});
