import type { EvidenceValidator } from "./contracts";

export const evidenceValidator: EvidenceValidator = {
  version: "evidence-literal.v1",
  async validate({ inputs, result }) {
    const description = inputs.opportunity.description;
    if (result.evidence.length > 20 || result.missingInformation.length > 30 || result.evidence.some(({ field, excerpt }) => field !== "description" || !excerpt.trim() || excerpt.length > 2000 || !description?.includes(excerpt))) {
      return { status: "rejected", codes: ["evidence_not_found"] };
    }
    if (result.evidence.length === 0 && (result.classification !== "precisa_de_revisao" || !result.missingInformation.some((item) => item.trim() && item.length <= 1000))) {
      return { status: "rejected", codes: ["evidence_missing"] };
    }
    return { status: "approved", codes: [] };
  },
};
