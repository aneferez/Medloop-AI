import { computeRemainingDays, isLowStock } from './stock.js'

// Scheduled-job logic (rows #12, #13, #14) — pure helpers over normalized data.

// Local date/time parts in a given IANA time zone. Cron fires at fixed UTC
// times, so jobs use this to reason in the patient's local calendar.
export function localDateParts(now, timeZone = 'Asia/Kolkata') {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = {}
  for (const part of formatter.formatToParts(now)) parts[part.type] = part.value
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  }
}

// Row #13: enabled dose slots that are not marked taken today. `takenSet` holds
// `${medicineId}:${period}` keys that have been taken.
export function collectOutstandingDoses(medicines, takenSet) {
  const outstanding = []
  for (const medicine of medicines) {
    for (const period of medicine.enabledPeriods) {
      const key = `${medicine.id}:${period}`
      if (!takenSet.has(key)) outstanding.push({ medicineId: medicine.id, name: medicine.name, period })
    }
  }
  return outstanding
}

// Row #12: medicines that are low or predicted to run out within the horizon
// (default ~one monthly cycle). Untracked-stock medicines are ignored.
export function collectRestockNeeds(medicines, { horizonDays = 30 } = {}) {
  const needs = []
  for (const medicine of medicines) {
    if (medicine.stockRemaining == null) continue
    const low = isLowStock(medicine)
    const remainingDays = computeRemainingDays(medicine)
    const runningOutSoon = remainingDays != null && remainingDays <= horizonDays
    if (low || runningOutSoon) {
      needs.push({ id: medicine.id, name: medicine.name, stockRemaining: medicine.stockRemaining, remainingDays, low })
    }
  }
  return needs
}

const uniqueNames = (items) => [...new Set(items.map((item) => item.name))]

function summarizeNames(names, limit = 6) {
  const listed = names.slice(0, limit).join(', ')
  const more = names.length > limit ? ` +${names.length - limit} more` : ''
  return `${listed}${more}`
}

export function buildDailyCheckAlert(outstanding, { date } = {}) {
  const count = outstanding.length
  return {
    title: `Daily medicine check: ${count} dose${count === 1 ? '' : 's'} not taken`,
    detail: `At the daily check${date ? ` on ${date}` : ''}, these still need attention: ${summarizeNames(uniqueNames(outstanding))}.`,
    level: 'Level 2',
  }
}

export function buildRestockAlert(needs) {
  const count = needs.length
  return {
    title: `Restock reminder: ${count} medicine${count === 1 ? '' : 's'} running low`,
    detail: `These may run out soon: ${summarizeNames(needs.map((need) => need.name))}. Please arrange a refill.`,
    level: 'Level 2',
  }
}

// Cron schedules (UTC). Daily check ≈ 22:00 Asia/Kolkata; restock on the 20th;
// the escalation sweep runs every 15 minutes so a missed dose is escalated to
// caregivers within the grace window (feature #7). It reasons in each patient's
// local time zone, so a fixed UTC cadence is fine.
export const DAILY_CRON = '30 16 * * *'
export const RESTOCK_CRON = '30 3 20 * *'
export const ESCALATION_CRON = '*/15 * * * *'
