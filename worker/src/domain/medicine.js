import { summarizeStock } from './stock.js'

// Parses the enabled_periods JSON column into a clean string array.
function parseEnabledPeriods(value) {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value !== 'string' || value.length === 0) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

// D1 row -> normalized medicine (camelCase, numbers coerced, periods parsed).
export function normalizeMedicineRow(row) {
  return {
    id: row.id,
    memberId: row.member_id ?? null,
    name: row.name,
    dosage: row.dosage ?? '',
    times: {
      morning: row.morning_time ?? null,
      afternoon: row.afternoon_time ?? null,
      night: row.night_time ?? null,
    },
    enabledPeriods: parseEnabledPeriods(row.enabled_periods),
    important: Boolean(row.important),
    refill: Boolean(row.refill),
    stockRemaining: row.stock_remaining ?? null,
    doseUnitsPerDose: Number(row.dose_units_per_dose ?? 1),
    stockBufferDays: Number(row.stock_buffer_days ?? 0),
    lowStockThreshold: row.low_stock_threshold ?? null,
    stockUnitLabel: row.stock_unit_label || 'tablets',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// Normalized medicine + its computed stock summary (rows #8, #10, #11).
export function toPublicMedicine(row, fromDate = new Date()) {
  const medicine = normalizeMedicineRow(row)
  return { ...medicine, stock: summarizeStock(medicine, fromDate) }
}
