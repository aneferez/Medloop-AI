import { isCloudEnabled } from './config.js'
import { ensureCloudSession } from './session.js'
import { cloudApi } from './apiClient.js'

// Native FCM/APNs token capture. Push is native-only; on web the plugin methods
// are unimplemented, so we never call them there. The plugin itself loads
// dynamically so importing this module stays cheap on web.

// True on a native Capacitor runtime (Android/iOS).
export function isNativePlatform() {
  const capacitor = typeof window !== 'undefined' ? window.Capacitor : undefined
  if (capacitor?.isNativePlatform) return Boolean(capacitor.isNativePlatform())
  const platform = capacitor?.getPlatform?.()
  return platform === 'android' || platform === 'ios'
}

async function loadPushPlugin() {
  try {
    const module = await import('@capacitor/push-notifications')
    return module?.PushNotifications || null
  } catch {
    return null
  }
}

// Requests permission, registers with FCM, and PATCHes the resulting token onto
// this device in the backend. Returns a cleanup function that removes listeners.
// Never throws; progress is reported through onStatus.
//
// status: 'unavailable' | 'plugin-missing' | 'denied' | 'registering'
//         | 'registered' | 'send-failed' | 'error'
export async function initPushNotifications(user, { onStatus = () => {}, onToken = () => {} } = {}) {
  if (!isCloudEnabled() || !isNativePlatform()) {
    onStatus('unavailable')
    return () => {}
  }
  const Push = await loadPushPlugin()
  if (!Push) {
    onStatus('plugin-missing')
    return () => {}
  }

  const handles = []
  try {
    let permission = await Push.checkPermissions()
    if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') {
      permission = await Push.requestPermissions()
    }
    if (permission.receive !== 'granted') {
      onStatus('denied')
      return () => {}
    }

    handles.push(await Push.addListener('registration', async (token) => {
      const value = token?.value
      if (!value) return
      try {
        const session = await ensureCloudSession(user)
        await cloudApi.updateDeviceToken(session.token, value)
        onToken(value)
        onStatus('registered')
      } catch {
        onStatus('send-failed')
      }
    }))
    handles.push(await Push.addListener('registrationError', () => onStatus('error')))

    await Push.register()
    onStatus('registering')
  } catch {
    onStatus('error')
  }

  return () => {
    handles.forEach((handle) => {
      try { handle.remove() } catch { /* ignore */ }
    })
  }
}
