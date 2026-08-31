import { describe, expect, it } from 'vitest'
import { OCR_SCRIPTS, recognizePrescriptionText, resolveOcrScript } from '../src/lib/prescriptionOcr'

describe('prescription OCR boundary', () => {
  it('exposes only scripts supported by the bundled ML Kit plugin', () => {
    expect(OCR_SCRIPTS.map((script) => script.value)).toEqual(['LATIN', 'DEVANAGARI'])
  })

  it('maps UI script values to the ML Kit enum keys', () => {
    const Script = { Latin: 'LATIN_ENUM', Devanagari: 'DEVANAGARI_ENUM' }

    expect(resolveOcrScript(Script, 'LATIN')).toBe('LATIN_ENUM')
    expect(resolveOcrScript(Script, 'DEVANAGARI')).toBe('DEVANAGARI_ENUM')
    expect(resolveOcrScript(Script, 'unsupported')).toBe('LATIN_ENUM')
  })

  it('requires an image before OCR can start', async () => {
    await expect(recognizePrescriptionText(null)).rejects.toThrow('Add a prescription image')
  })

  it('keeps browser OCR local and credential-free', async () => {
    const result = await recognizePrescriptionText(new Blob(['prescription'], { type: 'image/png' }))

    expect(result.status).toBe('unavailable')
    expect(result.text).toBe('')
    expect(result.message).toContain('Android app')
  })
})
