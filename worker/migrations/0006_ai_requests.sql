-- MedLoop AI assistant audit + rate limiting (feature #8, tasks #32-35). One row
-- per request; the token-bucket rate limit counts recent rows per user. Stores
-- ONLY metadata — never the prompt or the response text (guardrail G3).

CREATE TABLE IF NOT EXISTS ai_requests (
  id          TEXT PRIMARY KEY,
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  patient_id  TEXT REFERENCES patients(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,   -- simplify | assistant
  status      TEXT NOT NULL,   -- ok | rejected | error | rate_limited
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_requests_user    ON ai_requests(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_requests_patient ON ai_requests(patient_id, created_at);
