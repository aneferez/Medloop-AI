import { CheckCircle2, CircleDashed, History, Pill } from 'lucide-react'
import { getDoseStatus, getEnabledDosePeriods } from '../lib/medicineSchedule'

function formatLogTime(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString()
}

function ReportsPage({ medicines, doseLogs = [] }) {
  const totalDoses = medicines.reduce((count, medicine) => count + getEnabledDosePeriods(medicine).length, 0)
  const completed = medicines.reduce((count, medicine) => count + getEnabledDosePeriods(medicine).filter((period) => getDoseStatus(medicine, period.id) === 'taken').length, 0)
  const pending = totalDoses - completed
  const completion = totalDoses ? Math.round((completed / totalDoses) * 100) : 0
  const recentLogs = [...doseLogs]
    .sort((left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime())
    .slice(0, 30)

  return (
    <section className="page-stack">
      <div className="stats-grid report-stats">
        <div className="stat-card"><span className="stat-icon"><Pill size={19} /></span><div><p>Tracked medicines</p><strong>{medicines.length}</strong></div></div>
        <div className="stat-card"><span className="stat-icon success"><CheckCircle2 size={19} /></span><div><p>Taken now</p><strong>{completed}</strong></div></div>
        <div className="stat-card"><span className="stat-icon warning"><CircleDashed size={19} /></span><div><p>Pending or missed</p><strong>{pending}</strong></div></div>
      </div>
      <section className="panel-card report-panel">
        <div><p className="section-kicker">Today&apos;s adherence</p><h2>{totalDoses ? `${completion}% complete` : 'No tracking data yet'}</h2><p>{totalDoses ? `You have completed ${completed} of ${totalDoses} scheduled doses today.` : 'Add medicines to start building an adherence report.'}</p></div>
        <div className="progress-ring" style={{ '--progress': `${completion * 3.6}deg` }}><span>{completion}%</span></div>
      </section>
      <section className="panel-card">
        <div className="section-header"><div><p className="section-kicker">Dose history</p><h2>Recent dose logs</h2></div><History size={20} /></div>
        {recentLogs.length === 0 ? (
          <div className="empty-state"><History size={22} /><div><strong>No dose events yet</strong><p>Mark a medicine taken or missed to create an audit log.</p></div></div>
        ) : (
          <div className="stack-list">
            {recentLogs.map((log) => (
              <div className="list-item" key={log.id}>
                <div><strong>{log.medicineName}</strong><p>{log.dosage} <span className="separator">|</span> {log.dosePeriod ? `${log.dosePeriod[0].toUpperCase()}${log.dosePeriod.slice(1)} ` : ''}scheduled {log.scheduledTime}{log.stockRemainingAfter !== null && log.stockRemainingAfter !== undefined ? ` | stock after: ${log.stockRemainingAfter}` : ''}</p><small>{formatLogTime(log.recordedAt)}</small></div>
                <span className={`status-badge ${log.status === 'taken' ? 'success' : 'warning'}`}>{log.status === 'taken' ? 'Taken' : 'Missed'}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}

export default ReportsPage
