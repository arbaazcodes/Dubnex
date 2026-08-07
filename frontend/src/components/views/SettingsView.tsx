// SettingsView - Advanced System Configuration drawer.
import { motion, AnimatePresence } from 'motion/react';
import { Sliders } from 'lucide-react';
import type { Project, VoiceSettings } from '../../types';

type AppState = 'upload' | 'processing' | 'result';

interface SettingsViewProps {
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  voiceSettings: VoiceSettings;
  setVoiceSettings: (settings: VoiceSettings) => void;
  elevenLabsKey: string;
  setElevenLabsKey: (key: string) => void;
  projects: Project[];
  setSelectedProjectId: (id: string | null) => void;
  setAppState: (state: AppState) => void;
  isRealFirebase: boolean;
}

export default function SettingsView({
  showSettings,
  setShowSettings,
  voiceSettings,
  setVoiceSettings,
  elevenLabsKey,
  setElevenLabsKey,
  projects,
  setSelectedProjectId,
  setAppState,
  isRealFirebase,
}: SettingsViewProps) {
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
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white">Advanced System Configuration</span>
                </div>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 font-mono text-xs cursor-pointer"
                >
                  Close ✕
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
                
                {/* Voice tuning */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-bold border-b border-zinc-100 dark:border-zinc-800 pb-1.5">Voice Synthesis Tuning</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-600 dark:text-zinc-400 font-medium">Vocal Speed</span>
                        <span className="font-mono font-bold text-zinc-900 dark:text-white">{voiceSettings.speed}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.05"
                        value={voiceSettings.speed}
                        onChange={(e) => setVoiceSettings({ ...voiceSettings, speed: parseFloat(e.target.value) })}
                        className="w-full accent-emerald-500 bg-zinc-200 dark:bg-zinc-800 appearance-none h-1 rounded-lg cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-600 dark:text-zinc-400 font-medium">Vocal Pitch</span>
                        <span className="font-mono font-bold text-zinc-900 dark:text-white">{voiceSettings.pitch}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.05"
                        value={voiceSettings.pitch}
                        onChange={(e) => setVoiceSettings({ ...voiceSettings, pitch: parseFloat(e.target.value) })}
                        className="w-full accent-emerald-500 bg-zinc-200 dark:bg-zinc-800 appearance-none h-1 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <span className="text-zinc-600 dark:text-zinc-400 font-medium">Delivery Emotion</span>
                      <select
                        value={voiceSettings.emotion}
                        onChange={(e) => setVoiceSettings({ ...voiceSettings, emotion: e.target.value as any })}
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 rounded-lg p-2.5 text-zinc-800 dark:text-zinc-300 font-mono focus:outline-none"
                      >
                        <option value="Professional">Professional</option>
                        <option value="Happy">Happy</option>
                        <option value="Sad">Sad</option>
                        <option value="Exciting">Exciting</option>
                        <option value="Neutral">Neutral</option>
                        <option value="Whisper">Whisper</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-zinc-600 dark:text-zinc-400 font-medium">Speaker Gender</span>
                      <select
                        value={voiceSettings.gender}
                        onChange={(e) => setVoiceSettings({ ...voiceSettings, gender: e.target.value as any })}
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 rounded-lg p-2.5 text-zinc-800 dark:text-zinc-300 font-mono focus:outline-none"
                      >
                        <option value="Female">Female</option>
                        <option value="Male">Male</option>
                        <option value="Neutral">Neutral</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* System Architecture */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-bold border-b border-zinc-100 dark:border-zinc-800 pb-1.5">AI Architecture Stack</h4>
                  
                  <div className="bg-zinc-50 dark:bg-zinc-950 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-900 space-y-3 font-mono text-[10.5px]">
                    <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-900/60 pb-1.5">
                      <span className="text-zinc-400 uppercase">Speech Recognition</span>
                      <strong className="text-zinc-800 dark:text-zinc-200 text-[11px]">Faster-Whisper (3.5 Flash mic)</strong>
                    </div>
                    <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-900/60 pb-1.5">
                      <span className="text-zinc-400 uppercase">Translation Engine</span>
                      <strong className="text-zinc-800 dark:text-zinc-200 text-[11px]">Meta NLLB-200</strong>
                    </div>
                    <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-900/60 pb-1.5">
                      <span className="text-zinc-400 uppercase">Voice Cloning Engine</span>
                      <strong className="text-emerald-500 text-[11px]">ElevenLabs API (Fallback: XTTS v2)</strong>
                    </div>
                    <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-900/60 pb-1.5">
                      <span className="text-zinc-400 uppercase">Video Processing</span>
                      <strong className="text-zinc-800 dark:text-zinc-200 text-[11px]">FFmpeg Codec Multiplex</strong>
                    </div>
                    <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-900/60 pb-1.5">
                      <span className="text-zinc-400 uppercase">Database & Storage</span>
                      <strong className="text-zinc-800 dark:text-zinc-200 text-[11px]">{isRealFirebase ? "Firestore & Auth (Google, Email, Phone)" : "Simulated Local Cache Storage"}</strong>
                    </div>
                  </div>
                </div>

                {/* Developer Overrides */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-bold border-b border-zinc-100 dark:border-zinc-800 pb-1.5">Developer Overrides</h4>
                  
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <span className="text-zinc-600 dark:text-zinc-455 font-medium">ElevenLabs API Secret Override</span>
                      <input
                        type="password"
                        value={elevenLabsKey}
                        onChange={(e) => setElevenLabsKey(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 rounded-lg p-2 text-zinc-800 dark:text-zinc-300 font-mono focus:outline-none"
                        placeholder="ElevenLabs premium key"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-zinc-600 dark:text-zinc-455 font-medium">Gemini API Key</span>
                      <div className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 rounded-lg p-2 text-zinc-600 dark:text-zinc-400 text-[11px]">
                        Backend-only via <code className="font-mono">GEMINI_API_KEY</code> in <code className="font-mono">backend/.env</code>. Never stored in the browser.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stored jobs cache */}
                {projects.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-bold border-b border-zinc-100 dark:border-zinc-800 pb-1.5">Stored Job Container Caches ({projects.length})</h4>
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                      {projects.map(p => (
                        <div 
                          key={p.id} 
                          className="flex items-center justify-between p-2.5 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-150 dark:border-zinc-850 rounded-xl"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProjectId(p.id);
                              setAppState('result');
                              setShowSettings(false);
                            }}
                            className="text-left font-semibold text-zinc-850 dark:text-zinc-200 hover:text-emerald-500 truncate max-w-[190px] cursor-pointer"
                          >
                            {p.title}
                          </button>
                          <span className="font-mono text-[9px] text-zinc-400 bg-zinc-100 dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 px-1.5 py-0.5 rounded font-bold uppercase">
                            ➔ {p.targetLanguage}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
              
              <div className="h-16 border-t border-zinc-100 dark:border-zinc-850 px-6 flex items-center justify-end bg-zinc-50/50 dark:bg-zinc-950/40 shrink-0">
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold font-mono text-xs rounded-xl shadow-sm cursor-pointer"
                >
                  Save & Apply Settings
                </button>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>
  );
}
