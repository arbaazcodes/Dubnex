import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TranscriptEditor from './TranscriptEditor';
import type { Project } from '../../types';

const baseProject: Project = {
  id: 'p1',
  title: 'Test',
  originalLanguage: 'en',
  targetLanguage: 'hi',
  status: 'Completed',
  progress: 100,
  size: '1 MB',
  duration: '00:10',
  createdAt: new Date().toISOString(),
  videoUrl: '',
  voiceSettings: {
    gender: 'Male',
    speed: 1,
    pitch: 1,
    emotion: 'Neutral',
    energy: 1,
    pauseControl: 0.3,
    voiceName: 'George',
  },
  transcript: [
    {
      id: 't1',
      start: 0,
      end: 1,
      text: 'Hello',
      translatedText: 'Namaste',
      baselineTranslatedText: 'Namaste',
      isEdited: false,
    },
  ],
  logs: [],
};

describe('TranscriptEditor', () => {
  it('renders transcript segments', () => {
    render(
      <TranscriptEditor project={baseProject} onSaveTranscript={() => undefined} />
    );
    expect(screen.getByText('Namaste')).toBeTruthy();
    expect(screen.getByText(/Timestamps are read-only/i)).toBeTruthy();
  });

  it('edits translated text and saves', () => {
    const onSave = vi.fn();
    render(<TranscriptEditor project={baseProject} onSaveTranscript={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const area = screen.getByDisplayValue('Namaste');
    fireEvent.change(area, { target: { value: 'Namaskar' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenCalled();
    expect(onSave.mock.calls[0][0][0].translatedText).toBe('Namaskar');
  });
});
