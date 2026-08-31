import { Camera, FileImage, FileText, ImageUp, Sparkles, X } from 'lucide-react'
import GuidedFormAssistant from '../components/GuidedFormAssistant'
import RecordActions from '../components/RecordActions'

function PrescriptionsPage({
  prescriptions,
  prescriptionForm,
  setPrescriptionForm,
  savePrescription,
  editPrescription,
  removePrescription,
  resetPrescriptionForm,
  formFeedback,
  prescriptionImageUrls,
  prescriptionDraftImageUrl,
  prescriptionDraftBusy,
  prescriptionOcr,
  prescriptionPhotoFeedback,
  prescriptionPhotoBusyId,
  capturePrescriptionImage,
  capturePrescriptionDraft,
  uploadPrescriptionDraft,
  uploadPrescriptionDraftFile,
  applyPrescriptionOcr,
  uploadPrescriptionImageFile,
  simplifyPrescriptionNotes,
  simplifyBusy,
  cloudEnabled,
}) {
  const assistantSteps = [
    { title: 'Who issued the prescription?', prompt: 'Enter the doctor’s name exactly as shown on the prescription.', fields: [{ field: 'doctor', label: 'Doctor', placeholder: 'Doctor name', required: true }] },
    { title: 'Where was it issued?', prompt: 'Add the clinic or hospital so the record is easier to find later.', fields: [{ field: 'clinic', label: 'Clinic or hospital', placeholder: 'Clinic or hospital' }] },
    { title: 'What should you remember?', prompt: 'Copy relevant written instructions. MedLoop will not interpret or change medical directions.', fields: [{ field: 'notes', label: 'Instructions', type: 'textarea', placeholder: 'Write the prescription instructions here' }] },
    { kicker: 'Final check', title: 'Review the written record', prompt: 'Attach the prescription image, review the OCR draft if available, then save.', summary: (form) => [{ label: 'Doctor', value: form.doctor }, { label: 'Clinic', value: form.clinic }, { label: 'Instructions', value: form.notes }] },
  ]

  return (
    <section className="content-grid form-layout">
      <section className="panel-card form-panel">
        <div className="section-header"><div><p className="section-kicker">Prescription records</p><h2>{prescriptionForm.id ? 'Edit prescription' : 'Add prescription'}</h2></div>{prescriptionForm.id ? <button className="icon-btn" onClick={resetPrescriptionForm} title="Cancel editing" type="button" aria-label="Cancel editing"><X size={16} /></button> : <FileText size={20} />}</div>
        <GuidedFormAssistant description="I’ll help capture the written details accurately while you attach the original image for review." form={prescriptionForm} setForm={setPrescriptionForm} steps={assistantSteps} targetFormId="prescription-form-submit" title="Save a prescription safely" voiceSrc="/audio/assist-prescription-clear.mp3" />
        <form className="form-stack" onSubmit={savePrescription}>
          <label className="field"><span>Doctor</span><input value={prescriptionForm.doctor} onChange={(event) => setPrescriptionForm({ ...prescriptionForm, doctor: event.target.value })} placeholder="Doctor name" required /></label>
          <label className="field"><span>Clinic or hospital</span><input value={prescriptionForm.clinic} onChange={(event) => setPrescriptionForm({ ...prescriptionForm, clinic: event.target.value })} placeholder="Clinic or hospital" /></label>
          <label className="field"><span>Instructions</span><textarea value={prescriptionForm.notes} onChange={(event) => setPrescriptionForm({ ...prescriptionForm, notes: event.target.value })} placeholder="Write the prescription instruction here" rows="4" /><span className="field-action-row"><small>Copy the written direction exactly. Review any simplified text against the original.</small>{cloudEnabled ? <button className="secondary-btn small" disabled={simplifyBusy || !prescriptionForm.notes.trim()} onClick={simplifyPrescriptionNotes} type="button"><Sparkles size={15} /> {simplifyBusy ? 'Simplifying…' : 'Simplify safely'}</button> : null}</span></label>
          <section className={`prescription-image-capture ${prescriptionDraftImageUrl ? 'has-image' : ''}`} aria-labelledby="prescription-image-title">
            <div className="prescription-image-capture-heading"><div><p className="section-kicker">Required attachment</p><h3 id="prescription-image-title">Prescription image</h3></div><span className="status-badge warning">Required</span></div>
            {prescriptionDraftImageUrl ? <div className="prescription-draft-preview"><img alt="Prescription image preview" src={prescriptionDraftImageUrl} /><div><strong>Image ready for review</strong><p>Replace it if the text is blurry or cut off.</p></div></div> : <div className="prescription-draft-empty"><FileImage size={24} /><div><strong>Add the original prescription</strong><p>Use a clear JPG, PNG, or WebP image up to 10 MB.</p></div></div>}
            <div className="prescription-capture-actions"><button className="secondary-btn small" disabled={prescriptionDraftBusy} onClick={capturePrescriptionDraft} type="button"><Camera size={15} /> {prescriptionDraftBusy ? 'Reading...' : 'Camera'}</button><button className="secondary-btn small" disabled={prescriptionDraftBusy} onClick={uploadPrescriptionDraft} type="button"><ImageUp size={15} /> Gallery</button><label className="secondary-btn small file-upload-btn"><ImageUp size={15} /> Choose file<input accept="image/jpeg,image/png,image/webp" aria-label="Choose prescription image file" disabled={prescriptionDraftBusy} hidden onChange={uploadPrescriptionDraftFile} type="file" /></label></div>
            {prescriptionOcr?.status === 'processing' ? <p className="helper-text ocr-status" role="status">{prescriptionOcr.message}</p> : null}
            {prescriptionOcr?.message && prescriptionOcr?.status !== 'processing' ? <p className={`helper-text ocr-status ${prescriptionOcr.status === 'failed' ? 'error-text' : ''}`} role="status">{prescriptionOcr.message}</p> : null}
            {prescriptionOcr?.text ? <div className="ocr-draft"><div><strong>OCR draft</strong><span>Review before saving</span></div><p>{prescriptionOcr.text}</p><button className="secondary-btn small" onClick={applyPrescriptionOcr} type="button">Use in instructions</button></div> : null}
          </section>
          <p className="helper-text">Prescription images stay on this device and may be mirrored to your configured cloud storage. OCR is a draft only; MedLoop never changes a prescription or dosage.</p>
          {formFeedback ? <p className="helper-text">{formFeedback}</p> : null}
          <button className="primary-btn" data-assistant-target="prescription-form-submit" type="submit">{prescriptionForm.id ? 'Update prescription' : 'Save prescription'}</button>
        </form>
      </section>

      <section className="panel-card">
        <div className="section-header"><div><p className="section-kicker">Secure records</p><h2>Stored prescriptions</h2></div><span className="count-badge">{prescriptions.length}</span></div>
        {prescriptions.length === 0 ? <div className="empty-state"><FileText size={22} /><div><strong>No prescriptions saved</strong><p>Save the written instructions, then take or upload a prescription image.</p></div></div> : (
          <div className="stack-list">
            {prescriptions.map((item) => {
              const imageUrl = prescriptionImageUrls?.[item.id]
              const busy = prescriptionPhotoBusyId === item.id
              return (
                <article className="prescription-record" key={item.id}>
                  <div className="prescription-record-main">
                    {imageUrl ? <button aria-label={`View prescription image from ${item.doctor}`} className="prescription-thumbnail-button" onClick={() => window.open(imageUrl, '_blank', 'noopener,noreferrer')} type="button"><img alt={`Prescription from ${item.doctor}`} className="prescription-thumbnail" src={imageUrl} /></button> : <span className="prescription-placeholder"><FileImage size={24} /></span>}
                    <div className="prescription-copy"><strong>{item.doctor}</strong><p>{item.clinic}{item.notes ? ` | ${item.notes}` : ''}</p><span className={`status-badge ${imageUrl ? 'success' : 'warning'}`}>{imageUrl ? 'Image on device' : 'Image required'}</span></div>
                  </div>
                  <div className="prescription-actions">
                    <button className="secondary-btn small" disabled={busy || Boolean(prescriptionPhotoBusyId)} onClick={() => capturePrescriptionImage(item.id)} type="button"><Camera size={15} /> {busy ? 'Opening...' : 'Camera'}</button>
                    <label className="secondary-btn small file-upload-btn" aria-disabled={busy || Boolean(prescriptionPhotoBusyId)}>
                      <ImageUp size={15} /> Upload
                      <input
                        accept="image/jpeg,image/png,image/webp"
                        aria-label={`Upload prescription image from ${item.doctor}`}
                        disabled={busy || Boolean(prescriptionPhotoBusyId)}
                        hidden
                        onChange={(event) => uploadPrescriptionImageFile(item.id, event)}
                        type="file"
                      />
                    </label>
                    <RecordActions editLabel={`Edit prescription from ${item.doctor}`} deleteLabel={`Delete prescription from ${item.doctor}`} onEdit={() => editPrescription(item)} onDelete={() => removePrescription(item)} />
                  </div>
                  {prescriptionPhotoFeedback?.[item.id] ? <p className="helper-text prescription-feedback" role="status">{prescriptionPhotoFeedback[item.id]}</p> : null}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </section>
  )
}

export default PrescriptionsPage
