// MedLoop AI safety guardrails (tasks #32-34) — pure, deterministic, and run
// server-side so they cannot be bypassed. Two layers:
//   1. isUnsafeRequest  — refuse a QUESTION that asks for diagnosis, dosing, or
//      prescription/treatment advice, before any model is called.
//   2. outputIsUnsafe   — scrub MODEL OUTPUT that slipped into a diagnosis or a
//      recommendation. Simplify may restate an existing label's dosing; the
//      assistant may not invent dosing.

export const AI_DISCLAIMER =
  'This is general educational information only, not medical advice. Always follow '
  + 'your doctor or pharmacist, and never start, stop, or change a medication without '
  + 'professional guidance.'

export const REFUSAL_TEXT =
  'I can’t help with diagnosis, dosing, or changing a prescription — please ask your '
  + 'doctor or pharmacist about that. I can explain what a medicine is for or how to '
  + 'take one that has already been prescribed.'

// Questions we refuse outright (asked of the assistant).
const UNSAFE_REQUEST_PATTERNS = [
  /\b(do i have|have i got|am i having|could it be|is it|diagnos)/i,               // diagnosis
  /\b(how much|what dose|what dosage|how many (pills|tablets|mg|capsules))/i,       // dosing
  /\b(should i (take|stop|start|skip|change|double)|can i stop|safe to stop)/i,     // start/stop/change
  /\b(prescri|which (medicine|drug|antibiotic|painkiller) (should|do))/i,           // prescription advice
  /\b(overdose|how many .*(to|before) .*(die|overdose))/i,                          // self-harm / overdose
]

export function isUnsafeRequest(text) {
  const value = String(text ?? '')
  return UNSAFE_REQUEST_PATTERNS.some((pattern) => pattern.test(value))
}

// Diagnoses / recommendations are never allowed in output, whatever the task.
const RECOMMENDATION_PATTERNS = [
  /\byou (have|likely have|probably have|are suffering from|might have)\b/i,
  /\b(stop|start) taking\b/i,
  /\bi (diagnose|recommend you (take|start|stop|change))\b/i,
  /\b(increase|decrease|double|reduce|raise|lower)\s+(your\s+)?(dose|dosage)\b/i,
]

// New dosing instructions are unsafe from the assistant, but fine when SIMPLIFY
// is merely restating dosing that was already on the label the user provided.
const NEW_DOSAGE_PATTERNS = [
  /\btake\s+\d+(\.\d+)?\s*(mg|ml|tablet|tablets|pill|pills|capsule|capsules)\b/i,
]

export function outputIsUnsafe(text, kind = 'assistant') {
  const value = String(text ?? '')
  if (RECOMMENDATION_PATTERNS.some((pattern) => pattern.test(value))) return true
  if (kind === 'assistant' && NEW_DOSAGE_PATTERNS.some((pattern) => pattern.test(value))) return true
  return false
}
