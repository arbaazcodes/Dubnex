import { ExternalLink, Play } from "lucide-react";
import {
  AnimatedPresence,
  AnimatedPage,
} from "@/lib/animations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { UploadDropzone } from "./UploadDropzone";
import { UploadProgressPanel } from "./UploadProgressPanel";
import { VideoPreviewCard } from "./VideoPreviewCard";
import { LanguageSelect } from "./LanguageSelect";
import { UploadVoicePicker } from "./UploadVoicePicker";
import { TranslateButton } from "./TranslateButton";
import { ProcessingTimeline } from "./ProcessingTimeline";
import { CompletionScreen } from "./CompletionScreen";
import { UploadErrorBanner } from "./UploadErrorBanner";
import { UploadEmptyHero } from "./UploadEmptyHero";
import { ShimmerBlock } from "./UploadSkeleton";
import type { UploadStudioProps } from "./types";

export function UploadStudio(props: UploadStudioProps) {
  const {
    appState,
    videoMetadata,
    selectedFile,
    isDragging,
    setIsDragging,
    uploadError,
    onClearError,
    onRetry,
    videoUrlInput,
    setVideoUrlInput,
    onProcessFile,
    onLoadVideoUrl,
    onLoadDemoVideo,
    detectingLanguage,
    detectedLanguage,
    detectionConfidence,
    targetLanguage,
    onTargetLanguageChange,
    languages,
    voices,
    selectedVoiceId,
    favoriteVoiceIds,
    onSelectVoice,
    onToggleFavorite,
    onOpenVoiceLibrary,
    onStartDubbing,
    onReset,
    canTranslate,
    isSubmitting,
    progress,
    currentStepName,
    pipelineStages,
    pipelineStageHistory,
    elapsedSeconds,
    estimatedRemainingSeconds,
    formatClock,
    processingLogs,
    activeProject,
    secureVideoSrc,
    resolveVideoSrc,
    onDownload,
    onOpenProject,
    onSaveTranscript,
  } = props;

  const analyzing = Boolean(selectedFile && !videoMetadata && !uploadError);

  return (
    <AnimatedPresence mode="wait">
      {appState === "upload" ? (
        <AnimatedPage
          key="viewport-uploader"
          direction="fade"
          preset="normal"
          className="space-y-6"
        >
          {!videoMetadata ? <UploadEmptyHero /> : null}

          <div className="rounded-3xl border border-zinc-200/50 dark:border-zinc-900 bg-white dark:bg-zinc-900/30 p-4 sm:p-6 shadow-sm dark:shadow-none space-y-5">
            {uploadError ? (
              <UploadErrorBanner
                message={uploadError}
                onDismiss={onClearError}
                onRetry={
                  onRetry ||
                  (selectedFile
                    ? () => {
                        onClearError();
                        onProcessFile(selectedFile);
                      }
                    : undefined)
                }
              />
            ) : null}

            {!videoMetadata ? (
              <div className="space-y-5">
                {analyzing ? (
                  <div className="space-y-3" aria-busy="true">
                    <p className="text-xs text-zinc-500">Reading video metadata…</p>
                    <ShimmerBlock className="h-28 w-full" />
                    <UploadProgressPanel
                      progress={35}
                      fileSize={
                        selectedFile
                          ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`
                          : null
                      }
                      label="Preparing"
                    />
                  </div>
                ) : (
                  <UploadDropzone
                    isDragging={isDragging}
                    setIsDragging={setIsDragging}
                    onProcessFile={onProcessFile}
                  />
                )}

                <div className="rounded-2xl border border-zinc-200/50 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/30 p-4 space-y-2.5">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 font-bold flex items-center gap-1.5">
                    <ExternalLink className="size-3.5 text-emerald-500" />
                    Import from URL
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      type="url"
                      placeholder="Paste a direct MP4 / WEBM link…"
                      value={videoUrlInput}
                      onChange={(e) => setVideoUrlInput(e.target.value)}
                      className="h-10 rounded-xl font-mono text-xs"
                    />
                    <Button
                      type="button"
                      className="h-10 shrink-0"
                      onClick={() => onLoadVideoUrl(videoUrlInput)}
                    >
                      Load link
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Separator className="flex-1" />
                  <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-400">
                    Or try a sample
                  </span>
                  <Separator className="flex-1" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-10 justify-center gap-1.5 font-mono text-[11px]"
                    onClick={() =>
                      onLoadDemoVideo(
                        "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
                        "Sample: English Speech Demo.mp4"
                      )
                    }
                  >
                    <Play className="size-3 text-emerald-500" />
                    English demo
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-10 justify-center gap-1.5 font-mono text-[11px]"
                    onClick={() =>
                      onLoadDemoVideo(
                        "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
                        "Sample: Spanish Talk Demo.mp4"
                      )
                    }
                  >
                    <Play className="size-3 text-emerald-500" />
                    Spanish demo
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={onStartDubbing} className="space-y-5">
                <VideoPreviewCard
                  meta={videoMetadata}
                  detectingLanguage={detectingLanguage}
                  detectedLanguage={detectedLanguage}
                  detectionConfidence={detectionConfidence}
                  onRemove={onReset}
                  onReplace={onProcessFile}
                />

                <LanguageSelect
                  languages={languages}
                  value={targetLanguage}
                  onChange={onTargetLanguageChange}
                />

                <UploadVoicePicker
                  voices={voices}
                  selectedId={selectedVoiceId}
                  favoriteIds={favoriteVoiceIds}
                  onSelect={onSelectVoice}
                  onToggleFavorite={onToggleFavorite}
                  onOpenLibrary={onOpenVoiceLibrary}
                />

                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-xl"
                    onClick={onReset}
                  >
                    Reset
                  </Button>
                  <TranslateButton
                    disabled={!canTranslate}
                    loading={isSubmitting}
                  />
                </div>
              </form>
            )}
          </div>
        </AnimatedPage>
      ) : null}

      {appState === "processing" ? (
        <AnimatedPage
          key="viewport-processing"
          direction="fade"
          preset="normal"
          className="rounded-3xl border border-zinc-200/50 dark:border-zinc-900 bg-white dark:bg-zinc-900/30 p-5 sm:p-8 shadow-sm dark:shadow-none space-y-6"
        >
          <div className="text-center space-y-1">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white tracking-tight">
              {currentStepName === "Video Rendering"
                ? "Rendering video"
                : currentStepName}
            </h3>
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">
              Elapsed {formatClock(elapsedSeconds)}
            </p>
          </div>

          <UploadProgressPanel
            progress={progress}
            fileSize={videoMetadata?.size || activeProject?.size}
            elapsedSeconds={elapsedSeconds}
            estimatedRemainingSeconds={estimatedRemainingSeconds}
            formatClock={formatClock}
            label="Pipeline progress"
          />

          <div className="rounded-2xl border border-zinc-200/40 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-950/30 p-4 sm:p-5">
            <ProcessingTimeline
              progress={progress}
              currentStepName={currentStepName}
              pipelineStages={pipelineStages}
              pipelineStageHistory={pipelineStageHistory}
            />
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3 max-h-[140px] overflow-y-auto space-y-1.5 text-left">
            <p className="text-[9px] font-mono text-emerald-500 uppercase tracking-widest font-bold px-1">
              Processing logs
            </p>
            {(processingLogs.length > 0
              ? processingLogs
              : activeProject?.logs || []
            )
              .slice(-12)
              .map((log) => (
                <div key={log.id} className="px-1">
                  <p className="text-[10px] font-mono text-zinc-500 leading-snug">
                    <span className="text-zinc-600">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>{" "}
                    <span
                      className={
                        log.level === "error" ? "text-rose-400" : "text-zinc-300"
                      }
                    >
                      [{log.step || "pipeline"}] {log.message}
                    </span>
                  </p>
                </div>
              ))}
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={onReset}
              className="text-xs font-mono text-zinc-400 hover:text-rose-500 font-bold transition-colors hover:underline"
            >
              Cancel translation
            </button>
          </div>
        </AnimatedPage>
      ) : null}

      {appState === "result" ? (
        <AnimatedPage
          key="viewport-result"
          direction="fade"
          preset="normal"
          className="space-y-6"
        >
          <div className="rounded-3xl border border-zinc-200/50 dark:border-zinc-900 bg-white dark:bg-zinc-900/30 p-4 sm:p-6 shadow-sm dark:shadow-none">
            <CompletionScreen
              project={activeProject}
              videoSrc={
                secureVideoSrc ||
                resolveVideoSrc(activeProject) ||
                "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4"
              }
              onDownload={onDownload}
              onOpenProject={onOpenProject}
              onCreateNew={onReset}
              onSaveTranscript={onSaveTranscript}
            />
          </div>
        </AnimatedPage>
      ) : null}
    </AnimatedPresence>
  );
}

export default UploadStudio;
