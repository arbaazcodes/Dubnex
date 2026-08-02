import React, { useEffect, useMemo, useState } from 'react';
import { Clock, RefreshCw, RotateCcw, Save, Pencil, Sparkles } from 'lucide-react';
import { Project, TranscriptSegment } from '../../types';

interface TranscriptEditorProps {
  project: Project;
  onSaveTranscript: (updatedTranscript: TranscriptSegment[]) => void;
  onRegenerateSegment?: (segmentId: string) => void;
  /** Live draft updates so Timeline can mirror edits before Save */
  onDraftChange?: (draft: TranscriptSegment[]) => void;
}

function normalizeSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  return segments.map((seg) => ({
    ...seg,
    baselineTranslatedText:
      seg.baselineTranslatedText !== undefined
        ? seg.baselineTranslatedText
        : seg.translatedText,
    isEdited: Boolean(seg.isEdited),
  }));
}

export default function TranscriptEditor({
  project,
  onSaveTranscript,
  onRegenerateSegment,
  onDraftChange,
}: TranscriptEditorProps) {
  const [draft, setDraft] = useState<TranscriptSegment[]>(() =>
    normalizeSegments(project.transcript || [])
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [regenNotice, setRegenNotice] = useState<string | null>(null);

  useEffect(() => {
    setDraft(normalizeSegments(project.transcript || []));
    setEditingId(null);
    setSaveNotice(null);
  }, [project.id, project.transcript]);

  useEffect(() => {
    onDraftChange?.(draft);
  }, [draft, onDraftChange]);

  const hasUnsavedChanges = useMemo(() => {
    const persisted = normalizeSegments(project.transcript || []);
    if (persisted.length !== draft.length) return true;
    return draft.some((seg, i) => {
      const p = persisted[i];
      return (
        !p ||
        p.id !== seg.id ||
        p.translatedText !== seg.translatedText ||
        Boolean(p.isEdited) !== Boolean(seg.isEdited)
      );
    });
  }, [draft, project.transcript]);

  const unsavedCount = useMemo(() => {
    const persisted = normalizeSegments(project.transcript || []);
    return draft.filter((seg) => {
      const p = persisted.find((x) => x.id === seg.id);
      return !p || p.translatedText !== seg.translatedText || Boolean(p.isEdited) !== Boolean(seg.isEdited);
    }).length;
  }, [draft, project.transcript]);

  const updateTranslated = (id: string, value: string) => {
    setDraft((prev) =>
      prev.map((seg) => {
        if (seg.id !== id) return seg;
        const baseline = seg.baselineTranslatedText ?? seg.translatedText;
        return {
          ...seg,
          translatedText: value,
          isEdited: value !== baseline,
        };
      })
    );
  };

  const handleSave = () => {
    const next = draft.map((seg) => {
      const baseline = seg.baselineTranslatedText ?? seg.translatedText;
      return {
        ...seg,
        baselineTranslatedText: baseline,
        isEdited: seg.translatedText !== baseline,
      };
    });
    onSaveTranscript(next);
    setDraft(next);
    setEditingId(null);
    setSaveNotice('Transcript edits saved to project.');
    window.setTimeout(() => setSaveNotice(null), 2500);
  };

  const handleRevert = () => {
    const reverted = draft.map((seg) => {
      const baseline = seg.baselineTranslatedText ?? seg.translatedText;
      return {
        ...seg,
        translatedText: baseline,
        isEdited: false,
      };
    });
    setDraft(reverted);
    onSaveTranscript(reverted);
    setEditingId(null);
    setSaveNotice('All segment translations reverted.');
    window.setTimeout(() => setSaveNotice(null), 2500);
  };

  const handleRevertSegment = (id: string) => {
    setDraft((prev) =>
      prev.map((seg) => {
        if (seg.id !== id) return seg;
        const baseline = seg.baselineTranslatedText ?? seg.translatedText;
        return {
          ...seg,
          translatedText: baseline,
          isEdited: false,
        };
      })
    );
  };

  const handleRegenerateSegment = (id: string) => {
    if (onRegenerateSegment) {
      onRegenerateSegment(id);
      return;
    }
    setRegenNotice('Segment regeneration will connect to the backend in a later sprint.');
    window.setTimeout(() => setRegenNotice(null), 3500);
  };

  return (
    <div
      className="bg-white dark:bg-zinc-900/30 border border-zinc-200/50 dark:border-zinc-900 rounded-2xl p-5 space-y-4 text-left"
      id={`timeline-transcript-editor-${project.id}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
        <div>
          <h4 className="text-xs font-mono font-bold text-zinc-900 dark:text-white uppercase tracking-widest flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-500" />
            Timeline Transcript Editor
          </h4>
          <p className="text-[10px] text-zinc-400 mt-1">
            Timestamps are read-only. Edit translated text inline, then Save. Full video is not regenerated.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRevert}
            disabled={draft.length === 0}
            className="px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wide bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Revert
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasUnsavedChanges}
            className="px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wide bg-emerald-500 hover:bg-emerald-400 text-zinc-950 disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            Save{unsavedCount > 0 ? ` (${unsavedCount})` : ''}
          </button>
        </div>
      </div>

      {(saveNotice || regenNotice) && (
        <div className="text-[10px] font-mono px-3 py-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400">
          {saveNotice || regenNotice}
        </div>
      )}

      <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
        {draft.length === 0 ? (
          <div className="text-center py-8 text-xs text-zinc-500 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
            No transcript segments available for this project.
          </div>
        ) : (
          draft.map((seg, index) => {
            const isEditing = editingId === seg.id;
            const baseline = seg.baselineTranslatedText ?? seg.translatedText;
            const edited = seg.translatedText !== baseline || Boolean(seg.isEdited);

            return (
              <div
                key={seg.id}
                className={`rounded-xl border p-3.5 space-y-3 ${
                  edited
                    ? 'border-amber-500/35 bg-amber-500/[0.03]'
                    : 'border-zinc-200/60 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-950/30'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500">
                    <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                      #{index + 1}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                      {seg.start.toFixed(2)}s → {seg.end.toFixed(2)}s
                    </span>
                    {edited && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 font-bold uppercase tracking-wider">
                        Edited
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditingId(isEditing ? null : seg.id)}
                      className="px-2 py-1 rounded-lg text-[9px] font-mono font-bold uppercase bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 cursor-pointer flex items-center gap-1"
                    >
                      <Pencil className="w-3 h-3 text-emerald-500" />
                      {isEditing ? 'Done' : 'Edit'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRevertSegment(seg.id)}
                      disabled={!edited}
                      className="px-2 py-1 rounded-lg text-[9px] font-mono font-bold uppercase bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 disabled:opacity-35 cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Revert
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRegenerateSegment(seg.id)}
                      className="px-2 py-1 rounded-lg text-[9px] font-mono font-bold uppercase bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 cursor-pointer flex items-center gap-1"
                      title="Backend regeneration comes later"
                    >
                      <RefreshCw className="w-3 h-3 text-sky-500" />
                      Regenerate
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-400 font-bold">
                      Original
                    </p>
                    <div className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-950/50 border border-zinc-200/70 dark:border-zinc-800 rounded-lg p-2.5 min-h-[56px]">
                      {seg.text || '—'}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[9px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-500 font-bold flex items-center gap-1">
                      Translated
                      {isEditing && <Sparkles className="w-3 h-3" />}
                    </p>
                    {isEditing ? (
                      <textarea
                        rows={3}
                        value={seg.translatedText}
                        onChange={(e) => updateTranslated(seg.id, e.target.value)}
                        className="w-full text-[11px] leading-relaxed text-zinc-800 dark:text-zinc-100 bg-white dark:bg-zinc-950 border border-emerald-500/40 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans resize-y min-h-[56px]"
                      />
                    ) : (
                      <div className="text-[11px] leading-relaxed text-zinc-800 dark:text-zinc-100 bg-emerald-500/[0.03] border border-emerald-500/15 rounded-lg p-2.5 min-h-[56px]">
                        {seg.translatedText || '—'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
