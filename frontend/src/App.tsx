import React, { useState, useEffect, useRef } from 'react';
import DashboardView from './components/views/DashboardView';
import { isRealFirebase } from './lib/firebase';
import { getAuthenticatedProjectVideoUrl } from './services/api';
import { useAuth } from './hooks/useAuth';
import { useVoice } from './hooks/useVoice';
import { useProjects } from './hooks/useProjects';
import { useUpload } from './hooks/useUpload';
import { useChat } from './hooks/useChat';

export default function App() {
  // Navigation & Core States
  const [appState, setAppState] = useState<'upload' | 'processing' | 'result'>('upload');
  const [mainView, setMainView] = useState<'studio' | 'projects' | 'project-details' | 'voices'>('studio');
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('dark');
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Feature modules
  const auth = useAuth();
  const voice = useVoice();

  // Cross-hook ref bridges: break the circular useProjects <-> useUpload dependency.
  // Each hook receives a stable call-through that resolves to the other hook's
  // latest setter/handler at call time (event handlers / effects run post-render).
  const setUploadErrorRef = React.useRef<(e: string | null) => void>(() => {});
  const startSSEListenerRef = React.useRef<(jobId: string) => void>(() => {});
  const setVideoAnalysisRef = React.useRef<(analysis: null) => void>(() => {});

  const projects = useProjects({
    user: auth.user,
    voiceSettings: voice.voiceSettings,
    appState,
    mainView,
    setAppState,
    setMainView,
    setUploadError: (e) => setUploadErrorRef.current(e),
    startSSEListener: (jobId) => startSSEListenerRef.current(jobId),
  });

  const upload = useUpload({
    user: auth.user,
    appState,
    defaultVoiceId: voice.defaultVoiceId,
    voiceSettings: voice.voiceSettings,
    setAppState,
    setMainView,
    setShowAuthModal: auth.setShowAuthModal,
    setProjects: projects.setProjects,
    setSelectedProjectId: projects.setSelectedProjectId,
    setVideoAnalysis: (analysis) => setVideoAnalysisRef.current(analysis),
  });

  setUploadErrorRef.current = upload.setUploadError;
  startSSEListenerRef.current = upload.startSSEListener;

  const chat = useChat({
    activeProject: projects.activeProject,
    videoMetadata: upload.videoMetadata,
  });

  setVideoAnalysisRef.current = chat.setVideoAnalysis;

  // Load theme
  useEffect(() => {
    const storedTheme = localStorage.getItem('lumina_dub_theme') || 'dark';
    setThemeMode(storedTheme as 'light' | 'dark');
    if (storedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Sync state transitions from the backend SSE status updates
  useEffect(() => {
    if (appState === 'processing' && projects.activeProject) {
      if (projects.activeProject.status === 'Completed') {
        setAppState('result');
      }
    }
  }, [projects.activeProject?.status, appState]);

  // Refresh signed video URL when entering result view (token for <video src>)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (appState !== 'result' || !projects.activeProject?.id || projects.activeProject.status !== 'Completed' || !auth.user) {
        return;
      }
      try {
        const src = await getAuthenticatedProjectVideoUrl(projects.activeProject.id, true);
        if (!cancelled) auth.setSecureVideoSrc(src);
      } catch (e) {
        console.warn('Failed to build authenticated video URL', e);
      }
    };
    load();
    // Refresh token periodically (~50 min) while watching
    const timer = window.setInterval(() => {
      void load();
    }, 50 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [appState, projects.activeProject?.id, projects.activeProject?.status, auth.user]);

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

  return (
    <DashboardView
      nav={{ appState, setAppState, mainView, setMainView, themeMode, toggleTheme, showSettings, setShowSettings }}
      authData={{
        user: auth.user,
        showAuthModal: auth.showAuthModal,
        setShowAuthModal: auth.setShowAuthModal,
        handleLogout: auth.handleLogout,
        secureVideoSrc: auth.secureVideoSrc,
      }}
      voiceData={{
        favoriteVoiceIds: voice.favoriteVoiceIds,
        defaultVoiceId: voice.defaultVoiceId,
        recentlyUsedVoiceIds: voice.recentlyUsedVoiceIds,
        handleToggleFavoriteVoice: voice.handleToggleFavoriteVoice,
        handleSetDefaultVoice: voice.handleSetDefaultVoice,
        voiceSettings: voice.voiceSettings,
        setVoiceSettings: voice.setVoiceSettings,
        elevenLabsKey: voice.elevenLabsKey,
        setElevenLabsKey: voice.setElevenLabsKey,
      }}
      projectsData={{
        projects: projects.projects,
        selectedProjectId: projects.selectedProjectId,
        setSelectedProjectId: projects.setSelectedProjectId,
        activeProject: projects.activeProject,
        handlePreviewProject: projects.handlePreviewProject,
        handleOpenProjectDetails: projects.handleOpenProjectDetails,
        handleDownloadProject: projects.handleDownloadProject,
        handleDeleteProject: projects.handleDeleteProject,
        handleDuplicateProject: projects.handleDuplicateProject,
        handleSaveTranscript: projects.handleSaveTranscript,
      }}
      uploadData={{
        targetLanguageInput: upload.targetLanguageInput,
        setTargetLanguageInput: upload.setTargetLanguageInput,
        detectedLanguage: upload.detectedLanguage,
        detectionConfidence: upload.detectionConfidence,
        detectingLanguage: upload.detectingLanguage,
        videoUrlInput: upload.videoUrlInput,
        setVideoUrlInput: upload.setVideoUrlInput,
        uploadProgress: upload.uploadProgress,
        uploadingState: upload.uploadingState,
        uploadError: upload.uploadError,
        setUploadError: upload.setUploadError,
        isDragging: upload.isDragging,
        setIsDragging: upload.setIsDragging,
        videoMetadata: upload.videoMetadata,
        pipelineStageHistory: upload.pipelineStageHistory,
        elapsedSeconds: upload.elapsedSeconds,
        processingLogs: upload.processingLogs,
        handleProcessFile: upload.handleProcessFile,
        handleFileChange: upload.handleFileChange,
        handleLoadDemoVideo: upload.handleLoadDemoVideo,
        handleLoadVideoUrl: upload.handleLoadVideoUrl,
        handleStartDubbing: upload.handleStartDubbing,
        handleResetWorkflow: upload.handleResetWorkflow,
      }}
      chatData={chat}
      isRealFirebase={isRealFirebase}
    />
  );
}
