# Backend → Codex: hand-off note

## ✅ 2026-08-31 — SERVER AUTH NOW WORKS IN PRODUCTION
`/auth/signup`, `/auth/login`, and `/auth/password/reset` were **500-ing in prod**
until just now. Cause: the 210k-iteration PBKDF2 password hash exceeded the
Cloudflare Workers **free-plan 10 ms CPU limit**, so every hashing request was killed.
(Tests passed because Node has no CPU cap; `/auth/register` worked because it doesn't
hash.) **Fixed + deployed** — iterations tuned to fit the budget (commit `0e172d9`,
version `7b4e140e`), env-overridable via `PBKDF2_ITERATIONS` on the Paid plan.

**So: if you saw server signup/login/reset failing on the frontend, that was this
backend bug — not your code.** Server accounts, caregiver login, and password reset
all work now — please re-test the auth flows against production. (`/auth/register`
was unaffected throughout.)

Backend is complete and deployed (M1–M6 + follow-ups). Your `apiClient.js` already
matches the contract — I checked every method against a live endpoint and found no
mismatches. This note is just the couple of things you can't see from your side.

## ⚠️ One coordination item (changed after your integration)
`/auth/register` is now **attestation-gated and rate-limited**, matching `/auth/signup`:
- **If you enable Turnstile** (`VITE_TURNSTILE_SITE_KEY` + Worker `TURNSTILE_SECRET`),
  you must pass the Turnstile token to **`registerDevice`** too — not just signup —
  or the device path returns **403**. Add it to the register payload, e.g.
  `cloudApi.registerDevice({ ..., attestationToken })`.
- Register is rate-limited to ~15/hour **per IP** (falls back to email/anon). Normal
  use (one device per person) is unaffected; only floods hit **429**.

## 🔧 New debug tool for you
`GET /v1/system/config-check` (authenticated) returns booleans for which channels are
wired — `channels.push/email/whatsapp`, `ai.configured`, `attestation.enabled`,
`storage.r2` — **no secret values**. Use it to confirm push/email/AI are live after
the operator sets secrets, instead of guessing. (Heads-up: the deployed FCM secrets
were **misnamed**, so `push` reads false until they're re-set — see
`docs/SECURITY_RUNBOOK.md`.)

## 🆕 Caregiver dashboard — multi-patient cards ("services"-style)
`GET /v1/caregiver/dashboard` → `{ patients: [{ patientId, name, alertLevel, permissions,
inventory?: { medicineCount, lowStockCount, predictedLowCount, predictedLowIds },
today?: { date, summary:{taken,missed,skipped,pending,total}, next:{name,period,scheduledTime}, doses:[...] } }] }`.
**One call** gives you the card feed: each patient by **name**, with a compact **inventory**
summary, **today's medication checks**, and the **next upcoming dose**. Sections are
**permission-gated** — `inventory` only appears if the patient granted `view_inventory`,
`today` only if `view_doses`. Perfect for the phone-recharge-style cards. Add
`cloudApi.caregivers.dashboard(token)`.

## 🆕 Prescription extraction (feature #1, backend half)
`POST /v1/ai/extract` `{ text }` → `{ medicines: [{ name, dosage, frequencyText, enabledPeriods }], source, disclaimer }`.
Feed it the ML-Kit OCR text; it returns structured medicine **drafts** — frequency
is mapped to `morning`/`afternoon`/`night` (handles `1-0-1`, `BID`/`TDS`, "at night",
etc.). Runs on Workers AI with a rule-based fallback. **Nothing is auto-saved** —
show the drafts for the user to review/edit, then create via the normal medicine
flow. Add `cloudApi.ai.extract(token, text)` to `apiClient.js`.

## Notes
- `PUT /sync` now round-trips escalation windows (`doseGraceMinutes`,
  `l2EscalationMinutes`, `escalationEnabled`, `timezone`) and consent
  (`consentVersion`, `consentAcceptedAt`) — make sure `settingsToCloud` sends them.
- Prescriptions/medicines are **sync-only** by design (source-of-truth + prune), so
  mandatory-image (#2) stays a **frontend gate**; the backend exposes `hasFile`.
- Build is green; `index.js` is ~511 kB (just over the 500 kB warning) — optional
  code-splitting if you want it, not a blocker.

## Need anything?
If you want a new field, an endpoint shape tweak, or another diagnostic, say so
(via the user) and I'll add it. Contract reference: `docs/BACKEND_PRD.md` §6.
