import React from 'react';
import { Video, Languages, Activity, HardDrive } from 'lucide-react';

interface MetricCardsProps {
  totalProjects: number;
  completedCount: number;
  totalStorage: string;
}

export default function MetricCards({ totalProjects, completedCount, totalStorage }: MetricCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="metric-cards-container">
      {/* CARD 1: Total Jobs */}
      <div 
        className="bg-white dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 hover:border-zinc-300 dark:hover:border-zinc-700/80 transition-all group shadow-sm dark:shadow-none" 
        id="metric-total-jobs"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono uppercase tracking-wider font-semibold">Total Dub Projects</span>
          <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl group-hover:bg-emerald-500/10 transition-all text-zinc-500 dark:text-zinc-400 group-hover:text-emerald-500 dark:group-hover:text-emerald-400">
            <Video className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-zinc-900 dark:text-white font-mono">{totalProjects}</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">Active Pipelines</span>
        </div>
      </div>

      {/* CARD 2: Completed Translations */}
      <div 
        className="bg-white dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 hover:border-zinc-300 dark:hover:border-zinc-700/80 transition-all group shadow-sm dark:shadow-none" 
        id="metric-completed-translations"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono uppercase tracking-wider font-semibold">Completed Dubs</span>
          <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl group-hover:bg-blue-500/10 transition-all text-zinc-500 dark:text-zinc-400 group-hover:text-blue-500 dark:group-hover:text-blue-400">
            <Languages className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-zinc-900 dark:text-white font-mono">{completedCount}</span>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-mono font-bold">100% Speed</span>
        </div>
      </div>

      {/* CARD 3: Translation Accuracy */}
      <div 
        className="bg-white dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 hover:border-zinc-300 dark:hover:border-zinc-700/80 transition-all group shadow-sm dark:shadow-none" 
        id="metric-accuracy"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono uppercase tracking-wider font-semibold">Speech-to-Speech Accuracy</span>
          <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl group-hover:bg-amber-500/10 transition-all text-zinc-500 dark:text-zinc-400 group-hover:text-amber-500 dark:group-hover:text-amber-400">
            <Activity className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-zinc-900 dark:text-white font-mono">99.4%</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">Faster Whisper V3</span>
        </div>
      </div>

      {/* CARD 4: Storage Allocated */}
      <div 
        className="bg-white dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 hover:border-zinc-300 dark:hover:border-zinc-700/80 transition-all group shadow-sm dark:shadow-none" 
        id="metric-storage-allocated"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono uppercase tracking-wider font-semibold">Storage Allocation</span>
          <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl group-hover:bg-rose-500/10 transition-all text-zinc-500 dark:text-zinc-400 group-hover:text-rose-500 dark:group-hover:text-rose-400">
            <HardDrive className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-rose-600 dark:text-rose-400 font-mono">{totalStorage}</span>
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">24h Auto-Cleanup</span>
        </div>
      </div>
    </div>
  );
}
