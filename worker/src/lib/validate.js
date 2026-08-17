import { validationError } from './errors.js'

// Field-level request validator. Collect coerced values into `output`, record
// field errors, then call ensureValid() to throw a single 422 if any failed.
export class Validator {
  constructor(input = {}) {
    this.input = input && typeof input === 'object' ? input : {}
    this.errors = {}
    this.output = {}
  }

  fail(field, message) {
    if (!this.errors[field]) this.errors[field] = message
    return undefined
  }

  string(field, { required = false, min = 0, max = 5000, trim = true, fallback = undefined } = {}) {
    let value = this.input[field]
    if (value === undefined || value === null) {
      if (required) return this.fail(field, `${field} is required.`)
      if (fallback !== undefined) this.output[field] = fallback
      return fallback
    }
    value = String(value)
    if (trim) value = value.trim()
    if (required && value.length === 0) return this.fail(field, `${field} is required.`)
    if (value.length < min) return this.fail(field, `${field} must be at least ${min} characters.`)
    if (value.length > max) return this.fail(field, `${field} must be at most ${max} characters.`)
    this.output[field] = value
    return value
  }

  enum(field, allowed, { required = false, fallback = undefined } = {}) {
    const value = this.input[field]
    if (value === undefined || value === null) {
      if (required) return this.fail(field, `${field} is required.`)
      if (fallback !== undefined) this.output[field] = fallback
      return fallback
    }
    if (!allowed.includes(value)) return this.fail(field, `${field} must be one of: ${allowed.join(', ')}.`)
    this.output[field] = value
    return value
  }

  integer(field, { required = false, min = -Infinity, max = Infinity, fallback = undefined } = {}) {
    const raw = this.input[field]
    if (raw === undefined || raw === null || raw === '') {
      if (required) return this.fail(field, `${field} is required.`)
      if (fallback !== undefined) this.output[field] = fallback
      return fallback
    }
    const value = Number(raw)
    if (!Number.isInteger(value)) return this.fail(field, `${field} must be a whole number.`)
    if (value < min) return this.fail(field, `${field} must be >= ${min}.`)
    if (value > max) return this.fail(field, `${field} must be <= ${max}.`)
    this.output[field] = value
    return value
  }

  number(field, { required = false, min = -Infinity, max = Infinity, fallback = undefined } = {}) {
    const raw = this.input[field]
    if (raw === undefined || raw === null || raw === '') {
      if (required) return this.fail(field, `${field} is required.`)
      if (fallback !== undefined) this.output[field] = fallback
      return fallback
    }
    const value = Number(raw)
    if (!Number.isFinite(value)) return this.fail(field, `${field} must be a number.`)
    if (value < min) return this.fail(field, `${field} must be >= ${min}.`)
    if (value > max) return this.fail(field, `${field} must be <= ${max}.`)
    this.output[field] = value
    return value
  }

  boolean(field, { fallback = undefined } = {}) {
    const raw = this.input[field]
    if (raw === undefined || raw === null) {
      if (fallback !== undefined) this.output[field] = fallback
      return fallback
    }
    const value = raw === true || raw === 1 || raw === '1' || raw === 'true'
    this.output[field] = value
    return value
  }

  email(field, { required = false } = {}) {
    const value = this.string(field, { required, max: 254 })
    if (value && !isEmail(value)) return this.fail(field, `${field} must be a valid email address.`)
    if (value) this.output[field] = value.toLowerCase()
    return this.output[field]
  }

  phone(field, { required = false } = {}) {
    const value = this.string(field, { required, max: 20 })
    if (value && !isE164(value)) return this.fail(field, `${field} must be an E.164 phone number (e.g. +14155550123).`)
    return value
  }

  time(field, { required = false, fallback = undefined } = {}) {
    const value = this.string(field, { required, max: 5, fallback })
    if (value && !isTime(value)) return this.fail(field, `${field} must be HH:mm.`)
    return value
  }

  date(field, { required = false } = {}) {
    const value = this.string(field, { required, max: 10 })
    if (value && !isDate(value)) return this.fail(field, `${field} must be YYYY-MM-DD.`)
    return value
  }

  // JSON array of allowed string values (e.g. enabled dose periods).
  stringArray(field, { allowed = null, max = 50, fallback = undefined } = {}) {
    const raw = this.input[field]
    if (raw === undefined || raw === null) {
      if (fallback !== undefined) this.output[field] = fallback
      return fallback
    }
    if (!Array.isArray(raw)) return this.fail(field, `${field} must be an array.`)
    if (raw.length > max) return this.fail(field, `${field} must have at most ${max} items.`)
    const values = raw.map((item) => String(item))
    if (allowed && values.some((item) => !allowed.includes(item))) {
      return this.fail(field, `${field} may only contain: ${allowed.join(', ')}.`)
    }
    this.output[field] = values
    return values
  }

  ensureValid() {
    if (Object.keys(this.errors).length > 0) throw validationError(this.errors)
    return this.output
  }
}

export const isEmail = (value) => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
export const isE164 = (value) => typeof value === 'string' && /^\+[1-9]\d{7,14}$/.test(value)
export const isTime = (value) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
export const isDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
