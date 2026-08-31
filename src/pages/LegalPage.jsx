import { ArrowLeft, ShieldCheck, Stethoscope } from 'lucide-react'

function LegalPage({ navigateTo }) {
  return (
    <section className="page-stack legal-page">
      <button className="text-btn back-link" onClick={() => navigateTo('settings')} type="button"><ArrowLeft size={16} /> Back to settings</button>
      <section className="panel-card">
        <div className="section-header"><div><p className="section-kicker">Beta notice · Effective 30 August 2026</p><h2>Privacy policy</h2></div><ShieldCheck size={22} /></div>
        <p className="legal-notice">This notice describes the current cloud-enabled beta and must receive product and legal approval before public release.</p>
        <h3>Data MedLoop handles</h3>
        <p>MedLoop stores account details, medicine routines, dose logs, family profiles, appointments, prescription notes, profile photos, prescription images, and settings on this device. When cloud sync is enabled, these records may also be sent to the MedLoop backend. Prescription images may be mirrored to cloud file storage. Push registration uses a device token so generic reminders can be delivered.</p>
        <h3>How data is used</h3>
        <p>Data is used to provide account access, medicine reminders, adherence history, family care coordination, emergency alerts, prescription-note storage, and synchronization between linked devices.</p>
        <h3>Service providers</h3>
        <p>Cloud sync uses the MedLoop Cloudflare Worker, D1 database, and R2 file storage. Firebase Cloud Messaging may deliver generic notification events. The current in-app help guide uses approved local help content and does not send questions to a hosted AI service. OCR and a personal AI assistant require separate consent and final service disclosures before release.</p>
        <h3>Retention and deletion</h3>
        <p>Local data remains on the device until you delete individual records, clear app storage, or uninstall the app. Linked devices can retain their own local copies. Cloud retention and complete remote account deletion are being finalized in the beta backend; do not treat local deletion as remote deletion until the app displays a confirmed cloud deletion receipt.</p>
        <h3>Your choices</h3>
        <p>You can disable notifications, edit saved records, request export or correction when available, and contact the developer for deletion or privacy requests that cannot yet be completed in the app. MedLoop requires sign-in before cloud records can be used.</p>
        <h3>Security</h3>
        <p>Android cloud backup is disabled for MedLoop app data. Health records sent to cloud services are protected by authenticated access and backend authorization. No system can guarantee absolute security; enter only the information needed for medicine coordination.</p>
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
