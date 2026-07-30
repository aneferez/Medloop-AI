import { Bell, CalendarClock, CheckCircle2, Pill } from 'lucide-react'
import { DOSE_PERIODS, getDoseStatus, getDoseTime, isDosePeriodEnabled } from '../lib/medicineSchedule'
import { formatStockAmount, isStockLow, isStockTracked } from '../lib/medicineStock'

function DashboardPage({ progress, nextMedicine, medicines, alerts, appointments, updateMedicine, navigateTo }) {
  return (
    <section className="page-stack">
      <div className="stats-grid">
        <div className="stat-card"><span className="stat-icon success"><CheckCircle2 size={19} /></span><div><p>Today&apos;s completion</p><strong>{medicines.length ? `${progress}%` : '0%'}</strong></div></div>
        <div className="stat-card"><span className="stat-icon"><Pill size={19} /></span><div><p>Next medicine</p><strong>{nextMedicine?.name || 'Not scheduled'}</strong></div></div>
        <div className="stat-card"><span className="stat-icon coral"><CalendarClock size={19} /></span><div><p>Next appointment</p><strong>{appointments[0]?.doctor || 'Not scheduled'}</strong></div></div>
        <div className="stat-card"><span className="stat-icon warning"><Bell size={19} /></span><div><p>Open alerts</p><strong>{alerts.length}</strong></div></div>
      </div>

      <div className="content-grid wide-primary">
        <section className="panel-card">
          <div className="section-header"><div><p className="section-kicker">Dose tracking</p><h2>Today&apos;s medicines</h2></div><button className="text-btn" onClick={() => navigateTo('medicines')} type="button">Manage</button></div>
          {medicines.length === 0 ? (
            <div className="empty-state"><Pill size={22} /><div><strong>No medicines yet</strong><p>Add your first routine to begin tracking doses.</p></div><button className="primary-btn small" onClick={() => navigateTo('medicines')} type="button">Add medicine</button></div>
          ) : (
            <div className="stack-list">
              {medicines.map((medicine) => (
                <div className="list-item" key={medicine.id}>
                  <div className="grow"><strong>{medicine.name}</strong><p>{medicine.dosage}</p>{isStockTracked(medicine) ? <span className={`inline-status ${isStockLow(medicine, DOSE_PERIODS.filter((period) => isDosePeriodEnabled(medicine, period.id)).length) ? 'warning' : ''}`}>Stock: {formatStockAmount(medicine.stockRemaining, medicine.stockUnitLabel)}</span> : null}</div>
                  <div className="stacked-controls">
                    {DOSE_PERIODS.filter((period) => isDosePeriodEnabled(medicine, period.id)).map((period) => <div className="dose-status-row" key={period.id}><small>{period.label} {getDoseTime(medicine, period.id)}</small><div className="segmented-control" aria-label={`${period.label} status for ${medicine.name}`}><button aria-label={`${medicine.name} ${period.label} taken`} className={getDoseStatus(medicine, period.id) === 'taken' ? 'active' : ''} onClick={() => updateMedicine(medicine.id, 'taken', period.id)} type="button">Taken</button><button aria-label={`${medicine.name} ${period.label} pending`} className={getDoseStatus(medicine, period.id) === 'pending' ? 'active' : ''} onClick={() => updateMedicine(medicine.id, 'pending', period.id)} type="button">Pending</button><button aria-label={`${medicine.name} ${period.label} missed`} className={getDoseStatus(medicine, period.id) === 'missed' ? 'active danger' : ''} onClick={() => updateMedicine(medicine.id, 'missed', period.id)} type="button">Missed</button></div></div>)}
                    {DOSE_PERIODS.some((period) => isDosePeriodEnabled(medicine, period.id)) ? null : <small className="no-dose-message">No dose reminders scheduled</small>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel-card">
          <div className="section-header"><div><p className="section-kicker">Needs attention</p><h2>Alerts</h2></div><button className="text-btn" onClick={() => navigateTo('alerts')} type="button">View all</button></div>
          {alerts.length === 0 ? <div className="quiet-state"><CheckCircle2 size={20} /><p>No active alerts.</p></div> : (
            <div className="stack-list compact-list">{alerts.slice(0, 4).map((alert) => <div className="alert-row" key={alert.id}><span className={`severity ${alert.level?.toLowerCase()}`} /><div><strong>{alert.title}</strong><p>{alert.detail}</p></div></div>)}</div>
          )}
        </section>
      </div>
    </section>
  )
}

export default DashboardPage
