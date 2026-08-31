// The dedicated MedLoop AI service (feature #8). A MedLoop-exclusive assistant:
// its own credentials, its own persona, and the safety guardrails baked in
// server-side (tasks #32-35). The underlying model is a hosted frontier model
// (Anthropic Claude) reached only through this service; swapping the provider is
// a change to callModel() alone. Data-minimized: only the text the caller sends
// is forwarded — never patient identifiers — and only request metadata is stored.

import { newId, nowIso } from '../lib/ids.js'
import { AI_DISCLAIMER, REFUSAL_TEXT, isUnsafeRequest, outputIsUnsafe } from '../domain/aiSafety.js'

const DEFAULT_RATE_LIMIT_MAX = 20        // requests per user...
const RATE_LIMIT_WINDOW_MINUTES = 60     // ...per hour

const MEDLOOP_PERSONA =
  'You are the MedLoop Assistant, a careful helper inside the MedLoop medication-reminder app. '
  + 'You help patients and their family caregivers understand their medicines, reminders, schedules, '
  + 'and how to use the app. You must NEVER: diagnose conditions; suggest, calculate, or change a dose; '
  + 'recommend starting, stopping, or switching any medicine; or give treatment or prescription advice. '
  + 'If asked for any of those, briefly decline and tell the person to consult their doctor or pharmacist. '
  + 'Never claim to be a doctor. Answer only from the information provided; do not invent medical facts. '
  + 'Keep answers short, plain, and calm.'

const SIMPLIFY_SYSTEM = `${MEDLOOP_PERSONA}\nTask: rewrite the medicine information the user provides in simple, plain language a non-expert can understand, under 120 words. Only restate what is given — do not add advice.`
const ASSISTANT_SYSTEM = `${MEDLOOP_PERSONA}\nTask: answer the user's question about using MedLoop or understanding their medicines in general, within the rules above.`

export function isAiConfigured(env) {
  return Boolean(env.MEDLOOP_AI_API_KEY)
}

function rateLimitMax(env) {
  const configured = Number(env.AI_RATE_LIMIT_MAX)
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_RATE_LIMIT_MAX
}

async function withinRateLimit(env, db, userId, now) {
  if (!userId) return true
  const since = new Date(now.getTime() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString()
  const row = await db.first(
    "SELECT COUNT(*) AS n FROM ai_requests WHERE user_id = ? AND created_at >= ? AND status != 'rate_limited'",
    [userId, since],
  )
  return (row ? Number(row.n) : 0) < rateLimitMax(env)
}

async function record(db, { userId, patientId, kind, status }) {
  try {
    await db.run(
      'INSERT INTO ai_requests (id, user_id, patient_id, kind, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [newId(), userId ?? null, patientId ?? null, kind, status, nowIso()],
    )
  } catch {
    // audit is best-effort; never fail the request on it
  }
}

// Anthropic Messages API. Returns text, or null on any failure so callers fall
// back gracefully. Only the caller-supplied text is sent.
async function callModel(env, { system, user }) {
  if (!isAiConfigured(env)) return null
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.MEDLOOP_AI_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: env.MEDLOOP_AI_MODEL || 'claude-sonnet-5',
        max_tokens: 400,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    })
    if (!response.ok) return null
    const data = await response.json().catch(() => null)
    const parts = Array.isArray(data?.content) ? data.content : []
    const text = parts.map((part) => part?.text || '').join('').trim()
    return text || null
  } catch {
    return null
  }
}

const fallbackAssistant = () =>
  'I can help you understand your medicines and how MedLoop reminds you. For anything about '
  + 'diagnoses, doses, or changing a prescription, please check with your doctor or pharmacist.'

const reply = (text, { refused = false, source }) => ({ text, disclaimer: AI_DISCLAIMER, refused, source })

// Simplify a medicine label/description the client already has. The input is
// content, not a question, so it is not put through the request refusal — but the
// output is validated so the model cannot slip in a diagnosis or recommendation.
export async function aiSimplify(ctx, { text }) {
  const { env, db } = ctx
  const userId = ctx.auth.user?.id ?? null
  const patientId = ctx.auth.patient.id
  const now = new Date()

  if (!(await withinRateLimit(env, db, userId, now))) {
    await record(db, { userId, patientId, kind: 'simplify', status: 'rate_limited' })
    return { rateLimited: true }
  }

  let output = await callModel(env, { system: SIMPLIFY_SYSTEM, user: String(text).slice(0, 2000) })
  let source = output ? 'model' : 'fallback'
  if (!output) output = String(text).trim() // offline: hand back the info as-is

  if (outputIsUnsafe(output, 'simplify')) {
    await record(db, { userId, patientId, kind: 'simplify', status: 'rejected' })
    return reply(REFUSAL_TEXT, { refused: true, source: 'guardrail' })
  }
  await record(db, { userId, patientId, kind: 'simplify', status: 'ok' })
  return reply(output, { source })
}

// Answer a MedLoop / general-medicine question. Unsafe questions are refused
// before any model call; safe ones are answered and the output re-validated.
export async function aiAssistant(ctx, { question, context = '' }) {
  const { env, db } = ctx
  const userId = ctx.auth.user?.id ?? null
  const patientId = ctx.auth.patient.id
  const now = new Date()

  if (!(await withinRateLimit(env, db, userId, now))) {
    await record(db, { userId, patientId, kind: 'assistant', status: 'rate_limited' })
    return { rateLimited: true }
  }

  if (isUnsafeRequest(question)) {
    await record(db, { userId, patientId, kind: 'assistant', status: 'rejected' })
    return reply(REFUSAL_TEXT, { refused: true, source: 'guardrail' })
  }

  const user = context ? `${String(context).slice(0, 4000)}\n\nQuestion: ${question}` : String(question)
  let output = await callModel(env, { system: ASSISTANT_SYSTEM, user })
  let source = output ? 'model' : 'fallback'
  if (!output) output = fallbackAssistant()

  if (outputIsUnsafe(output, 'assistant')) {
    await record(db, { userId, patientId, kind: 'assistant', status: 'rejected' })
    return reply(REFUSAL_TEXT, { refused: true, source: 'guardrail' })
  }
  await record(db, { userId, patientId, kind: 'assistant', status: 'ok' })
  return reply(output, { source })
}
