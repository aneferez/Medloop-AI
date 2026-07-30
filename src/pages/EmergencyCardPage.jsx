import { HeartPulse, ShieldPlus } from 'lucide-react'

function EmergencyCardPage({ members, medicines }) {
  const primaryMember = members[0]
  return (
    <section className="emergency-layout">
      {primaryMember ? (
        <article className="emergency-card">
          <header><div><p>Emergency health card</p><h2>{primaryMember.name}</h2></div><ShieldPlus size={30} /></header>
          <div className="emergency-grid"><div><span>Blood group</span><strong>{primaryMember.bloodGroup || 'Unknown'}</strong></div><div><span>Allergies</span><strong>{primaryMember.allergies || 'None recorded'}</strong></div><div className="full"><span>Current medicines</span><strong>{medicines.slice(0, 5).map((item) => item.name).join(', ') || 'None recorded'}</strong></div></div>
          <footer><HeartPulse size={18} /><span>For emergency reference only</span></footer>
        </article>
      ) : <div className="panel-card empty-state"><ShieldPlus size={22} /><div><strong>No emergency card yet</strong><p>Add a family profile to create one.</p></div></div>}
    </section>
  )
}

export default EmergencyCardPage
