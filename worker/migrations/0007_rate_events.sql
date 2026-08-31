-- Rate-limit event log (hardening, task #4/#35-adjacent). One row per allowed
-- request under an opaque bucket key (e.g. 'login:alice@example.com'); the
-- limiter counts rows in a fixed window. Best-effort cleanup can prune old rows;
-- the window predicate keeps stale rows from affecting decisions regardless.

CREATE TABLE IF NOT EXISTS rate_events (
  id         TEXT PRIMARY KEY,
  bucket     TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_events_bucket ON rate_events(bucket, created_at);
