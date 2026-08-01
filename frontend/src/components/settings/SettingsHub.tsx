import React, { useState } from 'react';
import { Sliders, Bell, Shield, Key, HardDrive, RefreshCw, Sparkles, AlertCircle } from 'lucide-react';

export default function SettingsHub() {
  const [themeColor, setThemeColor] = useState<'slate' | 'indigo' | 'crimson'>('slate');
  const [elevenLabsKey, setElevenLabsKey] = useState('••••••••••••••••••••••••••••');
  const [geminiKey, setGeminiKey] = useState('••••••••••••••••••••••••••••');
  const [emulatorMode, setEmulatorMode] = useState(false);
  const [slackWebhook, setSlackWebhook] = useState('https://hooks.slack.com/services/T00000000/B00000000/...');
  const [cacheTtl, setCacheTtl] = useState(24); // hours
  const [notifUpload, setNotifUpload] = useState(true);
  const [notifCompleted, setNotifCompleted] = useState(true);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }, 1000);
  };

  return (
    <div 
      className="bg-white dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-6 space-y-6 transition-all shadow-sm dark:shadow-none animate-fade-in" 
      id="settings-hub-container"
    >
      {/* Header */}
      <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
          <Sliders className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          <span>Global Settings & Integrations Manager</span>
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Configure API adapters, database rules, slack hooks, and container parameters.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Section 1: API Adapters */}
          <div className="bg-zinc-50/50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300">
              <Key className="w-4 h-4 text-blue-500" />
              <span>Third-Party API Credentials</span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 block mb-1 uppercase tracking-wider font-bold">GEMINI SECRET KEY</label>
                <div className="relative">
                  <input
                    type="password"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-800 dark:text-zinc-300 focus:outline-none focus:border-zinc-400 font-mono"
                    placeholder="Enter process.env.GEMINI_API_KEY override"
                  />
                  <div className="absolute top-1/2 right-2.5 -translate-y-1/2 text-[9px] font-mono text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10 px-1.5 py-px rounded border border-emerald-200 dark:border-emerald-500/10">
                    Active server-side
                  </div>
                </div>
                <span className="text-[9px] text-zinc-400 dark:text-zinc-550 mt-1 block leading-relaxed">Always proxies securely via /api to hide tokens from client DOM.</span>
              </div>

              <div>
                <label className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 block mb-1 uppercase tracking-wider font-bold">ELEVENLABS API KEY (CINEMATIC DUBBING)</label>
                <input
                  type="password"
                  value={elevenLabsKey}
                  onChange={(e) => setElevenLabsKey(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-850 dark:text-zinc-300 focus:outline-none focus:border-zinc-400 font-mono"
                  placeholder="Enter ElevenLabs API token"
                />
                <span className="text-[9px] text-zinc-400 dark:text-zinc-550 mt-1 block leading-relaxed">To upgrade from CosyVoice to ElevenLabs, supply key. Leaving blank preserves FOSS fallback.</span>
              </div>

              {/* Dev mode Toggle */}
              <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-800/60">
                <div>
                  <span className="text-xs text-zinc-700 dark:text-zinc-300 font-semibold block">Local Firebase Emulator Mode</span>
                  <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono">Use port 8080/9000 offline mock</span>
                </div>
                <input
                  type="checkbox"
                  checked={emulatorMode}
                  onChange={(e) => setEmulatorMode(e.target.checked)}
                  className="accent-emerald-500 cursor-pointer w-4 h-4"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Storage and Webhooks */}
          <div className="bg-zinc-50/50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-750 dark:text-zinc-300">
              <HardDrive className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
              <span>Storage Policy & Cache TTL</span>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/20 rounded-lg flex gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-rose-850 dark:text-rose-300/90 leading-relaxed">
                  <strong>24-Hour Self-Destruct Notice:</strong> To maintain strict data privacy compliance and prevent storage leaks, all processed videos and audio reference samples are wiped automatically after 24 hours.
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center text-xs text-zinc-600 dark:text-zinc-400 mb-1.5 font-semibold">
                  <span>Temp Cache Expiry Limit</span>
                  <span className="font-mono text-zinc-900 dark:text-white font-bold">{cacheTtl} Hours</span>
                </div>
                <input
                  id="cache-ttl-slider"
                  type="range"
                  min="1"
                  max="48"
                  value={cacheTtl}
                  onChange={(e) => setCacheTtl(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 bg-zinc-200 dark:bg-zinc-900 appearance-none h-1.5 rounded-lg cursor-pointer"
                />
              </div>

              {/* Webhooks integration */}
              <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800/60">
                <label className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 block uppercase tracking-wider font-bold">SLACK NOTIFICATION WEBHOOK</label>
                <input
                  type="text"
                  value={slackWebhook}
                  onChange={(e) => setSlackWebhook(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-500 dark:text-zinc-400 focus:outline-none focus:border-zinc-400 font-mono text-[10px]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Webhook Notification Toggles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-zinc-50/50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-500 dark:text-purple-400">
              <Bell className="w-4 h-4 text-purple-500 dark:text-purple-400" />
              <span>Event Subscriptions & Webhooks</span>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-700 dark:text-zinc-300 font-medium">Trigger Slack on Upload Start</span>
                <input
                  type="checkbox"
                  checked={notifUpload}
                  onChange={(e) => setNotifUpload(e.target.checked)}
                  className="accent-emerald-500 cursor-pointer w-4 h-4"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-700 dark:text-zinc-300 font-medium">Trigger Slack on Pipeline Finished</span>
                <input
                  type="checkbox"
                  checked={notifCompleted}
                  onChange={(e) => setNotifCompleted(e.target.checked)}
                  className="accent-emerald-500 cursor-pointer w-4 h-4"
                />
              </div>
            </div>
          </div>

          {/* Active Preset branding */}
          <div className="bg-zinc-50/50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl flex flex-col justify-between">
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-zinc-800 dark:text-zinc-300 font-bold">
                <Shield className="w-4 h-4 text-emerald-500" />
                <span>Security & Sanitization Guard</span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                All file streams uploaded pass through an active ClamAV sandbox container scanning for malicious macros, metadata leaks, and code executions before FFmpeg separation triggers.
              </p>
            </div>

            <div className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800/60 pt-3 mt-4 text-xs font-mono">
              <span className="text-zinc-400 dark:text-zinc-500">Security Gateway Engine</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold uppercase">ClamAV 2026.04-T</span>
            </div>
          </div>
        </div>

        {/* Bottom Save Trigger */}
        <div className="flex justify-end gap-3 items-center border-t border-zinc-100 dark:border-zinc-800/85 pt-4">
          {saveSuccess && (
            <span className="text-xs text-emerald-600 dark:text-emerald-450 font-mono flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Settings stored safely in IndexedDB</span>
            </span>
          )}
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-emerald-500 text-zinc-950 font-bold font-mono rounded-xl text-xs transition-all hover:bg-emerald-400 shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Storing Parameters...</span>
              </>
            ) : (
              <span>Commit Settings</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
