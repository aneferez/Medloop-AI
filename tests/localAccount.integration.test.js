import { beforeEach, describe, expect, it, vi } from 'vitest'

const secureValues = new Map()

vi.mock('../src/lib/secureStorage', () => ({
  getSecureValue: vi.fn(async (key) => secureValues.get(key) ?? null),
  setSecureValue: vi.fn(async (key, value) => { secureValues.set(key, structuredClone(value)) }),
  removeSecureValue: vi.fn(async (key) => { secureValues.delete(key) }),
}))

import { deleteCurrentAccount, loginWithEmail, logoutFromLocalAccount, signupWithEmail } from '../src/lib/localAccount'

describe('local account integration', () => {
  beforeEach(() => secureValues.clear())

  it('persists login credentials across logout/login and deletes the account', async () => {
    const signup = await signupWithEmail(' Patient@Example.com ', 'safe-password-123', 'Patient')
    expect(signup.user).toMatchObject({ email: 'patient@example.com', displayName: 'Patient' })

    await logoutFromLocalAccount()
    await expect(loginWithEmail('patient@example.com', 'wrong-password')).rejects.toMatchObject({ code: 'auth/invalid-credential' })
    await expect(loginWithEmail('patient@example.com', 'safe-password-123')).resolves.toMatchObject({ user: { email: 'patient@example.com' } })
    await expect(deleteCurrentAccount('wrong-password')).rejects.toMatchObject({ code: 'auth/invalid-credential' })
    await expect(deleteCurrentAccount('safe-password-123')).resolves.toEqual({ deleted: true })
    await expect(loginWithEmail('patient@example.com', 'safe-password-123')).rejects.toMatchObject({ code: 'auth/invalid-credential' })
  })
})
