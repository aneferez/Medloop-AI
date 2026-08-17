-- MedLoop unified data layer (row #24).
-- One structured store for accounts, family, medicines, stock, dose logs,
-- alerts, notification history, emergency events, and scheduled-job runs.
-- Applied with: npm run db:migrate:local  (or db:migrate for --remote)

-- Patients: the primary MedLoop account/person using the app. Email is a label
-- for display/recovery, NOT an auth key — the device session token is the
-- credential (see devices.token_hash), so email is intentionally not unique.
CREATE TABLE IF NOT EXISTS patients (
  id           TEXT PRIMARY KEY,
  email        TEXT,
  display_name TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_patients_email ON patients(email);

-- Per-patient settings feeding the notification service (Module C) and the
-- scheduled jobs (Module E: daily_check_time = row #13, restock_day = row #12).
CREATE TABLE IF NOT EXISTS patient_settings (
  patient_id            TEXT PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
  reminder_lead_minutes INTEGER NOT NULL DEFAULT 0,
  push_enabled          INTEGER NOT NULL DEFAULT 1,
  whatsapp_enabled      INTEGER NOT NULL DEFAULT 0,
  email_enabled         INTEGER NOT NULL DEFAULT 0,
  daily_check_time      TEXT NOT NULL DEFAULT '22:00',
  restock_day           INTEGER NOT NULL DEFAULT 20,
  timezone              TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  updated_at            TEXT NOT NULL
);

-- Devices: a patient's devices. Each holds an FCM push token (Module C) and is
-- authenticated by a bearer token stored only as a SHA-256 hash.
CREATE TABLE IF NOT EXISTS devices (
  id           TEXT PRIMARY KEY,
  patient_id   TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  platform     TEXT NOT NULL DEFAULT 'android',   -- android | ios | web
  fcm_token    TEXT,
  token_hash   TEXT NOT NULL UNIQUE,
  label        TEXT NOT NULL DEFAULT '',
  last_seen_at TEXT,
  created_at   TEXT NOT NULL,
  revoked_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_devices_patient ON devices(patient_id);

-- Family members (rows #4, #5, #19): dynamic, in D1, with contact details,
-- the member's own FCM token, per-channel preferences, and a primary
-- emergency-contact flag. updated_at powers "alert the latest updated member".
CREATE TABLE IF NOT EXISTS family_members (
  id                   TEXT PRIMARY KEY,
  patient_id           TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  relationship         TEXT NOT NULL DEFAULT 'Family member',
  phone                TEXT,                       -- E.164
  whatsapp_number      TEXT,                       -- E.164
  email                TEXT,
  fcm_token            TEXT,                       -- member's own device (row #5)
  alert_level          TEXT NOT NULL DEFAULT 'Level 3',  -- Level 1 | Level 2 | Level 3
  is_primary_emergency INTEGER NOT NULL DEFAULT 0,       -- row #19
  notify_push          INTEGER NOT NULL DEFAULT 1,       -- channel prefs (row #17)
  notify_whatsapp      INTEGER NOT NULL DEFAULT 0,
  notify_email         INTEGER NOT NULL DEFAULT 0,
  notify_sms           INTEGER NOT NULL DEFAULT 0,
  age                  TEXT,
  blood_group          TEXT,
  allergies            TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_family_patient ON family_members(patient_id);
CREATE INDEX IF NOT EXISTS idx_family_updated ON family_members(patient_id, updated_at DESC);

-- Medicines (row #24) with the stock fields the engine uses (Module B:
-- rows #8, #9, #10, #11).
CREATE TABLE IF NOT EXISTS medicines (
  id                  TEXT PRIMARY KEY,
  patient_id          TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  member_id           TEXT REFERENCES family_members(id) ON DELETE SET NULL,
  name                TEXT NOT NULL,
  dosage              TEXT NOT NULL DEFAULT '',
  morning_time        TEXT,                        -- HH:mm
  afternoon_time      TEXT,
  night_time          TEXT,
  enabled_periods     TEXT NOT NULL DEFAULT '[]',  -- JSON subset of morning/afternoon/night
  important           INTEGER NOT NULL DEFAULT 0,
  refill              INTEGER NOT NULL DEFAULT 0,
  stock_remaining     INTEGER,                     -- current units (row #9)
  dose_units_per_dose REAL NOT NULL DEFAULT 1,     -- decrement per taken dose (row #9)
  stock_buffer_days   INTEGER NOT NULL DEFAULT 7,
  low_stock_threshold INTEGER,                     -- explicit units (row #10); NULL = derive
  stock_unit_label    TEXT NOT NULL DEFAULT 'tablets',
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_medicines_patient ON medicines(patient_id);

-- Dose logs (row #6 statuses, row #7 taken timestamp).
CREATE TABLE IF NOT EXISTS dose_logs (
  id             TEXT PRIMARY KEY,
  patient_id     TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  medicine_id    TEXT REFERENCES medicines(id) ON DELETE SET NULL,
  member_id      TEXT,
  medicine_name  TEXT NOT NULL DEFAULT '',
  dosage         TEXT NOT NULL DEFAULT '',
  scheduled_time TEXT,                             -- HH:mm
  dose_period    TEXT,                             -- morning | afternoon | night
  status         TEXT NOT NULL,                    -- pending | taken | missed | skipped (row #6)
  taken_at       TEXT,                             -- exact ISO timestamp (row #7)
  dose_date      TEXT NOT NULL,                    -- YYYY-MM-DD local
  stock_after    INTEGER,
  recorded_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dose_logs_patient ON dose_logs(patient_id, dose_date);
CREATE INDEX IF NOT EXISTS idx_dose_logs_medicine ON dose_logs(medicine_id);

-- Stock ledger: audit trail for the automatic stock engine (Module B).
CREATE TABLE IF NOT EXISTS stock_events (
  id            TEXT PRIMARY KEY,
  patient_id    TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  medicine_id   TEXT NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  delta         REAL NOT NULL,                     -- negative = consumed, positive = restock
  balance_after INTEGER,
  reason        TEXT NOT NULL,                     -- dose_taken | restock | manual_adjust | correction
  dose_log_id   TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stock_events_medicine ON stock_events(medicine_id, created_at DESC);

-- Prescriptions & appointments (part of the row #24 data layer). file_key
-- references an optional R2 object (row #26).
CREATE TABLE IF NOT EXISTS prescriptions (
  id         TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor     TEXT NOT NULL DEFAULT '',
  clinic     TEXT NOT NULL DEFAULT '',
  notes      TEXT NOT NULL DEFAULT '',
  file_key   TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);

CREATE TABLE IF NOT EXISTS appointments (
  id         TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor     TEXT NOT NULL DEFAULT '',
  clinic     TEXT NOT NULL DEFAULT 'Clinic',
  date       TEXT NOT NULL,                        -- YYYY-MM-DD
  time       TEXT NOT NULL DEFAULT '09:00',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);

-- Alerts (row #3, #24): medicine / stock / restock / family / emergency / system.
CREATE TABLE IF NOT EXISTS alerts (
  id          TEXT PRIMARY KEY,
  patient_id  TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,                       -- medicine | stock | restock | family | emergency | system
  title       TEXT NOT NULL,
  detail      TEXT NOT NULL DEFAULT '',
  level       TEXT NOT NULL DEFAULT 'Level 3',
  status      TEXT NOT NULL DEFAULT 'open',        -- open | resolved | cancelled
  source      TEXT NOT NULL DEFAULT 'app',         -- app | cron | engine
  ref_id      TEXT,                                -- medicine/emergency id when relevant
  created_at  TEXT NOT NULL,
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_alerts_patient ON alerts(patient_id, created_at DESC);

-- Notification history (row #18): every send attempt per recipient + channel.
CREATE TABLE IF NOT EXISTS notifications (
  id             TEXT PRIMARY KEY,
  patient_id     TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  alert_id       TEXT REFERENCES alerts(id) ON DELETE SET NULL,
  recipient_type TEXT NOT NULL DEFAULT 'family',   -- family | patient
  recipient_id   TEXT,                             -- family_member id or device id
  channel        TEXT NOT NULL,                    -- push | whatsapp | email | sms
  type           TEXT NOT NULL,                    -- medicine | stock | restock | emergency | ...
  status         TEXT NOT NULL DEFAULT 'pending',  -- pending | sent | failed | skipped
  detail         TEXT,
  provider_ref   TEXT,                             -- FCM message id / WhatsApp id
  error          TEXT,
  created_at     TEXT NOT NULL,
  sent_at        TEXT
);
CREATE INDEX IF NOT EXISTS idx_notifications_patient ON notifications(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_alert ON notifications(alert_id);

-- Emergency / SOS events (Module F: rows #20, #22, #23).
CREATE TABLE IF NOT EXISTS emergency_events (
  id                 TEXT PRIMARY KEY,
  patient_id         TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  status             TEXT NOT NULL DEFAULT 'pending_confirm', -- pending_confirm | confirmed | cancelled | resolved
  primary_contact_id TEXT,
  channels           TEXT NOT NULL DEFAULT '[]',   -- JSON array of channels used
  note               TEXT,
  triggered_at       TEXT NOT NULL,
  confirmed_at       TEXT,
  resolved_at        TEXT
);
CREATE INDEX IF NOT EXISTS idx_emergency_patient ON emergency_events(patient_id, triggered_at DESC);

-- Scheduled-job run log (Module E): observability for cron Workers.
CREATE TABLE IF NOT EXISTS cron_runs (
  id          TEXT PRIMARY KEY,
  job         TEXT NOT NULL,                       -- daily_medicine_check | monthly_restock | ...
  started_at  TEXT NOT NULL,
  finished_at TEXT,
  status      TEXT NOT NULL DEFAULT 'running',     -- running | ok | error
  detail      TEXT
);
CREATE INDEX IF NOT EXISTS idx_cron_runs_job ON cron_runs(job, started_at DESC);
