import { describe, expect, it } from 'vitest'
import { normalizeCloudBaseUrl } from '../src/lib/cloud/config'

describe('cloud endpoint configuration', () => {
  it('accepts a deployed HTTPS endpoint in production', () => {
    expect(normalizeCloudBaseUrl('https://medloop-api.example.workers.dev///', { production: true }))
      .toBe('https://medloop-api.example.workers.dev')
  })

  it('rejects insecure and local endpoints in production', () => {
    expect(normalizeCloudBaseUrl('http://medloop-api.example.workers.dev', { production: true })).toBe('')
    expect(normalizeCloudBaseUrl('http://127.0.0.1:8787', { production: true })).toBe('')
    expect(normalizeCloudBaseUrl('https://localhost', { production: true })).toBe('')
  })

  it('allows local HTTP endpoints only for development', () => {
    expect(normalizeCloudBaseUrl('http://127.0.0.1:8787/', { production: false }))
      .toBe('http://127.0.0.1:8787')
  })
})
