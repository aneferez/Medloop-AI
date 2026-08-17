export const assistantLanguages = [
  { id: 'en', label: 'English', speechCode: 'en-IN' },
  { id: 'hi', label: 'हिन्दी', speechCode: 'hi-IN' },
  { id: 'ta', label: 'தமிழ்', speechCode: 'ta-IN' },
]

const localizedCopy = {
  en: {
    guide: 'MedLoop AI guide', welcome: 'Welcome', inSection: 'you’re in', listen: 'Listen', stop: 'Stop', searchPlaceholder: 'Ask about medicines, reminders, privacy…', ask: 'Ask', noAnswer: 'I can only answer approved MedLoop help topics. Try asking about medicines, reminders, backups, family alerts, appointments, reports, privacy, or emergencies.', helpful: 'Was this helpful?', thanks: 'Thanks — your anonymous response was saved only on this device.', yes: 'Yes', no: 'No', approved: 'Approved help only. Questions are not saved or sent anywhere.', safety: 'Guidance only — not medical advice or emergency monitoring.', searchTitle: 'Search help', automatic: 'Automatically introduce sections I haven’t visited', next: 'Next section', recommended: 'Recommended next', progress: 'sections introduced', voiceUnavailable: 'Voice guidance is unavailable on this device.', emergency: 'For an emergency, call local emergency services now.',
  },
  hi: {
    guide: 'MedLoop AI मार्गदर्शक', welcome: 'स्वागत है', inSection: 'आप इस भाग में हैं:', listen: 'सुनें', stop: 'रोकें', searchPlaceholder: 'दवा, रिमाइंडर या गोपनीयता के बारे में पूछें…', ask: 'पूछें', noAnswer: 'मैं केवल स्वीकृत MedLoop सहायता विषयों का उत्तर दे सकता हूँ। दवा, रिमाइंडर, बैकअप, परिवार अलर्ट, अपॉइंटमेंट, रिपोर्ट, गोपनीयता या आपातकाल के बारे में पूछें।', helpful: 'क्या यह उपयोगी था?', thanks: 'धन्यवाद — आपकी गुमनाम प्रतिक्रिया केवल इस डिवाइस पर सहेजी गई।', yes: 'हाँ', no: 'नहीं', approved: 'केवल स्वीकृत सहायता। सवाल सहेजे या कहीं भेजे नहीं जाते।', safety: 'केवल मार्गदर्शन — चिकित्सा सलाह या आपातकालीन निगरानी नहीं।', searchTitle: 'सहायता खोजें', automatic: 'नए भागों का परिचय अपने-आप दिखाएँ', next: 'अगला भाग', recommended: 'अगला सुझाव', progress: 'भागों का परिचय पूरा', voiceUnavailable: 'इस डिवाइस पर आवाज़ मार्गदर्शन उपलब्ध नहीं है।', emergency: 'आपातकाल में तुरंत स्थानीय आपातकालीन सेवा को कॉल करें।',
  },
  ta: {
    guide: 'MedLoop AI வழிகாட்டி', welcome: 'வரவேற்கிறோம்', inSection: 'நீங்கள் உள்ள பகுதி:', listen: 'கேட்க', stop: 'நிறுத்து', searchPlaceholder: 'மருந்து, நினைவூட்டல் அல்லது தனியுரிமை பற்றி கேளுங்கள்…', ask: 'கேள்', noAnswer: 'அங்கீகரிக்கப்பட்ட MedLoop உதவி தலைப்புகளுக்கு மட்டுமே பதிலளிக்க முடியும். மருந்துகள், நினைவூட்டல்கள், காப்புப்பிரதி, குடும்ப எச்சரிக்கைகள், சந்திப்புகள், அறிக்கைகள், தனியுரிமை அல்லது அவசரநிலை பற்றி கேளுங்கள்.', helpful: 'இது பயனுள்ளதாக இருந்ததா?', thanks: 'நன்றி — உங்கள் பெயரில்லா பதில் இந்தச் சாதனத்தில் மட்டும் சேமிக்கப்பட்டது.', yes: 'ஆம்', no: 'இல்லை', approved: 'அங்கீகரிக்கப்பட்ட உதவி மட்டும். கேள்விகள் சேமிக்கப்படவோ அனுப்பப்படவோ மாட்டாது.', safety: 'வழிகாட்டல் மட்டும் — மருத்துவ ஆலோசனை அல்லது அவசர கண்காணிப்பு அல்ல.', searchTitle: 'உதவி தேடல்', automatic: 'பார்க்காத பகுதிகளை தானாக அறிமுகப்படுத்து', next: 'அடுத்த பகுதி', recommended: 'அடுத்த பரிந்துரை', progress: 'பகுதிகள் அறிமுகப்படுத்தப்பட்டன', voiceUnavailable: 'இந்தச் சாதனத்தில் குரல் வழிகாட்டல் கிடைக்கவில்லை.', emergency: 'அவசரநிலையில் உடனே உள்ளூர் அவசர சேவையை அழைக்கவும்.',
  },
}

const commonLocalizedTips = {
  hi: ['सहेजने से पहले जानकारी जाँचें।', 'दवा और खुराक के लिए मूल प्रिस्क्रिप्शन का पालन करें।', 'आपातकाल में स्थानीय आपातकालीन सेवा से संपर्क करें।'],
  ta: ['சேமிக்கும் முன் தகவலைச் சரிபார்க்கவும்.', 'மருந்து மற்றும் அளவுக்கு அசல் மருந்துச் சீட்டைப் பின்பற்றவும்.', 'அவசரநிலையில் உள்ளூர் அவசர சேவையைத் தொடர்புகொள்ளவும்.'],
}

const recommendationTranslations = {
  hi: {
    family: ['पहली देखभाल प्रोफ़ाइल जोड़ें', 'इससे दवाओं और आपातकालीन जानकारी के लिए सही व्यक्ति जुड़ता है।'],
    medicines: ['पहली दवा जोड़ें', 'इससे दैनिक खुराक का समय बनता है।'],
    appointments: ['अगला अपॉइंटमेंट सहेजें', 'इससे बुनियादी देखभाल अवलोकन पूरा होता है।'],
    alerts: ['अलर्ट देखें', 'इन सूचनाओं पर आपका ध्यान आवश्यक हो सकता है।'],
    dashboard: ['आज का डैशबोर्ड खोलें', 'दैनिक उपयोग के लिए मुख्य सेटअप तैयार है।'],
  },
  ta: {
    family: ['முதல் பராமரிப்பு சுயவிவரத்தைச் சேர்க்கவும்', 'இது மருந்துகள் மற்றும் அவசரத் தகவலுக்கு உரிய நபரை இணைக்கிறது.'],
    medicines: ['முதல் மருந்தைச் சேர்க்கவும்', 'இது தினசரி மருந்து அட்டவணையை உருவாக்குகிறது.'],
    appointments: ['அடுத்த சந்திப்பைச் சேமிக்கவும்', 'இது அடிப்படை பராமரிப்பு கண்ணோட்டத்தை நிறைவு செய்கிறது.'],
    alerts: ['எச்சரிக்கைகளைப் பார்க்கவும்', 'இந்தத் தகவல்களுக்கு உங்கள் கவனம் தேவைப்படலாம்.'],
    dashboard: ['இன்றைய டாஷ்போர்டைத் திறக்கவும்', 'தினசரி பயன்பாட்டிற்கான முக்கிய அமைவு தயாராக உள்ளது.'],
  },
}

const sectionTranslations = {
  hi: {
    home: ['होम', 'ज़रूरी जानकारी से शुरू करें', 'होम आपकी सेटअप प्रगति दिखाता है और उपयोगी दैनिक देखभाल योजना बनाने का सबसे आसान रास्ता बताता है।'],
    dashboard: ['डैशबोर्ड', 'आज की देखभाल दिनचर्या संभालें', 'अगली निर्धारित खुराक देखें, Taken या Missed दर्ज करें और अपॉइंटमेंट या अलर्ट देखें।'],
    family: ['परिवार', 'देखभाल समूह तैयार करें', 'अपने या प्रियजन के लिए प्रोफ़ाइल बनाएँ और दवाओं तथा वैकल्पिक परिवार संपर्क को जोड़ें।'],
    medicines: ['दवाएँ', 'सुरक्षित रिमाइंडर समय बनाएँ', 'लेबल का विवरण, खुराक का समय और वैकल्पिक स्टॉक जानकारी दर्ज करें। MedLoop खुराक की सलाह नहीं देता।'],
    prescriptions: ['प्रिस्क्रिप्शन', 'प्रिस्क्रिप्शन रिकॉर्ड साथ रखें', 'डॉक्टर, क्लिनिक, नोट और वैकल्पिक फोटो इस डिवाइस पर सुरक्षित करें।'],
    alerts: ['अलर्ट', 'ध्यान देने वाली चीज़ें देखें', 'अलर्ट छूटी खुराक, रिफिल स्थिति और कम स्टॉक की सूचना आपके रिकॉर्ड से दिखाते हैं।'],
    appointments: ['अपॉइंटमेंट', 'अगली मुलाकात याद रखें', 'डॉक्टर या क्लिनिक की अगली मुलाकात सहेजें ताकि वह दैनिक अवलोकन में दिखे।'],
    reports: ['रिपोर्ट', 'दर्ज अनुपालन समझें', 'रिपोर्ट MedLoop में दर्ज Taken और Missed कार्रवाइयों का सार दिखाती है।'],
    'emergency-card': ['आपातकालीन कार्ड', 'साझा करने से पहले ज़रूरी जानकारी जाँचें', 'यह कार्ड प्रोफ़ाइल, एलर्जी, ब्लड ग्रुप, संपर्क और दवा की सहेजी जानकारी एक जगह दिखाता है।'],
    settings: ['सेटिंग्स', 'गोपनीयता और रिमाइंडर नियंत्रित करें', 'प्रोफ़ाइल, डिवाइस रिमाइंडर, परिवार संदेश, एन्क्रिप्टेड बैकअप और अकाउंट डेटा संभालें।'],
    legal: ['गोपनीयता और सुरक्षा', 'MedLoop की सीमाएँ समझें', 'स्थानीय डेटा, रिमाइंडर की सीमाएँ, चिकित्सा अस्वीकरण और अकाउंट हटाने की जानकारी पढ़ें।'],
  },
  ta: {
    home: ['முகப்பு', 'அத்தியாவசிய தகவல்களுடன் தொடங்குங்கள்', 'முகப்பு அமைவு முன்னேற்றத்தையும் பயனுள்ள தினசரி பராமரிப்பு திட்டத்திற்கான எளிய வழியையும் காட்டுகிறது.'],
    dashboard: ['டாஷ்போர்டு', 'இன்றைய பராமரிப்பை நிர்வகிக்கவும்', 'அடுத்த மருந்து நேரத்தைப் பார்த்து Taken அல்லது Missed என பதிவு செய்து சந்திப்புகள் மற்றும் எச்சரிக்கைகளைப் பாருங்கள்.'],
    family: ['குடும்பம்', 'பராமரிப்பு வட்டத்தை அமைக்கவும்', 'உங்களுக்கோ அன்புக்குரியவருக்கோ சுயவிவரம் உருவாக்கி மருந்துகள் மற்றும் குடும்பத் தொடர்பை இணைக்கவும்.'],
    medicines: ['மருந்துகள்', 'பாதுகாப்பான நினைவூட்டல் அட்டவணை அமைக்கவும்', 'லேபிள் விவரம், மருந்து நேரம் மற்றும் விருப்பமான இருப்புத் தகவலை பதிவு செய்யுங்கள். MedLoop மருந்தளவை பரிந்துரைக்காது.'],
    prescriptions: ['மருந்துச் சீட்டுகள்', 'மருந்துச் சீட்டு பதிவுகளை ஒன்றாக வைத்திருங்கள்', 'மருத்துவர், மருத்துவமனை, குறிப்பு மற்றும் விருப்பமான படத்தை இந்தச் சாதனத்தில் சேமிக்கவும்.'],
    alerts: ['எச்சரிக்கைகள்', 'கவனம் தேவைப்படும் தகவல்களைப் பாருங்கள்', 'தவறிய மருந்து, மீண்டும் வாங்க வேண்டிய நிலை மற்றும் குறைந்த இருப்பை உங்கள் பதிவுகளிலிருந்து காட்டுகிறது.'],
    appointments: ['சந்திப்புகள்', 'அடுத்த சந்திப்பை நினைவில் வைத்திருங்கள்', 'மருத்துவர் அல்லது மருத்துவமனை சந்திப்பை தினசரி கண்ணோட்டத்தில் தோன்றுமாறு சேமிக்கவும்.'],
    reports: ['அறிக்கைகள்', 'பதிவு செய்யப்பட்ட பயன்பாட்டைப் புரிந்துகொள்ளுங்கள்', 'MedLoop-ல் பதிவு செய்யப்பட்ட Taken மற்றும் Missed செயல்களின் சுருக்கத்தை அறிக்கைகள் காட்டுகின்றன.'],
    'emergency-card': ['அவசர அட்டை', 'பகிரும் முன் முக்கிய தகவலைச் சரிபார்க்கவும்', 'சுயவிவரம், ஒவ்வாமை, இரத்த வகை, தொடர்பு மற்றும் மருந்து தகவலை இந்த அட்டை ஒன்றாகக் காட்டுகிறது.'],
    settings: ['அமைப்புகள்', 'தனியுரிமை மற்றும் நினைவூட்டல்களைக் கட்டுப்படுத்தவும்', 'சுயவிவரம், சாதன நினைவூட்டல்கள், குடும்பச் செய்திகள், மறைகுறியாக்கப்பட்ட காப்புப்பிரதி மற்றும் கணக்குத் தரவை நிர்வகிக்கவும்.'],
    legal: ['தனியுரிமை மற்றும் பாதுகாப்பு', 'MedLoop என்ன செய்ய முடியும் என்பதை அறியுங்கள்', 'உள்ளூர் தரவு, நினைவூட்டல் வரம்புகள், மருத்துவ மறுப்பு மற்றும் கணக்கு நீக்கல் தகவலைப் படிக்கவும்.'],
  },
}

const knowledgeBase = {
  en: [
    { keywords: ['add medicine', 'new medicine', 'medicine'], answer: 'Open Medicines, copy the name and dosage from the label, choose only clinician-prescribed dose periods, set the times, and save.' },
    { keywords: ['taken', 'missed', 'dose'], answer: 'On Dashboard, use Taken only after the dose was taken. Use Missed when it was not taken. Reports reflect only what you record.' },
    { keywords: ['reminder', 'notification', 'sound'], answer: 'Open Settings, enable medicine reminders, allow Android notification access, and use the 10-second test. Timing can vary if exact alarms are disabled.' },
    { keywords: ['privacy', 'private', 'data', 'cloud'], answer: 'Health records and this help search remain on this device. Search questions are not stored. MedLoop does not send them to a cloud AI service.' },
    { keywords: ['backup', 'restore', 'export'], answer: 'Open Settings, enter a backup password of at least eight characters, then export an encrypted backup. Keep the password separately because it cannot be recovered.' },
    { keywords: ['family', 'sms', 'whatsapp', 'message'], answer: 'Family alerts create a message draft for you to review. MedLoop does not silently send SMS or WhatsApp messages.' },
    { keywords: ['appointment', 'doctor', 'clinic'], answer: 'Open Appointments, enter the doctor, confirmed date and optional clinic and time, then save.' },
    { keywords: ['emergency', 'urgent', 'symptoms'], answer: 'MedLoop is not an emergency service. For urgent symptoms or an emergency, contact local emergency services immediately.' },
  ],
  hi: [
    { keywords: ['दवा', 'नई दवा', 'medicine'], answer: 'दवाएँ भाग खोलें, लेबल से नाम और खुराक लिखें, केवल डॉक्टर द्वारा बताए समय चुनें और सहेजें।' },
    { keywords: ['खुराक', 'लिया', 'छूटा', 'dose'], answer: 'खुराक लेने के बाद ही Dashboard पर Taken चुनें। नहीं ली गई खुराक के लिए Missed चुनें। रिपोर्ट केवल दर्ज जानकारी दिखाती है।' },
    { keywords: ['रिमाइंडर', 'नोटिफिकेशन', 'आवाज़', 'reminder'], answer: 'सेटिंग्स में medicine reminders चालू करें, Android अनुमति दें और 10 सेकंड का टेस्ट चलाएँ।' },
    { keywords: ['गोपनीयता', 'डेटा', 'क्लाउड', 'privacy'], answer: 'स्वास्थ्य रिकॉर्ड और सहायता खोज इस डिवाइस पर रहते हैं। सवाल सहेजे या cloud AI को भेजे नहीं जाते।' },
    { keywords: ['बैकअप', 'रीस्टोर', 'backup'], answer: 'सेटिंग्स में कम से कम आठ अक्षर का पासवर्ड देकर encrypted backup export करें। पासवर्ड अलग सुरक्षित रखें।' },
    { keywords: ['परिवार', 'एसएमएस', 'व्हाट्सऐप', 'संदेश'], answer: 'परिवार अलर्ट केवल समीक्षा के लिए संदेश का draft बनाते हैं। MedLoop अपने-आप संदेश नहीं भेजता।' },
    { keywords: ['अपॉइंटमेंट', 'डॉक्टर', 'क्लिनिक'], answer: 'अपॉइंटमेंट भाग में डॉक्टर, पक्की तारीख और वैकल्पिक क्लिनिक व समय लिखकर सहेजें।' },
    { keywords: ['आपातकाल', 'तुरंत', 'लक्षण', 'emergency'], answer: 'MedLoop आपातकालीन सेवा नहीं है। तुरंत स्थानीय आपातकालीन सेवा से संपर्क करें।' },
  ],
  ta: [
    { keywords: ['மருந்து', 'புதிய மருந்து', 'medicine'], answer: 'மருந்துகள் பகுதியைத் திறந்து லேபிளிலிருந்து பெயர் மற்றும் அளவைப் பதிவு செய்து மருத்துவர் கூறிய நேரங்களை மட்டும் தேர்ந்தெடுத்து சேமிக்கவும்.' },
    { keywords: ['மருந்தளவு', 'எடுத்தேன்', 'தவறியது', 'dose'], answer: 'மருந்து எடுத்த பிறகு மட்டுமே Dashboard-ல் Taken என்பதைத் தேர்ந்தெடுக்கவும். எடுக்கவில்லை என்றால் Missed என்பதைத் தேர்ந்தெடுக்கவும்.' },
    { keywords: ['நினைவூட்டல்', 'அறிவிப்பு', 'ஒலி', 'reminder'], answer: 'அமைப்புகளில் medicine reminders-ஐ இயக்கி Android அறிவிப்பு அனுமதியை வழங்கி 10 விநாடி சோதனையை இயக்கவும்.' },
    { keywords: ['தனியுரிமை', 'தரவு', 'கிளவுட்', 'privacy'], answer: 'சுகாதாரப் பதிவுகளும் உதவி தேடலும் இந்தச் சாதனத்தில் இருக்கும். கேள்விகள் சேமிக்கப்படவோ cloud AI-க்கு அனுப்பப்படவோ மாட்டாது.' },
    { keywords: ['காப்புப்பிரதி', 'மீட்டமை', 'backup'], answer: 'அமைப்புகளில் குறைந்தது எட்டு எழுத்துகள் கொண்ட கடவுச்சொல்லுடன் மறைகுறியாக்கப்பட்ட காப்புப்பிரதியை ஏற்றுமதி செய்யவும்.' },
    { keywords: ['குடும்பம்', 'எஸ்எம்எஸ்', 'வாட்ஸ்அப்', 'செய்தி'], answer: 'குடும்ப எச்சரிக்கை நீங்கள் சரிபார்க்க ஒரு செய்தி வரைவை மட்டுமே உருவாக்கும். MedLoop தானாக செய்தி அனுப்பாது.' },
    { keywords: ['சந்திப்பு', 'மருத்துவர்', 'மருத்துவமனை'], answer: 'சந்திப்புகள் பகுதியில் மருத்துவர், உறுதிப்படுத்தப்பட்ட தேதி மற்றும் விருப்பமான இடம், நேரத்தை பதிவு செய்து சேமிக்கவும்.' },
    { keywords: ['அவசரம்', 'அறிகுறி', 'emergency'], answer: 'MedLoop அவசர சேவை அல்ல. உடனே உள்ளூர் அவசர சேவையைத் தொடர்புகொள்ளவும்.' },
  ],
}

export function getAssistantCopy(language = 'en') {
  return localizedCopy[language] || localizedCopy.en
}

export function localizeSectionGuide(pageId, guide, language = 'en') {
  const translated = sectionTranslations[language]?.[pageId]
  if (!translated) return guide
  return { ...guide, label: translated[0], title: translated[1], description: translated[2], tips: commonLocalizedTips[language] || guide.tips }
}

export function localizeRecommendation(recommendation, language = 'en') {
  const translated = recommendationTranslations[language]?.[recommendation.page]
  if (!translated) return recommendation
  return { ...recommendation, label: translated[0], reason: translated[1] }
}

export function searchApprovedHelp(query, language = 'en') {
  const normalized = String(query || '').trim().toLocaleLowerCase()
  if (!normalized) return null
  const entries = knowledgeBase[language] || knowledgeBase.en
  const scored = entries.map((entry) => ({
    entry,
    score: entry.keywords.reduce((total, keyword) => total + (normalized.includes(keyword.toLocaleLowerCase()) ? keyword.length : 0), 0),
  })).sort((a, b) => b.score - a.score)
  return scored[0]?.score > 0 ? scored[0].entry.answer : null
}

export function createVoiceGuideText(guide) {
  return [guide.title, guide.description, ...(guide.tips || [])].filter(Boolean).join('. ')
}

export function getAssistantFeedbackKey() {
  return 'medloop-assistant-feedback-v1'
}
