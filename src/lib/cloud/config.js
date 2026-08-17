// Base URL for the MedLoop cloud API gateway (Cloudflare Worker).
// Empty string => cloud disabled: the app keeps working fully offline /
// local-first, and every cloud call is treated as best-effort.
const rawBase = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MEDLOOP_API_URL) || ''

export const CLOUD_API_BASE_URL = rawBase.replace(/\/+$/, '')
export const CLOUD_API_VERSION = 'v1'
export const isCloudEnabled = () => CLOUD_API_BASE_URL.length > 0
