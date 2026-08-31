const unsafeQueryPatterns = [
  /\b(diagnos(?:e|is|ing)?|what disease|what condition|do i have)\b/i,
  /\b(what|how much|should i|can i)\b.{0,50}\b(dose|dosage|take)\b/i,
  /\b(change|increase|decrease|double|skip|stop|start|adjust)\b.{0,35}\b(dose|dosage|medicine|medication)\b/i,
  /\b(create|write|recommend|give|renew)\b.{0,35}\bprescription\b/i,
  /(?:निदान|रोग|बीमारी|खुराक|मात्रा|प्रिस्क्रिप्शन)/i,
  /(?:நோய்|கண்டறி|மருந்தளவு|மருந்து அளவு|மருந்துச் சீட்டு)/i,
]

export function isUnsafeAssistantQuery(query) {
  const normalized = String(query || '').trim()
  return Boolean(normalized) && unsafeQueryPatterns.some((pattern) => pattern.test(normalized))
}
