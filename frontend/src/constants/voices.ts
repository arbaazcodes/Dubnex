import { LibraryVoice } from '../types';

/**
 * Static Voice Library catalog for Dubnex (Coqui TTS XTTS v2).
 * apiVoiceKey is sent to FastAPI /process-video and resolved via local TTS provider.
 * previewUrl null => Preview control disabled ("Preview unavailable").
 */
export const voiceLibraryCatalog: LibraryVoice[] = [
  {
    id: 'coqui-default',
    name: 'Default (XTTS v2 Built-in)',
    provider: 'Coqui TTS',
    gender: 'Neutral',
    accent: 'Multilingual',
    language: 'en',
    category: 'Default',
    supportedLanguages: [
      'en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'tr',
      'ru', 'nl', 'cs', 'ar', 'zh', 'ja', 'hu', 'ko', 'hi'
    ],
    tags: ['multilingual', 'default', 'free', 'local'],
    previewUrl: null,
    apiVoiceKey: 'default',
    description: 'XTTS v2 built-in multilingual speaker. No voice cloning. Supports 17+ languages.',
    source: 'local',
  },
  {
    id: 'coqui-cloned',
    name: 'Custom Voice Clone',
    provider: 'Coqui TTS',
    gender: 'Custom',
    accent: 'Custom',
    language: 'en',
    category: 'Voice Cloning',
    supportedLanguages: [
      'en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'tr',
      'ru', 'nl', 'cs', 'ar', 'zh', 'ja', 'hu', 'ko', 'hi'
    ],
    tags: ['voice-cloning', 'custom', 'free', 'local'],
    previewUrl: null,
    apiVoiceKey: 'cloned',
    description: 'Upload a reference audio file (3-10 seconds) to clone any voice. Works across all 17+ supported languages.',
    source: 'local',
  },
];

export const VOICE_LIBRARY_STORAGE_KEY = 'dubnex_voice_library_prefs';

/** Resolve backend voice query key from Voice Library selection */
export function resolveApiVoiceKey(defaultVoiceId: string | null | undefined): string {
  const voice = voiceLibraryCatalog.find((v) => v.id === defaultVoiceId);
  if (voice?.apiVoiceKey) return voice.apiVoiceKey;
  if (voice?.name) return voice.name.toLowerCase();
  return 'default';
}

/**
 * Whether a voice can be previewed. Local Coqui voices have no static sample
 * URL but ARE previewable — the backend synthesizes a short sample on demand.
 */
export function voiceCanPreview(voice: LibraryVoice): boolean {
  return Boolean(voice.previewUrl) || voice.provider === 'Coqui TTS';
}

export function languageDisplayName(code: string): string {
  const map: Record<string, string> = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    hi: 'Hindi',
    pt: 'Portuguese',
    it: 'Italian',
    ja: 'Japanese',
    ko: 'Korean',
    zh: 'Chinese',
    ar: 'Arabic',
    nl: 'Dutch',
    pl: 'Polish',
    tr: 'Turkish',
    ru: 'Russian',
    cs: 'Czech',
    hu: 'Hungarian',
    ur: 'Urdu',
    ta: 'Tamil',
    te: 'Telugu',
    gu: 'Gujarati',
    pa: 'Punjabi',
  };
  return map[code] || code.toUpperCase();
}