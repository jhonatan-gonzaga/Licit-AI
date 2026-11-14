import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { evidenceValidator } from "../src/lib/adherence/evidence";
import type { AdherenceResult, AnalysisInputs } from "../src/lib/adherence/contracts";
const result: AdherenceResult = {classification:"possivel_aderencia",justification:"Teste",evidence:[],missingInformation:[],matchedCriteria:[],conflictingCriteria:[],model:"teste",promptVersion:"teste",analyzedAt:"2026-11-12T12:00:00Z",profileVersion:1,opportunityId:"07722779000106-1-000144/2026",opportunityHash:"0".repeat(64)};
test("cinco casos públicos citam trechos literais da amostra", async () => {
  const sample = JSON.parse(readFileSync(new URL("../data/pncp-sample.json", import.meta.url), "utf8"));
  const evaluation = JSON.parse(readFileSync(new URL("../docs/evaluations/evidence-cases.json", import.meta.url), "utf8"));
  assert.equal(evaluation.cases.length, 5);
  for (const item of evaluation.cases) {
    const record = sample.records.find((value: { numeroControlePNCP: string }) => value.numeroControlePNCP === item.opportunityId);
    assert.ok(record, item.opportunityId);
    if (item.excerpt !== null) assert.ok(record.objetoCompra.includes(item.excerpt), item.opportunityId);
    const decision = await evidenceValidator.validate({
      analysisId: "simulado", inputs: { opportunity: { description: record.objetoCompra } } as AnalysisInputs,
      result: { ...result, opportunityId: item.opportunityId, classification: item.proposedClassification,
        evidence: item.excerpt === null ? [] : [{ field: "description", excerpt: item.excerpt }], missingInformation: item.missingInformation },
    });
    assert.equal(decision.status, item.expectedValidation, item.opportunityId);
  }
});
