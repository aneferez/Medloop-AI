import { forbidden, notFound } from '../lib/errors.js'
import { hasPermission } from '../domain/caregiver.js'

// Gate access to a patient's data (guardrails G4/G5). The account owner always
// has full access to their own patient; anyone else needs an ACTIVE caregiver
// link that grants the required permission. Returns { patient, link, isOwner }
// or throws 403/404. Revoking a link denies access immediately, because only
// status='active' rows match.
export async function authorizePatientAccess(ctx, patientId, permission) {
  const patient = await ctx.db.first(
    'SELECT id, owner_user_id, display_name FROM patients WHERE id = ?',
    [patientId],
  )
  if (!patient) throw notFound('Patient not found.')

  const user = ctx.auth.user
  if (ctx.auth.patient.id === patientId || (user && patient.owner_user_id === user.id)) {
    return { patient, link: null, isOwner: true }
  }

  if (!user) throw forbidden('This session cannot access another account.')
  const link = await ctx.db.first(
    "SELECT * FROM caregiver_links WHERE patient_id = ? AND caregiver_user_id = ? AND status = 'active'",
    [patientId, user.id],
  )
  if (!link) throw forbidden('You do not have access to this patient.')
  if (permission && !hasPermission(link, permission)) throw forbidden('You do not have permission for this.')
  return { patient, link, isOwner: false }
}
