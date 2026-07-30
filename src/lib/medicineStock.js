const DEFAULT_STOCK_UNIT = 'tablets'
const DEFAULT_DOSE_UNITS = 1
const DEFAULT_BUFFER_DAYS = 7

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function normalizeStockRemaining(value) {
  const number = finiteNumber(value)
  return number === null ? null : Math.max(0, Math.floor(number))
}

export function normalizeDoseUnits(value) {
  const number = finiteNumber(value)
  return number === null || number <= 0 ? DEFAULT_DOSE_UNITS : Math.max(0.1, number)
}

export function normalizeBufferDays(value) {
  const number = finiteNumber(value)
  return number === null || number < 0 ? DEFAULT_BUFFER_DAYS : Math.max(0, Math.floor(number))
}

export function normalizeStockUnit(value) {
  const unit = String(value || DEFAULT_STOCK_UNIT).trim().slice(0, 24)
  return unit || DEFAULT_STOCK_UNIT
}

export function normalizeMedicineStock(medicine) {
  return {
    stockRemaining: normalizeStockRemaining(medicine?.stockRemaining),
    doseUnitsPerDose: normalizeDoseUnits(medicine?.doseUnitsPerDose),
    stockBufferDays: normalizeBufferDays(medicine?.stockBufferDays),
    stockUnitLabel: normalizeStockUnit(medicine?.stockUnitLabel),
  }
}

export function isStockTracked(medicine) {
  return normalizeStockRemaining(medicine?.stockRemaining) !== null
}

export function getDailyStockUse(medicine, enabledDoseCount = 0) {
  if (!isStockTracked(medicine)) return 0
  return normalizeDoseUnits(medicine?.doseUnitsPerDose) * Math.max(0, enabledDoseCount)
}

export function getBufferStock(medicine, enabledDoseCount = 0) {
  return getDailyStockUse(medicine, enabledDoseCount) * normalizeBufferDays(medicine?.stockBufferDays)
}

export function isStockLow(medicine, enabledDoseCount = 0) {
  if (!isStockTracked(medicine)) return false
  const stock = normalizeStockRemaining(medicine?.stockRemaining)
  const dailyUse = getDailyStockUse(medicine, enabledDoseCount)
  if (stock === null) return false
  if (stock <= 0) return true
  if (dailyUse <= 0) return false
  return stock <= getBufferStock(medicine, enabledDoseCount)
}

export function formatStockAmount(value, unit = DEFAULT_STOCK_UNIT) {
  const number = normalizeStockRemaining(value)
  if (number === null) return 'Not set'
  return `${number} ${normalizeStockUnit(unit)}`
}
