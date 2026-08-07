// useUpload — video input, language detection, upload progress, and the SSE-driven dubbing pipeline.
import React, { useState, useEffect, useRef } from 'react';
import { saveUserProject } from '../lib/firebase';
import {
  translateVideo,
  getJobEventsUrl,
  API_BASE,
  getProjectVideoUrl,
  getProjectDownloadUrl,
  authHeaders,
} from '../services/api';
import { voiceLibraryCatalog, resolveApiVoiceKey } from '../constants/voices';
import { libraryVoiceToSettings } from '../components/voices/VoiceLibrary';
import type { Project, VoiceSettings } from '../types';

export interface VideoMetadata {
  name: string;
  size: string;
  duration: string;
  resolution: string;
  fps: number;
  thumbnailUrl: string;
  url: string;
}

type AppState = 'upload' | 'processing' | 'result';

interface UseUploadOptions {
  user: { uid: string } | null;
  appState: AppState;
  defaultVoiceId: string | null;
  voiceSettings: VoiceSettings;
  setAppState: (state: AppState) => void;
  setMainView: (view: 'studio' | 'projects' | 'project-details' | 'voices') => void;
  setShowAuthModal: (show: boolean) => void;
  setProjects: (updater: React.SetStateAction<Project[]>) => void;
  setSelectedProjectId: (id: string | null) => void;
  setVideoAnalysis: (analysis: null) => void;
}

export function useUpload({
  user,
  appState,
  defaultVoiceId,
  voiceSettings,
  setAppState,
  setMainView,
  setShowAuthModal,
  setProjects,
  setSelectedProjectId,
  setVideoAnalysis,
}: UseUploadOptions) {
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
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Live processing dashboard state (driven by SSE)
  const [pipelineStageHistory, setPipelineStageHistory] = useState<string[]>(['Upload']);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [processingLogs, setProcessingLogs] = useState<
    { id: string; timestamp: string; level: string; message: string; step?: string }[]
  >([]);

  const processingStartedAtRef = useRef<number | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);

  const formatProcessingDuration = (ms: number) => {
    if (!Number.isFinite(ms) || ms < 0) return '—';
    const totalSec = Math.round(ms / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    if (mins <= 0) return `${secs}s`;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  // Elapsed timer while processing
  useEffect(() => {
    if (appState !== 'processing' || !processingStartedAtRef.current) {
      return;
    }
    const tick = () => {
      if (!processingStartedAtRef.current) return;
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - processingStartedAtRef.current) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [appState]);

  // Close SSE + revoke preview object URLs on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }
    };
  }, []);

  // Spoken language detector
  const runLanguageDetection = async (fileName: string) => {
    setDetectingLanguage(true);
    setDetectedLanguage(null);
    setDetectionConfidence(null);

    try {
      const response = await fetch(`${API_BASE}/api/detect-language`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ filename: fileName })
      });
      if (!response.ok) {
        throw new Error(`Language detection failed (HTTP ${response.status})`);
      }
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
    setSelectedFile(file);
    setUploadError(null);
    setVideoMetadata(null);
    setVideoUrlInput('');

    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    const allowed = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
    if (!ext || !allowed.includes(ext)) {
      setUploadError(`Unsupported video format ".${ext || 'unknown'}". Supported containers: MP4, MOV, AVI, MKV, WEBM.`);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    previewObjectUrlRef.current = objectUrl;
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
  const startSSEListener = async (jobId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const eventsUrl = await getJobEventsUrl(jobId);
    const eventSource = new EventSource(eventsUrl);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const jobData = JSON.parse(event.data);
        const stageHistory: string[] = Array.isArray(jobData.stage_history)
          ? jobData.stage_history
          : [jobData.stage || jobData.status || 'Upload'];
        const logs = Array.isArray(jobData.logs) ? jobData.logs : [];

        setPipelineStageHistory(stageHistory);
        setProcessingLogs(logs);

        const meta = jobData.metadata || {};
        const isTerminal =
          jobData.status === 'Completed' || jobData.status === 'Failed';
        const completedAt =
          isTerminal
            ? (jobData.completed_at || new Date().toISOString())
            : undefined;
        const createdAt = jobData.created_at || new Date().toISOString();

        const processingTime =
          jobData.processingTime ||
          meta.processingTime ||
          (isTerminal && createdAt && completedAt
            ? formatProcessingDuration(
                new Date(completedAt).getTime() - new Date(createdAt).getTime()
              )
            : undefined);
        const processingTimeMs =
          typeof jobData.processingTimeMs === 'number'
            ? jobData.processingTimeMs
            : typeof meta.processingTimeMs === 'number'
              ? meta.processingTimeMs
              : undefined;

        const rawTranscript = Array.isArray(jobData.transcript) ? jobData.transcript : [];
        const mappedTranscript = rawTranscript.map((seg: any, i: number) => ({
          id: String(seg.id ?? `t${i}`),
          start: Number(seg.start) || 0,
          end: Number(seg.end) || 0,
          text: seg.text || seg.original || '',
          translatedText: seg.translatedText || seg.translated || '',
          speaker: seg.speaker || 'Voice',
          isEdited: Boolean(seg.isEdited),
          baselineTranslatedText: seg.baselineTranslatedText,
        }));

        const voiceKey = jobData.voice || meta.voice || resolveApiVoiceKey(defaultVoiceId);
        const libraryVoice = voiceLibraryCatalog.find(
          (v) => v.apiVoiceKey === voiceKey || v.name.toLowerCase() === String(voiceKey).toLowerCase()
        );

        const updatedJob: Project = {
          id: jobData.id || jobId,
          title: jobData.title || videoMetadata?.name || 'Translated Video',
          originalLanguage: jobData.sourceLanguage || detectedLanguage || 'unknown',
          targetLanguage: jobData.targetLanguage || targetLanguageInput,
          status: jobData.status || jobData.stage || 'processing',
          progress: typeof jobData.progress === 'number' ? jobData.progress : 0,
          size: meta.outputFileSize || meta.fileSize || videoMetadata?.size || 'N/A',
          duration: meta.duration || videoMetadata?.duration || '00:00',
          createdAt,
          videoUrl:
            jobData.status === 'Completed'
              ? getProjectVideoUrl(jobData.id || jobId)
              : '',
          dubbedUrl:
            jobData.status === 'Completed'
              ? getProjectDownloadUrl(jobData.id || jobId)
              : '',
          steps: jobData.steps || [],
          voiceKey,
          voiceSettings: libraryVoice
            ? libraryVoiceToSettings(libraryVoice, voiceSettings)
            : { ...voiceSettings },
          transcript: mappedTranscript,
          logs,
          failureReason: jobData.status === 'Failed' ? (jobData.message || 'Pipeline failed') : undefined,
          resolution: meta.resolution || videoMetadata?.resolution,
          fps: meta.fps != null ? Number(meta.fps) : videoMetadata?.fps,
          translationModel: meta.translationModel || undefined,
          ttsModel: meta.ttsModel || undefined,
          processingTime,
          processingTimeMs,
          completedAt,
          renders: [],
          versions: [],
        };

        setProjects(prev => {
          const index = prev.findIndex(p => p.id === updatedJob.id);
          let nextList = [...prev];
          if (index >= 0) {
            const existing = nextList[index];
            const keepLocalTranscript =
              Array.isArray(existing.transcript) &&
              existing.transcript.some((s) => s.isEdited) &&
              mappedTranscript.length === 0;

            nextList[index] = {
              ...existing,
              ...updatedJob,
              thumbnailUrl: existing.thumbnailUrl || updatedJob.thumbnailUrl,
              voiceSettings: existing.voiceSettings || updatedJob.voiceSettings,
              voiceKey: updatedJob.voiceKey || existing.voiceKey,
              resolution: updatedJob.resolution || existing.resolution,
              fps: updatedJob.fps ?? existing.fps,
              duration: (updatedJob.duration && updatedJob.duration !== '00:00')
                ? updatedJob.duration
                : existing.duration,
              size: (updatedJob.size && updatedJob.size !== 'N/A')
                ? updatedJob.size
                : existing.size,
              translationModel: updatedJob.translationModel || existing.translationModel,
              ttsModel: updatedJob.ttsModel || existing.ttsModel,
              processingTime: updatedJob.processingTime || existing.processingTime,
              processingTimeMs: updatedJob.processingTimeMs ?? existing.processingTimeMs,
              completedAt: updatedJob.completedAt || existing.completedAt,
              renders: existing.renders || updatedJob.renders || [],
              versions: existing.versions || updatedJob.versions || [],
              transcript: keepLocalTranscript
                ? existing.transcript
                : mappedTranscript.length > 0
                  ? mappedTranscript
                  : existing.transcript,
              logs: logs.length > 0 ? logs : existing.logs,
            };
          } else {
            nextList = [updatedJob, ...prev];
          }

          localStorage.setItem('ai_video_translator_projects', JSON.stringify(nextList));

          // Save to Cloud Firestore too if user is logged in
          if (user) {
            saveUserProject(user.uid, nextList.find(p => p.id === updatedJob.id) || updatedJob);
          }
          return nextList;
        });

        setSelectedProjectId(updatedJob.id);
        setUploadProgress(updatedJob.progress);
        setUploadingState(updatedJob.status);

        if (jobData.status === 'Completed' || jobData.status === 'Failed') {
          eventSource.close();
          if (eventSourceRef.current === eventSource) {
            eventSourceRef.current = null;
          }
          if (jobData.status === 'Failed') {
            setUploadError(jobData.message || 'Translation failed');
            setAppState('upload');
            processingStartedAtRef.current = null;
          }
        }
      } catch (e) {
        console.error('SSE parser exception:', e);
      }
    };

    eventSource.onerror = () => {
      // Let the browser retry while the job is running; onmessage closes on terminal states.
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

    if (!user) {
      setUploadError('Sign in to start dubbing. Processing requires authentication.');
      setShowAuthModal(true);
      return;
    }

    setUploadError(null);
    setAppState('processing');
    setUploadProgress(10);
    setUploadingState('Upload');
    processingStartedAtRef.current = Date.now();
    setElapsedSeconds(0);
    setPipelineStageHistory(['Upload']);
    setProcessingLogs([{
      id: `log-local-${Date.now()}`,
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Upload started. Connecting to pipeline events...',
      step: 'Upload'
    }]);

    try {
      const selectedVoiceKey = resolveApiVoiceKey(defaultVoiceId);

      const startResult = await translateVideo(
        selectedFile,
        targetLanguageInput,
        selectedVoiceKey,
        {
          duration: videoMetadata.duration,
          resolution: videoMetadata.resolution,
          fps: videoMetadata.fps,
          fileSize: videoMetadata.size,
        }
      );

      const jobId = startResult?.job_id;
      if (!jobId) {
        throw new Error('Backend did not return a job_id.');
      }

      const pendingProject: Project = {
        id: jobId,
        title: videoMetadata.name || 'Translated Video',
        originalLanguage: detectedLanguage || 'unknown',
        targetLanguage: targetLanguageInput,
        status: 'Upload',
        progress: 10,
        size: videoMetadata.size,
        duration: videoMetadata.duration,
        createdAt: new Date().toISOString(),
        videoUrl: '',
        thumbnailUrl: videoMetadata.thumbnailUrl,
        voiceKey: selectedVoiceKey,
        voiceSettings: { ...voiceSettings },
        transcript: [],
        logs: [{
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `Upload complete. Waiting for pipeline events (voice=${selectedVoiceKey})...`,
          step: 'Upload'
        }],
        resolution: videoMetadata.resolution,
        fps: videoMetadata.fps,
        translationModel: undefined,
        ttsModel: undefined,
        renders: [],
        versions: [],
      };

      setProjects(prev => {
        const nextList = [pendingProject, ...prev.filter(p => p.id !== jobId)];
        localStorage.setItem('ai_video_translator_projects', JSON.stringify(nextList));
        if (user) {
          saveUserProject(user.uid, pendingProject);
        }
        return nextList;
      });
      setSelectedProjectId(jobId);
      setMainView('studio');
      startSSEListener(jobId);
    } catch (err: any) {
      console.error('Translation workflow failed:', err);
      setUploadError(err?.message || 'Translation failed');
      setUploadProgress(null);
      setUploadingState('');
      setAppState('upload');
    }
  };

  // Reset core workflow
  const handleResetWorkflow = () => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    setVideoMetadata(null);
    setVideoUrlInput('');
    setDetectedLanguage(null);
    setDetectionConfidence(null);
    setUploadProgress(null);
    setAppState('upload');
    setVideoAnalysis(null);
    processingStartedAtRef.current = null;
    setElapsedSeconds(0);
    setPipelineStageHistory(['Upload']);
    setProcessingLogs([]);
  };

  return {
    targetLanguageInput,
    setTargetLanguageInput,
    detectedLanguage,
    detectionConfidence,
    detectingLanguage,
    videoUrlInput,
    setVideoUrlInput,
    uploadProgress,
    uploadingState,
    uploadError,
    setUploadError,
    isDragging,
    setIsDragging,
    videoMetadata,
    pipelineStageHistory,
    elapsedSeconds,
    processingLogs,
    handleProcessFile,
    handleFileChange,
    handleLoadDemoVideo,
    handleLoadVideoUrl,
    handleStartDubbing,
    handleResetWorkflow,
    startSSEListener,
  };
}

export type UploadState = ReturnType<typeof useUpload>;
