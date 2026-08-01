import React, { useState } from 'react';
import { Volume2, Sliders, AudioLines, Sparkles, Check, Info, HelpCircle } from 'lucide-react';
import { VoiceSettings, TTSVoiceEngine } from '../../types';
import { voicePresets } from '../../constants/data';

interface VoiceSettingsStudioProps {
  currentSettings: VoiceSettings;
  activeEngine: TTSVoiceEngine;
  onChangeSettings: (settings: VoiceSettings) => void;
  onChangeEngine: (engine: TTSVoiceEngine) => void;
}

const engines: { id: TTSVoiceEngine; name: string; desc: string; type: 'open-source' | 'premium' }[] = [
  { id: 'CosyVoice', name: 'CosyVoice (Meta/Alibaba)', desc: 'Multi-lingual zero-shot voice cloning with natural breathing controls', type: 'open-source' },
  { id: 'XTTS v2', name: 'XTTS v2 (Coqui)', desc: 'Speaker voice clone from 3s reference with high timing preservation', type: 'open-source' },
  { id: 'F5-TTS', name: 'F5-TTS (SOTA)', desc: 'Fast non-autoregressive speech synthesis for low latency streams', type: 'open-source' },
  { id: 'OpenVoice v2', name: 'OpenVoice v2 (MyShell)', desc: 'Flexible vocal timbre cloning and cross-lingual translation support', type: 'open-source' },
  { id: 'ElevenLabs', name: 'ElevenLabs (Premium API Proxy)', desc: 'State-of-the-art cinematic emotional dubbing engine', type: 'premium' }
];

export default function VoiceSettingsStudio({ currentSettings, activeEngine, onChangeSettings, onChangeEngine }: VoiceSettingsStudioProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('f-cosy-serena');
  const [playingPreview, setPlayingPreview] = useState(false);

  const applyPreset = (presetId: string) => {
    const found = voicePresets.find(p => p.id === presetId);
    if (found) {
      setSelectedPresetId(presetId);
      onChangeSettings(found.settings);
      onChangeEngine(found.engine as TTSVoiceEngine);
    }
  };

  const handleUpdateField = (field: keyof VoiceSettings, value: any) => {
    onChangeSettings({
      ...currentSettings,
      [field]: value
    });
  };

  const playSynthesizerPreview = () => {
    setPlayingPreview(true);
    // Simulate real audio preview playback
    const textToSpeak = `Generating a voice synthesis preview using ${activeEngine} with gender preset ${currentSettings.gender}, adjusted speed ${currentSettings.speed}x, and emotional delivery set to ${currentSettings.emotion}.`;
    
    // Play sound from HTML5 speech synthesis API if supported, matching language options
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = currentSettings.speed;
      utterance.pitch = currentSettings.pitch;
      utterance.onend = () => setPlayingPreview(false);
      utterance.onerror = () => setPlayingPreview(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => {
        setPlayingPreview(false);
      }, 3000);
    }
  };

  return (
    <div 
      className="bg-white dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-6 space-y-6 transition-all shadow-sm dark:shadow-none" 
      id="voice-settings-studio-card"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800/80 pb-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
            <AudioLines className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            <span>Voice Settings & Synthesizer Studio</span>
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Choose voice clones, switch engines, and fine-tune speech prosody and emotion layers.
          </p>
        </div>
        <button
          onClick={playSynthesizerPreview}
          disabled={playingPreview}
          className={`px-4 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ${
            playingPreview 
              ? 'bg-amber-500 text-zinc-950 animate-pulse' 
              : 'bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 text-white border border-zinc-800 dark:border-zinc-700'
          }`}
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>{playingPreview ? 'Synthesizing...' : 'Test Synthesis'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: Engine and Preset Picker */}
        <div className="lg:col-span-5 space-y-5">
          {/* TTS Engines Selection */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider block">TTS Model Engine Pool</span>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {engines.map((eng) => (
                <button
                  key={eng.id}
                  onClick={() => onChangeEngine(eng.id)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all text-xs flex justify-between items-start cursor-pointer ${
                    activeEngine === eng.id 
                      ? 'bg-emerald-500/[0.02] dark:bg-emerald-500/[0.02] border-emerald-500 dark:border-emerald-500/40' 
                      : 'bg-zinc-50 dark:bg-zinc-950/40 border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-semibold ${activeEngine === eng.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-800 dark:text-zinc-300'}`}>{eng.id}</span>
                      <span className={`text-[8px] px-1.5 py-px rounded font-mono ${
                        eng.type === 'premium' 
                          ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20' 
                          : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                      }`}>
                        {eng.type === 'premium' ? 'Premium API' : 'FOSS'}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">{eng.desc}</p>
                  </div>
                  {activeEngine === eng.id && (
                    <div className="p-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md flex-shrink-0">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Voice Presets */}
          <div className="space-y-2 pt-1">
            <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider block">Quick Presets</span>
            <div className="grid grid-cols-2 gap-2">
              {voicePresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset.id)}
                  className={`p-2 rounded-xl border text-left text-[11px] transition-all truncate flex items-center justify-between cursor-pointer ${
                    selectedPresetId === preset.id 
                      ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-400 dark:border-zinc-600 text-zinc-900 dark:text-white' 
                      : 'bg-zinc-50/50 dark:bg-zinc-950/20 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  <span className="truncate">{preset.name}</span>
                  {selectedPresetId === preset.id && <Sparkles className="w-3 h-3 text-emerald-500 dark:text-emerald-400 flex-shrink-0 ml-1" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: Fine-tuning sliders */}
        <div className="lg:col-span-7 bg-zinc-50/50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800/60 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider block">Vocal Timbre Parameters</span>
            <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
              <Info className="w-3 h-3 text-emerald-500" /> Dynamic Synchronized Align Enabled
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Gender Presets */}
            <div>
              <span className="text-xs text-zinc-600 dark:text-zinc-300 block mb-2 font-semibold">Vocal Gender Profile</span>
              <div className="grid grid-cols-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5 text-xs font-mono">
                {(['Male', 'Female', 'Neutral'] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => handleUpdateField('gender', g)}
                    className={`py-1 rounded-md text-center transition-all cursor-pointer ${
                      currentSettings.gender === g 
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 font-bold' 
                        : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Emotion preset wheel */}
            <div>
              <span className="text-xs text-zinc-600 dark:text-zinc-300 block mb-2 font-semibold">Speech Emotion Presets</span>
              <select
                id="emotion-preset-select"
                value={currentSettings.emotion}
                onChange={(e) => handleUpdateField('emotion', e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-1.5 text-xs text-zinc-800 dark:text-zinc-200 font-mono focus:outline-none focus:border-emerald-500"
              >
                <option value="Neutral">😐 Neutral Delivery</option>
                <option value="Happy">😊 Happy & Optimistic</option>
                <option value="Sad">😢 Melancholy / Soft</option>
                <option value="Exciting">🔥 High Energy / Exciting</option>
                <option value="Professional">💼 Corporate / Professional</option>
                <option value="Whisper">🤫 Soft Whispering</option>
              </select>
            </div>
          </div>

          {/* Sliders Grid */}
          <div className="space-y-4 pt-2">
            {/* Speech Speed */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-600 dark:text-zinc-300 font-semibold">Speech Speed (Duration Stretch)</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">{currentSettings.speed.toFixed(2)}x</span>
              </div>
              <input
                id="speed-slider"
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={currentSettings.speed}
                onChange={(e) => handleUpdateField('speed', parseFloat(e.target.value))}
                className="w-full accent-emerald-500 bg-zinc-200 dark:bg-zinc-900 appearance-none h-1.5 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[8px] font-mono text-zinc-400 dark:text-zinc-600">
                <span>0.5x Slow Speech</span>
                <span>1.0x Normal</span>
                <span>2.0x Fast Pitch</span>
              </div>
            </div>

            {/* Pitch factor */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-600 dark:text-zinc-300 font-semibold">Vocal Pitch (Frequency shift)</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">{currentSettings.pitch.toFixed(2)}x</span>
              </div>
              <input
                id="pitch-slider"
                type="range"
                min="0.5"
                max="1.5"
                step="0.02"
                value={currentSettings.pitch}
                onChange={(e) => handleUpdateField('pitch', parseFloat(e.target.value))}
                className="w-full accent-emerald-500 bg-zinc-200 dark:bg-zinc-900 appearance-none h-1.5 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[8px] font-mono text-zinc-400 dark:text-zinc-600">
                <span>0.5x Low Baritone</span>
                <span>1.0x Unaltered timbre</span>
                <span>1.5x Bright Soprano</span>
              </div>
            </div>

            {/* Energy Factor */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-600 dark:text-zinc-300 font-semibold">Vocal Energy (Acoustic Amplitude)</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">{currentSettings.energy.toFixed(2)}x</span>
              </div>
              <input
                id="energy-slider"
                type="range"
                min="0.5"
                max="1.5"
                step="0.05"
                value={currentSettings.energy}
                onChange={(e) => handleUpdateField('energy', parseFloat(e.target.value))}
                className="w-full accent-emerald-500 bg-zinc-200 dark:bg-zinc-900 appearance-none h-1.5 rounded-lg cursor-pointer"
              />
            </div>

            {/* Pause Control */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-600 dark:text-zinc-300 font-semibold">Pause Padding Offset</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">{currentSettings.pauseControl.toFixed(2)}s</span>
              </div>
              <input
                id="pause-slider"
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={currentSettings.pauseControl}
                onChange={(e) => handleUpdateField('pauseControl', parseFloat(e.target.value))}
                className="w-full accent-emerald-500 bg-zinc-200 dark:bg-zinc-900 appearance-none h-1.5 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[8px] font-mono text-zinc-400 dark:text-zinc-600">
                <span>0.0s Compressed Dialogue</span>
                <span>1.0s Max Breathing room</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
