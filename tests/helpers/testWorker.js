import Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import worker from '../../worker/src/index.js'

const here = dirname(fileURLToPath(import.meta.url))
const SCHEMA = readFileSync(join(here, '../../worker/migrations/0001_initial_schema.sql'), 'utf8')

// Wraps an in-memory better-sqlite3 database in the D1 binding shape the Worker
// expects: prepare(sql).bind(...params).{first,all,run}() and batch([...]). This
// runs the real SQL (ON CONFLICT upserts, FK cascade, etc.) against SQLite — the
// same engine D1 is built on — without needing workerd/miniflare.
function createD1(db) {
  const bind = (sql, params) => ({
    __sql: sql,
    __params: params,
    async first() {
      return db.prepare(sql).get(...params) ?? null
    },
    async all() {
      return { results: db.prepare(sql).all(...params), success: true }
    },
    async run() {
      const info = db.prepare(sql).run(...params)
      return { success: true, meta: { changes: info.changes, last_row_id: info.lastInsertRowid } }
    },
  })
  const prepare = (sql) => ({
    bind: (...params) => bind(sql, params),
    first: () => bind(sql, []).first(),
    all: () => bind(sql, []).all(),
    run: () => bind(sql, []).run(),
  })
  return {
    prepare,
    async batch(statements) {
      const tx = db.transaction((list) => list.map((s) => {
        const info = db.prepare(s.__sql).run(...s.__params)
        return { success: true, meta: { changes: info.changes, last_row_id: info.lastInsertRowid } }
      }))
      return tx(statements)
    },
  }
}

function createTestEnv(extra = {}) {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)
  return {
    DB: createD1(db),
    ENVIRONMENT: 'test',
    API_VERSION: 'v1',
    ALLOWED_ORIGINS: '*',
    ...extra,
  }
}

// A fresh, isolated Worker client backed by its own in-memory D1.
export function makeClient(extra = {}) {
  const env = createTestEnv(extra)
  const ctx = { waitUntil() {}, passThroughOnException() {} }

  async function call(method, path, { token, body } = {}) {
    const headers = {}
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (token) headers.Authorization = `Bearer ${token}`
    const request = new Request(`https://api.test${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    const response = await worker.fetch(request, env, ctx)
    let payload = null
    try { payload = await response.json() } catch { /* no body */ }
    return {
      status: response.status,
      body: payload,
      data: payload?.data,
      error: payload?.error,
    }
  }

  // Registers a fresh patient + device and returns { patientId, deviceId, token }.
  async function register(overrides = {}) {
    const res = await call('POST', '/v1/auth/register', {
      body: { email: `u_${Math.random().toString(16).slice(2)}@example.com`, displayName: 'Test', ...overrides },
    })
    return res.data
  }

  return { env, call, register }
}
