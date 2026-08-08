// useChat — AI Studio suite: AI chatbot, video analyst, transcript intelligence, mic dubbing recorder, live voice session.
import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { API_BASE, authHeaders } from '../services/api';
import type { Project, TranscriptSegment } from '../types';
import type { VideoMetadata } from './useUpload';

export interface TranscriptAnalysisResult {
  provider?: string;
  topic?: string;
  tone?: string;
  speaking_style?: string;
  audience?: string;
  key_points?: string[];
  unclear_sections?: string[];
  quality?: string;
  translation_risks?: string[];
}

export interface ImprovedTranscriptResult {
  improved_text: string;
  changes?: string;
  provider?: string;
}

export interface ImprovedTranslationSegment {
  id: string;
  original: string;
  translated: string;
  improved_translation: string;
  note?: string;
}

export interface ImprovedTranslationResult {
  segments: ImprovedTranslationSegment[];
  summary?: string;
  provider?: string;
}

interface UseChatOptions {
  activeProject: Project | null;
  videoMetadata: VideoMetadata | null;
}

export function useChat({ activeProject, videoMetadata }: UseChatOptions) {
  const [aiSuiteTab, setAiSuiteTab] = useState<'chatbot' | 'intelligence' | 'live'>('chatbot');

  // 1. Chatbot states
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string; timestamp: string }[]>([
    { role: 'assistant', content: "Hello! I'm your Dubnex AI assistant. I can help with translations, voice selection, and script tuning. What would you like to work on?", timestamp: new Date().toLocaleTimeString() }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatRole, setChatRole] = useState<'director' | 'language' | 'coach'>('director');
  // Chat always runs through OpenAI (backend AI_PROVIDER=auto picks OpenAI when
  // OPENAI_API_KEY is set). The selector offers OpenAI models only — the backend
  // maps any unknown label to its configured OpenAI model, so these pass through.
  const [chatModel, setChatModel] = useState<'gpt-4o-mini' | 'gpt-4o' | 'gpt-4.1-mini'>('gpt-4o-mini');
  const [chatLoading, setChatLoading] = useState(false);

  // 2. Video Analysis & Audio Transcribing states
  const [videoAnalysis, setVideoAnalysis] = useState<string | null>(null);
  const [analystQuery, setAnalystQuery] = useState('');
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // Mic dubbing recorder states
  const [recording, setRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcribedText, setTranscribedText] = useState('');
  const [transcribing, setTranscribing] = useState(false);

  // 3. Live Voice states
  const [liveVoiceActive, setLiveVoiceActive] = useState(false);
  const [liveCaptions, setLiveCaptions] = useState<string[]>([]);
  const [liveStatusText, setLiveStatusText] = useState('Disconnected');

  // 4. Transcript Intelligence states (analysis / improve transcript / improve translation)
  const [transcriptAnalysis, setTranscriptAnalysis] = useState<TranscriptAnalysisResult | null>(null);
  const [transcriptAnalysisLoading, setTranscriptAnalysisLoading] = useState(false);
  const [transcriptAnalysisError, setTranscriptAnalysisError] = useState<string | null>(null);

  const [improvedTranscript, setImprovedTranscript] = useState<ImprovedTranscriptResult | null>(null);
  const [improveTranscriptLoading, setImproveTranscriptLoading] = useState(false);
  const [improveTranscriptError, setImproveTranscriptError] = useState<string | null>(null);

  const [improvedTranslation, setImprovedTranslation] = useState<ImprovedTranslationResult | null>(null);
  const [improveTranslationLoading, setImproveTranslationLoading] = useState(false);
  const [improveTranslationError, setImproveTranslationError] = useState<string | null>(null);

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordTimerRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const liveWsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  // GEMINI CHATBOT ACTIONS
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg, timestamp: new Date().toLocaleTimeString() }]);
    setChatLoading(true);

    try {
      let sysInstruction = "You are Dubnex's supportive AI Dubbing Consultant.";
      if (chatRole === 'director') {
        sysInstruction = "You are Dubnex's Executive Dubbing Director. Assist the user with speech pacing, cinematic voice selection, tone delivery, and theatrical translations.";
      } else if (chatRole === 'language') {
        sysInstruction = "You are Dubnex's Language Specialist. Help localise script segments, resolve complex idioms, match dialect timings, and translate content naturally.";
      } else if (chatRole === 'coach') {
        sysInstruction = "You are Dubnex's Voice Coach. Give advice on voice selection, pacing, and delivery for natural-sounding dubs.";
      }

      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({
          history: chatMessages,
          message: userMsg,
          modelName: chatModel,
          systemInstruction: sysInstruction,
          role: chatRole
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || data?.detail || `Chat request failed (HTTP ${res.status}).`);
      }
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.text || 'Error obtaining response.', timestamp: new Date().toLocaleTimeString() }]);
    } catch (err) {
      console.error("Chat error:", err);
      const reason = err instanceof Error ? err.message : 'Please check your connection and try again.';
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Sorry, I couldn't respond: ${reason}`, timestamp: new Date().toLocaleTimeString() }]);
    } finally {
      setChatLoading(false);
    }
  };

  // VIDEO ANALYST ACTIONS
  const runVideoAnalysis = async () => {
    setAnalysisLoading(true);
    setVideoAnalysis(null);
    try {
      const res = await fetch(`${API_BASE}/api/analyze-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({
          title: videoMetadata?.name || "Active Video",
          duration: videoMetadata?.duration || "00:30",
          transcript: activeProject?.transcript || [],
          query: analystQuery
        })
      });
      const data = await res.json();
      setVideoAnalysis(data.analysis || 'Analysis failed to compile.');
    } catch (e) {
      console.error(e);
      setVideoAnalysis("An error occurred during video analysis execution.");
    } finally {
      setAnalysisLoading(false);
    }
  };

  // TRANSCRIPT INTELLIGENCE ACTIONS
  const transcriptText = () =>
    (activeProject?.transcript ?? [])
      .map((seg) => seg.text)
      .filter(Boolean)
      .join('\n');

  const runTranscriptAnalysis = async () => {
    const text = transcriptText();
    if (!text.trim()) {
      setTranscriptAnalysisError('No transcript is available for this project yet.');
      return;
    }
    setTranscriptAnalysisLoading(true);
    setTranscriptAnalysis(null);
    setTranscriptAnalysisError(null);
    try {
      const res = await fetch(`${API_BASE}/api/analyze-transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ transcript: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || data?.detail || `Transcript analysis failed (HTTP ${res.status}).`);
      }
      setTranscriptAnalysis(data as TranscriptAnalysisResult);
    } catch (err) {
      console.error("Transcript analysis error:", err);
      setTranscriptAnalysisError(err instanceof Error ? err.message : 'Transcript analysis failed.');
    } finally {
      setTranscriptAnalysisLoading(false);
    }
  };

  const runImproveTranscript = async () => {
    const text = transcriptText();
    if (!text.trim()) {
      setImproveTranscriptError('No transcript is available for this project yet.');
      return;
    }
    setImproveTranscriptLoading(true);
    setImprovedTranscript(null);
    setImproveTranscriptError(null);
    try {
      const res = await fetch(`${API_BASE}/api/improve-transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ transcript: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || data?.detail || `Transcript improvement failed (HTTP ${res.status}).`);
      }
      setImprovedTranscript({
        improved_text: data.improved_text || '',
        changes: data.changes,
        provider: data.provider,
      });
    } catch (err) {
      console.error("Improve transcript error:", err);
      setImproveTranscriptError(err instanceof Error ? err.message : 'Transcript improvement failed.');
    } finally {
      setImproveTranscriptLoading(false);
    }
  };

  const runImproveTranslation = async () => {
    const segments = (activeProject?.transcript ?? []).filter(
      (seg) => seg.text?.trim() && seg.translatedText?.trim()
    );
    if (!segments.length) {
      setImproveTranslationError('No translated segments are available for this project yet.');
      return;
    }
    setImproveTranslationLoading(true);
    setImprovedTranslation(null);
    setImproveTranslationError(null);
    try {
      const res = await fetch(`${API_BASE}/api/improve-translation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({
          segments: segments.map((seg) => ({
            id: seg.id,
            original: seg.text,
            translated: seg.translatedText,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || data?.detail || `Translation improvement failed (HTTP ${res.status}).`);
      }
      setImprovedTranslation(data as ImprovedTranslationResult);
    } catch (err) {
      console.error("Improve translation error:", err);
      setImproveTranslationError(err instanceof Error ? err.message : 'Translation improvement failed.');
    } finally {
      setImproveTranslationLoading(false);
    }
  };

  /** Map the improved (whole-transcript) text back onto segments. Only safe when
   *  line counts match the segment count (the improve prompt preserves structure);
   *  otherwise the caller should use Copy instead. Returns null when unsafe. */
  const buildAppliedTranscript = (): TranscriptSegment[] | null => {
    if (!improvedTranscript || !activeProject?.transcript) return null;
    const lines = improvedTranscript.improved_text.split('\n').map((l) => l.trim()).filter(Boolean);
    const original = activeProject.transcript;
    if (lines.length !== original.length) return null;
    return original.map((seg, i) => ({ ...seg, text: lines[i] ?? seg.text }));
  };

  /** Map improved translations back onto the project transcript by segment id. */
  const buildAppliedTranslation = (): TranscriptSegment[] | null => {
    if (!improvedTranslation?.segments || !activeProject?.transcript) return null;
    const byId = new Map<string, string>();
    for (const seg of improvedTranslation.segments) {
      byId.set(String(seg.id), seg.improved_translation);
    }
    let changed = false;
    const next = activeProject.transcript.map((seg) => {
      const improved = byId.get(String(seg.id));
      if (improved && improved !== seg.translatedText) {
        changed = true;
        return { ...seg, translatedText: improved, isEdited: true };
      }
      return seg;
    });
    return changed ? next : null;
  };

  // MICROPHONE RECORDER ACTIONS
  const startRecording = async () => {
    setAudioBlob(null);
    setTranscribedText('');
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setRecording(true);
      setRecordingDuration(0);
      recordTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Could not access microphone", err);
      toast.error("Microphone access denied or unavailable", {
        description: "Check your browser permissions and try again.",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      clearInterval(recordTimerRef.current);
    }
  };

  const transcribeRecording = async () => {
    if (!audioBlob) return;
    setTranscribing(true);
    try {
      const base64data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string | null;
          if (result) {
            resolve(result.split(',')[1]);
          } else {
            reject(new Error('Failed to read audio blob.'));
          }
        };
        reader.onerror = () => reject(new Error('Failed to read audio blob.'));
        reader.readAsDataURL(audioBlob);
      });

      const res = await fetch(`${API_BASE}/api/transcribe-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ audio: base64data, mimeType: 'audio/webm' })
      });
      const data = await res.json();
      setTranscribedText(data.text || "No speech detected.");
    } catch (e) {
      console.error("Transcribe failed", e);
      toast.error("Transcription failed", {
        description: "The backend could not transcribe this recording. Try again.",
      });
    } finally {
      setTranscribing(false);
    }
  };

  // LIVE CONVERSATION ACTIONS
  // NOTE: The backend does not implement a real live voice session (the /live
  // websocket is a placeholder). Per product policy, a frontend action must have
  // a real backend implementation or be clearly disabled — so this is disabled
  // with an explanation rather than faking a connection.
  const LIVE_VOICE_UNAVAILABLE = 'Live voice is not available yet — the backend voice-session API is not implemented. Use mic dubbing (above) for speech-to-text.';
  const toggleLiveVoiceSession = async () => {
    if (liveVoiceActive) {
      // Disconnect (only reachable if a session ever became active)
      setLiveVoiceActive(false);
      setLiveStatusText('Disconnected');
      if (liveWsRef.current) {
        liveWsRef.current.close();
      }
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close(); } catch (e) {}
      }
      return;
    }
    // Clearly disabled — do not open a fake websocket.
    setLiveVoiceActive(false);
    setLiveCaptions([]);
    setLiveStatusText('Unavailable');
    toast.info(LIVE_VOICE_UNAVAILABLE);
  };

  return {
    aiSuiteTab,
    setAiSuiteTab,
    chatMessages,
    setChatMessages,
    chatInput,
    setChatInput,
    chatRole,
    setChatRole,
    chatModel,
    setChatModel,
    chatLoading,
    setChatLoading,
    handleSendChatMessage,
    chatEndRef,
    videoAnalysis,
    setVideoAnalysis,
    analystQuery,
    setAnalystQuery,
    analysisLoading,
    setAnalysisLoading,
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
  };
}

export type ChatState = ReturnType<typeof useChat>;
