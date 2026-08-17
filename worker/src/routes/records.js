import { ok } from '../lib/http.js'

// Read-only lists for prescriptions and appointments. Writes flow through
// PUT /sync (the app is source of truth), but these let the cloud/web read them.
export function registerRecordRoutes(router) {
  router.get('/prescriptions', async (ctx) => {
    const rows = await ctx.db.all(
      'SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY created_at DESC',
      [ctx.auth.patient.id],
    )
    return ok({
      prescriptions: rows.map((row) => ({
        id: row.id,
        doctor: row.doctor,
        clinic: row.clinic,
        notes: row.notes,
        hasFile: Boolean(row.file_key),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    })
  })

  router.get('/appointments', async (ctx) => {
    const rows = await ctx.db.all(
      'SELECT * FROM appointments WHERE patient_id = ? ORDER BY date ASC, time ASC',
      [ctx.auth.patient.id],
    )
    return ok({
      appointments: rows.map((row) => ({
        id: row.id,
        doctor: row.doctor,
        clinic: row.clinic,
        date: row.date,
        time: row.time,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    })
  })
}
