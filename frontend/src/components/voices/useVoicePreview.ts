import { useCallback, useEffect, useRef, useState } from 'react';
import type { LibraryVoice } from '../../types';

export type PreviewState = 'idle' | 'loading' | 'playing' | 'paused';

/**
 * Single shared HTMLAudioElement for voice sample previews.
 * Stops any previous preview when starting a new one.
 */
export function useVoicePreview() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [state, setState] = useState<PreviewState>('idle');

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audioRef.current = null;
    }
    setActiveId(null);
    setState('idle');
  }, []);

  useEffect(() => () => stop(), [stop]);

  const toggle = useCallback(
    async (voice: LibraryVoice) => {
      if (!voice.previewUrl) return;

      // Same voice: pause / resume
      if (activeId === voice.id && audioRef.current) {
        const audio = audioRef.current;
        if (!audio.paused) {
          audio.pause();
          setState('paused');
          return;
        }
        try {
          setState('loading');
          await audio.play();
          setState('playing');
        } catch {
          stop();
        }
        return;
      }

      // Different voice (or first play): stop previous, load new
      stop();
      setActiveId(voice.id);
      setState('loading');

      const audio = new Audio();
      audioRef.current = audio;
      audio.preload = 'auto';

      const onEnded = () => {
        setActiveId(null);
        setState('idle');
        audioRef.current = null;
      };
      const onError = () => {
        stop();
      };

      audio.addEventListener('ended', onEnded);
      audio.addEventListener('error', onError);
      audio.src = voice.previewUrl;

      try {
        await audio.play();
        if (audioRef.current === audio) setState('playing');
      } catch {
        stop();
      }
    },
    [activeId, stop]
  );

  const isLoading = (id: string) => activeId === id && state === 'loading';
  const isPlaying = (id: string) => activeId === id && state === 'playing';
  const isPaused = (id: string) => activeId === id && state === 'paused';

  return { toggle, stop, activeId, state, isLoading, isPlaying, isPaused };
}
