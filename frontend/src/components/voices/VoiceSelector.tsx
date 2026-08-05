import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Search,
  ChevronDown,
  Check,
  Play,
  Pause,
  Loader2,
  Volume2,
  X,
} from 'lucide-react';
import type { LibraryVoice } from '../../types';
import { languageDisplayName } from '../../constants/voices';
import { useVoicePreview } from './useVoicePreview';

export type VoiceSelectorProps = {
  voices: LibraryVoice[];
  selectedId: string | null;
  onSelect: (voice: LibraryVoice) => void;
  className?: string;
  /** Optional label above the trigger */
  label?: string;
};

function voiceMatchesQuery(voice: LibraryVoice, q: string): boolean {
  if (!q) return true;
  const hay = [
    voice.name,
    voice.gender,
    voice.accent,
    voice.language,
    languageDisplayName(voice.language),
    voice.category,
    voice.description || '',
    ...(voice.tags || []),
    ...(voice.supportedLanguages || []),
  ]
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

export default function VoiceSelector({
  voices,
  selectedId,
  onSelect,
  className = '',
  label = 'Project Voice',
}: VoiceSelectorProps) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const { toggle, stop, isLoading, isPlaying, isPaused } = useVoicePreview();

  const selected = useMemo(
    () => voices.find((v) => v.id === selectedId) || voices[0] || null,
    [voices, selectedId]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return voices.filter((v) => voiceMatchesQuery(v, q));
  }, [voices, query]);

  useEffect(() => {
    if (!open) {
      stop();
      setQuery('');
      return;
    }
    setActiveIndex(0);
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, stop]);

  useEffect(() => {
    if (activeIndex >= filtered.length) {
      setActiveIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, activeIndex]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        listRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selectVoice = (voice: LibraryVoice) => {
    onSelect(voice);
    stop();
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (!filtered.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(filtered.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const voice = filtered[activeIndex];
      if (voice) selectVoice(voice);
    }
  };

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-voice-index="${activeIndex}"]`
    );
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, open]);

  const previewLabel = (voice: LibraryVoice) => {
    if (!voice.previewUrl) return 'Preview unavailable';
    if (isLoading(voice.id)) return 'Loading preview';
    if (isPlaying(voice.id)) return 'Pause preview';
    if (isPaused(voice.id)) return 'Resume preview';
    return `Preview ${voice.name}`;
  };

  return (
    <div className={`relative ${className}`}>
      <label
        id={`${listId}-label`}
        className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block font-bold mb-2"
      >
        {label}
      </label>

      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${listId}-listbox` : undefined}
        aria-labelledby={`${listId}-label`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        className="w-full flex items-center gap-3 text-left bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl px-4 py-3.5 hover:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
          <Volume2 className="w-4 h-4 text-emerald-500" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
            {selected?.name || 'Select a voice'}
          </p>
          {selected && (
            <p className="text-[10px] text-zinc-500 font-mono truncate mt-0.5">
              {selected.gender} · {selected.accent} ·{' '}
              {languageDisplayName(selected.language)} · {selected.category}
            </p>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          ref={listRef}
          id={`${listId}-listbox`}
          role="listbox"
          aria-labelledby={`${listId}-label`}
          aria-activedescendant={
            filtered[activeIndex]
              ? `${listId}-option-${filtered[activeIndex].id}`
              : undefined
          }
          tabIndex={-1}
          onKeyDown={onListKeyDown}
          className="absolute z-40 mt-2 w-full max-h-[min(28rem,70vh)] overflow-hidden flex flex-col rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl dark:shadow-none"
        >
          <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 space-y-2">
            <div className="relative">
              <Search
                className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                aria-hidden
              />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={onListKeyDown}
                placeholder="Search name, accent, language, category…"
                aria-label="Search voices"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 rounded-xl pl-9 pr-9 py-2.5 text-xs text-zinc-800 dark:text-zinc-200 font-mono placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    searchRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-[10px] font-mono text-zinc-400">
              {filtered.length} voice{filtered.length === 1 ? '' : 's'}
              {query ? ' matched' : ''}
            </p>
          </div>

          <div className="overflow-y-auto p-2 space-y-2 overscroll-contain">
            {filtered.length === 0 ? (
              <div className="px-3 py-8 text-center text-xs text-zinc-500">
                No voices match “{query}”.
              </div>
            ) : (
              filtered.map((voice, index) => {
                const isSelected = voice.id === selectedId;
                const isActive = index === activeIndex;
                const canPreview = Boolean(voice.previewUrl);
                const loading = isLoading(voice.id);
                const playing = isPlaying(voice.id);

                return (
                  <div
                    key={voice.id}
                    id={`${listId}-option-${voice.id}`}
                    role="option"
                    aria-selected={isSelected}
                    data-voice-index={index}
                    tabIndex={-1}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectVoice(voice)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        selectVoice(voice);
                      }
                    }}
                    className={`rounded-2xl border px-3 py-3 cursor-pointer transition-colors outline-none ${
                      isSelected
                        ? 'border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/20'
                        : isActive
                          ? 'border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950/80'
                          : 'border-zinc-200/70 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <h3 className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                            {voice.name}
                          </h3>
                          {isSelected && (
                            <Check
                              className="w-3.5 h-3.5 text-emerald-500 shrink-0"
                              aria-label="Selected"
                            />
                          )}
                        </div>
                        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1.5 text-[10px]">
                          <div>
                            <dt className="font-mono uppercase tracking-wider text-zinc-400 font-bold">
                              Gender
                            </dt>
                            <dd className="text-zinc-700 dark:text-zinc-300 font-medium">
                              {voice.gender}
                            </dd>
                          </div>
                          <div>
                            <dt className="font-mono uppercase tracking-wider text-zinc-400 font-bold">
                              Accent
                            </dt>
                            <dd className="text-zinc-700 dark:text-zinc-300 font-medium truncate">
                              {voice.accent}
                            </dd>
                          </div>
                          <div>
                            <dt className="font-mono uppercase tracking-wider text-zinc-400 font-bold">
                              Language
                            </dt>
                            <dd className="text-zinc-700 dark:text-zinc-300 font-medium truncate">
                              {languageDisplayName(voice.language)}
                            </dd>
                          </div>
                          <div>
                            <dt className="font-mono uppercase tracking-wider text-zinc-400 font-bold">
                              Category
                            </dt>
                            <dd className="text-zinc-700 dark:text-zinc-300 font-medium truncate">
                              {voice.category}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      <div className="shrink-0 flex flex-col items-stretch gap-1">
                        <button
                          type="button"
                          disabled={!canPreview || loading}
                          title={
                            canPreview
                              ? previewLabel(voice)
                              : 'Preview unavailable'
                          }
                          aria-label={previewLabel(voice)}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (canPreview) void toggle(voice);
                          }}
                          className={`inline-flex items-center justify-center gap-1.5 min-w-[5.5rem] px-2.5 py-2 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider border transition-colors ${
                            canPreview
                              ? 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 hover:border-emerald-500/40 cursor-pointer disabled:opacity-60'
                              : 'bg-zinc-100 dark:bg-zinc-950 border-zinc-200/60 dark:border-zinc-800 text-zinc-400 cursor-not-allowed'
                          }`}
                        >
                          {loading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                          ) : playing ? (
                            <Pause className="w-3.5 h-3.5" aria-hidden />
                          ) : (
                            <Play className="w-3.5 h-3.5" aria-hidden />
                          )}
                          <span>
                            {!canPreview
                              ? 'N/A'
                              : loading
                                ? '…'
                                : playing
                                  ? 'Pause'
                                  : 'Preview'}
                          </span>
                        </button>
                        {!canPreview && (
                          <span className="text-[9px] text-center text-zinc-400 font-mono leading-tight max-w-[5.5rem]">
                            Preview unavailable
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
