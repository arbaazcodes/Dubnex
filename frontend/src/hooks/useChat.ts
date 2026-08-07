// useChat — AI Studio suite: Gemini chatbot, video analyst, mic dubbing recorder, live voice session.
import React, { useState, useEffect, useRef } from 'react';
import { API_BASE, authHeaders, getWebSocketUrl } from '../services/api';
import type { Project } from '../types';
import type { VideoMetadata } from './useUpload';

interface UseChatOptions {
  activeProject: Project | null;
  videoMetadata: VideoMetadata | null;
}

export function useChat({ activeProject, videoMetadata }: UseChatOptions) {
  const [aiSuiteTab, setAiSuiteTab] = useState<'chatbot' | 'intelligence' | 'live'>('chatbot');

  // 1. Chatbot states
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string; timestamp: string }[]>([
    { role: 'assistant', content: "Hello! I am your Pro Studio Dubbing Production Assistant. How can I assist you with your translations, voice models, or script tuning today?", timestamp: new Date().toLocaleTimeString() }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatRole, setChatRole] = useState<'director' | 'language' | 'coach'>('director');
  const [chatModel, setChatModel] = useState<'gemini-3.1-pro-preview' | 'gemini-3.5-flash' | 'gemini-3.1-flash-lite'>('gemini-3.5-flash');
  const [chatThinking, setChatThinking] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  // 2. Video Analysis & Audio Transcribing states
  const [videoAnalysis, setVideoAnalysis] = useState<string | null>(null);
  const [analystQuery, setAnalystQuery] = useState('');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisThinking, setAnalysisThinking] = useState(false);

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
      let sysInstruction = "You are Pro Studio Dubbing's supportive AI Dubbing Consultant.";
      if (chatRole === 'director') {
        sysInstruction = "You are Pro Studio Dubbing's Executive Dubbing Director. Assist the user with speech pacing, cinematic voice selection, tone delivery, and theatrical translations.";
      } else if (chatRole === 'language') {
        sysInstruction = "You are Pro Studio Dubbing's Language Specialist. Help localise script segments, resolve complex idioms, match dialect timings, and translate content naturally.";
      } else if (chatRole === 'coach') {
        sysInstruction = "You are Pro Studio Dubbing's XTTS Voice Coach. Give advice on speed, pitch, emotion, and accent alignment rules.";
      }

      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({
          history: chatMessages,
          message: userMsg,
          modelName: chatModel,
          systemInstruction: sysInstruction,
          role: chatRole,
          useHighThinking: chatThinking
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || data?.detail || `Chat request failed (HTTP ${res.status}).`);
      }
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.text || 'Error obtaining response.', timestamp: new Date().toLocaleTimeString() }]);
    } catch (err) {
      console.error("Chat error:", err);
      setChatMessages(prev => [...prev, { role: 'assistant', content: "Unable to reach Gemini assistant. Please check connection.", timestamp: new Date().toLocaleTimeString() }]);
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
          query: analystQuery,
          useHighThinking: analysisThinking
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
      alert("Microphone access denied or unavailable.");
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
    } finally {
      setTranscribing(false);
    }
  };

  // LIVE CONVERSATION ACTIONS
  const toggleLiveVoiceSession = async () => {
    if (liveVoiceActive) {
      // Disconnect
      setLiveVoiceActive(false);
      setLiveStatusText('Disconnected');
      if (liveWsRef.current) {
        liveWsRef.current.close();
      }
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close(); } catch (e) {}
      }
    } else {
      // Connect
      setLiveStatusText('Connecting to Gemini Live...');
      setLiveCaptions([]);
      try {
        const ws = new WebSocket(await getWebSocketUrl('/live', true));
        liveWsRef.current = ws;

        ws.onopen = () => {
          setLiveVoiceActive(true);
          setLiveStatusText('Connected to Live Session');
          setLiveCaptions(["Gemini Live active. Speak now..."]);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.text) {
              setLiveCaptions(prev => [...prev, `AI: ${msg.text}`]);
            }
            if (msg.error) {
              setLiveStatusText(`Error: ${msg.error}`);
            }
          } catch (e) {}
        };

        ws.onclose = () => {
          setLiveVoiceActive(false);
          setLiveStatusText('Disconnected');
        };

        ws.onerror = () => {
          setLiveStatusText('Connection error');
        };

        // Access mic at 16kHz
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        audioCtxRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        source.connect(processor);
        processor.connect(audioContext.destination);

        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            const channelData = e.inputBuffer.getChannelData(0);
            // Convert to 16bit PCM
            let l = channelData.length;
            let buf = new Int16Array(l);
            while (l--) {
              let s = Math.max(-1, Math.min(1, channelData[l]));
              buf[l] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            // Base64 encode
            let binary = '';
            let bytes = new Uint8Array(buf.buffer);
            let len = bytes.byteLength;
            for (let i = 0; i < len; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64 = window.btoa(binary);
            ws.send(JSON.stringify({ audio: base64 }));
          }
        };

      } catch (err) {
        console.error("Live connection fail:", err);
        setLiveStatusText('Failed to initialize local mic or websocket.');
      }
    }
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
    chatThinking,
    setChatThinking,
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
  };
}

export type ChatState = ReturnType<typeof useChat>;
