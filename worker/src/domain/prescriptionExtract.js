// Prescription text -> structured medicines (feature #1, "Option B"). Pure
// helpers: the LLM extracts entities, and these deterministically map them onto
// MedLoop's schema (morning/afternoon/night periods) and clean the fields. The
// result is always a DRAFT the user reviews before saving.

const PERIODS = ['morning', 'afternoon', 'night']

// Map a free-text frequency/timing onto the enabled dose periods. Handles the
// common English + Indian-prescription forms: dosing grids (1-0-1), words
// (morning/night/bedtime), and Latin codes (OD/BID/TDS/QID).
export function mapFrequencyToPeriods(input) {
  const text = String(input || '').toLowerCase()
  const set = new Set()

  // Dosing grid: morning-afternoon-night, e.g. 1-0-1, 1-1-1, 0-0-1.
  const grid = text.match(/\b([0-2])\s*[-–/]\s*([0-2])\s*[-–/]\s*([0-2])\b/)
  if (grid) {
    if (Number(grid[1]) > 0) set.add('morning')
    if (Number(grid[2]) > 0) set.add('afternoon')
    if (Number(grid[3]) > 0) set.add('night')
  }

  if (/\b(morning|breakfast|a\.?m\.?|sunrise)\b/.test(text)) set.add('morning')
  if (/\b(afternoon|noon|lunch|midday)\b/.test(text)) set.add('afternoon')
  if (/\b(night|evening|bedtime|bed time|hs|dinner|p\.?m\.?)\b/.test(text)) set.add('night')

  // Latin / shorthand frequency codes.
  if (/\b(bid|b\.d|twice|two times|2\s*x|2\/day)\b/.test(text)) { set.add('morning'); set.add('night') }
  if (/\b(tds|tid|t\.d\.s|thrice|three times|3\s*x|3\/day)\b/.test(text)) { set.add('morning'); set.add('afternoon'); set.add('night') }
  if (/\b(qid|q\.i\.d|four times|4\s*x|4\/day)\b/.test(text)) { set.add('morning'); set.add('afternoon'); set.add('night') }
  // "once daily" defaults to a morning dose only when nothing more specific said.
  if (/\b(od|o\.d|once|1\s*x|1\/day|qd|daily|per day)\b/.test(text) && set.size === 0) set.add('morning')

  return PERIODS.filter((period) => set.has(period))
}

// One raw extracted item -> the shape the medicine form pre-fills, or null when
// there is no usable name.
export function normalizeExtractedMedicine(raw) {
  if (!raw || typeof raw !== 'object') return null
  const name = String(raw.name ?? raw.medicine ?? '').trim().replace(/\s+/g, ' ').slice(0, 120)
  if (name.length < 2) return null
  const dosage = String(raw.dosage ?? raw.strength ?? raw.dose ?? '').trim().slice(0, 120)
  const frequencyText = String(raw.frequency ?? raw.timing ?? raw.schedule ?? '').trim().slice(0, 120)
  return {
    name,
    dosage,
    frequencyText,
    enabledPeriods: mapFrequencyToPeriods(frequencyText),
  }
}

// Robustly pull a JSON array/object out of a model response that may include
// stray prose or code fences around it.
export function parseModelJson(text) {
  if (!text) return null
  const match = String(text).match(/\[[\s\S]*\]|\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

// Deterministic fallback used when the model is unavailable or unparseable. Only
// keeps lines that carry both a name-like token AND a dose unit, to stay clean.
export function ruleBasedExtract(text) {
  const out = []
  for (const line of String(text || '').split(/\r?\n/)) {
    const dose = line.match(/(\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g|iu|units?|tabs?|tablets?|caps?|capsules?))/i)
    if (!dose) continue
    const nameMatch = line.match(/([A-Za-z][A-Za-z.-]+(?:\s+[A-Za-z.-]+)?)\s*\d/)
    const name = nameMatch ? nameMatch[1].trim() : ''
    if (name.length < 3) continue
    out.push({ name, dosage: dose[1], frequency: line })
  }
  return out
}
