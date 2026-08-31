import { CheckCircle2, HeartPulse, Phone, ShieldPlus, Siren } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useEmergencySos } from '../lib/cloud/useEmergencySos'
import { getDefaultEmergencyCardMemberId, getEmergencyCardMedicines, selectEmergencyCardMember } from '../lib/emergencyCard'

function EmergencyCardPage({ members, medicines, user }) {
  const safeMembers = useMemo(() => (Array.isArray(members) ? members : []), [members])
  const safeMedicines = useMemo(() => (Array.isArray(medicines) ? medicines : []), [medicines])
  const sos = useEmergencySos({ user, members: safeMembers })
  const [selectedMemberId, setSelectedMemberId] = useState(() => getDefaultEmergencyCardMemberId(safeMembers) || '')

  useEffect(() => {
    setSelectedMemberId((current) => {
      if (current && safeMembers.some((member) => String(member.id) === String(current))) return current
      return getDefaultEmergencyCardMemberId(safeMembers) || ''
    })
  }, [safeMembers])

  const primaryMember = selectEmergencyCardMember(safeMembers, selectedMemberId)
  const memberMedicines = getEmergencyCardMedicines(safeMedicines, primaryMember?.id)
  const contactName = sos.contact?.name || 'your primary contact'

  return (
    <section className="emergency-layout">
      <article className="sos-panel">
        <header>
          <Siren size={26} aria-hidden="true" />
          <div>
            <strong>Emergency SOS</strong>
            <p>Call your primary contact and alert your family at once.</p>
          </div>
        </header>

        {sos.phase === 'idle' && (
          <>
            <button type="button" className="danger-btn sos-trigger" onClick={sos.arm} disabled={!sos.contact}>
              <Siren size={20} aria-hidden="true" /> Trigger SOS
            </button>
            {!sos.contact
              ? <p className="sos-hint">Add a family contact to enable SOS.</p>
              : <p className="sos-hint">You will confirm before anyone is alerted.</p>}
          </>
        )}

        {sos.phase === 'confirming' && (
          <div className="sos-confirm">
            <p className="sos-confirm-title">Confirm emergency</p>
            <p className="sos-hint">
              Call {contactName} now, or alert your whole family. This step prevents accidental alerts.
            </p>
            {sos.callLink && (
              <button type="button" className="danger-btn sos-call" onClick={sos.placeCall}>
                <Phone size={18} aria-hidden="true" /> Call {contactName}
              </button>
            )}
            <div className="sos-actions">
              <button type="button" className="danger-btn" onClick={sos.confirm}>
                <Siren size={18} aria-hidden="true" /> Alert all family
              </button>
              <button type="button" className="secondary-btn" onClick={sos.cancel}>
                Cancel
              </button>
            </div>
            {!sos.cloudReady && (
              <p className="sos-hint">Automatic family alerts need cloud sync — the call still works offline.</p>
            )}
          </div>
        )}

        {sos.phase === 'sending' && <p className="sos-hint">Alerting your family…</p>}

        {sos.phase === 'sent' && (
          <div className="sos-result">
            <p className="sos-result-title"><CheckCircle2 size={18} aria-hidden="true" /> SOS sent</p>
            {sos.result?.callOnly
              ? <p className="sos-hint">Use the call button to reach {contactName}. Automatic alerts were unavailable.</p>
              : (
                <p className="sos-hint">
                  Family alerted
                  {sos.result?.recipients
                    ? ` — ${sos.result.recipients} notification${sos.result.recipients === 1 ? '' : 's'} via ${sos.result.channels.join(', ') || 'push'}.`
                    : '. No reachable contacts were configured yet.'}
                </p>
              )}
            {sos.callLink && (
              <button type="button" className="danger-btn sos-call" onClick={sos.placeCall}>
                <Phone size={18} aria-hidden="true" /> Call {contactName}
              </button>
            )}
            <button type="button" className="secondary-btn" onClick={sos.reset}>Done</button>
          </div>
        )}

        {sos.phase === 'error' && (
          <div className="sos-result">
            <p className="sos-error">{sos.error}</p>
            {sos.callLink && (
              <button type="button" className="danger-btn sos-call" onClick={sos.placeCall}>
                <Phone size={18} aria-hidden="true" /> Call {contactName}
              </button>
            )}
            <button type="button" className="secondary-btn" onClick={sos.reset}>Close</button>
          </div>
        )}
      </article>

      {safeMembers.length > 1 ? (
        <section className="panel-card emergency-card-selector" aria-labelledby="emergency-card-member-label">
          <label className="field">
            <span id="emergency-card-member-label">Emergency card for</span>
            <select
              aria-describedby="emergency-card-member-help"
              aria-label="Emergency card for"
              onChange={(event) => setSelectedMemberId(event.target.value)}
              value={selectedMemberId}
            >
              <option value="">Choose a family member</option>
              {safeMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
            <small id="emergency-card-member-help">Select the person whose health details and medicines should appear on this card.</small>
          </label>
        </section>
      ) : null}

      {primaryMember ? (
        <article className="emergency-card">
          <header><div><p>Emergency health card</p><h2>{primaryMember.name}</h2></div><ShieldPlus size={30} /></header>
          <div className="emergency-grid"><div><span>Blood group</span><strong>{primaryMember.bloodGroup || 'Unknown'}</strong></div><div><span>Allergies</span><strong>{primaryMember.allergies || 'None recorded'}</strong></div><div className="full"><span>Current medicines</span><strong>{memberMedicines.slice(0, 5).map((item) => item.name).join(', ') || 'None recorded'}</strong></div></div>
          <footer><HeartPulse size={18} /><span>For emergency reference only</span></footer>
        </article>
      ) : <div className="panel-card empty-state"><ShieldPlus size={22} /><div><strong>{safeMembers.length > 1 ? 'Choose a person for the emergency card' : 'No emergency card yet'}</strong><p>{safeMembers.length > 1 ? 'The card stays hidden until you select the correct family member.' : 'Add a family profile to create one.'}</p></div></div>}
    </section>
  )
}

export default EmergencyCardPage
