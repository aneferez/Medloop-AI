import { describe, expect, it } from 'vitest'
import { initPushNotifications, isNativePlatform } from '../src/lib/cloud/pushToken'

// These run in a node (non-native, cloud-disabled) environment, so the module
// must short-circuit safely without importing the native plugin or the session.

describe('push token capture — guards', () => {
  it('reports a non-native platform', () => {
    expect(isNativePlatform()).toBe(false)
  })

  it('reports "unavailable" and returns a no-op cleanup off-native', async () => {
    let status = ''
    const cleanup = await initPushNotifications({ uid: 'u1' }, { onStatus: (next) => { status = next } })
    expect(status).toBe('unavailable')
    expect(typeof cleanup).toBe('function')
    expect(() => cleanup()).not.toThrow()
  })

  it('never invokes onToken when unavailable', async () => {
    let tokened = false
    await initPushNotifications({ uid: 'u1' }, { onToken: () => { tokened = true } })
    expect(tokened).toBe(false)
  })
})
