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
  // Foundation (Module A)
  health: () => request('/health'),
  meta: () => request('/meta'),
  registerDevice: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  session: (token) => request('/auth/session', { token }),
  linkDevice: (token, payload) => request('/auth/link-device', { method: 'POST', token, body: payload }),
  updateDeviceToken: (token, fcmToken) => request('/auth/device', { method: 'PATCH', token, body: { fcmToken } }),
  revokeDevice: (token) => request('/auth/revoke', { method: 'POST', token }),

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

  // Snapshot sync (Module G) — push the local-first state up to the cloud
  sync: (token, snapshot) => request('/sync', { method: 'PUT', token, body: snapshot }),

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
