import { describe, expect, it } from 'vitest'
import { recognizePrescriptionText } from '../src/lib/prescriptionOcr'

describe('prescription OCR boundary', () => {
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
