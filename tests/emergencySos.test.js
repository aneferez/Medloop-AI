import { describe, expect, it } from 'vitest'
import { emergencyCallLink, hasValidPhone, selectPrimaryContactLocal } from '../src/lib/cloud/emergencySos'

const member = (over = {}) => ({ id: 'm', name: 'Contact', alertLevel: 'Level 3', phone: '', ...over })

describe('emergency SOS — primary contact selection (row #21)', () => {
  it('returns null when there is no family', () => {
    expect(selectPrimaryContactLocal([])).toBeNull()
    expect(selectPrimaryContactLocal(undefined)).toBeNull()
  })

  it('prefers a callable Level 1 contact', () => {
    const members = [
      member({ id: 'a', alertLevel: 'Level 1', phone: '' }),
      member({ id: 'b', alertLevel: 'Level 1', phone: '+14155550123' }),
      member({ id: 'c', alertLevel: 'Level 3', phone: '+14155550999' }),
    ]
    expect(selectPrimaryContactLocal(members).id).toBe('b')
  })

  it('falls back to a Level 1 contact even without a phone', () => {
    const members = [member({ id: 'a', alertLevel: 'Level 1', phone: '' }), member({ id: 'b', alertLevel: 'Level 2' })]
    expect(selectPrimaryContactLocal(members).id).toBe('a')
  })

  it('falls back to any callable contact, then the first member', () => {
    expect(selectPrimaryContactLocal([member({ id: 'a' }), member({ id: 'b', phone: '+14155550123' })]).id).toBe('b')
    expect(selectPrimaryContactLocal([member({ id: 'a' }), member({ id: 'b' })]).id).toBe('a')
  })
})

describe('emergency SOS — call link', () => {
  it('builds a tel: link from a valid E.164 number', () => {
    expect(emergencyCallLink({ phone: '+14155550123' })).toBe('tel:+14155550123')
    expect(emergencyCallLink({ phone: ' +14155550123 ' })).toBe('tel:+14155550123')
  })

  it('returns null for missing or invalid numbers', () => {
    expect(emergencyCallLink({ phone: '' })).toBeNull()
    expect(emergencyCallLink({ phone: '5550123' })).toBeNull()
    expect(emergencyCallLink(null)).toBeNull()
  })

  it('validates phone presence', () => {
    expect(hasValidPhone({ phone: '+14155550123' })).toBe(true)
    expect(hasValidPhone({ phone: 'nope' })).toBe(false)
  })
})
