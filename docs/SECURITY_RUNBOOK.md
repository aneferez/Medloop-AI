# MedLoop — Security Runbook (backend)

Actions **you** must perform in a console (I can't click these), plus the
pre-release security checklist. Backend code hardening is covered by the test
suite; this file is the human + review layer.

---

## 1. Restrict the Android/Firebase API key (task #1)

The key `AIzaSy…5Npw` (project `medloopai-3004`) in `android/app/google-services.json`
is an **Android API key**. It is *designed* to ship inside the APK and is **not a
secret** — Google's guidance is to **restrict**, not rotate it. (Verified: no
service-account private key is committed; the FCM service-account secret is set via
`wrangler secret`, and `worker/.dev.vars` is gitignored.)

Do this in **Google Cloud Console → APIs & Services → Credentials**:

1. Open the Android key for project `medloopai-3004`.
2. **Application restrictions → Android apps.** Add the app:
   - Package name: (from `android/app/build.gradle` `applicationId`).
   - SHA-1: run `./gradlew signingReport` (or from the Play Console **App signing**
     page) and add **both** the upload and Play app-signing SHA-1s.
3. **API restrictions → Restrict key** to only what the app uses:
   - *Firebase Cloud Messaging API* (and *Firebase Installations API* if used).
   - Remove everything else.
4. Save. Rebuild and confirm push still delivers on a physical device.

> Rotate the key **only** if the Firebase **service-account private key**
> (`FCM_PRIVATE_KEY`) is ever exposed — that one is the real secret.

**Firebase Storage bucket** `medloopai-3004.firebasestorage.app`: MedLoop uses
Cloudflare R2 for files, not Firebase Storage. Confirm this bucket is unused and
either delete it or lock its Storage rules to deny all, so it can't become an open
data store.

---

## 2. Secrets to set before production

Set with `wrangler secret put <NAME>` in the Worker (never commit):

| Secret | Purpose | Without it |
|--------|---------|------------|
| `FCM_PROJECT_ID` / `FCM_CLIENT_EMAIL` / `FCM_PRIVATE_KEY` | push delivery | pushes record as "skipped" |
| `RESEND_API_KEY` + `EMAIL_FROM` | verification / reset / alert email | emails "skipped" |
| `MEDLOOP_AI_API_KEY` (+ `MEDLOOP_AI_MODEL`) | MedLoop AI assistant | `/ai/*` returns safe fallback |
| `TURNSTILE_SECRET` | signup attestation (App Check equiv.) | attestation skipped |
| `TOKEN_SIGNING_SECRET` | gateway entropy | — |

`EMAIL_FROM` needs a domain you control with **SPF + DKIM** configured at Resend,
or verification/reset mail will land in spam.

---

## 3. Pre-release security checklist (task #44)

Backend, mostly covered by automated tests — re-run `npm test` in `worker/`'s repo
root before shipping.

- [x] **Per-patient isolation** — every route scoped by patient; cross-account
  access denied. *(tests/workerAuthz.test.js)*
- [x] **Caregiver access is consent-gated + permission-gated**; revocation is
  immediate. *(tests/integration.caregiver.test.js)*
- [x] **No PII in push bodies or logs** — generic push copy on every path; med
  names only in the authenticated in-app alert. *(tests/workerPushPrivacy.test.js)*
- [x] **Passwords** PBKDF2-SHA256, hashed-only storage, constant-time compare; no
  user enumeration; reset revokes sessions.
- [x] **Tokens** (device sessions, pairing/invite codes, email + reset tokens)
  stored only as SHA-256 hashes.
- [x] **AI safety** — server-side refusal of diagnosis/dosing/prescription;
  output validation; educational-only disclaimer; auth + rate limit.
  *(tests/workerAiSafety.test.js, tests/integration.ai.test.js)*
- [x] **Rate limits** on signup / login / password-reset / AI.
- [x] **Account deletion** cascades all health data + R2 files; **data export**
  available (#30).
- [x] **Android backup disabled** (`allowBackup=false`).
- [ ] **Restrict the GCP key** (§1) — console action.
- [ ] **Set production secrets** (§2) — console action.
- [x] **Turnstile widget** is mounted on the cloud signup screen. Set both the
  public `VITE_TURNSTILE_SITE_KEY` and Worker `TURNSTILE_SECRET` to enforce it.
- [ ] **Physical-device testing** — reminders after reboot / under battery
  restrictions; real FCM delivery (#19/#36/#39).
- [x] **Deploy** D1 migrations + Worker to production; smoke-tested health,
  auth validation, protected caregiver/AI/export route boundaries, and cron
  trigger registration on 2026-08-31.
