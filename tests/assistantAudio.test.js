import { describe, expect, it } from 'vitest'
import { getAssistantAudioSources, selectSpeechVoice } from '../src/lib/assistantAudio.js'

describe('assistant audio sources', () => {
  it('always provides the bundled offline recording path', () => {
    expect(getAssistantAudioSources('hi', 'home')).toEqual(['/audio/assistant/hi/home.mp3'])
  })

  it('prefers the configured online mirror when the device is online', () => {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } })
    expect(getAssistantAudioSources('ta', 'emergency-card', 'https://cdn.example.test/voices/')).toEqual([
      'https://cdn.example.test/voices/audio/assistant/ta/emergency-card.mp3',
      '/audio/assistant/ta/emergency-card.mp3',
    ])
  })
})

describe('selectSpeechVoice', () => {
  const voices = [
    { name: 'English US', lang: 'en-US' },
    { name: 'Tamil India', lang: 'ta-IN' },
    { name: 'Hindi', lang: 'hi-IN' },
  ]

  it('prefers an exact BCP-47 match', () => {
    expect(selectSpeechVoice(voices, 'ta-IN').name).toBe('Tamil India')
  })

  it('falls back to the base-language prefix', () => {
    expect(selectSpeechVoice([{ name: 'Tamil', lang: 'ta' }], 'ta-IN').name).toBe('Tamil')
  })

  it('returns null when no voice matches (so we avoid mispronouncing)', () => {
    expect(selectSpeechVoice([{ name: 'English', lang: 'en-US' }], 'ta-IN')).toBeNull()
    expect(selectSpeechVoice([], 'ta-IN')).toBeNull()
    expect(selectSpeechVoice(voices, '')).toBeNull()
  })
})
