import assert from "node:assert/strict";
import test from "node:test";
import { modelOutputSchema } from "../src/lib/adherence/contracts";

const valid = {
  classification: "possivel_aderencia",
  justification: "Compatibilidade inicial.",
  matchedCriteria: [], conflictingCriteria: [],
  evidence: [{ field: "description", excerpt: "computadores" }], missingInformation: [],
};

test("contrato aceita os campos atuais e recusa saídas inválidas do modelo", () => {
  assert.equal(modelOutputSchema.safeParse(valid).success, true);
  for (const invalid of [
    { ...valid, evidence: [{ field: "additionalInformation", excerpt: "computadores" }] },
    { ...valid, evidence: [{ field: "description", excerpt: "" }] },
    { ...valid, evidence: Array.from({ length: 21 }, () => valid.evidence[0]) },
    { ...valid, missingInformation: Array.from({ length: 31 }, () => "lacuna") },
    { ...valid, justification: "x".repeat(5001) },
    { ...valid, classification: "aprovado" },
    { ...valid, model: "modelo escolhido pelo usuário" },
  ]) assert.equal(modelOutputSchema.safeParse(invalid).success, false);
});
