// useProjects — project list state, local cache, authenticated API sync, and CRUD handlers.
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  saveUserProject,
  loadUserProjects,
  deleteUserProject,
} from '../lib/firebase';
import {
  fetchUserProjectsFromApi,
  deleteProjectOnApi,
  downloadProjectBlob,
  getProjectVideoUrl,
  getProjectDownloadUrl,
} from '../services/api';
import type { Project, TranscriptSegment, VoiceSettings } from '../types';

interface UseProjectsOptions {
  user: { uid: string } | null;
  voiceSettings: VoiceSettings;
  appState: 'upload' | 'processing' | 'result';
  mainView: 'studio' | 'projects' | 'project-details' | 'voices';
  setAppState: (state: 'upload' | 'processing' | 'result') => void;
  setMainView: (view: 'studio' | 'projects' | 'project-details' | 'voices') => void;
  setUploadError: (error: string | null) => void;
  startSSEListener: (jobId: string) => void;
}

export function useProjects({
  user,
  voiceSettings,
  appState,
  mainView,
  setAppState,
  setMainView,
  setUploadError,
  startSSEListener,
}: UseProjectsOptions) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Load projects cached in localStorage on mount
  useEffect(() => {
    const savedProjects = localStorage.getItem('ai_video_translator_projects');
    if (savedProjects) {
      try {
        const parsed = JSON.parse(savedProjects);
        const normalized = (Array.isArray(parsed) ? parsed : []).map((p: Project) => {
          if (p?.status === 'Completed' && p.id) {
            return {
              ...p,
              videoUrl: getProjectVideoUrl(p.id),
              dubbedUrl: getProjectDownloadUrl(p.id),
            };
          }
          if (p?.videoUrl && /\/outputs\//i.test(p.videoUrl) && p.id) {
            return {
              ...p,
              videoUrl: getProjectVideoUrl(p.id),
              dubbedUrl: getProjectDownloadUrl(p.id),
            };
          }
          return p;
        });
        setProjects(normalized);
      } catch (e) {
        console.error('Failed to parse cached jobs:', e);
      }
    }
  }, []);

  // Active Project helper
  const getActiveProject = (): Project | null => {
    return projects.find(p => p.id === selectedProjectId) || null;
  };

  const activeProject = getActiveProject();

  const persistProjects = (nextList: Project[]) => {
    setProjects(nextList);
    localStorage.setItem('ai_video_translator_projects', JSON.stringify(nextList));
  };

  const handlePreviewProject = (id: string) => {
    const project = projects.find((p) => p.id === id);
    if (!project || project.status !== 'Completed') return;
    if (!user) {
      setUploadError('Sign in required to preview secured videos.');
      return;
    }
    setSelectedProjectId(id);
    setMainView('studio');
    setAppState('result');
  };

  const handleOpenProjectDetails = (id: string) => {
    setSelectedProjectId(id);
    setMainView('project-details');
  };

  const handleDownloadProject = async (project: Project) => {
    if (!user) {
      setUploadError('Sign in required to download.');
      return;
    }
    try {
      const blob = await downloadProjectBlob(project.id);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `${project.title || 'dubbed_video'}.mp4`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success(`Downloaded "${project.title || 'video'}"`);
    } catch (err: any) {
      console.error('Download failed:', err);
      setUploadError(err?.message || 'Download failed');
      toast.error('Download failed', {
        description: err?.message || 'Could not download the video.',
      });
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (user) {
      try {
        await deleteProjectOnApi(id);
      } catch (err) {
        console.warn('API delete failed, continuing local delete', err);
      }
      await deleteUserProject(user.uid, id);
    }
    const nextList = projects.filter((p) => p.id !== id);
    persistProjects(nextList);
    if (selectedProjectId === id) {
      setSelectedProjectId(null);
      if (appState === 'result') setAppState('upload');
      if (mainView === 'project-details') setMainView('projects');
    }
    toast.success('Project deleted');
  };

  const handleDuplicateProject = async (id: string) => {
    const source = projects.find((p) => p.id === id);
    if (!source) return;
    const clone: Project = {
      ...source,
      id: `dup-${Date.now().toString(16)}`,
      title: `${source.title} (Copy)`,
      createdAt: new Date().toISOString(),
      logs: [
        ...(source.logs || []),
        {
          id: `log-dup-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'Project duplicated from existing record.',
          step: source.status,
        },
      ],
    };
    const nextList = [clone, ...projects];
    persistProjects(nextList);
    if (user) {
      await saveUserProject(user.uid, clone);
    }
    toast.success(`Duplicated "${source.title}"`);
  };

  const handleSaveTranscript = async (updatedTranscript: TranscriptSegment[]) => {
    if (!selectedProjectId) return;
    const nextList = projects.map((p) =>
      p.id === selectedProjectId
        ? {
            ...p,
            transcript: updatedTranscript,
            logs: [
              ...(p.logs || []),
              {
                id: `log-transcript-${Date.now()}`,
                timestamp: new Date().toISOString(),
                level: 'info' as const,
                message: 'Transcript edits saved.',
                step: 'Transcript Editor',
              },
            ],
          }
        : p
    );
    persistProjects(nextList);
    const saved = nextList.find((p) => p.id === selectedProjectId);
    if (user && saved) {
      await saveUserProject(user.uid, saved);
    }
    toast.success('Transcript saved');
  };

  // Load projects from authenticated API (+ optional Firestore/local cache)
  useEffect(() => {
    if (!user) return;
    const fetchProjects = async () => {
      try {
        const apiProjects = await fetchUserProjectsFromApi();
        if (apiProjects.length > 0) {
          const mapped: Project[] = apiProjects.map((p: any) => ({
            id: p.id,
            title: p.title || 'Untitled Project',
            originalLanguage: p.originalLanguage || 'unknown',
            targetLanguage: p.targetLanguage || '',
            status: p.status || 'Completed',
            progress: typeof p.progress === 'number' ? p.progress : 100,
            size: p.size || '—',
            duration: p.duration || '—',
            createdAt: p.createdAt || new Date().toISOString(),
            videoUrl: p.videoUrl || getProjectVideoUrl(p.id),
            dubbedUrl: p.downloadUrl || getProjectDownloadUrl(p.id),
            voiceSettings: voiceSettings,
            transcript: Array.isArray(p.transcript) ? p.transcript : [],
            logs: Array.isArray(p.logs) ? p.logs : [],
            resolution: p.resolution,
            fps: p.fps,
            translationModel: p.translationModel,
            ttsModel: p.ttsModel,
            processingTime: p.processingTime,
            processingTimeMs: p.processingTimeMs,
            completedAt: p.completedAt,
            voiceKey: p.voice,
            renders: Array.isArray(p.renders) ? p.renders : [],
            versions: Array.isArray(p.versions) ? p.versions : [],
          }));
          setProjects(mapped);
          localStorage.setItem('ai_video_translator_projects', JSON.stringify(mapped));

          // Reconnect SSE for in-flight queue jobs after refresh / new session
          const terminal = new Set(['Completed', 'Failed', 'Unknown']);
          const running = mapped.filter(
            (p) => p.id && !terminal.has(String(p.status)) && (p.progress ?? 0) < 100
          );
          if (running.length > 0) {
            const newest = running[0];
            void startSSEListener(newest.id);
          }
          return;
        }
      } catch (e) {
        console.warn('API project list failed, trying cache', e);
      }
      const cloudProjs = await loadUserProjects(user.uid);
      if (cloudProjs && cloudProjs.length > 0) {
        setProjects(cloudProjs);
        localStorage.setItem('ai_video_translator_projects', JSON.stringify(cloudProjs));
      }
    };
    fetchProjects();
  }, [user]);

  return {
    projects,
    setProjects,
    selectedProjectId,
    setSelectedProjectId,
    activeProject,
    persistProjects,
    handlePreviewProject,
    handleOpenProjectDetails,
    handleDownloadProject,
    handleDeleteProject,
    handleDuplicateProject,
    handleSaveTranscript,
  };
}

export type ProjectsState = ReturnType<typeof useProjects>;
