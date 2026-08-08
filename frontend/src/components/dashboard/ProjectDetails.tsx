import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Clock,
  Download,
  FileVideo,
  Layers,
  History,
  Play,
  RefreshCw,
  Activity,
  FileText,
  FolderOpen,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Project, TranscriptSegment } from '../../types';
import TranscriptEditor from '../chat/TranscriptEditor';
import { getAuthenticatedProjectVideoUrl, resolveProjectMediaUrl } from '../../services/api';

type DetailsTab = 'overview' | 'transcript' | 'timeline' | 'logs' | 'files';

interface ProjectDetailsProps {
  project: Project;
  onBack: () => void;
  onPreview: (id: string) => void;
  onDownload: (project: Project) => void;
  onSaveTranscript: (updatedTranscript: TranscriptSegment[]) => void;
}

const TABS: { id: DetailsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <Sparkles className="w-3.5 h-3.5" /> },
  { id: 'transcript', label: 'Transcript', icon: <FileText className="w-3.5 h-3.5" /> },
  { id: 'timeline', label: 'Timeline', icon: <Clock className="w-3.5 h-3.5" /> },
  { id: 'logs', label: 'Logs', icon: <Activity className="w-3.5 h-3.5" /> },
  { id: 'files', label: 'Files', icon: <FolderOpen className="w-3.5 h-3.5" /> },
];

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

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-zinc-200/60 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40 px-3.5 py-3">
      <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-400 font-bold">
        {label}
      </span>
      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 break-words">
        {value ?? '—'}
      </span>
    </div>
  );
}

function ComingSoonBanner({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/30 px-4 py-5 flex items-start gap-3">
      <div className="mt-0.5 p-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <Layers className="w-4 h-4 text-zinc-400" />
      </div>
      <div>
        <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{title}</p>
        <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{description}</p>
        <span className="inline-block mt-2 text-[9px] font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
          Coming soon
        </span>
      </div>
    </div>
  );
}

export default function ProjectDetails({
  project,
  onBack,
  onPreview,
  onDownload,
  onSaveTranscript,
}: ProjectDetailsProps) {
  const [tab, setTab] = useState<DetailsTab>('overview');
  const [liveTranscript, setLiveTranscript] = useState<TranscriptSegment[]>(
    () => project.transcript || []
  );

  useEffect(() => {
    setLiveTranscript(project.transcript || []);
  }, [project.id, project.transcript]);

  const handleDraftChange = useCallback((draft: TranscriptSegment[]) => {
    setLiveTranscript(draft);
  }, []);

  const canPreview = project.status === 'Completed';
  const outputUrl = resolveProjectMediaUrl(project, 'video');

  const openSecureVideo = async () => {
    if (!project.id) return;
    try {
      const url = await getAuthenticatedProjectVideoUrl(project.id, true);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.error(e);
    }
  };

  const voiceLabel =
    project.voiceSettings?.voiceName ||
    project.voiceKey ||
    '—';

  const translationModel = project.translationModel || '—';
  const ttsModel = project.ttsModel || '—';
  const resolution = project.resolution || '—';
  const fps = project.fps != null && Number.isFinite(project.fps) ? `${project.fps} fps` : '—';
  const processingTime = project.processingTime || '—';
  const fileSize =
    project.size && project.size !== 'N/A' ? project.size : '—';
  const duration =
    project.duration && project.duration !== '00:00' ? project.duration : (project.duration || '—');

  const timelineSegments = liveTranscript.length > 0 ? liveTranscript : (project.transcript || []);

  const timelineMax = useMemo(() => {
    const ends = timelineSegments.map((s) => s.end || 0);
    return Math.max(1, ...ends);
  }, [timelineSegments]);

  const renders = project.renders || [];
  const versions = project.versions || [];

  return (
    <div className="space-y-6" id={`project-details-${project.id}`}>
      {/* Header */}
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to My Projects
        </button>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase border ${statusStyles(
                  project.status
                )}`}
              >
                {project.status}
              </span>
              <span className="text-[10px] font-mono text-zinc-400">
                ID {project.id.slice(0, 12)}
                {project.id.length > 12 ? '…' : ''}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white truncate">
              {project.title || 'Untitled Project'}
            </h1>
            <p className="text-xs text-zinc-400">
              Created {formatCreatedAt(project.createdAt)}
              {project.completedAt ? ` · Completed ${formatCreatedAt(project.completedAt)}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!canPreview}
              onClick={() => onPreview(project.id)}
              className="px-3.5 py-2 rounded-xl text-[11px] font-mono font-bold uppercase bg-emerald-500 hover:bg-emerald-400 text-zinc-950 disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              Preview
            </button>
            <button
              type="button"
              disabled={!canPreview}
              onClick={() => onDownload(project)}
              className="px-3.5 py-2 rounded-xl text-[11px] font-mono font-bold uppercase bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-zinc-200/70 dark:border-zinc-800 pb-px">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-2.5 text-[11px] font-mono font-bold uppercase tracking-wide rounded-t-xl border border-b-0 cursor-pointer flex items-center gap-1.5 transition-colors ${
                active
                  ? 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white'
                  : 'bg-transparent border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab panels */}
      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            <MetaRow label="Project Name" value={project.title || '—'} />
            <MetaRow label="Status" value={project.status || '—'} />
            <MetaRow label="Created Date" value={formatCreatedAt(project.createdAt)} />
            <MetaRow label="Duration" value={duration} />
            <MetaRow label="File Size" value={fileSize} />
            <MetaRow label="Resolution" value={resolution} />
            <MetaRow label="FPS" value={fps} />
            <MetaRow label="Original Language" value={project.originalLanguage || '—'} />
            <MetaRow label="Target Language" value={project.targetLanguage || '—'} />
            <MetaRow
              label="Voice"
              value={
                project.voiceKey
                  ? `${voiceLabel} (${project.voiceKey})`
                  : voiceLabel
              }
            />
            <MetaRow label="Translation Model" value={translationModel} />
            <MetaRow label="TTS Model" value={ttsModel} />
            <MetaRow
              label="Output Video"
              value={
                outputUrl ? (
                  <button
                    type="button"
                    onClick={openSecureVideo}
                    className="text-left text-emerald-600 dark:text-emerald-400 hover:underline text-xs font-mono break-all cursor-pointer"
                  >
                    /api/projects/{project.id}/video
                  </button>
                ) : (
                  'Not available'
                )
              }
            />
            <MetaRow label="Processing Time" value={processingTime} />
          </div>

          {project.status !== 'Completed' && project.status !== 'Failed' && (
            <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 px-4 py-4 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-400 font-bold">
                  Processing progress
                </span>
                <span className="text-[10px] font-mono text-sky-600 dark:text-sky-400 font-bold tabular-nums">
                  {Math.round(project.progress ?? 0)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-sky-500 transition-all duration-500"
                  style={{ width: `${Math.max(0, Math.min(100, project.progress ?? 0))}%` }}
                />
              </div>
              {Array.isArray(project.steps) && project.steps.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {project.steps.map((s) => (
                    <span
                      key={s.name}
                      className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase border ${
                        s.status === 'completed'
                          ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500/25 bg-emerald-500/5'
                          : s.status === 'processing'
                            ? 'text-sky-600 dark:text-sky-400 border-sky-500/25 bg-sky-500/5'
                            : s.status === 'failed'
                              ? 'text-rose-600 dark:text-rose-400 border-rose-500/25 bg-rose-500/5'
                              : 'text-zinc-400 border-zinc-200 dark:border-zinc-800'
                      }`}
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {project.status === 'Failed' && (project.failureReason || project.errorDetails) && (
            <div className="flex items-start gap-2 text-xs text-rose-500 bg-rose-500/5 border border-rose-500/15 rounded-2xl px-4 py-3">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold mb-0.5">Failure</p>
                <p className="leading-relaxed">{project.failureReason || project.errorDetails}</p>
                {project.failedStep && (
                  <p className="mt-1 font-mono text-[10px] opacity-80">Step: {project.failedStep}</p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ComingSoonBanner
              title="Segment regeneration"
              description="Re-run TTS for individual edited segments without rebuilding the full video. Backend endpoint arrives in a later sprint."
            />
            <ComingSoonBanner
              title="Version history"
              description="Snapshot transcript and render revisions so you can compare and restore prior dubs."
            />
          </div>
        </div>
      )}

      {tab === 'transcript' && (
        <div className="space-y-4">
          <TranscriptEditor
            project={project}
            onSaveTranscript={onSaveTranscript}
            onDraftChange={handleDraftChange}
          />
          <ComingSoonBanner
            title="Per-segment regenerate"
            description="After editing a translation, regenerate only that segment’s audio. UI action exists in the editor; backend wiring comes later."
          />
        </div>
      )}

      {tab === 'timeline' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200/50 dark:border-zinc-900 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-900 dark:text-white">
                  Segment Timeline
                </h3>
                <p className="text-[10px] text-zinc-400 mt-1">
                  Read-only timeline of speech segments. Edit text in Transcript; regenerate later without full re-render.
                </p>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">
                {timelineSegments.length} segments · {timelineMax.toFixed(1)}s
              </span>
            </div>

            {timelineSegments.length === 0 ? (
              <div className="text-center py-10 text-xs text-zinc-500 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                No timeline segments for this project.
              </div>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {timelineSegments.map((seg, index) => {
                  const left = Math.max(0, (seg.start / timelineMax) * 100);
                  const width = Math.max(
                    1.5,
                    ((Math.max(seg.end, seg.start) - seg.start) / timelineMax) * 100
                  );
                  const edited = Boolean(seg.isEdited);
                  return (
                    <div key={seg.id} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-zinc-500">
                        <span>
                          #{index + 1} · {seg.start.toFixed(2)}s → {seg.end.toFixed(2)}s
                          {edited && (
                            <span className="ml-2 text-amber-600 dark:text-amber-400 font-bold uppercase">
                              Edited
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          disabled
                          title="Backend regeneration comes later"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 opacity-50 cursor-not-allowed text-[9px] font-bold uppercase"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Regenerate
                        </button>
                      </div>
                      <div className="relative h-8 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-200/70 dark:border-zinc-800 overflow-hidden">
                        <div
                          className={`absolute top-1 bottom-1 rounded-md ${
                            edited
                              ? 'bg-amber-500/35 border border-amber-500/40'
                              : 'bg-emerald-500/30 border border-emerald-500/35'
                          }`}
                          style={{ left: `${left}%`, width: `${width}%` }}
                          title={seg.translatedText || seg.text}
                        />
                      </div>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-300 line-clamp-1">
                        {seg.translatedText || seg.text || '—'}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'logs' && (
        <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200/50 dark:border-zinc-900 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-900 dark:text-white">
              Processing Logs
            </h3>
            <span className="text-[10px] font-mono text-zinc-500">
              {(project.logs || []).length} entries
            </span>
          </div>
          {(project.logs || []).length === 0 ? (
            <div className="text-center py-10 text-xs text-zinc-500 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
              No logs recorded for this project.
            </div>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto font-mono text-[11px]">
              {(project.logs || []).map((log) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-zinc-200/60 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-center gap-2 text-[9px] text-zinc-400 mb-1">
                    <span>{formatCreatedAt(log.timestamp)}</span>
                    <span
                      className={`uppercase font-bold ${
                        log.level === 'error'
                          ? 'text-rose-500'
                          : log.level === 'warning'
                            ? 'text-amber-500'
                            : 'text-emerald-500'
                      }`}
                    >
                      {log.level}
                    </span>
                    {log.step && (
                      <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                        {log.step}
                      </span>
                    )}
                  </div>
                  <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">{log.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'files' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200/50 dark:border-zinc-900 rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-900 dark:text-white">
              Project Files
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200/60 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 px-3.5 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileVideo className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Output Video</p>
                    <p className="text-[10px] font-mono text-zinc-400 truncate">
                      {outputUrl ? `/api/projects/${project.id}/video` : 'No output yet'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    disabled={!canPreview}
                    onClick={() => onPreview(project.id)}
                    className="px-2.5 py-1.5 rounded-lg text-[9px] font-mono font-bold uppercase border border-zinc-200 dark:border-zinc-800 disabled:opacity-40 cursor-pointer"
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    disabled={!canPreview}
                    onClick={() => onDownload(project)}
                    className="px-2.5 py-1.5 rounded-lg text-[9px] font-mono font-bold uppercase border border-zinc-200 dark:border-zinc-800 disabled:opacity-40 cursor-pointer"
                  >
                    Download
                  </button>
                </div>
              </div>

              {project.thumbnailUrl && (
                <div className="flex items-center gap-3 rounded-xl border border-zinc-200/60 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 px-3.5 py-3">
                  <img
                    src={project.thumbnailUrl}
                    alt=""
                    className="w-14 h-9 object-cover rounded-lg border border-zinc-200 dark:border-zinc-800"
                  />
                  <div>
                    <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Thumbnail</p>
                    <p className="text-[10px] font-mono text-zinc-400">Preview frame</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200/50 dark:border-zinc-900 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-900 dark:text-white flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-zinc-400" />
                Multiple Renders
              </h3>
              <span className="text-[9px] font-mono font-bold uppercase text-zinc-400">
                {renders.length} stored
              </span>
            </div>
            {renders.length === 0 ? (
              <ComingSoonBanner
                title="Multiple renders"
                description="Store alternate dubbed outputs (voice A/B, pacing variants) under one project without re-uploading source media."
              />
            ) : (
              <div className="space-y-2">
                {renders.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 px-3 py-2.5 text-xs"
                  >
                    <p className="font-bold text-zinc-800 dark:text-zinc-200">{r.label}</p>
                    <p className="text-[10px] font-mono text-zinc-400 mt-0.5">
                      {r.status} · {formatCreatedAt(r.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200/50 dark:border-zinc-900 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-900 dark:text-white flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-zinc-400" />
                Version History
              </h3>
              <span className="text-[9px] font-mono font-bold uppercase text-zinc-400">
                {versions.length} versions
              </span>
            </div>
            {versions.length === 0 ? (
              <ComingSoonBanner
                title="Version history"
                description="Track transcript edits and render snapshots over time. Restore a prior version without touching the pipeline."
              />
            ) : (
              <div className="space-y-2">
                {versions.map((v) => (
                  <div
                    key={v.id}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 px-3 py-2.5 text-xs"
                  >
                    <p className="font-bold text-zinc-800 dark:text-zinc-200">{v.label}</p>
                    <p className="text-[10px] font-mono text-zinc-400 mt-0.5">
                      {formatCreatedAt(v.createdAt)}
                      {v.summary ? ` · ${v.summary}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
