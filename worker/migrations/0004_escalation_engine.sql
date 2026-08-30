-- Missed-dose escalation engine (feature #7 / rows #17, #21, #22). A frequent
-- cron scans for doses that passed their scheduled time without a "taken" log and
-- escalates to caregivers in stages: patient-selected Level 1 first, then Level 2.
--
-- Per-patient timing lives on patient_settings; the per-occurrence state machine
-- lives in dose_escalations, which is idempotent (one row per medicine+period+day)
-- so re-running the cron never double-notifies.

ALTER TABLE patient_settings ADD COLUMN dose_grace_minutes    INTEGER NOT NULL DEFAULT 15; -- scheduled -> Level 1
ALTER TABLE patient_settings ADD COLUMN l2_escalation_minutes INTEGER NOT NULL DEFAULT 30; -- scheduled -> Level 2
ALTER TABLE patient_settings ADD COLUMN escalation_enabled    INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS dose_escalations (
  id            TEXT PRIMARY KEY,
  patient_id    TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  medicine_id   TEXT NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  dose_period   TEXT NOT NULL,                    -- morning | afternoon | night
  dose_date     TEXT NOT NULL,                    -- YYYY-MM-DD local
  scheduled_at  TEXT NOT NULL,                    -- local wall-clock 'YYYY-MM-DDTHH:mm' (display/debug)
  stage         TEXT NOT NULL DEFAULT 'pending',  -- pending | l1_notified | l2_notified | resolved | skipped
  last_stage_at TEXT,
  resolved_at   TEXT,
  UNIQUE(patient_id, medicine_id, dose_period, dose_date)
);
CREATE INDEX IF NOT EXISTS idx_dose_escalations_patient ON dose_escalations(patient_id, dose_date);
