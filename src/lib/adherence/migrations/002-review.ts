export const REVIEW_MIGRATION_NAME = "adherence-002-review";
export const REVIEW_MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS adherence_reviews (
    id TEXT PRIMARY KEY,
    analysis_id TEXT NOT NULL REFERENCES adherence_analyses(id),
    input_hash TEXT NOT NULL,
    decision TEXT NOT NULL CHECK(decision IN ('agree','disagree')),
    note TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS adherence_review_history ON adherence_reviews(analysis_id, created_at);
`;
