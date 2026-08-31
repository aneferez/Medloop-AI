import { CLOUD_API_BASE_URL, CLOUD_API_VERSION, isCloudEnabled } from './config.js'

// Thin client for the Cloudflare Worker API gateway. Local-first by design:
// callers should treat cloud calls as best-effort and fall back to on-device
// state whenever the cloud is disabled or unreachable.

export class CloudApiError extends Error {
  constructor(status, code, message, details) {
    super(message || 'Cloud request failed.')
    this.name = 'CloudApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

async function request(path, { method = 'GET', body, token, signal } = {}) {
  if (!isCloudEnabled()) throw new CloudApiError(0, 'cloud_disabled', 'Cloud backend is not configured.')

  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${CLOUD_API_BASE_URL}/${CLOUD_API_VERSION}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (cause) {
    throw new CloudApiError(0, 'network_error', 'Could not reach the cloud backend.', { cause: String(cause) })
  }

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok || (payload && payload.ok === false)) {
    const err = (payload && payload.error) || {}
    throw new CloudApiError(response.status, err.code || 'error', err.message || `Request failed (${response.status}).`, err.details)
  }
  return payload && 'data' in payload ? payload.data : payload
}

export const cloudApi = {
  // Server identity (Module A)
  health: () => request('/health'),
  meta: () => request('/meta'),
  system: {
    configCheck: (token) => request('/system/config-check', { token }),
  },
  auth: {
    signup: (payload) => request('/auth/signup', { method: 'POST', body: payload }),
    login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
    verifyEmail: (token) => request('/auth/verify-email', { method: 'POST', body: { token } }),
    resendVerification: (token) => request('/auth/resend-verification', { method: 'POST', token }),
    requestPasswordReset: (email) => request('/auth/password/reset-request', { method: 'POST', body: { email } }),
    resetPassword: (token, password) => request('/auth/password/reset', { method: 'POST', body: { token, password } }),
    session: (token) => request('/auth/session', { token }),
  },
  registerDevice: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  // Device pairing — the only way to join an existing account.
  createLinkCode: (token) => request('/auth/link-code', { method: 'POST', token }),
  redeemLinkCode: (payload) => request('/auth/link-code/redeem', { method: 'POST', body: payload }),
  linkDevice: (token, payload) => request('/auth/link-device', { method: 'POST', token, body: payload }),
  updateDeviceToken: (token, fcmToken) => request('/auth/device', { method: 'PATCH', token, body: { fcmToken } }),
  revokeDevice: (token) => request('/auth/revoke', { method: 'POST', token }),

  account: {
    export: (token) => request('/account/export', { token }),
    remove: (token, password) => request('/account', { method: 'DELETE', token, body: { password } }),
  },

  // Family management (Module D)
  family: {
    list: (token) => request('/family', { token }),
    get: (token, id) => request(`/family/${encodeURIComponent(id)}`, { token }),
    create: (token, member) => request('/family', { method: 'POST', token, body: member }),
    update: (token, id, changes) => request(`/family/${encodeURIComponent(id)}`, { method: 'PATCH', token, body: changes }),
    remove: (token, id) => request(`/family/${encodeURIComponent(id)}`, { method: 'DELETE', token }),
    setPrimary: (token, id) => request(`/family/${encodeURIComponent(id)}/primary`, { method: 'POST', token }),
    primaryContact: (token) => request('/family/primary', { token }),
    alertTarget: (token) => request('/family/alert-target', { token }),
    invite: (token, id, payload = {}) => request(`/family/${encodeURIComponent(id)}/invite`, { method: 'POST', token, body: payload }),
  },

  caregivers: {
    list: (token) => request('/caregivers', { token }),
    accept: (token, code) => request('/caregiver/accept', { method: 'POST', token, body: { code } }),
    patients: (token) => request('/caregiver/patients', { token }),
    inventory: (token) => request('/caregiver/inventory', { token }),
    update: (token, linkId, changes) => request(`/caregivers/${encodeURIComponent(linkId)}`, { method: 'PATCH', token, body: changes }),
    revoke: (token, linkId) => request(`/caregivers/${encodeURIComponent(linkId)}/revoke`, { method: 'POST', token }),
    patientInventory: (token, patientId) => request(`/patients/${encodeURIComponent(patientId)}/inventory`, { token }),
    patientDoses: (token, patientId, date) => request(`/patients/${encodeURIComponent(patientId)}/doses${date ? `?date=${encodeURIComponent(date)}` : ''}`, { token }),
    patientAdherence: (token, patientId, range = 30) => request(`/patients/${encodeURIComponent(patientId)}/adherence?range=${encodeURIComponent(range)}`, { token }),
  },

  // Medicine & stock engine (Module B)
  medicines: {
    list: (token) => request('/medicines', { token }),
    get: (token, id) => request(`/medicines/${encodeURIComponent(id)}`, { token }),
    create: (token, medicine) => request('/medicines', { method: 'POST', token, body: medicine }),
    update: (token, id, changes) => request(`/medicines/${encodeURIComponent(id)}`, { method: 'PATCH', token, body: changes }),
    remove: (token, id) => request(`/medicines/${encodeURIComponent(id)}`, { method: 'DELETE', token }),
    recordDose: (token, id, dose) => request(`/medicines/${encodeURIComponent(id)}/dose`, { method: 'POST', token, body: dose }),
    doses: (token, id, date) => request(`/medicines/${encodeURIComponent(id)}/doses${date ? `?date=${encodeURIComponent(date)}` : ''}`, { token }),
    restock: (token, id, amount) => request(`/medicines/${encodeURIComponent(id)}/restock`, { method: 'POST', token, body: { amount } }),
  },
  stock: {
    summary: (token) => request('/stock/summary', { token }),
  },
  adherence: (token, range = 30) => request(`/adherence?range=${encodeURIComponent(range)}`, { token }),

  // Alert & notification service (Module C)
  alerts: {
    create: (token, alert) => request('/alerts', { method: 'POST', token, body: alert }),
    list: (token, filters = {}) => request(`/alerts${toQuery(filters)}`, { token }),
    setStatus: (token, id, status) => request(`/alerts/${encodeURIComponent(id)}`, { method: 'PATCH', token, body: { status } }),
    notifications: (token, id) => request(`/alerts/${encodeURIComponent(id)}/notifications`, { token }),
  },
  notifications: {
    history: (token, filters = {}) => request(`/notifications${toQuery(filters)}`, { token }),
  },
  ai: {
    assistant: (token, question, context = '') => request('/ai/assistant', { method: 'POST', token, body: { question, context } }),
    simplify: (token, text) => request('/ai/simplify', { method: 'POST', token, body: { text } }),
    extract: (token, text) => request('/ai/extract', { method: 'POST', token, body: { text } }),
  },
  settings: {
    get: (token) => request('/settings', { token }),
    update: (token, changes) => request('/settings', { method: 'PATCH', token, body: changes }),
  },

  // Scheduled automation (Module E) — manual triggers + run history
  jobs: {
    dailyCheck: (token) => request('/jobs/daily-check', { method: 'POST', token }),
    restockCheck: (token) => request('/jobs/restock-check', { method: 'POST', token }),
    runs: (token) => request('/jobs/runs', { token }),
  },

  // Snapshot sync (Module G) — push the local-first state up to the cloud.
  // The snapshot may carry `prune: true`, which lets the push delete rows it
  // omits; only send that once this device has pulled and merged.
  sync: (token, snapshot) => request('/sync', { method: 'PUT', token, body: snapshot }),
  pullSnapshot: (token) => request('/sync', { token }),

  // Records + prescription files
  prescriptions: { list: (token) => request('/prescriptions', { token }) },
  appointments: { list: (token) => request('/appointments', { token }) },
  files: {
    async upload(token, prescriptionId, blob) {
      if (!isCloudEnabled()) throw new CloudApiError(0, 'cloud_disabled', 'Cloud backend is not configured.')
      const url = `${CLOUD_API_BASE_URL}/${CLOUD_API_VERSION}/prescriptions/${encodeURIComponent(prescriptionId)}/file`
      let response
      try {
        response = await fetch(url, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': blob.type || 'application/octet-stream' }, body: blob })
      } catch (cause) {
        throw new CloudApiError(0, 'network_error', 'Could not reach the cloud backend.', { cause: String(cause) })
      }
      const payload = await response.json().catch(() => null)
      if (!response.ok || (payload && payload.ok === false)) {
        const err = (payload && payload.error) || {}
        throw new CloudApiError(response.status, err.code || 'error', err.message || `Upload failed (${response.status}).`, err.details)
      }
      return payload && 'data' in payload ? payload.data : payload
    },
    async fetchBlob(token, prescriptionId) {
      if (!isCloudEnabled()) throw new CloudApiError(0, 'cloud_disabled', 'Cloud backend is not configured.')
      const url = `${CLOUD_API_BASE_URL}/${CLOUD_API_VERSION}/prescriptions/${encodeURIComponent(prescriptionId)}/file`
      let response
      try {
        response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      } catch (cause) {
        throw new CloudApiError(0, 'network_error', 'Could not reach the cloud backend.', { cause: String(cause) })
      }
      if (!response.ok) throw new CloudApiError(response.status, 'error', `Download failed (${response.status}).`)
      return response.blob()
    },
    remove: (token, prescriptionId) => request(`/prescriptions/${encodeURIComponent(prescriptionId)}/file`, { method: 'DELETE', token }),
  },

  // Emergency / SOS (Module F)
  emergency: {
    trigger: (token, note) => request('/emergency', { method: 'POST', token, body: { note } }),
    confirm: (token, id) => request(`/emergency/${encodeURIComponent(id)}/confirm`, { method: 'POST', token }),
    cancel: (token, id) => request(`/emergency/${encodeURIComponent(id)}/cancel`, { method: 'POST', token }),
    list: (token) => request('/emergency', { token }),
    get: (token, id) => request(`/emergency/${encodeURIComponent(id)}`, { token }),
  },

  // Escape hatch for modules that add endpoints before this map is extended.
  request,
}

function toQuery(filters) {
  const entries = Object.entries(filters).filter(([, value]) => value != null && value !== '')
  if (!entries.length) return ''
  return `?${entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&')}`
}
