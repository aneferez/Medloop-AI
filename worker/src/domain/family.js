// Pure family-member domain rules — no I/O, fully unit-testable. These operate
// on raw D1 rows (snake_case) so the alert service (Module C) and the emergency
// system (Module F) can reuse them.

export const FAMILY_ALERT_LEVELS = ['Level 1', 'Level 2', 'Level 3']

// Row -> API shape (camelCase, nested channel prefs, no raw fcm token).
export function toPublicFamilyMember(row) {
  return {
    id: row.id,
    name: row.name,
    relationship: row.relationship,
    phone: row.phone ?? null,
    whatsappNumber: row.whatsapp_number ?? null,
    email: row.email ?? null,
    hasFcmToken: Boolean(row.fcm_token),
    alertLevel: row.alert_level,
    isPrimaryEmergency: Boolean(row.is_primary_emergency),
    notify: {
      push: Boolean(row.notify_push),
      whatsapp: Boolean(row.notify_whatsapp),
      email: Boolean(row.notify_email),
      sms: Boolean(row.notify_sms),
    },
    age: row.age ?? null,
    bloodGroup: row.blood_group ?? null,
    allergies: row.allergies ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// Row #4: alerts always go to the most recently updated family member. Ties are
// broken by the most recently created member for determinism.
export function selectLatestUpdatedMember(members = []) {
  return members.reduce((latest, member) => {
    if (!latest) return member
    const updated = member.updated_at || ''
    const bestUpdated = latest.updated_at || ''
    if (updated > bestUpdated) return member
    if (updated < bestUpdated) return latest
    const created = member.created_at || ''
    const bestCreated = latest.created_at || ''
    return created >= bestCreated ? member : latest
  }, null)
}

// Row #19: the emergency contact to act on first. Explicit primary wins; then
// the Level 1 member (latest updated if several); then the latest updated of
// anyone. Used by the one-tap call and SOS flow (Module F).
export function selectPrimaryEmergencyContact(members = []) {
  if (!members.length) return null
  const explicit = members.filter((member) => Boolean(member.is_primary_emergency))
  if (explicit.length) return selectLatestUpdatedMember(explicit)
  const levelOne = members.filter((member) => member.alert_level === 'Level 1')
  if (levelOne.length) return selectLatestUpdatedMember(levelOne)
  return selectLatestUpdatedMember(members)
}

// Recipients for a given alert level: a member is in scope when their level is
// at least as urgent as the alert. Level 1 is most urgent.
export function selectMembersForAlertLevel(members = [], alertLevel = 'Level 3') {
  const threshold = FAMILY_ALERT_LEVELS.indexOf(alertLevel)
  const cutoff = threshold === -1 ? FAMILY_ALERT_LEVELS.length - 1 : threshold
  return members.filter((member) => {
    const rank = FAMILY_ALERT_LEVELS.indexOf(member.alert_level)
    return rank !== -1 && rank <= cutoff
  })
}
