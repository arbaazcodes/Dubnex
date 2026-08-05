// src/types.ts

export type ProjectStatus = string;

export type TTSVoiceEngine =
  | 'CosyVoice'
  | 'XTTS v2'
  | 'F5-TTS'
  | 'OpenVoice v2'
  | 'ElevenLabs';

export interface VoiceSettings {
  gender: 'Male' | 'Female' | 'Neutral';
  speed: number;       // e.g. 1.0 (0.5 to 2.0)
  pitch: number;       // e.g. 1.0 (0.5 to 2.0)
  emotion: 'Neutral' | 'Happy' | 'Sad' | 'Exciting' | 'Professional' | 'Whisper';
  energy: number;      // e.g. 1.0 (0.5 to 1.5)
  pauseControl: number; // e.g. 0.3 (seconds)
  voiceName: string;
}

/** Voice Library catalog entry (UI + future clone/custom) */
export type VoiceProvider = 'ElevenLabs' | 'Custom' | 'Clone';
export type VoiceSource = 'library' | 'custom' | 'clone';

export type VoiceCategory =
  | 'Narration'
  | 'Conversational'
  | 'Broadcast'
  | 'Cinematic'
  | 'Corporate'
  | 'Audiobook'
  | 'Social'
  | 'Multilingual';

export interface LibraryVoice {
  id: string;
  name: string;
  provider: VoiceProvider;
  gender: 'Male' | 'Female' | 'Neutral';
  accent: string;
  /** Primary display language code (ISO), usually first supported language */
  language: string;
  supportedLanguages: string[];
  /** High-level use-case category for the selector UI */
  category: VoiceCategory;
  tags: string[];
  /** Optional sample URL when a preview endpoint exists */
  previewUrl?: string | null;
  /** Maps to backend voice key when wired later (e.g. george) — unused by TTS until wired */
  apiVoiceKey?: string;
  description?: string;
  /** Future: user-uploaded / cloned voices */
  source: VoiceSource;
  isCustom?: boolean;
  isClone?: boolean;
  cloneStatus?: 'none' | 'pending' | 'ready' | 'failed';
  createdAt?: string;
}

export interface VoiceLibraryState {
  favoriteIds: string[];
  defaultVoiceId: string | null;
}

export interface TranscriptSegment {
  id: string;
  start: number; // seconds
  end: number;   // seconds
  text: string;
  translatedText: string;
  speaker?: string;
  /** True when the user changed translated text from the pipeline output */
  isEdited?: boolean;
  /** Baseline translation used for Revert */
  baselineTranslatedText?: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  step?: string;
}

/** Future: a single render artifact for a project */
export interface ProjectRender {
  id: string;
  label: string;
  createdAt: string;
  videoUrl?: string;
  status: 'pending' | 'ready' | 'failed';
  notes?: string;
}

/** Future: transcript / render version snapshot */
export interface ProjectVersion {
  id: string;
  label: string;
  createdAt: string;
  summary?: string;
}

export interface Project {
  id: string;
  title: string;
  originalLanguage: string;
  targetLanguage: string;
  status: ProjectStatus;
  progress: number; // 0 to 100
  size: string;     // e.g. "45.2 MB"
  duration: string; // e.g. "02:15"
  createdAt: string;
  videoUrl: string; // Simulated or actual uploaded video link
  dubbedUrl?: string; // Target path for finished dubbed rendering
  thumbnailUrl?: string; // Optional poster / preview frame
  voiceSettings: VoiceSettings;
  /** Backend voice key used for TTS (e.g. george, jessica) */
  voiceKey?: string;
  transcript: TranscriptSegment[];
  logs: LogEntry[];
  errorDetails?: string;
  failedStep?: string;
  failureReason?: string;
  steps?: { name: string; status: 'pending' | 'processing' | 'completed' | 'failed'; desc: string; progress: number }[];
  /** Media / pipeline metadata for Project Details */
  resolution?: string;
  fps?: number;
  translationModel?: string;
  ttsModel?: string;
  /** Wall-clock processing duration, e.g. "2m 14s" */
  processingTime?: string;
  processingTimeMs?: number;
  completedAt?: string;
  /** Future: multiple renders & version history (UI stubs for now) */
  renders?: ProjectRender[];
  versions?: ProjectVersion[];
}

export interface Language {
  code: string;
  name: string;
  localName: string;
  flag: string;
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  totalJobsProcessed: number;
  activeJobs: number;
  failedJobs: number;
  storageUsed: number; // in GB
  avgLatency: number; // in ms
}
