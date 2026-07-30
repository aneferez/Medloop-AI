import { BellRing, CheckCircle2 } from 'lucide-react'

function AlertsPage({ alerts }) {
  return (
    <section className="panel-card">
      <div className="section-header"><div><p className="section-kicker">Needs attention</p><h2>Active alerts</h2></div><span className="count-badge">{alerts.length}</span></div>
      {alerts.length === 0 ? <div className="empty-state success-state"><CheckCircle2 size={22} /><div><strong>Everything is on track</strong><p>Missed doses and refill reminders will appear here.</p></div></div> : (
        <div className="alert-list">{alerts.map((alert) => <article className="alert-item" key={alert.id}><span className={`alert-icon ${alert.level?.toLowerCase()}`}><BellRing size={18} /></span><div><strong>{alert.title}</strong><p>{alert.detail}</p></div><span className={`status-badge ${alert.level?.toLowerCase()}`}>{alert.level}</span></article>)}</div>
      )}
    </section>
  )
}

export default AlertsPage
