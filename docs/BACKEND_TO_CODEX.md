# Backend → Codex: hand-off note

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
