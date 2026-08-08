// ChatView - AI Studio Intelligence Suite (chatbot / intelligence / live) right column.
import { toast } from 'sonner';
import {
  MessageSquare,
  Brain,
  Activity,
  Send,
  Bot,
  Mic,
  MicOff,
  Sparkles,
  ClipboardCopy,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import type { FormEvent } from 'react';
import type { RefObject } from 'react';
import type { AuthUser } from '../../lib/firebase';
import type { TranscriptSegment } from '../../types';
import type {
  TranscriptAnalysisResult,
  ImprovedTranscriptResult,
  ImprovedTranslationResult,
} from '../../hooks/useChat';

interface ChatViewProps {
  user: AuthUser | null;
  /** Save transcript segments back to the active project (used by AI apply actions). */
  onApplyTranscript: (next: TranscriptSegment[]) => void;
  aiSuiteTab: 'chatbot' | 'intelligence' | 'live';
  setAiSuiteTab: (tab: 'chatbot' | 'intelligence' | 'live') => void;
  chatMessages: { role: 'user' | 'assistant'; content: string; timestamp: string }[];
  chatInput: string;
  setChatInput: (value: string) => void;
  chatRole: 'director' | 'language' | 'coach';
  setChatRole: (role: 'director' | 'language' | 'coach') => void;
  chatModel: 'gemini-3.1-pro-preview' | 'gemini-3.5-flash' | 'gemini-3.1-flash-lite';
  setChatModel: (model: 'gemini-3.1-pro-preview' | 'gemini-3.5-flash' | 'gemini-3.1-flash-lite') => void;
  chatLoading: boolean;
  handleSendChatMessage: (event: FormEvent) => void;
  chatEndRef: RefObject<HTMLDivElement | null>;
  videoAnalysis: string | null;
  analystQuery: string;
  setAnalystQuery: (query: string) => void;
  analysisLoading: boolean;
  runVideoAnalysis: () => void;
  transcriptAnalysis: TranscriptAnalysisResult | null;
  transcriptAnalysisLoading: boolean;
  transcriptAnalysisError: string | null;
  runTranscriptAnalysis: () => void;
  improvedTranscript: ImprovedTranscriptResult | null;
  improveTranscriptLoading: boolean;
  improveTranscriptError: string | null;
  runImproveTranscript: () => void;
  improvedTranslation: ImprovedTranslationResult | null;
  improveTranslationLoading: boolean;
  improveTranslationError: string | null;
  runImproveTranslation: () => void;
  buildAppliedTranscript: () => TranscriptSegment[] | null;
  buildAppliedTranslation: () => TranscriptSegment[] | null;
  recording: boolean;
  recordingDuration: number;
  audioBlob: Blob | null;
  transcribedText: string;
  transcribing: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  transcribeRecording: () => void;
  liveVoiceActive: boolean;
  liveCaptions: string[];
  liveStatusText: string;
  toggleLiveVoiceSession: () => void;
}

export default function ChatView(props: ChatViewProps) {
  const {
    user,
    aiSuiteTab,
    setAiSuiteTab,
    chatMessages,
    chatInput,
    setChatInput,
    chatRole,
    setChatRole,
    chatModel,
    setChatModel,
    chatLoading,
    handleSendChatMessage,
    chatEndRef,
    videoAnalysis,
    analystQuery,
    setAnalystQuery,
    analysisLoading,
    runVideoAnalysis,
    transcriptAnalysis,
    transcriptAnalysisLoading,
    transcriptAnalysisError,
    runTranscriptAnalysis,
    improvedTranscript,
    improveTranscriptLoading,
    improveTranscriptError,
    runImproveTranscript,
    improvedTranslation,
    improveTranslationLoading,
    improveTranslationError,
    runImproveTranslation,
    buildAppliedTranscript,
    buildAppliedTranslation,
    onApplyTranscript,
    recording,
    recordingDuration,
    audioBlob,
    transcribedText,
    transcribing,
    startRecording,
    stopRecording,
    transcribeRecording,
    liveVoiceActive,
    liveCaptions,
    liveStatusText,
    toggleLiveVoiceSession,
  } = props;

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Could not copy text');
    }
  };

  const applyImprovedTranscript = () => {
    const next = buildAppliedTranscript();
    if (!next) {
      toast.error('Could not map improved text back to segments. Use Copy instead.');
      return;
    }
    onApplyTranscript(next);
    toast.success('Improved transcript applied to project.');
  };

  const applyImprovedTranslation = () => {
    const next = buildAppliedTranslation();
    if (!next) {
      toast.error('No improvements to apply.');
      return;
    }
    onApplyTranscript(next);
    toast.success('Improved translations applied to project.');
  };

  return (
        <section className="lg:col-span-5 xl:col-span-4 flex flex-col">
          <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200/50 dark:border-zinc-900 rounded-3xl overflow-hidden flex flex-col h-[650px] shadow-sm">
            
            {/* Tab selection menu */}
            <div className="flex bg-zinc-50 dark:bg-zinc-950/60 border-b border-zinc-100 dark:border-zinc-900 select-none shrink-0">
              <button
                onClick={() => setAiSuiteTab('chatbot')}
                className={`flex-1 py-3 text-[11px] font-mono font-bold uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-1.5 cursor-pointer ${
                  aiSuiteTab === 'chatbot' 
                    ? 'border-emerald-500 text-emerald-500 bg-emerald-500/[0.02]' 
                    : 'border-transparent text-zinc-400 hover:text-zinc-300'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chatbot</span>
              </button>
              
              <button
                onClick={() => setAiSuiteTab('intelligence')}
                className={`flex-1 py-3 text-[11px] font-mono font-bold uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-1.5 cursor-pointer ${
                  aiSuiteTab === 'intelligence' 
                    ? 'border-emerald-500 text-emerald-500 bg-emerald-500/[0.02]' 
                    : 'border-transparent text-zinc-400 hover:text-zinc-300'
                }`}
              >
                <Brain className="w-3.5 h-3.5" />
                <span>Analysis</span>
              </button>

              <button
                onClick={() => setAiSuiteTab('live')}
                className={`flex-1 py-3 text-[11px] font-mono font-bold uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-1.5 cursor-pointer ${
                  aiSuiteTab === 'live' 
                    ? 'border-emerald-500 text-emerald-500 bg-emerald-500/[0.02]' 
                    : 'border-transparent text-zinc-400 hover:text-zinc-300'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Voice</span>
              </button>
            </div>

            {/* TAB BODY INTERFACES */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col min-h-0 bg-white/50 dark:bg-zinc-950/10">
              
              {/* TAB 1: MULTI-TURN CHATBOT COMPANION */}
              {aiSuiteTab === 'chatbot' && (
                <div className="flex-1 flex flex-col h-full min-h-0 space-y-4">
                  
                  {/* Model Selector and System Role configuration */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] bg-zinc-50 dark:bg-zinc-950/65 p-2.5 rounded-xl border border-zinc-200/40 dark:border-zinc-900">
                    <div className="space-y-1">
                      <span className="text-zinc-400 font-mono uppercase block font-bold">Bot Role</span>
                      <select
                        value={chatRole}
                        onChange={(e: any) => setChatRole(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-1.5 py-1 text-[10px] focus:outline-none"
                      >
                        <option value="director">Production Director</option>
                        <option value="language">Language Coach</option>
                        <option value="coach">Vocal Synthesizer</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <span className="text-zinc-400 font-mono uppercase block font-bold">Gemini Model</span>
                      <select
                        value={chatModel}
                        onChange={(e: any) => setChatModel(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-1.5 py-1 text-[10px] focus:outline-none"
                      >
                        <option value="gemini-3.1-pro-preview">3.1 Pro (Reasoning)</option>
                        <option value="gemini-3.5-flash">3.5 Flash (General)</option>
                        <option value="gemini-3.1-flash-lite">3.1 Lite (Fast)</option>
                      </select>
                    </div>

                  </div>

                  {/* Message Thread panel */}
                  <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 min-h-0 text-[11px] leading-relaxed">
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                          msg.role === 'user' 
                            ? 'bg-emerald-500 text-zinc-950 font-medium rounded-tr-none' 
                            : 'bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/40 dark:border-zinc-850 text-zinc-800 dark:text-zinc-300 rounded-tl-none'
                        }`}>
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                        <span className="text-[8px] text-zinc-400 font-mono mt-1 px-1">{msg.timestamp}</span>
                      </div>
                    ))}
                    
                    {chatLoading && (
                      <div className="flex items-center gap-1.5 text-zinc-400 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-150 dark:border-zinc-850 px-3 py-2 rounded-xl self-start">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                        <span className="text-[9px] font-mono uppercase ml-1">Assistant is reasoning...</span>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Chat input box */}
                  <form onSubmit={handleSendChatMessage} className="flex gap-2 shrink-0 select-none">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask the dubbing coach anything..."
                      aria-label="Message the dubbing coach"
                      className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl px-3 py-2.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
                    />
                    <button
                      type="submit"
                      disabled={chatLoading}
                      aria-label="Send message"
                      className="px-3.5 bg-emerald-500 text-zinc-950 rounded-xl hover:bg-emerald-400 flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <Send className="w-3.5 h-3.5 font-bold" aria-hidden />
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 2: INTELLIGENCE ANALYSIS & SPEECH TRANSCRIPTION */}
              {aiSuiteTab === 'intelligence' && (
                <div className="flex-1 flex flex-col h-full min-h-0 space-y-6">
                  
                  {/* VIDEO ANALYST UNIT */}
                  <div className="space-y-3 bg-zinc-50 dark:bg-zinc-950/60 p-4 rounded-2xl border border-zinc-200/30 dark:border-zinc-900 flex flex-col text-left">
                    <div className="flex items-center gap-2 select-none">
                      <Brain className="w-4 h-4 text-emerald-500" />
                      <span className="text-[10px] font-mono uppercase tracking-widest font-extrabold text-zinc-900 dark:text-white">Video Analysis</span>
                    </div>

                    <p className="text-[10px] text-zinc-400 leading-normal">
                      Sends the current video's title, duration, and transcript to the backend analysis endpoint and displays the returned report.
                    </p>

                    <div className="space-y-2 select-none">
                      <input
                        type="text"
                        value={analystQuery}
                        onChange={(e) => setAnalystQuery(e.target.value)}
                        placeholder="e.g. Find timeline errors, recommend vocal tuning..."
                        aria-label="Video analysis query"
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-[10.5px] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          onClick={runVideoAnalysis}
                          disabled={analysisLoading}
                          className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-emerald-500 rounded-xl text-[10px] font-bold font-mono transition-colors border border-emerald-500/10 cursor-pointer flex items-center gap-1"
                        >
                          {analysisLoading ? "Analyzing..." : "Run Analysis"}
                        </button>
                      </div>
                    </div>

                    {/* Analysis results panel */}
                    {videoAnalysis && (
                      <div className="mt-3 bg-white dark:bg-zinc-950 p-3.5 rounded-xl border border-zinc-200/40 dark:border-zinc-850 text-[11px] leading-relaxed text-zinc-300 max-h-[160px] overflow-y-auto">
                        <div className="prose dark:prose-invert prose-xs text-zinc-800 dark:text-zinc-300">
                          <p className="whitespace-pre-wrap font-sans">{videoAnalysis}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* TRANSCRIPT INTELLIGENCE UNIT */}
                  <div className="space-y-3 bg-zinc-50 dark:bg-zinc-950/60 p-4 rounded-2xl border border-zinc-200/30 dark:border-zinc-900 text-left flex flex-col">
                    <div className="flex items-center gap-2 select-none">
                      <Sparkles className="w-4 h-4 text-emerald-500" />
                      <span className="text-[10px] font-mono uppercase tracking-widest font-extrabold text-zinc-900 dark:text-white">Transcript Intelligence</span>
                    </div>

                    <p className="text-[10px] text-zinc-400 leading-normal select-none">
                      AI analysis, script polish, and translation refinement for the active project&apos;s transcript. Improvements are shown before applying.
                    </p>

                    <div className="flex flex-wrap items-center gap-2 select-none">
                      <button
                        onClick={runTranscriptAnalysis}
                        disabled={transcriptAnalysisLoading || improveTranscriptLoading || improveTranslationLoading}
                        className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-emerald-500 rounded-xl text-[10px] font-bold font-mono transition-colors border border-emerald-500/10 cursor-pointer disabled:opacity-40"
                      >
                        {transcriptAnalysisLoading ? 'Analyzing...' : 'Analyze Script'}
                      </button>
                      <button
                        onClick={runImproveTranscript}
                        disabled={transcriptAnalysisLoading || improveTranscriptLoading || improveTranslationLoading}
                        className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-emerald-500 rounded-xl text-[10px] font-bold font-mono transition-colors border border-emerald-500/10 cursor-pointer disabled:opacity-40"
                      >
                        {improveTranscriptLoading ? 'Polishing...' : 'Improve Script'}
                      </button>
                      <button
                        onClick={runImproveTranslation}
                        disabled={transcriptAnalysisLoading || improveTranscriptLoading || improveTranslationLoading}
                        className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-emerald-500 rounded-xl text-[10px] font-bold font-mono transition-colors border border-emerald-500/10 cursor-pointer disabled:opacity-40"
                      >
                        {improveTranslationLoading ? 'Refining...' : 'Refine Translation'}
                      </button>
                    </div>

                    {/* Analysis result */}
                    {transcriptAnalysisError && (
                      <div className="flex items-center justify-between gap-2 bg-rose-500/10 border border-rose-500/25 rounded-xl px-3 py-2 text-[10px] text-rose-500">
                        <span className="flex items-center gap-1.5">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          {transcriptAnalysisError}
                        </span>
                        <button
                          onClick={runTranscriptAnalysis}
                          className="flex items-center gap-1 font-bold font-mono uppercase tracking-wider hover:underline cursor-pointer shrink-0"
                        >
                          <RefreshCw className="w-3 h-3" /> Retry
                        </button>
                      </div>
                    )}
                    {transcriptAnalysis && !transcriptAnalysisLoading && (
                      <div className="mt-1 bg-white dark:bg-zinc-950 p-3.5 rounded-xl border border-zinc-200/40 dark:border-zinc-850 text-[10.5px] leading-relaxed text-zinc-800 dark:text-zinc-300 space-y-2 max-h-[220px] overflow-y-auto">
                        <p className="text-[8px] font-mono text-emerald-500 uppercase tracking-wider font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Analysis Complete{transcriptAnalysis.provider ? ` · ${transcriptAnalysis.provider}` : ''}
                        </p>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                          {transcriptAnalysis.topic && (
                            <p><span className="text-zinc-400 font-mono uppercase text-[8px] font-bold block">Topic</span>{transcriptAnalysis.topic}</p>
                          )}
                          {transcriptAnalysis.tone && (
                            <p><span className="text-zinc-400 font-mono uppercase text-[8px] font-bold block">Tone</span>{transcriptAnalysis.tone}</p>
                          )}
                          {transcriptAnalysis.speaking_style && (
                            <p><span className="text-zinc-400 font-mono uppercase text-[8px] font-bold block">Speaking Style</span>{transcriptAnalysis.speaking_style}</p>
                          )}
                          {transcriptAnalysis.audience && (
                            <p><span className="text-zinc-400 font-mono uppercase text-[8px] font-bold block">Audience</span>{transcriptAnalysis.audience}</p>
                          )}
                          {transcriptAnalysis.quality && (
                            <p><span className="text-zinc-400 font-mono uppercase text-[8px] font-bold block">Quality</span>{transcriptAnalysis.quality}</p>
                          )}
                        </div>
                        {!!transcriptAnalysis.key_points?.length && (
                          <div>
                            <p className="text-zinc-400 font-mono uppercase text-[8px] font-bold">Key Points</p>
                            <ul className="list-disc pl-4 space-y-0.5">
                              {transcriptAnalysis.key_points.map((k, i) => (
                                <li key={i}>{k}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {!!transcriptAnalysis.unclear_sections?.length && (
                          <div>
                            <p className="text-zinc-400 font-mono uppercase text-[8px] font-bold">Unclear Sections</p>
                            <ul className="list-disc pl-4 space-y-0.5">
                              {transcriptAnalysis.unclear_sections.map((u, i) => (
                                <li key={i}>{u}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {!!transcriptAnalysis.translation_risks?.length && (
                          <div>
                            <p className="text-zinc-400 font-mono uppercase text-[8px] font-bold">Translation Risks</p>
                            <ul className="list-disc pl-4 space-y-0.5">
                              {transcriptAnalysis.translation_risks.map((r, i) => (
                                <li key={i}>{r}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Improve transcript result */}
                    {improveTranscriptError && (
                      <div className="flex items-center justify-between gap-2 bg-rose-500/10 border border-rose-500/25 rounded-xl px-3 py-2 text-[10px] text-rose-500">
                        <span className="flex items-center gap-1.5">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          {improveTranscriptError}
                        </span>
                        <button
                          onClick={runImproveTranscript}
                          className="flex items-center gap-1 font-bold font-mono uppercase tracking-wider hover:underline cursor-pointer shrink-0"
                        >
                          <RefreshCw className="w-3 h-3" /> Retry
                        </button>
                      </div>
                    )}
                    {improvedTranscript && !improveTranscriptLoading && (
                      <div className="mt-1 bg-white dark:bg-zinc-950 p-3.5 rounded-xl border border-zinc-200/40 dark:border-zinc-850 text-[10.5px] leading-relaxed text-zinc-800 dark:text-zinc-300 space-y-2 max-h-[220px] overflow-y-auto">
                        <p className="text-[8px] font-mono text-emerald-500 uppercase tracking-wider font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Improved Script{improvedTranscript.provider ? ` · ${improvedTranscript.provider}` : ''}
                        </p>
                        {improvedTranscript.changes && (
                          <p className="text-[9px] text-zinc-400 italic">{improvedTranscript.changes}</p>
                        )}
                        <p className="whitespace-pre-wrap">{improvedTranscript.improved_text}</p>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={applyImprovedTranscript}
                            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl text-[10px] font-bold font-mono uppercase tracking-wide cursor-pointer flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Apply
                          </button>
                          <button
                            onClick={() => copyText(improvedTranscript.improved_text)}
                            className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-[10px] font-bold font-mono uppercase tracking-wide cursor-pointer flex items-center gap-1"
                          >
                            <ClipboardCopy className="w-3 h-3" /> Copy
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Improve translation result */}
                    {improveTranslationError && (
                      <div className="flex items-center justify-between gap-2 bg-rose-500/10 border border-rose-500/25 rounded-xl px-3 py-2 text-[10px] text-rose-500">
                        <span className="flex items-center gap-1.5">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          {improveTranslationError}
                        </span>
                        <button
                          onClick={runImproveTranslation}
                          className="flex items-center gap-1 font-bold font-mono uppercase tracking-wider hover:underline cursor-pointer shrink-0"
                        >
                          <RefreshCw className="w-3 h-3" /> Retry
                        </button>
                      </div>
                    )}
                    {improvedTranslation && !improveTranslationLoading && (
                      <div className="mt-1 bg-white dark:bg-zinc-950 p-3.5 rounded-xl border border-zinc-200/40 dark:border-zinc-850 text-[10.5px] leading-relaxed text-zinc-800 dark:text-zinc-300 space-y-2 max-h-[220px] overflow-y-auto">
                        <p className="text-[8px] font-mono text-emerald-500 uppercase tracking-wider font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Refined Translations{improvedTranslation.provider ? ` · ${improvedTranslation.provider}` : ''}
                        </p>
                        {improvedTranslation.summary && (
                          <p className="text-[9px] text-zinc-400 italic">{improvedTranslation.summary}</p>
                        )}
                        <div className="space-y-2">
                          {improvedTranslation.segments.map((seg) => (
                            <div key={seg.id} className="rounded-lg border border-zinc-200/50 dark:border-zinc-800 p-2 space-y-1">
                              <p className="text-[9px] text-zinc-400 truncate"><span className="font-bold uppercase text-[8px]">Original:</span> {seg.original}</p>
                              <p className="text-[9px] text-emerald-600 dark:text-emerald-400"><span className="font-bold uppercase text-[8px]">Improved:</span> {seg.improved_translation}</p>
                              {seg.note && <p className="text-[8px] text-zinc-400 italic">Note: {seg.note}</p>}
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={applyImprovedTranslation}
                            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl text-[10px] font-bold font-mono uppercase tracking-wide cursor-pointer flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Apply All
                          </button>
                          <button
                            onClick={() => copyText(
                              improvedTranslation.segments.map((s) => s.improved_translation).join('\n')
                            )}
                            className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-[10px] font-bold font-mono uppercase tracking-wide cursor-pointer flex items-center gap-1"
                          >
                            <ClipboardCopy className="w-3 h-3" /> Copy All
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* MICROPHONE TRANSCRIPTION SECTION */}
                  <div className="space-y-3 bg-zinc-50 dark:bg-zinc-950/60 p-4 rounded-2xl border border-zinc-200/30 dark:border-zinc-900 text-left flex flex-col">
                    <div className="flex items-center justify-between select-none">
                      <div className="flex items-center gap-2">
                        <Mic className="w-4 h-4 text-emerald-500" />
                        <span className="text-[10px] font-mono uppercase tracking-widest font-extrabold text-zinc-900 dark:text-white">Microphone Transcriber</span>
                      </div>
                      
                      {recording && (
                        <span className="text-[9px] font-mono text-rose-500 font-bold animate-pulse flex items-center gap-1">
                          ● RECORDING ({recordingDuration}s)
                        </span>
                      )}
                    </div>

                    <p className="text-[10px] text-zinc-400 leading-normal select-none">
                      Record voiceover/dubbing notes via browser mic, then send the audio to the backend for transcription.
                    </p>

                    <div className="flex items-center gap-2 select-none">
                      {recording ? (
                        <button
                          onClick={stopRecording}
                          className="px-4 py-2 bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20 rounded-xl text-[10.5px] font-bold font-mono cursor-pointer flex items-center gap-1.5 flex-1 justify-center transition-colors"
                        >
                          <MicOff className="w-3.5 h-3.5" />
                          <span>Stop Recording</span>
                        </button>
                      ) : (
                        <button
                          onClick={startRecording}
                          className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-200 rounded-xl text-[10.5px] font-bold font-mono cursor-pointer flex items-center gap-1.5 border border-zinc-800 flex-1 justify-center transition-colors"
                        >
                          <Mic className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Start Recording</span>
                        </button>
                      )}

                      {audioBlob && !recording && (
                        <button
                          onClick={transcribeRecording}
                          disabled={transcribing}
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl text-[10.5px] font-bold font-mono cursor-pointer flex-1 justify-center transition-colors"
                        >
                          {transcribing ? "Transcribing..." : "Transcribe Speech"}
                        </button>
                      )}
                    </div>

                    {/* Transcribed display area */}
                    {transcribedText && (
                      <div className="mt-2 bg-white dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200/40 dark:border-zinc-850 text-[11px] leading-relaxed text-zinc-800 dark:text-zinc-300 relative flex flex-col gap-2">
                        <span className="text-[8px] font-mono text-emerald-500 uppercase tracking-wider block font-bold">Transcription Output</span>
                        <p className="italic">"{transcribedText}"</p>
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(transcribedText);
                              toast.success('Copied to clipboard');
                            } catch {
                              toast.error('Could not copy text');
                            }
                          }}
                          className="self-end text-[9px] font-mono text-emerald-500 uppercase font-bold hover:underline cursor-pointer pt-1"
                        >
                          Copy Text
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* TAB 3: REAL-TIME CONVERSATION (LIVE API) */}
              {aiSuiteTab === 'live' && (
                <div className="flex-1 flex flex-col h-full min-h-0 justify-center items-center text-center space-y-6">
                  
                  {/* Visual pulses/waves */}
                  <div className="relative flex items-center justify-center w-36 h-36">
                    <div className={`absolute inset-0 bg-emerald-500/10 rounded-full transition-transform duration-500 ${
                      liveVoiceActive ? 'animate-ping scale-150 opacity-25' : 'scale-75 opacity-0'
                    }`} />
                    <div className={`absolute inset-4 bg-emerald-500/20 rounded-full transition-transform duration-300 ${
                      liveVoiceActive ? 'animate-pulse scale-110 opacity-40' : 'scale-90 opacity-0'
                    }`} />
                    <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 rounded-full flex items-center justify-center shadow-inner relative z-10">
                      <Bot className={`w-10 h-10 ${liveVoiceActive ? 'text-emerald-500' : 'text-zinc-400 dark:text-zinc-600'}`} />
                    </div>
                  </div>

                  <div className="space-y-1.5 select-none">
                    <h3 className="text-xs font-mono font-bold text-zinc-900 dark:text-white uppercase tracking-widest">
                      Live Voice Companion
                    </h3>
                    <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest">
                      Status: <span className={liveVoiceActive ? "text-emerald-500 font-bold" : "text-zinc-500"}>{liveStatusText}</span>
                    </p>
                  </div>

                  <p className="text-[11px] text-zinc-400 leading-relaxed max-w-xs">
                    Stream your voice to the backend voice session and read live replies. Use it for spoken notes and verbal brainstorming.
                  </p>

                  <div className="w-full">
                    {liveVoiceActive ? (
                      <button
                        onClick={toggleLiveVoiceSession}
                        className="w-full py-3 bg-rose-500 hover:bg-rose-400 text-white font-extrabold text-xs font-mono rounded-xl transition-all shadow-md cursor-pointer uppercase tracking-wider"
                      >
                        Disconnect Voice Session
                      </button>
                    ) : (
                      <button
                        onClick={toggleLiveVoiceSession}
                        className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-extrabold text-xs font-mono rounded-xl transition-all shadow-md cursor-pointer uppercase tracking-wider"
                      >
                        Start Live Conversation
                      </button>
                    )}
                  </div>

                  {/* Captions thread block */}
                  {liveVoiceActive && liveCaptions.length > 0 && (
                    <div className="w-full bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200/40 dark:border-zinc-850 text-left text-[11px] max-h-[110px] overflow-y-auto space-y-1 mt-2 font-mono">
                      {liveCaptions.map((cap, idx) => (
                        <p key={idx} className="text-zinc-400 leading-normal">{cap}</p>
                      ))}
                    </div>
                  )}

                </div>
              )}

            </div>
          </div>
        </section>
  );
}
