// Builds the voice-guide text for each section/language straight from the app's
// own knowledge base, so generated audio always matches the on-screen guide.
// Output: scripts/voice-manifest.json  ->  consumed by generate-voice-audio.py
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { assistantSectionOrder, getSectionGuide } from '../src/lib/sectionAssistant.js'
import { createVoiceGuideText, localizeSectionGuide } from '../src/lib/assistantKnowledge.js'

// Hindi + Tamil: web/native TTS usually has no voice for these, so they need
// bundled audio. English is left to on-device TTS (voices always present).
const LANGUAGES = ['hi', 'ta']

const manifest = []
for (const lang of LANGUAGES) {
  for (const page of assistantSectionOrder) {
    const base = getSectionGuide(page)
    const guide = localizeSectionGuide(page, base, lang)
    if (guide === base) continue // no translation for this page/lang — skip
    manifest.push({ lang, page, text: createVoiceGuideText(guide) })
  }
}

const out = join(dirname(fileURLToPath(import.meta.url)), 'voice-manifest.json')
writeFileSync(out, JSON.stringify(manifest, null, 2))
console.log(`manifest entries: ${manifest.length}`)
console.log([...new Set(manifest.map((m) => m.page))].join(', '))
