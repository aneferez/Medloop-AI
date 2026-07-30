import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'

const outputDirectory = resolve('public')
const nativeAssetDirectory = resolve('assets')
const sourceIcon = resolve('public', 'icon.jpg')

await mkdir(outputDirectory, { recursive: true })
await mkdir(nativeAssetDirectory, { recursive: true })

const metadata = await sharp(sourceIcon).metadata()
const cropSize = Math.round(Math.min(metadata.width, metadata.height) * 0.76)
const crop = {
  left: Math.round((metadata.width - cropSize) / 2),
  top: Math.round((metadata.height - cropSize) / 2),
  width: cropSize,
  height: cropSize,
}

const outputs = [
  ['medloop-logo-192.png', 192],
  ['medloop-logo-512.png', 512],
  ['medloop-apple-touch-icon.png', 180],
]

await Promise.all(outputs.map(([fileName, size]) => (
  sharp(sourceIcon)
    .extract(crop)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    })
    .png({ compressionLevel: 9 })
    .toFile(resolve(outputDirectory, fileName))
)))

await sharp(sourceIcon)
  .extract(crop)
  .resize(1024, 1024)
  .png({ compressionLevel: 9 })
  .toFile(resolve(nativeAssetDirectory, 'logo.png'))
