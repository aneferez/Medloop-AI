-- Record consent acknowledgement server-side (task #29) and let it round-trip
-- through PUT /sync alongside the escalation timing (feature #7 / task #22).
-- Kept on patient_settings so it syncs with the rest of the settings, no new
-- table and no extra write path.

ALTER TABLE patient_settings ADD COLUMN consent_version     TEXT;
ALTER TABLE patient_settings ADD COLUMN consent_accepted_at TEXT;
