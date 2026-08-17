// Email channel (row #17). Sends via Resend's HTTP API when configured
// (RESEND_API_KEY + EMAIL_FROM); otherwise records the attempt as "skipped",
// same as the other channels. Swap the endpoint for a different provider
// without touching the alert service.

export function isEmailConfigured(env) {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM)
}

export async function sendEmail(env, target, { title, body } = {}) {
  if (!isEmailConfigured(env)) return { status: 'skipped', error: 'email_not_configured' }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: target,
        subject: title || 'MedLoop alert',
        text: body || title || 'MedLoop alert',
      }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) return { status: 'failed', error: (payload && payload.message) || `email_${response.status}` }
    return { status: 'sent', providerRef: (payload && payload.id) || null }
  } catch (error) {
    return { status: 'failed', error: String(error.message || error) }
  }
}
