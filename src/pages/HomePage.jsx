import { ArrowRight, Check, ClipboardCheck } from 'lucide-react'

function HomePage({ isFirstRun, onboardingChecklist, navigateTo }) {
  const completed = onboardingChecklist.filter((item) => item.done).length

  return (
    <section className="page-stack">
      <div className="home-hero">
        <img src="/care-dashboard-hero.webp" alt="Weekly medicine organizer beside a care checklist" />
        <div className="home-hero-copy">
          <p className="section-kicker">Today&apos;s care plan</p>
          <h2>{isFirstRun ? 'Set up the routine that matters.' : 'Your daily care is ready.'}</h2>
          <p>{isFirstRun ? 'Add the people, medicines, and appointments you want visible each day.' : 'Review today’s doses, upcoming visits, and anything that needs attention.'}</p>
          <div className="button-row">
            <button className="primary-btn" onClick={() => navigateTo('dashboard')} type="button">Open dashboard <ArrowRight size={16} /></button>
          </div>
        </div>
      </div>

      <section className="panel-card">
        <div className="section-header">
          <div><p className="section-kicker">Account readiness</p><h2>{isFirstRun ? 'Complete your setup' : 'Care plan ready'}</h2></div>
          <span className="status-badge"><ClipboardCheck size={14} /> {completed}/{onboardingChecklist.length}</span>
        </div>
        <div className="checklist-grid">
          {onboardingChecklist.map((item, index) => (
            <div className={`checklist-item ${item.done ? 'done' : ''}`} key={item.id}>
              <span className="check-icon">{item.done ? <Check size={16} /> : index + 1}</span>
              <div><strong>{item.title}</strong><p>{item.description}</p></div>
              {item.done ? <span className="status-badge success">Done</span> : <button className="text-btn" onClick={() => navigateTo(item.page)} type="button">Add</button>}
            </div>
          ))}
        </div>
      </section>
    </section>
  )
}

export default HomePage
