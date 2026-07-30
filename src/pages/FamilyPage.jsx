import { MessageCircle, UserPlus, X } from 'lucide-react'
import GuidedFormAssistant from '../components/GuidedFormAssistant'
import RecordActions from '../components/RecordActions'

function FamilyPage({ members, medicines, familyForm, setFamilyForm, saveFamilyMember, editFamilyMember, removeFamilyMember, resetFamilyForm, prepareRefillAlert, formFeedback }) {
  const assistantSteps = [
    { title: 'Who are you adding?', prompt: 'Start with the family member or caregiver’s name.', fields: [{ field: 'name', label: 'Name', placeholder: 'Full name', required: true }, { field: 'relationship', label: 'Relationship', placeholder: 'Example: Mother' }] },
    { title: 'Add contact details if needed', prompt: 'Both fields are optional. Use international format for user-reviewed message drafts.', fields: [{ field: 'phone', label: 'SMS phone', type: 'tel', inputMode: 'tel', placeholder: '+919876543210' }, { field: 'whatsappNumber', label: 'WhatsApp number', type: 'tel', inputMode: 'tel', placeholder: '+919876543210' }], hint: 'MedLoop never sends SMS or WhatsApp messages automatically.' },
    { title: 'Choose their alert role', prompt: 'Level 1 is the primary refill contact. Levels 2 and 3 remain secondary care profiles.', fields: [{ field: 'alertLevel', label: 'Alert level', options: ['Level 1', 'Level 2', 'Level 3'].map((value) => ({ value, label: value })) }] },
    { title: 'Add optional health details', prompt: 'Only include details you want available on this device and emergency card.', fields: [{ field: 'age', label: 'Age', type: 'number', min: '0', placeholder: 'Age' }, { field: 'bloodGroup', label: 'Blood group', placeholder: 'Example: O+' }, { field: 'allergies', label: 'Allergies', placeholder: 'Example: Penicillin' }] },
    { kicker: 'Final check', title: 'Review this care profile', prompt: 'Make sure contact details are correct before saving.', summary: (form) => [{ label: 'Name', value: form.name }, { label: 'Relationship', value: form.relationship }, { label: 'Alert role', value: form.alertLevel }, { label: 'SMS', value: form.phone }, { label: 'WhatsApp', value: form.whatsappNumber }] },
  ]

  return (
    <section className="content-grid form-layout">
      <section className="panel-card form-panel">
        <div className="section-header">
          <div><p className="section-kicker">Care profiles</p><h2>{familyForm.id ? 'Edit family member' : 'Add family member'}</h2></div>
          {familyForm.id ? <button className="icon-btn" onClick={resetFamilyForm} title="Cancel editing" type="button" aria-label="Cancel editing"><X size={16} /></button> : <UserPlus size={20} />}
        </div>
        <GuidedFormAssistant description="I’ll help organize contact and emergency details while keeping every field under your control." form={familyForm} setForm={setFamilyForm} steps={assistantSteps} targetFormId="family-form-submit" title="Build a care profile" voiceSrc="/audio/assist-family-clear.mp3" />
        <form className="form-stack" onSubmit={saveFamilyMember}>
          <label className="field"><span>Name</span><input value={familyForm.name} onChange={(event) => setFamilyForm({ ...familyForm, name: event.target.value })} placeholder="Name" required /></label>
          <label className="field"><span>SMS phone (optional)</span><input autoComplete="tel" inputMode="tel" value={familyForm.phone} onChange={(event) => setFamilyForm({ ...familyForm, phone: event.target.value })} placeholder="+919876543210" type="tel" /><small>Use international E.164 format so a missed-dose SMS draft can be prepared.</small></label>
          <label className="field"><span>WhatsApp number (optional)</span><input aria-label="Family WhatsApp number" autoComplete="tel" inputMode="tel" value={familyForm.whatsappNumber} onChange={(event) => setFamilyForm({ ...familyForm, whatsappNumber: event.target.value })} placeholder="WhatsApp: +919876543210" type="tel" /><small>MedLoop opens a prefilled WhatsApp message for you to review and send.</small></label>
          <label className="field"><span>Alert level</span><select aria-label="Family alert level" onChange={(event) => setFamilyForm({ ...familyForm, alertLevel: event.target.value })} value={familyForm.alertLevel}><option>Level 1</option><option>Level 2</option><option>Level 3</option></select><small>Level 1 is the single refill contact for daily and monthly reminders.</small></label>
          <div className="field-row">
            <label className="field"><span>Relationship</span><input value={familyForm.relationship} onChange={(event) => setFamilyForm({ ...familyForm, relationship: event.target.value })} placeholder="Relationship" /></label>
            <label className="field"><span>Age</span><input type="number" min="0" value={familyForm.age} onChange={(event) => setFamilyForm({ ...familyForm, age: event.target.value })} placeholder="Age" /></label>
          </div>
          <div className="field-row">
            <label className="field"><span>Blood group</span><input value={familyForm.bloodGroup} onChange={(event) => setFamilyForm({ ...familyForm, bloodGroup: event.target.value })} placeholder="Blood group" /></label>
            <label className="field"><span>Allergies</span><input value={familyForm.allergies} onChange={(event) => setFamilyForm({ ...familyForm, allergies: event.target.value })} placeholder="Allergies" /></label>
          </div>
          {formFeedback ? <p className="helper-text">{formFeedback}</p> : null}
          <button className="primary-btn" data-assistant-target="family-form-submit" type="submit">{familyForm.id ? 'Update member' : 'Save member'}</button>
        </form>
      </section>

      <section className="panel-card">
        <div className="section-header"><div><p className="section-kicker">Household</p><h2>Family profiles</h2></div><span className="count-badge">{members.length}</span></div>
        {members.length === 0 ? <div className="empty-state"><UserPlus size={22} /><div><strong>No family profiles</strong><p>Add a profile to assign medicines and emergency details.</p></div></div> : (
          <div className="stack-list">
            {members.map((member) => {
              const memberMedicines = medicines.filter((medicine) => medicine.memberId === member.id)
              return (
                <div className="list-item" key={member.id}>
                  <div className="identity"><span className="avatar">{member.name.slice(0, 1).toUpperCase()}</span><div><strong>{member.name}</strong><p>{member.relationship} <span className="separator">|</span> {member.bloodGroup} <span className="separator">|</span> {member.allergies}{member.phone ? <><span className="separator"> | </span>SMS {member.phone}</> : null}{member.whatsappNumber ? <><span className="separator"> | </span>WhatsApp {member.whatsappNumber}</> : null}</p></div></div>
                  <div className="list-item-controls"><span className={`status-badge ${member.alertLevel === 'Level 1' ? 'success' : ''}`}>{member.alertLevel || 'Level 2'}</span><span className="status-badge">{memberMedicines.length} medicines</span>{member.alertLevel === 'Level 1' ? <button className="secondary-btn small" onClick={prepareRefillAlert} type="button"><MessageCircle size={15} /> Test refill alert</button> : null}<RecordActions editLabel={`Edit ${member.name}`} deleteLabel={`Delete ${member.name}`} onEdit={() => editFamilyMember(member)} onDelete={() => removeFamilyMember(member)} /></div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </section>
  )
}

export default FamilyPage
