import { beforeEach, describe, expect, it, vi } from 'vitest'

const secureValues = new Map()

vi.mock('../src/lib/secureStorage', () => ({
  getSecureValue: vi.fn(async (key) => secureValues.get(key) ?? null),
  setSecureValue: vi.fn(async (key, value) => { secureValues.set(key, value) }),
  removeSecureValue: vi.fn(async (key) => { secureValues.delete(key) }),
}))

vi.mock('../src/lib/cloud/apiClient.js', () => ({
  cloudApi: {
    revokeDevice: vi.fn(async () => ({ revoked: true })),
  },
}))

const { revokeCloudSession } = await import('../src/lib/cloud/session.js')
const { cloudApi } = await import('../src/lib/cloud/apiClient.js')
const { removeSecureValue } = await import('../src/lib/secureStorage')

describe('cloud session lifecycle', () => {
  beforeEach(() => {
    secureValues.clear()
    vi.clearAllMocks()
  })

  it('revokes a stored device credential before removing it locally', async () => {
    const user = { uid: 'user-1', email: 'Person@example.com' }
    secureValues.set('medloop-cloud-session-person@example.com', { token: 'device-secret' })

    await expect(revokeCloudSession(user)).resolves.toBe(true)

    expect(cloudApi.revokeDevice).toHaveBeenCalledWith('device-secret')
    expect(removeSecureValue).toHaveBeenCalledWith('medloop-cloud-session-person@example.com')
    expect(secureValues.has('medloop-cloud-session-person@example.com')).toBe(false)
  })

  it('still clears the local credential if remote revocation fails', async () => {
    const user = { uid: 'user-2', email: 'offline@example.com' }
    secureValues.set('medloop-cloud-session-offline@example.com', { token: 'device-secret' })
    cloudApi.revokeDevice.mockRejectedValueOnce(new Error('offline'))

    await expect(revokeCloudSession(user)).rejects.toThrow('offline')

    expect(removeSecureValue).toHaveBeenCalledWith('medloop-cloud-session-offline@example.com')
    expect(secureValues.has('medloop-cloud-session-offline@example.com')).toBe(false)
  })
})
