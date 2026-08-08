import { useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Replace, Trash2, Clock, MonitorPlay, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { VideoMetadata } from "./types";

type Props = {
  meta: VideoMetadata;
  detectingLanguage?: boolean;
  detectedLanguage?: string | null;
  detectionConfidence?: number | null;
  onRemove: () => void;
  onReplace: (file: File) => void;
  className?: string;
};

export function VideoPreviewCard({
  meta,
  detectingLanguage,
  detectedLanguage,
  detectionConfidence,
  onRemove,
  onReplace,
  className,
}: Props) {
  const reduced = useReducedMotion();
  const replaceRef = useRef<HTMLInputElement>(null);

  return (
    <motion.div
      className={cn(
        "rounded-2xl border border-zinc-200/60 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-950/40",
        className
      )}
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-0">
        <div className="relative aspect-video sm:aspect-auto sm:min-h-[120px] bg-zinc-950">
          {meta.thumbnailUrl ? (
            <img
              src={meta.thumbnailUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-90"
            />
          ) : null}
          <video
            src={meta.url}
            className="relative z-[1] h-full w-full object-contain bg-black/40"
            controls
            playsInline
            preload="metadata"
          />
        </div>

        <div className="p-4 sm:p-5 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                {meta.name}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="gap-1 font-mono text-[10px]">
                  <Clock className="size-3" aria-hidden />
                  {meta.duration}
                </Badge>
                <Badge variant="secondary" className="gap-1 font-mono text-[10px]">
                  <MonitorPlay className="size-3" aria-hidden />
                  {meta.resolution}
                </Badge>
                <Badge variant="secondary" className="gap-1 font-mono text-[10px]">
                  <HardDrive className="size-3" aria-hidden />
                  {meta.size}
                </Badge>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/40 px-3 py-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">
              Detected language
            </p>
            {detectingLanguage ? (
              <p className="mt-1 text-xs text-zinc-500 flex items-center gap-2">
                <span className="size-3 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                Analyzing…
              </p>
            ) : (
              <p className="mt-1 text-xs font-medium text-zinc-800 dark:text-zinc-100">
                {detectedLanguage || "Unknown"}
                {detectionConfidence != null ? (
                  <span className="ml-2 text-emerald-600 dark:text-emerald-400 font-mono text-[10px]">
                    {Math.round(detectionConfidence * 100)}%
                  </span>
                ) : null}
              </p>
            )}
          </div>

          <div className="mt-auto flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => replaceRef.current?.click()}
            >
              <Replace className="size-3.5" />
              Replace
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
              <Trash2 className="size-3.5" />
              Remove
            </Button>
            <input
              ref={replaceRef}
              type="file"
              accept="video/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onReplace(file);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
