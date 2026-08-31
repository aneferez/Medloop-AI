// Family-network caregiver access (features #3/#6, task #6) — pure helpers.

// The permissions a caregiver link can grant. Kept deliberately small and
// medication-focused (guardrail G1): read-only views + who receives alerts.
export const CAREGIVER_PERMISSIONS = [
  'view_inventory',    // see stock levels
  'view_doses',        // see today's taken / not-taken status (feature #6)
  'view_adherence',    // see adherence history/reports
  'receive_escalations', // be alerted on missed doses (feature #7)
  'view_emergency',    // see emergency card / SOS
]

// A first-line (Level 1) caregiver gets the full read + alert set by default.
export const DEFAULT_CAREGIVER_PERMISSIONS = [...CAREGIVER_PERMISSIONS]

// Keeps only recognized permission strings, de-duplicated.
export function normalizePermissions(input) {
  if (!Array.isArray(input)) return null
  return [...new Set(input.map(String))].filter((perm) => CAREGIVER_PERMISSIONS.includes(perm))
}

// Parses the stored JSON permissions column into a clean array.
export function parsePermissions(value) {
  if (Array.isArray(value)) return value.filter((perm) => CAREGIVER_PERMISSIONS.includes(String(perm)))
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed.filter((perm) => CAREGIVER_PERMISSIONS.includes(String(perm))) : []
  } catch {
    return []
  }
}

export function hasPermission(link, permission) {
  if (!link) return false
  return parsePermissions(link.permissions).includes(permission)
}

// caregiver_links row -> API shape. `patient` is an optional summary attached for
// the caregiver-facing listings.
export function toPublicCaregiverLink(row, { patient } = {}) {
  return {
    id: row.id,
    patientId: row.patient_id,
    caregiverUserId: row.caregiver_user_id ?? null,
    familyMemberId: row.family_member_id ?? null,
    alertLevel: row.alert_level,
    permissions: parsePermissions(row.permissions),
    status: row.status,
    label: row.label ?? '',
    createdAt: row.created_at,
    acceptedAt: row.accepted_at ?? null,
    revokedAt: row.revoked_at ?? null,
    ...(patient ? { patient } : {}),
  }
}
