import React, { useState } from 'react';
import { Edit2, Check, RefreshCw, Volume2, Save, User2, Play, Plus, Trash2 } from 'lucide-react';
import { Project, TranscriptSegment } from '../../types';

interface TranscriptEditorProps {
  project: Project | null;
  onUpdateTranscript: (updatedTranscript: TranscriptSegment[]) => void;
  onRegenerateVoice: () => void;
  isRegenerating: boolean;
}

export default function TranscriptEditor({ project, onUpdateTranscript, onRegenerateVoice, isRegenerating }: TranscriptEditorProps) {
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [editOriginalText, setEditOriginalText] = useState('');
  const [editTranslatedText, setEditTranslatedText] = useState('');
  const [editSpeaker, setEditSpeaker] = useState('');
  const [editStart, setEditStart] = useState(0);
  const [editEnd, setEditEnd] = useState(0);

  if (!project) {
    return (
      <div 
        className="bg-white dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-8 text-center shadow-sm dark:shadow-none" 
        id="empty-transcript-editor"
      >
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Select a project to load the interactive Dual Transcript Editor.</p>
      </div>
    );
  }

  const startEditing = (seg: TranscriptSegment) => {
    setEditingSegmentId(seg.id);
    setEditOriginalText(seg.text);
    setEditTranslatedText(seg.translatedText);
    setEditSpeaker(seg.speaker || 'Speaker');
    setEditStart(seg.start);
    setEditEnd(seg.end);
  };

  const saveEditing = (id: string) => {
    const updated = project.transcript.map((seg) => {
      if (seg.id === id) {
        return {
          ...seg,
          text: editOriginalText,
          translatedText: editTranslatedText,
          speaker: editSpeaker,
          start: editStart,
          end: editEnd
        };
      }
      return seg;
    });
    onUpdateTranscript(updated);
    setEditingSegmentId(null);
  };

  const deleteSegment = (id: string) => {
    const filtered = project.transcript.filter((seg) => seg.id !== id);
    onUpdateTranscript(filtered);
  };

  const addSegment = () => {
    const lastSeg = project.transcript[project.transcript.length - 1];
    const newStart = lastSeg ? lastSeg.end : 0;
    const newEnd = newStart + 4.0;
    const newSeg: TranscriptSegment = {
      id: `seg-new-${Date.now()}`,
      start: newStart,
      end: newEnd,
      text: 'Type new original speech here...',
      translatedText: 'Escribe la traducción aquí...',
      speaker: 'New Speaker'
    };
    onUpdateTranscript([...project.transcript, newSeg]);
    startEditing(newSeg);
  };

  return (
    <div 
      className="bg-white dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-6 space-y-4 transition-all shadow-sm dark:shadow-none" 
      id={`transcript-editor-${project.id}`}
    >
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800/80 pb-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Dual Transcript Editor (Whisper v3 ⇄ Meta NLLB)</span>
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Modify text segments, timeline offsets, or add speakers below. Edits synchronize automatically.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={addSegment}
            className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 rounded-lg text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer border border-zinc-200 dark:border-zinc-700"
            title="Insert new segment"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-500" />
            <span>Add Segment</span>
          </button>
          <button
            onClick={onRegenerateVoice}
            disabled={isRegenerating || project.transcript.length === 0}
            className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-lg text-xs font-mono transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:hover:bg-emerald-500 cursor-pointer"
            title="Trigger CosyVoice/XTTS Dub track compilation"
          >
            {isRegenerating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Re-Synthesizing...</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5" />
                <span>Regenerate Voice</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editor Grid Row headers */}
      <div className="hidden lg:grid grid-cols-12 gap-4 text-[10px] font-mono text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider px-2">
        <div className="col-span-2">Speaker & Timeline</div>
        <div className="col-span-5">Original Speech (Faster Whisper)</div>
        <div className="col-span-5">Translated Speech (NLLB-200)</div>
      </div>

      {/* Segments Stack */}
      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1" id="transcript-segments-stack">
        {project.transcript.length === 0 ? (
          <div className="text-center py-8 bg-zinc-50 dark:bg-zinc-950/20 border border-zinc-200 dark:border-zinc-800/45 rounded-xl">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">No dialogue segments available. Click "Add Segment" above.</p>
          </div>
        ) : (
          project.transcript.map((seg) => {
            const isEditing = editingSegmentId === seg.id;

            return (
              <div 
                key={seg.id} 
                className={`p-4 rounded-xl border transition-all ${
                  isEditing 
                    ? 'bg-zinc-50 dark:bg-zinc-950 border-emerald-500/50 dark:border-emerald-500/50 shadow-[0_0_15px_-3px_rgba(16,185,129,0.12)]' 
                    : 'bg-zinc-50/50 dark:bg-zinc-950/40 border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                {isEditing ? (
                  /* EDITING MODE FORM UI */
                  <div className="space-y-3" id={`editing-segment-${seg.id}`}>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 block mb-1 font-bold">SPEAKER TAG</label>
                        <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1">
                          <User2 className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 mr-1.5" />
                          <input
                            type="text"
                            value={editSpeaker}
                            onChange={(e) => setEditSpeaker(e.target.value)}
                            className="bg-transparent text-xs text-zinc-800 dark:text-white w-full focus:outline-none font-sans"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 block mb-1 font-bold">START TIME (SEC)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={editStart}
                          onChange={(e) => setEditStart(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-800 dark:text-white font-mono focus:outline-none focus:border-zinc-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 block mb-1 font-bold">END TIME (SEC)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={editEnd}
                          onChange={(e) => setEditEnd(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-800 dark:text-white font-mono focus:outline-none focus:border-zinc-400"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 block mb-1 font-bold">ORIGINAL TRANSCRIPT TEXT</label>
                        <textarea
                          rows={2}
                          value={editOriginalText}
                          onChange={(e) => setEditOriginalText(e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-xs text-zinc-800 dark:text-white focus:outline-none focus:border-zinc-400 font-sans"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-emerald-600 dark:text-emerald-500 block mb-1 font-bold">TRANSLATED DUB TEXT</label>
                        <textarea
                          rows={2}
                          value={editTranslatedText}
                          onChange={(e) => setEditTranslatedText(e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-xs text-zinc-800 dark:text-white focus:outline-none focus:border-zinc-400 font-sans"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-zinc-200 dark:border-zinc-800">
                      <button
                        onClick={() => deleteSegment(seg.id)}
                        className="text-rose-500 hover:text-rose-600 text-xs flex items-center gap-1 font-mono transition-colors cursor-pointer"
                        title="Delete dialogue chunk"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Segment</span>
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingSegmentId(null)}
                          className="px-3 py-1.5 bg-white dark:bg-zinc-900 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-mono transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveEditing(seg.id)}
                          className="px-3.5 py-1.5 bg-emerald-500 text-zinc-950 rounded-lg text-xs font-bold font-mono transition-all hover:bg-emerald-400 flex items-center gap-1 shadow-sm cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Save Changes</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* DISPLAY READ-ONLY MODE WITH SIDE-BY-SIDE PANELS */
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start relative group/item">
                    {/* Column 1: Metadata */}
                    <div className="lg:col-span-2 flex lg:flex-col justify-between lg:justify-start gap-1 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-zinc-700 dark:text-zinc-300">
                        <User2 className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                        <span>{seg.speaker || 'Voice A'}</span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                        {seg.start.toFixed(1)}s - {seg.end.toFixed(1)}s
                      </span>
                    </div>

                    {/* Column 2: Original Text */}
                    <div className="lg:col-span-5 text-xs text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-900/40 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800/40 leading-relaxed">
                      <p>{seg.text}</p>
                    </div>

                    {/* Column 3: Translated Text */}
                    <div className="lg:col-span-5 text-xs text-zinc-800 dark:text-zinc-100 bg-emerald-500/[0.01] p-2.5 rounded-lg border border-emerald-500/10 dark:border-emerald-500/10 leading-relaxed font-medium">
                      <p>{seg.translatedText}</p>
                    </div>

                    {/* Hover edit trigger button */}
                    <div className="absolute top-2 right-2 flex gap-1 lg:opacity-0 group-hover/item:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEditing(seg)}
                        className="p-1.5 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-md border border-zinc-200 dark:border-zinc-700 transition-all text-xs cursor-pointer shadow-sm"
                        title="Edit segment"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-emerald-500" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
