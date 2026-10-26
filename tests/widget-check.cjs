const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class FakeElement {
  constructor() {
    this.style = {};
    this.hidden = false;
    this.value = '';
    this.isConnected = true;
    this.listeners = new Map();
    const classes = new Set();
    this.classList = {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
      toggle: (name, force) => force ? classes.add(name) : classes.delete(name)
    };
  }
  addEventListener(name, handler) { this.listeners.set(name, handler); }
  fire(name, event = {}) { this.listeners.get(name)?.({ target: this, currentTarget: this, ...event }); }
  getBoundingClientRect() { return { width: this.classList.contains('expanded') ? 350 : 40, height: this.classList.contains('expanded') ? 300 : 40 }; }
  setPointerCapture() {}
}

const controls = Object.fromEntries([
  '.bubble', '.panel', '.status', '.suggestion-wrap', '.suggestion', '.generate',
  '.auto', '.auto-apply', '.instruction', '.header', '.minimize', '.hide-widget',
  '.discard', '.apply'
].map((name) => [name, new FakeElement()]));
controls['.panel'].hidden = true;
controls['.suggestion-wrap'].hidden = true;
controls['.instruction'].value = 'professional';

const shadow = { querySelector: (selector) => controls[selector] };
const host = new FakeElement();
host.attachShadow = () => shadow;
const docListeners = new Map();
const winListeners = new Map();
const timers = new Map();
let nextTimer = 1;
let aiCalls = 0;
const field = { isConnected: true, value: '', focus() {} };
const editor = {
  readText: () => ({ text: field.value, selectedOnly: false, start: 0, end: field.value.length }),
  getActiveElement: () => field,
  getLastRange: () => null,
  isAutoEditable: (element) => element === field,
  applyText: (text) => { field.value = text; }
};
const document = {
  documentElement: { appendChild() {} },
  visibilityState: 'visible',
  createElement: () => host,
  addEventListener: (name, handler) => docListeners.set(name, handler)
};
const window = {
  innerWidth: 1200,
  innerHeight: 800,
  __braveTextAssistantApi: editor,
  addEventListener: (name, handler) => winListeners.set(name, handler)
};
const chrome = {
  runtime: {
    onMessage: { addListener() {} },
    getURL: (path) => path,
    sendMessage: async (message) => {
      if (message.type === 'GET_WIDGET_CONFIG') return {
        ok: true, configured: true, autoEnabled: true, autoApplyEnabled: false,
        widgetEnabled: true, widgetInstruction: 'professional', widgetPosition: null
      };
      if (message.type === 'SET_WIDGET_PREFS') return { ok: true };
      if (message.type === 'AI_REWRITE') {
        aiCalls += 1;
        if (aiCalls === 7) return new Promise(() => {});
        return { ok: true, suggestion: `Revisado ${aiCalls}` };
      }
      throw new Error(`Mensagem inesperada: ${message.type}`);
    }
  },
  storage: { onChanged: { addListener() {} } }
};
const setTimeoutFake = (callback, delay) => { const id = nextTimer++; timers.set(id, { callback, delay }); return id; };
const clearTimeoutFake = (id) => timers.delete(id);

vm.runInNewContext(fs.readFileSync('brave-text-assistant/widget.js', 'utf8'), {
  window, document, chrome,
  setTimeout: setTimeoutFake,
  clearTimeout: clearTimeoutFake,
  requestAnimationFrame: (callback) => callback(),
  console
});

const flush = async () => { await new Promise(setImmediate); await new Promise(setImmediate); };
const runIdle = async () => {
  const entry = [...timers.entries()].find(([, timer]) => timer.delay < 40000);
  assert.ok(entry, 'A sugestão automática deve estar agendada');
  timers.delete(entry[0]);
  entry[1].callback();
  await flush();
};
const input = (text) => {
  field.value = text;
  docListeners.get('input')({ target: field, isTrusted: true });
};

(async () => {
  await flush();
  assert.equal(controls['.auto-apply'].checked, false, 'Aplicação automática começa desligada');

  input('Este é um texto suficientemente longo para receber uma sugestão automática.');
  await runIdle();
  assert.equal(host.classList.contains('expanded'), true, 'Sugestão abre painel minimizado');
  controls['.apply'].fire('click');
  assert.equal(field.value, 'Revisado 1');
  assert.equal(host.classList.contains('expanded'), false, 'Aplicar recolhe painel aberto automaticamente');

  controls['.bubble'].fire('click', { detail: 0 });
  input('Outro texto suficientemente longo para receber uma segunda sugestão.');
  await runIdle();
  controls['.discard'].fire('click');
  assert.equal(host.classList.contains('expanded'), true, 'Descartar preserva painel aberto pelo usuário');

  controls['.auto-apply'].checked = true;
  controls['.auto-apply'].fire('change');
  input('Um terceiro texto suficientemente longo para aplicação automática.');
  await runIdle();
  assert.equal(field.value, 'Revisado 3', 'Modo automático aplica sem clique');
  assert.equal(host.classList.contains('expanded'), true, 'Aplicação automática preserva painel expandido');

  controls['.minimize'].fire('click');
  input('Texto longo suficiente para confirmar aplicação sem abrir o painel minimizado.');
  await runIdle();
  assert.equal(field.value, 'Revisado 4');
  assert.equal(host.classList.contains('expanded'), false, 'Aplicação automática preserva painel minimizado');

  controls['.bubble'].fire('click', { detail: 0 });
  controls['.auto-apply'].checked = false;
  controls['.auto-apply'].fire('change');
  controls['.minimize'].fire('click');
  input('Texto longo para confirmar que Descartar também recolhe o painel automático.');
  await runIdle();
  assert.equal(host.classList.contains('expanded'), true);
  controls['.discard'].fire('click');
  assert.equal(host.classList.contains('expanded'), false, 'Descartar recolhe painel aberto automaticamente');

  input('Texto escrito antes de alternar para outra janela e voltar depois.');
  document.visibilityState = 'hidden';
  docListeners.get('visibilitychange')();
  assert.equal([...timers.values()].some((timer) => timer.delay < 40000), false, 'Saída cancela o agendamento');
  document.visibilityState = 'visible';
  docListeners.get('visibilitychange')();
  await runIdle();
  assert.equal(aiCalls, 6, 'Retorno à página retoma as sugestões');
  assert.equal(host.classList.contains('expanded'), true, 'A sugestão retomada aparece no painel');

  controls['.discard'].fire('click');
  input('Texto novo para verificar a recuperação de uma chamada que não responde.');
  await runIdle();
  document.visibilityState = 'hidden';
  docListeners.get('visibilitychange')();
  document.visibilityState = 'visible';
  docListeners.get('visibilitychange')();
  const timeout = [...timers.entries()].find(([, timer]) => timer.delay === 45000);
  assert.ok(timeout, 'Chamada pendente tem limite de espera');
  timers.delete(timeout[0]);
  timeout[1].callback();
  await flush();
  await runIdle();
  assert.equal(aiCalls, 8, 'Retorno tenta novamente após chamada sem resposta');
  console.log('Fluxos do widget conferidos.');
})().catch((error) => { console.error(error); process.exitCode = 1; });

