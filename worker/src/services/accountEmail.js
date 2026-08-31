// Account lifecycle emails (verification + password reset). These are ACCOUNT
// emails only — they must never contain medical information (guardrail G3).
// Delivery reuses the shared email channel (Resend); when it is unconfigured the
// channel returns "skipped" so dev/test flows still work via the non-prod token
// echo in the auth routes.

import { sendEmail } from '../channels/email.js'

const APP_NAME = 'MedLoop'

export function sendVerificationEmail(env, email, token) {
  const link = `medloop://verify-email?token=${encodeURIComponent(token)}`
  return sendEmail(env, email, {
    title: `${APP_NAME}: confirm your email`,
    body:
      `Welcome to ${APP_NAME}. Confirm your email address to finish setting up your account:\n\n` +
      `${link}\n\n` +
      `This link expires in 24 hours. If you did not create a ${APP_NAME} account, you can ignore this email.`,
  })
}

export function sendPasswordResetEmail(env, email, token) {
  const link = `medloop://reset-password?token=${encodeURIComponent(token)}`
  return sendEmail(env, email, {
    title: `${APP_NAME}: reset your password`,
    body:
      `We received a request to reset your ${APP_NAME} password. Use the link below to choose a new one:\n\n` +
      `${link}\n\n` +
      `This link expires in 1 hour. If you did not request this, you can safely ignore this email — ` +
      `your password will not change.`,
  })
}
