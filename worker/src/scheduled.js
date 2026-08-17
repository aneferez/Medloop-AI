import { RESTOCK_CRON } from './domain/schedule.js'
import { runScheduledJob } from './services/scheduledJobs.js'

// Scheduled (cron) dispatch entry point (rows #12, #13, #14). The restock cron
// fires only on the 20th; every other tick runs the daily medicine check.
export async function runScheduled(event, env) {
  const cron = event && event.cron
  const job = cron === RESTOCK_CRON ? 'monthly_restock' : 'daily_medicine_check'
  return runScheduledJob(env, job)
}
