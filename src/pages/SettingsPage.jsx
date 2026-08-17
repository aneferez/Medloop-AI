import { Avatar, Button, Stack } from '@mui/material'
import { useState } from 'react'
import { BellRing, Download, FileText, HardDrive, ShieldCheck, Smartphone, Trash2, Upload } from 'lucide-react'
import { defaultSettings, sanitizeSettings, validateSettingsForm } from '../lib/settings'
import { isCloudEnabled } from '../lib/cloud/config'
import { createLinkCode, redeemLinkCode } from '../lib/cloud/session'

// Pairing a second device. Self-contained because it talks to the cloud
// session directly and has no bearing on the local-first settings around it;
// the whole panel hides when the cloud backend is not configured.
function DevicePairingPanel({ user }) {
  const [code, setCode] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [entered, setEntered] = useState('')
  const [busy, setBusy] = useState('')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')

  if (!isCloudEnabled() || !user) return null

  const generate = async () => {
    setBusy('generate'); setError(''); setFeedback('')
    try {
      const result = await createLinkCode(user)
      setCode(result.code)
      setExpiresAt(result.expiresAt)
      setFeedback(`Enter this on your other device within ${result.expiresInMinutes} minutes.`)
    } catch (cause) {
      setError(cause?.message || 'Could not create a pairing code.')
    } finally {
      setBusy('')
    }
  }

  const redeem = async (event) => {
    event.preventDefault()
    setBusy('redeem'); setError(''); setFeedback('')
    try {
      await redeemLinkCode(user, entered)
      setEntered('')
      setFeedback('This device is now linked. Your records will appear shortly.')
    } catch (cause) {
      setError(cause?.message || 'Could not link this device.')
    } finally {
      setBusy('')
    }
  }

  return (
    <section className="panel-card">
      <div className="section-header"><div><p className="section-kicker">Account access</p><h2>Linked devices</h2></div><Smartphone size={20} /></div>
      <p>Use a pairing code to open the same MedLoop records on another phone. Codes last 10 minutes and work once.</p>

      <div className="pairing-row">
        <button className="secondary-btn" disabled={busy === 'generate'} onClick={generate} type="button">
          {busy === 'generate' ? 'Creating...' : 'Create a pairing code'}
        </button>
        {code ? <output className="pairing-code" aria-live="polite">{code}</output> : null}
      </div>
      {code && expiresAt ? <p className="helper-text">Expires at {new Date(expiresAt).toLocaleTimeString()}.</p> : null}

      <form className="pairing-row" onSubmit={redeem}>
        <label className="field grow">
          <span>Have a code from your other device?</span>
          <input
            aria-label="Pairing code"
            autoComplete="one-time-code"
            onChange={(event) => setEntered(event.target.value)}
            placeholder="ABCDE-FGHJK"
            value={entered}
          />
        </label>
        <button className="primary-btn" disabled={!entered.trim() || busy === 'redeem'} type="submit">
          {busy === 'redeem' ? 'Linking...' : 'Link this device'}
        </button>
      </form>

      {feedback ? <p className="helper-text">{feedback}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
    </section>
  )
}

function SettingsPage({
  user,
  settingsForm,
  setSettingsForm,
  saveSettings,
  settingsFeedback,
  settingsError,
  enableMedicineReminders,
  testMedicineReminder,
  handleDeleteAccount,
  deletePassword,
  setDeletePassword,
  accountDeleting,
  accountUsesPassword,
  profilePhotoUrl,
  profilePhotoFeedback,
  handleProfilePhotoChange,
  handleRemoveProfilePhoto,
  handleExportBackup,
  handleImportBackup,
  navigateTo,
}) {
  const [backupPassword, setBackupPassword] = useState('')
  const [backupBusy, setBackupBusy] = useState(false)
  const [backupFeedback, setBackupFeedback] = useState('')
  const [backupError, setBackupError] = useState('')
  const form = settingsForm ?? defaultSettings
  const displayedPhotoUrl = profilePhotoUrl || user?.photoURL || ''
  const update = (patch) => setSettingsForm?.({ ...form, ...patch, _errors: {} })
  const items = [
    {
      icon: BellRing,
      title: 'Device reminders',
      description: form.notificationsEnabled ? 'Medicine reminders use sound and Taken/Missed actions on this device.' : 'Enable Android notifications to receive medicine reminders.',
      status: form.notificationsEnabled ? 'Enabled' : 'Off',
    },
    {
      icon: HardDrive,
      title: 'Device storage',
      description: user?.email ? `Saved locally for ${user.email}.` : 'Saved on this device until you sign in.',
      status: 'Local',
    },
    {
      icon: Smartphone,
      title: 'Family SMS',
      description: 'A missed dose opens a prefilled family message for you to review and send.',
      status: form.smsAlerts ? 'Enabled' : 'Off',
    },
    {
      icon: Smartphone,
      title: 'Family WhatsApp',
      description: 'A missed dose opens a prefilled WhatsApp message for you to review and send.',
      status: form.whatsappAlerts ? 'Enabled' : 'Off',
    },
  ]

  return (
    <section className="page-stack">
      <section className="panel-card profile-photo-panel">
        <div className="section-header"><div><p className="section-kicker">Profile</p><h2>Profile photo</h2></div></div>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { xs: 'flex-start', sm: 'center' } }}>
          <Avatar alt={form.displayName || user?.displayName || 'MedLoop user'} src={displayedPhotoUrl || undefined} sx={{ bgcolor: 'primary.main', height: 88, width: 88, fontSize: 30 }}>
            {(form.displayName || user?.displayName || user?.email || 'M').slice(0, 1).toUpperCase()}
          </Avatar>
          <div className="profile-photo-copy">
            <p>Choose a JPG, PNG, or WebP image up to 10 MB. The photo stays on this device.</p>
            <Stack direction="row" gap={1} sx={{ flexWrap: 'wrap' }}>
              <Button component="label" startIcon={<Upload size={16} />} variant="contained">
                {displayedPhotoUrl ? 'Change photo' : 'Choose photo'}
                <input accept="image/jpeg,image/png,image/webp" aria-label="Profile photo file" hidden onChange={handleProfilePhotoChange} type="file" />
              </Button>
              {profilePhotoUrl ? <Button color="error" onClick={handleRemoveProfilePhoto} startIcon={<Trash2 size={16} />} variant="outlined">Remove</Button> : null}
            </Stack>
            {profilePhotoFeedback ? <p className="helper-text" role="status">{profilePhotoFeedback}</p> : null}
          </div>
        </Stack>
      </section>

      <section className="panel-card">
        <div className="section-header"><div><p className="section-kicker">Offline backup</p><h2>Export or restore local data</h2></div><HardDrive size={20} /></div>
        <p>Create a password-encrypted file containing this account&apos;s records and local images. The password cannot be recovered.</p>
        <label className="field"><span>Backup password</span><input autoComplete="new-password" disabled={backupBusy} minLength="8" onChange={(event) => setBackupPassword(event.target.value)} placeholder="At least 8 characters" type="password" value={backupPassword} /></label>
        <div className="button-row">
          <button className="secondary-btn" disabled={backupBusy || backupPassword.length < 8} onClick={async () => {
            setBackupBusy(true); setBackupError(''); setBackupFeedback('')
            try { setBackupFeedback(await handleExportBackup(backupPassword)) } catch (error) { setBackupError(error?.message || 'Unable to create backup.') } finally { setBackupBusy(false) }
          }} type="button"><Download size={16} /> Export encrypted backup</button>
          <Button component="label" disabled={backupBusy || backupPassword.length < 8} startIcon={<Upload size={16} />} variant="outlined">
            Restore backup
            <input accept=".medloop,application/json,application/octet-stream" aria-label="MedLoop encrypted backup file" hidden onChange={async (event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              setBackupBusy(true); setBackupError(''); setBackupFeedback('')
              try { setBackupFeedback(await handleImportBackup(file, backupPassword)) } catch (error) { setBackupError(error?.message || 'Unable to restore backup.') } finally { setBackupBusy(false) }
            }} type="file" />
          </Button>
        </div>
        {backupFeedback ? <p className="helper-text" role="status">{backupFeedback}</p> : null}
        {backupError ? <p className="error-text" role="alert">{backupError}</p> : null}
      </section>

      <section className="panel-card">
        <div className="section-header"><div><p className="section-kicker">Preferences</p><h2>Application settings</h2></div></div>
        <form
          className="form-stack"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            const errors = validateSettingsForm(form)
            if (Object.keys(errors).length > 0) {
              setSettingsForm?.({ ...form, _errors: errors })
              return
            }
            setSettingsForm?.({ ...form, _errors: {} })
            saveSettings?.(sanitizeSettings(form))
          }}
        >
          <label className="field"><span>Display name</span><input aria-invalid={Boolean(form._errors?.displayName)} aria-label="Display name" maxLength={60} onChange={(event) => update({ displayName: event.target.value })} placeholder="How MedLoop should greet you" value={form.displayName} />{form._errors?.displayName ? <p className="error-text" role="alert">{form._errors.displayName}</p> : null}</label>
          <label className="field"><span>Notification email</span><input aria-invalid={Boolean(form._errors?.email)} aria-label="Notification email" onChange={(event) => update({ email: event.target.value })} placeholder="you@example.com" type="email" value={form.email} />{form._errors?.email ? <p className="error-text" role="alert">{form._errors.email}</p> : null}</label>
          <label className="field"><span>Reminder lead time (minutes)</span><input aria-invalid={Boolean(form._errors?.reminderLeadMinutes)} aria-label="Reminder lead time in minutes" inputMode="numeric" max="240" min="0" onChange={(event) => update({ reminderLeadMinutes: event.target.value })} type="number" value={form.reminderLeadMinutes} />{form._errors?.reminderLeadMinutes ? <p className="error-text" role="alert">{form._errors.reminderLeadMinutes}</p> : null}</label>
          <label className="field inline-field"><input aria-label="Prepare SMS alerts" checked={Boolean(form.smsAlerts)} onChange={(event) => update({ smsAlerts: event.target.checked })} type="checkbox" /><span>Prepare a family SMS draft for missed doses</span></label>
          <label className="field inline-field"><input aria-label="Prepare WhatsApp alerts" checked={Boolean(form.whatsappAlerts)} onChange={(event) => update({ whatsappAlerts: event.target.checked })} type="checkbox" /><span>Prepare a family WhatsApp message for missed doses</span></label>
          {form.notificationsEnabled ? <label className="field inline-field"><input aria-label="Enable device reminders" checked onChange={(event) => update({ notificationsEnabled: event.target.checked })} type="checkbox" /><span>Keep device reminders enabled</span></label> : null}
          <div className="button-row">
            <button className="secondary-btn" onClick={enableMedicineReminders} type="button"><BellRing size={16} /> {form.notificationsEnabled ? 'Verify reminder access' : 'Enable medicine reminders'}</button>
            {form.notificationsEnabled ? <button className="secondary-btn" onClick={testMedicineReminder} type="button"><BellRing size={16} /> Test sound in 10 seconds</button> : null}
          </div>
          {settingsError ? <p className="error-text" role="alert">{settingsError}</p> : null}
          {settingsFeedback ? <p className="helper-text">{settingsFeedback}</p> : null}
          <button className="primary-btn" type="submit">Save settings</button>
        </form>
        <div className="settings-list">{items.map(({ icon: Icon, title, description, status }) => <div className="settings-row" key={title}><span className="settings-icon"><Icon size={18} /></span><div><strong>{title}</strong><p>{description}</p></div><span className={`status-badge ${status === 'Enabled' || status === 'Local' ? 'success' : ''}`}>{status}</span></div>)}</div>
      </section>

      <DevicePairingPanel user={user} />

      <section className="panel-card">
        <div className="section-header"><div><p className="section-kicker">Privacy and safety</p><h2>Legal information</h2></div><ShieldCheck size={20} /></div>
        <p>Review how MedLoop handles health data and the limits of reminder features.</p>
        <button className="secondary-btn" onClick={() => navigateTo('legal')} type="button"><FileText size={16} /> Privacy policy and disclaimer</button>
      </section>

      <section className="panel-card danger-zone">
        <div className="section-header"><div><p className="section-kicker">Account controls</p><h2>Delete account</h2></div><Trash2 size={20} /></div>
        <p>Permanently removes this local MedLoop account and its records from this device.</p>
        {accountUsesPassword ? <label className="field"><span>Current password</span><input autoComplete="current-password" disabled={!user || accountDeleting} onChange={(event) => setDeletePassword(event.target.value)} placeholder="Confirm password to delete" type="password" value={deletePassword} /></label> : null}
        <button className="danger-btn" disabled={!user || (accountUsesPassword && !deletePassword) || accountDeleting} onClick={handleDeleteAccount} type="button"><Trash2 size={16} /> {accountDeleting ? 'Deleting account...' : 'Delete my account'}</button>
      </section>
    </section>
  )
}

export default SettingsPage
