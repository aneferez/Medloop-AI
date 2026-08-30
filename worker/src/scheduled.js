import { ESCALATION_CRON, RESTOCK_CRON } from './domain/schedule.js'
import { runScheduledJob } from './services/scheduledJobs.js'

// Scheduled (cron) dispatch entry point (rows #12, #13, #14, #17). Each cron
// carries its own schedule string, so the frequent escalation sweep is told
// apart from the daily check even when both match a given minute.
export async function runScheduled(event, env) {
  const cron = event && event.cron
  const job = cron === RESTOCK_CRON
    ? 'monthly_restock'
    : cron === ESCALATION_CRON
      ? 'escalation_sweep'
      : 'daily_medicine_check'
  return runScheduledJob(env, job)
}
