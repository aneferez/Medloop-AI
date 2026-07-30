export const pages = [
  { id: 'home', path: '/', label: 'Home' },
  { id: 'dashboard', path: '/dashboard', label: 'Dashboard' },
  { id: 'family', path: '/family', label: 'Family' },
  { id: 'medicines', path: '/medicines', label: 'Medicines' },
  { id: 'prescriptions', path: '/prescriptions', label: 'Prescriptions' },
  { id: 'alerts', path: '/alerts', label: 'Alerts' },
  { id: 'appointments', path: '/appointments', label: 'Appointments' },
  { id: 'reports', path: '/reports', label: 'Reports' },
  { id: 'emergency-card', path: '/emergency-card', label: 'Emergency Card' },
  { id: 'settings', path: '/settings', label: 'Settings' },
  { id: 'legal', path: '/privacy', label: 'Privacy & Safety' },
]

export const pageByPath = pages.reduce(
  (lookup, page) => ({ ...lookup, [page.path]: page.id }),
  { '/auth': 'auth' },
)

export const pageById = pages.reduce(
  (lookup, page) => ({ ...lookup, [page.id]: page }),
  {},
)
