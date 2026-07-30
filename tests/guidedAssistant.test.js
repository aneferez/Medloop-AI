import { describe, expect, it } from 'vitest'
import { getAssistantProgress, getAssistantStepError, setAssistantField, toggleAssistantChoice } from '../src/lib/guidedAssistant'

describe('guided data-entry assistant', () => {
  it('validates required fields and reminder selections', () => {
    expect(getAssistantStepError({ fields: [{ field: 'name', label: 'Medicine name', required: true }] }, { name: '' })).toBe('Medicine name is required before continuing.')
    expect(getAssistantStepError({ multiChoice: { field: 'periods', min: 1, error: 'Choose a reminder.' } }, { periods: [] })).toBe('Choose a reminder.')
    expect(getAssistantStepError({ timeGroup: { enabledField: 'periods', options: [{ value: 'morning', label: 'Morning', field: 'morningTime' }] } }, { periods: ['morning'], morningTime: '' })).toBe('Choose a time for morning.')
  })

  it('updates fields and toggles choices without mutating the original form', () => {
    const original = { name: '', periods: ['morning'] }
    expect(setAssistantField(original, 'name', 'Aspirin')).toEqual({ name: 'Aspirin', periods: ['morning'] })
    expect(toggleAssistantChoice(original, 'periods', 'night').periods).toEqual(['morning', 'night'])
    expect(toggleAssistantChoice(original, 'periods', 'morning').periods).toEqual([])
    expect(original).toEqual({ name: '', periods: ['morning'] })
  })

  it('calculates bounded step progress', () => {
    expect(getAssistantProgress(0, 5)).toBe(20)
    expect(getAssistantProgress(4, 5)).toBe(100)
    expect(getAssistantProgress(99, 5)).toBe(100)
    expect(getAssistantProgress(0, 0)).toBe(0)
  })
})
