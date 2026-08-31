import { useEffect, useMemo, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { TextToSpeech } from '@capacitor-community/text-to-speech'
import { Bot, Check, ChevronRight, Lightbulb, Map, Search, Sparkles, ThumbsDown, ThumbsUp, Volume2, VolumeX, X } from 'lucide-react'
import { assistantSectionOrder, getAssistantRecommendation, getAssistantStorageKey, getNextAssistantSection, getSectionGuide } from '../lib/sectionAssistant'
import { assistantLanguages, createVoiceGuideText, getAssistantCopy, getAssistantFeedbackKey, localizeRecommendation, localizeSectionGuide, PRIMARY_ASSISTANT_LANGUAGE, searchApprovedHelp } from '../lib/assistantKnowledge'
import { getAssistantAudioSources, selectSpeechVoice } from '../lib/assistantAudio'
import { isUnsafeAssistantQuery } from '../lib/assistantSafety'
import { isCloudEnabled } from '../lib/cloud/config.js'
import { cloudApi } from '../lib/cloud/apiClient.js'
import { ensureCloudSession } from '../lib/cloud/session.js'

// speechSynthesis voices often load asynchronously; resolve once they're ready.
function loadSpeechVoices() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve([])
      return
    }
    const existing = window.speechSynthesis.getVoices()
    if (existing && existing.length) {
      resolve(existing)
      return
    }
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve(window.speechSynthesis.getVoices() || [])
    }
    window.speechSynthesis.addEventListener?.('voiceschanged', finish, { once: true })
    window.setTimeout(finish, 700)
  })
}

function readAssistantState(storageKey) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) || '{}')
    return {
      automatic: saved.automatic !== false,
      language: assistantLanguages.some((language) => language.id === saved.language) ? saved.language : PRIMARY_ASSISTANT_LANGUAGE,
      visited: Array.isArray(saved.visited) ? saved.visited : [],
    }
  } catch {
    return { automatic: true, language: PRIMARY_ASSISTANT_LANGUAGE, visited: [] }
  }
}

function saveAssistantState(storageKey, patch) {
  const current = readAssistantState(storageKey)
  window.localStorage.setItem(storageKey, JSON.stringify({ ...current, ...patch }))
}

function saveAnonymousFeedback(helpful) {
  try {
    const key = getAssistantFeedbackKey()
    const current = JSON.parse(window.localStorage.getItem(key) || '{}')
    window.localStorage.setItem(key, JSON.stringify({
      helpful: Number(current.helpful || 0) + (helpful ? 1 : 0),
      notHelpful: Number(current.notHelpful || 0) + (helpful ? 0 : 1),
    }))
  } catch {
    // Feedback must never block guidance when device storage is unavailable.
  }
}

function SectionAssistant({ currentPage, navigateTo, user, context }) {
  const storageKey = getAssistantStorageKey(user?.uid || user?.email)
  const initialState = useMemo(() => readAssistantState(storageKey), [storageKey])
  const [open, setOpen] = useState(() => currentPage !== 'dashboard' && initialState.automatic && !initialState.visited.includes(currentPage))
  const [automatic, setAutomatic] = useState(initialState.automatic)
  const [language, setLanguage] = useState(initialState.language)
  const [visited, setVisited] = useState(initialState.visited)
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState('')
  const [aiDisclaimer, setAiDisclaimer] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [feedbackGiven, setFeedbackGiven] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const voiceRef = useRef(null)
  const audioRef = useRef(null)
  const copy = getAssistantCopy(language)
  const guide = localizeSectionGuide(currentPage, getSectionGuide(currentPage), language)
  const recommendation = localizeRecommendation(getAssistantRecommendation(currentPage, context), language)
  const displayName = String(context?.displayName || user?.displayName || '').trim().split(' ')[0]
  const completedCount = new Set(visited).size

  useEffect(() => {
    const nextState = readAssistantState(storageKey)
    setAutomatic(nextState.automatic)
    setLanguage(nextState.language)
    setVisited(nextState.visited)
    setOpen(currentPage !== 'dashboard' && nextState.automatic && !nextState.visited.includes(currentPage))
  }, [currentPage, storageKey])

  useEffect(() => {
    const openFromShell = () => setOpen(true)
    window.addEventListener('medloop:open-assistant', openFromShell)
    return () => window.removeEventListener('medloop:open-assistant', openFromShell)
  }, [])

  useEffect(() => {
    setAnswer('')
    setAiDisclaimer('')
    setQuery('')
    setFeedbackGiven(false)
    window.speechSynthesis?.cancel()
    audioRef.current?.pause()
    audioRef.current = null
    if (Capacitor.isNativePlatform()) TextToSpeech.stop().catch(() => {})
    setSpeaking(false)
    setVisited((current) => {
      if (current.includes(currentPage)) return current
      const next = [...current, currentPage]
      saveAssistantState(storageKey, { automatic, language, visited: next })
      return next
    })
    if (automatic && currentPage !== 'dashboard' && !visited.includes(currentPage)) setOpen(true)
  }, [automatic, currentPage, language, storageKey, visited])

  useEffect(() => () => {
    window.speechSynthesis?.cancel()
    audioRef.current?.pause()
    audioRef.current = null
    if (Capacitor.isNativePlatform()) TextToSpeech.stop().catch(() => {})
  }, [])

  const updateAutomatic = (enabled) => {
    setAutomatic(enabled)
    saveAssistantState(storageKey, { automatic: enabled, language, visited })
  }

  const updateLanguage = (nextLanguage) => {
    window.speechSynthesis?.cancel()
    audioRef.current?.pause()
    audioRef.current = null
    if (Capacitor.isNativePlatform()) TextToSpeech.stop().catch(() => {})
    setSpeaking(false)
    setLanguage(nextLanguage)
    setAnswer('')
    setAiDisclaimer('')
    setFeedbackGiven(false)
    saveAssistantState(storageKey, { automatic, language: nextLanguage, visited })
  }

  const goTo = (page) => {
    setAnswer('')
    navigateTo(page)
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0)
  }

  const toggleVoice = async () => {
    if (speaking) {
      audioRef.current?.pause()
      audioRef.current = null
      if (Capacitor.isNativePlatform()) await TextToSpeech.stop().catch(() => {})
      else window.speechSynthesis?.cancel()
      setSpeaking(false)
      return
    }
    const text = createVoiceGuideText(guide)
    const speechCode = assistantLanguages.find((item) => item.id === language)?.speechCode
      || assistantLanguages.find((item) => item.id === PRIMARY_ASSISTANT_LANGUAGE)?.speechCode
      || 'en-IN'
    const audioSources = getAssistantAudioSources(language, currentPage, import.meta.env.VITE_ASSISTANT_AUDIO_BASE_URL)

    setSpeaking(true)
    setAnswer('')
    for (const source of audioSources) {
      const played = await new Promise((resolve) => {
        const audio = new Audio(source)
        audioRef.current = audio
        audio.onended = () => resolve(true)
        audio.onpause = () => resolve(true)
        audio.onerror = () => resolve(false)
        audio.play().catch(() => resolve(false))
      })
      if (played) {
        audioRef.current = null
        setSpeaking(false)
        return
      }
    }
    audioRef.current = null

    if (Capacitor.isNativePlatform()) {
      try {
        const { supported } = await TextToSpeech.isLanguageSupported({ lang: speechCode })
        if (!supported) throw new Error('Unsupported voice language')
        await TextToSpeech.speak({ text, lang: speechCode, rate: 0.92, pitch: 1, volume: 1 })
      } catch {
        setAnswer(copy.voiceUnavailable)
      } finally {
        setSpeaking(false)
      }
      return
    }
    if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') {
      setSpeaking(false)
      setAnswer(copy.voiceUnavailable)
      return
    }
    const voices = await loadSpeechVoices()
    const voice = selectSpeechVoice(voices, speechCode)
    if (!voice && language !== 'en') {
      // No installed voice for this language — staying silent is better than
      // reading the translated text with a wrong-language voice.
      setSpeaking(false)
      setAnswer(copy.voiceUnavailable)
      return
    }
    const utterance = new window.SpeechSynthesisUtterance(text)
    utterance.lang = speechCode
    if (voice) utterance.voice = voice
    utterance.rate = 0.92
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => {
      setSpeaking(false)
      setAnswer(copy.voiceUnavailable)
    }
    voiceRef.current = utterance
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }

  const submitQuestion = async (event) => {
    event.preventDefault()
    const normalizedQuery = query.trim()
    if (!normalizedQuery) return
    setAiDisclaimer('')
    if (isUnsafeAssistantQuery(normalizedQuery)) {
      setAnswer(copy.unsafe)
      setFeedbackGiven(false)
      return
    }

    if (isCloudEnabled() && user) {
      setAiBusy(true)
      try {
        const session = await ensureCloudSession(user)
        const safeContext = [
          'The user is in the MedLoop medication-reminder app.',
          `They have ${Number(context?.medicineCount || 0)} tracked medicines and ${Number(context?.familyCount || 0)} care profiles.`,
          `They are viewing the ${guide.label} section.`,
        ].join(' ')
        const result = await cloudApi.ai.assistant(session.token, normalizedQuery, safeContext)
        setAnswer(result?.text || copy.noAnswer)
        setAiDisclaimer(result?.disclaimer || '')
      } catch (error) {
        setAnswer(error?.status === 429
          ? 'The MedLoop assistant has reached its hourly limit. Please try again later.'
          : 'The secure MedLoop assistant is temporarily unavailable. You can still use the local guide below.')
      } finally {
        setAiBusy(false)
      }
    } else {
      const result = searchApprovedHelp(normalizedQuery, language)
      setAnswer(result || copy.noAnswer)
    }
    setFeedbackGiven(false)
  }

  const recordFeedback = (helpful) => {
    saveAnonymousFeedback(helpful)
    setFeedbackGiven(true)
  }

  if (!open) {
    if (currentPage === 'dashboard') return null
    return (
      <button aria-label={`Open MedLoop AI guide for ${guide.label}`} className="section-assistant-launcher" onClick={() => setOpen(true)} type="button">
        <Bot size={22} /><span>{copy.guide}</span>
      </button>
    )
  }

  return (
    <aside aria-label="MedLoop AI section guide" className={`section-assistant ${language === PRIMARY_ASSISTANT_LANGUAGE ? 'primary-english-voice' : ''}`} role="complementary">
      <header className="section-assistant-header">
        <span className="section-assistant-avatar"><Bot size={21} /></span>
        <div className="grow">
          <span><Sparkles size={13} /> {copy.guide}</span>
          <strong>{displayName ? `${copy.welcome}, ${displayName}` : copy.welcome} — {copy.inSection} {guide.label}</strong>
        </div>
        <button aria-label="Close AI guide" className="section-assistant-close" onClick={() => setOpen(false)} type="button"><X size={18} /></button>
      </header>

      <div className="section-assistant-body">
        <div className="section-assistant-toolbar">
          <label><span className="sr-only">Guidance language</span><select aria-label="Guidance language" onChange={(event) => updateLanguage(event.target.value)} value={language}>{assistantLanguages.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          {language === PRIMARY_ASSISTANT_LANGUAGE ? <span className="assistant-primary-voice">English voice</span> : null}
          <button aria-label={speaking ? copy.stop : copy.listen} className={speaking ? 'speaking' : ''} onClick={toggleVoice} type="button">{speaking ? <VolumeX size={16} /> : <Volume2 size={16} />} {speaking ? copy.stop : copy.listen}</button>
        </div>
        <div className="section-assistant-progress"><span style={{ width: `${Math.round((completedCount / assistantSectionOrder.length) * 100)}%` }} /></div>
        <p className="section-assistant-progress-label">{completedCount} / {assistantSectionOrder.length} {copy.progress}</p>
        <h2>{guide.title}</h2>
        <p>{guide.description}</p>

        <div className="section-assistant-tip-list">
          {guide.tips.map((tip) => <div key={tip}><Check size={15} /><span>{tip}</span></div>)}
        </div>

        <div className="section-assistant-recommendation">
          <Lightbulb size={17} />
          <div><small>{copy.recommended}</small><strong>{recommendation.label}</strong><p>{recommendation.reason}</p></div>
        </div>

        <div className="section-assistant-actions">
          <button className="primary-btn" onClick={() => goTo(recommendation.page)} type="button">{recommendation.label} <ChevronRight size={16} /></button>
          <button className="secondary-btn" onClick={() => goTo(getNextAssistantSection(currentPage))} type="button"><Map size={16} /> {copy.next}</button>
        </div>

        <section className="section-assistant-help" aria-labelledby="assistant-help-title">
          <strong id="assistant-help-title"><Search size={15} /> {copy.searchTitle}</strong>
          <form onSubmit={submitQuestion}>
            <input aria-label={copy.searchTitle} maxLength="160" onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} value={query} />
            <button disabled={!query.trim() || aiBusy} type="submit">{aiBusy ? 'Thinking…' : copy.ask}</button>
          </form>
          <small>{isCloudEnabled() && user ? 'Authenticated MedLoop AI. Questions are limited to medication education and app guidance.' : copy.approved}</small>
          {answer ? <div aria-live="polite" className="section-assistant-answer"><p>{answer}</p>{aiDisclaimer ? <small className="section-assistant-disclaimer">{aiDisclaimer}</small> : null}{feedbackGiven ? <span>{copy.thanks}</span> : <div className="assistant-feedback"><span>{copy.helpful}</span><button aria-label={`${copy.yes}, helpful`} onClick={() => recordFeedback(true)} type="button"><ThumbsUp size={14} /> {copy.yes}</button><button aria-label={`${copy.no}, not helpful`} onClick={() => recordFeedback(false)} type="button"><ThumbsDown size={14} /> {copy.no}</button></div>}</div> : null}
        </section>

        <label className="section-assistant-auto">
          <input checked={automatic} onChange={(event) => updateAutomatic(event.target.checked)} type="checkbox" />
          <span>{copy.automatic}</span>
        </label>
        <p className="section-assistant-safety">{copy.safety}</p>
      </div>
    </aside>
  )
}

export default SectionAssistant
