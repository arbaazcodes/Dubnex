// VoiceStudioPicker — premium replacement for the legacy VoiceSelector dropdown.
// A compact trigger (selected voice summary + inline preview + favorite) that
// opens the full Voice Studio in a dialog. Selection still flows through the
// same onSelect path as before (handleSetDefaultVoice) so nothing downstream changes.
import { useMemo, useState } from 'react';
import { Check, ChevronDown, Loader2, Pause, Play, Star, Volume2 } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import VoiceStudio from './VoiceStudio';
import { useVoicePreview } from './useVoicePreview';
import { voiceLibraryCatalog, languageDisplayName } from '../../constants/voices';
import type { LibraryVoice } from '../../types';

export interface VoiceStudioPickerProps {
  voices?: LibraryVoice[];
  selectedId: string | null;
  favoriteIds: string[];
  recentlyUsedIds?: string[];
  /** Optional target translation language — powers AI recommendations inside the studio. */
  targetLanguage?: string;
  onSelect: (voice: LibraryVoice) => void;
  onToggleFavorite: (voiceId: string) => void;
  /** Optional label above the trigger. */
  label?: string;
  className?: string;
}

export default function VoiceStudioPicker({
  voices = voiceLibraryCatalog,
  selectedId,
  favoriteIds,
  recentlyUsedIds = [],
  targetLanguage,
  onSelect,
  onToggleFavorite,
  label = 'Project Voice',
  className = '',
}: VoiceStudioPickerProps) {
  const [open, setOpen] = useState(false);
  const { toggle, stop, isLoading, isPlaying, isPaused, error } = useVoicePreview();

  const selected = useMemo(
    () => voices.find((v) => v.id === selectedId) ?? null,
    [voices, selectedId]
  );
  const isFavorite = selected ? favoriteIds.includes(selected.id) : false;

  const openStudio = () => {
    stop();
    setOpen(true);
  };

  const closeStudio = () => {
    stop();
    setOpen(false);
  };

  return (
    <div className={className}>
      <label className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block font-bold mb-2">
        {label}
      </label>

      <div className="flex items-stretch border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-950 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/40 transition-shadow">
        <button
          type="button"
          onClick={openStudio}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={
            selected
              ? `Open Voice Studio — current voice ${selected.name}`
              : 'Open Voice Studio'
          }
          title="Open Voice Studio"
          className="flex-1 flex items-center gap-3 px-4 py-3 text-left cursor-pointer outline-none focus-visible:bg-white dark:focus-visible:bg-zinc-900"
        >
          <span className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Volume2 className="w-4 h-4 text-emerald-500" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-white truncate">
              {selected?.name || 'Select a voice'}
              {selected && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-label="Selected" />}
            </span>
            {selected && (
              <span className="text-[10px] text-zinc-500 font-mono truncate mt-0.5 block">
                {selected.gender} · {selected.accent} ·{' '}
                {languageDisplayName(selected.language)} · {selected.category}
              </span>
            )}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>

        {selected?.previewUrl && (
          <button
            type="button"
            onClick={() => void toggle(selected)}
            title={
              isLoading(selected.id)
                ? 'Loading preview…'
                : isPlaying(selected.id)
                  ? 'Pause preview'
                  : `Preview ${selected.name}`
            }
            aria-label={
              isLoading(selected.id)
                ? 'Loading preview'
                : isPlaying(selected.id)
                  ? 'Pause preview'
                  : `Preview ${selected.name}`
            }
            className="w-11 shrink-0 border-l border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-emerald-500 hover:bg-white dark:hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            {isLoading(selected.id) ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
            ) : isPlaying(selected.id) ? (
              <Pause className="w-4 h-4" />
            ) : isPaused(selected.id) ? (
              <Play className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </button>
        )}

        {selected && (
          <button
            type="button"
            onClick={() => onToggleFavorite(selected.id)}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-pressed={isFavorite}
            aria-label={`${isFavorite ? 'Remove' : 'Add'} ${selected.name} ${isFavorite ? 'from' : 'to'} favorites`}
            className="w-11 shrink-0 border-l border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-amber-500 hover:bg-white dark:hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <Star className={`w-4 h-4 ${isFavorite ? 'text-amber-500 fill-amber-500' : ''}`} />
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-[10px] font-mono text-amber-600 dark:text-amber-400 mt-1.5">
          {error}
        </p>
      )}

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeStudio())}>
        <DialogContent className="max-w-5xl h-[min(88vh,820px)] flex flex-col p-0 overflow-hidden">
          <DialogTitle className="sr-only">Voice Studio</DialogTitle>
          <DialogDescription className="sr-only">
            Browse, preview and select the project voice.
          </DialogDescription>
          <VoiceStudio
            favoriteIds={favoriteIds}
            defaultVoiceId={selectedId}
            recentlyUsedIds={recentlyUsedIds}
            targetLanguage={targetLanguage}
            voices={voices}
            onToggleFavorite={onToggleFavorite}
            onSelectDefault={(voice) => {
              onSelect(voice);
              closeStudio();
            }}
          />
          <div className="border-t border-border/70 px-5 py-3 flex items-center justify-between gap-2 shrink-0">
            <p className="text-[10px] font-mono text-muted-foreground hidden sm:block">
              ↑↓ move · Enter select · P preview · F favorite
            </p>
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={closeStudio}>
                Done
              </Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
