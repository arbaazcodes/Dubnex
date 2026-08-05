import type { LibraryVoice, Project, Language } from "@/types";

export type UploadAppState = "upload" | "processing" | "result";

export type VideoMetadata = {
  name: string;
  size: string;
  duration: string;
  resolution: string;
  fps: number;
  thumbnailUrl: string;
  url: string;
};

export type PipelineStage = { key: string; label: string };

export type ProcessingLog = {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  step?: string;
};

export type UploadStudioProps = {
  appState: UploadAppState;
  videoMetadata: VideoMetadata | null;
  selectedFile: File | null;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  uploadError: string | null;
  onClearError: () => void;
  onRetry?: () => void;
  videoUrlInput: string;
  setVideoUrlInput: (v: string) => void;
  onProcessFile: (file: File) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLoadVideoUrl: (url: string) => void;
  onLoadDemoVideo: (url: string, name: string) => void;
  detectingLanguage: boolean;
  detectedLanguage: string | null;
  detectionConfidence: number | null;
  targetLanguage: string;
  onTargetLanguageChange: (code: string) => void;
  languages: Language[];
  voices: LibraryVoice[];
  selectedVoiceId: string | null;
  favoriteVoiceIds: string[];
  onSelectVoice: (voice: LibraryVoice) => void;
  onToggleFavorite: (voiceId: string) => void;
  onOpenVoiceLibrary: () => void;
  onStartDubbing: (e: React.FormEvent) => void;
  onReset: () => void;
  canTranslate: boolean;
  isSubmitting?: boolean;
  // processing
  progress: number;
  currentStepName: string;
  pipelineStages: PipelineStage[];
  pipelineStageHistory: string[];
  elapsedSeconds: number;
  estimatedRemainingSeconds: number | null;
  formatClock: (seconds: number) => string;
  processingLogs: ProcessingLog[];
  activeProject: Project | null;
  // result
  secureVideoSrc: string;
  resolveVideoSrc: (project: Project | null) => string;
  onDownload: (project: Project) => void | Promise<void>;
  onOpenProject: (project: Project) => void;
  onSaveTranscript: (
    projectId: string,
    segments: import("@/types").TranscriptSegment[]
  ) => void | Promise<void>;
};
