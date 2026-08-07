// ChatView - AI Studio Intelligence Suite (chatbot / intelligence / live) right column.
import {
  MessageSquare,
  Brain,
  Activity,
  Send,
  Bot,
  Mic,
  MicOff,
} from 'lucide-react';
import type { FormEvent } from 'react';
import type { RefObject } from 'react';
import type { AuthUser } from '../../lib/firebase';

interface ChatViewProps {
  user: AuthUser | null;
  aiSuiteTab: 'chatbot' | 'intelligence' | 'live';
  setAiSuiteTab: (tab: 'chatbot' | 'intelligence' | 'live') => void;
  chatMessages: { role: 'user' | 'assistant'; content: string; timestamp: string }[];
  chatInput: string;
  setChatInput: (value: string) => void;
  chatRole: 'director' | 'language' | 'coach';
  setChatRole: (role: 'director' | 'language' | 'coach') => void;
  chatModel: 'gemini-3.1-pro-preview' | 'gemini-3.5-flash' | 'gemini-3.1-flash-lite';
  setChatModel: (model: 'gemini-3.1-pro-preview' | 'gemini-3.5-flash' | 'gemini-3.1-flash-lite') => void;
  chatThinking: boolean;
  setChatThinking: (thinking: boolean) => void;
  chatLoading: boolean;
  handleSendChatMessage: (event: FormEvent) => void;
  chatEndRef: RefObject<HTMLDivElement | null>;
  videoAnalysis: string | null;
  analystQuery: string;
  setAnalystQuery: (query: string) => void;
  analysisLoading: boolean;
  analysisThinking: boolean;
  setAnalysisThinking: (thinking: boolean) => void;
  runVideoAnalysis: () => void;
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
    chatThinking,
    setChatThinking,
    chatLoading,
    handleSendChatMessage,
    chatEndRef,
    videoAnalysis,
    analystQuery,
    setAnalystQuery,
    analysisLoading,
    analysisThinking,
    setAnalysisThinking,
    runVideoAnalysis,
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

                    {/* Enable Thinking for 3.1 Pro */}
                    {chatModel === 'gemini-3.1-pro-preview' && (
                      <div className="col-span-2 pt-1.5 flex items-center gap-1.5 border-t border-zinc-200/40 dark:border-zinc-800/60 mt-1">
                        <input
                          type="checkbox"
                          id="chatThinking"
                          checked={chatThinking}
                          onChange={(e) => setChatThinking(e.target.checked)}
                          className="accent-emerald-500 w-3 h-3 cursor-pointer"
                        />
                        <label htmlFor="chatThinking" className="text-[9px] font-mono text-emerald-500 font-bold uppercase tracking-wider cursor-pointer">
                          Enable High Thinking Mode
                        </label>
                      </div>
                    )}
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
                      className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl px-3 py-2.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
                    />
                    <button
                      type="submit"
                      disabled={chatLoading}
                      className="px-3.5 bg-emerald-500 text-zinc-950 rounded-xl hover:bg-emerald-400 flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <Send className="w-3.5 h-3.5 font-bold" />
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
                      <span className="text-[10px] font-mono uppercase tracking-widest font-extrabold text-zinc-900 dark:text-white">Video Intelligence (Pro 3.1)</span>
                    </div>
                    
                    <p className="text-[10px] text-zinc-400 leading-normal">
                      Runs Gemini Pro 3.1 video understanding pipeline on the current video's transcript, timeline milestones, and vocal configurations.
                    </p>

                    <div className="space-y-2 select-none">
                      <input
                        type="text"
                        value={analystQuery}
                        onChange={(e) => setAnalystQuery(e.target.value)}
                        placeholder="e.g. Find timeline errors, recommend vocal tuning..."
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-[10.5px] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            id="analysisThinking"
                            checked={analysisThinking}
                            onChange={(e) => setAnalysisThinking(e.target.checked)}
                            className="accent-emerald-500 w-3.5 h-3.5 cursor-pointer"
                          />
                          <label htmlFor="analysisThinking" className="text-[9px] font-mono text-zinc-400 cursor-pointer uppercase select-none">
                            High Thinking Level
                          </label>
                        </div>

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
                      Record voiceover/dubbing notes via browser mic. App converts raw speech to timeline blocks with Gemini 3.5 Flash.
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
                        <span className="text-[8px] font-mono text-emerald-500 uppercase tracking-wider block font-bold">Transcription Output (3.5 Flash)</span>
                        <p className="italic">"{transcribedText}"</p>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(transcribedText);
                            alert("Copied to clipboard!");
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
                      Gemini Live Voice Companion
                    </h3>
                    <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest">
                      Status: <span className={liveVoiceActive ? "text-emerald-500 font-bold" : "text-zinc-500"}>{liveStatusText}</span>
                    </p>
                  </div>

                  <p className="text-[11px] text-zinc-400 leading-relaxed max-w-xs">
                    Engage in instantaneous, low-latency vocal brainstorming. Refine translation timbres, discuss XTTS presets, or perfect localisations verbally.
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
