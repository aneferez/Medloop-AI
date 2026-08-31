-- Family medication network (features #3/#6, task #6). Links a caregiver's USER
-- account to a patient with a scoped permission set and an alert level. The
-- patient's invite plus the caregiver's acceptance together record the consent to
-- share. Invite codes are stored only as a SHA-256 hash, like device pairing.

CREATE TABLE IF NOT EXISTS caregiver_links (
  id                 TEXT PRIMARY KEY,
  patient_id         TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  caregiver_user_id  TEXT REFERENCES users(id) ON DELETE CASCADE,          -- null until accepted
  family_member_id   TEXT REFERENCES family_members(id) ON DELETE SET NULL, -- bridges contact <-> account
  alert_level        TEXT NOT NULL DEFAULT 'Level 1',   -- Level 1 | Level 2 | Level 3
  permissions        TEXT NOT NULL DEFAULT '[]',        -- JSON array of permission strings
  status             TEXT NOT NULL DEFAULT 'pending',   -- pending | active | revoked
  invite_code_hash   TEXT,                              -- SHA-256, single-use; cleared on accept
  invited_by_user_id TEXT,
  label              TEXT NOT NULL DEFAULT '',          -- display name for the invite
  expires_at         TEXT,
  created_at         TEXT NOT NULL,
  accepted_at        TEXT,
  revoked_at         TEXT
);
CREATE INDEX IF NOT EXISTS idx_caregiver_links_patient ON caregiver_links(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_caregiver_links_user    ON caregiver_links(caregiver_user_id, status);
CREATE INDEX IF NOT EXISTS idx_caregiver_links_invite  ON caregiver_links(invite_code_hash);

-- Bridge a contact row to the caregiver's account, so escalations (feature #7)
-- can reach the caregiver on their OWN devices even when the contact row itself
-- has no push token. Cleared when the link is revoked.
ALTER TABLE family_members ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_family_members_user ON family_members(user_id);
