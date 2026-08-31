import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('cloud API hand-off endpoints', () => {
  let fetchMock

  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_MEDLOOP_API_URL', 'https://medloop-api.example.workers.dev')
    fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, data: { medicines: [], source: 'fallback', disclaimer: 'Review this draft.' } }),
    }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('posts OCR text to the authenticated extraction endpoint', async () => {
    const { cloudApi } = await import('../src/lib/cloud/apiClient.js')

    await cloudApi.ai.extract('session-token', 'Metformin 500 mg 1-0-1')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://medloop-api.example.workers.dev/v1/ai/extract',
      expect.objectContaining({
        method: 'POST',
        headers: { Accept: 'application/json', Authorization: 'Bearer session-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Metformin 500 mg 1-0-1' }),
      }),
    )
  })

  it('checks cloud configuration with the authenticated session', async () => {
    const { cloudApi } = await import('../src/lib/cloud/apiClient.js')

    await cloudApi.system.configCheck('session-token')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://medloop-api.example.workers.dev/v1/system/config-check',
      expect.objectContaining({
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: 'Bearer session-token' },
      }),
    )
  })

  it('loads the permission-scoped caregiver dashboard', async () => {
    const { cloudApi } = await import('../src/lib/cloud/apiClient.js')

    await cloudApi.caregivers.dashboard('session-token')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://medloop-api.example.workers.dev/v1/caregiver/dashboard',
      expect.objectContaining({
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: 'Bearer session-token' },
      }),
    )
  })
})
