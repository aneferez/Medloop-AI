import { newId, nowIso } from './ids.js'
import { tooManyRequests } from './errors.js'

// A small D1-backed fixed-window rate limiter. Records one event per allowed call
// under a bucket key and throws 429 once the window is full. Buckets are opaque
// strings, e.g. `login:alice@example.com`. Fixed-window is intentionally simple
// and predictable; it is a floor against abuse, not a precise quota.
export async function enforceRateLimit(db, bucket, { max, windowMinutes, now = new Date(), message } = {}) {
  const since = new Date(now.getTime() - windowMinutes * 60 * 1000).toISOString()
  const row = await db.first(
    'SELECT COUNT(*) AS n FROM rate_events WHERE bucket = ? AND created_at >= ?',
    [bucket, since],
  )
  if (row && Number(row.n) >= max) throw tooManyRequests(message)
  await db.run('INSERT INTO rate_events (id, bucket, created_at) VALUES (?, ?, ?)', [newId(), bucket, nowIso()])
}
