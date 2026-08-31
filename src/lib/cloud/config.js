// Base URL for the MedLoop cloud API gateway (Cloudflare Worker).
// Empty string => cloud disabled: the app keeps working fully offline /
// local-first, and every cloud call is treated as best-effort.
const rawBase = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MEDLOOP_API_URL) || ''

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '::1'])

export function normalizeCloudBaseUrl(value, { production = Boolean(import.meta.env?.PROD) } = {}) {
  const base = String(value || '').trim().replace(/\/+$/, '')
  if (!base) return ''

  let parsed
  try {
    parsed = new URL(base)
  } catch {
    return ''
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) return ''
  if (production && (parsed.protocol !== 'https:' || LOCAL_HOSTS.has(parsed.hostname))) return ''
  return base
}

export const CLOUD_API_BASE_URL = normalizeCloudBaseUrl(rawBase)
export const CLOUD_API_CONFIG_ERROR = String(rawBase).trim() && !CLOUD_API_BASE_URL
export const CLOUD_API_VERSION = 'v1'
export const isCloudEnabled = () => CLOUD_API_BASE_URL.length > 0
