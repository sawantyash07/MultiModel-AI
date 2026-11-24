/**
 * Central Language Registry for English and all 22 Scheduled Languages
 * of the Eighth Schedule of the Indian Constitution (23 languages total).
 *
 * Each language entry provides canonical code, English display name,
 * native script label, script family, verified TTS models, verified hosting providers,
 * native voice options with gender and style, support status ("production" vs "preview"),
 * streaming capabilities, and verified fallbacks.
 */

export const SCHEDULED_LANGUAGES = [
  {
    code: 'en',
    name: 'English',
    nativeLabel: 'English',
    script: 'Latin',
    ttsModel: 'sarvam/bulbul:v4-flash',
    ttsProvider: 'Sarvam AI Bulbul / Google Hosted',
    speaker: 'shubh',
    status: 'production',
    nativeLlmSupported: true,
    streamingSupported: true,
    fallbackProvider: 'Google Hosted Multilingual Speech Engine',
    description: 'Clear English voice with articulate phrasing, balanced cadence, and natural Indian accent options.',
    voices: [
      { id: 'shubh', name: 'Shubh', gender: 'Male', style: 'Confident Indian English', isDefault: true, provider: 'sarvam' },
      { id: 'aditya', name: 'Aditya', gender: 'Male', style: 'Modern & Crisp', isDefault: false, provider: 'sarvam' },
      { id: 'amelia', name: 'Amelia', gender: 'Female', style: 'Clear Global English', isDefault: false, provider: 'sarvam' },
      { id: 'natural', name: 'Natural', gender: 'Female', style: 'Neutral & Balanced', isDefault: false, provider: 'google-hosted' }
    ]
  },
  {
    code: 'as',
    name: 'Assamese',
    nativeLabel: 'অসমীয়া',
    script: 'Bengali-Assamese',
    ttsModel: 'bodhan-ai/indic-speak',
    ttsProvider: 'Bodhan Indic Speech Engine',
    speaker: 'aditi',
    status: 'preview',
    nativeLlmSupported: true,
    streamingSupported: false,
    fallbackProvider: 'None',
    description: 'Assamese eastern Indic phonetics. Native LLM text generation is fully supported; voice synthesis requires Bodhan or Bhashini enterprise credentials.',
    voices: [
      { id: 'aditi', name: 'Aditi', gender: 'Female', style: 'Eastern Indic Diction', isDefault: true, provider: 'bodhan' },
      { id: 'amit', name: 'Amit', gender: 'Male', style: 'Narrative', isDefault: false, provider: 'bodhan' }
    ]
  },
  {
    code: 'bn',
    name: 'Bengali',
    nativeLabel: 'বাংলা',
    script: 'Bengali',
    ttsModel: 'sarvam/bulbul:v4-flash',
    ttsProvider: 'Sarvam AI Bulbul / Google Hosted',
    speaker: 'aditi',
    status: 'production',
    nativeLlmSupported: true,
    streamingSupported: true,
    fallbackProvider: 'Google Hosted Multilingual Speech Engine',
    description: 'Melodious Bengali voice with accurate vowel harmony, natural rhythm, and high acoustic clarity.',
    voices: [
      { id: 'aditi', name: 'Aditi', gender: 'Female', style: 'Melodious & Clear', isDefault: true, provider: 'sarvam' },
      { id: 'shubh', name: 'Shubh', gender: 'Male', style: 'Confident & Bold', isDefault: false, provider: 'sarvam' },
      { id: 'ritu', name: 'Ritu', gender: 'Female', style: 'Calm & Natural', isDefault: false, provider: 'sarvam' }
    ]
  },
  {
    code: 'brx',
    name: 'Bodo',
    nativeLabel: 'बड़ो',
    script: 'Devanagari',
    ttsModel: 'bodhan-ai/indic-speak',
    ttsProvider: 'Bodhan Indic Speech Engine',
    speaker: 'rohit',
    status: 'preview',
    nativeLlmSupported: true,
    streamingSupported: false,
    fallbackProvider: 'None',
    description: 'Bodo language voice. Native LLM generation in Devanagari is supported; voice synthesis requires Bodhan or Bhashini credentials.',
    voices: [
      { id: 'rohit', name: 'Rohit', gender: 'Male', style: 'Devanagari Phonology', isDefault: true, provider: 'bodhan' }
    ]
  },
  {
    code: 'doi',
    name: 'Dogri',
    nativeLabel: 'डोगरी',
    script: 'Devanagari',
    ttsModel: 'bodhan-ai/indic-speak',
    ttsProvider: 'Bodhan Indic Speech Engine',
    speaker: 'rohit',
    status: 'preview',
    nativeLlmSupported: true,
    streamingSupported: false,
    fallbackProvider: 'None',
    description: 'Dogri northern voice. Native LLM text generation is supported; voice synthesis requires Bodhan enterprise credentials.',
    voices: [
      { id: 'rohit', name: 'Rohit', gender: 'Male', style: 'Northern Tonal Diction', isDefault: true, provider: 'bodhan' }
    ]
  },
  {
    code: 'gu',
    name: 'Gujarati',
    nativeLabel: 'ગુજરાતી',
    script: 'Gujarati',
    ttsModel: 'sarvam/bulbul:v4-flash',
    ttsProvider: 'Sarvam AI Bulbul / Google Hosted',
    speaker: 'shubh',
    status: 'production',
    nativeLlmSupported: true,
    streamingSupported: true,
    fallbackProvider: 'Google Hosted Multilingual Speech Engine',
    description: 'Expressive Gujarati voice with authentic regional articulation and natural cadence.',
    voices: [
      { id: 'shubh', name: 'Shubh', gender: 'Male', style: 'Confident & Fluent', isDefault: true, provider: 'sarvam' },
      { id: 'jaya', name: 'Jaya', gender: 'Female', style: 'Expressive & Clear', isDefault: false, provider: 'google-hosted' },
      { id: 'ritu', name: 'Ritu', gender: 'Female', style: 'Calm & Natural', isDefault: false, provider: 'sarvam' }
    ]
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeLabel: 'हिन्दी',
    script: 'Devanagari',
    ttsModel: 'sarvam/bulbul:v4-flash',
    ttsProvider: 'Sarvam AI Bulbul / Google Hosted',
    speaker: 'shubh',
    status: 'production',
    nativeLlmSupported: true,
    streamingSupported: true,
    fallbackProvider: 'Google Hosted Multilingual Speech Engine',
    description: 'Natural Hindi voice with accurate Devanagari pronunciation, authentic numbers, and code-mixing support.',
    voices: [
      { id: 'shubh', name: 'Shubh', gender: 'Male', style: 'Confident & Bold', isDefault: true, provider: 'sarvam' },
      { id: 'ritu', name: 'Ritu', gender: 'Female', style: 'Calm & Natural', isDefault: false, provider: 'sarvam' },
      { id: 'aditya', name: 'Aditya', gender: 'Male', style: 'Modern & Crisp', isDefault: false, provider: 'sarvam' },
      { id: 'priya', name: 'Priya', gender: 'Female', style: 'Clear & Articulate', isDefault: false, provider: 'sarvam' },
      { id: 'rohit', name: 'Rohit', gender: 'Male', style: 'Narrative Tone', isDefault: false, provider: 'google-hosted' },
      { id: 'sunita', name: 'Sunita', gender: 'Female', style: 'Calm Narration', isDefault: false, provider: 'google-hosted' }
    ]
  },
  {
    code: 'kn',
    name: 'Kannada',
    nativeLabel: 'ಕನ್ನಡ',
    script: 'Kannada',
    ttsModel: 'sarvam/bulbul:v4-flash',
    ttsProvider: 'Sarvam AI Bulbul / Google Hosted',
    speaker: 'shubh',
    status: 'production',
    nativeLlmSupported: true,
    streamingSupported: true,
    fallbackProvider: 'Google Hosted Multilingual Speech Engine',
    description: 'Fluid Kannada voice with classical southern phonology and high acoustic clarity.',
    voices: [
      { id: 'shubh', name: 'Shubh', gender: 'Male', style: 'Confident Southern Diction', isDefault: true, provider: 'sarvam' },
      { id: 'suresh', name: 'Suresh', gender: 'Male', style: 'Calm Classical Narration', isDefault: false, provider: 'google-hosted' },
      { id: 'ritu', name: 'Ritu', gender: 'Female', style: 'Clear & Expressive', isDefault: false, provider: 'sarvam' }
    ]
  },
  {
    code: 'ks',
    name: 'Kashmiri',
    nativeLabel: 'کٲشُر / कॉशुर',
    script: 'Perso-Arabic / Devanagari',
    ttsModel: 'bodhan-ai/indic-speak',
    ttsProvider: 'Bodhan Indic Speech Engine',
    speaker: 'rohit',
    status: 'preview',
    nativeLlmSupported: true,
    streamingSupported: false,
    fallbackProvider: 'None',
    description: 'Kashmiri voice. Native LLM text generation is supported; voice synthesis requires Bodhan enterprise credentials.',
    voices: [
      { id: 'rohit', name: 'Rohit', gender: 'Male', style: 'Perso-Arabic Diction', isDefault: true, provider: 'bodhan' }
    ]
  },
  {
    code: 'kok',
    name: 'Konkani',
    nativeLabel: 'कोंकणी',
    script: 'Devanagari',
    ttsModel: 'bodhan-ai/indic-speak',
    ttsProvider: 'Bodhan Indic Speech Engine',
    speaker: 'sunita',
    status: 'preview',
    nativeLlmSupported: true,
    streamingSupported: false,
    fallbackProvider: 'None',
    description: 'Coastal Konkani voice. Native LLM generation in Devanagari supported; voice output requires Bodhan enterprise credentials.',
    voices: [
      { id: 'sunita', name: 'Sunita', gender: 'Female', style: 'Coastal Konkan Cadence', isDefault: true, provider: 'bodhan' }
    ]
  },
  {
    code: 'mai',
    name: 'Maithili',
    nativeLabel: 'मैथिली',
    script: 'Devanagari',
    ttsModel: 'bodhan-ai/indic-speak',
    ttsProvider: 'Bodhan Indic Speech Engine',
    speaker: 'rohit',
    status: 'preview',
    nativeLlmSupported: true,
    streamingSupported: false,
    fallbackProvider: 'None',
    description: 'Maithili voice. Native LLM generation supported; voice synthesis requires Bodhan enterprise credentials.',
    voices: [
      { id: 'rohit', name: 'Rohit', gender: 'Male', style: 'Mithila Linguistic Features', isDefault: true, provider: 'bodhan' }
    ]
  },
  {
    code: 'ml',
    name: 'Malayalam',
    nativeLabel: 'മലയാളം',
    script: 'Malayalam',
    ttsModel: 'sarvam/bulbul:v4-flash',
    ttsProvider: 'Sarvam AI Bulbul / Google Hosted',
    speaker: 'shubh',
    status: 'production',
    nativeLlmSupported: true,
    streamingSupported: true,
    fallbackProvider: 'Google Hosted Multilingual Speech Engine',
    description: 'Precise Malayalam voice with natural retroflex consonants, fluid rhythm, and clear pace.',
    voices: [
      { id: 'shubh', name: 'Shubh', gender: 'Male', style: 'Precise & Articulate', isDefault: true, provider: 'sarvam' },
      { id: 'anjali', name: 'Anjali', gender: 'Female', style: 'Animated & Crisp', isDefault: false, provider: 'google-hosted' },
      { id: 'priya', name: 'Priya', gender: 'Female', style: 'Calm Delivery', isDefault: false, provider: 'sarvam' }
    ]
  },
  {
    code: 'mni',
    name: 'Manipuri (Meitei)',
    nativeLabel: 'মৈতৈলোন্ / মেইতেইলোন্',
    script: 'Meitei Mayek / Bengali',
    ttsModel: 'bodhan-ai/indic-speak',
    ttsProvider: 'Bodhan Indic Speech Engine',
    speaker: 'aditi',
    status: 'preview',
    nativeLlmSupported: true,
    streamingSupported: false,
    fallbackProvider: 'None',
    description: 'Manipuri (Meitei) voice. Native LLM text generation supported; voice output requires Bodhan enterprise credentials.',
    voices: [
      { id: 'aditi', name: 'Aditi', gender: 'Female', style: 'Authentic Meitei Diction', isDefault: true, provider: 'bodhan' }
    ]
  },
  {
    code: 'mr',
    name: 'Marathi',
    nativeLabel: 'मराठी',
    script: 'Devanagari',
    ttsModel: 'sarvam/bulbul:v4-flash',
    ttsProvider: 'Sarvam AI Bulbul / Google Hosted',
    speaker: 'sunita',
    status: 'production',
    nativeLlmSupported: true,
    streamingSupported: true,
    fallbackProvider: 'Google Hosted Multilingual Speech Engine',
    description: 'Authentic Marathi voice with rich regional vocabulary, balanced cadence, and precise Devanagari pronunciation.',
    voices: [
      { id: 'sunita', name: 'Sunita', gender: 'Female', style: 'Authentic Marathi Narration', isDefault: true, provider: 'google-hosted' },
      { id: 'shubh', name: 'Shubh', gender: 'Male', style: 'Confident & Articulate', isDefault: false, provider: 'sarvam' },
      { id: 'ritu', name: 'Ritu', gender: 'Female', style: 'Calm & Natural', isDefault: false, provider: 'sarvam' },
      { id: 'rohit', name: 'Rohit', gender: 'Male', style: 'Narrative Tone', isDefault: false, provider: 'google-hosted' }
    ]
  },
  {
    code: 'ne',
    name: 'Nepali',
    nativeLabel: 'नेपाली',
    script: 'Devanagari',
    ttsModel: 'google/multilingual-tts',
    ttsProvider: 'Google Hosted Multilingual Speech Engine',
    speaker: 'sunita',
    status: 'production',
    nativeLlmSupported: true,
    streamingSupported: true,
    fallbackProvider: 'Google Hosted Multilingual Speech Engine',
    description: 'Natural Nepali voice with crisp Himalayan diction and natural cadence.',
    voices: [
      { id: 'sunita', name: 'Sunita', gender: 'Female', style: 'Crisp Himalayan Diction', isDefault: true, provider: 'google-hosted' },
      { id: 'rohit', name: 'Rohit', gender: 'Male', style: 'Narrative Tone', isDefault: false, provider: 'bodhan' }
    ]
  },
  {
    code: 'or',
    name: 'Odia',
    nativeLabel: 'ଓଡ଼ିଆ',
    script: 'Odia',
    ttsModel: 'sarvam/bulbul:v4-flash',
    ttsProvider: 'Sarvam AI Bulbul / Bodhan',
    speaker: 'aditi',
    status: 'production',
    nativeLlmSupported: true,
    streamingSupported: true,
    fallbackProvider: 'Sarvam AI Bulbul',
    description: 'Expressive Odia voice with authentic eastern phonetics, rounded vowels, and natural prosody.',
    voices: [
      { id: 'aditi', name: 'Aditi', gender: 'Female', style: 'Expressive & Melodious', isDefault: true, provider: 'sarvam' },
      { id: 'shubh', name: 'Shubh', gender: 'Male', style: 'Confident', isDefault: false, provider: 'sarvam' }
    ]
  },
  {
    code: 'pa',
    name: 'Punjabi',
    nativeLabel: 'ਪੰਜਾਬੀ',
    script: 'Gurmukhi',
    ttsModel: 'sarvam/bulbul:v4-flash',
    ttsProvider: 'Sarvam AI Bulbul / Google Hosted',
    speaker: 'shubh',
    status: 'production',
    nativeLlmSupported: true,
    streamingSupported: true,
    fallbackProvider: 'Google Hosted Multilingual Speech Engine',
    description: 'Energetic Punjabi voice with authentic Gurmukhi pronunciation and tonal inflection.',
    voices: [
      { id: 'shubh', name: 'Shubh', gender: 'Male', style: 'Energetic & Confident', isDefault: true, provider: 'sarvam' },
      { id: 'rohit', name: 'Rohit', gender: 'Male', style: 'Authentic Gurmukhi Tone', isDefault: false, provider: 'google-hosted' },
      { id: 'simran', name: 'Simran', gender: 'Female', style: 'Melodious', isDefault: false, provider: 'sarvam' }
    ]
  },
  {
    code: 'sa',
    name: 'Sanskrit',
    nativeLabel: 'संस्कृतम्',
    script: 'Devanagari',
    ttsModel: 'bodhan-ai/indic-speak',
    ttsProvider: 'Bodhan Indic Speech Engine',
    speaker: 'sunita',
    status: 'preview',
    nativeLlmSupported: true,
    streamingSupported: false,
    fallbackProvider: 'None',
    description: 'Classical Sanskrit voice adhering to Paninian phonetics. Native LLM text generation supported; voice synthesis requires Bodhan credentials.',
    voices: [
      { id: 'sunita', name: 'Sunita', gender: 'Female', style: 'Classical Vedic Phrasing', isDefault: true, provider: 'bodhan' },
      { id: 'suresh', name: 'Suresh', gender: 'Male', style: 'Paninian Recitation', isDefault: false, provider: 'bodhan' }
    ]
  },
  {
    code: 'sat',
    name: 'Santali',
    nativeLabel: 'ᱥᱟᱱᱛᱟᱲᱤ',
    script: 'Ol Chiki',
    ttsModel: 'bodhan-ai/indic-speak',
    ttsProvider: 'Bodhan Indic Speech Engine',
    speaker: 'aditi',
    status: 'preview',
    nativeLlmSupported: true,
    streamingSupported: false,
    fallbackProvider: 'None',
    description: 'Santali indigenous voice supporting the Ol Chiki writing system. Native LLM generation supported; voice requires Bodhan credentials.',
    voices: [
      { id: 'aditi', name: 'Aditi', gender: 'Female', style: 'Ol Chiki Articulation', isDefault: true, provider: 'bodhan' }
    ]
  },
  {
    code: 'sd',
    name: 'Sindhi',
    nativeLabel: 'سنڌي / सिन्धी',
    script: 'Perso-Arabic / Devanagari',
    ttsModel: 'bodhan-ai/indic-speak',
    ttsProvider: 'Bodhan Indic Speech Engine',
    speaker: 'sunita',
    status: 'preview',
    nativeLlmSupported: true,
    streamingSupported: false,
    fallbackProvider: 'None',
    description: 'Sindhi voice with dual Perso-Arabic and Devanagari support. Native LLM generation supported; voice requires Bodhan credentials.',
    voices: [
      { id: 'sunita', name: 'Sunita', gender: 'Female', style: 'Sindhi Phonology', isDefault: true, provider: 'bodhan' }
    ]
  },
  {
    code: 'ta',
    name: 'Tamil',
    nativeLabel: 'தமிழ்',
    script: 'Tamil',
    ttsModel: 'sarvam/bulbul:v4-flash',
    ttsProvider: 'Sarvam AI Bulbul / Google Hosted',
    speaker: 'shubh',
    status: 'production',
    nativeLlmSupported: true,
    streamingSupported: true,
    fallbackProvider: 'Google Hosted Multilingual Speech Engine',
    description: 'Classical Tamil voice with authentic Dravidian rhythm, natural vowel quantity, and precise articulation.',
    voices: [
      { id: 'shubh', name: 'Shubh', gender: 'Male', style: 'Crisp & Articulate', isDefault: true, provider: 'sarvam' },
      { id: 'jaya', name: 'Jaya', gender: 'Female', style: 'Classical Dravidian Rhythm', isDefault: false, provider: 'google-hosted' },
      { id: 'priya', name: 'Priya', gender: 'Female', style: 'Natural & Expressive', isDefault: false, provider: 'sarvam' }
    ]
  },
  {
    code: 'te',
    name: 'Telugu',
    nativeLabel: 'తెలుగు',
    script: 'Telugu',
    ttsModel: 'sarvam/bulbul:v4-flash',
    ttsProvider: 'Sarvam AI Bulbul / Google Hosted',
    speaker: 'shubh',
    status: 'production',
    nativeLlmSupported: true,
    streamingSupported: true,
    fallbackProvider: 'Google Hosted Multilingual Speech Engine',
    description: 'Lyrical Telugu voice with natural vowel endings, fluid cadence, and crisp pronunciation.',
    voices: [
      { id: 'shubh', name: 'Shubh', gender: 'Male', style: 'Confident & Lyrical', isDefault: true, provider: 'sarvam' },
      { id: 'prakash', name: 'Prakash', gender: 'Male', style: 'Classical Melodic Flow', isDefault: false, provider: 'google-hosted' },
      { id: 'priya', name: 'Priya', gender: 'Female', style: 'Clear & Expressive', isDefault: false, provider: 'sarvam' }
    ]
  },
  {
    code: 'ur',
    name: 'Urdu',
    nativeLabel: 'اردو',
    script: 'Perso-Arabic (Nastaliq)',
    ttsModel: 'google/multilingual-tts',
    ttsProvider: 'Google Hosted Multilingual Speech Engine',
    speaker: 'rohit',
    status: 'production',
    nativeLlmSupported: true,
    streamingSupported: true,
    fallbackProvider: 'Google Hosted Multilingual Speech Engine',
    description: 'Polished Urdu voice with classical Nastaliq inflection, elegant diction, and zero-downtime serving.',
    voices: [
      { id: 'rohit', name: 'Rohit', gender: 'Male', style: 'Nastaliq Diction', isDefault: true, provider: 'google-hosted' },
      { id: 'rehan', name: 'Rehan', gender: 'Male', style: 'Polished & Formal', isDefault: false, provider: 'bodhan' }
    ]
  }
];

export const TTS_LANGUAGES = SCHEDULED_LANGUAGES.map(lang => ({
  code: lang.code,
  label: lang.name,
  nativeLabel: lang.nativeLabel,
  speaker: lang.speaker,
  script: lang.script,
  status: lang.status,
  voices: lang.voices || []
}));

export function findLanguageByCode(code) {
  if (!code) return SCHEDULED_LANGUAGES[0];
  const lower = String(code).trim().toLowerCase();
  return SCHEDULED_LANGUAGES.find(l => l.code === lower) || SCHEDULED_LANGUAGES[0];
}

export function searchLanguages(query) {
  if (!query || !query.trim()) return SCHEDULED_LANGUAGES;
  const q = query.trim().toLowerCase();
  return SCHEDULED_LANGUAGES.filter(l =>
    l.name.toLowerCase().includes(q) ||
    l.nativeLabel.toLowerCase().includes(q) ||
    l.code.toLowerCase().includes(q) ||
    l.script.toLowerCase().includes(q)
  );
}

export function getVoicesForLanguage(langCode) {
  const lang = findLanguageByCode(langCode);
  return lang?.voices && lang.voices.length > 0 ? lang.voices : [
    { id: 'default', name: 'Default', gender: 'Neutral', style: 'Standard', isDefault: true }
  ];
}

export function isProductionLanguage(langCode) {
  const lang = findLanguageByCode(langCode);
  return lang?.status === 'production';
}

const SCRIPT_REGEXES = {
  gu: /[\u0A80-\u0AFF]/, // Gujarati
  hi: /[\u0900-\u097F]/, // Devanagari
  mr: /[\u0900-\u097F]/, // Devanagari
  bn: /[\u0980-\u09FF]/, // Bengali
  ta: /[\u0B80-\u0BFF]/, // Tamil
  te: /[\u0C00-\u0C7F]/, // Telugu
  kn: /[\u0C80-\u0CFF]/, // Kannada
  ml: /[\u0D00-\u0D7F]/, // Malayalam
  pa: /[\u0A00-\u0A7F]/, // Gurmukhi
  or: /[\u0B00-\u0B7F]/, // Oriya
  ur: /[\u0600-\u06FF]/, // Arabic/Nastaliq
  ne: /[\u0900-\u097F]/, // Devanagari
  sa: /[\u0900-\u097F]/, // Devanagari
  as: /[\u0980-\u09FF]/, // Assamese
  ks: /[\u0600-\u06FF\u0900-\u097F]/,
  sd: /[\u0600-\u06FF\u0900-\u097F]/,
  kok: /[\u0900-\u097F]/,
  mai: /[\u0900-\u097F]/,
  doi: /[\u0900-\u097F]/,
  brx: /[\u0900-\u097F]/,
  mni: /[\uABC0-\uABFF\u0980-\u09FF]/,
  sat: /[\u1C50-\u1C7F\u0900-\u097F]/
};

export function isMatchingScript(text, targetLang) {
  if (!text || !text.trim()) return false;
  const lang = String(targetLang).trim().toLowerCase();
  if (lang === 'en') return true;
  const regex = SCRIPT_REGEXES[lang];
  return regex ? regex.test(text) : true;
}

export function detectLanguageFromText(text) {
  if (!text || typeof text !== 'string' || !text.trim()) return null;
  if (/[\u0A80-\u0AFF]/.test(text)) return 'gu'; // Gujarati
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta'; // Tamil
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te'; // Telugu
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn'; // Kannada
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml'; // Malayalam
  if (/[\u0A00-\u0A7F]/.test(text)) return 'pa'; // Punjabi (Gurmukhi)
  if (/[\u0B00-\u0B7F]/.test(text)) return 'or'; // Odia
  if (/[\u0980-\u09FF]/.test(text)) return 'bn'; // Bengali / Assamese
  if (/[\u0600-\u06FF]/.test(text)) return 'ur'; // Urdu / Kashmiri
  return null;
}
