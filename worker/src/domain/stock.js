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
