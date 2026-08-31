import { describe, expect, it } from 'vitest'
import { assistantSectionOrder, getAssistantRecommendation, getAssistantStorageKey, getNextAssistantSection, getSectionGuide } from '../src/lib/sectionAssistant'
import { assistantLanguages, createVoiceGuideText, getAssistantCopy, getAssistantFeedbackKey, localizeRecommendation, localizeSectionGuide, PRIMARY_ASSISTANT_LANGUAGE, searchApprovedHelp } from '../src/lib/assistantKnowledge'
import { isUnsafeAssistantQuery } from '../src/lib/assistantSafety'

describe('section assistant', () => {
  it('provides guidance for every signed-in app section', () => {
    assistantSectionOrder.forEach((page) => {
      const guide = getSectionGuide(page)
      expect(guide.label).toBeTruthy()
      expect(guide.description).toBeTruthy()
      expect(guide.tips.length).toBeGreaterThan(0)
    })
  })

  it('recommends the next incomplete setup task in order', () => {
    expect(getAssistantRecommendation('home', {}).page).toBe('family')
    expect(getAssistantRecommendation('family', { familyCount: 1 }).page).toBe('medicines')
    expect(getAssistantRecommendation('medicines', { familyCount: 1, medicineCount: 1 }).page).toBe('appointments')
    expect(getAssistantRecommendation('dashboard', { familyCount: 1, medicineCount: 1, appointmentCount: 1, alertCount: 2 }).page).toBe('alerts')
  })

  it('cycles sections and creates a storage-safe account key', () => {
    expect(getNextAssistantSection('home')).toBe('dashboard')
    expect(getNextAssistantSection('legal')).toBe('home')
    expect(getAssistantStorageKey('person@example.com')).toBe('medloop-section-assistant-person_example_com')
  })

  it('supports approved help in every configured language', () => {
    expect(assistantLanguages.map((language) => language.id)).toEqual(['en', 'hi', 'ta'])
    expect(PRIMARY_ASSISTANT_LANGUAGE).toBe('en')
    expect(assistantLanguages[0].primary).toBe(true)
    expect(searchApprovedHelp('How do I add a medicine?', 'en')).toContain('Open Medicines')
    expect(searchApprovedHelp('दवा कैसे जोड़ें?', 'hi')).toContain('दवाएँ')
    expect(searchApprovedHelp('மருந்து சேர்ப்பது எப்படி?', 'ta')).toContain('மருந்துகள்')
    expect(searchApprovedHelp('diagnose this rash', 'en')).toBeNull()
  })

  it('identifies medical advice requests before approved-help matching', () => {
    expect(isUnsafeAssistantQuery('Should I increase my dose?')).toBe(true)
    expect(isUnsafeAssistantQuery('Can you diagnose this condition?')).toBe(true)
    expect(isUnsafeAssistantQuery('दवा की खुराक बदल दूँ?')).toBe(true)
    expect(isUnsafeAssistantQuery('How do I add a medicine?')).toBe(false)
    expect(getAssistantCopy('en').unsafe).toContain('diagnose')
  })

  it('localizes section and voice guidance without changing the base guide', () => {
    const base = getSectionGuide('medicines')
    const hindi = localizeSectionGuide('medicines', base, 'hi')
    expect(hindi.title).not.toBe(base.title)
    expect(hindi.tips[0]).not.toBe(base.tips[0])
    expect(createVoiceGuideText(hindi)).toContain(hindi.description)
    expect(localizeRecommendation({ page: 'family', label: 'Add', reason: 'Why' }, 'ta').label).not.toBe('Add')
    expect(getAssistantCopy('ta').searchTitle).toBeTruthy()
    expect(getAssistantFeedbackKey()).toBe('medloop-assistant-feedback-v1')
  })
})
