import {
  Bell,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  HeartPulse,
  Pill,
  Sparkles,
  X,
} from 'lucide-react'
import { CircularProgress } from '@mui/material'
import { getLocalDateKey } from '../lib/medicineSchedule'
import { DASHBOARD_VARIANTS, getDashboardDoses, getDoseSummary, getNextDashboardDose } from '../lib/dashboard'

function formatFriendlyDate() {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())
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

function DashboardPage({ progress, medicines, alerts, appointments, updateMedicine, navigateTo, displayName, dashboardVariant = 'halo', setDashboardVariant }) {
  const doses = getDashboardDoses(medicines, getLocalDateKey())
  return (
    <section className={`page-stack redesigned-dashboard variant-${dashboardVariant}`}>
      <DashboardMasthead displayName={displayName} variant={dashboardVariant} setVariant={setDashboardVariant} />
      {doses.length === 0 ? <EmptyDashboard navigateTo={navigateTo} /> : null}
      {doses.length > 0 && dashboardVariant === 'halo' ? <HaloDashboard alerts={alerts} appointments={appointments} doses={doses} navigateTo={navigateTo} progress={progress} updateMedicine={updateMedicine} /> : null}
      {doses.length > 0 && dashboardVariant === 'timeline' ? <TimelineDashboard doses={doses} navigateTo={navigateTo} updateMedicine={updateMedicine} /> : null}
      {doses.length > 0 && dashboardVariant === 'companion' ? <CompanionDashboard alerts={alerts} doses={doses} navigateTo={navigateTo} progress={progress} updateMedicine={updateMedicine} /> : null}
    </section>
  )
}

export default DashboardPage
