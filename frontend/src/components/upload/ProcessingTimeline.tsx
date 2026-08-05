import { motion, useReducedMotion } from "motion/react";
import {
  Upload,
  AudioLines,
  Languages,
  Mic,
  Clapperboard,
  Download,
  Check,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PipelineStage } from "./types";

/** Presentation timeline — maps backend stages without changing pipeline logic. */
const DISPLAY = [
  { id: "upload", label: "Upload", icon: Upload, match: ["Upload"] },
  {
    id: "transcription",
    label: "Transcription",
    icon: AudioLines,
    match: ["Audio Extraction", "Whisper"],
  },
  {
    id: "translation",
    label: "Translation",
    icon: Languages,
    match: ["Translation"],
  },
  { id: "voice", label: "Voice", icon: Mic, match: ["TTS"] },
  {
    id: "rendering",
    label: "Rendering",
    icon: Clapperboard,
    match: ["Audio Merge", "Video Rendering"],
  },
  { id: "download", label: "Download", icon: Download, match: ["Completed"] },
] as const;

type Props = {
  progress: number;
  currentStepName: string;
  pipelineStages: PipelineStage[];
  pipelineStageHistory: string[];
};

export function ProcessingTimeline({
  progress,
  currentStepName,
  pipelineStages,
  pipelineStageHistory,
}: Props) {
  const reduced = useReducedMotion();
  const orderKeys = pipelineStages.map((s) => s.key);
  const currentKey = orderKeys.includes(currentStepName)
    ? currentStepName
    : pipelineStageHistory[pipelineStageHistory.length - 1] || "Upload";
  const backendOrder = orderKeys.indexOf(currentKey);

  return (
    <ol className="relative space-y-0 text-left" aria-label="Processing timeline">
      {DISPLAY.map((step, idx) => {
        const indices = step.match
          .map((k) => orderKeys.indexOf(k))
          .filter((i) => i >= 0);
        const min = indices.length ? Math.min(...indices) : 999;
        const max = indices.length ? Math.max(...indices) : -1;

        const status: "completed" | "current" | "pending" =
          progress >= 100
            ? "completed"
            : backendOrder > max
              ? "completed"
              : backendOrder >= min && backendOrder <= max
                ? "current"
                : "pending";

        const Icon = step.icon;
        const isLast = idx === DISPLAY.length - 1;

        return (
          <li key={step.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!isLast ? (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[15px] top-8 bottom-0 w-px",
                  status === "completed"
                    ? "bg-emerald-500/50"
                    : "bg-zinc-200 dark:bg-zinc-800"
                )}
              />
            ) : null}

            <motion.div
              className={cn(
                "relative z-[1] flex size-8 shrink-0 items-center justify-center rounded-full border",
                status === "completed" &&
                  "border-emerald-500/40 bg-emerald-500 text-zinc-950",
                status === "current" &&
                  "border-emerald-500/50 bg-emerald-500/10 text-emerald-500",
                status === "pending" &&
                  "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-400"
              )}
              animate={
                !reduced && status === "current"
                  ? { scale: [1, 1.05, 1] }
                  : { scale: 1 }
              }
              transition={{
                duration: 1.5,
                repeat: status === "current" && !reduced ? Infinity : 0,
              }}
            >
              {status === "completed" ? (
                <Check className="size-3.5" />
              ) : status === "current" ? (
                <Zap className="size-3.5" />
              ) : (
                <Icon className="size-3.5" />
              )}
            </motion.div>

            <div className="min-w-0 pt-1 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p
                  className={cn(
                    "text-xs font-semibold",
                    status === "current"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : status === "completed"
                        ? "text-zinc-500"
                        : "text-zinc-400"
                  )}
                >
                  {step.label}
                </p>
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                  {status === "completed"
                    ? "Done"
                    : status === "current"
                      ? "Active"
                      : "Queued"}
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
