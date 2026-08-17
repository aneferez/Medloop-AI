import { ok } from '../lib/http.js'
import { runDailyMedicineCheck, runRestockCheck } from '../services/scheduledJobs.js'

// Manual triggers for the scheduled jobs (row #14) so the app can force a check
// and so the behavior is inspectable without waiting for cron. Both run only
// for the authenticated patient and are idempotent for the current period.
export function registerJobRoutes(router) {
  router.post('/jobs/daily-check', async (ctx) => {
    const result = await runDailyMedicineCheck(ctx, { now: new Date() })
    return ok(result)
  })

  router.post('/jobs/restock-check', async (ctx) => {
    const result = await runRestockCheck(ctx, { now: new Date() })
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
