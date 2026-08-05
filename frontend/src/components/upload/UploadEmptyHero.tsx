import { Film } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

export function UploadEmptyHero() {
  const reduced = useReducedMotion();

  return (
    <div className="relative overflow-hidden rounded-3xl border border-zinc-200/50 dark:border-zinc-900 bg-gradient-to-br from-zinc-50 via-white to-emerald-50/40 dark:from-zinc-950 dark:via-zinc-950 dark:to-emerald-950/20 p-6 sm:p-8">
      {!reduced ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-emerald-500/10 blur-3xl"
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}

      <div className="relative flex flex-col sm:flex-row sm:items-end gap-5">
        <div className="flex-1 space-y-2 max-w-lg">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 font-bold">
            Dubnex Studio
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white leading-tight">
            Upload once.
            <span className="block text-emerald-600 dark:text-emerald-400">
              Ship dubbed video.
            </span>
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md">
            Drop a video, pick a language and voice, then let Whisper, Gemini, and
            ElevenLabs handle the rest.
          </p>
        </div>

        <div
          className="hidden sm:flex size-24 items-center justify-center rounded-2xl border border-zinc-200/70 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/50 text-zinc-300 dark:text-zinc-600"
          aria-hidden
        >
          <Film className="size-10" strokeWidth={1.25} />
        </div>
      </div>
    </div>
  );
}
