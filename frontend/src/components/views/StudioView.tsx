// StudioView - Primary dubbing workflow (upload / processing / result) left column.
import { motion, AnimatePresence } from 'motion/react';
import {
  UploadCloud,
  Sparkles,
  AlertCircle,
  Download,
  Play,
  ExternalLink,
} from 'lucide-react';
import TranscriptEditor from '../chat/TranscriptEditor';
import VoiceStudioPicker from '../voices/VoiceStudioPicker';
import { targetLanguages } from '../../constants/data';
import { voiceLibraryCatalog, resolveApiVoiceKey } from '../../constants/voices';
import { resolveProjectMediaUrl } from '../../services/api';
import type { ChangeEvent, FormEvent } from 'react';
import type { LibraryVoice, Project, TranscriptSegment } from '../../types';
import type { VideoMetadata } from '../../hooks/useUpload';

interface StudioViewProps {
  appState: 'upload' | 'processing' | 'result';
  setMainView: (view: 'studio' | 'projects' | 'project-details' | 'voices') => void;
  secureVideoSrc: string;
  activeProject: Project | null;
  handleDownloadProject: (project: Project) => void;
  handleSaveTranscript: (updatedTranscript: TranscriptSegment[]) => void;
  defaultVoiceId: string | null;
  handleSetDefaultVoice: (voice: LibraryVoice) => void;
  favoriteVoiceIds: string[];
  handleToggleFavoriteVoice: (voiceId: string) => void;
  recentlyUsedVoiceIds: string[];
  targetLanguageInput: string;
  setTargetLanguageInput: (value: string) => void;
  detectedLanguage: string | null;
  detectionConfidence: number | null;
  detectingLanguage: boolean;
  videoUrlInput: string;
  setVideoUrlInput: (value: string) => void;
  uploadProgress: number | null;
  uploadingState: string;
  uploadError: string | null;
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
  videoMetadata: VideoMetadata | null;
  pipelineStageHistory: string[];
  elapsedSeconds: number;
  processingLogs: { id: string; timestamp: string; level: string; message: string; step?: string }[];
  handleProcessFile: (file: File) => void;
  handleFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleLoadDemoVideo: (url: string, name: string) => void;
  handleLoadVideoUrl: (url: string) => void;
  handleStartDubbing: (event: FormEvent) => void;
  handleResetWorkflow: () => void;
}

export default function StudioView(props: StudioViewProps) {
  const {
    appState,
    setMainView,
    secureVideoSrc,
    activeProject,
    handleDownloadProject,
    handleSaveTranscript,
    defaultVoiceId,
    handleSetDefaultVoice,
    favoriteVoiceIds,
    handleToggleFavoriteVoice,
    recentlyUsedVoiceIds,
    targetLanguageInput,
    setTargetLanguageInput,
    detectedLanguage,
    detectionConfidence,
    detectingLanguage,
    videoUrlInput,
    setVideoUrlInput,
    uploadProgress,
    uploadingState,
    uploadError,
    isDragging,
    setIsDragging,
    videoMetadata,
    pipelineStageHistory,
    elapsedSeconds,
    processingLogs,
    handleProcessFile,
    handleFileChange,
    handleLoadDemoVideo,
    handleLoadVideoUrl,
    handleStartDubbing,
    handleResetWorkflow,
  } = props;

  const currentStepProgress = activeProject ? activeProject.progress : (uploadProgress || 10);
  const currentStepName = activeProject ? activeProject.status : (uploadingState || 'Preparing...');

  const pipelineStages = [
    { key: 'Upload', label: 'Upload' },
    { key: 'Audio Extraction', label: 'Audio Extraction' },
    { key: 'Whisper', label: 'Whisper' },
    { key: 'Translation', label: 'Translation' },
    { key: 'TTS', label: 'TTS' },
    { key: 'Audio Merge', label: 'Audio Merge' },
    { key: 'Video Rendering', label: 'Video Render' },
    { key: 'Completed', label: 'Completed' },
  ];

  const formatClock = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const estimatedRemainingSeconds =
    currentStepProgress > 5 && currentStepProgress < 100 && elapsedSeconds > 0
      ? Math.max(0, Math.round((elapsedSeconds / currentStepProgress) * (100 - currentStepProgress)))
      : null;

  return (
        <section className="lg:col-span-7 xl:col-span-8 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            
            {/* VIEWPORT 1: HOME / UPLOADER */}
            {appState === 'upload' && (
              <motion.div
                key="viewport-uploader"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                
                {/* Intro Header */}
                {!videoMetadata && (
                  <div className="text-left space-y-2 max-w-md">
                    <h1 className="text-2.5xl sm:text-3.5xl font-extrabold tracking-tight text-zinc-900 dark:text-white leading-tight">
                      Zero-Shot Video Dubbing. <br/>
                      <span className="text-emerald-500">Intelligent Vocals.</span>
                    </h1>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 max-w-sm">
                      Automatic speech timelines alignment and high-fidelity vocal synthesis cloning. Drop an MP4 container or play standard demo feeds.
                    </p>
                  </div>
                )}

                {/* Upload Card container */}
                <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200/50 dark:border-zinc-900 rounded-3xl p-6 shadow-sm dark:shadow-none space-y-6">
                  
                  {/* Error Notifications */}
                  {uploadError && (
                    <div className="bg-rose-50 dark:bg-rose-950/15 border border-rose-100 dark:border-rose-900/30 p-4 rounded-2xl flex items-start gap-3 text-left text-xs text-rose-800 dark:text-rose-400">
                      <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-bold font-mono text-[10px] uppercase tracking-wider">Pipeline Safety Failure</p>
                        <p className="text-[11px] mt-0.5 leading-relaxed">{uploadError}</p>
                      </div>
                    </div>
                  )}

                  {/* If video is NOT yet selected */}
                  {!videoMetadata ? (
                    <div className="space-y-5">
                      <div 
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDragging(false);
                          const file = e.dataTransfer.files?.[0];
                          if (file) handleProcessFile(file);
                        }}
                        className={`border border-dashed rounded-2xl p-10 flex flex-col items-center justify-center transition-all duration-200 ${
                          isDragging 
                            ? 'border-emerald-500 bg-emerald-500/5' 
                            : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/30 dark:bg-zinc-950/10'
                        }`}
                      >
                        <UploadCloud className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mb-4" />
                        <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 text-center mb-1">
                          Drag & drop your video container here, or{' '}
                          <label className="text-emerald-500 hover:text-emerald-400 font-bold cursor-pointer transition-colors hover:underline">
                            browse files
                            <input 
                              type="file" 
                              accept="video/*" 
                              className="hidden" 
                              onChange={handleFileChange} 
                            />
                          </label>
                        </p>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono tracking-wider uppercase mt-1">
                          MP4, MOV, AVI, MKV, WEBM
                        </p>
                      </div>

                      {/* Video Link Input Section */}
                      <div className="bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-200/40 dark:border-zinc-850/40 rounded-2xl p-4 space-y-2.5 text-left">
                        <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-extrabold flex items-center gap-1.5">
                          <ExternalLink className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Import from Video Link / URL</span>
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="url"
                            placeholder="Paste MP4, MOV, or direct video link..."
                            value={videoUrlInput}
                            onChange={(e) => setVideoUrlInput(e.target.value)}
                            className="flex-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200 font-mono placeholder:text-zinc-450 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleLoadVideoUrl(videoUrlInput)}
                            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-mono text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                          >
                            <span>Load Link</span>
                          </button>
                        </div>
                        <p className="text-[9px] text-zinc-400 dark:text-zinc-500 leading-normal">
                          Supports direct video files (e.g. <code>.mp4</code> / <code>.webm</code>) or static cloud storage assets.
                        </p>
                      </div>

                      {/* Demo shortcuts */}
                      <div className="pt-2">
                        <div className="flex items-center justify-center gap-2 mb-3">
                          <div className="h-px bg-zinc-150 dark:bg-zinc-850 flex-1"></div>
                          <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono uppercase tracking-widest">Or try a sample video</span>
                          <div className="h-px bg-zinc-150 dark:bg-zinc-850 flex-1"></div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleLoadDemoVideo('https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', 'Sample: English Speech Demo.mp4')}
                            className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200/70 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-[11px] font-mono text-zinc-750 dark:text-zinc-300 rounded-xl transition-colors border border-zinc-200/30 dark:border-zinc-800/80 cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Play className="w-3 h-3 text-emerald-500 fill-emerald-500/20" />
                            <span>English Talk Demo</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLoadDemoVideo('https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', 'Sample: Spanish Talk Demo.mp4')}
                            className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200/70 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-[11px] font-mono text-zinc-750 dark:text-zinc-300 rounded-xl transition-colors border border-zinc-200/30 dark:border-zinc-800/80 cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Play className="w-3 h-3 text-emerald-500 fill-emerald-500/20" />
                            <span>Spanish Talk Demo</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Input Configuration Form */
                    <form onSubmit={handleStartDubbing} className="space-y-6">
                      
                      <div className="aspect-video w-full bg-zinc-950 rounded-2xl overflow-hidden relative border border-zinc-200/30 dark:border-zinc-900 shadow-sm">
                        <video
                          src={videoMetadata.url}
                          className="w-full h-full object-contain"
                          controls
                          playsInline
                        />
                      </div>

                      {/* Language Auto-Detect Status banner */}
                      <div className="bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-200/40 dark:border-zinc-900 rounded-2xl p-4 flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">Detected Spoken Language</span>
                          {detectingLanguage ? (
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                              <span className="text-xs font-mono text-zinc-500">Analyzing voice timbre...</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-zinc-900 dark:text-white font-mono uppercase bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/20">
                                {detectedLanguage || 'English'}
                              </span>
                              <span className="text-[10px] text-emerald-500 font-bold">✓ ({Math.round((detectionConfidence || 0.96) * 100)}% Confidence)</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="text-[9px] font-mono text-zinc-400 text-right space-y-0.5 hidden sm:block">
                          <p className="truncate max-w-[200px]">{videoMetadata.name}</p>
                          <p>{videoMetadata.size} • {videoMetadata.duration} secs</p>
                        </div>
                      </div>

                      {/* Target selection */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block font-bold">Target Translation Language</label>
                        <div className="relative">
                          <select
                            value={targetLanguageInput}
                            onChange={(e) => setTargetLanguageInput(e.target.value)}
                            className="w-full appearance-none bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl px-4 py-3.5 text-xs text-zinc-800 dark:text-zinc-200 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                          >
                            {targetLanguages.map(l => (
                              <option key={l.code} value={l.code} className="bg-white dark:bg-zinc-950">
                                {l.flag}  {l.name} ({l.localName})
                              </option>
                            ))}
                          </select>
                          <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-zinc-400">
                            ▼
                          </div>
                        </div>
                      </div>

                      {/* Premium Voice Studio — apiVoiceKey still via resolveApiVoiceKey(defaultVoiceId) */}
                      <VoiceStudioPicker
                        voices={voiceLibraryCatalog}
                        selectedId={defaultVoiceId}
                        favoriteIds={favoriteVoiceIds}
                        recentlyUsedIds={recentlyUsedVoiceIds}
                        targetLanguage={targetLanguageInput}
                        onSelect={handleSetDefaultVoice}
                        onToggleFavorite={handleToggleFavoriteVoice}
                        label="Project Voice"
                      />

                      <div className="flex justify-end -mt-1">
                        <button
                          type="button"
                          onClick={() => setMainView('voices')}
                          className="px-2 py-1 text-[10px] font-mono font-bold uppercase text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                        >
                          Open full Voice Studio
                        </button>
                      </div>

                      {/* Form Actions */}
                      <div className="pt-2 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleResetWorkflow}
                          className="px-5 py-3.5 bg-zinc-50 hover:bg-zinc-150 dark:bg-zinc-950 dark:hover:bg-zinc-900 text-zinc-500 dark:text-zinc-400 rounded-xl text-xs font-mono border border-zinc-200/40 dark:border-zinc-850 cursor-pointer"
                        >
                          Reset File
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-extrabold font-sans text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4 fill-zinc-950" />
                          <span>Translate Video</span>
                        </button>
                      </div>
                    </form>
                  )}

                </div>

              </motion.div>
            )}

            {/* VIEWPORT 2: PROCESSING SCREEN */}
            {appState === 'processing' && (
              <motion.div
                key="viewport-processing"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.2 }}
                className="bg-white dark:bg-zinc-900/30 border border-zinc-200/50 dark:border-zinc-900 rounded-3xl p-8 shadow-sm dark:shadow-none space-y-8 text-center"
              >
                {/* Radial Progress */}
                <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="42"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      fill="transparent"
                      className="text-zinc-100 dark:text-zinc-900"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="42"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      fill="transparent"
                      strokeDasharray="264"
                      strokeDashoffset={264 - (264 * currentStepProgress) / 100}
                      className="text-emerald-500 transition-all duration-300 ease-out"
                    />
                  </svg>
                  <div className="absolute font-mono text-base font-bold text-zinc-900 dark:text-white">
                    {currentStepProgress}%
                  </div>
                </div>

                {/* Status Messages */}
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white font-mono uppercase tracking-wider">
                    {currentStepName === 'Video Rendering' ? 'Video Render' : currentStepName}
                  </h3>
                  <div className="flex items-center justify-center gap-4 text-[10px] text-zinc-400 dark:text-zinc-500 font-mono uppercase tracking-widest">
                    <span>Elapsed {formatClock(elapsedSeconds)}</span>
                    <span>
                      {currentStepProgress >= 100
                        ? 'Done'
                        : estimatedRemainingSeconds === null
                          ? 'Est. calculating…'
                          : `Est. ${formatClock(estimatedRemainingSeconds)} remaining`}
                    </span>
                  </div>
                </div>

                {/* Real pipeline stage checklist */}
                <div className="max-w-md mx-auto bg-zinc-50/50 dark:bg-zinc-950/20 rounded-2xl p-4 border border-zinc-200/30 dark:border-zinc-900 text-left space-y-2.5">
                  {pipelineStages.map((step) => {
                    const orderKeys = pipelineStages.map((s) => s.key);
                    const currentKey = orderKeys.includes(currentStepName)
                      ? currentStepName
                      : (pipelineStageHistory[pipelineStageHistory.length - 1] || 'Upload');
                    const currentOrder = orderKeys.indexOf(currentKey);
                    const stepOrder = orderKeys.indexOf(step.key);
                    const isCompleted =
                      currentStepProgress >= 100 ||
                      (stepOrder >= 0 && currentOrder > stepOrder);
                    const isCurrent =
                      currentStepProgress < 100 && stepOrder === currentOrder;
                    
                    return (
                      <div 
                        key={step.key} 
                        className={`flex items-center justify-between text-[11px] font-mono transition-opacity ${
                          isCompleted ? 'text-zinc-400 dark:text-zinc-500' : isCurrent ? 'text-emerald-500 font-bold' : 'text-zinc-300 dark:text-zinc-700'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {isCompleted ? (
                            <span className="text-emerald-500 font-bold">✓</span>
                          ) : isCurrent ? (
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                          ) : (
                            <span className="w-1.5 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full"></span>
                          )}
                          <span>{step.label}</span>
                        </span>
                        <span>
                          {isCompleted ? 'Completed' : isCurrent ? 'Processing...' : 'Pending'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Live processing logs from SSE */}
                <div className="max-w-md mx-auto bg-zinc-950 text-left rounded-2xl border border-zinc-800 p-3 max-h-[140px] overflow-y-auto space-y-1.5">
                  <p className="text-[9px] font-mono text-emerald-500 uppercase tracking-widest font-bold px-1">Processing Logs</p>
                  {(processingLogs.length > 0 ? processingLogs : activeProject?.logs || []).slice(-12).map((log) => (
                    <div key={log.id} className="px-1">
                      <p className="text-[10px] font-mono text-zinc-500 leading-snug">
                        <span className="text-zinc-600">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        {' '}
                        <span className={log.level === 'error' ? 'text-rose-400' : 'text-zinc-300'}>
                          [{log.step || 'pipeline'}] {log.message}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleResetWorkflow}
                    className="text-xs font-mono text-zinc-400 hover:text-rose-500 font-bold transition-colors cursor-pointer hover:underline"
                  >
                    Cancel Translation
                  </button>
                </div>

              </motion.div>
            )}

            {/* VIEWPORT 3: RESULT PREVIEW / DOWNLOAD */}
            {appState === 'result' && (
              <motion.div
                key="viewport-result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                
                <div className="text-center space-y-1.5">
                  <span className="text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-widest">
                    Translation Completed Successfully
                  </span>
                  <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
                    {activeProject?.title || 'Translated Workspace Video'}
                  </h2>
                </div>

                {/* cinematic Video Player */}
                <div className="aspect-video w-full bg-zinc-950 rounded-2xl overflow-hidden relative border border-zinc-200/50 dark:border-zinc-900 shadow-sm">
                  <video
                    src={
                      secureVideoSrc ||
                      (activeProject
                        ? resolveProjectMediaUrl(activeProject, 'video')
                        : 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4')
                    }
                    className="w-full h-full object-contain"
                    controls
                    autoPlay
                    playsInline
                  />
                </div>

                {/* Timeline Transcript Editor */}
                {activeProject && (
                  <TranscriptEditor
                    project={activeProject}
                    onSaveTranscript={handleSaveTranscript}
                  />
                )}

                {/* Core actions */}
                <div className="space-y-3">
                  <a
                    href="#"
                    download={`${activeProject?.title || 'dubbed_video'}.mp4`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={async (e) => {
                      if (!activeProject) return;
                      e.preventDefault();
                      await handleDownloadProject(activeProject);
                    }}
                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-extrabold text-xs font-sans rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4.5 h-4.5" />
                    <span>Download Translated Video</span>
                  </a>

                  <button
                    onClick={handleResetWorkflow}
                    className="w-full py-3.5 bg-zinc-100 hover:bg-zinc-200/70 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-bold text-xs font-sans rounded-xl transition-all border border-zinc-200/40 dark:border-zinc-800/80 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Translate Another Video</span>
                  </button>
                </div>

              </motion.div>
            )}

          </AnimatePresence>
        </section>
  );
}
