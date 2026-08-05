import { motion, useReducedMotion } from "motion/react";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  disabled?: boolean;
  loading?: boolean;
  children?: React.ReactNode;
  className?: string;
  type?: "button" | "submit";
};

export function TranslateButton({
  disabled,
  loading,
  children = "Translate Video",
  className,
  type = "submit",
}: Props) {
  const reduced = useReducedMotion();

  return (
    <motion.button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "relative flex-1 overflow-hidden rounded-xl px-4 py-3.5 text-xs font-extrabold text-zinc-950",
        "bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500",
        "shadow-[0_8px_24px_-12px_rgba(16,185,129,0.55)]",
        "disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950",
        className
      )}
      whileHover={
        reduced || disabled || loading ? undefined : { scale: 1.01 }
      }
      whileTap={reduced || disabled || loading ? undefined : { scale: 0.99 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
    >
      {!reduced && !disabled && !loading ? (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
          animate={{ x: ["-120%", "120%"] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "linear", repeatDelay: 1.2 }}
        />
      ) : null}
      <span className="relative z-[1] inline-flex items-center justify-center gap-2">
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Sparkles className="size-4 fill-zinc-950/20" />
        )}
        {loading ? "Starting…" : children}
      </span>
    </motion.button>
  );
}
