import { unauthorized } from '../lib/errors.js'
import { nowIso, sha256Hex } from '../lib/ids.js'

// Resolves the caller from a Bearer device-session token. Returns
// { patient, device } or throws 401. Tokens are stored only as SHA-256 hashes;
// the plaintext is shown once at registration/link time.
export async function authenticate(request, db) {
  const header = request.headers.get('Authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  if (!match) throw unauthorized()

  const tokenHash = await sha256Hex(match[1].trim())
  const device = await db.first(
    'SELECT * FROM devices WHERE token_hash = ? AND revoked_at IS NULL',
    [tokenHash],
  )
  if (!device) throw unauthorized('Session token is invalid or revoked.')

  const patient = await db.first('SELECT * FROM patients WHERE id = ?', [device.patient_id])
  if (!patient) throw unauthorized('Account no longer exists.')

  // Best-effort last-seen bookkeeping; never fail the request on this.
  try {
    await db.run('UPDATE devices SET last_seen_at = ? WHERE id = ?', [nowIso(), device.id])
  } catch {
    // ignore
  }
  return { patient, device }
}
