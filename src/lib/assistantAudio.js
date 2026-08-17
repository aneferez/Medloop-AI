function safeSegment(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9-]/g, '')
}

export function getAssistantAudioSources(language, pageId, onlineBaseUrl = '') {
  const relativePath = `audio/assistant/${safeSegment(language)}/${safeSegment(pageId)}.mp3`
  const sources = []
  const baseUrl = String(onlineBaseUrl || '').trim().replace(/\/+$/, '')

  if (baseUrl && typeof navigator !== 'undefined' && navigator.onLine) {
    sources.push(`${baseUrl}/${relativePath}`)
  }

  sources.push(`/${relativePath}`)
  return sources
}

// Picks the best speechSynthesis voice for a BCP-47 code (e.g. 'ta-IN'): an
// exact lang match first, then any voice for the base language ('ta'). Returns
// null when the device has no matching voice, so callers can avoid reading
// translated text aloud with a wrong-language voice.
export function selectSpeechVoice(voices, speechCode) {
  if (!Array.isArray(voices) || voices.length === 0 || !speechCode) return null
  const lower = String(speechCode).toLowerCase()
  const prefix = lower.split('-')[0]
  return voices.find((voice) => voice?.lang?.toLowerCase() === lower)
    || voices.find((voice) => voice?.lang?.toLowerCase().startsWith(prefix))
    || null
}

