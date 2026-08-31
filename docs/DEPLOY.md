# MedLoop — Backend Deploy Runbook (Cloudflare Worker + D1)

Run from the `worker/` directory. First time on a machine: `npx wrangler login`.
Secrets and the GCP-key restriction are in `docs/SECURITY_RUNBOOK.md`.

## 0. One-time: production secrets
```bash
cd worker
# push messaging
npx wrangler secret put FCM_PROJECT_ID
npx wrangler secret put FCM_CLIENT_EMAIL
npx wrangler secret put FCM_PRIVATE_KEY
# email (verification / reset / alerts)
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put EMAIL_FROM
# MedLoop AI assistant — runs on Cloudflare Workers AI (the [ai] binding) by
# default, no key needed. Only set this to use an Anthropic fallback instead:
# npx wrangler secret put MEDLOOP_AI_API_KEY
# optional
npx wrangler secret put TURNSTILE_SECRET
npx wrangler secret put TOKEN_SIGNING_SECRET
```
`wrangler secret list` to confirm. (Non-secret vars like `ENVIRONMENT` live in `wrangler.toml`.)

## 1. Apply D1 migrations
Migrations `0001`–`0008` are in `worker/migrations/`. Dry-run locally first, then apply to production.
```bash
cd worker
npx wrangler d1 migrations list medloop --remote      # shows pending
npx wrangler d1 migrations apply medloop --local       # local sanity check
npx wrangler d1 migrations apply medloop --remote       # PRODUCTION
```
> These are additive (new tables + nullable columns); they do not drop or rewrite patient data.

## 2. Deploy the Worker
```bash
cd worker
npx wrangler deploy
```
This publishes the gateway and registers the cron triggers (daily check, monthly
restock, and the `*/15` missed-dose escalation sweep).

## 3. Smoke-test
```bash
# health (public)
curl https://<your-worker>.workers.dev/v1/health
# a signup should return a token (rate-limited, so use a throwaway email)
curl -s -X POST https://<your-worker>.workers.dev/v1/auth/signup \
  -H 'content-type: application/json' \
  -d '{"email":"smoke@example.com","password":"smoke test 8"}'
```
Then set the app's `VITE_MEDLOOP_API_URL` to the Worker URL and rebuild the client.

## 4. Observe & roll back
```bash
npx wrangler tail                       # live logs
```
- Cron runs are logged in the `cron_runs` D1 table (`daily_medicine_check`,
  `monthly_restock`, `escalation_sweep`).
- Roll back a bad deploy: `npx wrangler rollback` (or `wrangler deployments list`
  then `wrangler rollback <id>`). D1 migrations are forward-only — never hand-drop
  a column on a live DB; add a compensating migration instead.

## Notes
- The AI assistant runs on **Cloudflare Workers AI** (the `[ai]` binding) by
  default — **no key needed**. `MEDLOOP_AI_API_KEY` only switches it to an
  Anthropic fallback. Either way `/ai/*` always enforces the guardrails.
- Without `FCM_*` / `RESEND_*` those channels record as "skipped" — deploy is safe;
  delivery turns on when the secrets are set.
- CORS origins are in `wrangler.toml` `ALLOWED_ORIGINS` — add the production web
  origin (e.g. `*.pages.dev` or your domain) before the web app goes live.
