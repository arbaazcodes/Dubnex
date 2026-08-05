import React, { useMemo, useState } from 'react';
import {
  Search,
  Star,
  Volume2,
  Check,
  Mic2,
  Filter,
  Sparkles,
  Languages,
  Heart,
  Plus,
  Copy,
} from 'lucide-react';
import { LibraryVoice, VoiceSettings } from '../../types';
import { targetLanguages } from '../../constants/data';

interface VoiceLibraryProps {
  voices: LibraryVoice[];
  favoriteIds: string[];
  defaultVoiceId: string | null;
  onToggleFavorite: (voiceId: string) => void;
  onSetDefault: (voice: LibraryVoice) => void;
  onBackToStudio: () => void;
}

type GenderFilter = 'All' | 'Male' | 'Female' | 'Neutral';
type SourceFilter = 'All' | 'library' | 'custom' | 'clone';

function languageLabel(code: string) {
  const found = targetLanguages.find((l) => l.code === code);
  return found ? found.name : code.toUpperCase();
}

export default function VoiceLibrary({
  voices,
  favoriteIds,
  defaultVoiceId,
  onToggleFavorite,
  onSetDefault,
  onBackToStudio,
}: VoiceLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('All');
  const [accentFilter, setAccentFilter] = useState<string>('All');
  const [tagFilter, setTagFilter] = useState<string>('All');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('All');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [previewNotice, setPreviewNotice] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const accents = useMemo(() => {
    const set = new Set(voices.map((v) => v.accent).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [voices]);

  const tags = useMemo(() => {
    const set = new Set(voices.flatMap((v) => v.tags || []));
    return ['All', ...Array.from(set).sort()];
  }, [voices]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return voices.filter((v) => {
      if (favoritesOnly && !favoriteIds.includes(v.id)) return false;
      if (genderFilter !== 'All' && v.gender !== genderFilter) return false;
      if (accentFilter !== 'All' && v.accent !== accentFilter) return false;
      if (tagFilter !== 'All' && !(v.tags || []).includes(tagFilter)) return false;
      if (sourceFilter !== 'All' && v.source !== sourceFilter) return false;
      if (!q) return true;
      const hay = [
        v.name,
        v.provider,
        v.gender,
        v.accent,
        v.description || '',
        ...(v.tags || []),
        ...(v.supportedLanguages || []),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [
    voices,
    searchQuery,
    genderFilter,
    accentFilter,
    tagFilter,
    sourceFilter,
    favoritesOnly,
    favoriteIds,
  ]);

  const handlePreview = (voice: LibraryVoice) => {
    if (!voice.previewUrl) {
      setPreviewNotice(`Preview unavailable for “${voice.name}”.`);
      window.setTimeout(() => setPreviewNotice(null), 2800);
      return;
    }
    try {
      const audio = new Audio(voice.previewUrl);
      setPreviewingId(voice.id);
      audio.onended = () => setPreviewingId(null);
      audio.onerror = () => {
        setPreviewingId(null);
        setPreviewNotice(`Preview failed for ${voice.name}.`);
        window.setTimeout(() => setPreviewNotice(null), 3000);
      };
      void audio.play();
    } catch {
      setPreviewingId(null);
      setPreviewNotice(`Preview unavailable for “${voice.name}”.`);
      window.setTimeout(() => setPreviewNotice(null), 2800);
    }
  };

  return (
    <div className="space-y-6" id="voice-library-page">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
            <Mic2 className="w-6 h-6 text-emerald-500" />
            Voice Library
          </h1>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 max-w-xl">
            Browse ElevenLabs voices, favorite presets, and set the default project voice.
            Preview controls are disabled when no sample URL is configured. TTS generation is unchanged.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled
            title="Voice cloning arrives in a later sprint"
            className="px-3.5 py-2 rounded-xl text-[11px] font-mono font-bold uppercase tracking-wide bg-zinc-100 dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 cursor-not-allowed flex items-center gap-1.5"
          >
            <Copy className="w-3.5 h-3.5" />
            Clone Voice
          </button>
          <button
            type="button"
            disabled
            title="Custom voices arrive in a later sprint"
            className="px-3.5 py-2 rounded-xl text-[11px] font-mono font-bold uppercase tracking-wide bg-zinc-100 dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 cursor-not-allowed flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Custom Voice
          </button>
          <button
            type="button"
            onClick={onBackToStudio}
            className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl text-[11px] font-bold font-mono cursor-pointer"
          >
            Back to Studio
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200/50 dark:border-zinc-900 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex items-center bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 flex-1">
            <Search className="w-3.5 h-3.5 text-zinc-400 mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search name, accent, tags, language..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs text-zinc-800 dark:text-white w-full focus:outline-none placeholder-zinc-400"
            />
          </div>
          <button
            type="button"
            onClick={() => setFavoritesOnly((v) => !v)}
            className={`px-3.5 py-2 rounded-xl text-[11px] font-mono font-bold uppercase tracking-wide border flex items-center gap-1.5 cursor-pointer ${
              favoritesOnly
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-500 border-zinc-200 dark:border-zinc-800'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${favoritesOnly ? 'fill-current' : ''}`} />
            Favorites
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3" />
            Filter
          </span>
          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value as GenderFilter)}
            className="text-[10px] font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-700 dark:text-zinc-200 cursor-pointer"
          >
            <option value="All">Gender: All</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Neutral">Neutral</option>
          </select>
          <select
            value={accentFilter}
            onChange={(e) => setAccentFilter(e.target.value)}
            className="text-[10px] font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-700 dark:text-zinc-200 cursor-pointer"
          >
            {accents.map((a) => (
              <option key={a} value={a}>
                {a === 'All' ? 'Accent: All' : a}
              </option>
            ))}
          </select>
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="text-[10px] font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-700 dark:text-zinc-200 cursor-pointer"
          >
            {tags.map((t) => (
              <option key={t} value={t}>
                {t === 'All' ? 'Tag: All' : t}
              </option>
            ))}
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
            className="text-[10px] font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-700 dark:text-zinc-200 cursor-pointer"
          >
            <option value="All">Source: All</option>
            <option value="library">Library</option>
            <option value="custom">Custom</option>
            <option value="clone">Clone</option>
          </select>
          <span className="text-[10px] font-mono text-zinc-400 ml-auto">
            {filtered.length} voice{filtered.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {previewNotice && (
        <div className="text-[10px] font-mono px-3 py-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400">
          {previewNotice}
        </div>
      )}

      {defaultVoiceId && (
        <div className="text-[10px] font-mono text-zinc-500 flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5 text-emerald-500" />
          Default project voice:{' '}
          <span className="font-bold text-zinc-800 dark:text-zinc-200">
            {voices.find((v) => v.id === defaultVoiceId)?.name || defaultVoiceId}
          </span>
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200/50 dark:border-zinc-900 rounded-3xl p-12 text-center space-y-2">
          <Mic2 className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mx-auto" />
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No voices match</p>
          <p className="text-xs text-zinc-400">Try clearing search or filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((voice) => {
            const isFav = favoriteIds.includes(voice.id);
            const isDefault = defaultVoiceId === voice.id;
            const isPreviewing = previewingId === voice.id;

            return (
              <article
                key={voice.id}
                className={`bg-white dark:bg-zinc-900/40 border rounded-3xl p-4 flex flex-col gap-3 ${
                  isDefault
                    ? 'border-emerald-500/40 ring-1 ring-emerald-500/20'
                    : 'border-zinc-200/60 dark:border-zinc-900'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                        {voice.provider}
                      </span>
                      {voice.source !== 'library' && (
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                          {voice.source}
                        </span>
                      )}
                      {isDefault && (
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                          Default
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                      {voice.name}
                    </h3>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      {voice.gender} · {voice.accent} · {voice.category}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(voice.id)}
                    className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-amber-500/40 cursor-pointer"
                    title={isFav ? 'Remove favorite' : 'Add favorite'}
                  >
                    <Star
                      className={`w-4 h-4 ${
                        isFav
                          ? 'text-amber-500 fill-amber-500'
                          : 'text-zinc-400'
                      }`}
                    />
                  </button>
                </div>

                {voice.description && (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2">
                    {voice.description}
                  </p>
                )}

                <div className="space-y-1.5">
                  <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-400 font-bold flex items-center gap-1">
                    <Languages className="w-3 h-3" />
                    Languages
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {voice.supportedLanguages.slice(0, 6).map((code) => (
                      <span
                        key={code}
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300"
                        title={languageLabel(code)}
                      >
                        {code.toUpperCase()}
                      </span>
                    ))}
                    {voice.supportedLanguages.length > 6 && (
                      <span className="text-[9px] font-mono text-zinc-400 px-1">
                        +{voice.supportedLanguages.length - 6}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {(voice.tags || []).map((tag) => (
                    <span
                      key={tag}
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-950 text-zinc-500 border border-zinc-200/80 dark:border-zinc-800"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handlePreview(voice)}
                    disabled={!voice.previewUrl}
                    title={voice.previewUrl ? `Preview ${voice.name}` : 'Preview unavailable'}
                    className={`py-2 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 border ${
                      voice.previewUrl
                        ? 'bg-zinc-100 dark:bg-zinc-950 border-zinc-200/60 dark:border-zinc-800 hover:border-emerald-500/40 cursor-pointer'
                        : 'bg-zinc-100 dark:bg-zinc-950 border-zinc-200/40 dark:border-zinc-800 text-zinc-400 cursor-not-allowed'
                    }`}
                  >
                    <Volume2 className={`w-3.5 h-3.5 ${isPreviewing ? 'text-emerald-500 animate-pulse' : ''}`} />
                    {!voice.previewUrl
                      ? 'Unavailable'
                      : isPreviewing
                        ? 'Playing…'
                        : 'Preview'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetDefault(voice)}
                    disabled={isDefault}
                    className={`py-2 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 ${
                      isDefault
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 border border-emerald-500'
                    }`}
                  >
                    {isDefault ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Selected
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Use Default
                      </>
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Future model hooks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/30 px-4 py-4">
          <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Voice Clone</p>
          <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
            Data model supports <code className="font-mono text-[10px]">source: clone</code> and{' '}
            <code className="font-mono text-[10px]">cloneStatus</code>. Upload a short sample later to
            create a project-specific clone without changing the TTS pipeline today.
          </p>
          <span className="inline-block mt-2 text-[9px] font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
            Coming soon
          </span>
        </div>
        <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/30 px-4 py-4">
          <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Custom Voices</p>
          <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
            Custom entries use <code className="font-mono text-[10px]">provider: Custom</code> and{' '}
            <code className="font-mono text-[10px]">isCustom</code>. Ready for user-managed voices in
            a later sprint.
          </p>
          <span className="inline-block mt-2 text-[9px] font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
            Coming soon
          </span>
        </div>
      </div>
    </div>
  );
}

/** Map a library voice into existing VoiceSettings without touching TTS generation */
export function libraryVoiceToSettings(voice: LibraryVoice, previous?: VoiceSettings): VoiceSettings {
  return {
    gender: voice.gender,
    speed: previous?.speed ?? 1.0,
    pitch: previous?.pitch ?? 1.0,
    emotion: previous?.emotion ?? 'Professional',
    energy: previous?.energy ?? 1.0,
    pauseControl: previous?.pauseControl ?? 0.25,
    voiceName: voice.name,
  };
}
