import { ok, readJsonBodyOptional } from '../lib/http.js'
import { runDailyMedicineCheck, runEscalationCheck, runRestockCheck } from '../services/scheduledJobs.js'

// Manual triggers for the scheduled jobs (row #14) so the app can force a check
// and so the behavior is inspectable without waiting for cron. All run only for
// the authenticated patient and are idempotent for the current period.
export function registerJobRoutes(router) {
  router.post('/jobs/daily-check', async (ctx) => {
    const result = await runDailyMedicineCheck(ctx, { now: new Date() })
    return ok(result)
  })

  router.post('/jobs/restock-check', async (ctx) => {
    const result = await runRestockCheck(ctx, { now: new Date() })
    return ok(result)
  })

  // Missed-dose escalation sweep for this patient (feature #7). Outside
  // production the caller may pass { now: ISO } to drive the state machine at a
  // fixed instant — this is what makes the staggered timing deterministically
  // testable without waiting on the clock.
  router.post('/jobs/escalation-check', async (ctx) => {
    let now = new Date()
    if (ctx.config.environment !== 'production') {
      const body = await readJsonBodyOptional(ctx.request)
      if (body.now && !Number.isNaN(Date.parse(body.now))) now = new Date(body.now)
    }
    const result = await runEscalationCheck(ctx, { now })
    return ok(result)
  })

  // Recent scheduled-job runs (observability).
  router.get('/jobs/runs', async (ctx) => {
    const rows = await ctx.db.all('SELECT * FROM cron_runs ORDER BY started_at DESC LIMIT 50')
    return ok({
      runs: rows.map((row) => ({
        id: row.id,
        job: row.job,
        status: row.status,
        startedAt: row.started_at,
        finishedAt: row.finished_at ?? null,
        detail: row.detail ?? null,
      })),
    })
  })
}
