import { describe, expect, it } from 'vitest'
import { MAX_PRESCRIPTION_IMAGE_BYTES, validatePrescriptionImage } from '../src/lib/prescriptionCamera'

describe('camera and gallery image validation', () => {
  it('accepts supported camera/gallery image formats', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      const image = new Blob(['valid'], { type })
      expect(validatePrescriptionImage(image)).toBe(image)
    }
  })

  it('rejects unsupported or oversized uploads', () => {
    expect(() => validatePrescriptionImage(new Blob(['x'], { type: 'image/gif' }))).toThrow(/JPG, PNG, or WebP/)
    expect(() => validatePrescriptionImage({ type: 'image/jpeg', size: MAX_PRESCRIPTION_IMAGE_BYTES + 1 })).toThrow(/10 MB/)
  })
})
