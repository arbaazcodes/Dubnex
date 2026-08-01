
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Languages, 
  Settings as SettingsIcon, 
  UploadCloud, 
  Sparkles, 
  AlertCircle,
  Sun,
  Moon,
  Check,
  Download,
  Sliders,
  Play,
  RotateCcw,
  Cpu,
  Info,
  ExternalLink,
  ChevronRight,
  MessageSquare,
  Mic,
  MicOff,
  User,
  LogOut,
  Compass,
  Brain,
  Volume2,
  VolumeX,
  Activity,
  FileText,
  Send,
  Bot
} from 'lucide-react';

import { Project, VoiceSettings, TTSVoiceEngine } from './types';
import { targetLanguages, voicePresets } from './constants/data';
import { saveUserProject, loadUserProjects, loginWithGoogleMock, AuthUser, isRealFirebase } from './lib/firebase';
import { translateVideo } from './services/api';

export default function App() {
  // Navigation & Core States
  const [appState, setAppState] = useState<'upload' | 'processing' | 'result'>('upload');
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('dark');
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // User Authentication state
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Current translation job tracking
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Target and Source language state
  const [targetLanguageInput, setTargetLanguageInput] = useState('es');
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [detectionConfidence, setDetectionConfidence] = useState<number | null>(null);
  const [detectingLanguage, setDetectingLanguage] = useState(false);

  // Upload/Input source state
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadingState, setUploadingState] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [videoMetadata, setVideoMetadata] = useState<{
    name: string;
    size: string;
    duration: string;
    resolution: string;
    fps: number;
    thumbnailUrl: string;
    url: string;
  } | null>(null);

const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Advanced Configurations (Inside Settings Drawer)
  const [activeEngine, setActiveEngine] = useState<TTSVoiceEngine>('ElevenLabs');
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    gender: 'Male',
    speed: 1.0,
    pitch: 1.0,
    emotion: 'Professional',
    energy: 1.0,
    pauseControl: 0.25,
    voiceName: 'ElevenLabs Premium Dub'
  });
  const [geminiKey, setGeminiKey] = useState('••••••••••••••••••••••••••••');
  const [elevenLabsKey, setElevenLabsKey] = useState('••••••••••••••••••••••••••••');

  // AI STUDIO INTEGRATION SUITE STATES
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

  // Active Project helper
  const getActiveProject = (): Project | null => {
    return projects.find(p => p.id === selectedProjectId) || null;
  };

  const activeProject = getActiveProject();

  // Load theme and saved state
  useEffect(() => {
    const storedTheme = localStorage.getItem('lumina_dub_theme') || 'dark';
    setThemeMode(storedTheme as 'light' | 'dark');
    if (storedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    const savedProjects = localStorage.getItem('ai_video_translator_projects');
    if (savedProjects) {
      try {
        const parsed = JSON.parse(savedProjects);
        setProjects(parsed);
      } catch (e) {
        console.error('Failed to parse cached jobs:', e);
      }
    }

    // Try auto-login for a seamless user experience
    const storedUser = localStorage.getItem('luminadub_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {}
    }
  }, []);

  // Sync state transitions from the backend SSE status updates
  useEffect(() => {
    if (appState === 'processing' && activeProject) {
      if (activeProject.status === 'Completed') {
        setAppState('result');
      }
    }
  }, [activeProject?.status, appState]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  // Load projects from cloud on auth state changes
  useEffect(() => {
    if (user) {
      const fetchCloudProjects = async () => {
        const cloudProjs = await loadUserProjects(user.uid);
        if (cloudProjs && cloudProjs.length > 0) {
          setProjects(cloudProjs);
          localStorage.setItem('ai_video_translator_projects', JSON.stringify(cloudProjs));
        }
      };
      fetchCloudProjects();
    }
  }, [user]);

  // Handle Google Login
  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    try {
      const authUser = await loginWithGoogleMock();
      setUser(authUser);
      localStorage.setItem('luminadub_user', JSON.stringify(authUser));
    } catch (e) {
      console.error("Auth failed:", e);
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('luminadub_user');
    // Keep local cache but disconnect cloud sync
  };

  // Theme Toggler
  const toggleTheme = () => {
    const nextTheme = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(nextTheme);
    localStorage.setItem('lumina_dub_theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Spoken language detector
  const runLanguageDetection = async (fileName: string) => {
    setDetectingLanguage(true);
    setDetectedLanguage(null);
    setDetectionConfidence(null);
    
    try {
      const response = await fetch('http://127.0.0.1:8000/api/detect-language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: fileName })
      });
      const data = await response.json();
      setDetectedLanguage(data.detected);
      setDetectionConfidence(data.confidence);
    } catch (err) {
      console.error('Spoken language detection error:', err);
      setDetectedLanguage('English');
      setDetectionConfidence(0.95);
    } finally {
      setDetectingLanguage(false);
    }
  };

  // Video local file processing
  const handleProcessFile = async (file: File) => {
    console.log("📁 File Selected:", file);
    setSelectedFile(file);
    console.log("✅ selectedFile saved");
    setUploadError(null);
    setVideoMetadata(null);
    setVideoUrlInput('');
    
    const ext = file.name.split('.').pop()?.toLowerCase();
    const allowed = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
    if (!ext || !allowed.includes(ext)) {
      setUploadError(`Unsupported video format ".${ext || 'unknown'}". Supported containers: MP4, MOV, AVI, MKV, WEBM.`);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1.0, video.duration / 2);
    };

    video.onseeked = async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        const thumbnailUrl = canvas.toDataURL('image/jpeg');

        const totalSecs = Math.round(video.duration);
        const mins = Math.floor(totalSecs / 60).toString().padStart(2, '0');
        const secs = (totalSecs % 60).toString().padStart(2, '0');
        const durationStr = `${mins}:${secs}`;

        const sizeStr = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
        
        setVideoMetadata({
          name: file.name,
          size: sizeStr,
          duration: durationStr,
          resolution: `${video.videoWidth}x${video.videoHeight}`,
          fps: 24,
          thumbnailUrl,
          url: objectUrl
        });

        runLanguageDetection(file.name);
      } catch (err) {
        console.error('Error analyzing video stream metadata:', err);
      }
    };

    video.onerror = () => {
      setUploadError('Unable to decode video streams. Keep container standard.');
    };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  // Demo selector shortcut
  const handleLoadDemoVideo = async (url: string, name: string) => {
    setUploadError(null);
    setVideoMetadata(null);
    setVideoUrlInput(url);
    setDetectingLanguage(true);

    setTimeout(() => {
      setVideoMetadata({
        name,
        size: '14.2 MB',
        duration: '00:15',
        resolution: '1920x1080',
        fps: 24,
        thumbnailUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=640&q=80',
        url
      });
      runLanguageDetection(name);
    }, 400);
  };

  // Custom video URL input loader
  const handleLoadVideoUrl = async (url: string) => {
    if (!url.trim()) return;
    setUploadError(null);
    setVideoMetadata(null);
    setDetectingLanguage(true);

    const filename = url.split('/').pop()?.split('?')[0] || 'remote_video.mp4';
    
    // Attempt to probe metadata using a video element
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.src = url;

    const fallbackTimeout = setTimeout(() => {
      // Fallback if browser blocks metadata probing due to CORS
      setVideoMetadata({
        name: filename,
        size: 'N/A',
        duration: '00:30',
        resolution: '1920x1080',
        fps: 24,
        thumbnailUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=640&q=80',
        url
      });
      runLanguageDetection(filename);
    }, 2500);

    video.onloadedmetadata = () => {
      clearTimeout(fallbackTimeout);
      const totalSecs = Math.round(video.duration || 30);
      const mins = Math.floor(totalSecs / 60).toString().padStart(2, '0');
      const secs = (totalSecs % 60).toString().padStart(2, '0');
      const durationStr = `${mins}:${secs}`;

      setVideoMetadata({
        name: filename,
        size: 'N/A',
        duration: durationStr,
        resolution: video.videoWidth ? `${video.videoWidth}x${video.videoHeight}` : '1920x1080',
        fps: 24,
        thumbnailUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=640&q=80',
        url
      });
      runLanguageDetection(filename);
    };

    video.onerror = () => {
      clearTimeout(fallbackTimeout);
      // Fallback for CORS or streaming configurations
      setVideoMetadata({
        name: filename,
        size: 'Remote Stream',
        duration: '01:00',
        resolution: '1280x720',
        fps: 24,
        thumbnailUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=640&q=80',
        url
      });
      runLanguageDetection(filename);
    };
  };

  // SSE job link
  const startSSEListener = (jobId: string) => {
    const eventSource = new EventSource(`http://127.0.0.1:8000/api/pipeline-sse?jobId=${jobId}`);
    
    eventSource.onmessage = (event) => {
      try {
        const jobData = JSON.parse(event.data);
        const updatedJob: Project = {
          id: jobData.id,
          title: jobData.title,
          originalLanguage: jobData.sourceLanguage,
          targetLanguage: jobData.targetLanguage,
          status: jobData.status,
          progress: jobData.progress,
          size: jobData.metadata?.fileSize || 'N/A',
          duration: jobData.metadata?.duration || '00:00',
          createdAt: new Date().toISOString(),
          videoUrl: jobData.videoUrl,
          steps: jobData.steps || [],
          voiceSettings: {
            gender: 'Male',
            speed: 1.0,
            pitch: 1.0,
            emotion: 'Professional',
            energy: 1.0,
            pauseControl: 0.25,
            voiceName: 'Default'
          },
          transcript: jobData.transcript || [],
          logs: jobData.logs || []
        };

        setProjects(prev => {
          const index = prev.findIndex(p => p.id === jobData.id);
          let nextList = [...prev];
          if (index >= 0) {
            nextList[index] = updatedJob;
          } else {
            nextList = [updatedJob, ...prev];
          }

          localStorage.setItem('ai_video_translator_projects', JSON.stringify(nextList));
          
          // Save to Cloud Firestore too if user is logged in
          if (user) {
            saveUserProject(user.uid, updatedJob);
          }
          return nextList;
        });

        if (jobData.status === 'Completed' || jobData.status === 'Failed') {
          eventSource.close();
        }
      } catch (e) {
        console.error('SSE parser exception:', e);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };
  };

  // Trigger Translation
 const handleStartDubbing = async (e: React.FormEvent) => {
  e.preventDefault();


  if (!videoMetadata) {
    return;
  }

  if (!selectedFile) {
    return;
  }

  console.log("📤 About to call translateVideo()");

const result = await translateVideo(
    selectedFile,
    targetLanguageInput,
    "george"
);

console.log("📥 translateVideo finished", result);
};
  // Reset core workflow
  const handleResetWorkflow = () => {
    setVideoMetadata(null);
    setVideoUrlInput('');
    setDetectedLanguage(null);
    setDetectionConfidence(null);
    setUploadProgress(null);
    setAppState('upload');
    setVideoAnalysis(null);
  };

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

      const res = await fetch('http://127.0.0.1:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: chatMessages,
          message: userMsg,
          modelName: chatModel,
          systemInstruction: sysInstruction,
          useHighThinking: chatThinking
        })
      });

      const data = await res.json();
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
      const res = await fetch('http://127.0.0.1:8000/api/analyze-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      const res = await fetch('http://127.0.0.1:8000/api/transcribe-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${wsProtocol}//127.0.0.1:8000/live`);
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

  const currentStepProgress = activeProject ? activeProject.progress : (uploadProgress || 10);
  const currentStepName = activeProject ? activeProject.status : (uploadingState || 'Preparing...');

  const visualSteps = [
    { label: 'Uploading Video', range: [0, 15] },
    { label: 'Extracting Audio', range: [16, 30] },
    { label: 'Detecting Language', range: [31, 45] },
    { label: 'Generating Transcript', range: [46, 60] },
    { label: 'Translating', range: [61, 75] },
    { label: 'Generating AI Voice', range: [76, 85] },
    { label: 'Synchronizing Audio', range: [86, 92] },
    { label: 'Rendering Final Video', range: [93, 98] },
    { label: 'Preparing Download', range: [99, 99] },
    { label: 'Completed', range: [100, 100] }
  ];

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 text-zinc-100 flex flex-col transition-colors duration-300 ease-in-out font-sans">
      
      {/* HEADER BAR */}
      <header className="h-16 border-b border-zinc-200/60 dark:border-zinc-900 bg-white/85 dark:bg-zinc-950/85 backdrop-blur-md flex items-center justify-between px-6 sm:px-10 z-30 sticky top-0 shrink-0">
        
        {/* Brand */}
        <div className="flex items-center gap-2.5 select-none">
          <div className="w-8 h-8 bg-emerald-500 rounded-xl flex items-center justify-center shadow-sm">
            <Languages className="w-4.5 h-4.5 text-zinc-950 font-bold" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-mono tracking-widest font-extrabold text-zinc-900 dark:text-white uppercase leading-none">
              Pro Studio Dubbing
            </span>
            <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono tracking-wider mt-0.5 uppercase">
              PRO STUDIO DUBBING ENVIRONMENT
            </span>
          </div>
        </div>

        {/* Toolbar Controls / Google Auth */}
        <div className="flex items-center gap-3">
          
          {/* User Sign-In Section */}
          {user ? (
            <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/40 dark:border-zinc-800 rounded-full py-1.5 pl-2 pr-3 select-none">
              <img src={user.photoURL} alt={user.displayName} className="w-5.5 h-5.5 rounded-full ring-1 ring-emerald-500" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold leading-none">{user.displayName}</span>
                <span className="text-[8px] text-zinc-400 font-mono leading-none mt-0.5">{user.email}</span>
              </div>
              <button 
                onClick={handleLogout}
                className="ml-1.5 p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-rose-500 rounded-full transition-colors cursor-pointer"
                title="Logout"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleGoogleLogin}
              disabled={authLoading}
              className="px-3.5 py-1.5 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-850 dark:text-zinc-100 rounded-xl text-[11px] font-bold font-mono transition-all border border-zinc-200 dark:border-zinc-850 flex items-center gap-1.5 cursor-pointer"
            >
              <User className="w-3.5 h-3.5 text-emerald-500" />
              <span>{authLoading ? 'Signing in...' : 'Sign in with Google'}</span>
            </button>
          )}

          {/* Theme Switcher */}
          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-300 rounded-xl transition-all cursor-pointer"
            title={themeMode === 'dark' ? 'Toggle Light Mode' : 'Toggle Dark Mode'}
          >
            {themeMode === 'dark' ? <Sun className="w-4.5 h-4.5 text-amber-400" /> : <Moon className="w-4.5 h-4.5 text-zinc-700" />}
          </button>

          {/* Settings Trigger */}
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-100 rounded-xl transition-all border border-zinc-200/40 dark:border-zinc-800 cursor-pointer flex items-center gap-1.5"
            title="Configure System Architecture"
          >
            <Sliders className="w-4 h-4" />
            <span className="text-[11px] font-mono tracking-wider uppercase hidden sm:inline">Settings</span>
          </button>
        </div>
      </header>

      {/* TWO-COLUMN PRO STUDIO ENVIRONMENT */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: PRIMARY DUBBING WORKFLOW */}
        <section className="lg:col-span-7 xl:col-span-8 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            
            {/* VIEWPORT 1: HOME / UPLOADER */}
            {appState === 'upload' && (
              <motion.div
                key="viewport-uploader"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                
                {/* Intro Header */}
                {!videoMetadata && (
                  <div className="text-left space-y-2 max-w-md">
                    <h1 className="text-2.5xl sm:text-3.5xl font-extrabold tracking-tight text-zinc-900 dark:text-white leading-tight">
                      Zero-Shot Video Dubbing. <br/>
                      <span className="text-emerald-500">Intelligent Vocals.</span>
                    </h1>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 max-w-sm">
                      Automatic speech timelines alignment and high-fidelity vocal synthesis cloning. Drop an MP4 container or play standard demo feeds.
                    </p>
                  </div>
                )}

                {/* Upload Card container */}
                <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200/50 dark:border-zinc-900 rounded-3xl p-6 shadow-sm dark:shadow-none space-y-6">
                  
                  {/* Error Notifications */}
                  {uploadError && (
                    <div className="bg-rose-50 dark:bg-rose-950/15 border border-rose-100 dark:border-rose-900/30 p-4 rounded-2xl flex items-start gap-3 text-left text-xs text-rose-800 dark:text-rose-400">
                      <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-bold font-mono text-[10px] uppercase tracking-wider">Pipeline Safety Failure</p>
                        <p className="text-[11px] mt-0.5 leading-relaxed">{uploadError}</p>
                      </div>
                    </div>
                  )}

                  {/* If video is NOT yet selected */}
                  {!videoMetadata ? (
                    <div className="space-y-5">
                      <div 
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDragging(false);
                          const file = e.dataTransfer.files?.[0];
                          if (file) handleProcessFile(file);
                        }}
                        className={`border border-dashed rounded-2xl p-10 flex flex-col items-center justify-center transition-all duration-200 ${
                          isDragging 
                            ? 'border-emerald-500 bg-emerald-500/5' 
                            : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/30 dark:bg-zinc-950/10'
                        }`}
                      >
                        <UploadCloud className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mb-4" />
                        <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 text-center mb-1">
                          Drag & drop your video container here, or{' '}
                          <label className="text-emerald-500 hover:text-emerald-400 font-bold cursor-pointer transition-colors hover:underline">
                            browse files
                            <input 
                              type="file" 
                              accept="video/*" 
                              className="hidden" 
                              onChange={handleFileChange} 
                            />
                          </label>
                        </p>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono tracking-wider uppercase mt-1">
                          MP4, MOV, AVI, MKV, WEBM
                        </p>
                      </div>

                      {/* Video Link Input Section */}
                      <div className="bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-200/40 dark:border-zinc-850/40 rounded-2xl p-4 space-y-2.5 text-left">
                        <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-extrabold flex items-center gap-1.5">
                          <ExternalLink className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Import from Video Link / URL</span>
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="url"
                            placeholder="Paste MP4, MOV, or direct video link..."
                            value={videoUrlInput}
                            onChange={(e) => setVideoUrlInput(e.target.value)}
                            className="flex-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200 font-mono placeholder:text-zinc-450 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleLoadVideoUrl(videoUrlInput)}
                            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-mono text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                          >
                            <span>Load Link</span>
                          </button>
                        </div>
                        <p className="text-[9px] text-zinc-400 dark:text-zinc-500 leading-normal">
                          Supports direct video files (e.g. <code>.mp4</code> / <code>.webm</code>) or static cloud storage assets.
                        </p>
                      </div>

                      {/* Demo shortcuts */}
                      <div className="pt-2">
                        <div className="flex items-center justify-center gap-2 mb-3">
                          <div className="h-px bg-zinc-150 dark:bg-zinc-850 flex-1"></div>
                          <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono uppercase tracking-widest">Or try a sample video</span>
                          <div className="h-px bg-zinc-150 dark:bg-zinc-850 flex-1"></div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleLoadDemoVideo('https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', 'Sample: English Speech Demo.mp4')}
                            className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200/70 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-[11px] font-mono text-zinc-750 dark:text-zinc-300 rounded-xl transition-colors border border-zinc-200/30 dark:border-zinc-800/80 cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Play className="w-3 h-3 text-emerald-500 fill-emerald-500/20" />
                            <span>English Talk Demo</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLoadDemoVideo('https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', 'Sample: Spanish Talk Demo.mp4')}
                            className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200/70 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-[11px] font-mono text-zinc-750 dark:text-zinc-300 rounded-xl transition-colors border border-zinc-200/30 dark:border-zinc-800/80 cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Play className="w-3 h-3 text-emerald-500 fill-emerald-500/20" />
                            <span>Spanish Talk Demo</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Input Configuration Form */
                    <form onSubmit={handleStartDubbing} className="space-y-6">
                      
                      <div className="aspect-video w-full bg-zinc-950 rounded-2xl overflow-hidden relative border border-zinc-200/30 dark:border-zinc-900 shadow-sm">
                        <video
                          src={videoMetadata.url}
                          className="w-full h-full object-contain"
                          controls
                          playsInline
                        />
                      </div>

                      {/* Language Auto-Detect Status banner */}
                      <div className="bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-200/40 dark:border-zinc-900 rounded-2xl p-4 flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">Detected Spoken Language</span>
                          {detectingLanguage ? (
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                              <span className="text-xs font-mono text-zinc-500">Analyzing voice timbre...</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-zinc-900 dark:text-white font-mono uppercase bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/20">
                                {detectedLanguage || 'English'}
                              </span>
                              <span className="text-[10px] text-emerald-500 font-bold">✓ ({Math.round((detectionConfidence || 0.96) * 100)}% Confidence)</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="text-[9px] font-mono text-zinc-400 text-right space-y-0.5 hidden sm:block">
                          <p className="truncate max-w-[200px]">{videoMetadata.name}</p>
                          <p>{videoMetadata.size} • {videoMetadata.duration} secs</p>
                        </div>
                      </div>

                      {/* Target selection */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block font-bold">Target Translation Language</label>
                        <div className="relative">
                          <select
                            value={targetLanguageInput}
                            onChange={(e) => setTargetLanguageInput(e.target.value)}
                            className="w-full appearance-none bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl px-4 py-3.5 text-xs text-zinc-800 dark:text-zinc-200 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                          >
                            {targetLanguages.map(l => (
                              <option key={l.code} value={l.code} className="bg-white dark:bg-zinc-950">
                                {l.flag}  {l.name} ({l.localName})
                              </option>
                            ))}
                          </select>
                          <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-zinc-400">
                            ▼
                          </div>
                        </div>
                      </div>

                      {/* Form Actions */}
                      <div className="pt-2 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleResetWorkflow}
                          className="px-5 py-3.5 bg-zinc-50 hover:bg-zinc-150 dark:bg-zinc-950 dark:hover:bg-zinc-900 text-zinc-500 dark:text-zinc-400 rounded-xl text-xs font-mono border border-zinc-200/40 dark:border-zinc-850 cursor-pointer"
                        >
                          Reset File
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-extrabold font-sans text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4 fill-zinc-950" />
                          <span>Translate Video</span>
                        </button>
                      </div>
                    </form>
                  )}

                </div>

              </motion.div>
            )}

            {/* VIEWPORT 2: PROCESSING SCREEN */}
            {appState === 'processing' && (
              <motion.div
                key="viewport-processing"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.2 }}
                className="bg-white dark:bg-zinc-900/30 border border-zinc-200/50 dark:border-zinc-900 rounded-3xl p-8 shadow-sm dark:shadow-none space-y-8 text-center"
              >
                {/* Radial Progress */}
                <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="42"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      fill="transparent"
                      className="text-zinc-100 dark:text-zinc-900"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="42"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      fill="transparent"
                      strokeDasharray="264"
                      strokeDashoffset={264 - (264 * currentStepProgress) / 100}
                      className="text-emerald-500 transition-all duration-300 ease-out"
                    />
                  </svg>
                  <div className="absolute font-mono text-base font-bold text-zinc-900 dark:text-white">
                    {currentStepProgress}%
                  </div>
                </div>

                {/* Status Messages */}
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white font-mono uppercase tracking-wider">
                    {currentStepName}
                  </h3>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono uppercase tracking-widest">
                    Est. {currentStepProgress >= 90 ? '2 seconds' : `${Math.ceil((100 - currentStepProgress) * 0.15)} seconds`} remaining
                  </p>
                </div>

                {/* Step checklist */}
                <div className="max-w-md mx-auto bg-zinc-50/50 dark:bg-zinc-950/20 rounded-2xl p-4 border border-zinc-200/30 dark:border-zinc-900 text-left space-y-2.5">
                  {visualSteps.map((step, index) => {
                    const [min, max] = step.range;
                    const isCompleted = currentStepProgress > max || (currentStepProgress === 100);
                    const isCurrent = currentStepProgress >= min && currentStepProgress <= max && currentStepProgress < 100;
                    
                    return (
                      <div 
                        key={index} 
                        className={`flex items-center justify-between text-[11px] font-mono transition-opacity ${
                          isCompleted ? 'text-zinc-400 dark:text-zinc-500' : isCurrent ? 'text-emerald-500 font-bold' : 'text-zinc-300 dark:text-zinc-700'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {isCompleted ? (
                            <span className="text-emerald-500 font-bold">✓</span>
                          ) : isCurrent ? (
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                          ) : (
                            <span className="w-1.5 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full"></span>
                          )}
                          <span>{step.label}</span>
                        </span>
                        <span>
                          {isCompleted ? 'Completed' : isCurrent ? 'Processing...' : 'Pending'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleResetWorkflow}
                    className="text-xs font-mono text-zinc-400 hover:text-rose-500 font-bold transition-colors cursor-pointer hover:underline"
                  >
                    Cancel Translation
                  </button>
                </div>

              </motion.div>
            )}

            {/* VIEWPORT 3: RESULT PREVIEW / DOWNLOAD */}
            {appState === 'result' && (
              <motion.div
                key="viewport-result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                
                <div className="text-center space-y-1.5">
                  <span className="text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-widest">
                    Translation Completed Successfully
                  </span>
                  <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
                    {activeProject?.title || 'Translated Workspace Video'}
                  </h2>
                </div>

                {/* cinematic Video Player */}
                <div className="aspect-video w-full bg-zinc-950 rounded-2xl overflow-hidden relative border border-zinc-200/50 dark:border-zinc-900 shadow-sm">
                  <video
                    src={activeProject?.videoUrl || 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4'}
                    className="w-full h-full object-contain"
                    controls
                    autoPlay
                    playsInline
                  />
                </div>

                {/* Timeline / Transcript segment list */}
                {activeProject?.transcript && activeProject.transcript.length > 0 && (
                  <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200/50 dark:border-zinc-900 rounded-2xl p-5 space-y-3">
                    <h4 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Speech Timelines Alignment</span>
                    </h4>
                    <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-2">
                      {activeProject.transcript.map(seg => (
                        <div key={seg.id} className="text-left bg-zinc-50 dark:bg-zinc-950/40 p-3 rounded-xl border border-zinc-200/30 dark:border-zinc-850/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-1 max-w-[85%]">
                            <span className="text-[9px] font-mono bg-zinc-100 dark:bg-zinc-900 text-zinc-500 border border-zinc-200 dark:border-zinc-800 px-1.5 py-0.5 rounded">
                              {seg.speaker || 'Voice'} ({seg.start.toFixed(1)}s - {seg.end.toFixed(1)}s)
                            </span>
                            <p className="text-[11px] text-zinc-400 leading-normal italic">"{seg.text}"</p>
                            <p className="text-[12px] text-emerald-500 font-medium leading-normal">➔ "{seg.translatedText}"</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Core actions */}
                <div className="space-y-3">
                  <a
                    href={activeProject?.videoUrl || '#'}
                    download={`${activeProject?.title || 'dubbed_video'}.mp4`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-extrabold text-xs font-sans rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4.5 h-4.5" />
                    <span>Download Translated Video</span>
                  </a>

                  <button
                    onClick={handleResetWorkflow}
                    className="w-full py-3.5 bg-zinc-100 hover:bg-zinc-200/70 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-bold text-xs font-sans rounded-xl transition-all border border-zinc-200/40 dark:border-zinc-800/80 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Translate Another Video</span>
                  </button>
                </div>

              </motion.div>
            )}

          </AnimatePresence>
        </section>

        {/* RIGHT COLUMN: AI STUDIO INTELLIGENCE SUITE */}
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

      </main>

      {/* SETTINGS DRAWER */}
      <AnimatePresence>
        {showSettings && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="fixed inset-0 bg-zinc-950 z-40 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 w-full sm:w-[460px] bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-850 shadow-2xl z-50 flex flex-col overflow-hidden text-zinc-900 dark:text-zinc-100"
            >
              
              <div className="h-16 border-b border-zinc-100 dark:border-zinc-850 px-6 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 select-none">
                  <Sliders className="w-4 h-4 text-emerald-500" />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white">Advanced System Configuration</span>
                </div>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 font-mono text-xs cursor-pointer"
                >
                  Close ✕
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
                
                {/* Voice tuning */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-bold border-b border-zinc-100 dark:border-zinc-800 pb-1.5">Voice Synthesis Tuning</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-600 dark:text-zinc-400 font-medium">Vocal Speed</span>
                        <span className="font-mono font-bold text-zinc-900 dark:text-white">{voiceSettings.speed}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.05"
                        value={voiceSettings.speed}
                        onChange={(e) => setVoiceSettings({ ...voiceSettings, speed: parseFloat(e.target.value) })}
                        className="w-full accent-emerald-500 bg-zinc-200 dark:bg-zinc-800 appearance-none h-1 rounded-lg cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-600 dark:text-zinc-400 font-medium">Vocal Pitch</span>
                        <span className="font-mono font-bold text-zinc-900 dark:text-white">{voiceSettings.pitch}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.05"
                        value={voiceSettings.pitch}
                        onChange={(e) => setVoiceSettings({ ...voiceSettings, pitch: parseFloat(e.target.value) })}
                        className="w-full accent-emerald-500 bg-zinc-200 dark:bg-zinc-800 appearance-none h-1 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <span className="text-zinc-600 dark:text-zinc-400 font-medium">Delivery Emotion</span>
                      <select
                        value={voiceSettings.emotion}
                        onChange={(e) => setVoiceSettings({ ...voiceSettings, emotion: e.target.value as any })}
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 rounded-lg p-2.5 text-zinc-800 dark:text-zinc-300 font-mono focus:outline-none"
                      >
                        <option value="Professional">Professional</option>
                        <option value="Happy">Happy</option>
                        <option value="Sad">Sad</option>
                        <option value="Exciting">Exciting</option>
                        <option value="Neutral">Neutral</option>
                        <option value="Whisper">Whisper</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-zinc-600 dark:text-zinc-400 font-medium">Speaker Gender</span>
                      <select
                        value={voiceSettings.gender}
                        onChange={(e) => setVoiceSettings({ ...voiceSettings, gender: e.target.value as any })}
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 rounded-lg p-2.5 text-zinc-800 dark:text-zinc-300 font-mono focus:outline-none"
                      >
                        <option value="Female">Female</option>
                        <option value="Male">Male</option>
                        <option value="Neutral">Neutral</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* System Architecture */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-bold border-b border-zinc-100 dark:border-zinc-800 pb-1.5">AI Architecture Stack</h4>
                  
                  <div className="bg-zinc-50 dark:bg-zinc-950 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-900 space-y-3 font-mono text-[10.5px]">
                    <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-900/60 pb-1.5">
                      <span className="text-zinc-400 uppercase">Speech Recognition</span>
                      <strong className="text-zinc-800 dark:text-zinc-200 text-[11px]">Faster-Whisper (3.5 Flash mic)</strong>
                    </div>
                    <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-900/60 pb-1.5">
                      <span className="text-zinc-400 uppercase">Translation Engine</span>
                      <strong className="text-zinc-800 dark:text-zinc-200 text-[11px]">Meta NLLB-200</strong>
                    </div>
                    <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-900/60 pb-1.5">
                      <span className="text-zinc-400 uppercase">Voice Cloning Engine</span>
                      <strong className="text-emerald-500 text-[11px]">ElevenLabs API (Fallback: XTTS v2)</strong>
                    </div>
                    <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-900/60 pb-1.5">
                      <span className="text-zinc-400 uppercase">Video Processing</span>
                      <strong className="text-zinc-800 dark:text-zinc-200 text-[11px]">FFmpeg Codec Multiplex</strong>
                    </div>
                    <div className="flex justify-between border-b border-zinc-100 dark:border-zinc-900/60 pb-1.5">
                      <span className="text-zinc-400 uppercase">Database & Storage</span>
                      <strong className="text-zinc-800 dark:text-zinc-200 text-[11px]">{isRealFirebase ? "Firestore & Auth (Google)" : "Simulated Local Cache Storage"}</strong>
                    </div>
                  </div>
                </div>

                {/* Developer Overrides */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-bold border-b border-zinc-100 dark:border-zinc-800 pb-1.5">Developer Overrides</h4>
                  
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <span className="text-zinc-600 dark:text-zinc-455 font-medium">ElevenLabs API Secret Override</span>
                      <input
                        type="password"
                        value={elevenLabsKey}
                        onChange={(e) => setElevenLabsKey(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 rounded-lg p-2 text-zinc-800 dark:text-zinc-300 font-mono focus:outline-none"
                        placeholder="ElevenLabs premium key"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-zinc-600 dark:text-zinc-455 font-medium">Gemini Pro API Key Override</span>
                      <input
                        type="password"
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 rounded-lg p-2 text-zinc-800 dark:text-zinc-300 font-mono focus:outline-none"
                        placeholder="Google AI Studio key"
                      />
                    </div>
                  </div>
                </div>

                {/* Stored jobs cache */}
                {projects.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-bold border-b border-zinc-100 dark:border-zinc-800 pb-1.5">Stored Job Container Caches ({projects.length})</h4>
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                      {projects.map(p => (
                        <div 
                          key={p.id} 
                          className="flex items-center justify-between p-2.5 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-150 dark:border-zinc-850 rounded-xl"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProjectId(p.id);
                              setAppState('result');
                              setShowSettings(false);
                            }}
                            className="text-left font-semibold text-zinc-850 dark:text-zinc-200 hover:text-emerald-500 truncate max-w-[190px] cursor-pointer"
                          >
                            {p.title}
                          </button>
                          <span className="font-mono text-[9px] text-zinc-400 bg-zinc-100 dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 px-1.5 py-0.5 rounded font-bold uppercase">
                            ➔ {p.targetLanguage}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
              
              <div className="h-16 border-t border-zinc-100 dark:border-zinc-850 px-6 flex items-center justify-end bg-zinc-50/50 dark:bg-zinc-950/40 shrink-0">
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold font-mono text-xs rounded-xl shadow-sm cursor-pointer"
                >
                  Save & Apply Settings
                </button>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
