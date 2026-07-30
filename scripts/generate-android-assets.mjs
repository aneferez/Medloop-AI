import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const sourceLogo = resolve('assets', 'logo.png')
const resourceRoot = resolve('android', 'app', 'src', 'main', 'res')

const launcherSizes = {
  ldpi: 36,
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
}

const adaptiveSizes = {
  ldpi: 81,
  mdpi: 108,
  hdpi: 162,
  xhdpi: 216,
  xxhdpi: 324,
  xxxhdpi: 432,
}

const splashSizes = {
  drawable: [320, 480],
  'drawable-night': [320, 240],
  'drawable-land-ldpi': [320, 240],
  'drawable-land-mdpi': [480, 320],
  'drawable-land-hdpi': [800, 480],
  'drawable-land-xhdpi': [1280, 720],
  'drawable-land-xxhdpi': [1600, 960],
  'drawable-land-xxxhdpi': [1920, 1280],
  'drawable-port-ldpi': [240, 320],
  'drawable-port-mdpi': [320, 480],
  'drawable-port-hdpi': [480, 800],
  'drawable-port-xhdpi': [720, 1280],
  'drawable-port-xxhdpi': [960, 1600],
  'drawable-port-xxxhdpi': [1280, 1920],
}

for (const [density, size] of Object.entries(launcherSizes)) {
  const directory = resolve(resourceRoot, `mipmap-${density}`)
  await mkdir(directory, { recursive: true })
  const launcher = await sharp(sourceLogo).resize(size, size).png().toBuffer()
  const circleMask = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`)

  await sharp(launcher).toFile(resolve(directory, 'ic_launcher.png'))
  await sharp(launcher).composite([{ input: circleMask, blend: 'dest-in' }]).png().toFile(resolve(directory, 'ic_launcher_round.png'))
}

for (const [density, size] of Object.entries(adaptiveSizes)) {
  const directory = resolve(resourceRoot, `mipmap-${density}`)
  await mkdir(directory, { recursive: true })
  await sharp(sourceLogo).resize(size, size).png().toFile(resolve(directory, 'ic_launcher_foreground.png'))
  await sharp({ create: { width: size, height: size, channels: 4, background: '#312E81' } }).png().toFile(resolve(directory, 'ic_launcher_background.png'))
}

const splashEntries = Object.entries(splashSizes)
for (const [directoryName, dimensions] of splashEntries) {
  const [width, height] = dimensions
  const directory = resolve(resourceRoot, directoryName)
  await mkdir(directory, { recursive: true })
  const logoSize = Math.round(Math.min(width, height) * 0.24)
  const logo = await sharp(sourceLogo).resize(logoSize, logoSize).png().toBuffer()
  await sharp({ create: { width, height, channels: 4, background: '#312E81' } })
    .composite([{ input: logo, left: Math.round((width - logoSize) / 2), top: Math.round((height - logoSize) / 2) }])
    .png()
    .toFile(resolve(directory, 'splash.png'))
}

for (const [directoryName] of splashEntries.filter(([name]) => name !== 'drawable' && !name.includes('night'))) {
  const nightDirectoryName = directoryName.replace(/^(drawable-(?:land|port))/, '$1-night')
  const nightDirectory = resolve(resourceRoot, nightDirectoryName)
  const regularSplash = resolve(resourceRoot, directoryName, 'splash.png')
  await mkdir(dirname(resolve(nightDirectory, 'splash.png')), { recursive: true })
  await sharp(regularSplash).toFile(resolve(nightDirectory, 'splash.png'))
}

const sampleRate = 44_100
const durationSeconds = 0.9
const sampleCount = Math.floor(sampleRate * durationSeconds)
const pcm = Buffer.alloc(sampleCount * 2)
for (let index = 0; index < sampleCount; index += 1) {
  const time = index / sampleRate
  const frequency = time < durationSeconds / 2 ? 784 : 988
  const attack = Math.min(1, time / 0.03)
  const release = Math.min(1, (durationSeconds - time) / 0.16)
  const envelope = Math.max(0, Math.min(attack, release))
  const sample = Math.round(Math.sin(2 * Math.PI * frequency * time) * 0.32 * envelope * 32767)
  pcm.writeInt16LE(sample, index * 2)
}

const wav = Buffer.alloc(44 + pcm.length)
wav.write('RIFF', 0)
wav.writeUInt32LE(36 + pcm.length, 4)
wav.write('WAVE', 8)
wav.write('fmt ', 12)
wav.writeUInt32LE(16, 16)
wav.writeUInt16LE(1, 20)
wav.writeUInt16LE(1, 22)
wav.writeUInt32LE(sampleRate, 24)
wav.writeUInt32LE(sampleRate * 2, 28)
wav.writeUInt16LE(2, 32)
wav.writeUInt16LE(16, 34)
wav.write('data', 36)
wav.writeUInt32LE(pcm.length, 40)
pcm.copy(wav, 44)

const rawDirectory = resolve(resourceRoot, 'raw')
await mkdir(rawDirectory, { recursive: true })
await writeFile(resolve(rawDirectory, 'medicine_reminder.wav'), wav)
