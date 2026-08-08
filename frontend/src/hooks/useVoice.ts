// useVoice — voice engine selection, per-project voice settings, voice library prefs.
import { useState, useEffect } from 'react';
import { VOICE_LIBRARY_STORAGE_KEY, voiceLibraryCatalog } from '../constants/voices';
import { libraryVoiceToSettings } from '../components/voices/VoiceLibrary';
import type { LibraryVoice, TTSVoiceEngine, VoiceSettings } from '../types';

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  gender: 'Male',
  speed: 1.0,
  pitch: 1.0,
  emotion: 'Professional',
  energy: 1.0,
  pauseControl: 0.25,
  voiceName: 'George',
};

/** How many recently-used voice ids to remember in the studio. */
const RECENT_VOICES_LIMIT = 8;

export function useVoice() {
  const [activeEngine, setActiveEngine] = useState<TTSVoiceEngine>('ElevenLabs');
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [favoriteVoiceIds, setFavoriteVoiceIds] = useState<string[]>([]);
  const [defaultVoiceId, setDefaultVoiceId] = useState<string | null>('el-george');
  const [recentlyUsedVoiceIds, setRecentlyUsedVoiceIds] = useState<string[]>([]);

  // Load saved voice library preferences (favorites + default voice)
  useEffect(() => {
    const savedVoicePrefs = localStorage.getItem(VOICE_LIBRARY_STORAGE_KEY);
    if (savedVoicePrefs) {
      try {
        const parsed = JSON.parse(savedVoicePrefs);
        if (Array.isArray(parsed.favoriteIds)) {
          setFavoriteVoiceIds(parsed.favoriteIds);
        }
        if (parsed.defaultVoiceId) {
          setDefaultVoiceId(parsed.defaultVoiceId);
          const voice = voiceLibraryCatalog.find((v) => v.id === parsed.defaultVoiceId);
          if (voice) {
            setVoiceSettings((prev) => libraryVoiceToSettings(voice, prev));
          }
        }
        if (Array.isArray(parsed.recentlyUsedVoiceIds)) {
          setRecentlyUsedVoiceIds(parsed.recentlyUsedVoiceIds);
        }
      } catch (e) {
        console.error('Failed to parse voice library prefs:', e);
      }
    }
  }, []);

  const persistVoiceLibraryPrefs = (
    favorites: string[],
    defaultId: string | null,
    recent: string[]
  ) => {
    localStorage.setItem(
      VOICE_LIBRARY_STORAGE_KEY,
      JSON.stringify({
        favoriteIds: favorites,
        defaultVoiceId: defaultId,
        recentlyUsedVoiceIds: recent,
      })
    );
  };

  const handleToggleFavoriteVoice = (voiceId: string) => {
    setFavoriteVoiceIds((prev) => {
      const next = prev.includes(voiceId)
        ? prev.filter((id) => id !== voiceId)
        : [...prev, voiceId];
      persistVoiceLibraryPrefs(next, defaultVoiceId, recentlyUsedVoiceIds);
      return next;
    });
  };

  const handleRecordVoiceUsed = (voiceId: string) => {
    setRecentlyUsedVoiceIds((prev) => {
      const next = [voiceId, ...prev.filter((id) => id !== voiceId)].slice(
        0,
        RECENT_VOICES_LIMIT
      );
      persistVoiceLibraryPrefs(favoriteVoiceIds, defaultVoiceId, next);
      return next;
    });
  };

  const handleClearRecentlyUsed = () => {
    setRecentlyUsedVoiceIds([]);
    persistVoiceLibraryPrefs(favoriteVoiceIds, defaultVoiceId, []);
  };

  const handleSetDefaultVoice = (voice: LibraryVoice) => {
    setDefaultVoiceId(voice.id);
    setVoiceSettings((prev) => libraryVoiceToSettings(voice, prev));
    setActiveEngine('ElevenLabs');
    // Persist with the NEW default so a reload right after selecting keeps it.
    setRecentlyUsedVoiceIds((prev) => {
      const next = [voice.id, ...prev.filter((id) => id !== voice.id)].slice(
        0,
        RECENT_VOICES_LIMIT
      );
      persistVoiceLibraryPrefs(favoriteVoiceIds, voice.id, next);
      return next;
    });
  };

  return {
    activeEngine,
    setActiveEngine,
    voiceSettings,
    setVoiceSettings,
    favoriteVoiceIds,
    setFavoriteVoiceIds,
    defaultVoiceId,
    setDefaultVoiceId,
    recentlyUsedVoiceIds,
    setRecentlyUsedVoiceIds,
    handleToggleFavoriteVoice,
    handleSetDefaultVoice,
    handleRecordVoiceUsed,
    handleClearRecentlyUsed,
  };
}

export type VoiceState = ReturnType<typeof useVoice>;
