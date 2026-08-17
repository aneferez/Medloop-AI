// WhatsApp channel (row #16) — WhatsApp Cloud API. Optional secondary channel.
//
// Proactive/business-initiated messages (which all MedLoop alerts are) must use
// an APPROVED message template outside the 24-hour customer-service window. So:
//   - WHATSAPP_TEMPLATE_NAME set  -> send that template (production).
//   - not set (but configured)    -> send free-form text (only valid inside the
//                                    24h window; handy for a first test).
// Returns "skipped" when credentials are absent.

const GRAPH_VERSION = 'v20.0'
const MAX_PARAM = 900

export function isWhatsappConfigured(env) {
  return Boolean(env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_ACCESS_TOKEN)
}

// Template body parameters may not contain newlines, tabs, or >4 spaces.
function sanitizeParam(value, fallback = '') {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return (text || fallback).slice(0, MAX_PARAM)
}

// Builds the Graph API request body. Pure — unit-tested.
export function buildWhatsappPayload(env, target, { title, body } = {}) {
  const to = String(target).replace(/^\+/, '')
  const templateName = env.WHATSAPP_TEMPLATE_NAME
  if (templateName) {
    return {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: env.WHATSAPP_TEMPLATE_LANG || 'en' },
        components: [{
          type: 'body',
          parameters: [
            { type: 'text', text: sanitizeParam(title, 'MedLoop alert') },
            { type: 'text', text: sanitizeParam(body || title, 'Open MedLoop for details.') },
          ],
        }],
      },
    }
  }
  return {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: sanitizeParam([title, body].filter(Boolean).join(' — '), 'MedLoop alert') },
  }
}

export async function sendWhatsapp(env, target, message = {}) {
  if (!isWhatsappConfigured(env)) return { status: 'skipped', error: 'whatsapp_not_configured' }
  try {
    const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildWhatsappPayload(env, target, message)),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) return { status: 'failed', error: (payload && payload.error && payload.error.message) || `whatsapp_${response.status}` }
    const providerRef = payload && payload.messages && payload.messages[0] ? payload.messages[0].id : null
    return { status: 'sent', providerRef }
  } catch (error) {
    return { status: 'failed', error: String(error.message || error) }
  }
}
