import { mkdir, writeFile } from 'node:fs/promises'
import { getSectionGuide, assistantSectionOrder } from '../src/lib/sectionAssistant.js'
import { localizeSectionGuide } from '../src/lib/assistantKnowledge.js'

const languages = [
  { id: 'as', label: 'অসমীয়া', speechCode: 'as-IN' },
  { id: 'bn', label: 'বাংলা', speechCode: 'bn-IN' },
  { id: 'brx', label: 'बरʼ', speechCode: 'brx-IN' },
  { id: 'doi', label: 'डोगरी', speechCode: 'doi-IN' },
  { id: 'gu', label: 'ગુજરાતી', speechCode: 'gu-IN' },
  { id: 'hi', label: 'हिन्दी', speechCode: 'hi-IN' },
  { id: 'kn', label: 'ಕನ್ನಡ', speechCode: 'kn-IN' },
  { id: 'ks', label: 'کٲشُر', speechCode: 'ks-IN' },
  { id: 'kok', label: 'कोंकणी', speechCode: 'kok-IN', translationCode: 'gom' },
  { id: 'mai', label: 'मैथिली', speechCode: 'mai-IN' },
  { id: 'ml', label: 'മലയാളം', speechCode: 'ml-IN' },
  { id: 'mni', label: 'মৈতৈলোন্', speechCode: 'mni-IN', translationCode: 'mni-Mtei' },
  { id: 'mr', label: 'मराठी', speechCode: 'mr-IN' },
  { id: 'ne', label: 'नेपाली', speechCode: 'ne-IN' },
  { id: 'or', label: 'ଓଡ଼ିଆ', speechCode: 'or-IN' },
  { id: 'pa', label: 'ਪੰਜਾਬੀ', speechCode: 'pa-IN' },
  { id: 'sa', label: 'संस्कृतम्', speechCode: 'sa-IN' },
  { id: 'sat', label: 'ᱥᱟᱱᱛᱟᱲᱤ', speechCode: 'sat-IN' },
  { id: 'sd', label: 'سنڌي', speechCode: 'sd-IN' },
  { id: 'ta', label: 'தமிழ்', speechCode: 'ta-IN' },
  { id: 'te', label: 'తెలుగు', speechCode: 'te-IN' },
  { id: 'ur', label: 'اردو', speechCode: 'ur-IN' },
]

const safety = 'Guidance only. MedLoop does not provide medical advice, diagnosis, treatment, or emergency monitoring.'

async function translate(text, language) {
  if (language.id === 'hi' || language.id === 'ta') return null
  const target = language.translationCode || language.id
  const url = new URL('https://translate.googleapis.com/translate_a/single')
  url.searchParams.set('client', 'gtx')
  url.searchParams.set('sl', 'en')
  url.searchParams.set('tl', target)
  url.searchParams.set('dt', 't')
  url.searchParams.set('q', text)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${language.id}: translation request failed (${response.status})`)
  const body = await response.json()
  const translated = body?.[0]?.map((part) => part?.[0] || '').join('').trim()
  if (!translated) throw new Error(`${language.id}: translation response was empty`)
  return translated
}

const output = { generatedAt: new Date().toISOString(), languages, transcripts: {} }

for (const language of languages) {
  output.transcripts[language.id] = {}
  for (const pageId of assistantSectionOrder) {
    const baseGuide = getSectionGuide(pageId)
    const localized = localizeSectionGuide(pageId, baseGuide, language.id)
    const englishText = [baseGuide.title, baseGuide.description, ...baseGuide.tips, safety].join('. ')
    const localText = language.id === 'hi' || language.id === 'ta'
      ? [localized.title, localized.description, ...localized.tips].join('. ')
      : await translate(englishText, language)
    output.transcripts[language.id][pageId] = localText
  }
}

await mkdir(new URL('../src/data/', import.meta.url), { recursive: true })
await writeFile(new URL('../src/data/assistantVoiceTranscripts.generated.json', import.meta.url), `${JSON.stringify(output, null, 2)}\n`)
console.log(`Generated ${languages.length * assistantSectionOrder.length} translated transcripts.`)
