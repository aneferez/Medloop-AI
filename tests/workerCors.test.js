import { describe, expect, it } from 'vitest'
import { isOriginAllowed, resolveCors } from '../worker/src/middleware/cors.js'

const req = (origin) => new Request('https://api.test/v1/health', { headers: origin ? { Origin: origin } : {} })
const allow = ['http://localhost', 'capacitor://localhost', '*.pages.dev']

describe('worker CORS — origin matching', () => {
  it('matches exact allow-list entries', () => {
    expect(isOriginAllowed('http://localhost', allow)).toBe(true)
    expect(isOriginAllowed('capacitor://localhost', allow)).toBe(true)
  })

  it('matches *.pages.dev wildcards, including preview subdomains', () => {
    expect(isOriginAllowed('https://medloop-app.pages.dev', allow)).toBe(true)
    expect(isOriginAllowed('https://abc123.medloop-app.pages.dev', allow)).toBe(true)
  })

  it('rejects look-alike and unlisted origins', () => {
    expect(isOriginAllowed('https://evil.com', allow)).toBe(false)
    expect(isOriginAllowed('https://x.notpages.dev', allow)).toBe(false)
    expect(isOriginAllowed('https://pages.dev.evil.com', allow)).toBe(false)
  })

  it('allows everything when configured with "*"', () => {
    expect(isOriginAllowed('https://anything.example', '*')).toBe(true)
  })
})

describe('worker CORS — response headers', () => {
  it('reflects an allowed Pages origin', () => {
    const headers = resolveCors(req('https://medloop-app.pages.dev'), allow)
    expect(headers['Access-Control-Allow-Origin']).toBe('https://medloop-app.pages.dev')
    expect(headers.Vary).toBe('Origin')
  })

  it('omits the allow-origin header for a disallowed origin', () => {
    const headers = resolveCors(req('https://evil.com'), allow)
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined()
  })

  it('returns base headers (no reflection) when there is no Origin', () => {
    const headers = resolveCors(req(null), allow)
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined()
    expect(headers['Access-Control-Allow-Methods']).toContain('POST')
  })

  it('emits a wildcard allow-origin under "*"', () => {
    expect(resolveCors(req('https://x.example'), '*')['Access-Control-Allow-Origin']).toBe('*')
  })
})
