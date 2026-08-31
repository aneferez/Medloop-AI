-- Server-side identity (Module A hardening). Adds real user accounts with
-- credentials, email verification, and password reset — WITHOUT breaking the
-- existing device-session token auth. Legacy device-token accounts keep working
-- with a NULL owner_user_id; only new /auth/signup accounts get a users row.

CREATE TABLE IF NOT EXISTS users (
  id                  TEXT PRIMARY KEY,
  email               TEXT NOT NULL UNIQUE,          -- credential key, lowercased
  password_hash       TEXT,                          -- PBKDF2-SHA256 hex digest
  password_salt       TEXT,                          -- base64 salt
  password_algo       TEXT,                          -- e.g. 'pbkdf2-sha256'
  password_iterations INTEGER,
  email_verified      INTEGER NOT NULL DEFAULT 0,
  display_name        TEXT NOT NULL DEFAULT '',
  status              TEXT NOT NULL DEFAULT 'active', -- active | disabled
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

-- Bridge existing account rows to a user; device-token auth still works because
-- these columns are nullable and default NULL.
ALTER TABLE patients ADD COLUMN owner_user_id TEXT REFERENCES users(id);
ALTER TABLE devices  ADD COLUMN user_id       TEXT REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_patients_owner ON patients(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_devices_user   ON devices(user_id);

-- Single-use email tokens for verification + password reset. Stored only as a
-- SHA-256 hash, exactly like device tokens and pairing codes, so a database leak
-- never exposes a usable link.
CREATE TABLE IF NOT EXISTS email_tokens (
  token_hash  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose     TEXT NOT NULL,                     -- verify_email | reset_password
  expires_at  TEXT NOT NULL,
  consumed_at TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_tokens(user_id, purpose);
CREATE INDEX IF NOT EXISTS idx_email_tokens_expiry ON email_tokens(expires_at);
