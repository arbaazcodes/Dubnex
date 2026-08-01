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

export interface TranscriptSegment {
  id: string;
  start: number; // seconds
  end: number;   // seconds
  text: string;
  translatedText: string;
  speaker?: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  step?: string;
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
  voiceSettings: VoiceSettings;
  transcript: TranscriptSegment[];
  logs: LogEntry[];
  errorDetails?: string;
  failedStep?: string;
  failureReason?: string;
  steps?: { name: string; status: 'pending' | 'processing' | 'completed' | 'failed'; desc: string; progress: number }[];
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
