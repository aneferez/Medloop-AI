export const assistantSectionOrder = [
  'home',
  'dashboard',
  'family',
  'medicines',
  'prescriptions',
  'alerts',
  'appointments',
  'reports',
  'emergency-card',
  'settings',
  'legal',
]

const sectionGuides = {
  home: {
    label: 'Home',
    title: 'Start with the essentials',
    description: 'Home shows setup progress and gives you the shortest path to a useful daily care plan.',
    tips: ['Add the person receiving care.', 'Add at least one medicine and its times.', 'Save the next appointment you want to remember.'],
  },
  dashboard: {
    label: 'Dashboard',
    title: 'Run today’s care routine',
    description: 'Use the dashboard to see the next scheduled dose, mark it Taken or Missed, and spot appointments or alerts.',
    tips: ['Confirm only doses that were actually taken.', 'A missed dose can create a family message draft.', 'Use Manage to change a medicine schedule.'],
  },
  family: {
    label: 'Family',
    title: 'Set up the care circle',
    description: 'Create profiles for yourself or loved ones, then connect medicines and optional family contact details.',
    tips: ['Use Level 1 for the primary contact.', 'Enter phone numbers with a country code for message drafts.', 'Review every contact detail before saving.'],
  },
  medicines: {
    label: 'Medicines',
    title: 'Build a safe reminder schedule',
    description: 'Record label details, choose dose periods, set times, and optionally track remaining stock.',
    tips: ['Copy the medicine name and dosage from the label.', 'Choose only the periods prescribed by a clinician.', 'MedLoop organizes reminders; it does not recommend a dose.'],
  },
  prescriptions: {
    label: 'Prescriptions',
    title: 'Keep prescription records together',
    description: 'Save the prescriber, clinic, written notes, and the prescription image for accurate reference.',
    tips: ['Make sure the full page is visible and readable.', 'Do not use an image as a substitute for professional advice.', 'Review the privacy notice before syncing prescription images.'],
  },
  alerts: {
    label: 'Alerts',
    title: 'Review items needing attention',
    description: 'Alerts collect missed doses, refill states, and low-stock notices generated from your saved records.',
    tips: ['Check the source record before acting.', 'For urgent symptoms, contact local emergency services.', 'Alerts are reminders, not clinical monitoring.'],
  },
  appointments: {
    label: 'Appointments',
    title: 'Keep the next visit visible',
    description: 'Save upcoming doctor or clinic visits so they appear in the daily care overview.',
    tips: ['Confirm the date and time with the clinic.', 'Use the clinic field for a location or branch name.', 'Edit the record if the visit is rescheduled.'],
  },
  reports: {
    label: 'Reports',
    title: 'Understand recorded adherence',
    description: 'Reports summarize the Taken and Missed actions recorded in MedLoop for the available history.',
    tips: ['Reports reflect only actions entered in the app.', 'Missing entries are not proof that a dose was missed.', 'Share context with a clinician before making care changes.'],
  },
  'emergency-card': {
    label: 'Emergency Card',
    title: 'Check critical details before sharing',
    description: 'The emergency card brings together saved profile, allergy, blood group, contact, and medicine details.',
    tips: ['Keep allergies and medicines current.', 'Verify the primary contact number.', 'Call emergency services directly in an emergency.'],
  },
  settings: {
    label: 'Settings',
    title: 'Control privacy and reminders',
    description: 'Manage your profile, device reminders, family-message preferences, encrypted backups, and account data.',
    tips: ['Test reminder access after enabling notifications.', 'Store backup files and passwords separately.', 'Deleting the account permanently removes its local data.'],
  },
  legal: {
    label: 'Privacy & Safety',
    title: 'Know what MedLoop can and cannot do',
    description: 'Review device and cloud data handling, reminder limitations, the medical disclaimer, and account-deletion information.',
    tips: ['MedLoop is not an emergency service.', 'It does not diagnose or recommend treatment.', 'Review where your records are stored before enabling sync.'],
  },
}

export function getSectionGuide(pageId) {
  return sectionGuides[pageId] || sectionGuides.dashboard
}

export function getNextAssistantSection(pageId) {
  const index = assistantSectionOrder.indexOf(pageId)
  return assistantSectionOrder[(index < 0 ? 0 : index + 1) % assistantSectionOrder.length]
}

export function getAssistantRecommendation(pageId, context = {}) {
  const familyCount = Number(context.familyCount || 0)
  const medicineCount = Number(context.medicineCount || 0)
  const appointmentCount = Number(context.appointmentCount || 0)
  const alertCount = Number(context.alertCount || 0)

  if (!familyCount) return { page: 'family', label: 'Add the first care profile', reason: 'This gives medicines and emergency details an owner.' }
  if (!medicineCount) return { page: 'medicines', label: 'Add the first medicine', reason: 'This creates the daily dose schedule.' }
  if (!appointmentCount) return { page: 'appointments', label: 'Save the next appointment', reason: 'This completes the basic care overview.' }
  if (alertCount && pageId !== 'alerts') return { page: 'alerts', label: `Review ${alertCount} alert${alertCount === 1 ? '' : 's'}`, reason: 'These items may need your attention.' }
  if (pageId !== 'dashboard') return { page: 'dashboard', label: 'Open today’s dashboard', reason: 'Your core setup is ready for daily use.' }
  return { page: 'medicines', label: 'Review medicine schedules', reason: 'Keep times, stock, and dose details current.' }
}

export function getAssistantStorageKey(userId) {
  return `medloop-section-assistant-${String(userId || 'local').replace(/[^a-z0-9_-]/gi, '_')}`
}
