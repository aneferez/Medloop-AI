import { describe, expect, it } from 'vitest'
import {
  mapFrequencyToPeriods,
  normalizeExtractedMedicine,
  parseModelJson,
  ruleBasedExtract,
} from '../worker/src/domain/prescriptionExtract.js'

// Pure tests for OCR-text -> structured medicine parsing (feature #1, Option B).

describe('prescription extract — frequency to periods', () => {
  it('parses dosing grids (morning-afternoon-night)', () => {
    expect(mapFrequencyToPeriods('1-0-1')).toEqual(['morning', 'night'])
    expect(mapFrequencyToPeriods('1-1-1')).toEqual(['morning', 'afternoon', 'night'])
    expect(mapFrequencyToPeriods('0-0-1')).toEqual(['night'])
  })

  it('parses words and Latin codes', () => {
    expect(mapFrequencyToPeriods('at night')).toEqual(['night'])
    expect(mapFrequencyToPeriods('once in the morning')).toEqual(['morning'])
    expect(mapFrequencyToPeriods('twice daily')).toEqual(['morning', 'night'])
    expect(mapFrequencyToPeriods('TDS')).toEqual(['morning', 'afternoon', 'night'])
    expect(mapFrequencyToPeriods('OD')).toEqual(['morning'])
  })

  it('returns empty when unknown', () => {
    expect(mapFrequencyToPeriods('')).toEqual([])
    expect(mapFrequencyToPeriods('as needed')).toEqual([])
  })
})

describe('prescription extract — normalize', () => {
  it('cleans a model item and maps periods', () => {
    expect(normalizeExtractedMedicine({ name: '  Metformin  ', dosage: '500 mg', frequency: '1-0-1' }))
      .toEqual({ name: 'Metformin', dosage: '500 mg', frequencyText: '1-0-1', enabledPeriods: ['morning', 'night'] })
  })

  it('strips dosage-form prefixes from the name', () => {
    expect(normalizeExtractedMedicine({ name: 'Tab. Metformin', dosage: '500 mg' }).name).toBe('Metformin')
    expect(normalizeExtractedMedicine({ name: 'Cap Amoxicillin', dosage: '250 mg' }).name).toBe('Amoxicillin')
  })

  it('drops items without a usable name', () => {
    expect(normalizeExtractedMedicine({ dosage: '500 mg' })).toBeNull()
    expect(normalizeExtractedMedicine(null)).toBeNull()
  })
})

describe('prescription extract — parse model JSON', () => {
  it('pulls a JSON array out of noisy model output', () => {
    expect(parseModelJson('Here you go: [{"name":"A"}] thanks')).toEqual([{ name: 'A' }])
    expect(parseModelJson('```json\n[{"name":"B"}]\n```')).toEqual([{ name: 'B' }])
    expect(parseModelJson('not json at all')).toBeNull()
  })
})

describe('prescription extract — rule-based fallback', () => {
  it('keeps only lines with a name and a dose', () => {
    const items = ruleBasedExtract('Metformin 500 mg twice daily\nplease rest well\nAtorvastatin 10mg at night')
    expect(items.map((item) => item.name)).toEqual(['Metformin', 'Atorvastatin'])
  })
})
