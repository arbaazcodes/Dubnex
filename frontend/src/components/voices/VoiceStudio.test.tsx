import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VoiceStudio from './VoiceStudio';
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

const defaultProps: ComponentProps<typeof VoiceStudio> = {
  voices,
  favoriteIds: [],
  defaultVoiceId: null,
  recentlyUsedIds: [],
  targetLanguage: undefined,
  onToggleFavorite: vi.fn(),
  onSelectDefault: vi.fn(),
};

describe('VoiceStudio', () => {
  let instances: Array<Record<string, unknown>>;
  let playMock: ReturnType<typeof vi.fn>;
  let pauseMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    instances = [];
    playMock = vi.fn();
    pauseMock = vi.fn();
    // Reduced motion keeps Motion.dev entrance/exit animations out of jsdom,
    // so filtered-out cards are removed synchronously and assertions are stable.
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
        this.removeAttribute = vi.fn();
        this.addEventListener = vi.fn();
        this.removeEventListener = vi.fn();
        this.src = '';
        this.preload = '';
        instances.push(this);
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  function renderStudio(props: Partial<typeof defaultProps> = {}) {
    return render(<VoiceStudio {...defaultProps} {...props} />);
  }

  it('renders every voice card with name, gender, language, accent, category and provider', () => {
    renderStudio();
    const card = screen.getByRole('group', { name: /Aria/ });
    expect(card).toHaveTextContent('Aria');
    expect(card).toHaveTextContent('Female');
    expect(card).toHaveTextContent('English');
    expect(card).toHaveTextContent('American');
    expect(card).toHaveTextContent('Narration');
    expect(card).toHaveTextContent('Coqui TTS');
    expect(screen.getByRole('group', { name: /Bunty/ })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Jessica/ })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Marcus/ })).toBeInTheDocument();
  });

  it('searches voices by name', async () => {
    const user = userEvent.setup();
    renderStudio();
    await user.type(screen.getByRole('searchbox', { name: 'Search voices' }), 'bunty');
    expect(screen.getByRole('group', { name: /Bunty/ })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /Aria/ })).not.toBeInTheDocument();
  });

  it('shows an empty state and clear-filters action when nothing matches', async () => {
    const user = userEvent.setup();
    renderStudio();
    await user.type(screen.getByRole('searchbox', { name: 'Search voices' }), 'zzzz');
    expect(screen.getByText('No voices match')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Clear filters/i }));
    expect(screen.getByRole('group', { name: /Aria/ })).toBeInTheDocument();
  });

  it('filters to favorites only when the Favorites toggle is active', async () => {
    const user = userEvent.setup();
    renderStudio({ favoriteIds: ['v2'] });
    await user.click(screen.getByRole('button', { name: /Favorites/ }));
    expect(screen.getByRole('group', { name: /Bunty/ })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /Aria/ })).not.toBeInTheDocument();
  });

  it('shows a Recently Used rail with the most recent voices', () => {
    renderStudio({ recentlyUsedIds: ['v2', 'v3'] });
    expect(screen.getByRole('heading', { name: /Recently Used/ })).toBeInTheDocument();
    // Recently-used voices are also recommended, so they can appear in both rails.
    expect(screen.getAllByTitle('Use Bunty').length).toBeGreaterThan(0);
    expect(screen.getAllByTitle('Use Jessica').length).toBeGreaterThan(0);
  });

  it('shows an AI Recommended rail boosted for the target language', () => {
    renderStudio({ targetLanguage: 'hi', favoriteIds: ['v2'] });
    expect(screen.getByRole('heading', { name: /AI Recommended/ })).toBeInTheDocument();
    // Bunty is native Hindi and also favorited — must be recommended.
    expect(screen.getByTitle('Use Bunty')).toBeInTheDocument();
  });

  it('marks and disables the currently selected default voice', () => {
    renderStudio({ defaultVoiceId: 'v2' });
    const card = screen.getByRole('group', { name: /Bunty/ });
    expect(card).toHaveTextContent('Default');
    const selectBtn = within(card).getByRole('button', { name: 'Selected' });
    expect(selectBtn).toBeDisabled();
  });

  it('calls onSelectDefault when "Use voice" is pressed', async () => {
    const user = userEvent.setup();
    renderStudio();
    const card = screen.getByRole('group', { name: /Jessica/ });
    await user.click(within(card).getByRole('button', { name: 'Use voice' }));
    expect(defaultProps.onSelectDefault).toHaveBeenCalledWith(voices[2]);
  });

  it('toggles favorites and reflects the pressed state', async () => {
    const user = userEvent.setup();
    renderStudio();
    const card = screen.getByRole('group', { name: /Aria/ });
    const favBtn = within(card).getByRole('button', { name: /Add Aria to favorites/ });
    await user.click(favBtn);
    expect(defaultProps.onToggleFavorite).toHaveBeenCalledWith('v1');
  });

  describe('audio preview', () => {
    it('plays a voice sample', async () => {
      const user = userEvent.setup();
      renderStudio();
      await user.click(screen.getByRole('button', { name: 'Preview Bunty' }));
      await waitFor(() => expect(instances).toHaveLength(1));
      await waitFor(() => expect(playMock).toHaveBeenCalled());
    });

    it('pauses the previous voice when a new preview starts', async () => {
      const user = userEvent.setup();
      renderStudio();
      await user.click(screen.getByRole('button', { name: 'Preview Aria' }));
      await waitFor(() => expect(instances).toHaveLength(1));
      await user.click(screen.getByRole('button', { name: 'Preview Bunty' }));
      await waitFor(() => expect(instances).toHaveLength(2));
      // Stopping the previous preview pauses its audio element.
      expect(pauseMock).toHaveBeenCalled();
    });

    it('shows a preview-unavailable state for voices without a sample', () => {
      renderStudio();
      const card = screen.getByRole('group', { name: /Jessica/ });
      const previewBtn = within(card).getByRole('button', { name: 'Preview unavailable' });
      expect(previewBtn).toBeDisabled();
    });
  });

  describe('keyboard navigation', () => {
    function navigateTo(index: number) {
      const grid = screen.getByRole('grid');
      const first = grid.querySelector<HTMLElement>('[data-voice-index]') ?? grid;
      fireEvent.keyDown(first, { key: 'Home' });
      let current = document.activeElement as HTMLElement | null;
      for (let i = 0; i < index; i++) {
        fireEvent.keyDown(current ?? grid, { key: 'ArrowDown' });
        current = document.activeElement as HTMLElement | null;
      }
      return current;
    }

    it('moves focus with arrow keys and selects with Enter', () => {
      renderStudio();
      const card = navigateTo(1);
      fireEvent.keyDown(card ?? screen.getByRole('grid'), { key: 'Enter' });
      expect(defaultProps.onSelectDefault).toHaveBeenCalledWith(voices[1]);
    });

    it('previews with the P key', async () => {
      renderStudio();
      const card = navigateTo(1);
      fireEvent.keyDown(card ?? screen.getByRole('grid'), { key: 'p' });
      await waitFor(() => expect(instances).toHaveLength(1));
      await waitFor(() => expect(playMock).toHaveBeenCalled());
    });

    it('toggles favorites with the F key', () => {
      renderStudio();
      const card = navigateTo(1);
      fireEvent.keyDown(card ?? screen.getByRole('grid'), { key: 'f' });
      expect(defaultProps.onToggleFavorite).toHaveBeenCalledWith(voices[1].id);
    });

    it('selects the last voice with End', () => {
      renderStudio();
      const grid = screen.getByRole('grid');
      const first = grid.querySelector<HTMLElement>('[data-voice-index]');
      fireEvent.keyDown(first ?? grid, { key: 'End' });
      fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Enter' });
      expect(defaultProps.onSelectDefault).toHaveBeenCalledWith(voices[voices.length - 1]);
    });
  });

  describe('loading and error states', () => {
    it('renders skeletons while an async voice source is pending', async () => {
      const loadVoices = () =>
        new Promise<LibraryVoice[]>((resolve) =>
          window.setTimeout(() => resolve(voices), 60)
        );
      renderStudio({ loadVoices });
      expect(screen.getByLabelText('Loading voices')).toBeInTheDocument();
      expect(screen.queryByRole('group', { name: /Aria/ })).not.toBeInTheDocument();
      await screen.findByRole('group', { name: /Aria/ }, { timeout: 2000 });
      expect(screen.queryByLabelText('Loading voices')).not.toBeInTheDocument();
    });

    it('renders an error banner with retry when the voice source fails', async () => {
      const loadVoices = () => Promise.reject(new Error('backend exploded'));
      renderStudio({ loadVoices });
      expect(await screen.findByText('Could not load voices')).toBeInTheDocument();
      expect(screen.getByText('backend exploded')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument();
    });
  });
});
