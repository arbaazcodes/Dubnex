import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { motion, useReducedMotion } from "motion/react";
import { UploadCloud, Film } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  onProcessFile: (file: File) => void;
  disabled?: boolean;
};

export function UploadDropzone({
  isDragging,
  setIsDragging,
  onProcessFile,
  disabled,
}: Props) {
  const reduced = useReducedMotion();
  const [justDropped, setJustDropped] = useState(false);

  const onDrop = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file) return;
      setJustDropped(true);
      window.setTimeout(() => setJustDropped(false), 600);
      onProcessFile(file);
    },
    [onProcessFile]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { "video/*": [".mp4", ".mov", ".avi", ".mkv", ".webm"] },
    multiple: false,
    disabled,
    noClick: true,
    noKeyboard: false,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
    onDropAccepted: () => setIsDragging(false),
    onDropRejected: () => setIsDragging(false),
  });

  const active = isDragging || isDragActive;

  return (
    <div
      {...getRootProps({
        className: cn(
          "relative overflow-hidden rounded-2xl border border-dashed p-8 sm:p-12 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
          active
            ? "border-emerald-500/80 bg-emerald-500/[0.06]"
            : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-950/30 hover:border-zinc-300 dark:hover:border-zinc-700"
        ),
        role: "button",
        tabIndex: 0,
        "aria-label": "Video upload dropzone. Press Enter to browse files.",
        onKeyDown: (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        },
      })}
    >
      <input {...getInputProps()} />

      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl"
        animate={
          reduced
            ? undefined
            : active
              ? {
                  boxShadow: [
                    "inset 0 0 0 1px rgba(16,185,129,0.35)",
                    "inset 0 0 0 1px rgba(16,185,129,0.7)",
                    "inset 0 0 0 1px rgba(16,185,129,0.35)",
                  ],
                }
              : { boxShadow: "inset 0 0 0 0px rgba(16,185,129,0)" }
        }
        transition={{
          duration: 1.6,
          repeat: active && !reduced ? Infinity : 0,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="relative flex flex-col items-center"
        animate={
          reduced
            ? undefined
            : justDropped
              ? { scale: [1, 0.98, 1], opacity: [1, 0.85, 1] }
              : {}
        }
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          className={cn(
            "mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border",
            active
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
              : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-400"
          )}
          animate={
            reduced || !active
              ? undefined
              : { scale: [1, 1.06, 1], opacity: [0.85, 1, 0.85] }
          }
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        >
          {active ? (
            <Film className="h-6 w-6" aria-hidden />
          ) : (
            <UploadCloud className="h-6 w-6" aria-hidden />
          )}
        </motion.div>

        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          Drag & drop your video
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          or{" "}
          <button
            type="button"
            className="font-semibold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 rounded"
            onClick={(e) => {
              e.stopPropagation();
              open();
            }}
          >
            browse files
          </button>
        </p>
        <p className="mt-3 text-[10px] font-mono uppercase tracking-widest text-zinc-400">
          MP4 · MOV · AVI · MKV · WEBM
        </p>
      </motion.div>
    </div>
  );
}
