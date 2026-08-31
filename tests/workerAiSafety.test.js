import { describe, expect, it } from 'vitest'
import { AI_DISCLAIMER, REFUSAL_TEXT, isUnsafeRequest, outputIsUnsafe } from '../worker/src/domain/aiSafety.js'

// Pure guardrail tests for the MedLoop AI service (tasks #32-34).

describe('ai safety — request refusal (#32/#33)', () => {
  it('refuses diagnosis, dosing, and prescription questions', () => {
    for (const question of [
      'Do I have diabetes?',
      'What dose should I take?',
      'How many tablets of ibuprofen should I take?',
      'Should I stop taking my blood pressure medicine?',
      'Which antibiotic should I use for a sore throat?',
    ]) expect(isUnsafeRequest(question)).toBe(true)
  })

  it('allows explaining a medicine or using the app', () => {
    for (const question of [
      'What is metformin used for?',
      'When is my morning reminder scheduled?',
      'How does MedLoop notify my family?',
    ]) expect(isUnsafeRequest(question)).toBe(false)
  })
})

describe('ai safety — output validation (#32)', () => {
  it('blocks diagnoses and recommendations in any output', () => {
    expect(outputIsUnsafe('You have high blood pressure.', 'simplify')).toBe(true)
    expect(outputIsUnsafe('Stop taking this medicine tonight.', 'assistant')).toBe(true)
    expect(outputIsUnsafe('I recommend you take more of it.', 'assistant')).toBe(true)
    expect(outputIsUnsafe('Increase your dose to twice daily.', 'simplify')).toBe(true)
  })

  it('lets simplify restate label dosing but blocks the assistant inventing it', () => {
    const labelRestatement = 'Take 2 tablets by mouth twice a day with food.'
    expect(outputIsUnsafe(labelRestatement, 'simplify')).toBe(false)
    expect(outputIsUnsafe(labelRestatement, 'assistant')).toBe(true)
  })

  it('passes a plain explanation', () => {
    expect(outputIsUnsafe('Metformin helps manage blood sugar. Take it as your doctor prescribed.', 'assistant')).toBe(false)
  })

  it('allows educational conditionals but still blocks a direct diagnosis', () => {
    expect(outputIsUnsafe('If you have a headache, paracetamol can help reduce the pain.', 'assistant')).toBe(false)
    expect(outputIsUnsafe('This is used when you have high blood pressure.', 'assistant')).toBe(false)
    expect(outputIsUnsafe('You have diabetes and need this medicine.', 'assistant')).toBe(true)
  })
})

describe('ai safety — constants', () => {
  it('has an educational-only disclaimer and a refusal message', () => {
    expect(AI_DISCLAIMER.toLowerCase()).toContain('educational')
    expect(REFUSAL_TEXT.toLowerCase()).toContain('pharmacist')
  })
})
