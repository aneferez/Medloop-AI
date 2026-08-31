import { CheckCircle2, CircleDashed, Cloud, History, Pill, TrendingDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getDoseStatus, getEnabledDosePeriods } from '../lib/medicineSchedule'
import { isCloudEnabled } from '../lib/cloud/config.js'
import { cloudApi } from '../lib/cloud/apiClient.js'
import { ensureCloudSession } from '../lib/cloud/session.js'

function formatLogTime(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString()
}

function ReportsPage({ medicines, doseLogs = [], user }) {
  const [cloudReport, setCloudReport] = useState(null)
  const [cloudReportError, setCloudReportError] = useState('')
  const [cloudReportLoading, setCloudReportLoading] = useState(false)
  const totalDoses = medicines.reduce((count, medicine) => count + getEnabledDosePeriods(medicine).length, 0)
  const completed = medicines.reduce((count, medicine) => count + getEnabledDosePeriods(medicine).filter((period) => getDoseStatus(medicine, period.id) === 'taken').length, 0)
  const pending = totalDoses - completed
  const completion = totalDoses ? Math.round((completed / totalDoses) * 100) : 0
  const recentLogs = [...doseLogs]
    .sort((left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime())
    .slice(0, 30)

  useEffect(() => {
    if (!isCloudEnabled() || !user) return undefined
    let active = true
    setCloudReportLoading(true)
    setCloudReportError('')
    ensureCloudSession(user)
      .then((session) => Promise.all([cloudApi.stock.summary(session.token), cloudApi.adherence(session.token, 30)]))
      .then(([stock, adherence]) => { if (active) setCloudReport({ stock, adherence }) })
      .catch((error) => { if (active) setCloudReportError(error?.message || 'Cloud report is temporarily unavailable.') })
      .finally(() => { if (active) setCloudReportLoading(false) })
    return () => { active = false }
  }, [user])

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
      {isCloudEnabled() && user ? <section className="panel-card cloud-insight-panel">
        <div className="section-header"><div><p className="section-kicker">Server intelligence</p><h2>Adherence and stock outlook</h2></div><Cloud size={20} /></div>
        {cloudReportLoading ? <p className="helper-text" role="status">Refreshing your secure report…</p> : null}
        {cloudReportError ? <p className="error-text" role="alert">{cloudReportError}</p> : null}
        {cloudReport ? <>
          <div className="stats-grid report-stats"><div className="stat-card"><span className="stat-icon success"><CheckCircle2 size={19} /></span><div><p>30-day adherence</p><strong>{cloudReport.adherence?.overall?.adherenceRate ?? '—'}{cloudReport.adherence?.overall?.adherenceRate != null ? '%' : ''}</strong></div></div><div className="stat-card"><span className="stat-icon warning"><TrendingDown size={19} /></span><div><p>Predicted low stock</p><strong>{cloudReport.stock?.predictedLowCount ?? 0}</strong></div></div></div>
          {cloudReport.stock?.items?.length ? <div className="stack-list compact-list">{cloudReport.stock.items.filter((item) => item.low || item.prediction?.predictedLow).slice(0, 4).map((item) => <div className="list-item" key={item.id}><div><strong>{item.name}</strong><p>{item.stockRemaining ?? 'Untracked'} remaining · forecast {item.prediction?.predictedDaysRemaining ?? '—'} days</p></div><span className="status-badge warning">Review refill</span></div>)}</div> : <div className="empty-state success-state"><CheckCircle2 size={22} /><div><strong>Stock outlook is stable</strong><p>No medicine is currently inside the predictive low-stock buffer.</p></div></div>}
        </> : null}
      </section> : null}
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
