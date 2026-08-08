import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VoiceSelector from './VoiceSelector';
import type { LibraryVoice } from '../../types';
import { resolveApiVoiceKey } from '../../constants/voices';

const voices: LibraryVoice[] = [
  {
    id: 'coqui-default',
    name: 'Default (XTTS v2 Built-in)',
    provider: 'Coqui TTS',
    gender: 'Neutral',
    accent: 'Multilingual',
    language: 'en',
    category: 'Default',
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'tr', 'ru', 'nl', 'cs', 'ar', 'zh', 'ja', 'hu', 'ko', 'hi'],
    tags: ['multilingual', 'default', 'free', 'local'],
    previewUrl: null,
    apiVoiceKey: 'default',
    source: 'local',
  },
  {
    id: 'coqui-cloned',
    name: 'Custom Voice Clone',
    provider: 'Coqui TTS',
    gender: 'Custom',
    accent: 'Custom',
    language: 'en',
    category: 'Voice Cloning',
    supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'tr', 'ru', 'nl', 'cs', 'ar', 'zh', 'ja', 'hu', 'ko', 'hi'],
    tags: ['voice-cloning', 'custom', 'free', 'local'],
    previewUrl: 'https://example.com/cloned-preview.mp3',
    apiVoiceKey: 'cloned',
    source: 'cloned',
  },
  {
    // Non-local provider voice with no static sample — genuinely not previewable.
    id: 'external-custom',
    name: 'Remote Custom Voice',
    provider: 'Custom',
    gender: 'Male',
    accent: 'American',
    language: 'en',
    category: 'Narration',
    supportedLanguages: ['en'],
    tags: ['custom'],
    previewUrl: null,
    source: 'cloned',
  },
];

describe('VoiceSelector', () => {
  let playMock: ReturnType<typeof vi.fn>;
  let pauseMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    playMock = vi.fn().mockResolvedValue(undefined);
    pauseMock = vi.fn();
    vi.stubGlobal(
      'Audio',
      vi.fn().mockImplementation(function MockAudio(this: any) {
        this.paused = true;
        this.play = playMock.mockImplementation(async () => {
          this.paused = false;
        });
        this.pause = pauseMock.mockImplementation(() => {
          this.paused = true;
        });
        this.load = vi.fn();
        this.addEventListener = vi.fn();
        this.removeAttribute = vi.fn();
        this.preload = '';
        this.src = '';
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('searches by name, accent, language, and category', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <VoiceSelector voices={voices} selectedId="coqui-default" onSelect={onSelect} />
    );

    await user.click(screen.getByRole('button', { name: /Project Voice/i }));
    const search = screen.getByRole('searchbox', { name: /Search voices/i });

    await user.clear(search);
    await user.type(search, 'voice cloning');
    expect(screen.getByRole('option', { name: /Custom Voice Clone/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Default/i })).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'multilingual');
    expect(screen.getByRole('option', { name: /Default/i })).toBeInTheDocument();
  });

  it('selects a voice, highlights, closes, and preserves api key mapping', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <VoiceSelector voices={voices} selectedId="coqui-default" onSelect={onSelect} />
    );

    await user.click(screen.getByRole('button', { name: /Project Voice/i }));
    await user.click(screen.getByRole('option', { name: /Custom Voice Clone/i }));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'coqui-cloned', apiVoiceKey: 'cloned' })
    );
    expect(resolveApiVoiceKey('coqui-cloned')).toBe('cloned');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('disables preview when unavailable and plays when available', async () => {
    const user = userEvent.setup();
    render(
      <VoiceSelector voices={voices} selectedId="coqui-default" onSelect={vi.fn()} />
    );

    await user.click(screen.getByRole('button', { name: /Project Voice/i }));

    const defaultVoice = screen.getByRole('option', { name: /Default/i });
    expect(within(defaultVoice).getByText(/Preview unavailable/i)).toBeInTheDocument();
    expect(within(defaultVoice).getByRole('button', { name: /Preview unavailable/i })).toBeDisabled();

    const cloned = screen.getByRole('option', { name: /Custom Voice Clone/i });
    const previewBtn = within(cloned).getByRole('button', { name: /Preview Custom Voice Clone/i });
    expect(previewBtn).toBeEnabled();
    await user.click(previewBtn);
    expect(playMock).toHaveBeenCalled();
  });

  it('supports keyboard navigation and Enter to select', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <VoiceSelector voices={voices} selectedId="coqui-default" onSelect={onSelect} />
    );

    await user.click(screen.getByRole('button', { name: /Project Voice/i }));
    const search = screen.getByRole('searchbox', { name: /Search voices/i });
    search.focus();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalled();
  });
});
