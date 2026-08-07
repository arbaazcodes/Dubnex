// VoiceStudioView - Premium Voice Studio feature module (full page).
import VoiceStudio from '../voices/VoiceStudio';
import { voiceLibraryCatalog } from '../../constants/voices';
import type { LibraryVoice } from '../../types';

interface VoiceStudioViewProps {
  favoriteVoiceIds: string[];
  defaultVoiceId: string | null;
  recentlyUsedVoiceIds: string[];
  handleToggleFavoriteVoice: (voiceId: string) => void;
  handleSetDefaultVoice: (voice: LibraryVoice) => void;
  targetLanguage?: string;
  setMainView: (view: 'studio' | 'projects' | 'project-details' | 'voices') => void;
  setAppState: (state: 'upload' | 'processing' | 'result') => void;
}

export default function VoiceStudioView({
  favoriteVoiceIds,
  defaultVoiceId,
  recentlyUsedVoiceIds,
  handleToggleFavoriteVoice,
  handleSetDefaultVoice,
  targetLanguage,
  setMainView,
  setAppState,
}: VoiceStudioViewProps) {
  return (
    <section className="lg:col-span-12">
      <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200/50 dark:border-zinc-900 rounded-3xl overflow-hidden shadow-sm dark:shadow-none">
        <VoiceStudio
          voices={voiceLibraryCatalog}
          favoriteIds={favoriteVoiceIds}
          defaultVoiceId={defaultVoiceId}
          recentlyUsedIds={recentlyUsedVoiceIds}
          targetLanguage={targetLanguage}
          onToggleFavorite={handleToggleFavoriteVoice}
          onSelectDefault={handleSetDefaultVoice}
          onBackToStudio={() => {
            setMainView('studio');
            setAppState('upload');
          }}
        />
      </div>
    </section>
  );
}
