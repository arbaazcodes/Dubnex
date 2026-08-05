import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VoiceSelector from './VoiceSelector';
import type { LibraryVoice } from '../../types';
import { resolveApiVoiceKey } from '../../constants/voices';

const voices: LibraryVoice[] = [
  {
    id: 'el-george',
    name: 'George',
    provider: 'ElevenLabs',
    gender: 'Male',
    accent: 'British',
    language: 'en',
    category: 'Narration',
    supportedLanguages: ['en', 'es'],
    tags: ['narrative'],
    previewUrl: null,
    apiVoiceKey: 'george',
    source: 'library',
  },
  {
    id: 'el-bunty',
    name: 'Bunty',
    provider: 'ElevenLabs',
    gender: 'Male',
    accent: 'Indian English',
    language: 'hi',
    category: 'Conversational',
    supportedLanguages: ['hi', 'en'],
    tags: ['conversational'],
    previewUrl: 'https://example.com/bunty-preview.mp3',
    apiVoiceKey: 'bunty',
    source: 'library',
  },
  {
    id: 'el-jessica',
    name: 'Jessica',
    provider: 'ElevenLabs',
    gender: 'Female',
    accent: 'American',
    language: 'en',
    category: 'Corporate',
    supportedLanguages: ['en'],
    tags: ['corporate'],
    previewUrl: null,
    apiVoiceKey: 'jessica',
    source: 'library',
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
      <VoiceSelector voices={voices} selectedId="el-george" onSelect={onSelect} />
    );

    await user.click(screen.getByRole('button', { name: /Project Voice/i }));
    const search = screen.getByRole('searchbox', { name: /Search voices/i });

    await user.clear(search);
    await user.type(search, 'conversational');
    expect(screen.getByRole('option', { name: /Bunty/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Jessica/i })).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'british');
    expect(screen.getByRole('option', { name: /George/i })).toBeInTheDocument();
  });

  it('selects a voice, highlights, closes, and preserves api key mapping', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <VoiceSelector voices={voices} selectedId="el-george" onSelect={onSelect} />
    );

    await user.click(screen.getByRole('button', { name: /Project Voice/i }));
    await user.click(screen.getByRole('option', { name: /Jessica/i }));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'el-jessica', apiVoiceKey: 'jessica' })
    );
    expect(resolveApiVoiceKey('el-jessica')).toBe('jessica');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('disables preview when unavailable and plays when available', async () => {
    const user = userEvent.setup();
    render(
      <VoiceSelector voices={voices} selectedId="el-george" onSelect={vi.fn()} />
    );

    await user.click(screen.getByRole('button', { name: /Project Voice/i }));

    const george = screen.getByRole('option', { name: /George/i });
    expect(within(george).getByText(/Preview unavailable/i)).toBeInTheDocument();
    expect(within(george).getByRole('button', { name: /Preview unavailable/i })).toBeDisabled();

    const bunty = screen.getByRole('option', { name: /Bunty/i });
    const previewBtn = within(bunty).getByRole('button', { name: /Preview Bunty/i });
    expect(previewBtn).toBeEnabled();
    await user.click(previewBtn);
    expect(playMock).toHaveBeenCalled();
  });

  it('supports keyboard navigation and Enter to select', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <VoiceSelector voices={voices} selectedId="el-george" onSelect={onSelect} />
    );

    await user.click(screen.getByRole('button', { name: /Project Voice/i }));
    const search = screen.getByRole('searchbox', { name: /Search voices/i });
    search.focus();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalled();
  });
});
