// Adherence reporting (#12) — pure aggregation over grouped dose-log counts.
// Input rows come from a GROUP BY medicine_id, status query:
//   { medicine_id, medicine_name, status, n }
// Adherence rate = taken / (taken + missed + skipped): the share of doses that
// were actually acted on and taken. Pending logs are counted in totals but not
// in the adherence denominator (they aren't yet resolved).

const STATUSES = ['taken', 'missed', 'skipped', 'pending']

const rate = (taken, denom) => (denom > 0 ? Math.round((taken / denom) * 1000) / 10 : null)

export function computeAdherence(rows = [], { rangeDays = 30, from = null, to = null } = {}) {
  const byMedicine = new Map()
  const overall = { taken: 0, missed: 0, skipped: 0, pending: 0, total: 0 }

  for (const row of rows) {
    const status = row.status
    const count = Number(row.n) || 0
    if (!byMedicine.has(row.medicine_id)) {
      byMedicine.set(row.medicine_id, {
        medicineId: row.medicine_id,
        name: row.medicine_name || '',
        taken: 0, missed: 0, skipped: 0, pending: 0, total: 0,
      })
    }
    const medicine = byMedicine.get(row.medicine_id)
    if (STATUSES.includes(status)) {
      medicine[status] += count
      overall[status] += count
    }
    medicine.total += count
    overall.total += count
  }

  const medicines = [...byMedicine.values()].map((medicine) => ({
    ...medicine,
    adherenceRate: rate(medicine.taken, medicine.taken + medicine.missed + medicine.skipped),
  }))

  return {
    rangeDays,
    from,
    to,
    overall: { ...overall, adherenceRate: rate(overall.taken, overall.taken + overall.missed + overall.skipped) },
    medicines,
  }
}
