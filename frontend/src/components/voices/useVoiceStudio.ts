// useVoiceStudio — search/filter state + recently-used + client-side AI recommendation engine
// for the Voice Studio. Pure recommendation logic is exported for unit testing.
import { useMemo, useState } from 'react';
import type { LibraryVoice } from '../../types';
import { languageDisplayName } from '../../constants/voices';
import { targetLanguages } from '../../constants/data';

export type VoiceGenderFilter = 'all' | 'Male' | 'Female' | 'Neutral';

export type VoiceStudioSection = 'all' | 'favorites' | 'recent' | 'recommended';

export interface VoiceStudioConfig {
  voices: LibraryVoice[];
  favoriteIds: string[];
  defaultVoiceId: string | null;
  recentlyUsedIds: string[];
  /** Optional target translation language code used to boost recommendations. */
  targetLanguage?: string;
}

export interface RecommendedVoice {
  voice: LibraryVoice;
  score: number;
  reasons: string[];
}

const RECOMMENDATION_MIN_SCORE = 1;
const RECOMMENDATION_DEFAULT_LIMIT = 4;

/**
 * Deterministic, client-side recommendation scoring. Higher is better.
 * Signal sources: target-language support, current selection, favorites,
 * recency, studio defaults, multilingual versatility, gender neutrality.
 * No backend or ElevenLabs integration is touched.
 */
export function recommendVoices(config: VoiceStudioConfig, limit = RECOMMENDATION_DEFAULT_LIMIT): RecommendedVoice[] {
  const { voices, favoriteIds, defaultVoiceId, recentlyUsedIds, targetLanguage } = config;
  const recentSet = new Set(recentlyUsedIds);

  const scored = voices.map((voice) => {
    let score = 0;
    const reasons: string[] = [];

    if (targetLanguage) {
      if (voice.language === targetLanguage) {
        score += 3;
        reasons.push(`Native ${languageDisplayName(targetLanguage)}`);
      } else if (voice.supportedLanguages.includes(targetLanguage)) {
        score += 2.5;
        reasons.push(`Speaks ${languageDisplayName(targetLanguage)}`);
      }
    }

    if (voice.id === defaultVoiceId) {
      score += 2;
      reasons.push('Current selection');
    }
    if (favoriteIds.includes(voice.id)) {
      score += 2;
      reasons.push('In favorites');
    }
    if (recentSet.has(voice.id)) {
      score += 1;
      reasons.push('Recently used');
    }
    if (voice.tags?.includes('default')) {
      score += 1.5;
      reasons.push('Studio favorite');
    }
    if (voice.tags?.includes('multilingual')) {
      score += 1.5;
      reasons.push('Multilingual');
    }
    if (voice.gender === 'Neutral') {
      score += 0.5;
    }
    // Versatility tiebreak: voices covering more languages rank higher.
    score += Math.min(voice.supportedLanguages.length, 10) / 10;

    return { voice, score, reasons };
  });

  return scored
    .filter((s) => s.score >= RECOMMENDATION_MIN_SCORE)
    .sort((a, b) => b.score - a.score || a.voice.name.localeCompare(b.voice.name))
    .slice(0, limit)
    .map(({ voice, score, reasons }) => ({ voice, score, reasons }));
}

export function useVoiceStudio(config: VoiceStudioConfig) {
  const { voices, favoriteIds, defaultVoiceId, recentlyUsedIds, targetLanguage } = config;

  const [searchQuery, setSearchQuery] = useState('');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState<VoiceGenderFilter>('all');
  const [accentFilter, setAccentFilter] = useState('all');
  const [styleFilter, setStyleFilter] = useState('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [section, setSection] = useState<VoiceStudioSection>('all');

  const languages = useMemo(() => {
    const codes = Array.from(
      new Set(voices.flatMap((v) => [v.language, ...v.supportedLanguages]))
    );
    const known = targetLanguages.filter((l) => codes.includes(l.code));
    const unknown = codes
      .filter((c) => !targetLanguages.some((l) => l.code === c))
      .sort()
      .map((c) => ({ code: c, name: languageDisplayName(c) }));
    return [...known, ...unknown].sort((a, b) => a.name.localeCompare(b.name));
  }, [voices]);

  const accents = useMemo(() => {
    const set = new Set(voices.map((v) => v.accent).filter(Boolean));
    return Array.from(set).sort();
  }, [voices]);

  const styles = useMemo(() => {
    const set = new Set(voices.flatMap((v) => v.tags ?? []));
    return Array.from(set).sort();
  }, [voices]);

  const filteredVoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return voices.filter((v) => {
      if (favoritesOnly && !favoriteIds.includes(v.id)) return false;
      if (genderFilter !== 'all' && v.gender !== genderFilter) return false;
      if (accentFilter !== 'all' && v.accent !== accentFilter) return false;
      if (styleFilter !== 'all' && !(v.tags ?? []).includes(styleFilter)) return false;
      if (
        languageFilter !== 'all' &&
        v.language !== languageFilter &&
        !v.supportedLanguages.includes(languageFilter)
      ) {
        return false;
      }
      if (!q) return true;
      const hay = [
        v.name,
        v.provider,
        v.gender,
        v.accent,
        v.category,
        languageDisplayName(v.language),
        ...(v.supportedLanguages ?? []).map(languageDisplayName),
        ...(v.supportedLanguages ?? []).map((c) => c.toUpperCase()),
        v.description || '',
        ...(v.tags ?? []),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [
    voices,
    favoriteIds,
    searchQuery,
    languageFilter,
    genderFilter,
    accentFilter,
    styleFilter,
    favoritesOnly,
  ]);

  const favoriteVoices = useMemo(
    () => voices.filter((v) => favoriteIds.includes(v.id)),
    [voices, favoriteIds]
  );

  const recentlyUsedVoices = useMemo(
    () =>
      recentlyUsedIds
        .map((id) => voices.find((v) => v.id === id))
        .filter((v): v is LibraryVoice => Boolean(v)),
    [voices, recentlyUsedIds]
  );

  const recommended = useMemo(
    () =>
      recommendVoices({
        voices,
        favoriteIds,
        defaultVoiceId,
        recentlyUsedIds,
        targetLanguage,
      }),
    [voices, favoriteIds, defaultVoiceId, recentlyUsedIds, targetLanguage]
  );

  const hasActiveFilters =
    favoritesOnly ||
    languageFilter !== 'all' ||
    genderFilter !== 'all' ||
    accentFilter !== 'all' ||
    styleFilter !== 'all' ||
    searchQuery.trim().length > 0;

  const resetFilters = () => {
    setSearchQuery('');
    setLanguageFilter('all');
    setGenderFilter('all');
    setAccentFilter('all');
    setStyleFilter('all');
    setFavoritesOnly(false);
  };

  return {
    searchQuery,
    setSearchQuery,
    languageFilter,
    setLanguageFilter,
    genderFilter,
    setGenderFilter,
    accentFilter,
    setAccentFilter,
    styleFilter,
    setStyleFilter,
    favoritesOnly,
    setFavoritesOnly,
    section,
    setSection,
    languages,
    accents,
    styles,
    filteredVoices,
    favoriteVoices,
    recentlyUsedVoices,
    recommended,
    hasActiveFilters,
    resetFilters,
  };
}

export type VoiceStudioState = ReturnType<typeof useVoiceStudio>;
