import { useEffect, useRef, useState } from 'react'
import { Bot, ChevronLeft, ChevronRight, Sparkles, Volume2, VolumeX } from 'lucide-react'
import { getAssistantProgress, getAssistantStepError, setAssistantField, toggleAssistantChoice } from '../lib/guidedAssistant'

function GuidedFormAssistant({ form, setForm, steps, title, description, voiceSrc, targetFormId }) {
  const [open, setOpen] = useState(true)
  const [stepIndex, setStepIndex] = useState(0)
  const [error, setError] = useState('')
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef(null)
  const step = steps[stepIndex]
  const isLastStep = stepIndex === steps.length - 1
  const progress = getAssistantProgress(stepIndex, steps.length)

  useEffect(() => {
    setError('')
  }, [stepIndex])

  useEffect(() => () => audioRef.current?.pause(), [])

  const updateField = (field, value) => setForm(setAssistantField(form, field, value))

  const playGuide = async () => {
    if (!audioRef.current) audioRef.current = new Audio(voiceSrc)
    if (playing) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setPlaying(false)
      return
    }
    audioRef.current.onended = () => setPlaying(false)
    try {
      await audioRef.current.play()
      setPlaying(true)
    } catch {
      setError('Voice playback is unavailable. You can continue with the written guide.')
    }
  }

  const continueAssistant = () => {
    const validationError = getAssistantStepError(step, form)
    if (validationError) {
      setError(validationError)
      return
    }
    if (!isLastStep) {
      setStepIndex((current) => current + 1)
      return
    }
    setOpen(false)
    document.querySelector(`[data-assistant-target="${targetFormId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <aside className={`guided-assistant ${open ? 'open' : 'collapsed'}`} aria-label={`${title} guided assistant`}>
      <header className="guided-assistant-header">
        <span className="guided-assistant-avatar" aria-hidden="true"><Bot size={21} /></span>
        <div className="grow"><span className="assistant-eyebrow"><Sparkles size={13} /> MedLoop Assist</span><h3>{title}</h3>{open ? <p>{description}</p> : null}</div>
        <button className="assistant-toggle" onClick={() => setOpen((current) => !current)} type="button">{open ? 'Hide' : 'Guide me'}</button>
      </header>

      {open ? (
        <div className="guided-assistant-body">
          <div className="assistant-progress-row"><span>Step {stepIndex + 1} of {steps.length}</span><span>{progress}%</span></div>
          <div className="assistant-progress-track"><span style={{ width: `${progress}%` }} /></div>
          <div className="assistant-question" aria-live="polite">
            <div className="assistant-question-heading"><div><span>{step.kicker || 'One detail at a time'}</span><h4>{step.title}</h4></div><button aria-label={playing ? 'Stop voice guide' : 'Play clear voice guide'} className={`assistant-voice ${playing ? 'playing' : ''}`} onClick={playGuide} type="button">{playing ? <VolumeX size={17} /> : <Volume2 size={17} />}<span>{playing ? 'Stop' : 'Listen'}</span></button></div>
            <p>{step.prompt}</p>

            {step.fields ? <div className="assistant-fields">{step.fields.map((field) => field.options ? (
              <label key={field.field}><span>{field.label}{field.required ? ' *' : ''}</span><select onChange={(event) => updateField(field.field, event.target.value)} value={form[field.field] ?? ''}>{field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            ) : (
              <label key={field.field}><span>{field.label}{field.required ? ' *' : ''}</span>{field.type === 'textarea' ? <textarea onChange={(event) => updateField(field.field, event.target.value)} placeholder={field.placeholder} rows="3" value={form[field.field] ?? ''} /> : <input inputMode={field.inputMode} min={field.min} onChange={(event) => updateField(field.field, event.target.value)} placeholder={field.placeholder} type={field.type || 'text'} value={form[field.field] ?? ''} />}</label>
            ))}</div> : null}

            {step.multiChoice ? <div className="assistant-choice-grid">{step.multiChoice.options.map((option) => {
              const selected = (form[step.multiChoice.field] || []).includes(option.value)
              return <button aria-pressed={selected} className={selected ? 'selected' : ''} key={option.value} onClick={() => setForm(toggleAssistantChoice(form, step.multiChoice.field, option.value))} type="button"><strong>{option.label}</strong><small>{option.caption}</small></button>
            })}</div> : null}

            {step.timeGroup ? <div className="assistant-fields">{step.timeGroup.options.filter((option) => (form[step.timeGroup.enabledField] || []).includes(option.value)).map((option) => <label key={option.value}><span>{option.label} time</span><input onChange={(event) => updateField(option.field, event.target.value)} type="time" value={form[option.field] || ''} /></label>)}</div> : null}

            {step.summary ? <dl className="assistant-review">{step.summary(form).map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value || 'Not provided'}</dd></div>)}</dl> : null}
            {step.hint ? <p className="assistant-hint">{step.hint}</p> : null}
            {error ? <p className="assistant-error" role="alert">{error}</p> : null}
          </div>

          <div className="assistant-actions"><button className="assistant-back" disabled={stepIndex === 0} onClick={() => setStepIndex((current) => Math.max(0, current - 1))} type="button"><ChevronLeft size={16} /> Back</button><button className="assistant-next" onClick={continueAssistant} type="button">{isLastStep ? 'Continue to save' : 'Next'} <ChevronRight size={16} /></button></div>
          <p className="assistant-privacy">Guidance runs locally. MedLoop does not send health details to the voice service.</p>
        </div>
      ) : null}
    </aside>
  )
}

export default GuidedFormAssistant
