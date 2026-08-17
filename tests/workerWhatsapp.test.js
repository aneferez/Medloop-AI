import { describe, expect, it } from 'vitest'
import { buildWhatsappPayload, isWhatsappConfigured } from '../worker/src/channels/whatsapp.js'

describe('whatsapp — configuration', () => {
  it('is configured only with both a phone id and token', () => {
    expect(isWhatsappConfigured({ WHATSAPP_PHONE_NUMBER_ID: '1', WHATSAPP_ACCESS_TOKEN: 't' })).toBe(true)
    expect(isWhatsappConfigured({ WHATSAPP_PHONE_NUMBER_ID: '1' })).toBe(false)
    expect(isWhatsappConfigured({})).toBe(false)
  })
})

describe('whatsapp — payload builder', () => {
  it('sends free-form text when no template is configured', () => {
    const payload = buildWhatsappPayload({}, '+14155550123', { title: 'Low stock', body: 'Metformin: 3 left' })
    expect(payload).toEqual({
      messaging_product: 'whatsapp',
      to: '14155550123',
      type: 'text',
      text: { body: 'Low stock — Metformin: 3 left' },
    })
  })

  it('sends an approved template when WHATSAPP_TEMPLATE_NAME is set', () => {
    const payload = buildWhatsappPayload(
      { WHATSAPP_TEMPLATE_NAME: 'medloop_alert', WHATSAPP_TEMPLATE_LANG: 'en' },
      '+14155550123',
      { title: 'Low stock', body: 'Metformin: 3 left' },
    )
    expect(payload.type).toBe('template')
    expect(payload.template.name).toBe('medloop_alert')
    expect(payload.template.language.code).toBe('en')
    expect(payload.template.components[0].parameters.map((p) => p.text)).toEqual(['Low stock', 'Metformin: 3 left'])
  })

  it('collapses whitespace/newlines in template parameters', () => {
    const payload = buildWhatsappPayload(
      { WHATSAPP_TEMPLATE_NAME: 'medloop_alert' },
      '14155550123',
      { title: 'Daily check', body: 'These\n\nneed    attention:\tMetformin' },
    )
    expect(payload.template.components[0].parameters[1].text).toBe('These need attention: Metformin')
  })

  it('falls back to safe defaults when fields are missing', () => {
    const text = buildWhatsappPayload({}, '+1', {})
    expect(text.text.body).toBe('MedLoop alert')
    const tmpl = buildWhatsappPayload({ WHATSAPP_TEMPLATE_NAME: 'medloop_alert' }, '+1', {})
    expect(tmpl.template.components[0].parameters.map((p) => p.text)).toEqual(['MedLoop alert', 'Open MedLoop for details.'])
  })
})
