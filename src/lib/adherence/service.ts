import { z } from "zod";
import type { Opportunity } from "../domain";
import { pncpIdSchema } from "../domain";
import { analysisResultSchema } from "../analysis";
import { modelOutputSchema, OUTPUT_SCHEMA_VERSION, type AdherenceProvider, type AnalysisRecord, type AnalysisView, type EvidencePromptSection, type EvidenceValidator, type ExecutionRecorder, type InputIdentity, type SemanticDecision } from "./contracts";
import { AdherenceError, safeFailure } from "./errors";
import { canonicalJson, contentHash, prepareInputs } from "./inputs";
import { composePrompt } from "./prompt";
import { AdherenceRepository, type HumanReview } from "./repository";

const semanticDecisionSchema = z.object({ status: z.enum(["approved", "rejected", "unavailable"]), codes: z.array(z.string().regex(/^[a-z][a-z0-9_.-]{0,63}$/)).max(20) });
const MAX_RAW_RESPONSE_CHARS = 32000;
async function withDeadline<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([work, new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("deadline")), timeoutMs); })]); }
  finally { clearTimeout(timer); }
}
export type AdherenceIntegrations = { evidenceValidator?: EvidenceValidator; evidencePrompt?: EvidencePromptSection; executionRecorder?: ExecutionRecorder };
export class OpportunityAdherenceService {
  private readonly prompt;
  private readonly schemaHash = contentHash(z.toJSONSchema(modelOutputSchema));
  constructor(readonly repository: AdherenceRepository, private readonly provider: AdherenceProvider, private readonly integrations: AdherenceIntegrations = {}, private readonly now: () => number = Date.now) {
    this.prompt = composePrompt(integrations.evidencePrompt);
  }
  private identity(id: string): InputIdentity {
    pncpIdSchema.parse(id);
    const item = this.repository.store.getOpportunity(id);
    if (!item) throw new AdherenceError("not_found");
    return this.identityFor(item);
  }
  private identityFor(item: Opportunity): InputIdentity {
    return prepareInputs(this.repository.store.getProfile(), item, this.provider.settings, this.prompt, OUTPUT_SCHEMA_VERSION, this.schemaHash);
  }
  private validationCurrent(record: AnalysisRecord): boolean {
    return record.status === "validated" && record.validation.status === "approved" && !!record.evidenceValidatedAt && (!this.integrations.evidenceValidator || record.validation.version === this.integrations.evidenceValidator.version);
  }
  private choose(identity: InputIdentity): AnalysisRecord | null {
    const id = identity.inputs.opportunity.id;
    return this.repository.reusable(id, identity.inputHash) ?? this.repository.latest(id, identity.inputHash) ?? this.repository.latest(id);
  }
  private toView(identity: InputIdentity, record: AnalysisRecord | null): AnalysisView {
    let state: AnalysisView["state"] = !this.provider.configured ? "not_configured" : "not_analyzed";
    const stale = record !== null && record.inputHash !== identity.inputHash;
    if (record) state = stale ? "stale" : record.status === "validated" && !this.validationCurrent(record) ? "pending_validation" : record.status;
    const result = record?.result;
    return {
      state, configured: this.provider.configured,
      canValidate: Boolean(this.integrations.evidenceValidator && record?.structurallyValidatedAt && result && !stale && record.status !== "processing"),
      analysisId: record?.id ?? null, analyzedAt: result?.analyzedAt ?? null,
      result: result ? { classification: result.classification, justification: result.justification, matchedCriteria: result.matchedCriteria, conflictingCriteria: result.conflictingCriteria, model: result.model } : null,
      failure: record?.failure ?? (this.provider.configurationFailure ? { code: this.provider.configurationFailure, retryable: false } : null),
      stages: { responseReceived: Boolean(record?.responseReceivedAt), structureApproved: Boolean(record?.structurallyValidatedAt), evidenceApproved: !!record && !stale && this.validationCurrent(record) },
    };
  }
  getView(id: string): AnalysisView {
    const identity = this.identity(id);
    this.repository.recoverExpired(id, this.now());
    return this.toView(identity, this.choose(identity));
  }
  getViews(items: Opportunity[]): Record<string, AnalysisView> {
    return Object.fromEntries(items.map((item) => {
      const identity = this.identityFor(item);
      this.repository.recoverExpired(item.id, this.now());
      return [item.id, this.toView(identity, this.choose(identity))];
    }));
  }
  review(id: string, analysisId: string, decision: HumanReview["decision"], note: string): HumanReview {
    const view = this.getView(id);
    if (view.state !== "validated" || view.analysisId !== analysisId) throw new AdherenceError("stale");
    const record = this.repository.get(analysisId);
    if (!record?.result) throw new AdherenceError("not_found");
    return this.repository.saveReview(record, decision, note);
  }
  async analyze(id: string): Promise<AnalysisView> {
    const identity = this.identity(id);
    this.repository.recoverExpired(id, this.now());
    const existing = this.choose(identity);
    if (existing?.inputHash === identity.inputHash) {
      if (this.validationCurrent(existing) || existing.status === "processing") return this.toView(identity, existing);
      if (existing.result && (existing.status === "pending_validation" || existing.status === "validated")) return this.revalidate(id, existing.id);
    }
    if (!this.provider.configured) return { ...this.toView(identity, existing), state: "not_configured" };
    const claim = this.repository.claimGeneration(identity, this.provider.settings, this.prompt.version, OUTPUT_SCHEMA_VERSION, this.now(), this.provider.settings.deadlineMs + 15000);
    if (claim.busy) return { ...this.toView(identity, claim.record), state: "processing" };
    if (!claim.created || !claim.token) return this.revalidate(id, claim.record.id);
    const { record, token } = claim;
    try {
      if (identity.inputBytes > this.provider.settings.maxInputBytes) throw new AdherenceError("input_too_large");
      const response = await this.provider.generate({ instructions: this.prompt.instructions, data: canonicalJson(identity.inputs) });
      record.metadata = response.metadata;
      record.responseReceivedAt = new Date(this.now()).toISOString();
      record.rawResponse = response.text.slice(0, MAX_RAW_RESPONSE_CHARS);
      record.rawResponseLimited = response.text.length > MAX_RAW_RESPONSE_CHARS;
      if (!this.repository.saveOwned(record, token, this.now())) return this.getView(id);
      if (response.disposition !== "completed") throw new AdherenceError(response.disposition === "refused" ? "refusal" : "incomplete", false, response.metadata);
      if (record.rawResponseLimited) throw new AdherenceError("output_too_large");
      let raw: unknown;
      try { raw = JSON.parse(response.text); } catch { throw new AdherenceError("invalid_output"); }
      const parsed = modelOutputSchema.safeParse(raw);
      if (!parsed.success) throw new AdherenceError("invalid_output");
      const serverFields = { model: response.metadata.model, promptVersion: this.prompt.version, analyzedAt: record.responseReceivedAt, profileVersion: identity.inputs.profile.version, opportunityId: id, opportunityHash: identity.opportunityHash };
      const result = analysisResultSchema.safeParse({ ...parsed.data, ...serverFields });
      if (!result.success) throw new AdherenceError("invalid_output");
      record.result = { ...result.data, matchedCriteria: parsed.data.matchedCriteria, conflictingCriteria: parsed.data.conflictingCriteria };
      record.structurallyValidatedAt = new Date(this.now()).toISOString();
      record.status = "pending_validation";
      if (!this.repository.saveOwned(record, token, this.now())) return this.getView(id);
      await this.validate(record);
    } catch (error) {
      record.status = "failed";
      record.failure = safeFailure(error);
      if (error instanceof AdherenceError && error.metadata) record.metadata = error.metadata;
    }
    record.finishedAt = new Date(this.now()).toISOString();
    if (this.repository.saveOwned(record, token, this.now(), true)) await this.recordExecution(record, "generation", record.startedAt);
    return this.getView(id);
  }
  private async validate(record: AnalysisRecord): Promise<void> {
    const validator = this.integrations.evidenceValidator;
    let decision: SemanticDecision = { status: "unavailable", codes: ["validator_not_integrated"] };
    if (validator && record.result) {
      try {
        const result = await withDeadline(validator.validate({ analysisId: record.id, inputs: structuredClone(record.identity.inputs), result: structuredClone(record.result) }), 5000);
        const parsed = semanticDecisionSchema.safeParse(result);
        decision = parsed.success ? parsed.data : { status: "unavailable", codes: ["validator_invalid_response"] };
      } catch { decision = { status: "unavailable", codes: ["validator_unavailable"] }; }
    }
    record.validation = { version: validator?.version ?? null, status: decision.status === "unavailable" ? "pending" : decision.status, codes: decision.codes };
    record.status = decision.status === "approved" ? "validated" : decision.status === "rejected" ? "rejected" : "pending_validation";
    record.evidenceValidatedAt = decision.status === "unavailable" ? null : new Date(this.now()).toISOString();
  }
  async revalidate(id: string, analysisId: string): Promise<AnalysisView> {
    const identity = this.identity(id);
    const stored = this.repository.get(analysisId);
    if (!stored || stored.opportunityId !== id) throw new AdherenceError("not_found");
    if (stored.inputHash !== identity.inputHash) throw new AdherenceError("stale");
    if (!stored.result || !stored.structurallyValidatedAt || !this.integrations.evidenceValidator || this.validationCurrent(stored)) return this.getView(id);
    const claim = this.repository.claimValidation(analysisId, identity.inputHash, this.now(), 15000);
    if (!claim?.token) return this.getView(id);
    const startedAt = new Date(this.now()).toISOString();
    await this.validate(claim.record);
    claim.record.finishedAt = new Date(this.now()).toISOString();
    if (this.repository.saveOwned(claim.record, claim.token, this.now(), true)) await this.recordExecution(claim.record, "revalidation", startedAt);
    return this.getView(id);
  }
  private async recordExecution(record: AnalysisRecord, phase: "generation" | "revalidation", startedAt: string): Promise<void> {
    if (!this.integrations.executionRecorder) return;
    const finishedAt = record.finishedAt!;
    try {
      await withDeadline(this.integrations.executionRecorder.record({ eventId: `${record.id}:${phase}:${finishedAt}`, analysisId: record.id, operation: "adherence", phase, opportunityId: record.opportunityId, inputHash: record.inputHash, status: record.status, startedAt, finishedAt, durationMs: Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt)), requestedModel: record.settings.model, providerMetadata: record.metadata, failure: record.failure }), 2000);
    } catch { /* O registro compartilhado pode ser integrado depois; seu erro não altera o resultado comercial. */ }
  }
}
