import { sendPush } from './fcm.js'
import { sendWhatsapp } from './whatsapp.js'
import { sendEmail } from './email.js'

// Dispatches one notification to a channel. Always resolves to
// { status: 'sent' | 'failed' | 'skipped', providerRef?, error? } — never throws.
export async function sendChannel(env, channel, target, message) {
  switch (channel) {
    case 'push':
      return sendPush(env, target, message)
    case 'whatsapp':
      return sendWhatsapp(env, target, message)
    case 'email':
      return sendEmail(env, target, message)
    default:
      return { status: 'skipped', error: `unknown_channel_${channel}` }
  }
}

export { isFcmConfigured } from './fcm.js'
export { isWhatsappConfigured } from './whatsapp.js'
