import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VoiceStudioPicker from './VoiceStudioPicker';
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
    previewUrl: null,
    source: 'local',
  },
];

describe('VoiceStudioPicker', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'Audio',
      vi.fn().mockImplementation(function MockAudio(this: any) {
        this.paused = true;
        this.play = vi.fn(async () => {
          this.paused = false;
        });
        this.pause = vi.fn(() => {
          this.paused = true;
        });
        this.load = vi.fn();
        this.removeAttribute = vi.fn();
        this.addEventListener = vi.fn();
        this.removeEventListener = vi.fn();
      })
    );
    // Keep Motion.dev animations out of jsdom for deterministic assertions.
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('shows the selected voice summary in the trigger', () => {
    render(
      <VoiceStudioPicker
        voices={voices}
        selectedId="v1"
        favoriteIds={[]}
        onSelect={vi.fn()}
        onToggleFavorite={vi.fn()}
      />
    );
    expect(screen.getByText('Aria')).toBeInTheDocument();
    expect(screen.getByText(/Female · American · English · Narration/)).toBeInTheDocument();
  });

  it('opens the Voice Studio dialog from the trigger', async () => {
    const user = userEvent.setup();
    render(
      <VoiceStudioPicker
        voices={voices}
        selectedId={null}
        favoriteIds={[]}
        onSelect={vi.fn()}
        onToggleFavorite={vi.fn()}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Open Voice Studio' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getAllByRole('heading', { name: 'Voice Studio' }).length).toBeGreaterThan(0);
    expect(within(dialog).getByRole('group', { name: /Aria/ })).toBeInTheDocument();
  });

  it('selects a voice from the studio and closes the dialog', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <VoiceStudioPicker
        voices={voices}
        selectedId={null}
        favoriteIds={[]}
        onSelect={onSelect}
        onToggleFavorite={vi.fn()}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Open Voice Studio' }));
    const dialog = await screen.findByRole('dialog');
    const ariaCard = within(dialog).getByRole('group', { name: /Aria/ });
    await user.click(within(ariaCard).getByRole('button', { name: 'Use voice' }));
    expect(onSelect).toHaveBeenCalledWith(voices[0]);
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
  });

  it('previews the selected voice inline from the trigger', async () => {
    const user = userEvent.setup();
    render(
      <VoiceStudioPicker
        voices={voices}
        selectedId="v1"
        favoriteIds={[]}
        onSelect={vi.fn()}
        onToggleFavorite={vi.fn()}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Preview Aria' }));
    expect(screen.getByRole('button', { name: 'Pause preview' })).toBeInTheDocument();
  });
});
