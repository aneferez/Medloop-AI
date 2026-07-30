import { ArrowLeft, ShieldCheck, Stethoscope } from 'lucide-react'

function LegalPage({ navigateTo }) {
  return (
    <section className="page-stack legal-page">
      <button className="text-btn back-link" onClick={() => navigateTo('settings')} type="button"><ArrowLeft size={16} /> Back to settings</button>
      <section className="panel-card">
        <div className="section-header"><div><p className="section-kicker">Effective 4 July 2026</p><h2>Privacy policy</h2></div><ShieldCheck size={22} /></div>
        <h3>Data MedLoop handles</h3>
        <p>MedLoop stores account details, medicine routines, dose logs, family profiles, appointments, prescription notes, profile photos, prescription images, and settings on this device. Family phone numbers are stored only to prepare missed-dose and refill-check SMS or WhatsApp messages. Dose and refill-check reminders are scheduled locally on your device.</p>
        <h3>How data is used</h3>
        <p>Data is used only to provide local account access, medicine reminders, adherence history, family SMS or WhatsApp drafts, and prescription-note storage.</p>
        <h3>Service providers</h3>
        <p>MedLoop does not use Firebase, cloud databases, cloud functions, hosted AI, analytics, crash reporting, App Check, or cloud storage in this local-only build. Family messages are prepared locally and opened in your device's SMS app or WhatsApp for your review; MedLoop does not send them automatically. WhatsApp is a separate service with its own privacy terms.</p>
        <h3>Retention and deletion</h3>
        <p>Local data remains on the device until you delete individual records, delete the account in Settings, clear app storage, or uninstall the app. Data stored locally on another device must be removed from that device separately.</p>
        <h3>Your choices</h3>
        <p>You can disable notifications, family SMS drafts, and WhatsApp messages, edit saved records, and delete your local account. MedLoop requires local sign-in before medicine data can be used. For privacy requests that cannot be completed in the app, use the developer contact shown on the app store listing.</p>
        <h3>Security</h3>
        <p>MedLoop keeps this build's data on the device and disables Android cloud backup. No system can guarantee absolute security; avoid entering information that is not needed for medicine coordination.</p>
      </section>
      <section className="panel-card">
        <div className="section-header"><div><p className="section-kicker">Important safety information</p><h2>Medical disclaimer</h2></div><Stethoscope size={22} /></div>
        <p>MedLoop is a reminder and organization tool. It does not provide diagnosis, medical advice, emergency monitoring, or treatment recommendations, and it does not replace a doctor, pharmacist, caregiver, or prescribed instructions.</p>
        <p>Notifications and SMS or WhatsApp messages can be delayed, unavailable, or incorrect. Always follow the original prescription and confirm unclear instructions with a qualified clinician or pharmacist. Do not rely on MedLoop for urgent or life-critical medication decisions.</p>
        <p>If you may be experiencing a medical emergency, contact local emergency services immediately.</p>
      </section>
    </section>
  )
}

export default LegalPage
