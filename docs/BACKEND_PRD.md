# MedLoop — Backend PRD (Claude-owned scope)

**Owner:** Claude (backend — Cloudflare Worker + D1 + R2 + FCM channel)
**Consumer:** Codex (frontend/Android) builds against the API contract in §6.
**Status:** Draft v0.2 — decisions resolved (§9)
**Last updated:** 2026-08-30

> This PRD covers **only the backend line items** from the 44-task + 8-feature
> remediation list. Frontend/Android items and human-only console actions are
> listed in §3 for traceability but are **out of scope for this document**.

---

## 0. Two decisions already locked

1. **Server-side identity** on the Worker (not local-only). Enables real
   password reset, email verification, caregiver login, and true account
   deletion. Everything in §5.A/B depends on this.
2. **Staggered L1 → L2 escalation** for missed doses (§5.E). Patient reminded at
   dose time → Level 1 caregiver at +~15 min → Level 2 at +~30 min, only if the
   dose is *still* not taken. Windows are per-patient configurable (task #22).

**Quality bar.** MedLoop will be evaluated by ~300 IIT students and professors
internationally. The backend must *demonstrably* stand out: provable per-patient
isolation, zero PII in push/logs, a genuinely novel + fully-tested real-time
escalation engine, a guardrailed medical AI that provably refuses unsafe
requests, and a clean, documented API + migrations + Vitest suite + cron
observability. Every design choice below is weighed against "would this impress a
technical reviewer."

---

## 1. Architecture baseline (what already exists — do not rebuild)

- **Gateway:** Cloudflare Worker (`worker/`), path-prefixed `/v1`, JSON envelope
  `{ ok, data } | { ok:false, error:{code,message,details} }`. Router in
  `worker/src/router.js`; route registry in `worker/src/routes/index.js`.
- **Auth (current):** Bearer **device-session token**, stored only as SHA-256
  hash in `devices.token_hash` (`worker/src/middleware/auth.js`). Email is a
  non-unique display label, **not** a credential. A second device joins an
  existing account via single-use **link codes** (migration 0002).
- **Data:** D1 database `medloop` (migration `0001_initial_schema.sql`) with
  `patients, patient_settings, devices, family_members, medicines, dose_logs,
  stock_events, prescriptions, appointments, alerts, notifications,
  emergency_events, cron_runs`.
- **Files:** R2 bucket `medloop-files` for prescription images (task ties to
  new-feature #1/#2).
- **Push:** Firebase **only** as an FCM HTTP-v1 delivery channel
  (`worker/src/channels/fcm.js`), authed by a service account (secret, not
  committed). Also WhatsApp + email channels exist (`worker/src/channels/*`).
- **Alerts/notifications:** `createAndDispatchAlert` / `dispatchAlert`
  (`worker/src/services/alertService.js`) already resolve recipients by family
  level (`selectMembersForAlertLevel`), fan out across channels, and record a
  `notifications` history row per attempt.
- **Scheduling (current):** two crons only — daily ~22:00 IST medicine sweep and
  monthly restock on the 20th (`worker/wrangler.toml`,
  `worker/src/services/scheduledJobs.js`). **No per-dose / near-real-time
  detection yet** — this is the main gap for feature #7.

---

## 2. Guardrails & non-negotiables

- **G1 — Medication-focused (feature #5).** No feature may turn MedLoop into a
  general health journal. Every new endpoint must be justified against
  medication adherence, stock, family safety, or emergencies.
- **G2 — Medical safety (tasks #32–34).** The AI assistant and simplifier must
  **never** diagnose, change dosage, or give prescription advice. Every AI
  response carries an "educational information only" disclaimer and is validated
  before return.
- **G3 — No PII in push (task #7).** FCM `notification.title/body` and any log
  line must **never** contain medicine names, dosages, diagnoses, or health
  detail. Push carries a generic message + an opaque `data.alertId`; the app
  fetches specifics over the authenticated channel. This is a hard rule and gets
  an automated test.
- **G4 — Per-patient isolation (task #3).** Every query is scoped by the
  authenticated patient/authorized caregiver. No endpoint returns another
  account's rows. Covered by an authorization test matrix (§7).
- **G5 — Consent-gated access (tasks #6/#29).** A caregiver sees a patient's data
  only after an explicit, recorded consent/link. Revocation is immediate.

---

## 3. Scope map (all 52 items → owner)

**✅ Backend, mine end-to-end:** #3, #4, #7, #9, #10, #11, #13, #14, #15, #16,
#17, #18, #21, #28, #32, #33, #35, #38, feature #7.

**🔷 Backend half mine (Codex builds the UI):** #2, #6, #8, #12, #20, #22, #23,
#25 (push half), #26, #27, #30, #34, #37 (tests), #39 (tests), #40 (push half),
#44 (backend review), features #2, #3, #4, #6, #8.

**🤝 Shared:** #24 (I fix selection logic; Codex fixes the card), #29 (I store
consent + provide disclaimer text), #41 (I stage migrations/Worker deploy).

**🖥️ Codex / frontend-Android (not in this PRD):** feature #1 (ML Kit OCR), #5
(done — `allowBackup=false`), #19 (boot/battery manifest), #31 (contact page),
#40 (SMS draft — already in `src/lib/localAccount.js`), #42 (web build).

**👤 Human/console (I prep, you execute):** #1 (restrict GCP key), #36/#19/#39
(physical-device testing), #41/#42 (dashboard deploy click), #43 (Play Console
AAB upload).

---

## 4. Data model changes (new migrations)

New migrations are additive and preserve existing device-token auth (no forced
re-login on upgrade).

> **On-disk migration order** (built in milestone order, so the numbers differ
> from the logical labels below): `0003` server identity ✅, `0004` escalation
> engine ✅, `0005` caregiver links + `family_members.user_id` ✅. Consent/AI-log
> tables take the next sequential numbers when those milestones land.

### 0003 — Server identity
```
users (
  id TEXT PK,
  email TEXT NOT NULL UNIQUE,          -- now a real credential key
  password_hash TEXT, password_salt TEXT, password_algo TEXT,  -- PBKDF2-SHA256 (WebCrypto)
  email_verified INTEGER NOT NULL DEFAULT 0,
  display_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',   -- active | disabled
  created_at TEXT, updated_at TEXT
)
-- Link existing accounts to a user, keep device auth working:
ALTER patients   ADD owner_user_id TEXT REFERENCES users(id);
ALTER devices    ADD user_id       TEXT REFERENCES users(id);

email_tokens (          -- verification + password reset
  token_hash TEXT PK,   -- SHA-256, single-use
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,          -- verify_email | reset_password
  expires_at TEXT NOT NULL, consumed_at TEXT, created_at TEXT
)
```
Migration step: for each existing `patients` row, create a `users` row (email or
synthesized placeholder), set `patients.owner_user_id`, backfill
`devices.user_id`. Existing device tokens keep working.

### 0004 — Family network & permissions
```
caregiver_links (
  id TEXT PK,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  caregiver_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,  -- null until accepted
  family_member_id TEXT REFERENCES family_members(id) ON DELETE SET NULL, -- bridges contact ⇄ account
  alert_level TEXT NOT NULL DEFAULT 'Level 1',      -- L1 | L2 | L3
  permissions TEXT NOT NULL DEFAULT '[]',           -- JSON: view_inventory, view_doses, view_adherence, receive_escalations, view_emergency
  status TEXT NOT NULL DEFAULT 'pending',           -- pending | active | revoked
  invited_by_user_id TEXT, invite_code_hash TEXT,   -- accept via code, like device links
  created_at TEXT, accepted_at TEXT, revoked_at TEXT
)
ALTER family_members ADD user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
```

### 0005 — Consent & compliance (tasks #6/#29/#30)
```
consents (
  id TEXT PK, user_id TEXT NOT NULL, patient_id TEXT,
  kind TEXT NOT NULL,           -- privacy_policy | medical_disclaimer | data_processing | family_share
  version TEXT NOT NULL, granted INTEGER NOT NULL, source TEXT,
  created_at TEXT
)
```

### 0006 — Escalation engine (feature #7 / tasks #17/#22)
```
-- extend per-patient settings:
ALTER patient_settings ADD dose_grace_minutes    INTEGER NOT NULL DEFAULT 15; -- patient→L1
ALTER patient_settings ADD l2_escalation_minutes INTEGER NOT NULL DEFAULT 30; -- →L2 (from scheduled)
ALTER patient_settings ADD escalation_enabled    INTEGER NOT NULL DEFAULT 1;

-- idempotent per-dose escalation state (one row per expected dose occurrence):
dose_escalations (
  id TEXT PK,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  medicine_id TEXT NOT NULL,
  dose_period TEXT NOT NULL,            -- morning | afternoon | night
  dose_date TEXT NOT NULL,              -- YYYY-MM-DD local
  scheduled_at TEXT NOT NULL,           -- ISO of the scheduled local time
  stage TEXT NOT NULL DEFAULT 'pending',-- pending | reminded | l1_notified | l2_notified | resolved | skipped
  last_stage_at TEXT, resolved_at TEXT,
  UNIQUE(patient_id, medicine_id, dose_period, dose_date)
)
```

### 0007 — Confirming user + AI logs
```
ALTER dose_logs ADD recorded_by_user_id TEXT;   -- task #9 "confirming user"
ai_requests (                                    -- tasks #35 rate-limit + audit
  id TEXT PK, user_id TEXT, patient_id TEXT,
  kind TEXT NOT NULL,           -- simplify | assistant
  status TEXT NOT NULL,         -- ok | rejected | error
  created_at TEXT
)
```

---

## 5. Feature specs

Each: **Current → Gap → Requirements → Acceptance.**

### A. Server identity & auth  (#26, #27, #28)
- **Current:** device-token only; `src/lib/localAccount.js` fakes accounts on the
  device (`emailVerified:true`, `sendResetLink` throws).
- **Gap:** no server user, verification, reset, or server-side deletion.
- **Requirements:**
  1. `POST /auth/signup` (email+password) → creates `users` row + patient +
     device token; sends verification email.
  2. `POST /auth/login` → verifies password, issues device token (bearer, hashed).
  3. `POST /auth/verify-email` (code) and `POST /auth/resend-verification`.
  4. `POST /auth/password/reset-request` + `POST /auth/password/reset` (code via
     email channel). Rate-limited.
  5. `DELETE /account` → cascade delete patient data, family, dose logs,
     prescriptions (+ R2 objects), devices, caregiver links, then the user. Return
     a deletion receipt. (**task #28**)
  6. Auth middleware resolves `device → user`, then authorizes patient access via
     `patients.owner_user_id` **or** an active `caregiver_links` row.
- **Acceptance:** unverified users can log in but are flagged; reset works
  end-to-end in tests using a mock email channel; deleting an account leaves zero
  rows for that patient across all tables and zero R2 objects.

### B. Family network & permissions  (#6, #21, features #3/#6)
- **Current:** `family_members` are contacts with `alert_level`; dispatch already
  targets by level. No caregiver *accounts* or access control.
- **Gap:** caregivers can't log in and *view* the patient's inventory/dose status;
  no permission model; no consent.
- **Two tiers of caregiver (resolved):**
  - **App caregiver** — installs MedLoop, accepts an invite, gets a `users`
    account + `caregiver_links` row. Receives push to their *own* device and can
    open a read-only caregiver view (inventory + dose status), permission-gated.
  - **Contact-only caregiver** — no app/account. Stays a plain `family_members`
    row and receives alerts via WhatsApp / SMS / email, and is an emergency
    call target. **No** authenticated data view (nothing to log into). A contact
    can be upgraded later by accepting an invite (`family_members.user_id`
    back-fills to bridge the contact to their new account).
  - Both tiers are addressable by the same escalation/alert dispatch; the channel
    differs (push for app caregivers, WhatsApp/SMS/email for contacts).
- **Requirements:**
  1. `POST /family/:id/invite` → mints a caregiver invite code; `POST
     /caregiver/accept` (public + code) links the caregiver's user to the patient
     with a default permission set + `alert_level`.
  2. `GET /caregiver/patients` → patients a caregiver can see.
  3. Caregiver-scoped read endpoints honoring `permissions`:
     `GET /patients/:patientId/inventory`, `/doses`, `/adherence`.
  4. **Feature #6:** a Level-1 caregiver with `view_inventory` + `view_doses` sees
     stock levels and today's taken/missed status (read-only).
  5. Revoke: `POST /family/:id/revoke` flips `caregiver_links.status=revoked`;
     access denied immediately.
- **Acceptance:** authorization matrix test — patient A's caregiver cannot read
  patient B; revoked caregiver gets 403; Level-2 caregiver without `view_inventory`
  gets 403 on inventory but 200 on escalations they receive.

### C. Dose tracking & stock integrity  (#8, #9, #10, #13)
- **Current:** `POST /medicines/:id/dose` records status; `stockDeltaForTransition`
  consumes/restores stock on taken transitions; `stock_events` ledger exists.
- **Gap:** confirming-user not stored; duplicate-dose guard not enforced at the
  slot level; missed-status not written proactively (only inferred at daily check).
- **Requirements:**
  1. Store `recorded_by_user_id` on every dose log (#9).
  2. **Idempotency:** a dose for `(medicine, period, date)` is unique — a repeat
     `taken` is a no-op (no double stock decrement) (#13).
  3. Stock decrement is atomic with the dose write; ledger row per change (#10).
  4. Escalation engine (§E) writes `missed` when a dose passes its terminal window
     untaken (#8).
- **Acceptance:** recording the same taken dose twice decrements stock once;
  ledger balances reconcile; every dose log has a confirming user.

### D. Predictive & family-aware stock  (feature #4, #11, #12)
- **Current:** `computeRemainingDays`/`isLowStock` (static threshold);
  monthly restock cron.
- **Gap:** no consumption-rate prediction; not aggregated across family.
- **Requirements:**
  1. Predict days-of-supply from actual `dose_logs` consumption rate (trailing
     N days), not just nominal schedule.
  2. Low-stock + restock alerts fire from prediction, deduped (#11, #13).
  3. `GET /stock/summary` extended with per-medicine `predictedDaysRemaining`,
     `runsOutOn`, `familyRollup` (when caregiver-scoped).
  4. Adherence history/report endpoints (`GET /adherence?range=`) with taken/
     missed/skipped rates (#12).
- **Acceptance:** a medicine consumed faster than nominal predicts an earlier
  run-out; adherence numbers match seeded dose logs.

### E. Missed-dose escalation engine  ⭐ (feature #7, #17, #21, #22)
- **Current:** none (daily sweep only).
- **Gap:** the core of the product vision.
- **Requirements:**
  1. New cron `*/15 * * * *` (UTC) → `runEscalationSweep`.
  2. For each patient (respecting timezone), derive today's expected dose
     occurrences from `medicines.enabled_periods` + period time columns; upsert a
     `dose_escalations` row per occurrence with `scheduled_at`.
  3. State machine, idempotent per tick:
     - `now ≥ scheduled_at + grace(=dose_grace_minutes)` and no `taken` log →
       advance `pending→l1_notified`: dispatch to **Level 1** (patient-selected
       primary honored) via `dispatchAlert` (audience by-level, level 1).
     - `now ≥ scheduled_at + l2_escalation_minutes` and still not taken →
       `l1_notified→l2_notified`: dispatch to **Level 2**.
     - a `taken` (or `skipped`) log at any point → `resolved`/`skipped`, stop.
  4. Never re-notify the same stage (dedup via `stage` + `last_stage_at`) (#13).
  5. Push payloads obey **G3** (generic body, `data.alertId`).
  6. Windows come from `patient_settings` (#22): **defaults 15 min → L1, 30 min →
     L2**. **Important-med fast-track (resolved):** medicines flagged `important`
     escalate at **10 min → L1, 20 min → L2** (derived from `medicines.important`,
     no new column). Per-medicine custom windows deferred to v2.
- **Acceptance (test with injected clock):** taken-on-time → no escalation;
  a normal missed dose → exactly one L1 at +15, one L2 at +30; an important missed
  dose → L1 at +10, L2 at +20; a `taken` between L1 and L2 stops L2; re-running the
  cron in the same window sends nothing new.
- **Note:** cron granularity is 1 min; `*/15` chosen. At larger scale, batch
  patients / use a queue — flagged as a future scaling item.

### F. Notifications hardening  (#7, #14, #15, #18, #20)
- **Requirements:** token lifecycle (register/rotate on `PATCH /auth/device`,
  **revoke on logout / device change** (#20)); timezone already in settings —
  ensure all jobs use it (#18); **retry** transient FCM failures with backoff and
  mark `notifications.status`; **G3 audit** across every dispatch path + a test
  asserting no medicine name appears in any push body.
- **Acceptance:** logout revokes the device row and its token no longer receives;
  a simulated FCM 5xx retries then records `sent`/`failed`.

### G. Emergency  (#23, #24, #25)
- **Current:** `emergency_events` + `selectPrimaryEmergencyContact` (explicit
  primary → L1 → latest). SOS trigger/confirm/cancel endpoints exist.
- **Gap:** #24 "uses only first family member" is a **frontend** card bug; backend
  selection is already multi-aware. Multi-contact fan-out + call fallback to
  specify.
- **Requirements:** support multiple emergency contacts (#23); backend returns an
  ordered contact list (primary first) so the card stops hardcoding index 0 (#24,
  I provide `GET /emergency/contacts`). **Fan-out (resolved): all emergency
  contacts simultaneously — NOT staggered.** For an SOS, speed beats privacy, so
  every contact is notified at once via FCM (app caregivers) + WhatsApp/SMS
  (contacts), and the endpoint returns `tel:` numbers for the app's one-tap
  direct-call fallback (#25, call UI is Codex).
- **Acceptance:** an SOS with 3 contacts records 3 notification attempts; contacts
  endpoint returns primary first.

### H. AI assistant + safety  (feature #8, #32–35)
- **Dedicated MedLoop AI (resolved):** a MedLoop-**exclusive** AI service, not a
  generic Claude wrapper — its own credentials/key, a MedLoop-only system persona
  built on the existing `src/lib/assistantKnowledge.js` domain knowledge, scoped
  strictly to medication/adherence/stock topics (G1). Runs server-side in the
  Worker so guardrails cannot be bypassed. **Privacy-minimized:** AI calls send
  only the minimum text needed (e.g. the medicine label to simplify), never
  patient identifiers or the full record — important for the review's privacy
  scrutiny. Underlying model TBD (§9-2).
- **Requirements:**
  1. `POST /ai/simplify` and `POST /ai/assistant` — **authenticated**, patient-
     scoped, **rate-limited** (per-user token bucket; `ai_requests` audit) (#35).
  2. System prompt + **output validator** reject/strip diagnosis, dosage
     change, prescription advice (#32/#33). On violation → safe fallback text.
  3. Every response includes a machine-readable `disclaimer` = "educational
     information only" (#34); Codex renders it.
  4. Assistant context limited to the patient's own med list/schedule (G1);
     no open-ended medical Q&A beyond MedLoop's domain.
- **Acceptance:** adversarial prompts ("what dose should I take?", "do I have X?")
  return the refusal + disclaimer, never a recommendation; over-limit requests get
  429.

### I. Privacy & compliance  (#28, #29, #30)
- **Requirements:** consent capture/storage + versioning (§0005); `GET
  /account/export` (machine-readable full export) (#30); correction via existing
  PATCH endpoints; deletion via §5.A.5; disclaimer/policy **text** supplied by me
  for Codex's screens (#29 content, screens are Codex/you).
- **Acceptance:** export contains all of a patient's data and nothing from other
  patients; recorded consent has kind+version+timestamp.

### J. Security hardening  (#3, #4, #35, #44)
- **Requirements:** per-patient scoping audit across **every** route (§G4 test
  matrix); Worker **rate limits** on auth + AI + emergency; request attestation /
  Turnstile as the App-Check equivalent (#4); confirm secrets are wrangler-managed
  (done — verified none committed); write the **restrict-the-GCP-key** runbook for
  you (#1); backend security review checklist (#44).
- **Acceptance:** the authz test matrix passes; unauthenticated/over-rate requests
  are rejected; review checklist signed off.

---

## 6. API contract (v1 existing + additions)

**Existing (keep, from `src/lib/cloud/apiClient.js`):** `/health`, `/meta`,
`/auth/register`, `/auth/session`, `/auth/link-code[/redeem]`,
`/auth/link-device`, `/auth/device`, `/auth/revoke`; `/family` CRUD +
`/family/:id/primary`, `/family/primary`, `/family/alert-target`; `/medicines`
CRUD + `/:id/dose`, `/:id/doses`, `/:id/restock`; `/stock/summary`; `/alerts`,
`/alerts/:id`, `/alerts/:id/notifications`, `/notifications`; `/settings`;
`/jobs/*`; `/sync`; `/prescriptions`, `/appointments`, `/prescriptions/:id/file`;
`/emergency*`. Envelope + Bearer auth unchanged.

**New (this PRD):**

| Method | Path | Auth | Purpose | Item |
|--------|------|------|---------|------|
| POST | `/auth/signup` | public | email+password account | #26/#27 |
| POST | `/auth/login` | public | password login → token | #26 |
| POST | `/auth/verify-email` | public+code | confirm email | #27 |
| POST | `/auth/resend-verification` | user | resend | #27 |
| POST | `/auth/password/reset-request` | public | send reset code | #26 |
| POST | `/auth/password/reset` | public+code | set new password | #26 |
| DELETE | `/account` | user | delete account + all data | #28 |
| GET | `/account/export` | user | full data export | #30 |
| POST | `/consents` / GET `/consents` | user | record/read consent | #29 |
| POST | `/family/:id/invite` | patient | mint caregiver invite | feat#3 |
| POST | `/caregiver/accept` | public+code | link caregiver↔patient | feat#3 |
| GET | `/caregiver/patients` | caregiver | patients I can see | feat#3 |
| GET | `/patients/:id/inventory` | caregiver | stock view (perm-gated) | feat#6 |
| GET | `/patients/:id/doses` | caregiver | dose status view | feat#6 |
| GET | `/adherence` | user | adherence report | #12 |
| POST | `/family/:id/revoke` | patient | revoke caregiver | #6 |
| GET | `/emergency/contacts` | user | ordered contacts, primary first | #24 |
| POST | `/ai/simplify` | user (rl) | simplify medicine text | #32-35 |
| POST | `/ai/assistant` | user (rl) | MedLoop assistant | feat#8 |
| GET | `/escalations` | user | today's escalation state | #17 |

`PATCH /settings` gains `doseGraceMinutes`, `l2EscalationMinutes`,
`escalationEnabled` (#22). Full request/response shapes to be appended as an
OpenAPI-style annex once the model lands.

---

## 7. Non-functional requirements

- **Idempotency:** dose recording, escalation stages, and cron sweeps are all
  idempotent (unique keys / stage guards).
- **Rate limits:** auth, AI, emergency, reset endpoints (token-bucket in D1 or
  Durable Object if needed).
- **Observability:** `cron_runs` already logs sweeps; add per-sweep escalation
  counts; structured logs must never contain PII (G3).
- **Testing (Vitest, `better-sqlite3` in-memory D1):** unit tests for
  escalation state machine (injected clock), authz matrix, stock idempotency,
  no-PII-in-push assertion, deletion cascade. This is the automated half of
  tasks #37/#38/#39/#44.
- **Migrations:** additive, reversible where possible, never drop patient data.

---

## 8. Milestones (backend)

1. **M0 — Contract freeze + this PRD.** ✅ done.
2. **M1 — Server identity** (migration 0003). ✅ **done** — `POST /auth/signup`,
   `/auth/login`, `/auth/verify-email`, `/auth/resend-verification`,
   `/auth/password/reset-request`, `/auth/password/reset`, `DELETE /account`;
   PBKDF2 password hashing (`worker/src/lib/password.js`); account emails
   (`worker/src/services/accountEmail.js`); user-aware auth middleware; 11
   integration tests in `tests/integration.auth.test.js`. *(#26/#27/#28)*
   Remaining to fully close: real email sender domain (verification/reset send as
   "skipped" until `RESEND_API_KEY` + `EMAIL_FROM` are set).
3. **M2 — Escalation engine** (migration 0004). ✅ **done** — `*/15` cron sweep
   (`ESCALATION_CRON`) + per-patient `runEscalationCheck`; pure state machine in
   `worker/src/domain/escalation.js` (staggered L1→L2, important-med fast-track
   10/20, idempotent via `dose_escalations`); PII-free push copy while the in-app
   alert keeps specifics (G3) via a new `pushMessage`/`at-level` path in the alert
   service; `POST /jobs/escalation-check` (injectable clock) + escalation fields on
   `/settings`; 17 tests (`tests/workerEscalation.test.js`,
   `tests/integration.escalation.test.js`). ⭐ *(feature #7 / #17/#21/#22)*
4. **M3 — Family network + permissions** (migration 0005). ✅ **done** —
   `POST /family/:id/invite`, `POST /caregiver/accept`, `GET /caregiver/patients`,
   `GET /caregivers`, `PATCH /caregivers/:linkId`, `POST /caregivers/:linkId/revoke`,
   `GET /patients/:id/inventory`, `GET /patients/:id/doses`; permission model +
   `authorizePatientAccess` gate (`worker/src/domain/caregiver.js`,
   `worker/src/services/caregiverAccess.js`); dispatcher now reaches a linked
   caregiver on their own devices + de-dupes sends; 7 tests
   (`tests/integration.caregiver.test.js`). *(feat #3/#6, task #6)* Full consent
   screens/policy versioning (#29) deferred to M6. *(shared code util extracted to
   `worker/src/lib/codes.js`.)*
5. **M4 — Stock intelligence + adherence**. ✅ **done** (no migration — reads
   existing `dose_logs`) — consumption-rate prediction in `worker/src/domain/stock.js`
   (observed vs nominal, `predictedDaysRemaining`/`predictedRunOutDate`/`predictedLow`);
   adherence aggregation (`worker/src/domain/adherence.js`); shared
   `worker/src/services/stockInsight.js`; `/stock/summary` extended, new
   `GET /adherence`, `GET /patients/:id/adherence`, and family-aware
   `GET /caregiver/inventory` rollup; 11 tests
   (`tests/workerStockPrediction.test.js`, `tests/integration.stock.test.js`).
   *(feat #4, #11/#12)*
6. **M5 — AI assistant + safety** (migration 0006). ✅ **done** — dedicated
   MedLoop-exclusive service (`worker/src/services/aiService.js`) behind a hosted
   Claude model (swappable in `callModel` alone), data-minimized; pure guardrails
   (`worker/src/domain/aiSafety.js`): request refusal + output validation (no
   diagnosis/dosing/prescription advice), educational-only disclaimer;
   `POST /ai/simplify` + `POST /ai/assistant`, authenticated + per-user hourly
   rate limit + `ai_requests` metadata-only audit; safe fallback when no key is
   set; 10 tests (`tests/workerAiSafety.test.js`, `tests/integration.ai.test.js`).
   *(feat #8, #32–35)*
7. **M6 — Hardening + release gate:** authz audit, rate limits, attestation,
   PII audit, export, GCP-key runbook, security review. *(#3/#4/#7/#30/#44)*

Codex can build M1/M2 UIs in parallel once the M1 contract is frozen.

---

## 9. Decisions — resolved & remaining

**Resolved (2026-08-30):**
1. **Caregivers are two-tier** — app-account caregivers (push + read-only view)
   vs. contact-only caregivers (WhatsApp/SMS/email, no view). See §5.B.
2. **Escalation defaults** — 15/30 min normal, 10/20 min for `important` meds. §5.E.
3. **Emergency fan-out** — all contacts simultaneously. §5.G.
4. **AI** — a dedicated MedLoop-exclusive AI service, data-minimized. §5.H.

**Resolved:** AI engine — a **hosted Claude model behind the MedLoop-exclusive
service**, data-minimized (chosen 2026-08-30).

**Still needed from you (secrets, not blockers — the code ships and falls back
safely without them):**
1. **`MEDLOOP_AI_API_KEY`** (+ optional `MEDLOOP_AI_MODEL`) as a Worker secret to
   enable live AI. Without it, `/ai/*` still enforces guardrails + returns a safe
   fallback.
2. **Email sender domain** (from-address + domain you control) for verification /
   reset (`RESEND_API_KEY` + `EMAIL_FROM`), so I can set up SPF/DKIM. The flows are
   built and tested; they just need the domain to deliver in production.

---

## 10. Handoff notes to Codex (frontend must provide/consume)

- Send `recorded_by_user_id` context implicitly via the auth token (no UI change).
- Consume `GET /emergency/contacts` (ordered) — stop indexing family[0] (#24).
- Render `disclaimer` from `/ai/*` verbatim (#34); show 429 gracefully (#35).
- Caregiver mode: build against `/caregiver/*` + `/patients/:id/inventory|doses`.
- Settings screen: expose `doseGraceMinutes` / `l2EscalationMinutes` (#22).
- Push handler: treat FCM `data.alertId` as the key; fetch details over the API
  (never expect medicine names in the push body) (#7/G3).
- OCR (feature #1) stays on-device (ML Kit); POST extracted fields to the
  prescription/medicine create endpoints.
