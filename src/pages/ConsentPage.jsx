import { Check, ExternalLink, ShieldCheck, Stethoscope } from 'lucide-react'
import { useState } from 'react'

function ConsentPage({ user, onAccept, onSignOut }) {
  const [accepted, setAccepted] = useState(false)
  const firstName = String(user?.displayName || '').trim().split(/\s+/)[0]

  return (
    <main className="consent-frame">
      <section aria-labelledby="consent-title" className="consent-card">
        <div className="consent-brand">
          <img src="/medloop-logo-192.png" alt="" />
          <div><strong>MedLoop <em>AI</em></strong><span>Medication command center</span></div>
        </div>

        <p className="section-kicker">Before you continue</p>
        <h1 id="consent-title">A safer care plan starts with clarity.</h1>
        <p className="consent-intro">Welcome{firstName ? `, ${firstName}` : ''}. Please review how MedLoop handles your information and what the app can—and cannot—do.</p>

        <div className="consent-principles">
          <article>
            <span className="consent-icon"><ShieldCheck size={20} /></span>
            <div><strong>Privacy first</strong><p>Your medication records stay on this device unless cloud sync is explicitly configured. Prescription images may be stored in the configured cloud file tier.</p></div>
          </article>
          <article>
            <span className="consent-icon"><Stethoscope size={20} /></span>
            <div><strong>Organization, not diagnosis</strong><p>MedLoop supports reminders and coordination. It never replaces a clinician, changes a prescription, or handles emergencies.</p></div>
          </article>
        </div>

        <label className="consent-check">
          <input checked={accepted} onChange={(event) => setAccepted(event.target.checked)} type="checkbox" />
          <span><Check size={16} /> I have read and understand the privacy and medical-safety information.</span>
        </label>

        <div className="consent-links">
          <a href="/privacy.html" rel="noreferrer" target="_blank">Read full privacy policy <ExternalLink size={14} /></a>
          <a href="/account-deletion.html" rel="noreferrer" target="_blank">Account deletion information <ExternalLink size={14} /></a>
        </div>

        <form className="consent-actions" onSubmit={(event) => { event.preventDefault(); if (accepted) onAccept() }}>
          <button className="primary-btn" disabled={!accepted} type="submit"><ShieldCheck size={17} /> Accept and continue</button>
          <button className="secondary-btn" onClick={onSignOut} type="button">Sign out</button>
        </form>
        <p className="consent-version">Consent version 2026-08-30-v1 · Signed in as {user?.email || 'local account'}</p>
      </section>
    </main>
  )
}

export default ConsentPage
