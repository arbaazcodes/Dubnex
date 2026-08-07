// DashboardView - App shell: header, main view routing, auth modal, settings drawer.
import { AnimatePresence } from 'motion/react';
import {
  Languages,
  FolderOpen,
  Mic2,
  User,
  LogOut,
  Sun,
  Moon,
  Sliders,
} from 'lucide-react';
import VoiceStudioView from './VoiceStudioView';
import ProjectsView from './ProjectsView';
import StudioView from './StudioView';
import ChatView from './ChatView';
import SettingsView from './SettingsView';
import AuthModal from '../auth/AuthModal';
import type { ChangeEvent, FormEvent } from 'react';
import type { AuthUser } from '../../lib/firebase';
import type { LibraryVoice, Project, TranscriptSegment, VoiceSettings } from '../../types';
import type { VideoMetadata } from '../../hooks/useUpload';
import type { ChatState } from '../../hooks/useChat';

type MainView = 'studio' | 'projects' | 'project-details' | 'voices';
type AppState = 'upload' | 'processing' | 'result';
type ProcessingLog = { id: string; timestamp: string; level: string; message: string; step?: string };

interface DashboardViewProps {
  nav: {
    appState: AppState;
    setAppState: (state: AppState) => void;
    mainView: MainView;
    setMainView: (view: MainView) => void;
    themeMode: 'dark' | 'light';
    toggleTheme: () => void;
    showSettings: boolean;
    setShowSettings: (show: boolean) => void;
  };
  authData: {
    user: AuthUser | null;
    showAuthModal: boolean;
    setShowAuthModal: (show: boolean) => void;
    handleLogout: () => void;
    secureVideoSrc: string;
  };
  voiceData: {
    favoriteVoiceIds: string[];
    defaultVoiceId: string | null;
    recentlyUsedVoiceIds: string[];
    handleToggleFavoriteVoice: (voiceId: string) => void;
    handleSetDefaultVoice: (voice: LibraryVoice) => void;
    voiceSettings: VoiceSettings;
    setVoiceSettings: (settings: VoiceSettings) => void;
    elevenLabsKey: string;
    setElevenLabsKey: (key: string) => void;
  };
  projectsData: {
    projects: Project[];
    selectedProjectId: string | null;
    setSelectedProjectId: (id: string | null) => void;
    activeProject: Project | null;
    handlePreviewProject: (id: string) => void;
    handleOpenProjectDetails: (id: string) => void;
    handleDownloadProject: (project: Project) => void;
    handleDeleteProject: (id: string) => void;
    handleDuplicateProject: (id: string) => void;
    handleSaveTranscript: (transcript: TranscriptSegment[]) => void;
  };
  uploadData: {
    targetLanguageInput: string;
    setTargetLanguageInput: (value: string) => void;
    detectedLanguage: string | null;
    detectionConfidence: number | null;
    detectingLanguage: boolean;
    videoUrlInput: string;
    setVideoUrlInput: (value: string) => void;
    uploadProgress: number | null;
    uploadingState: string;
    uploadError: string | null;
    setUploadError: (error: string | null) => void;
    isDragging: boolean;
    setIsDragging: (dragging: boolean) => void;
    videoMetadata: VideoMetadata | null;
    pipelineStageHistory: string[];
    elapsedSeconds: number;
    processingLogs: ProcessingLog[];
    handleProcessFile: (file: File) => void;
    handleFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
    handleLoadDemoVideo: (url: string, name: string) => void;
    handleLoadVideoUrl: (url: string) => void;
    handleStartDubbing: (event: FormEvent) => void;
    handleResetWorkflow: () => void;
  };
  chatData: ChatState;
  isRealFirebase: boolean;
}

export default function DashboardView(props: DashboardViewProps) {
  const {
    nav: {
      appState,
      setAppState,
      mainView,
      setMainView,
      themeMode,
      toggleTheme,
      showSettings,
      setShowSettings,
    },
    authData: {
      user,
      showAuthModal,
      setShowAuthModal,
      handleLogout,
      secureVideoSrc,
    },
    voiceData: {
      favoriteVoiceIds,
      defaultVoiceId,
      recentlyUsedVoiceIds,
      handleToggleFavoriteVoice,
      handleSetDefaultVoice,
      voiceSettings,
      setVoiceSettings,
      elevenLabsKey,
      setElevenLabsKey,
    },
    projectsData: {
      projects,
      selectedProjectId,
      setSelectedProjectId,
      activeProject,
      handlePreviewProject,
      handleOpenProjectDetails,
      handleDownloadProject,
      handleDeleteProject,
      handleDuplicateProject,
      handleSaveTranscript,
    },
    uploadData: {
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
    },
    chatData,
    isRealFirebase,
  } = props;

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

          <button
            type="button"
            onClick={() =>
              setMainView(
                mainView === 'projects' || mainView === 'project-details' ? 'studio' : 'projects'
              )
            }
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold font-mono transition-all border flex items-center gap-1.5 cursor-pointer ${
              mainView === 'projects' || mainView === 'project-details'
                ? 'bg-emerald-500 text-zinc-950 border-emerald-500'
                : 'bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-100 border-zinc-200/40 dark:border-zinc-800'
            }`}
            title="My Projects"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">My Projects</span>
            {projects.length > 0 && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono ${
                mainView === 'projects' || mainView === 'project-details'
                  ? 'bg-zinc-950/15'
                  : 'bg-emerald-500/15 text-emerald-500'
              }`}>
                {projects.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMainView(mainView === 'voices' ? 'studio' : 'voices')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold font-mono transition-all border flex items-center gap-1.5 cursor-pointer ${
              mainView === 'voices'
                ? 'bg-emerald-500 text-zinc-950 border-emerald-500'
                : 'bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-100 border-zinc-200/40 dark:border-zinc-800'
            }`}
            title="Voice Library"
          >
            <Mic2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Voices</span>
          </button>
          
          {/* User Sign-In Section */}
          {user ? (
            <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/40 dark:border-zinc-800 rounded-full py-1.5 pl-2 pr-3 select-none">
              <img src={user.photoURL} alt={user.displayName} className="w-5.5 h-5.5 rounded-full ring-1 ring-emerald-500" />
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-bold leading-none truncate max-w-[120px] sm:max-w-[160px]">{user.displayName}</span>
                <span className="text-[8px] text-zinc-400 font-mono leading-none mt-0.5 truncate max-w-[120px] sm:max-w-[160px]">
                  {user.email || user.phoneNumber || 'Signed in'}
                </span>
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
              onClick={() => {
                setUploadError(null);
                setShowAuthModal(true);
              }}
              className="px-3.5 py-1.5 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-850 dark:text-zinc-100 rounded-xl text-[11px] font-bold font-mono transition-all border border-zinc-200 dark:border-zinc-850 flex items-center gap-1.5 cursor-pointer"
            >
              <User className="w-3.5 h-3.5 text-emerald-500" />
              <span>Sign in</span>
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
        {mainView === 'voices' ? (
          <VoiceStudioView
            favoriteVoiceIds={favoriteVoiceIds}
            defaultVoiceId={defaultVoiceId}
            recentlyUsedVoiceIds={recentlyUsedVoiceIds}
            handleToggleFavoriteVoice={handleToggleFavoriteVoice}
            handleSetDefaultVoice={handleSetDefaultVoice}
            targetLanguage={targetLanguageInput}
            setMainView={setMainView}
            setAppState={setAppState}
          />
        ) : mainView === 'project-details' && activeProject ? (
          <ProjectsView
            variant="details"
            activeProject={activeProject}
            projects={projects}
            selectedProjectId={selectedProjectId}
            handlePreviewProject={handlePreviewProject}
            handleOpenProjectDetails={handleOpenProjectDetails}
            handleDownloadProject={handleDownloadProject}
            handleDeleteProject={handleDeleteProject}
            handleDuplicateProject={handleDuplicateProject}
            handleSaveTranscript={handleSaveTranscript}
            setMainView={setMainView}
            setAppState={setAppState}
          />
        ) : mainView === 'project-details' && !activeProject ? (
          <ProjectsView
            variant="list"
            activeProject={activeProject}
            projects={projects}
            selectedProjectId={selectedProjectId}
            handlePreviewProject={handlePreviewProject}
            handleOpenProjectDetails={handleOpenProjectDetails}
            handleDownloadProject={handleDownloadProject}
            handleDeleteProject={handleDeleteProject}
            handleDuplicateProject={handleDuplicateProject}
            handleSaveTranscript={handleSaveTranscript}
            setMainView={setMainView}
            setAppState={setAppState}
          />
        ) : mainView === 'projects' ? (
          <ProjectsView
            variant="list"
            activeProject={activeProject}
            projects={projects}
            selectedProjectId={selectedProjectId}
            handlePreviewProject={handlePreviewProject}
            handleOpenProjectDetails={handleOpenProjectDetails}
            handleDownloadProject={handleDownloadProject}
            handleDeleteProject={handleDeleteProject}
            handleDuplicateProject={handleDuplicateProject}
            handleSaveTranscript={handleSaveTranscript}
            setMainView={setMainView}
            setAppState={setAppState}
          />
        ) : (
        <>

        {/* LEFT COLUMN: PRIMARY DUBBING WORKFLOW */}
        <StudioView
          appState={appState}
          setMainView={setMainView}
          secureVideoSrc={secureVideoSrc}
          activeProject={activeProject}
          handleDownloadProject={handleDownloadProject}
          handleSaveTranscript={handleSaveTranscript}
          defaultVoiceId={defaultVoiceId}
          handleSetDefaultVoice={handleSetDefaultVoice}
          favoriteVoiceIds={favoriteVoiceIds}
          handleToggleFavoriteVoice={handleToggleFavoriteVoice}
          recentlyUsedVoiceIds={recentlyUsedVoiceIds}
          targetLanguageInput={targetLanguageInput}
          setTargetLanguageInput={setTargetLanguageInput}
          detectedLanguage={detectedLanguage}
          detectionConfidence={detectionConfidence}
          detectingLanguage={detectingLanguage}
          videoUrlInput={videoUrlInput}
          setVideoUrlInput={setVideoUrlInput}
          uploadProgress={uploadProgress}
          uploadingState={uploadingState}
          uploadError={uploadError}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
          videoMetadata={videoMetadata}
          pipelineStageHistory={pipelineStageHistory}
          elapsedSeconds={elapsedSeconds}
          processingLogs={processingLogs}
          handleProcessFile={handleProcessFile}
          handleFileChange={handleFileChange}
          handleLoadDemoVideo={handleLoadDemoVideo}
          handleLoadVideoUrl={handleLoadVideoUrl}
          handleStartDubbing={handleStartDubbing}
          handleResetWorkflow={handleResetWorkflow}
        />
        <ChatView {...chatData} user={user} />
        </>
        )}

      </main>

      <AnimatePresence>
        {showAuthModal && (
          <AuthModal
            open={showAuthModal}
            onClose={() => setShowAuthModal(false)}
          />
        )}
      </AnimatePresence>

      {/* SETTINGS DRAWER */}
      <SettingsView
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        voiceSettings={voiceSettings}
        setVoiceSettings={setVoiceSettings}
        elevenLabsKey={elevenLabsKey}
        setElevenLabsKey={setElevenLabsKey}
        projects={projects}
        setSelectedProjectId={setSelectedProjectId}
        setAppState={setAppState}
        isRealFirebase={isRealFirebase}
      />

    </div>
  );
}
