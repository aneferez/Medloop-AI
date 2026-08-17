-- Device pairing codes (auth hardening).
--
-- The device token is the only credential in this system and email is a label,
-- not a login, so a second device previously had no way to join an existing
-- account. A signed-in device mints a short-lived, single-use code; the new
-- device redeems it for its own device token.
--
-- The code is stored only as a SHA-256 hash, the same as device tokens, so a
-- database leak never exposes a usable pairing secret.

CREATE TABLE IF NOT EXISTS device_link_codes (
  code_hash   TEXT PRIMARY KEY,
  patient_id  TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  created_by  TEXT REFERENCES devices(id) ON DELETE SET NULL,
  expires_at  TEXT NOT NULL,
  redeemed_at TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_link_codes_patient ON device_link_codes(patient_id);
CREATE INDEX IF NOT EXISTS idx_link_codes_expiry ON device_link_codes(expires_at);
