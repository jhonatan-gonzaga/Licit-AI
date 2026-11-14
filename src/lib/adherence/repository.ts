import { randomUUID } from "node:crypto";
import type { Store } from "../db";
import type { AnalysisRecord, InputIdentity, ProviderSettings } from "./contracts";
import { ADHERENCE_MIGRATION_NAME, ADHERENCE_MIGRATION_SQL } from "./migrations/001-adherence";
import { REVIEW_MIGRATION_NAME, REVIEW_MIGRATION_SQL } from "./migrations/002-review";

export type HumanReview = { id: string; analysisId: string; inputHash: string; decision: "agree" | "disagree"; note: string; createdAt: string };

export type AnalysisClaim = { record: AnalysisRecord; token: string | null; created: boolean; busy: boolean };
export class AdherenceRepository {
  constructor(readonly store: Store) {
    this.transaction(() => {
      store.db.exec(ADHERENCE_MIGRATION_SQL);
      store.db.prepare("INSERT OR IGNORE INTO adherence_migrations(name,applied_at) VALUES (?,?)").run(ADHERENCE_MIGRATION_NAME, new Date().toISOString());
      store.db.exec(REVIEW_MIGRATION_SQL);
      store.db.prepare("INSERT OR IGNORE INTO adherence_migrations(name,applied_at) VALUES (?,?)").run(REVIEW_MIGRATION_NAME, new Date().toISOString());
    });
  }
  private transaction<T>(work: () => T): T {
    this.store.db.exec("BEGIN IMMEDIATE");
    try { const result = work(); this.store.db.exec("COMMIT"); return result; }
    catch (error) { this.store.db.exec("ROLLBACK"); throw error; }
  }
  private read(row: { payload_json: unknown } | undefined): AnalysisRecord | null {
    return row ? JSON.parse(String(row.payload_json)) : null;
  }
  get(id: string): AnalysisRecord | null {
    return this.read(this.store.db.prepare("SELECT payload_json FROM adherence_analyses WHERE id=?").get(id) as { payload_json: unknown } | undefined);
  }
  latest(opportunityId: string, inputHash?: string): AnalysisRecord | null {
    const row = inputHash
      ? this.store.db.prepare("SELECT payload_json FROM adherence_analyses WHERE opportunity_id=? AND input_hash=? ORDER BY rowid DESC LIMIT 1").get(opportunityId, inputHash)
      : this.store.db.prepare("SELECT payload_json FROM adherence_analyses WHERE opportunity_id=? ORDER BY rowid DESC LIMIT 1").get(opportunityId);
    return this.read(row as { payload_json: unknown } | undefined);
  }
  reusable(opportunityId: string, inputHash: string): AnalysisRecord | null {
    return this.read(this.store.db.prepare("SELECT payload_json FROM adherence_analyses WHERE opportunity_id=? AND input_hash=? AND status='validated' ORDER BY rowid DESC LIMIT 1").get(opportunityId, inputHash) as { payload_json: unknown } | undefined);
  }
  history(opportunityId: string, limit = 20): AnalysisRecord[] {
    return this.store.db.prepare("SELECT payload_json FROM adherence_analyses WHERE opportunity_id=? ORDER BY rowid DESC LIMIT ?").all(opportunityId, Math.max(1, Math.min(limit, 100))).map((row) => JSON.parse(String(row.payload_json)));
  }
  reviews(analysisId: string): HumanReview[] {
    return this.store.db.prepare("SELECT id,analysis_id,input_hash,decision,note,created_at FROM adherence_reviews WHERE analysis_id=? ORDER BY created_at DESC, rowid DESC LIMIT 30").all(analysisId).map((row) => ({ id: String(row.id), analysisId: String(row.analysis_id), inputHash: String(row.input_hash), decision: row.decision as HumanReview["decision"], note: String(row.note), createdAt: String(row.created_at) }));
  }
  saveReview(record: AnalysisRecord, decision: HumanReview["decision"], note: string): HumanReview {
    if (record.status !== "validated" || record.validation.status !== "approved") throw new Error("Evidências ainda não aprovadas.");
    if (decision === "disagree" && !note.trim()) throw new Error("Explique a discordância.");
    const review = { id: randomUUID(), analysisId: record.id, inputHash: record.inputHash, decision, note, createdAt: new Date().toISOString() };
    this.store.db.prepare("INSERT INTO adherence_reviews(id,analysis_id,input_hash,decision,note,created_at) VALUES (?,?,?,?,?,?)").run(review.id, review.analysisId, review.inputHash, review.decision, review.note, review.createdAt);
    return review;
  }
  private write(record: AnalysisRecord) {
    this.store.db.prepare("UPDATE adherence_analyses SET status=?,payload_json=? WHERE id=?").run(record.status, JSON.stringify(record), record.id);
  }
  private expireInside(opportunityId: string, now: number) {
    const expired = this.store.db.prepare("SELECT analysis_id FROM adherence_locks WHERE opportunity_id=? AND expires_at<=?").get(opportunityId, now);
    if (!expired) return;
    const record = this.get(String(expired.analysis_id));
    if (record?.status === "processing") {
      record.status = "failed";
      record.failure = { code: "interrupted", retryable: true };
      record.finishedAt = new Date(now).toISOString();
      this.write(record);
    }
    this.store.db.prepare("DELETE FROM adherence_locks WHERE opportunity_id=? AND expires_at<=?").run(opportunityId, now);
  }
  recoverExpired(opportunityId: string, now: number): void {
    this.transaction(() => this.expireInside(opportunityId, now));
  }
  private active(opportunityId: string): AnalysisRecord | null {
    const row = this.store.db.prepare("SELECT a.payload_json FROM adherence_locks l JOIN adherence_analyses a ON a.id=l.analysis_id WHERE l.opportunity_id=?").get(opportunityId);
    return this.read(row as { payload_json: unknown } | undefined);
  }
  claimGeneration(identity: InputIdentity, settings: ProviderSettings, promptVersion: string, schemaVersion: string, now: number, leaseMs: number): AnalysisClaim {
    return this.transaction(() => {
      const opportunityId = identity.inputs.opportunity.id;
      this.expireInside(opportunityId, now);
      const active = this.active(opportunityId);
      if (active) return { record: active, token: null, created: false, busy: true };
      // Refaz a consulta dentro da transação para evitar corrida entre processos.
      const existing = this.reusable(opportunityId, identity.inputHash) ?? this.latest(opportunityId, identity.inputHash);
      if (existing?.result && (existing.status === "validated" || existing.status === "pending_validation")) return { record: existing, token: null, created: false, busy: false };
      const record: AnalysisRecord = {
        id: randomUUID(), opportunityId, inputHash: identity.inputHash, identity, settings: { ...settings }, promptVersion, schemaVersion,
        status: "processing", startedAt: new Date(now).toISOString(), finishedAt: null,
        responseReceivedAt: null, structurallyValidatedAt: null, evidenceValidatedAt: null,
        rawResponse: null, rawResponseLimited: false, result: null, metadata: null, failure: null,
        validation: { version: null, status: "pending", codes: ["validator_not_integrated"] },
      };
      this.store.db.prepare("INSERT INTO adherence_analyses(id,opportunity_id,input_hash,status,payload_json) VALUES (?,?,?,?,?)").run(record.id, opportunityId, record.inputHash, record.status, JSON.stringify(record));
      const token = randomUUID();
      this.store.db.prepare("INSERT INTO adherence_locks(opportunity_id,analysis_id,token,expires_at) VALUES (?,?,?,?)").run(opportunityId, record.id, token, now + leaseMs);
      return { record, token, created: true, busy: false };
    });
  }
  claimValidation(recordId: string, inputHash: string, now: number, leaseMs: number): AnalysisClaim | null {
    return this.transaction(() => {
      const record = this.get(recordId);
      if (!record || record.inputHash !== inputHash || !record.result || !record.structurallyValidatedAt) return null;
      this.expireInside(record.opportunityId, now);
      const active = this.active(record.opportunityId);
      if (active) return { record: active, token: null, created: false, busy: true };
      const token = randomUUID();
      this.store.db.prepare("INSERT INTO adherence_locks(opportunity_id,analysis_id,token,expires_at) VALUES (?,?,?,?)").run(record.opportunityId, record.id, token, now + leaseMs);
      return { record, token, created: false, busy: false };
    });
  }
  saveOwned(record: AnalysisRecord, token: string, now: number, release = false): boolean {
    return this.transaction(() => {
      const lock = this.store.db.prepare("SELECT token FROM adherence_locks WHERE opportunity_id=? AND analysis_id=? AND token=? AND expires_at>?").get(record.opportunityId, record.id, token, now);
      if (!lock) return false;
      this.write(record);
      if (release) this.store.db.prepare("DELETE FROM adherence_locks WHERE token=?").run(token);
      return true;
    });
  }
}
