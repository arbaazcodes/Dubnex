import React, { useState } from 'react';
import { Search, Globe, Clock, FileVideo, CheckCircle, RefreshCw, Trash2, ArrowRight } from 'lucide-react';
import { Project } from '../types';

interface HistoryTableProps {
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
}

export default function HistoryTable({ projects, activeProjectId, onSelectProject, onDeleteProject }: HistoryTableProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = projects.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.originalLanguage.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.targetLanguage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div 
      className="bg-white dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-6 space-y-4 transition-all shadow-sm dark:shadow-none" 
      id="history-table-card"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight">Project Database & Dub History</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Manage active video translations, check pipelines, and inspect final downloads.</p>
        </div>
        <div className="flex items-center bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 w-full sm:w-64 shadow-inner">
          <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-500 mr-2 flex-shrink-0" />
          <input
            id="history-search-input"
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs text-zinc-800 dark:text-white w-full focus:outline-none placeholder-zinc-400 dark:placeholder-zinc-500"
          />
        </div>
      </div>

      <div className="overflow-x-auto" id="projects-history-table-container">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[10px] uppercase font-mono text-zinc-400 dark:text-zinc-500 font-bold tracking-wider">
              <th className="py-3 px-4">Project Title</th>
              <th className="py-3 px-4">Languages</th>
              <th className="py-3 px-4">Duration & Size</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/40">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-zinc-500 dark:text-zinc-400">
                  No matching projects found in local index.
                </td>
              </tr>
            ) : (
              filtered.map((p) => {
                const isActive = activeProjectId === p.id;
                return (
                  <tr 
                    key={p.id}
                    onClick={() => onSelectProject(p.id)}
                    className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/20 cursor-pointer transition-colors ${
                      isActive 
                        ? 'bg-emerald-500/[0.02] dark:bg-emerald-500/[0.02] border-l-2 border-emerald-500' 
                        : ''
                    }`}
                  >
                    {/* Title */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-2 rounded-lg flex-shrink-0 ${
                          isActive 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                        }`}>
                          <FileVideo className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">{p.title}</p>
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">{p.createdAt}</p>
                        </div>
                      </div>
                    </td>

                    {/* Language Conversion */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 font-mono text-[10px]">
                        <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-700 dark:text-zinc-300 font-bold uppercase">{p.originalLanguage}</span>
                        <ArrowRight className="w-3 h-3 text-zinc-400" />
                        <span className="bg-emerald-500/10 border border-emerald-500/20 dark:border-emerald-500/25 px-2 py-0.5 rounded text-emerald-600 dark:text-emerald-400 font-bold uppercase">{p.targetLanguage}</span>
                      </div>
                    </td>

                    {/* Duration & Size */}
                    <td className="py-3.5 px-4">
                      <div className="font-mono text-[10px] text-zinc-600 dark:text-zinc-400 space-y-0.5">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-zinc-400" />
                          <span>{p.duration}</span>
                        </div>
                        <div className="text-zinc-400 dark:text-zinc-500">{p.size}</div>
                      </div>
                    </td>

                    {/* Status badge */}
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        p.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                        p.status === 'Failed' ? 'bg-rose-500/10 text-rose-650 dark:text-rose-400 border border-rose-500/20' :
                        'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 animate-pulse'
                      }`}>
                        {p.status}
                      </span>
                    </td>

                    {/* Actions Panel */}
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onSelectProject(p.id)}
                          className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                            isActive 
                              ? 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400' 
                              : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-350'
                          }`}
                        >
                          Workspace
                        </button>
                        <button
                          onClick={() => onDeleteProject(p.id)}
                          className="p-1.5 bg-zinc-50 dark:bg-zinc-950 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-zinc-400 hover:text-rose-500 dark:text-zinc-500 dark:hover:text-rose-400 rounded border border-zinc-200 dark:border-zinc-800 hover:border-rose-200 dark:hover:border-rose-900/50 transition-all cursor-pointer"
                          title="Delete Project record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
