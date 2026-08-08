import React, { useState } from 'react';
import {
  Search,
  Clock,
  FileVideo,
  Trash2,
  Download,
  Play,
  Copy,
  FolderOpen,
  AlertCircle,
  Info,
} from 'lucide-react';
import { Project } from '../../types';
import DeleteProjectDialog from './DeleteProjectDialog';

const PLACEHOLDER_THUMB =
  'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=640&q=80';

interface ProjectsDashboardProps {
  projects: Project[];
  activeProjectId: string | null;
  onPreview: (id: string) => void;
  onDownload: (project: Project) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onOpenDetails: (id: string) => void;
  onBackToStudio: () => void;
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '—';
  return date.toLocaleString();
}

function statusStyles(status: string) {
  if (status === 'Completed') {
    return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
  }
  if (status === 'Failed') {
    return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
  }
  return 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20';
}

export default function ProjectsDashboard({
  projects,
  activeProjectId,
  onPreview,
  onDownload,
  onDelete,
  onDuplicate,
  onOpenDetails,
  onBackToStudio,
}: ProjectsDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(pendingDelete.id);
      setPendingDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = projects.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.originalLanguage.toLowerCase().includes(q) ||
      p.targetLanguage.toLowerCase().includes(q) ||
      String(p.status).toLowerCase().includes(q)
    );
  });

  const isTerminal = (status: string) => status === 'Completed' || status === 'Failed';
  const stats = [
    { label: 'Total', value: projects.length, tone: 'text-zinc-900 dark:text-white' },
    {
      label: 'Completed',
      value: projects.filter((p) => p.status === 'Completed').length,
      tone: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'In Progress',
      value: projects.filter((p) => !isTerminal(String(p.status))).length,
      tone: 'text-sky-600 dark:text-sky-400',
    },
    {
      label: 'Failed',
      value: projects.filter((p) => p.status === 'Failed').length,
      tone: 'text-rose-600 dark:text-rose-400',
    },
  ];

  return (
    <div className="space-y-6" id="my-projects-dashboard">
      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white dark:bg-zinc-900/30 border border-zinc-200/50 dark:border-zinc-900 rounded-2xl px-4 py-3"
          >
            <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-400 font-bold">
              {s.label}
            </p>
            <p className={`text-2xl font-extrabold tabular-nums mt-0.5 ${s.tone}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
            My Projects
          </h1>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
            Browse completed and failed dubbing jobs. Preview, download, duplicate, or remove records.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-zinc-400 mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search projects..."
              aria-label="Search projects"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs text-zinc-800 dark:text-white w-full focus:outline-none placeholder-zinc-400"
            />
          </div>
          <button
            type="button"
            onClick={onBackToStudio}
            className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl text-[11px] font-bold font-mono whitespace-nowrap cursor-pointer"
          >
            New Dub
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200/50 dark:border-zinc-900 rounded-3xl p-12 text-center space-y-3">
          <FolderOpen className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mx-auto" />
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No projects yet</p>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Your dubbing jobs appear here and stay available after refresh.
          </p>
          <button
            type="button"
            onClick={onBackToStudio}
            className="mt-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-mono font-bold cursor-pointer"
          >
            Go to Studio
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((project) => {
            const isActive = activeProjectId === project.id;
            const thumb = project.thumbnailUrl || PLACEHOLDER_THUMB;
            const canPreview = project.status === 'Completed';
            const canDownload = canPreview;

            return (
              <article
                key={project.id}
                className={`bg-white dark:bg-zinc-900/40 border rounded-3xl overflow-hidden flex flex-col ${
                  isActive
                    ? 'border-emerald-500/40 ring-1 ring-emerald-500/20'
                    : 'border-zinc-200/60 dark:border-zinc-900'
                }`}
              >
                <div className="aspect-video bg-zinc-950 relative overflow-hidden">
                  <img
                    src={thumb}
                    alt=""
                    className="w-full h-full object-cover opacity-90"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = PLACEHOLDER_THUMB;
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent" />
                  <span
                    className={`absolute top-3 left-3 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase border ${statusStyles(
                      project.status
                    )}`}
                  >
                    {project.status}
                  </span>
                  {!project.thumbnailUrl && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <FileVideo className="w-8 h-8 text-white/40" />
                    </div>
                  )}
                </div>

                <div className="p-4 space-y-3 flex-1 flex flex-col">
                  <div>
                    <button
                      type="button"
                      onClick={() => onOpenDetails(project.id)}
                      className="text-left w-full cursor-pointer group"
                      title="Open project details"
                    >
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" title={project.title}>
                        {project.title}
                      </h3>
                    </button>
                    <p className="text-[10px] font-mono text-zinc-400 mt-1">
                      {formatCreatedAt(project.createdAt)}
                    </p>
                  </div>

                  {!isTerminal(String(project.status)) && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400">
                        <span className="uppercase tracking-wider font-bold">Processing</span>
                        <span className="tabular-nums">{Math.round(project.progress ?? 0)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-sky-500 transition-all duration-500"
                          style={{ width: `${Math.max(0, Math.min(100, project.progress ?? 0))}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                    <div className="bg-zinc-50 dark:bg-zinc-950/50 rounded-xl px-2.5 py-2 border border-zinc-100 dark:border-zinc-900">
                      <p className="text-zinc-400 uppercase tracking-wider text-[8px] mb-0.5">Original</p>
                      <p className="font-bold text-zinc-800 dark:text-zinc-200 uppercase truncate">
                        {project.originalLanguage || '—'}
                      </p>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-950/50 rounded-xl px-2.5 py-2 border border-zinc-100 dark:border-zinc-900">
                      <p className="text-zinc-400 uppercase tracking-wider text-[8px] mb-0.5">Target</p>
                      <p className="font-bold text-emerald-600 dark:text-emerald-400 uppercase truncate">
                        {project.targetLanguage || '—'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {project.duration || '—'}
                    </span>
                    <span>{project.size || '—'}</span>
                  </div>

                  {project.status === 'Failed' && project.failureReason && (
                    <div className="flex items-start gap-1.5 text-[10px] text-rose-500 bg-rose-500/5 border border-rose-500/15 rounded-xl px-2.5 py-2">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <span className="leading-snug line-clamp-2">{project.failureReason}</span>
                    </div>
                  )}

                  <div className="mt-auto grid grid-cols-5 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => onOpenDetails(project.id)}
                      className="py-2 rounded-xl text-[9px] font-mono font-bold uppercase tracking-wide flex flex-col items-center gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 hover:border-emerald-500/50 cursor-pointer"
                      title="Details"
                    >
                      <Info className="w-3.5 h-3.5" />
                      Details
                    </button>
                    <button
                      type="button"
                      disabled={!canPreview}
                      onClick={() => onPreview(project.id)}
                      className="py-2 rounded-xl text-[9px] font-mono font-bold uppercase tracking-wide flex flex-col items-center gap-1 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 disabled:opacity-35 disabled:cursor-not-allowed hover:border-emerald-500/40 cursor-pointer"
                      title="Preview"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Preview
                    </button>
                    <button
                      type="button"
                      disabled={!canDownload}
                      onClick={() => onDownload(project)}
                      className="py-2 rounded-xl text-[9px] font-mono font-bold uppercase tracking-wide flex flex-col items-center gap-1 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 disabled:opacity-35 disabled:cursor-not-allowed hover:border-emerald-500/40 cursor-pointer"
                      title="Download"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={() => onDuplicate(project.id)}
                      className="py-2 rounded-xl text-[9px] font-mono font-bold uppercase tracking-wide flex flex-col items-center gap-1 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 hover:border-emerald-500/40 cursor-pointer"
                      title="Duplicate"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(project)}
                      className="py-2 rounded-xl text-[9px] font-mono font-bold uppercase tracking-wide flex flex-col items-center gap-1 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 hover:border-rose-500/40 hover:text-rose-500 cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <DeleteProjectDialog
        open={pendingDelete !== null}
        projectTitle={pendingDelete?.title ?? ''}
        isDeleting={isDeleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
