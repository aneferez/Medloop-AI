# MedLoop API — Cloudflare Worker + D1

The MedLoop cloud backend. A single Worker acts as the **API gateway** (central
routing, validation, security, auth) in front of a **D1** database that holds the
unified MedLoop data layer. File storage (R2) and scheduled jobs (Cron) are
optional add-ons wired in by later modules.

The app remains local-first, while this tier adds server identity, consented
caregiver access, predictive stock/adherence queries, AI guardrails, account
export/deletion, and scheduled notification orchestration.

## Layout

```
worker/
├── wrangler.toml              # bindings + config
├── .dev.vars.example          # local secret template (copy to .dev.vars)
├── migrations/
│   └── 0001_initial_schema.sql  # the whole D1 data layer (row #24)
└── src/
    ├── index.js               # gateway: fetch + scheduled handlers
    ├── router.js              # method+path router with :params
    ├── config.js              # env -> config
    ├── scheduled.js           # cron dispatch (Module E fills this in)
    ├── lib/                   # errors, http/cors envelopes, ids, validation
    ├── middleware/            # cors, bearer-token auth
    ├── db/d1.js               # parameterized D1 helpers
    └── routes/                # system, server auth, family, caregiver, AI, data
```

## First-time setup

```bash
cd worker
npm install
npm run db:create          # prints a database_id
# paste database_id into wrangler.toml -> [[d1_databases]]
npm run db:migrate:local   # apply schema to the local D1
cp .dev.vars.example .dev.vars   # fill in secrets as modules need them
npm run dev                # http://localhost:8787
```

Smoke test:

```bash
curl http://localhost:8787/v1/health
```

Deploy:

```bash
npm run db:migrate         # apply migrations to remote D1
npm run deploy
```

## Auth model

New accounts use `POST /v1/auth/signup` and `POST /v1/auth/login` with an email
and password. Each response mints a device bearer token; only its hash is kept
server-side. Email verification and password reset are single-use token flows.
The legacy `POST /v1/auth/register` device-only path remains for offline/local
accounts and existing installations. Multi-device linking uses
`/v1/auth/link-device` from an authenticated device.

## Endpoints

All paths are prefixed with `/v1`. Everything except the three public routes
requires `Authorization: Bearer <token>`. Response envelope:
`{ "ok": true, "data": ... }` or
`{ "ok": false, "error": { "code", "message", "details?" } }`.

**Foundation (Module A)** — `GET /health` (public), `GET /meta` (public),
`POST /auth/register`, `POST /auth/signup`, `POST /auth/login`,
`POST /auth/verify-email`, `POST /auth/password/reset-request`,
`POST /auth/password/reset`, `GET /auth/session`, `POST /auth/link-device`,
`PATCH /auth/device`, `POST /auth/revoke`, `GET /account/export`,
`DELETE /account`.

**Family (Module D)** — `GET/POST /family`, `GET /family/primary`,
`GET /family/alert-target`, `GET/PATCH/DELETE /family/:id`,
`POST /family/:id/primary`, `POST /family/:id/invite`.

**Caregiver network** — `POST /caregiver/accept`, `GET /caregiver/patients`,
`GET /caregiver/inventory`, `GET /caregivers`, `PATCH /caregivers/:linkId`,
`POST /caregivers/:linkId/revoke`, and permission-scoped
`GET /patients/:id/inventory`, `/doses`, `/adherence`.

**Medicine & stock (Module B)** — `GET/POST /medicines`,
`GET/PATCH/DELETE /medicines/:id`, `POST /medicines/:id/dose`,
`GET /medicines/:id/doses`, `POST /medicines/:id/restock`, `GET /stock/summary`.

**Alerts & notifications (Module C)** — `GET/POST /alerts`, `PATCH /alerts/:id`,
`GET /alerts/:id/notifications`, `GET /notifications`, `GET/PATCH /settings`.

**Scheduled jobs (Module E)** — `POST /jobs/daily-check`,
`POST /jobs/restock-check`, `GET /jobs/runs`. Also runs automatically via the
cron triggers in `wrangler.toml`.

**AI safety** — `POST /ai/assistant` and `POST /ai/simplify`. Both validate,
rate-limit, and apply server-side safety policy; the client pre-filter is only a
fast UX layer.

**Emergency / SOS (Module F)** — `POST /emergency` (trigger, pending confirm),
`POST /emergency/:id/confirm`, `POST /emergency/:id/cancel`,
`GET /emergency`, `GET /emergency/:id`.

## Channels & secrets

Push (FCM) and WhatsApp send only when their secrets are set (see
`.dev.vars.example`); otherwise attempts are recorded with status `skipped` and
the rest of the pipeline still works. Email is a stub pending a provider.

## Frontend client

`src/lib/cloud/apiClient.js` (in the app, not this folder) wraps these
endpoints. Set `VITE_MEDLOOP_API_URL` to enable it; leaving it empty keeps the
app fully offline/local-first.

## Tests

Run from the repo root with `npx vitest run`:

- **Unit** (`tests/worker*.test.js`, `tests/cloud*.test.js`) — pure domain logic
  (stock math, dose transitions, notification/emergency planning, validators,
  sync sanitizers, client mappers).
- **Integration** (`tests/integration.*.test.js`) — drive the real
  `worker.fetch` end to end against an in-memory SQLite D1 (adapter in
  `tests/helpers/testWorker.js`), covering routing, auth, the stock/dose engine,
  alert dispatch + notification history, `PUT /sync` upsert/delete, the
  cross-tenant guard, emergency confirm/cancel, and the cron jobs. No
  workerd/wrangler required — SQLite is the same engine D1 runs on.
