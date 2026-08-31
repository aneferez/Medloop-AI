import {
  ArrowRight,
  Bell,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Droplets,
  HeartPulse,
  PackageOpen,
  Pill,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { CircularProgress } from '@mui/material'
import { getEnabledDosePeriods, getLocalDateKey } from '../lib/medicineSchedule'
import { DASHBOARD_VARIANTS, getDashboardDoses, getDoseSummary, getNextDashboardDose } from '../lib/dashboard'
import { formatStockAmount, getDailyStockUse, isStockLow, isStockTracked, normalizeStockRemaining } from '../lib/medicineStock'

function formatFriendlyDate() {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date())
}

function formatDoseTime(time) {
  const [hours, minutes] = String(time || '').split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time || 'Not scheduled'
  const date = new Date(2000, 0, 1, hours, minutes)
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)
}

function getPatientName(displayName, familyMembers) {
  const patient = (familyMembers || []).find((member) => (
    member?.isPatient || member?.isPrimaryPatient || ['patient', 'self'].includes(String(member?.role || '').toLowerCase())
  ))
  return patient?.name || displayName || 'You'
}

function getCaregiver(familyMembers) {
  return (familyMembers || []).find((member) => member?.alertLevel === 'Level 1')
    || (familyMembers || []).find((member) => member?.alertLevel === 'Level 2')
    || (familyMembers || [])[0]
    || null
}

function VariantSwitcher({ value, onChange }) {
  return (
    <div className="dashboard-variant-switcher" role="group" aria-label="Dashboard style">
      {DASHBOARD_VARIANTS.map((variant) => (
        <button
          aria-pressed={value === variant.id}
          className={value === variant.id ? 'active' : ''}
          key={variant.id}
          onClick={() => onChange(variant.id)}
          type="button"
        >
          {variant.label}
        </button>
      ))}
    </div>
  )
}

function DashboardMasthead({ displayName, variant, setVariant }) {
  if (variant === 'ritual') return null
  return (
    <header className="dashboard-masthead">
      <div className="dashboard-identity">
        <img src="/medloop-logo-192.png" alt="" />
        <div>
          <p>{formatFriendlyDate()}</p>
          <h2>Good day{displayName ? `, ${displayName.split(' ')[0]}` : ''}</h2>
        </div>
      </div>
      <VariantSwitcher value={variant} onChange={setVariant} />
    </header>
  )
}

function RitualProgressRow({ dose, isNext = false }) {
  const StatusIcon = dose.status === 'taken' ? CheckCircle2 : dose.status === 'missed' ? X : Circle
  const statusLabel = dose.status === 'pending' ? (isNext ? 'Due next' : 'Upcoming') : dose.status
  return (
    <li className={`ritual-progress-row ${dose.status}`}>
      <span className="ritual-progress-marker"><StatusIcon size={15} /></span>
      <div><strong>{formatDoseTime(dose.time)}</strong><span>{dose.medicineName}</span></div>
      <small>{statusLabel}</small>
    </li>
  )
}

function RitualSupplyRow({ medicine }) {
  const doseCount = getEnabledDosePeriods(medicine).length
  const dailyUse = getDailyStockUse(medicine, doseCount)
  const stockRemaining = normalizeStockRemaining(medicine.stockRemaining)
  const days = stockRemaining === null || dailyUse <= 0 ? null : Math.floor(stockRemaining / dailyUse)
  const low = isStockLow(medicine, doseCount)
  return (
    <li className="ritual-supply-row">
      <span className={`ritual-supply-icon ${low ? 'low' : ''}`}><Pill size={17} /></span>
      <div><strong>{medicine.name}</strong><small>{formatStockAmount(medicine.stockRemaining, medicine.stockUnitLabel)}</small></div>
      <span className={low ? 'ritual-stock-low' : 'ritual-stock-ok'}>{days === null ? '—' : `${days} days`}</span>
    </li>
  )
}

function RitualDashboard({ doses, progress, medicines, familyMembers, displayName, updateMedicine, navigateTo }) {
  const nextDose = getNextDashboardDose(doses)
  const summary = getDoseSummary(doses)
  const patientName = getPatientName(displayName, familyMembers)
  const caregiver = getCaregiver(familyMembers)
  const completedProgress = summary.total ? Math.round((summary.taken / summary.total) * 100) : progress
  const trackedMedicines = medicines.filter(isStockTracked).slice(0, 3)
  const nextStatus = nextDose?.status === 'missed' ? 'Missed' : nextDose ? 'Due next' : 'All done'
  const firstName = String(patientName).trim().split(/\s+/)[0] || 'there'

  return (
    <div className="ritual-dashboard">
      <header className="ritual-dashboard-heading">
        <div>
          <p className="ritual-date">{formatFriendlyDate()}</p>
          <h2>Good morning, {firstName}.</h2>
        </div>
        <div className="ritual-patient-context">
          <span>Care plan for</span>
          <strong>{patientName}</strong>
        </div>
      </header>

      <div className="ritual-main-grid">
        <section className={`ritual-focus-panel ${nextDose ? '' : 'routine-complete'}`} aria-labelledby="ritual-focus-title">
          <div className="ritual-focus-orbit" aria-label={`${completedProgress}% of today's doses completed`}>
            <CircularProgress className="ritual-orbit-track" size={438} thickness={1.1} value={100} variant="determinate" />
            <CircularProgress className="ritual-orbit-progress" size={438} thickness={1.1} value={completedProgress} variant="determinate" />
            {nextDose ? <span className="ritual-orbit-dot" /> : null}
          </div>
          <div className="ritual-focus-content">
            <span className={`ritual-status-pill ${nextDose?.status === 'missed' ? 'missed' : 'due'}`}><Clock3 size={17} /> {nextStatus}</span>
            <p className="ritual-next-time">{nextDose ? formatDoseTime(nextDose.time) : 'Today'}</p>
            <h3 id="ritual-focus-title">{nextDose?.medicineName || 'Your routine is complete'}</h3>
            <p className="ritual-dose-detail">{nextDose ? `${nextDose.dosage} · ${nextDose.label}` : 'All scheduled medication doses are recorded.'}</p>
            {nextDose ? <p className="ritual-dose-instruction"><Droplets size={20} /> Take as scheduled</p> : null}
            {nextDose ? (
              <button className="ritual-confirm-btn" onClick={() => updateMedicine(nextDose.medicineId, 'taken', nextDose.id)} type="button">
                <CheckCircle2 size={21} /> Confirm dose
              </button>
            ) : <button className="ritual-confirm-btn secondary" onClick={() => navigateTo('medicines')} type="button"><Pill size={20} /> Review medicines</button>}
            <p className="ritual-confirm-help">{nextDose ? "Mark when you've taken it." : 'Keep your medication plan ready for tomorrow.'}</p>
          </div>
        </section>

        <aside className="ritual-side-rail">
          <section className="ritual-panel ritual-progress-panel" aria-labelledby="ritual-progress-title">
            <header className="ritual-panel-heading">
              <div><span className="ritual-kicker">Today&apos;s progress</span><h3 id="ritual-progress-title">{summary.taken} of {summary.total} doses</h3></div>
              <div className="ritual-small-ring"><CircularProgress size={58} thickness={4} value={completedProgress} variant="determinate" /><strong>{completedProgress}%</strong></div>
            </header>
            <ul className="ritual-progress-list">
              {doses.slice(0, 5).map((dose) => <RitualProgressRow dose={dose} isNext={dose === nextDose} key={`${dose.medicineId}-${dose.id}`} />)}
            </ul>
          </section>

          <section className="ritual-panel ritual-supply-panel" aria-labelledby="ritual-supply-title">
            <header className="ritual-panel-heading">
              <div><span className="ritual-kicker">Medication supply</span><h3 id="ritual-supply-title">Your supply</h3></div>
              <span className={`ritual-supply-status ${trackedMedicines.some((medicine) => isStockLow(medicine, getEnabledDosePeriods(medicine).length)) ? 'low' : ''}`}><PackageOpen size={15} /> {trackedMedicines.some((medicine) => isStockLow(medicine, getEnabledDosePeriods(medicine).length)) ? 'Review soon' : 'All good'}</span>
            </header>
            {trackedMedicines.length ? <ul className="ritual-supply-list">{trackedMedicines.map((medicine) => <RitualSupplyRow key={medicine.id} medicine={medicine} />)}</ul> : <p className="ritual-panel-empty">Add stock levels to see your supply runway.</p>}
            <button className="ritual-panel-link" onClick={() => navigateTo('medicines')} type="button">View refills <ArrowRight size={16} /></button>
          </section>
        </aside>
      </div>

      <section className="ritual-schedule-panel" aria-labelledby="ritual-schedule-title">
        <header className="ritual-schedule-heading">
          <div><span className="ritual-kicker">Medication rhythm</span><h3 id="ritual-schedule-title">Today&apos;s schedule</h3></div>
          <button className="ritual-panel-link" onClick={() => navigateTo('medicines')} type="button">Review plan <ArrowRight size={16} /></button>
        </header>
        <div className="ritual-schedule-track">
          {doses.slice(0, 4).map((dose) => {
            const StatusIcon = dose.status === 'taken' ? CheckCircle2 : dose.status === 'missed' ? X : Circle
            return (
              <article className={`ritual-schedule-item ${dose.status}`} key={`${dose.medicineId}-${dose.id}`}>
                <time>{formatDoseTime(dose.time)}</time>
                <span className="ritual-schedule-marker"><StatusIcon size={17} /></span>
                <strong>{dose.medicineName}</strong>
                <small>{dose.status === 'pending' ? (dose === nextDose ? 'Due next' : 'Upcoming') : dose.status}</small>
              </article>
            )
          })}
        </div>
      </section>

      <section className="ritual-care-signal">
        <span className="ritual-care-icon"><ShieldCheck size={23} /></span>
        <div><strong>{caregiver ? 'Caregiver connected' : "You're on track"}</strong><p>{caregiver ? `${caregiver.name} can see the care signals you choose to share.` : 'Add a caregiver when you want support around your routine.'}</p></div>
        <button onClick={() => navigateTo('family')} type="button">{caregiver ? 'Manage care circle' : 'Connect caregiver'} <ArrowRight size={17} /></button>
      </section>
    </div>
  )
}

function EmptyDashboard({ navigateTo }) {
  return (
    <section className="dashboard-empty">
      <span><Pill size={24} /></span>
      <h3>Your routine starts here</h3>
      <p>Add a medicine and MedLoop will shape today&apos;s schedule around it.</p>
      <button className="primary-btn" onClick={() => navigateTo('medicines')} type="button">Add first medicine</button>
    </section>
  )
}

function DoseActions({ dose, updateMedicine, compact = false }) {
  if (!dose) return null
  return (
    <div className={`dashboard-dose-actions ${compact ? 'compact' : ''}`}>
      <button className="dose-taken-btn" onClick={() => updateMedicine(dose.medicineId, 'taken', dose.id)} type="button"><Check size={18} /> Taken</button>
      <button className="dose-missed-btn" onClick={() => updateMedicine(dose.medicineId, 'missed', dose.id)} type="button"><X size={17} /> Missed</button>
    </div>
  )
}

function HaloDashboard({ doses, progress, alerts, appointments, updateMedicine, navigateTo }) {
  const nextDose = getNextDashboardDose(doses)
  const summary = getDoseSummary(doses)
  return (
    <div className="halo-layout">
      <section className="halo-hero">
        <div className="halo-copy">
          <span className="dashboard-overline">Next dose</span>
          {nextDose ? <><h3>{nextDose.medicineName}</h3><p>{nextDose.dosage} · {nextDose.label} at {nextDose.time}</p></> : <><h3>All done for today</h3><p>Your scheduled doses are complete.</p></>}
          <DoseActions dose={nextDose} updateMedicine={updateMedicine} />
        </div>
        <div className="dose-halo" aria-label={`${progress}% of today's doses completed`}>
          <CircularProgress className="halo-track" size={178} thickness={2.2} value={100} variant="determinate" />
          <CircularProgress className="halo-progress" size={178} thickness={2.2} value={progress} variant="determinate" />
          <div><strong>{progress}%</strong><span>complete</span></div>
        </div>
      </section>
      <section className="dashboard-card halo-schedule">
        <div className="dashboard-section-title"><div><span>Today&apos;s rhythm</span><h3>{summary.remaining} dose{summary.remaining === 1 ? '' : 's'} still ahead</h3></div><button onClick={() => navigateTo('medicines')} type="button">Manage <ChevronRight size={16} /></button></div>
        <div className="halo-dose-list">
          {doses.slice(0, 4).map((dose) => <DoseRow dose={dose} key={`${dose.medicineId}-${dose.id}`} updateMedicine={updateMedicine} />)}
        </div>
      </section>
      <div className="dashboard-mini-grid">
        <button className="dashboard-mini-card" onClick={() => navigateTo('appointments')} type="button"><CalendarClock size={19} /><span><small>Next appointment</small><strong>{appointments[0]?.doctor || 'Nothing scheduled'}</strong></span><ChevronRight size={17} /></button>
        <button className="dashboard-mini-card" onClick={() => navigateTo('alerts')} type="button"><Bell size={19} /><span><small>Open alerts</small><strong>{alerts.length ? `${alerts.length} need attention` : 'You are all clear'}</strong></span><ChevronRight size={17} /></button>
      </div>
    </div>
  )
}

function DoseRow({ dose, updateMedicine, expanded = false }) {
  const StatusIcon = dose.status === 'taken' ? CheckCircle2 : dose.status === 'missed' ? X : Circle
  return (
    <article className={`dashboard-dose-row ${dose.status} ${expanded ? 'expanded' : ''}`}>
      <time>{dose.time}</time>
      <span className="dose-rail-icon"><StatusIcon size={17} /></span>
      <div className="dose-row-copy"><strong>{dose.medicineName}</strong><small>{dose.dosage} · {dose.label}</small></div>
      {expanded && dose.status === 'pending' ? <DoseActions compact dose={dose} updateMedicine={updateMedicine} /> : <span className="dose-status-label">{dose.status}</span>}
    </article>
  )
}

function TimelineDashboard({ doses, updateMedicine, navigateTo }) {
  const summary = getDoseSummary(doses)
  const currentDose = getNextDashboardDose(doses)
  return (
    <section className="timeline-layout dashboard-card">
      <div className="timeline-summary">
        <span className="dashboard-overline">Today&apos;s plan</span>
        <h3>{summary.remaining} of {summary.total} dose{summary.total === 1 ? '' : 's'} left</h3>
        <p>A calm, chronological view of the day.</p>
      </div>
      <div className="timeline-rail">
        {doses.map((dose) => <DoseRow dose={dose} expanded={dose === currentDose} key={`${dose.medicineId}-${dose.id}`} updateMedicine={updateMedicine} />)}
      </div>
      <button className="timeline-manage" onClick={() => navigateTo('medicines')} type="button">Review full medicine plan <ChevronRight size={17} /></button>
    </section>
  )
}

function CompanionDashboard({ doses, progress, alerts, updateMedicine, navigateTo }) {
  const nextDose = getNextDashboardDose(doses)
  const laterDose = doses.find((dose) => dose !== nextDose && dose.status === 'pending')
  return (
    <div className="companion-layout">
      <section className="companion-intro">
        <span><Sparkles size={18} /></span>
        <p>One dose at a time.</p>
        <h3>{nextDose ? 'Your next step is ready when you are.' : 'Your care plan is complete for today.'}</h3>
      </section>
      {nextDose ? (
        <section className="companion-dose-card">
          <div className="companion-time"><Clock3 size={18} /><span>{nextDose.time}</span></div>
          <div><span className="dashboard-overline">Up next</span><h3>{nextDose.medicineName}</h3><p>{nextDose.dosage} · {nextDose.label}</p></div>
          <DoseActions dose={nextDose} updateMedicine={updateMedicine} />
        </section>
      ) : null}
      <section className="companion-metrics">
        <button onClick={() => navigateTo('reports')} type="button"><HeartPulse size={21} /><span><small>Today&apos;s adherence</small><strong>{progress}%</strong></span><ChevronRight size={18} /></button>
        <button onClick={() => navigateTo('alerts')} type="button"><Bell size={21} /><span><small>Care signals</small><strong>{alerts.length ? `${alerts.length} open` : 'All quiet'}</strong></span><ChevronRight size={18} /></button>
      </section>
      {laterDose ? <section className="companion-later"><span>Later today</span><strong>{laterDose.time}</strong><div><b>{laterDose.medicineName}</b><small>{laterDose.dosage}</small></div></section> : null}
    </div>
  )
}

function DashboardPage({ progress, medicines, familyMembers = [], alerts, appointments, updateMedicine, navigateTo, displayName, dashboardVariant = 'halo', setDashboardVariant }) {
  const doses = getDashboardDoses(medicines, getLocalDateKey())
  return (
    <section className={`page-stack redesigned-dashboard variant-${dashboardVariant}`}>
      <DashboardMasthead displayName={displayName} variant={dashboardVariant} setVariant={setDashboardVariant} />
      {doses.length === 0 ? <EmptyDashboard navigateTo={navigateTo} /> : null}
      {doses.length > 0 && dashboardVariant === 'ritual' ? <RitualDashboard displayName={displayName} doses={doses} familyMembers={familyMembers} medicines={medicines} navigateTo={navigateTo} progress={progress} updateMedicine={updateMedicine} /> : null}
      {doses.length > 0 && dashboardVariant === 'halo' ? <HaloDashboard alerts={alerts} appointments={appointments} doses={doses} navigateTo={navigateTo} progress={progress} updateMedicine={updateMedicine} /> : null}
      {doses.length > 0 && dashboardVariant === 'timeline' ? <TimelineDashboard doses={doses} navigateTo={navigateTo} updateMedicine={updateMedicine} /> : null}
      {doses.length > 0 && dashboardVariant === 'companion' ? <CompanionDashboard alerts={alerts} doses={doses} navigateTo={navigateTo} progress={progress} updateMedicine={updateMedicine} /> : null}
    </section>
  )
}

export default DashboardPage
