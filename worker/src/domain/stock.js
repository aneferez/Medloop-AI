// Automatic stock engine (rows #8, #9, #10, #11) — pure math over a normalized
// medicine object: { enabledPeriods, doseUnitsPerDose, stockRemaining,
// stockBufferDays, lowStockThreshold, stockUnitLabel }.

// Units consumed per day = (number of enabled dose periods) x (units per dose).
export function computeDailyConsumption(medicine) {
  const periods = Array.isArray(medicine.enabledPeriods) ? medicine.enabledPeriods : []
  const perDose = Number(medicine.doseUnitsPerDose)
  if (!Number.isFinite(perDose) || perDose < 0) return 0
  return periods.length * perDose
}

// Row #10: the low-stock trigger. An explicit threshold wins; otherwise derive
// it as "enough to cover the configured buffer of days".
export function computeLowStockThreshold(medicine) {
  if (medicine.lowStockThreshold != null && Number.isFinite(Number(medicine.lowStockThreshold))) {
    return Number(medicine.lowStockThreshold)
  }
  const daily = computeDailyConsumption(medicine)
  const bufferDays = Number(medicine.stockBufferDays)
  if (!Number.isFinite(bufferDays) || bufferDays < 0) return 0
  return Math.ceil(daily * bufferDays)
}

// Row #11: whole days of supply left. null when there is no schedule to consume
// stock, or when stock is not being tracked.
export function computeRemainingDays(medicine) {
  if (medicine.stockRemaining == null) return null
  const daily = computeDailyConsumption(medicine)
  if (daily <= 0) return null
  return Math.floor(Number(medicine.stockRemaining) / daily)
}

export function isLowStock(medicine) {
  if (medicine.stockRemaining == null) return false
  return Number(medicine.stockRemaining) <= computeLowStockThreshold(medicine)
}

// Local YYYY-MM-DD the supply is projected to run out, or null when unknown.
export function projectRunOutDate(medicine, fromDate = new Date()) {
  const days = computeRemainingDays(medicine)
  if (days == null) return null
  const date = new Date(fromDate)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

// Row #8: the full stock picture the app and alert service consume.
export function summarizeStock(medicine, fromDate = new Date()) {
  return {
    stockRemaining: medicine.stockRemaining ?? null,
    unitLabel: medicine.stockUnitLabel || 'tablets',
    dailyConsumption: computeDailyConsumption(medicine),
    lowStockThreshold: computeLowStockThreshold(medicine),
    remainingDays: computeRemainingDays(medicine),
    low: isLowStock(medicine),
    tracked: medicine.stockRemaining != null,
    runOutDate: projectRunOutDate(medicine, fromDate),
  }
}

// Applies a stock change without dropping below zero. Returns the new balance.
export function applyStockDelta(stockRemaining, delta) {
  const base = Number(stockRemaining) || 0
  return Math.max(0, base + delta)
}

// --- Predictive stock (feature #4) ------------------------------------------
// Days of dose history used to estimate real consumption, and the minimum
// number of taken doses before we trust the observed rate over the nominal one.
export const CONSUMPTION_WINDOW_DAYS = 14
const MIN_OBSERVATIONS = 3

// Shift a YYYY-MM-DD date string by whole days (UTC math on the date only).
export function shiftIsoDate(dateStr, deltaDays) {
  const date = new Date(`${dateStr}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + deltaDays)
  return date.toISOString().slice(0, 10)
}

// Observed units/day from actual taken doses over a window (feature #4): a
// patient who takes doses more or less often than scheduled is modelled from
// what really happened, not the nominal plan.
export function observedDailyConsumption({ takenDoses = 0, windowDays = CONSUMPTION_WINDOW_DAYS, unitsPerDose = 1 } = {}) {
  const days = Number(windowDays)
  const doses = Number(takenDoses)
  const perDose = Number(unitsPerDose)
  if (!Number.isFinite(days) || days <= 0) return 0
  if (!Number.isFinite(doses) || doses < 0) return 0
  if (!Number.isFinite(perDose) || perDose < 0) return 0
  return (doses / days) * perDose
}

// Pick the daily rate to predict with: the observed rate once there is enough
// history, otherwise the nominal schedule rate.
export function effectiveDailyConsumption(medicine, { takenDoses = 0, windowDays = CONSUMPTION_WINDOW_DAYS } = {}) {
  const observed = observedDailyConsumption({ takenDoses, windowDays, unitsPerDose: medicine.doseUnitsPerDose })
  const nominal = computeDailyConsumption(medicine)
  const enoughHistory = Number(takenDoses) >= MIN_OBSERVATIONS && observed > 0
  return { daily: enoughHistory ? observed : nominal, basis: enoughHistory ? 'observed' : 'nominal' }
}

export function predictRemainingDays(stockRemaining, dailyUnits) {
  if (stockRemaining == null) return null
  const daily = Number(dailyUnits)
  if (!Number.isFinite(daily) || daily <= 0) return null
  return Math.floor(Number(stockRemaining) / daily)
}

export function predictRunOutDate(stockRemaining, dailyUnits, fromDate = new Date()) {
  const days = predictRemainingDays(stockRemaining, dailyUnits)
  if (days == null) return null
  const date = new Date(fromDate)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

// The prediction block layered onto the base stock summary. `takenDoses` is the
// count of 'taken' dose logs over `windowDays`. `predictedLow` also fires when a
// medicine is projected to fall inside its buffer window, ahead of hitting the
// static threshold.
export function predictStock(medicine, { takenDoses = 0, windowDays = CONSUMPTION_WINDOW_DAYS, fromDate = new Date() } = {}) {
  const { daily, basis } = effectiveDailyConsumption(medicine, { takenDoses, windowDays })
  const predictedDaysRemaining = predictRemainingDays(medicine.stockRemaining, daily)
  const bufferDays = Number(medicine.stockBufferDays)
  const predictedLow = medicine.stockRemaining != null && (
    isLowStock(medicine)
    || (predictedDaysRemaining != null && Number.isFinite(bufferDays) && predictedDaysRemaining <= bufferDays)
  )
  return {
    basis, // 'observed' | 'nominal'
    observedDailyConsumption: observedDailyConsumption({ takenDoses, windowDays, unitsPerDose: medicine.doseUnitsPerDose }),
    predictedDailyConsumption: daily,
    predictedDaysRemaining,
    predictedRunOutDate: predictRunOutDate(medicine.stockRemaining, daily, fromDate),
    predictedLow,
    windowDays,
    takenDoses,
  }
}
