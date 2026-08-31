# MedLoop — Frontend integration status

This document is the handoff between the React/Capacitor client and the
Cloudflare Worker contract in `docs/BACKEND_PRD.md` (§6 and §10).

## Implemented in the frontend

- Server account sign-up/login, email verification, resend verification, and
  password-reset completion are wired through `src/lib/cloud/session.js` and
  `src/lib/cloud/apiClient.js`.
- Cloud accounts retain an encrypted local shadow account so offline-first
  screens continue to work without storing the server password locally.
- Cloudflare Turnstile is mounted on cloud sign-up when
  `VITE_TURNSTILE_SITE_KEY` is configured.
- Settings sync now includes timezone, dose grace, L2 escalation timing,
  escalation enablement, and consent metadata.
- The assistant calls `/ai/assistant` and the prescription helper calls
  `/ai/simplify`; prescription OCR text can also be sent to `/ai/extract` for
  structured medicine drafts. The backend response disclaimer is rendered
  verbatim and refusal/rate-limit states are handled. Extracted medicines stay
  editable drafts until the user reviews them in the normal Medicines form.
- Family caregiver invites, acceptance, permission editing, revocation, and
  permission-scoped patient inventory/dose/adherence views are available on
  the Family screen.
- Caregivers also receive a single `/caregiver/dashboard` card feed with one
  permission-gated summary card per linked patient. Inventory and today’s dose
  checks are rendered only when the patient granted those permissions; the
  existing detailed view remains available for deeper review.
- Reports calls `/stock/summary` and `/adherence` for predictive stock and
  30-day adherence insights.
- Account export and password-confirmed cloud deletion are available in
  Settings.
- Settings includes an authenticated cloud configuration diagnostic that shows
  channel status booleans only; it never returns or displays secret values.
- Push handling uses only an opaque `data.alertId`, then fetches alert details
  from the authenticated API. Medicine details are not read from push payloads
  or logged.
- On-device ML Kit OCR, mandatory prescription-image validation, emergency-card
  selection, consent versioning, and the existing local-first sync remain in
  place. OCR supports selectable English/Latin and Hindi/Devanagari recognition
  on Android; Tamil remains a manual-entry path because it is not supported by
  the bundled ML Kit Text Recognition plugin.

## Production deployment status

The Worker at `https://medloop-api.aneruth-medloop.workers.dev` was migrated
through `0008_settings_consent.sql` and deployed with the scheduled daily,
monthly-restock, and 15-minute escalation triggers. The following route smoke
checks now pass at the expected boundary:

| Route | Expected unauthenticated result |
| --- | --- |
| `/v1/health` | `200` readiness response |
| `/v1/auth/signup` | `422` validation response for an empty body |
| `/v1/caregivers` | `401` authentication required |
| `/v1/caregiver/patients` | `401` authentication required |
| `/v1/ai/assistant` | `405` because the smoke check used `GET`; the client uses `POST` |
| `/v1/account/export` | `401` authentication required |

The Family page was refreshed after deployment and no longer shows the prior
`Not found.` error. Authenticated flows still require a real test account and
must not be tested with a production patient’s password.

The production web build is deployed to
`https://medloop-app.pages.dev`; direct navigation to `/`, `/family`, and
`/prescriptions` return the SPA shell successfully. The immutable deployment
URL for this release is `https://516df211.medloop-app.pages.dev`.

The production bundle uses explicit vendor splitting: the main entry is about
135 kB and the largest vendor chunk is about 425 kB, below the 500 kB warning
threshold.

## Required environment and release checks

- Set `VITE_MEDLOOP_API_URL` to the deployed Worker URL before the production
  web build.
- If Turnstile enforcement is enabled in the Worker, set the matching public
  `VITE_TURNSTILE_SITE_KEY` in the web build and keep `TURNSTILE_SECRET` only in
  Worker secrets.
- Email verification/reset delivery needs `RESEND_API_KEY` and `EMAIL_FROM`.
- AI runs through the Worker's configured `[ai]` binding by default; no external
  key is required. `MEDLOOP_AI_API_KEY` is optional and only enables the
  configured external fallback path.
- FCM delivery needs the existing FCM Worker secrets. Pushes remain generic.
- Android killed-app push processing and exact alarm delivery still need testing
  on physical devices under reboot and battery-restriction conditions.

## Architecture note

The current cloud backend is Cloudflare Worker + D1 + R2, not Firebase
Firestore. Firebase is used for push delivery. Migrating the app to Firestore
would be a separate backend architecture change and is not required for the
current Worker contract.
