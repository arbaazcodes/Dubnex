import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVoiceStudio, recommendVoices } from './useVoiceStudio';
import type { LibraryVoice } from '../../types';

const voices: LibraryVoice[] = [
  {
    id: 'v1',
    name: 'Aria',
    provider: 'Coqui TTS',
    gender: 'Female',
    accent: 'American',
    language: 'en',
    category: 'Narration',
    supportedLanguages: ['en', 'es'],
    tags: ['clear'],
    previewUrl: 'https://example.com/aria.mp3',
    source: 'local',
  },
  {
    id: 'v2',
    name: 'Bunty',
    provider: 'Coqui TTS',
    gender: 'Male',
    accent: 'Indian English',
    language: 'hi',
    category: 'Conversational',
    supportedLanguages: ['hi', 'en'],
    tags: ['friendly'],
    previewUrl: 'https://example.com/bunty.mp3',
    source: 'local',
  },
  {
    id: 'v3',
    name: 'Jessica',
    provider: 'Coqui TTS',
    gender: 'Female',
    accent: 'American',
    language: 'en',
    category: 'Corporate',
    supportedLanguages: ['en'],
    tags: ['professional'],
    previewUrl: null,
    source: 'local',
  },
  {
    id: 'v4',
    name: 'Marcus',
    provider: 'Coqui TTS',
    gender: 'Neutral',
    accent: 'Australian',
    language: 'en',
    category: 'Broadcast',
    supportedLanguages: ['en', 'fr', 'de', 'ja'],
    tags: ['broadcast'],
    previewUrl: 'https://example.com/marcus.mp3',
    source: 'local',
  },
];

function makeConfig(overrides: Partial<Parameters<typeof useVoiceStudio>[0]> = {}) {
  return {
    voices,
    favoriteIds: [],
    defaultVoiceId: null,
    recentlyUsedIds: [],
    targetLanguage: undefined,
    ...overrides,
  };
}

describe('recommendVoices', () => {
  it('boosts voices that natively speak the target language', () => {
    const recs = recommendVoices(makeConfig({ targetLanguage: 'hi' }));
    expect(recs[0].voice.id).toBe('v2');
    expect(recs[0].reasons.some((r) => r.includes('Hindi'))).toBe(true);
  });

  it('includes favorited voices regardless of language', () => {
    const recs = recommendVoices(makeConfig({ favoriteIds: ['v4'], targetLanguage: 'es' }));
    expect(recs.map((r) => r.voice.id)).toContain('v4');
  });

  it('ranks the current default voice highly', () => {
    const recs = recommendVoices(makeConfig({ defaultVoiceId: 'v3' }));
    expect(recs[0].voice.id).toBe('v3');
    expect(recs[0].reasons).toContain('Current selection');
  });

  it('respects the limit', () => {
    const recs = recommendVoices(makeConfig({ favoriteIds: ['v1', 'v2'], targetLanguage: 'es' }), 2);
    expect(recs.length).toBeLessThanOrEqual(2);
  });

  it('returns an empty list when no voice clears the minimum score', () => {
    expect(recommendVoices(makeConfig())).toEqual([]);
  });
});

describe('useVoiceStudio', () => {
  it('filters by search query', () => {
    const { result } = renderHook(() => useVoiceStudio(makeConfig()));
    act(() => result.current.setSearchQuery('bunty'));
    expect(result.current.filteredVoices.map((v) => v.id)).toEqual(['v2']);
  });

  it('searches across language display names and codes', () => {
    const { result } = renderHook(() => useVoiceStudio(makeConfig()));
    act(() => result.current.setSearchQuery('spanish'));
    expect(result.current.filteredVoices.map((v) => v.id)).toEqual(['v1']);
  });

  it('filters by language (primary or supported)', () => {
    const { result } = renderHook(() => useVoiceStudio(makeConfig()));
    act(() => result.current.setLanguageFilter('es'));
    expect(result.current.filteredVoices.map((v) => v.id)).toEqual(['v1']);
  });

  it('filters by gender', () => {
    const { result } = renderHook(() => useVoiceStudio(makeConfig()));
    act(() => result.current.setGenderFilter('Female'));
    expect(result.current.filteredVoices.map((v) => v.id).sort()).toEqual(['v1', 'v3']);
  });

  it('filters by accent', () => {
    const { result } = renderHook(() => useVoiceStudio(makeConfig()));
    act(() => result.current.setAccentFilter('American'));
    expect(result.current.filteredVoices.map((v) => v.id).sort()).toEqual(['v1', 'v3']);
  });

  it('filters by style/tag', () => {
    const { result } = renderHook(() => useVoiceStudio(makeConfig()));
    act(() => result.current.setStyleFilter('professional'));
    expect(result.current.filteredVoices.map((v) => v.id)).toEqual(['v3']);
  });

  it('combines a favorites-only toggle with other filters', () => {
    const { result } = renderHook(() => useVoiceStudio(makeConfig({ favoriteIds: ['v2', 'v3'] })));
    act(() => result.current.setFavoritesOnly(true));
    act(() => result.current.setGenderFilter('Female'));
    expect(result.current.filteredVoices.map((v) => v.id)).toEqual(['v3']);
  });

  it('derives recently-used voices in recency order, dropping unknown ids', () => {
    const { result } = renderHook(() =>
      useVoiceStudio(makeConfig({ recentlyUsedIds: ['v4', 'v2', 'missing'] }))
    );
    expect(result.current.recentlyUsedVoices.map((v) => v.id)).toEqual(['v4', 'v2']);
  });

  it('exposes unique language/accent/style option lists', () => {
    const { result } = renderHook(() => useVoiceStudio(makeConfig()));
    expect(result.current.languages.map((l) => l.code)).toContain('es');
    expect(result.current.accents).toContain('American');
    expect(result.current.styles).toContain('professional');
  });

  it('tracks whether any filter is active and resets them', () => {
    const { result } = renderHook(() => useVoiceStudio(makeConfig()));
    expect(result.current.hasActiveFilters).toBe(false);
    act(() => result.current.setSearchQuery('x'));
    expect(result.current.hasActiveFilters).toBe(true);
    act(() => result.current.resetFilters());
    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.filteredVoices.length).toBe(voices.length);
  });
});
