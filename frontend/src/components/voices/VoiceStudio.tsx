// VoiceStudio — premium voice selection experience.
// Replaces the legacy dropdown/VoiceLibrary with a world-class studio:
// search, language/gender/accent/style filters, favorites, recently-used,
// AI recommendations, audio preview (stop-previous), loading/error states,
// full keyboard navigation, Motion.dev animation and shadcn primitives.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowLeft,
  Check,
  Heart,
  History,
  Loader2,
  Mic2,
  Pause,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Volume2,
  X,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { useVoicePreview } from './useVoicePreview';
import { useVoiceStudio, type VoiceGenderFilter } from './useVoiceStudio';
import { voiceLibraryCatalog, languageDisplayName } from '../../constants/voices';
import type { LibraryVoice } from '../../types';

export interface VoiceStudioProps {
  favoriteIds: string[];
  defaultVoiceId: string | null;
  recentlyUsedIds: string[];
  /** Optional target translation language code — boosts AI recommendations. */
  targetLanguage?: string;
  onToggleFavorite: (voiceId: string) => void;
  onSelectDefault: (voice: LibraryVoice) => void;
  /** Renders a back affordance (full-page usage, not the picker dialog). */
  onBackToStudio?: () => void;
  /** Static catalog override. Defaults to the bundled ElevenLabs catalog. */
  voices?: LibraryVoice[];
  /**
   * Optional async voice source. When provided the studio renders real
   * loading skeletons and an error/retry state. Defaults to the static
   * catalog (no network) so existing behavior is preserved.
   */
  loadVoices?: () => Promise<LibraryVoice[]>;
}

const GRID_COLS = 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3';

function voiceInitials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** Compact horizontal-rail item for Recently Used / AI Recommended. */
function VoiceMiniCard({
  voice,
  isDefault,
  isPlaying,
  badge,
  onSelect,
  onPreview,
}: {
  voice: LibraryVoice;
  isDefault: boolean;
  isPlaying: boolean;
  badge?: string;
  onSelect: () => void;
  onPreview: () => void;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="group flex items-center gap-2.5 rounded-xl border border-border/70 bg-card px-3 py-2.5 pr-2 min-w-0 w-[230px] shrink-0 transition-colors hover:border-emerald-500/50"
    >
      <button
        type="button"
        onClick={onSelect}
        title={isDefault ? `${voice.name} — currently selected` : `Use ${voice.name}`}
        className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 rounded-lg"
      >
        <span className="w-8 h-8 shrink-0 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[9px] font-mono font-bold text-emerald-500">
          {voiceInitials(voice.name)}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-xs font-bold text-foreground truncate">
            {voice.name}
            {isDefault && <Check className="w-3 h-3 text-emerald-500 shrink-0" aria-label="Selected" />}
            {badge && (
              <Sparkles className="w-3 h-3 text-amber-500 shrink-0" aria-label={badge} />
            )}
          </span>
          <span className="block text-[10px] text-muted-foreground truncate">
            {voice.gender} · {voice.accent} · {languageDisplayName(voice.language)}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onPreview}
        title={isPlaying ? 'Pause preview' : `Preview ${voice.name}`}
        aria-label={isPlaying ? `Pause ${voice.name} preview` : `Preview ${voice.name}`}
        className="shrink-0 ml-auto w-8 h-8 rounded-lg border border-border/70 bg-muted/40 hover:bg-emerald-500/10 hover:border-emerald-500/40 flex items-center justify-center text-muted-foreground hover:text-emerald-500 transition-colors cursor-pointer"
      >
        {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
      </button>
    </motion.div>
  );
}

/** Rich grid card with every required field plus preview + favorite actions. */
function VoiceCard({
  voice,
  index,
  isFavorite,
  isDefault,
  isPreviewing,
  isPreviewLoading,
  isPreviewPaused,
  canPreview,
  cardRef,
  tabIndex,
  onFocus,
  onToggleFavorite,
  onSelectDefault,
  onTogglePreview,
}: {
  voice: LibraryVoice;
  index: number;
  isFavorite: boolean;
  isDefault: boolean;
  isPreviewing: boolean;
  isPreviewLoading: boolean;
  isPreviewPaused: boolean;
  canPreview: boolean;
  cardRef: (el: HTMLElement | null) => void;
  tabIndex: number;
  onFocus: () => void;
  onToggleFavorite: () => void;
  onSelectDefault: () => void;
  onTogglePreview: () => void;
}) {
  const reduced = useReducedMotion();
  const previewLabel = !canPreview
    ? 'Preview unavailable'
    : isPreviewLoading
      ? 'Loading preview…'
      : isPreviewing
        ? isPreviewPaused
          ? 'Resume preview'
          : 'Pause preview'
        : `Preview ${voice.name}`;

  return (
    <motion.article
      ref={cardRef}
      data-voice-index={index}
      tabIndex={tabIndex}
      onFocus={onFocus}
      role="group"
      aria-label={`${voice.name} — ${voice.gender}, ${voice.accent} accent, ${languageDisplayName(voice.language)}, ${voice.category}, ${voice.provider}`}
      className={`group flex flex-col gap-3 rounded-2xl border p-4 bg-card transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
        isDefault
          ? 'border-emerald-500/40 ring-1 ring-emerald-500/20'
          : 'border-border/70 hover:border-zinc-300 dark:hover:border-zinc-700'
      }`}
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? undefined : { opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.16, delay: Math.min(index * 0.03, 0.35) }}
    >
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 shrink-0 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[11px] font-mono font-extrabold text-emerald-500">
          {voiceInitials(voice.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20">
              {voice.provider}
            </Badge>
            <Badge variant="secondary" className="bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20">
              {voice.category}
            </Badge>
            {isDefault && (
              <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25">
                Default
              </Badge>
            )}
          </div>
          <h3 className="text-sm font-bold text-foreground truncate mt-1">{voice.name}</h3>
          <p className="text-[11px] text-muted-foreground truncate">
            {voice.gender} · {voice.accent} accent · {languageDisplayName(voice.language)}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleFavorite}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          aria-pressed={isFavorite}
          aria-label={`${isFavorite ? 'Remove' : 'Add'} ${voice.name} ${isFavorite ? 'from' : 'to'} favorites`}
          className="shrink-0 w-8 h-8 rounded-lg border border-border/70 bg-muted/40 flex items-center justify-center transition-colors hover:border-amber-500/50 cursor-pointer"
        >
          <Star
            className={`w-4 h-4 transition-colors ${
              isFavorite ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground group-hover:text-amber-500'
            }`}
          />
        </button>
      </div>

      {voice.description && (
        <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
          {voice.description}
        </p>
      )}

      <div className="flex flex-wrap gap-1">
        {(voice.supportedLanguages ?? []).slice(0, 5).map((code) => (
          <span
            key={code}
            title={languageDisplayName(code)}
            className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted/60 border border-border/60 text-muted-foreground"
          >
            {code.toUpperCase()}
          </span>
        ))}
        {(voice.supportedLanguages ?? []).length > 5 && (
          <span className="text-[9px] font-mono text-muted-foreground px-1">
            +{(voice.supportedLanguages ?? []).length - 5}
          </span>
        )}
      </div>

      <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canPreview || isPreviewLoading}
          onClick={onTogglePreview}
          title={previewLabel}
          aria-label={previewLabel}
          className="text-[10px] font-mono uppercase tracking-wide"
        >
          {isPreviewLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
          ) : isPreviewing ? (
            <Pause className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          {!canPreview ? 'N/A' : isPreviewLoading ? '…' : isPreviewing ? (isPreviewPaused ? 'Resume' : 'Pause') : 'Preview'}
        </Button>
        <Button
          type="button"
          variant={isDefault ? 'secondary' : 'default'}
          size="sm"
          disabled={isDefault}
          onClick={onSelectDefault}
          className="text-[10px] font-mono uppercase tracking-wide"
        >
          {isDefault ? <Check className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
          {isDefault ? 'Selected' : 'Use voice'}
        </Button>
      </div>
    </motion.article>
  );
}

function StudioSkeleton() {
  return (
    <div className={GRID_COLS} aria-busy="true" aria-label="Loading voices">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2.5 w-40" />
            </div>
          </div>
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-2.5 w-2/3" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-8 flex-1 rounded-xl" />
            <Skeleton className="h-8 flex-1 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function VoiceStudio({
  favoriteIds,
  defaultVoiceId,
  recentlyUsedIds,
  targetLanguage,
  onToggleFavorite,
  onSelectDefault,
  onBackToStudio,
  voices,
  loadVoices,
}: VoiceStudioProps) {
  const staticVoices = voices ?? voiceLibraryCatalog;

  // Async catalog source (optional) — powers genuine loading + error/retry states.
  const [catalog, setCatalog] = useState<LibraryVoice[] | null>(() =>
    loadVoices ? null : staticVoices
  );
  const [catalogLoading, setCatalogLoading] = useState(Boolean(loadVoices));
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const runLoad = useCallback(() => {
    if (!loadVoices) return;
    let cancelled = false;
    setCatalogLoading(true);
    setCatalogError(null);
    loadVoices()
      .then((list) => {
        if (!cancelled) setCatalog(Array.isArray(list) ? list : []);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCatalog([]);
          setCatalogError(
            err instanceof Error ? err.message : 'Failed to load the voice library.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadVoices]);

  useEffect(() => runLoad(), [runLoad]);

  const effectiveVoices = catalog ?? staticVoices;
  const studio = useVoiceStudio({
    voices: catalogLoading ? [] : effectiveVoices,
    favoriteIds,
    defaultVoiceId,
    recentlyUsedIds,
    targetLanguage,
  });

  const preview = useVoicePreview();

  // Roving keyboard focus over the main grid.
  const gridRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const [focusIndex, setFocusIndex] = useState(0);

  // Keep focus index valid when the filtered list shrinks.
  useEffect(() => {
    setFocusIndex((i) => Math.min(i, Math.max(0, studio.filteredVoices.length - 1)));
  }, [studio.filteredVoices.length]);

  const scrollCardIntoView = (i: number) => {
    cardRefs.current[i]?.scrollIntoView?.({ block: 'nearest' });
  };

  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    const n = studio.filteredVoices.length;
    if (n === 0) return;
    // Only treat Enter/Space/P/F as card-level commands when the card itself
    // (not a nested button, e.g. after Tab) is the event target.
    const fromCard = (e.target as HTMLElement | null)?.hasAttribute('data-voice-index');
    let next: number | null = null;
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        next = focusIndex + 1;
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        next = focusIndex - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = n - 1;
        break;
      case 'Enter':
      case ' ': {
        if (!fromCard) break;
        e.preventDefault();
        const v = studio.filteredVoices[focusIndex];
        if (v) onSelectDefault(v);
        return;
      }
      case 'p':
      case 'P': {
        if (!fromCard) break;
        e.preventDefault();
        const v = studio.filteredVoices[focusIndex];
        if (v) void preview.toggle(v);
        return;
      }
      case 'f':
      case 'F': {
        if (!fromCard) break;
        e.preventDefault();
        const v = studio.filteredVoices[focusIndex];
        if (v) onToggleFavorite(v.id);
        return;
      }
    }
    if (next !== null) {
      e.preventDefault();
      const clamped = Math.max(0, Math.min(n - 1, next));
      setFocusIndex(clamped);
      scrollCardIntoView(clamped);
      cardRefs.current[clamped]?.focus();
    }
  };

  const togglePreviewFor = (voice: LibraryVoice) => {
    void preview.toggle(voice);
  };

  const isLoading = catalogLoading;
  const loadError = catalogError;

  return (
    <div className="flex flex-col min-h-0 h-full" role="region" aria-label="Voice Studio">
      {/* Header — pr-10 keeps clear of the dialog close button when embedded */}
      <header className="flex items-center justify-between gap-3 px-5 pr-10 py-4 border-b border-border/70 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {onBackToStudio && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onBackToStudio}
              aria-label="Back to studio"
              className="shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold tracking-tight text-foreground flex items-center gap-2">
              <Mic2 className="w-5 h-5 text-emerald-500" />
              Voice Studio
            </h2>
            <p className="text-[11px] text-muted-foreground hidden sm:block truncate">
              Browse, preview and set the project voice. TTS generation unchanged.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {studio.hasActiveFilters && !isLoading && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={studio.resetFilters}
              className="text-[10px] font-mono uppercase tracking-wide"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </Button>
          )}
          {defaultVoiceId && (
            <Badge variant="secondary" className="hidden md:inline-flex gap-1">
              <Volume2 className="w-3 h-3 text-emerald-500" />
              {staticVoices.find((v) => v.id === defaultVoiceId)?.name ?? 'Voice set'}
            </Badge>
          )}
        </div>
      </header>

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5">
        {isLoading ? (
          <StudioSkeleton />
        ) : loadError ? (
          <div
            role="alert"
            className="flex flex-col sm:flex-row items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4"
          >
            <X className="w-5 h-5 text-rose-500 shrink-0" aria-hidden />
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <p className="text-sm font-bold text-foreground">Could not load voices</p>
              <p className="text-xs text-muted-foreground mt-0.5">{loadError}</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={runLoad} className="shrink-0">
              <RotateCcw className="w-3 h-3" />
              Retry
            </Button>
          </div>
        ) : (
          <>
            {preview.error && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2"
              >
                <span className="text-[11px] text-amber-600 dark:text-amber-400 flex-1">
                  {preview.error}
                </span>
                <button
                  type="button"
                  onClick={preview.clearError}
                  aria-label="Dismiss preview error"
                  className="text-amber-600 dark:text-amber-400 hover:opacity-70 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Recently Used rail */}
            {studio.recentlyUsedVoices.length > 0 && (
              <section aria-label="Recently used voices" className="space-y-2">
                <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-emerald-500" />
                  Recently Used
                </h3>
                <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
                  {studio.recentlyUsedVoices.map((voice) => (
                    <VoiceMiniCard
                      key={voice.id}
                      voice={voice}
                      isDefault={defaultVoiceId === voice.id}
                      isPlaying={preview.isPlaying(voice.id)}
                      onSelect={() => onSelectDefault(voice)}
                      onPreview={() => togglePreviewFor(voice)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* AI Recommended rail */}
            {studio.recommended.length > 0 && (
              <section aria-label="AI recommended voices" className="space-y-2">
                <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  AI Recommended
                  {targetLanguage && (
                    <span className="normal-case tracking-normal text-muted-foreground/80 font-mono text-[9px]">
                      · best fit for {languageDisplayName(targetLanguage)}
                    </span>
                  )}
                </h3>
                <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
                  {studio.recommended.map(({ voice, reasons }) => (
                    <VoiceMiniCard
                      key={voice.id}
                      voice={voice}
                      isDefault={defaultVoiceId === voice.id}
                      isPlaying={preview.isPlaying(voice.id)}
                      badge={reasons[0]}
                      onSelect={() => onSelectDefault(voice)}
                      onPreview={() => togglePreviewFor(voice)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Main section */}
            <section aria-label="All voices" className="space-y-3">
              <div className="flex flex-col gap-2.5">
                {/* Search + favorites toggle */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search
                      className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      type="search"
                      value={studio.searchQuery}
                      onChange={(e) => studio.setSearchQuery(e.target.value)}
                      placeholder="Search name, accent, language, category…"
                      aria-label="Search voices"
                      className="pl-9 h-8 text-xs"
                    />
                    {studio.searchQuery && (
                      <button
                        type="button"
                        onClick={() => studio.setSearchQuery('')}
                        aria-label="Clear search"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant={studio.favoritesOnly ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => studio.setFavoritesOnly((v) => !v)}
                    aria-pressed={studio.favoritesOnly}
                    className="justify-center sm:w-auto"
                  >
                    <Heart
                      className={`w-3.5 h-3.5 ${
                        studio.favoritesOnly ? 'fill-current text-amber-500' : ''
                      }`}
                    />
                    Favorites
                    <span className="text-[10px] opacity-70">
                      {studio.favoriteVoices.length}
                    </span>
                  </Button>
                </div>

                {/* Filter selects */}
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={studio.languageFilter} onValueChange={studio.setLanguageFilter}>
                    <SelectTrigger aria-label="Filter by language" className="h-8 text-[11px] font-mono">
                      <SelectValue placeholder="Language: All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Language: All</SelectItem>
                      {studio.languages.map((l) => (
                        <SelectItem key={l.code} value={l.code}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={studio.genderFilter} onValueChange={(v) => studio.setGenderFilter(v as VoiceGenderFilter)}>
                    <SelectTrigger aria-label="Filter by gender" className="h-8 text-[11px] font-mono">
                      <SelectValue placeholder="Gender: All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Gender: All</SelectItem>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Neutral">Neutral</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={studio.accentFilter} onValueChange={studio.setAccentFilter}>
                    <SelectTrigger aria-label="Filter by accent" className="h-8 text-[11px] font-mono">
                      <SelectValue placeholder="Accent: All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Accent: All</SelectItem>
                      {studio.accents.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={studio.styleFilter} onValueChange={studio.setStyleFilter}>
                    <SelectTrigger aria-label="Filter by style" className="h-8 text-[11px] font-mono">
                      <SelectValue placeholder="Style: All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Style: All</SelectItem>
                      {studio.styles.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <span className="text-[10px] font-mono text-muted-foreground ml-auto" aria-live="polite">
                    {studio.filteredVoices.length} voice
                    {studio.filteredVoices.length === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              {/* Grid */}
              {studio.filteredVoices.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center space-y-2">
                  <Mic2 className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                  <p className="text-sm font-semibold text-foreground">No voices match</p>
                  <p className="text-xs text-muted-foreground">
                    Try clearing search or filters.
                  </p>
                  {studio.hasActiveFilters && (
                    <Button type="button" variant="outline" size="sm" onClick={studio.resetFilters} className="mt-1">
                      <RotateCcw className="w-3 h-3" />
                      Clear filters
                    </Button>
                  )}
                </div>
              ) : (
                <div
                  ref={gridRef}
                  role="grid"
                  aria-label="Voice results — Arrow keys to navigate, Enter to select, P to preview, F to favorite"
                  onKeyDown={handleGridKeyDown}
                  className={GRID_COLS}
                >
                  <AnimatePresence initial={false}>
                    {studio.filteredVoices.map((voice, index) => {
                      const isFavorite = favoriteIds.includes(voice.id);
                      const isDefault = defaultVoiceId === voice.id;
                      const isPreviewing = preview.isPlaying(voice.id) || preview.isPaused(voice.id) || preview.isLoading(voice.id);
                      return (
                        <VoiceCard
                          key={voice.id}
                          voice={voice}
                          index={index}
                          isFavorite={isFavorite}
                          isDefault={isDefault}
                          isPreviewing={isPreviewing}
                          isPreviewLoading={preview.isLoading(voice.id)}
                          isPreviewPaused={preview.isPaused(voice.id)}
                          canPreview={Boolean(voice.previewUrl)}
                          cardRef={(el) => {
                            cardRefs.current[index] = el;
                          }}
                          tabIndex={index === focusIndex ? 0 : -1}
                          onFocus={() => setFocusIndex(index)}
                          onToggleFavorite={() => onToggleFavorite(voice.id)}
                          onSelectDefault={() => onSelectDefault(voice)}
                          onTogglePreview={() => togglePreviewFor(voice)}
                        />
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
