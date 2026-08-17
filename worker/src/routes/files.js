import { ok } from '../lib/http.js'
import { ApiError, badRequest, notFound } from '../lib/errors.js'
import { nowIso } from '../lib/ids.js'

// Prescription file storage in R2 (row #26). Optional: routes 503 when the FILES
// binding is absent, so R2 is never a hard dependency. To enable, create the
// bucket and uncomment the [[r2_buckets]] block in wrangler.toml.

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_BYTES = 10 * 1024 * 1024

function requireFiles(ctx) {
  if (!ctx.env.FILES) throw new ApiError(503, 'files_disabled', 'File storage (R2) is not enabled on this deployment.')
}

async function ownedPrescription(ctx) {
  const row = await ctx.db.first(
    'SELECT id, file_key FROM prescriptions WHERE id = ? AND patient_id = ?',
    [ctx.params.id, ctx.auth.patient.id],
  )
  if (!row) throw notFound('Prescription not found.')
  return row
}

export function registerFileRoutes(router) {
  // Upload/replace a prescription's file. Body is the raw bytes; the type comes
  // from Content-Type.
  router.put('/prescriptions/:id/file', async (ctx) => {
    requireFiles(ctx)
    await ownedPrescription(ctx)

    const contentType = ctx.request.headers.get('content-type') || 'application/octet-stream'
    if (!ALLOWED_TYPES.includes(contentType)) throw badRequest('Unsupported file type. Use JPEG, PNG, WebP, or PDF.')
    const buffer = await ctx.request.arrayBuffer()
    if (buffer.byteLength === 0) throw badRequest('The uploaded file is empty.')
    if (buffer.byteLength > MAX_BYTES) throw badRequest('Files must be 10 MB or smaller.')

    const key = `prescriptions/${ctx.auth.patient.id}/${ctx.params.id}`
    await ctx.env.FILES.put(key, buffer, { httpMetadata: { contentType } })
    await ctx.db.run(
      'UPDATE prescriptions SET file_key = ?, updated_at = ? WHERE id = ? AND patient_id = ?',
      [key, nowIso(), ctx.params.id, ctx.auth.patient.id],
    )
    return ok({ fileKey: key, size: buffer.byteLength, contentType }, { status: 201 })
  })

  // Stream the file back (authenticated; the client fetches it into a blob).
  router.get('/prescriptions/:id/file', async (ctx) => {
    requireFiles(ctx)
    const row = await ownedPrescription(ctx)
    if (!row.file_key) throw notFound('No file for this prescription.')
    const object = await ctx.env.FILES.get(row.file_key)
    if (!object) throw notFound('File is missing from storage.')
    const headers = new Headers()
    headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream')
    headers.set('Cache-Control', 'private, max-age=60')
    return new Response(object.body, { status: 200, headers })
  })

  router.delete('/prescriptions/:id/file', async (ctx) => {
    requireFiles(ctx)
    const row = await ownedPrescription(ctx)
    if (row.file_key) await ctx.env.FILES.delete(row.file_key)
    await ctx.db.run(
      'UPDATE prescriptions SET file_key = NULL, updated_at = ? WHERE id = ? AND patient_id = ?',
      [nowIso(), ctx.params.id, ctx.auth.patient.id],
    )
    return ok({ deleted: true })
  })
}
