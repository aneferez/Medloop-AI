import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import TurnstileWidget from '../components/TurnstileWidget'

function AuthPage({ authMode, setAuthMode, authForm, setAuthForm, authError, resetFeedback, authSubmitting, handleAuthSubmit, handlePasswordReset, cloudEnabled, resetToken, setResetToken, handlePasswordResetComplete, setAttestationToken }) {
  const [showPassword, setShowPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')

  return (
    <main className="auth-gate">
      <section className="auth-layout">
        <div className="auth-card">
          <div className="auth-brand-mark">
            <img src="/icon.jpg" alt="MedLoop AI logo" />
            <div>
              <strong>MedLoop AI</strong>
              <span>Medicine reminders on this device</span>
            </div>
          </div>
            <div className="section-header">
            <div><p className="section-kicker">{cloudEnabled ? 'Secure account access' : 'Local account access'}</p><h2>{authMode === 'signup' ? 'Create your account' : 'Welcome back'}</h2></div>
            <span className="status-badge">{cloudEnabled ? 'Cloud + local cache' : 'On device'}</span>
          </div>
          <form className="form-stack" onSubmit={handleAuthSubmit}>
            {authMode === 'signup' ? (
              <label className="field"><span>Name</span><input disabled={authSubmitting} value={authForm.name} onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })} placeholder="Your name" /></label>
            ) : null}
            {cloudEnabled && (authMode === 'signup' || authMode === 'login') ? <TurnstileWidget onToken={setAttestationToken} /> : null}
            <label className="field"><span>Email</span><input disabled={authSubmitting} type="email" value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} placeholder="you@example.com" required /></label>
            <label className="field">
              <span>Password</span>
              <div className="password-input">
                <input
                  autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                  disabled={authSubmitting}
                  minLength={authMode === 'signup' ? 8 : undefined}
                  type={showPassword ? 'text' : 'password'}
                  value={authForm.password}
                  onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                  placeholder="Password"
                  required
                />
                <button
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  type="button"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  <span>{showPassword ? 'Hide' : 'Show'}</span>
                </button>
              </div>
            </label>
            {authError ? <p className="error-text">{authError}</p> : null}
            {resetFeedback ? <p className="helper-text" role="status">{resetFeedback}</p> : null}
            <button className="primary-btn" disabled={authSubmitting} type="submit">{authSubmitting ? 'Please wait...' : authMode === 'signup' ? 'Create account' : 'Log in'}</button>
          </form>
          {authMode === 'login' ? (
            <button className="text-btn" disabled={authSubmitting} onClick={handlePasswordReset} type="button">Forgot password?</button>
          ) : null}
          {cloudEnabled && authMode === 'login' && (resetFeedback || resetToken) ? (
            <section className="auth-recovery" aria-label="Complete password reset">
              <p className="section-kicker">Password recovery</p>
              <label className="field"><span>Reset token</span><input autoComplete="one-time-code" onChange={(event) => setResetToken(event.target.value)} placeholder="Paste the token from your email" value={resetToken} /></label>
              <label className="field"><span>New password</span><input autoComplete="new-password" minLength="8" onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 8 characters" type="password" value={newPassword} /></label>
              <button className="secondary-btn" disabled={authSubmitting || resetToken.trim().length < 10 || newPassword.length < 8} onClick={() => handlePasswordResetComplete(resetToken, newPassword)} type="button">Set new password</button>
            </section>
          ) : null}
          {cloudEnabled ? <p className="auth-cloud-note">Cloud mode uses your secure MedLoop account. Local-only mode remains available when the backend is not configured.</p> : null}
          <button className="text-btn" disabled={authSubmitting} onClick={() => setAuthMode(authMode === 'signup' ? 'login' : 'signup')} type="button">
            {authMode === 'signup' ? 'Already have an account? Log in' : 'New to MedLoop? Create an account'}
          </button>
        </div>
      </section>
    </main>
  )
}

export default AuthPage
