// src/data.ts
import { Language, Project, VoiceSettings } from './types';

export const targetLanguages: Language[] = [
  { code: 'en', name: 'English', localName: 'English', flag: '🇺🇸' },
  { code: 'hi', name: 'Hindi', localName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ur', name: 'Urdu', localName: 'اردو', flag: '🇵🇰' },
  { code: 'ar', name: 'Arabic', localName: 'العربية', flag: '🇸🇦' },
  { code: 'es', name: 'Spanish', localName: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', localName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', localName: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', localName: 'Italiano', flag: '🇮🇹' },
  { code: 'ja', name: 'Japanese', localName: '日本語', flag: '🇯🇵' },
  { code: 'zh', name: 'Chinese', localName: '中文 (简体)', flag: '🇨🇳' },
  { code: 'ru', name: 'Russian', localName: 'Русский', flag: '🇷🇺' },
  { code: 'tr', name: 'Turkish', localName: 'Türkçe', flag: '🇹🇷' },
  { code: 'pt', name: 'Portuguese', localName: 'Português', flag: '🇵🇹' },
  { code: 'ko', name: 'Korean', localName: '한국어', flag: '🇰🇷' },
  { code: 'ta', name: 'Tamil', localName: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', name: 'Telugu', localName: 'తెలుగు', flag: '🇮🇳' },
  { code: 'gu', name: 'Gujarati', localName: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'pa', name: 'Punjabi', localName: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
  { code: 'ml', name: 'Malayalam', localName: 'മലയാളം', flag: '🇮🇳' }
];

export const voicePresets: { id: string; name: string; settings: VoiceSettings; engine: string }[] = [
  {
    id: 'f-cosy-serena',
    name: 'Serena (Female - Crisp)',
    engine: 'CosyVoice',
    settings: { gender: 'Female', speed: 1.0, pitch: 1.05, emotion: 'Professional', energy: 1.1, pauseControl: 0.25, voiceName: 'Serena' }
  },
  {
    id: 'm-cosy-rachel',
    name: 'Rachel (Female - Emotional)',
    engine: 'XTTS v2',
    settings: { gender: 'Female', speed: 0.95, pitch: 0.98, emotion: 'Happy', energy: 1.2, pauseControl: 0.3, voiceName: 'Rachel' }
  },
  {
    id: 'm-cosy-adam',
    name: 'Adam (Male - Narrative)',
    engine: 'CosyVoice',
    settings: { gender: 'Male', speed: 1.0, pitch: 0.95, emotion: 'Professional', energy: 1.0, pauseControl: 0.4, voiceName: 'Adam' }
  },
  {
    id: 'm-xtts-george',
    name: 'George (Male - Warm)',
    engine: 'XTTS v2',
    settings: { gender: 'Male', speed: 1.05, pitch: 0.88, emotion: 'Professional', energy: 1.0, pauseControl: 0.2, voiceName: 'George' }
  },
  {
    id: 'm-f5-marcus',
    name: 'Marcus (Neutral - Fast)',
    engine: 'F5-TTS',
    settings: { gender: 'Neutral', speed: 1.1, pitch: 1.0, emotion: 'Neutral', energy: 1.0, pauseControl: 0.15, voiceName: 'Marcus' }
  },
  {
    id: 'e-labs-bella',
    name: 'Bella (Female - Premium Direct)',
    engine: 'ElevenLabs',
    settings: { gender: 'Female', speed: 1.0, pitch: 1.0, emotion: 'Exciting', energy: 1.3, pauseControl: 0.2, voiceName: 'Bella' }
  }
];

export const seedProjects: Project[] = [
  {
    id: 'proj-demo-1',
    title: 'AI Dev Summit 2026 Keynote Opening',
    originalLanguage: 'en',
    targetLanguage: 'es',
    status: 'Completed',
    progress: 100,
    size: '18.4 MB',
    duration: '01:12',
    createdAt: '2026-07-14 14:32',
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    dubbedUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    voiceSettings: {
      gender: 'Female',
      speed: 1.0,
      pitch: 1.02,
      emotion: 'Professional',
      energy: 1.1,
      pauseControl: 0.25,
      voiceName: 'Serena'
    },
    transcript: [
      {
        id: 't1-1',
        start: 0.0,
        end: 6.5,
        text: 'Welcome back to the Google AI Studio Keynote! Today we are introducing groundbreaking context models.',
        translatedText: '¡Bienvenidos de nuevo al Google AI Studio Keynote! Hoy presentamos modelos de contexto innovadores.',
        speaker: 'Speaker A'
      },
      {
        id: 't1-2',
        start: 6.5,
        end: 14.2,
        text: 'These deep learning systems can process screen coordinates, visual frames, and natural language synchronously in real time.',
        translatedText: 'Estos sistemas de aprendizaje profundo pueden procesar coordenadas de pantalla, fotogramas visuales y lenguaje natural de forma sincrónica en tiempo real.',
        speaker: 'Speaker A'
      },
      {
        id: 't1-3',
        start: 14.5,
        end: 22.0,
        text: 'And our core processing pipeline ensures developer apps operate with under one hundred and fifty milliseconds of total latency.',
        translatedText: 'Y nuestra línea de procesamiento central garantiza que las aplicaciones de desarrollo funcionen con menos de ciento cincuenta milisegundos de latencia total.',
        speaker: 'Speaker A'
      }
    ],
    logs: [
      { id: 'l1', timestamp: '2026-07-14 14:32:01', level: 'info', message: 'Video upload completed successfully.', step: 'Upload Video' },
      { id: 'l2', timestamp: '2026-07-14 14:32:05', level: 'info', message: 'Extracted raw stereo audio sample at 44.1kHz with FFmpeg.', step: 'Extracting Audio' },
      { id: 'l3', timestamp: '2026-07-14 14:32:15', level: 'info', message: 'Faster Whisper recognition finished. Found 3 segments.', step: 'Speech Recognition' },
      { id: 'l4', timestamp: '2026-07-14 14:32:20', level: 'info', message: 'Meta NLLB-200 translated transcript segments from en to es.', step: 'Translation' },
      { id: 'l5', timestamp: '2026-07-14 14:32:32', level: 'info', message: 'CosyVoice voice generation completed with custom professional voice template.', step: 'Voice Generation' },
      { id: 'l6', timestamp: '2026-07-14 14:32:38', level: 'info', message: 'Audio timings synchronized and merged back into original video frames.', step: 'Merging Video' }
    ]
  },
  {
    id: 'proj-demo-2',
    title: 'Machine Learning Basics Tutorial',
    originalLanguage: 'en',
    targetLanguage: 'hi',
    status: 'Completed',
    progress: 100,
    size: '34.1 MB',
    duration: '00:48',
    createdAt: '2026-07-15 01:05',
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    dubbedUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    voiceSettings: {
      gender: 'Male',
      speed: 0.95,
      pitch: 0.94,
      emotion: 'Professional',
      energy: 1.0,
      pauseControl: 0.35,
      voiceName: 'Adam'
    },
    transcript: [
      {
        id: 't2-1',
        start: 0.0,
        end: 5.0,
        text: 'In this short video tutorial, we are going to explore gradient descent optimization.',
        translatedText: 'इस संक्षिप्त वीडियो ट्यूटोरियल में, हम ग्रेडिएंट डिसेंट ऑप्टिमाइज़ेशन का पता लगाने जा रहे हैं।',
        speaker: 'Teacher Male'
      },
      {
        id: 't2-2',
        start: 5.0,
        end: 11.5,
        text: 'We initialize a random parameter vector and calculate the slopes direction repeatedly to minimize our loss function.',
        translatedText: 'हम एक यादृच्छिक पैरामीटर वेक्टर को इनिशियलाइज़ करते हैं और अपने लॉस फ़ंक्शन को कम करने के लिए बार-बार ढलान की दिशा की गणना करते हैं।',
        speaker: 'Teacher Male'
      }
    ],
    logs: [
      { id: 'l2-1', timestamp: '2026-07-15 01:05:00', level: 'info', message: 'Audio extraction finished.', step: 'Extracting Audio' },
      { id: 'l2-2', timestamp: '2026-07-15 01:05:10', level: 'info', message: 'Whisper transcripion compiled with 99.4% confidence score.', step: 'Speech Recognition' },
      { id: 'l2-3', timestamp: '2026-07-15 01:05:14', level: 'info', message: 'NLLB translation to Hindi completed.', step: 'Translation' },
      { id: 'l2-4', timestamp: '2026-07-15 01:05:22', level: 'info', message: 'XTTS v2 cloned male voice generated successfully.', step: 'Voice Generation' }
    ]
  },
  {
    id: 'proj-demo-3',
    title: 'Financial Market Analysis Report',
    originalLanguage: 'en',
    targetLanguage: 'ar',
    status: 'Translating',
    progress: 45,
    size: '12.8 MB',
    duration: '00:32',
    createdAt: '2026-07-15 03:02',
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    voiceSettings: {
      gender: 'Male',
      speed: 1.0,
      pitch: 0.95,
      emotion: 'Professional',
      energy: 1.0,
      pauseControl: 0.3,
      voiceName: 'George'
    },
    transcript: [
      {
        id: 't3-1',
        start: 0.0,
        end: 4.8,
        text: 'The Federal Reserve recently announced changes to interest rates that are impacting the global bonds market.',
        translatedText: 'أعلن الاحتياطي الفيدرالي مؤخراً عن تغييرات في أسعار الفائدة تؤثر على سوق السندات العالمية.',
        speaker: 'Analyst'
      }
    ],
    logs: [
      { id: 'l3-1', timestamp: '2026-07-15 03:02:11', level: 'info', message: 'Video received. File format: MP4', step: 'Upload Video' },
      { id: 'l3-2', timestamp: '2026-07-15 03:02:14', level: 'info', message: 'Audio channels separated.', step: 'Extracting Audio' },
      { id: 'l3-3', timestamp: '2026-07-15 03:02:22', level: 'info', message: 'Whisper identified source language as English.', step: 'Speech Recognition' },
      { id: 'l3-4', timestamp: '2026-07-15 03:02:25', level: 'info', message: 'Initiated translation job using Meta NLLB-200. Translating 1 segment...', step: 'Translation' }
    ]
  }
];
