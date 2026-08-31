import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, CheckCircle2, Clipboard, Clock3, Eye, HeartPulse, Link2, LockKeyhole, Package, ShieldCheck, UserCheck, UserPlus, Users, X } from 'lucide-react'
import { cloudApi } from '../lib/cloud/apiClient.js'
import { isCloudEnabled } from '../lib/cloud/config.js'
import { ensureCloudSession } from '../lib/cloud/session.js'

const PERMISSIONS = [
  ['view_inventory', 'Inventory'],
  ['view_doses', 'Dose status'],
  ['view_adherence', 'Adherence reports'],
  ['receive_escalations', 'Escalation alerts'],
  ['view_emergency', 'Emergency card'],
]

const permissionLabel = new Map(PERMISSIONS)

const formatDoseTime = (value) => {
  if (!value) return 'Time not set'
  const [hour, minute] = String(value).split(':').map(Number)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const twelveHour = hour % 12 || 12
  return `${twelveHour}:${String(minute).padStart(2, '0')} ${suffix}`
}

const formatDoseStatus = (status) => ({
  taken: 'Taken',
  missed: 'Missed',
  skipped: 'Skipped',
  pending: 'Pending',
}[status] || 'Pending')

function CaregiverPatientCard({ patient, onOpen }) {
  const alertClass = patient.alertLevel === 'Level 1'
    ? 'is-urgent'
    : patient.alertLevel === 'Level 2' ? 'is-attention' : 'is-routine'
  const permissions = Array.isArray(patient.permissions) ? patient.permissions : []
  const today = patient.today
  const summary = today?.summary || {}
  const doses = Array.isArray(today?.doses) ? today.doses : []
  const visibleDoses = doses.slice(0, 4)

  return (
    <article className="caregiver-patient-card">
      <div className="caregiver-patient-card-header">
        <div className="caregiver-patient-identity">
          <span className="caregiver-patient-avatar" aria-hidden="true"><Activity size={17} /></span>
          <div><p className="section-kicker">Shared care profile</p><h3>{patient.name || 'Patient'}</h3></div>
        </div>
        <span className={`caregiver-alert-badge ${alertClass}`}>{patient.alertLevel || 'Routine'}</span>
      </div>

      <div className="caregiver-permission-row" aria-label="Shared permissions">
        <span className="caregiver-card-label">Shared</span>
        {permissions.length ? permissions.map((permission) => <span className="caregiver-permission-chip" key={permission}>{permissionLabel.get(permission) || permission}</span>) : <span className="caregiver-card-muted">No active permissions</span>}
      </div>

      <section className="caregiver-card-section">
        <div className="caregiver-card-section-heading"><Package size={16} /><strong>Inventory</strong>{patient.inventory && patient.inventory.lowStockCount > 0 ? <span className="caregiver-section-warning"><AlertTriangle size={13} /> {patient.inventory.lowStockCount} low</span> : null}</div>
        {patient.inventory ? <div className="caregiver-metric-row"><div><strong>{patient.inventory.medicineCount ?? 0}</strong><span>medicines</span></div><div><strong>{patient.inventory.lowStockCount ?? 0}</strong><span>low stock</span></div><div><strong>{patient.inventory.predictedLowCount ?? 0}</strong><span>predicted low</span></div></div> : <p className="caregiver-card-muted">Inventory access was not shared.</p>}
      </section>

      <section className="caregiver-card-section">
        <div className="caregiver-card-section-heading"><Clock3 size={16} /><strong>Today&apos;s medication checks</strong>{today ? <span className="caregiver-card-date">{today.date}</span> : null}</div>
        {today ? <>
          <div className="caregiver-dose-summary" aria-label="Today's dose summary">
            <div className="is-taken"><strong>{summary.taken ?? 0}</strong><span>Taken</span></div>
            <div className="is-pending"><strong>{summary.pending ?? 0}</strong><span>Pending</span></div>
            <div className="is-missed"><strong>{summary.missed ?? 0}</strong><span>Missed</span></div>
            <div className="is-skipped"><strong>{summary.skipped ?? 0}</strong><span>Skipped</span></div>
            <div><strong>{summary.total ?? 0}</strong><span>Total</span></div>
          </div>
          <div className="caregiver-next-dose">{today.next ? <><span>Next dose</span><strong>{today.next.name}</strong><small>{today.next.period} · {formatDoseTime(today.next.scheduledTime)}</small></> : <><CheckCircle2 size={15} /><span>All scheduled doses checked</span></>}</div>
          {visibleDoses.length ? <div className="caregiver-dose-list">{visibleDoses.map((dose) => <div className="caregiver-dose-row" key={`${dose.medicineId}-${dose.period}`}><div><strong>{dose.name}</strong><small>{dose.period} · {formatDoseTime(dose.scheduledTime)}</small></div><span className={`caregiver-dose-status is-${dose.status}`}><span aria-hidden="true" />{formatDoseStatus(dose.status)}</span></div>)}{doses.length > visibleDoses.length ? <small className="caregiver-card-muted">+ {doses.length - visibleDoses.length} more scheduled dose{doses.length - visibleDoses.length === 1 ? '' : 's'}</small> : null}</div> : null}
        </> : <p className="caregiver-card-muted">Dose status was not shared.</p>}
      </section>

      <button className="secondary-btn small caregiver-open-detail" onClick={onOpen} type="button"><Eye size={14} /> Open detailed view</button>
    </article>
  )
}

function CaregiverNetworkPanel({ user, members = [], cloudSyncNow }) {
  const [links, setLinks] = useState([])
  const [patientLinks, setPatientLinks] = useState([])
  const [dashboardPatients, setDashboardPatients] = useState([])
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [inventory, setInventory] = useState(null)
  const [doses, setDoses] = useState(null)
  const [adherence, setAdherence] = useState(null)
  const [inviteCodes, setInviteCodes] = useState({})
  const [acceptCode, setAcceptCode] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  const loadNetwork = useCallback(async () => {
    if (!isCloudEnabled() || !user) return
    setBusy('load')
    setError('')
    try {
      const session = await ensureCloudSession(user)
      const [ownerResult, dashboardResult] = await Promise.all([
        cloudApi.caregivers.list(session.token),
        cloudApi.caregivers.dashboard(session.token),
      ])
      setLinks(ownerResult?.caregivers || [])
      const nextDashboardPatients = dashboardResult?.patients || []
      setDashboardPatients(nextDashboardPatients)
      const nextPatients = nextDashboardPatients.map((patient) => ({
        patientId: patient.patientId,
        label: patient.name,
        patient: { displayName: patient.name },
        permissions: patient.permissions || [],
      }))
      setPatientLinks(nextPatients)
      setSelectedPatientId((current) => nextPatients.some((patient) => patient.patientId === current) ? current : nextPatients[0]?.patientId || '')
    } catch (cause) {
      setError(cause?.message || 'Unable to load the family network.')
    } finally {
      setBusy('')
    }
  }, [user])

  useEffect(() => { loadNetwork() }, [loadNetwork])

  const selectedLink = useMemo(() => patientLinks.find((link) => link.patientId === selectedPatientId), [patientLinks, selectedPatientId])

  const loadPatientView = useCallback(async () => {
    if (!selectedPatientId || !user) return
    setBusy('patient')
    setError('')
    try {
      const session = await ensureCloudSession(user)
      const requests = []
      if (selectedLink?.permissions?.includes('view_inventory')) requests.push(cloudApi.caregivers.patientInventory(session.token, selectedPatientId).then(setInventory).catch((cause) => { if (cause?.status === 403) setInventory({ denied: true }) }))
      if (selectedLink?.permissions?.includes('view_doses')) requests.push(cloudApi.caregivers.patientDoses(session.token, selectedPatientId).then(setDoses).catch((cause) => { if (cause?.status === 403) setDoses({ denied: true }) }))
      if (selectedLink?.permissions?.includes('view_adherence')) requests.push(cloudApi.caregivers.patientAdherence(session.token, selectedPatientId).then(setAdherence).catch((cause) => { if (cause?.status === 403) setAdherence({ denied: true }) }))
      await Promise.all(requests)
    } catch (cause) {
      setError(cause?.message || 'Unable to load the patient care view.')
    } finally {
      setBusy('')
    }
  }, [selectedLink, selectedPatientId, user])

  useEffect(() => {
    setInventory(null); setDoses(null); setAdherence(null)
    loadPatientView()
  }, [loadPatientView])

  const inviteMember = async (member) => {
    setBusy(`invite:${member.id}`); setError(''); setFeedback('')
    try {
      await cloudSyncNow?.()
      const session = await ensureCloudSession(user)
      const result = await cloudApi.family.invite(session.token, member.id, {
        alertLevel: member.alertLevel,
        permissions: PERMISSIONS.map(([permission]) => permission),
      })
      setInviteCodes((current) => ({ ...current, [member.id]: result.inviteCode }))
      setFeedback(`${member.name} can accept this invite with their own MedLoop account.`)
      await loadNetwork()
    } catch (cause) {
      setError(cause?.message || 'Unable to create the caregiver invite.')
    } finally {
      setBusy('')
    }
  }

  const acceptInvite = async (event) => {
    event.preventDefault()
    if (!acceptCode.trim()) return
    setBusy('accept'); setError(''); setFeedback('')
    try {
      const session = await ensureCloudSession(user)
      await cloudApi.caregivers.accept(session.token, acceptCode.trim())
      setAcceptCode('')
      setFeedback('Caregiver access accepted. The patient view is read-only and permission-scoped.')
      await loadNetwork()
    } catch (cause) {
      setError(cause?.message || 'Unable to accept this caregiver invite.')
    } finally {
      setBusy('')
    }
  }

  const revoke = async (link) => {
    if (!window.confirm(`Revoke ${link.label || 'this caregiver'} access immediately?`)) return
    setBusy(`revoke:${link.id}`); setError('')
    try {
      const session = await ensureCloudSession(user)
      await cloudApi.caregivers.revoke(session.token, link.id)
      setFeedback('Caregiver access revoked.')
      await loadNetwork()
    } catch (cause) {
      setError(cause?.message || 'Unable to revoke caregiver access.')
    } finally {
      setBusy('')
    }
  }

  const togglePermission = async (link, permission) => {
    const permissions = link.permissions.includes(permission)
      ? link.permissions.filter((item) => item !== permission)
      : [...link.permissions, permission]
    setBusy(`permission:${link.id}`); setError('')
    try {
      const session = await ensureCloudSession(user)
      const result = await cloudApi.caregivers.update(session.token, link.id, { permissions })
      setLinks((current) => current.map((item) => item.id === link.id ? result.link : item))
      setFeedback('Caregiver permissions updated.')
    } catch (cause) {
      setError(cause?.message || 'Unable to update caregiver permissions.')
    } finally {
      setBusy('')
    }
  }

  if (!isCloudEnabled() || !user) return null

  return (
    <section className="panel-card caregiver-network-panel">
      <div className="section-header"><div><p className="section-kicker">Account-based care</p><h2>Caregiver network</h2></div><Users size={20} /></div>
      <p>Invite trusted people with their own MedLoop account. Access is read-only, consent-based, and limited to the permissions you choose.</p>

      {dashboardPatients.length ? <section className="caregiver-dashboard-block" aria-labelledby="caregiver-dashboard-title">
        <div className="caregiver-dashboard-heading">
          <div><p className="section-kicker">One view for every patient</p><h3 id="caregiver-dashboard-title">Care dashboard</h3></div>
          <span className="caregiver-dashboard-count">{dashboardPatients.length} patient{dashboardPatients.length === 1 ? '' : 's'}</span>
        </div>
        <p className="caregiver-dashboard-description">Shared signals are shown only when that patient has granted the matching permission.</p>
        <div className="caregiver-dashboard-grid">
          {dashboardPatients.map((patient) => <CaregiverPatientCard key={patient.patientId} onOpen={() => setSelectedPatientId(patient.patientId)} patient={patient} />)}
        </div>
      </section> : null}

      <div className="caregiver-network-grid">
        <section className="caregiver-network-block">
          <div className="section-header"><div><p className="section-kicker">Patient controls</p><h3>Invite from a care profile</h3></div><UserPlus size={18} /></div>
          {members.length === 0 ? <p className="helper-text">Add a family profile first, then create an account-based invite.</p> : <div className="stack-list compact-list">{members.map((member) => <div className="list-item" key={member.id}><div><strong>{member.name}</strong><p>{member.relationship || 'Family member'} · {member.alertLevel || 'Level 2'}</p></div><div className="list-item-controls"><button className="secondary-btn small" disabled={busy === `invite:${member.id}`} onClick={() => inviteMember(member)} type="button"><Link2 size={14} /> {busy === `invite:${member.id}` ? 'Creating…' : 'Invite'}</button>{inviteCodes[member.id] ? <code className="invite-code">{inviteCodes[member.id]}</code> : null}</div></div>)}</div>}
          {links.length ? <div className="stack-list compact-list">{links.map((link) => <div className="caregiver-link-card" key={link.id}><div className="caregiver-link-heading"><span className="avatar"><UserCheck size={16} /></span><div><strong>{link.label || 'Caregiver'}</strong><p>{link.status} · {link.alertLevel}</p></div><button aria-label={`Revoke ${link.label || 'caregiver'}`} className="icon-btn" disabled={busy === `revoke:${link.id}`} onClick={() => revoke(link)} title="Revoke access" type="button"><X size={16} /></button></div><div className="permission-grid">{PERMISSIONS.map(([permission, label]) => <label key={permission}><input checked={link.permissions.includes(permission)} disabled={link.status !== 'active' || busy === `permission:${link.id}`} onChange={() => togglePermission(link, permission)} type="checkbox" />{label}</label>)}</div></div>)}</div> : <p className="helper-text">No account-based caregiver links yet. Contact-only family members continue to use reviewed message drafts.</p>}
        </section>

        <section className="caregiver-network-block">
          <div className="section-header"><div><p className="section-kicker">Caregiver access</p><h3>Accept an invite</h3></div><LockKeyhole size={18} /></div>
          <form className="pairing-row" onSubmit={acceptInvite}><label className="field grow"><span>Invite code</span><input autoComplete="one-time-code" onChange={(event) => setAcceptCode(event.target.value)} placeholder="ABCDE-FGHJK" value={acceptCode} /></label><button className="primary-btn" disabled={busy === 'accept' || !acceptCode.trim()} type="submit">{busy === 'accept' ? 'Accepting…' : 'Accept invite'}</button></form>
          {patientLinks.length ? <>
            <label className="field"><span>Patient care view</span><select onChange={(event) => setSelectedPatientId(event.target.value)} value={selectedPatientId}>{patientLinks.map((link) => <option key={link.patientId} value={link.patientId}>{link.patient?.displayName || link.label || 'Patient'}</option>)}</select></label>
            <div className="caregiver-insight-grid">
              <div className="insight-card"><Package size={17} /><strong>Inventory</strong>{inventory?.denied ? <small>Permission not granted</small> : <small>{inventory ? `${inventory.items?.length || 0} medicines · ${inventory.lowStockCount || 0} low` : busy === 'patient' ? 'Loading…' : 'Not selected'}</small>}</div>
              <div className="insight-card"><Eye size={17} /><strong>Today&apos;s doses</strong>{doses?.denied ? <small>Permission not granted</small> : <small>{doses ? `${doses.doses?.filter((dose) => dose.status === 'taken').length || 0} taken · ${doses.doses?.filter((dose) => dose.status === 'pending').length || 0} pending` : busy === 'patient' ? 'Loading…' : 'Not selected'}</small>}</div>
              <div className="insight-card"><HeartPulse size={17} /><strong>Adherence</strong>{adherence?.denied ? <small>Permission not granted</small> : <small>{adherence ? `${adherence.overall?.adherenceRate ?? '—'}% over ${adherence.rangeDays} days` : busy === 'patient' ? 'Loading…' : 'Not selected'}</small>}</div>
            </div>
          </> : <div className="empty-state"><ShieldCheck size={22} /><div><strong>No patient access yet</strong><p>Accept a patient invite to see only the care signals they approved.</p></div></div>}
        </section>
      </div>
      {busy === 'load' ? <p className="helper-text" role="status">Loading caregiver access…</p> : null}
      {feedback ? <p className="helper-text" role="status">{feedback}</p> : null}
      {error ? <p className="error-text" role="alert">{error}</p> : null}
      <p className="helper-text"><Clipboard size={14} /> Invite codes are single-use and expire. Never share a device token as a caregiver invite.</p>
    </section>
  )
}

export default CaregiverNetworkPanel
