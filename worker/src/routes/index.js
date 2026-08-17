import { registerSystemRoutes } from './system.js'
import { registerAuthRoutes } from './auth.js'
import { registerFamilyRoutes } from './family.js'
import { registerMedicineRoutes } from './medicines.js'
import { registerAlertRoutes } from './alerts.js'
import { registerSettingsRoutes } from './settings.js'
import { registerJobRoutes } from './jobs.js'
import { registerEmergencyRoutes } from './emergency.js'
import { registerSyncRoutes } from './sync.js'
import { registerRecordRoutes } from './records.js'
import { registerFileRoutes } from './files.js'

// Central route registry — every module's routes are wired in here.
export function registerRoutes(router) {
  registerSystemRoutes(router)
  registerAuthRoutes(router)
  registerFamilyRoutes(router)
  registerMedicineRoutes(router)
  registerAlertRoutes(router)
  registerSettingsRoutes(router)
  registerJobRoutes(router)
  registerEmergencyRoutes(router)
  registerSyncRoutes(router)
  registerRecordRoutes(router)
  registerFileRoutes(router)
  return router
}

// Routes reachable without a device session token.
export const PUBLIC_ROUTES = new Set([
  'GET /health',
  'GET /meta',
  'POST /auth/register',
])
