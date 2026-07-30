import { CalendarPlus, X } from 'lucide-react'
import RecordActions from '../components/RecordActions'

function AppointmentsPage({ appointments, appointmentForm, setAppointmentForm, saveAppointment, editAppointment, removeAppointment, resetAppointmentForm, formFeedback }) {
  return (
    <section className="content-grid form-layout">
      <section className="panel-card form-panel">
        <div className="section-header"><div><p className="section-kicker">Calendar</p><h2>{appointmentForm.id ? 'Edit appointment' : 'Add appointment'}</h2></div>{appointmentForm.id ? <button className="icon-btn" onClick={resetAppointmentForm} title="Cancel editing" type="button" aria-label="Cancel editing"><X size={16} /></button> : <CalendarPlus size={20} />}</div>
        <form className="form-stack" onSubmit={saveAppointment}>
          <label className="field"><span>Doctor</span><input value={appointmentForm.doctor} onChange={(event) => setAppointmentForm({ ...appointmentForm, doctor: event.target.value })} placeholder="Doctor name" required /></label>
          <label className="field"><span>Clinic</span><input value={appointmentForm.clinic} onChange={(event) => setAppointmentForm({ ...appointmentForm, clinic: event.target.value })} placeholder="Clinic" /></label>
          <div className="field-row"><label className="field"><span>Date</span><input type="date" value={appointmentForm.date} onChange={(event) => setAppointmentForm({ ...appointmentForm, date: event.target.value })} required /></label><label className="field"><span>Time</span><input type="time" value={appointmentForm.time} onChange={(event) => setAppointmentForm({ ...appointmentForm, time: event.target.value })} aria-label="Appointment time" /></label></div>
          {formFeedback ? <p className="helper-text">{formFeedback}</p> : null}
          <button className="primary-btn" type="submit">{appointmentForm.id ? 'Update appointment' : 'Save appointment'}</button>
        </form>
      </section>

      <section className="panel-card">
        <div className="section-header"><div><p className="section-kicker">Schedule</p><h2>Upcoming visits</h2></div><span className="count-badge">{appointments.length}</span></div>
        {appointments.length === 0 ? <div className="empty-state"><CalendarPlus size={22} /><div><strong>No appointments saved</strong><p>Add your next clinic or follow-up visit.</p></div></div> : <div className="stack-list">{appointments.map((item) => <div className="list-item" key={item.id}><div className="date-block"><strong>{new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, { day: '2-digit' })}</strong><span>{new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short' })}</span></div><div className="grow"><strong>{item.doctor}</strong><p>{item.clinic} <span className="separator">|</span> {item.time}</p></div><div className="list-item-controls"><span className="status-badge success">{item.status}</span><RecordActions editLabel={`Edit appointment with ${item.doctor}`} deleteLabel={`Delete appointment with ${item.doctor}`} onEdit={() => editAppointment(item)} onDelete={() => removeAppointment(item)} /></div></div>)}</div>}
      </section>
    </section>
  )
}

export default AppointmentsPage
