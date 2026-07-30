import { Pill, X } from 'lucide-react'
import RecordActions from '../components/RecordActions'
import { DOSE_PERIODS, getDoseStatus, getDoseTime, isDosePeriodEnabled } from '../lib/medicineSchedule'
import { formatStockAmount, getBufferStock, isStockLow, isStockTracked } from '../lib/medicineStock'

function MedicinesPage({ medicines, members, medicineForm, setMedicineForm, saveMedicine, updateMedicine, editMedicine, removeMedicine, resetMedicineForm, formFeedback }) {
  const toggleDosePeriod = (periodId) => {
    const enabledPeriods = medicineForm.enabledDosePeriods || []
    setMedicineForm({
      ...medicineForm,
      enabledDosePeriods: enabledPeriods.includes(periodId)
        ? enabledPeriods.filter((enabledPeriod) => enabledPeriod !== periodId)
        : [...enabledPeriods, periodId],
    })
  }

  return (
    <section className="content-grid form-layout">
      <section className="panel-card form-panel">
        <div className="section-header">
          <div><p className="section-kicker">Medication routine</p><h2>{medicineForm.id ? 'Edit medicine' : 'Add medicine'}</h2></div>
          {medicineForm.id ? <button className="icon-btn" onClick={resetMedicineForm} title="Cancel editing" type="button" aria-label="Cancel editing"><X size={16} /></button> : <Pill size={20} />}
        </div>
        <form className="form-stack" onSubmit={saveMedicine}>
          <label className="field"><span>Medicine</span><input value={medicineForm.name} onChange={(event) => setMedicineForm({ ...medicineForm, name: event.target.value })} placeholder="Medicine name" required /></label>
          <label className="field"><span>Dosage</span><input value={medicineForm.dosage} onChange={(event) => setMedicineForm({ ...medicineForm, dosage: event.target.value })} placeholder="Dosage" /></label>
          <fieldset className="dose-interval-fieldset">
            <legend>Reminder intervals</legend>
            <p className="helper-text">Selected times create medicine alarms at the exact time shown.</p>
            <div className="dose-time-grid">
              {DOSE_PERIODS.map((period) => {
                const enabled = (medicineForm.enabledDosePeriods || []).includes(period.id)
                return <div className={`dose-time-option ${enabled ? 'selected' : ''}`} key={period.id}><label className="dose-period-toggle"><input checked={enabled} onChange={() => toggleDosePeriod(period.id)} type="checkbox" /><span>{period.label}</span></label><input aria-label={`${period.label} medicine time`} disabled={!enabled} onChange={(event) => setMedicineForm({ ...medicineForm, [period.timeField]: event.target.value })} type="time" value={medicineForm[period.timeField]} /></div>
              })}
            </div>
            {(medicineForm.enabledDosePeriods || []).length === 0 ? <p className="helper-text">Select at least one time to save this medicine reminder.</p> : null}
          </fieldset>
          <label className="field"><span>Assigned profile</span><select value={medicineForm.memberId} onChange={(event) => setMedicineForm({ ...medicineForm, memberId: event.target.value })}><option value="">Personal routine</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
          <div className="field-row">
            <label className="field"><span>Current stock</span><input inputMode="numeric" min="0" onChange={(event) => setMedicineForm({ ...medicineForm, stockRemaining: event.target.value })} placeholder="Example: 30" type="number" value={medicineForm.stockRemaining ?? ''} /></label>
            <label className="field"><span>Units per dose</span><input inputMode="decimal" min="0.1" onChange={(event) => setMedicineForm({ ...medicineForm, doseUnitsPerDose: event.target.value })} placeholder="Example: 1" step="0.1" type="number" value={medicineForm.doseUnitsPerDose ?? '1'} /></label>
          </div>
          <div className="field-row">
            <label className="field"><span>Buffer days</span><input inputMode="numeric" min="0" onChange={(event) => setMedicineForm({ ...medicineForm, stockBufferDays: event.target.value })} placeholder="Example: 7" type="number" value={medicineForm.stockBufferDays ?? '7'} /></label>
            <label className="field"><span>Stock unit</span><input maxLength="24" onChange={(event) => setMedicineForm({ ...medicineForm, stockUnitLabel: event.target.value })} placeholder="tablets" value={medicineForm.stockUnitLabel ?? 'tablets'} /></label>
          </div>
          <label className="field"><span>Refill status</span><select value={medicineForm.refill} onChange={(event) => setMedicineForm({ ...medicineForm, refill: event.target.value })} aria-label="Refill status"><option>On track</option><option>Running low</option><option>Refill needed</option></select></label>
          {formFeedback ? <p className="helper-text">{formFeedback}</p> : null}
          <button className="primary-btn" type="submit">{medicineForm.id ? 'Update medicine' : 'Add medicine'}</button>
        </form>
      </section>

      <section className="panel-card">
        <div className="section-header"><div><p className="section-kicker">Active routine</p><h2>Your medicines</h2></div><span className="count-badge">{medicines.length}</span></div>
        {medicines.length === 0 ? <div className="empty-state"><Pill size={22} /><div><strong>No medicines saved</strong><p>Add the first medicine you want to track.</p></div></div> : (
          <div className="stack-list">
            {medicines.map((medicine) => (
              <div className="list-item medicine-row" key={medicine.id}>
                <div className="grow"><strong>{medicine.name}</strong><p>{medicine.dosage}</p><div className="dose-schedule-summary">{DOSE_PERIODS.filter((period) => isDosePeriodEnabled(medicine, period.id)).map((period) => <span key={period.id}><strong>{period.label}</strong> {getDoseTime(medicine, period.id)}</span>)}{DOSE_PERIODS.some((period) => isDosePeriodEnabled(medicine, period.id)) ? null : <span className="no-dose-intervals">No dose alarms</span>}</div><div className="stock-chip-row"><span className={`inline-status ${medicine.refill !== 'On track' ? 'warning' : ''}`}>{medicine.refill}</span>{isStockTracked(medicine) ? <span className={`inline-status ${isStockLow(medicine, DOSE_PERIODS.filter((period) => isDosePeriodEnabled(medicine, period.id)).length) ? 'warning' : ''}`}>Stock: {formatStockAmount(medicine.stockRemaining, medicine.stockUnitLabel)}</span> : <span className="inline-status">Stock not set</span>}{isStockTracked(medicine) ? <span className="inline-status">Buffer: {formatStockAmount(getBufferStock(medicine, DOSE_PERIODS.filter((period) => isDosePeriodEnabled(medicine, period.id)).length), medicine.stockUnitLabel)}</span> : null}</div></div>
                <div className="list-item-controls stacked-controls">
                  {DOSE_PERIODS.filter((period) => isDosePeriodEnabled(medicine, period.id)).map((period) => <div className="dose-status-row" key={period.id}><small>{period.label}</small><div className="segmented-control"><button aria-label={`${period.label} taken`} className={getDoseStatus(medicine, period.id) === 'taken' ? 'active' : ''} onClick={() => updateMedicine(medicine.id, 'taken', period.id)} type="button">Taken</button><button aria-label={`${period.label} pending`} className={getDoseStatus(medicine, period.id) === 'pending' ? 'active' : ''} onClick={() => updateMedicine(medicine.id, 'pending', period.id)} type="button">Pending</button><button aria-label={`${period.label} missed`} className={getDoseStatus(medicine, period.id) === 'missed' ? 'active danger' : ''} onClick={() => updateMedicine(medicine.id, 'missed', period.id)} type="button">Missed</button></div></div>)}
                  <RecordActions editLabel={`Edit ${medicine.name}`} deleteLabel={`Delete ${medicine.name}`} onEdit={() => editMedicine(medicine)} onDelete={() => removeMedicine(medicine)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}

export default MedicinesPage
