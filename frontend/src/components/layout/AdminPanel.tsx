import React, { useState, useEffect } from 'react';
import { Cpu, Server, ShieldCheck, Database, HardDrive, RefreshCw, AlertTriangle } from 'lucide-react';

export default function AdminPanel() {
  const [cpu, setCpu] = useState(24);
  const [gpu, setGpu] = useState(48);
  const [ram, setRam] = useState(3.4); // GB out of 8GB
  const [disk, setDisk] = useState(41.2); // GB
  const [activeThreads, setActiveThreads] = useState(3);
  const [recentErrors, setRecentErrors] = useState<{ id: string; msg: string; time: string; code: string }[]>([
    { id: 'e1', msg: 'ElevenLabs API socket handshake timeout (retried with open-source CosyVoice)', time: '03:02 AM', code: 'TTS_502' },
    { id: 'e2', msg: 'Incorrect WAV padding on extracted track (auto-corrected with FFmpeg silence overlay)', time: '02:14 AM', code: 'FFM_404' }
  ]);

  // Simulate slightly fluctuating system metrics
  useEffect(() => {
    const interval = setInterval(() => {
      setCpu(prev => Math.max(10, Math.min(95, Math.floor(prev + (Math.random() * 10 - 5)))));
      setGpu(prev => Math.max(20, Math.min(99, Math.floor(prev + (Math.random() * 14 - 7)))));
      setRam(prev => Math.max(2.1, Math.min(7.8, parseFloat((prev + (Math.random() * 0.4 - 0.2)).toFixed(2)))));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div 
      className="bg-white dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-6 space-y-6 transition-all shadow-sm dark:shadow-none animate-fade-in" 
      id="admin-panel-container"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            <span>AI Translation Server Dashboard (Admin)</span>
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Monitor Faster-Whisper, Meta NLLB, CosyVoice node clusters, memory, and container status.</p>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] bg-zinc-50 dark:bg-zinc-950 px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-inner">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Cluster: HEALTHY</span>
        </div>
      </div>

      {/* Resource meters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU */}
        <div className="bg-zinc-50/50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-inner">
          <div className="flex justify-between items-center text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-semibold">CPU Load</span>
            <span className="font-mono text-zinc-800 dark:text-white font-bold">{cpu}%</span>
          </div>
          <div className="mt-2.5 w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div className={`h-full transition-all duration-1000 ${cpu > 80 ? 'bg-rose-500' : 'bg-blue-500'}`} style={{ width: `${cpu}%` }} />
          </div>
          <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-600 mt-2 block">8 Cores • Cloud Run Sandboxed</span>
        </div>

        {/* GPU vRAM */}
        <div className="bg-zinc-50/50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-inner">
          <div className="flex justify-between items-center text-xs text-zinc-500 dark:text-zinc-450">
            <span className="font-semibold">vRAM NVIDIA T4</span>
            <span className="font-mono text-zinc-800 dark:text-white font-bold">{gpu}%</span>
          </div>
          <div className="mt-2.5 w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${gpu}%` }} />
          </div>
          <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-600 mt-2 block">16GB Memory • CUDA 12.4</span>
        </div>

        {/* Memory allocation */}
        <div className="bg-zinc-50/50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-inner">
          <div className="flex justify-between items-center text-xs text-zinc-500 dark:text-zinc-450">
            <span className="font-semibold">RAM Allocation</span>
            <span className="font-mono text-zinc-800 dark:text-white font-bold">{ram} GB / 8 GB</span>
          </div>
          <div className="mt-2.5 w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-yellow-500 transition-all duration-1000" style={{ width: `${(ram/8)*100}%` }} />
          </div>
          <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-600 mt-2 block">Node Host VM Memory Pool</span>
        </div>

        {/* Local Storage disk */}
        <div className="bg-zinc-50/50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-inner">
          <div className="flex justify-between items-center text-xs text-zinc-500 dark:text-zinc-450">
            <span className="font-semibold">Ephemeral Cache</span>
            <span className="font-mono text-zinc-800 dark:text-white font-bold">{disk} GB / 100 GB</span>
          </div>
          <div className="mt-2.5 w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500" style={{ width: `${disk}%` }} />
          </div>
          <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-600 mt-2 block">Temp wav/mp4 streams (24h TTL)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        {/* Active Node cluster endpoints health */}
        <div className="bg-zinc-50/30 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl space-y-3">
          <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider block">Container Node Endpoints</span>
          
          <div className="space-y-2 text-xs">
            {/* WHISPER */}
            <div className="flex items-center justify-between p-2.5 bg-white dark:bg-zinc-950/75 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm">
              <div className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">Faster-Whisper Container (v3)</span>
              </div>
              <span className="text-[9px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">ONLINE</span>
            </div>

            {/* META NLLB */}
            <div className="flex items-center justify-between p-2.5 bg-white dark:bg-zinc-950/75 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm">
              <div className="flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">Meta NLLB-200 Translator</span>
              </div>
              <span className="text-[9px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">ONLINE</span>
            </div>

            {/* COSYVOICE */}
            <div className="flex items-center justify-between p-2.5 bg-white dark:bg-zinc-950/75 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm">
              <div className="flex items-center gap-2">
                <Server className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">CosyVoice & XTTS TTS Daemon</span>
              </div>
              <span className="text-[9px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">ONLINE</span>
            </div>

            {/* SECURITY GATEWAY */}
            <div className="flex items-center justify-between p-2.5 bg-white dark:bg-zinc-950/75 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">ClamAV Malware Stream Scanner</span>
              </div>
              <span className="text-[9px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">SECURE</span>
            </div>
          </div>
        </div>

        {/* Recent Error trends & self-heals */}
        <div className="bg-zinc-50/30 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider block">Self-Healing Event Logs</span>
            <span className="text-[9px] font-mono text-zinc-500 dark:text-zinc-400 font-bold">Auto-recovery: 100%</span>
          </div>

          <div className="space-y-2 h-[142px] overflow-y-auto pr-1">
            {recentErrors.map((err) => (
              <div key={err.id} className="p-2.5 bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-lg flex items-start gap-2.5 text-[11px] shadow-sm">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-700 dark:text-zinc-300 font-mono text-[10px]">{err.code}</span>
                    <span className="text-[9px] text-zinc-400 dark:text-zinc-500">{err.time}</span>
                  </div>
                  <p className="text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">{err.msg}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
