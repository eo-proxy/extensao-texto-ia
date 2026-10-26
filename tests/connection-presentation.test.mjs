import test from "node:test";
import assert from "node:assert/strict";
import { connectionPresentation } from "../brave-text-assistant/connection-presentation.mjs";
const profile = { apiKey: "test-key", model: "gemini-test", revision: "current", verifiedAt: null };
const diagnostic = { model: "gemini-test", revision: "current", durationMs: 1250, httpStatus: 200, code: "OK" };
test("Sem chave ou sem autorização, status é Desconectado", () => {
  assert.equal(connectionPresentation(null, true, null).label, "Desconectado");
  assert.equal(connectionPresentation(profile, false, diagnostic).connected, false);
});
test("Configuração ainda não testada não mostra conexão verde", () => {
  const state = connectionPresentation(profile, true, null);
  assert.equal(state.connected, false);
  assert.equal(state.diagnosticState, "");
});
test("Resposta positiva mostra Conectado e diagnóstico verde", () => {
  const state = connectionPresentation(profile, true, diagnostic);
  assert.equal(state.label, "Conectado");
  assert.equal(state.diagnosticState, "success");
  assert.match(state.diagnosticText, /1.3 s/);
});
test("Falha atual deixa status e diagnóstico vermelhos mesmo após teste positivo anterior", () => {
  const state = connectionPresentation({ ...profile, verifiedAt: 123 }, true, { ...diagnostic, code: "OVERLOADED", httpStatus: 503 });
  assert.equal(state.label, "Desconectado");
  assert.equal(state.diagnosticState, "error");
  assert.match(state.diagnosticText, /503/);
});
test("Resultado de outra chave ou modelo não confirma nem invalida a conexão atual", () => {
  assert.equal(connectionPresentation(profile, true, { ...diagnostic, revision: "old" }).connected, false);
  assert.equal(connectionPresentation(profile, true, { ...diagnostic, model: "old-model" }).diagnosticState, "");
});
test("Texto público de conexão nunca inclui a chave", () => {
  const state = connectionPresentation(profile, true, diagnostic);
  assert.ok(!JSON.stringify(state).includes("test-key"));
});

