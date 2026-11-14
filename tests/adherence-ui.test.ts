import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AnalysisState, AnalysisView } from "../src/lib/adherence/contracts";

// O render de servidor testa conteúdo e estados, sem simular layout de navegador.
const cssHook = registerHooks({ load(url, context, nextLoad) {
  return url.endsWith(".module.css") ? { format: "module", source: "export default {};", shortCircuit: true } : nextLoad(url, context);
} });
const { AdherenceContent, AnalysisStatusBadge } = await import("../src/components/adherence/view");
cssHook.deregister();
const view = (state: AnalysisState): AnalysisView => ({
  state, configured: true, canValidate: false, analysisId: "test-id", analyzedAt: "2026-11-12T21:00:00Z",
  result: { classification: "possivel_aderencia", justification: "JUSTIFICATIVA SIMULADA", matchedCriteria: ["CRITÉRIO SIMULADO"], conflictingCriteria: [], model: "test-model" },
  failure: null, stages: { responseReceived: true, structureApproved: true, evidenceApproved: state === "validated" },
});
test("listagem exibe classificação apenas para resultado atual validado", () => {
  for (const state of ["not_analyzed", "processing", "pending_validation", "stale", "failed", "rejected", "not_configured"] as const) {
    const html = renderToStaticMarkup(React.createElement(AnalysisStatusBadge, { view: view(state) }));
    assert.equal(html.includes("Possível aderência"), false, state);
  }
  assert.match(renderToStaticMarkup(React.createElement(AnalysisStatusBadge, { view: view("validated") })), /Possível aderência/);
});
test("detalhes distinguem resultado preliminar de aprovação de evidências", () => {
  const html = renderToStaticMarkup(React.createElement(AdherenceContent, { view: view("pending_validation") }));
  for (const expected of ["Resultado preliminar", "Classificação preliminar", "Resposta recebida", "Estrutura aprovada", "Evidências não aprovadas", "Critérios atendidos", "Critérios conflitantes"]) assert.ok(html.includes(expected), expected);
  assert.equal(html.includes("Classificação com evidências aprovadas"), false);
});
test("resultado desatualizado não é apresentado como classificação atual", () => {
  const html = renderToStaticMarkup(React.createElement(AdherenceContent, { view: view("stale") }));
  assert.match(html, /desatualizado/); assert.match(html, /Classificação anterior/); assert.equal(html.includes("Classificação com evidências aprovadas"), false);
});
test("falhas técnicas mostram erro seguro sem classificação comercial", () => {
  const html = renderToStaticMarkup(React.createElement(AdherenceContent, { view: { ...view("failed"), failure: { code: "timeout", retryable: true } } }));
  assert.match(html, /tempo limite/); assert.match(html, /role="alert"/); assert.equal(html.includes("Possível aderência"), false);
});
test("estado sem credencial é explícito", () => {
  const html = renderToStaticMarkup(React.createElement(AdherenceContent, { view: { ...view("not_configured"), result: null } }));
  assert.match(html, /IA não configurada/); assert.equal(html.includes("JUSTIFICATIVA SIMULADA"), false);
});
test("rejeição semântica não recebe rótulo de classificação final", () => {
  const html = renderToStaticMarkup(React.createElement(AdherenceContent, { view: view("rejected") }));
  assert.match(html, /Validação rejeitada/); assert.match(html, /Evidências reprovadas/); assert.equal(html.includes("Classificação com evidências aprovadas"), false);
});
test("texto do modelo é escapado e não vira HTML executável", () => {
  const current = view("pending_validation"); current.result!.justification = '<script>alert("teste")</script>';
  const html = renderToStaticMarkup(React.createElement(AdherenceContent, { view: current }));
  assert.equal(html.includes("<script>"), false); assert.ok(html.includes("&lt;script&gt;"));
});
