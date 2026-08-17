import { describe, expect, it } from 'vitest'
import { Validator, isE164, isEmail, isTime, isDate } from '../worker/src/lib/validate.js'
import { ApiError } from '../worker/src/lib/errors.js'

describe('worker Validator', () => {
  it('coerces and returns valid fields', () => {
    const v = new Validator({ name: '  Asha  ', level: 'Level 1', doses: 2 })
    v.string('name', { required: true, max: 60 })
    v.enum('level', ['Level 1', 'Level 2', 'Level 3'], { required: true })
    v.integer('doses', { min: 1, max: 10 })
    const out = v.ensureValid()
    expect(out).toEqual({ name: 'Asha', level: 'Level 1', doses: 2 })
  })

  it('applies fallbacks for missing optional fields', () => {
    const v = new Validator({})
    v.string('relationship', { fallback: 'Family member' })
    v.enum('platform', ['android', 'ios', 'web'], { fallback: 'android' })
    v.boolean('notifyPush', { fallback: true })
    expect(v.ensureValid()).toEqual({ relationship: 'Family member', platform: 'android', notifyPush: true })
  })

  it('throws a 422 ApiError listing every failed field', () => {
    const v = new Validator({ email: 'nope', phone: '12345', level: 'Level 9' })
    v.email('email')
    v.phone('phone')
    v.enum('level', ['Level 1', 'Level 2', 'Level 3'])
    v.string('name', { required: true })
    let caught
    try {
      v.ensureValid()
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(ApiError)
    expect(caught.status).toBe(422)
    expect(caught.code).toBe('validation_failed')
    expect(Object.keys(caught.details).sort()).toEqual(['email', 'level', 'name', 'phone'])
  })

  it('enforces integer bounds and rejects non-integers', () => {
    const v = new Validator({ stock: 3.5 })
    v.integer('stock', { min: 0 })
    expect(() => v.ensureValid()).toThrow(ApiError)
  })

  it('validates string arrays against an allow-list', () => {
    const ok = new Validator({ periods: ['morning', 'night'] })
    ok.stringArray('periods', { allowed: ['morning', 'afternoon', 'night'] })
    expect(ok.ensureValid()).toEqual({ periods: ['morning', 'night'] })

    const bad = new Validator({ periods: ['noon'] })
    bad.stringArray('periods', { allowed: ['morning', 'afternoon', 'night'] })
    expect(() => bad.ensureValid()).toThrow(ApiError)
  })

  it('lowercases valid emails and normalizes them into output', () => {
    const v = new Validator({ email: 'Asha@Example.COM' })
    v.email('email', { required: true })
    expect(v.ensureValid()).toEqual({ email: 'asha@example.com' })
  })
})

describe('worker format guards', () => {
  it('validates E.164 phone numbers', () => {
    expect(isE164('+14155550123')).toBe(true)
    expect(isE164('14155550123')).toBe(false)
    expect(isE164('+0123')).toBe(false)
  })

  it('validates emails, times, and dates', () => {
    expect(isEmail('a@b.co')).toBe(true)
    expect(isEmail('a@b')).toBe(false)
    expect(isTime('22:00')).toBe(true)
    expect(isTime('24:00')).toBe(false)
    expect(isDate('2026-08-16')).toBe(true)
    expect(isDate('2026/08/16')).toBe(false)
  })
})
