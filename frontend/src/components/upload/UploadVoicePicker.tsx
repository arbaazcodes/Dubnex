import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Search,
  Star,
  Play,
  Pause,
  Loader2,
  Check,
  Volume2,
} from "lucide-react";
import type { LibraryVoice } from "@/types";
import { languageDisplayName } from "@/constants/voices";
import { useVoicePreview } from "@/components/voices/useVoicePreview";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Props = {
  voices: LibraryVoice[];
  selectedId: string | null;
  favoriteIds: string[];
  onSelect: (voice: LibraryVoice) => void;
  onToggleFavorite: (voiceId: string) => void;
  onOpenLibrary?: () => void;
};

function matches(voice: LibraryVoice, q: string) {
  if (!q) return true;
  const hay = [
    voice.name,
    voice.gender,
    voice.accent,
    voice.language,
    languageDisplayName(voice.language),
    voice.category,
    voice.description || "",
    ...(voice.tags || []),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function UploadVoicePicker({
  voices,
  selectedId,
  favoriteIds,
  onSelect,
  onToggleFavorite,
  onOpenLibrary,
}: Props) {
  const reduced = useReducedMotion();
  const [query, setQuery] = useState("");
  const { toggle, isLoading, isPlaying, isPaused } = useVoicePreview();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = voices.filter((v) => matches(v, q));
    return [...list].sort((a, b) => {
      const af = favoriteIds.includes(a.id) ? 0 : 1;
      const bf = favoriteIds.includes(b.id) ? 0 : 1;
      if (af !== bf) return af - bf;
      return a.name.localeCompare(b.name);
    });
  }, [voices, query, favoriteIds]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 font-bold">
          Voice
        </label>
        {onOpenLibrary ? (
          <button
            type="button"
            onClick={onOpenLibrary}
            className="text-[10px] font-mono font-bold uppercase text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            Full library
          </button>
        ) : null}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search voices, accents, languages…"
          className="h-9 pl-9 rounded-xl text-xs"
          aria-label="Search voices"
        />
      </div>

      <div
        className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-0.5"
        role="listbox"
        aria-label="Voice cards"
      >
        {filtered.map((voice) => {
          const selected = voice.id === selectedId;
          const fav = favoriteIds.includes(voice.id);
          const previewBusy = isLoading(voice.id);
          const playing = isPlaying(voice.id);
          const paused = isPaused(voice.id);
          const canPreview = Boolean(voice.previewUrl);

          return (
            <motion.div
              key={voice.id}
              role="option"
              aria-selected={selected}
              layout={!reduced}
              className={cn(
                "relative rounded-xl border p-3 text-left transition-colors cursor-pointer",
                selected
                  ? "border-emerald-500/60 bg-emerald-500/[0.07] shadow-[0_0_0_1px_rgba(16,185,129,0.25)]"
                  : "border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-950/40 hover:border-zinc-300 dark:hover:border-zinc-700"
              )}
              onClick={() => onSelect(voice)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(voice);
                }
              }}
              tabIndex={0}
              initial={false}
              animate={
                selected && !reduced
                  ? { scale: 1 }
                  : { scale: 1 }
              }
            >
              {selected ? (
                <motion.span
                  layoutId={reduced ? undefined : "voice-selected-check"}
                  className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-emerald-500 text-zinc-950"
                >
                  <Check className="size-3" />
                </motion.span>
              ) : null}

              <div className="flex items-start gap-2 pr-6">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-900 text-zinc-500">
                  <Volume2 className="size-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                    {voice.name}
                  </p>
                  <p className="text-[10px] text-zinc-500 truncate">
                    {voice.accent} · {voice.gender}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <Badge variant="secondary" className="text-[9px] font-mono">
                      {languageDisplayName(voice.language)}
                    </Badge>
                    <Badge variant="outline" className="text-[9px] font-mono">
                      {voice.category}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-1.5">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={!canPreview}
                  title={canPreview ? "Preview" : "Preview unavailable"}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canPreview) toggle(voice);
                  }}
                >
                  {previewBusy ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : playing && !paused ? (
                    <Pause className="size-3" />
                  ) : (
                    <Play className="size-3" />
                  )}
                  Preview
                </Button>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  aria-label={fav ? "Remove favorite" : "Add favorite"}
                  aria-pressed={fav}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(voice.id);
                  }}
                >
                  <Star
                    className={cn(
                      "size-3.5",
                      fav
                        ? "fill-amber-400 text-amber-400"
                        : "text-zinc-400"
                    )}
                  />
                </Button>
              </div>
            </motion.div>
          );
        })}
        {filtered.length === 0 ? (
          <p className="col-span-full py-8 text-center text-xs text-zinc-400">
            No voices match your search
          </p>
        ) : null}
      </div>
    </div>
  );
}
