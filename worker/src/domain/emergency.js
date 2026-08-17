// Emergency / SOS domain (rows #20, #21, #23) — pure helpers.

export const EMERGENCY_STATUSES = ['pending_confirm', 'confirmed', 'cancelled', 'resolved']

// Message a confirmed SOS sends to family (row #22).
export function buildEmergencyMessage(patientName, note) {
  const name = String(patientName || '').trim() || 'A MedLoop user'
  const trimmedNote = String(note || '').trim()
  return {
    title: `Emergency SOS from ${name}`,
    detail: trimmedNote
      ? `${name} triggered an emergency SOS: ${trimmedNote}`
      : `${name} triggered an emergency SOS. Please respond immediately.`,
  }
}

// Row #21: the tel: URI the app uses for the one-tap native call. `contact` is
// a public family member (has `phone`).
export function emergencyCallLink(contact) {
  if (!contact || !contact.phone) return null
  return `tel:${contact.phone}`
}

function safeParseArray(value) {
  if (Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function toPublicEmergencyEvent(row) {
  return {
    id: row.id,
    status: row.status,
    primaryContactId: row.primary_contact_id ?? null,
    channels: safeParseArray(row.channels),
    note: row.note ?? null,
    triggeredAt: row.triggered_at,
    confirmedAt: row.confirmed_at ?? null,
    resolvedAt: row.resolved_at ?? null,
  }
}
