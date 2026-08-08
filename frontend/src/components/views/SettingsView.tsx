// SettingsView — settings drawer.
// Only exposes settings that actually do something:
// appearance (theme), the current default voice (display), recent projects,
// and an honest "About" section. No fake toggles or dead key inputs.
import { motion, AnimatePresence } from 'motion/react';
import { Sliders, Moon, Sun, Check, FolderOpen, Languages, Mic2, Sparkles } from 'lucide-react';
import { voiceLibraryCatalog } from '../../constants/voices';
import type { Project } from '../../types';

type AppState = 'upload' | 'processing' | 'result';

interface SettingsViewProps {
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  defaultVoiceId: string | null;
  projects: Project[];
  setSelectedProjectId: (id: string | null) => void;
  setAppState: (state: AppState) => void;
  themeMode: 'light' | 'dark';
  toggleTheme: () => void;
  isRealFirebase: boolean;
}

export default function SettingsView({
  showSettings,
  setShowSettings,
  defaultVoiceId,
  projects,
  setSelectedProjectId,
  setAppState,
  themeMode,
  toggleTheme,
  isRealFirebase,
}: SettingsViewProps) {
  const defaultVoice = defaultVoiceId
    ? voiceLibraryCatalog.find((v) => v.id === defaultVoiceId)
    : undefined;

  return (
      <AnimatePresence>
        {showSettings && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="fixed inset-0 bg-zinc-950 z-40 backdrop-blur-sm"
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 w-full sm:w-[460px] bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-850 shadow-2xl z-50 flex flex-col overflow-hidden text-zinc-900 dark:text-zinc-100"
            >
              <div className="h-16 border-b border-zinc-100 dark:border-zinc-850 px-6 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 select-none">
                  <Sliders className="w-4 h-4 text-emerald-500" />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white">Settings</span>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 font-mono text-xs cursor-pointer"
                  aria-label="Close settings"
                >
                  Close ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-7 text-xs">

                {/* Appearance */}
                <section className="space-y-3">
                  <h4 className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-bold border-b border-zinc-100 dark:border-zinc-800 pb-1.5">Appearance</h4>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-zinc-800 dark:text-zinc-200">Theme</p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Switches between light and dark mode.
                      </p>
                    </div>
                    <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-1">
                      <button
                        type="button"
                        onClick={() => themeMode !== 'light' && toggleTheme()}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono flex items-center gap-1.5 cursor-pointer transition-all ${
                          themeMode === 'light'
                            ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-700'
                            : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 border border-transparent'
                        }`}
                        aria-pressed={themeMode === 'light'}
                      >
                        <Sun className="w-3 h-3 text-amber-500" />
                        Light
                      </button>
                      <button
                        type="button"
                        onClick={() => themeMode !== 'dark' && toggleTheme()}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono flex items-center gap-1.5 cursor-pointer transition-all ${
                          themeMode === 'dark'
                            ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-700'
                            : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 border border-transparent'
                        }`}
                        aria-pressed={themeMode === 'dark'}
                      >
                        <Moon className="w-3 h-3 text-indigo-500" />
                        Dark
                      </button>
                    </div>
                  </div>
                </section>

                {/* Voice preference */}
                <section className="space-y-3">
                  <h4 className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-bold border-b border-zinc-100 dark:border-zinc-800 pb-1.5">Voice Preference</h4>
                  <div className="bg-zinc-50 dark:bg-zinc-950 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-900">
                    <div className="flex items-center gap-2.5">
                      <Mic2 className="w-4 h-4 text-emerald-500" />
                      <div>
                        <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                          {defaultVoice?.name ?? 'Default voice'}
                        </p>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {defaultVoice
                            ? `${defaultVoice.gender} · ${defaultVoice.accent} · ${defaultVoice.category}`
                            : 'No default voice set'}
                        </p>
                      </div>
                      {defaultVoice && <Check className="w-3.5 h-3.5 text-emerald-500 ml-auto" aria-hidden />}
                    </div>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-3 leading-relaxed">
                      You can change the voice for each dub from the voice picker in the Studio.
                      Your default voice is applied automatically to new projects.
                    </p>
                  </div>
                </section>

                {/* Recent projects */}
                <section className="space-y-3">
                  <h4 className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-bold border-b border-zinc-100 dark:border-zinc-800 pb-1.5">
                    Recent Projects {projects.length > 0 ? `(${projects.length})` : ''}
                  </h4>
                  {projects.length > 0 ? (
                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                      {projects.slice(0, 12).map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedProjectId(p.id);
                            setAppState('result');
                            setShowSettings(false);
                          }}
                          className="w-full flex items-center justify-between p-2.5 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200/60 dark:border-zinc-800 rounded-xl hover:border-emerald-500/40 cursor-pointer text-left transition-all"
                          title={`Open ${p.title}`}
                        >
                          <span className="flex items-center gap-2 font-semibold text-zinc-800 dark:text-zinc-200 hover:text-emerald-500 truncate max-w-[240px]">
                            <FolderOpen className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                            <span className="truncate">{p.title}</span>
                          </span>
                          <span className="font-mono text-[9px] text-zinc-400 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-1.5 py-0.5 rounded font-bold uppercase flex-shrink-0">
                            {p.status}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      No projects yet. Dub a video from the Studio and it will appear here.
                    </p>
                  )}
                </section>

                {/* About */}
                <section className="space-y-3">
                  <h4 className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-bold border-b border-zinc-100 dark:border-zinc-800 pb-1.5">About Dubnex</h4>
                  <div className="bg-zinc-50 dark:bg-zinc-950 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-900 space-y-2.5">
                    <div className="flex justify-between">
                      <span className="text-zinc-400 uppercase flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> Speech Recognition</span>
                      <strong className="text-zinc-800 dark:text-zinc-200">Faster-Whisper</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400 uppercase flex items-center gap-1.5"><Languages className="w-3 h-3" /> Translation</span>
                      <strong className="text-zinc-800 dark:text-zinc-200">Google Gemini · NLLB</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400 uppercase flex items-center gap-1.5"><Mic2 className="w-3 h-3" /> Voice Synthesis</span>
                      <strong className="text-emerald-500">Coqui TTS XTTS v2 (Local)</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400 uppercase">Video Processing</span>
                      <strong className="text-zinc-800 dark:text-zinc-200">FFmpeg</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400 uppercase">Storage &amp; Auth</span>
                      <strong className="text-zinc-800 dark:text-zinc-200">
                        {isRealFirebase ? 'Firebase' : 'Local'}
                      </strong>
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    API keys for Gemini are stored on the backend only and are never
                    sent to the browser. Voice synthesis runs locally using Coqui TTS (no API key required).
                    Voice preferences adjust project metadata; actual voice synthesis is controlled by the selected voice.
                  </p>
                </section>
              </div>

              <div className="h-16 border-t border-zinc-100 dark:border-zinc-850 px-6 flex items-center justify-end bg-zinc-50/50 dark:bg-zinc-950/40 shrink-0">
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold font-mono text-xs rounded-xl shadow-sm cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
  );
}
