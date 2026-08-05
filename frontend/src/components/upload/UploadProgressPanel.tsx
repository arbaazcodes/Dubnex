import { motion, useReducedMotion } from "motion/react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type Props = {
  progress: number;
  fileSize?: string | null;
  elapsedSeconds?: number;
  estimatedRemainingSeconds?: number | null;
  formatClock?: (s: number) => string;
  label?: string;
  className?: string;
};

function formatSpeed(
  progress: number,
  elapsedSeconds: number,
  fileSizeLabel?: string | null
): string | null {
  if (!fileSizeLabel || elapsedSeconds < 1 || progress < 1) return null;
  const mb = parseFloat(String(fileSizeLabel).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(mb) || mb <= 0) return null;
  const uploadedMb = (mb * progress) / 100;
  const speed = uploadedMb / elapsedSeconds;
  if (!Number.isFinite(speed) || speed <= 0) return null;
  return `${speed.toFixed(1)} MB/s`;
}

export function UploadProgressPanel({
  progress,
  fileSize,
  elapsedSeconds = 0,
  estimatedRemainingSeconds = null,
  formatClock = (s) => `${s}s`,
  label = "Uploading",
  className,
}: Props) {
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, Math.round(progress)));
  const speed = formatSpeed(clamped, elapsedSeconds, fileSize);

  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-200/60 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 p-4 space-y-3",
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={`${label} ${clamped} percent`}
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">
            {label}
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <motion.span
              key={clamped}
              className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white tabular-nums"
              initial={reduced ? false : { opacity: 0.4, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              {clamped}%
            </motion.span>
            {fileSize ? (
              <span className="text-xs text-zinc-500 font-mono">{fileSize}</span>
            ) : null}
          </div>
        </div>
        <div className="text-right text-[10px] font-mono text-zinc-400 space-y-0.5">
          {speed ? <p>{speed}</p> : null}
          <p>
            {clamped >= 100
              ? "Done"
              : estimatedRemainingSeconds == null
                ? "Est. calculating…"
                : `${formatClock(estimatedRemainingSeconds)} left`}
          </p>
        </div>
      </div>

      <div className="relative">
        <Progress value={clamped} className="h-1.5 bg-zinc-200/80 dark:bg-zinc-800" />
        {!reduced && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/10"
            animate={{ x: ["-40%", "420%"] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
            style={{ width: "20%" }}
          />
        )}
      </div>
    </div>
  );
}
