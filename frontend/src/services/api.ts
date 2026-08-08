import { getIdToken } from '../lib/firebase';

const rawApiBase = import.meta.env.VITE_API_BASE_URL;
// Empty string = same-origin (production nginx reverse-proxy). Unset = local API default.
const API_BASE =
  rawApiBase === undefined || rawApiBase === null
    ? "http://127.0.0.1:8000"
    : String(rawApiBase).replace(/\/$/, "");

export { API_BASE };

function apiOriginForUrl(): string {
  if (API_BASE) return API_BASE;
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "http://127.0.0.1:8000";
}

export async function getWebSocketUrl(path: string, withAuth = false) {
  const base = new URL(apiOriginForUrl());
  const wsProtocol = base.protocol === "https:" ? "wss:" : "ws:";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${wsProtocol}//${base.host}${normalizedPath}`;
  // Browsers cannot set headers on WebSocket; carry the Firebase ID token as ?token=.
  if (withAuth) {
    const token = await getIdToken(false);
    if (token) {
      const u = new URL(url);
      u.searchParams.set("token", token);
      return u.toString();
    }
  }
  return url;
}

export type TranslateVideoMeta = {
  duration?: string;
  resolution?: string;
  fps?: number;
  fileSize?: string;
};

export async function authHeaders(extra?: HeadersInit): Promise<HeadersInit> {
  const token = await getIdToken(false);
  const headers: Record<string, string> = {
    ...(extra as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/** Attach Firebase ID token as query param for <video> / EventSource */
export async function withAuthTokenParam(url: string, forceRefresh = false): Promise<string> {
  const token = await getIdToken(forceRefresh);
  const u = new URL(url, apiOriginForUrl());
  if (token) {
    u.searchParams.set("token", token);
  } else {
    u.searchParams.delete("token");
  }
  // strip legacy user_id
  u.searchParams.delete("user_id");
  return u.toString();
}

export function getProjectVideoUrl(projectId: string) {
  return `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/video`;
}

export function getProjectDownloadUrl(projectId: string) {
  return `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/download`;
}

export async function getAuthenticatedProjectVideoUrl(projectId: string, forceRefresh = false) {
  return withAuthTokenParam(getProjectVideoUrl(projectId), forceRefresh);
}

export async function getAuthenticatedProjectDownloadUrl(projectId: string, forceRefresh = false) {
  return withAuthTokenParam(getProjectDownloadUrl(projectId), forceRefresh);
}

/**
 * Resolve media URL for a project. Prefer async authenticated helpers for playback.
 * Sync helper returns base secure path (caller should add token).
 */
export function resolveProjectMediaUrl(
  project: { id: string; videoUrl?: string; dubbedUrl?: string; status?: string },
  kind: "video" | "download" = "video"
) {
  const raw = project.dubbedUrl || project.videoUrl || "";
  if (/^https?:\/\/storage\.googleapis\.com/i.test(raw) || /^blob:/i.test(raw)) {
    return raw;
  }
  if (project.id && (project.status === "Completed" || /\/outputs\//i.test(raw) || /\/api\/projects\//i.test(raw))) {
    return kind === "download"
      ? getProjectDownloadUrl(project.id)
      : getProjectVideoUrl(project.id);
  }
  return raw;
}

export async function translateVideo(
  file: File,
  language: string,
  voice: string,
  meta?: TranslateVideoMeta
) {
  const form = new FormData();
  form.append("file", file);

  const params = new URLSearchParams({
    target_lang: language,
    voice: voice || "george",
  });
  if (meta?.duration) params.set("duration", meta.duration);
  if (meta?.resolution) params.set("resolution", meta.resolution);
  if (meta?.fps != null && Number.isFinite(meta.fps)) {
    params.set("fps", String(meta.fps));
  }
  if (meta?.fileSize) params.set("file_size", meta.fileSize);

  const headers = await authHeaders();
  const response = await fetch(`${API_BASE}/process-video?${params.toString()}`, {
    method: "POST",
    body: form,
    headers,
  });

  if (response.status === 401) {
    throw new Error("Unauthorized — please sign in with Google and try again.");
  }
  if (response.status === 403) {
    throw new Error("Forbidden — you do not have permission to process this video.");
  }
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Translation failed");
  }

  return response.json() as Promise<{
    job_id: string;
    status: string;
    message?: string;
    voice?: string;
  }>;
}

/**
 * Real spoken-language detection from the actual video file (backend extracts
 * the audio track with ffmpeg and runs Whisper detect_language on it).
 * Returns ISO language code + confidence. No filename heuristics.
 */
export async function detectVideoLanguage(
  file: File
): Promise<{ language: string; confidence: number }> {
  const form = new FormData();
  form.append("file", file);
  const headers = await authHeaders();
  const response = await fetch(`${API_BASE}/detect-video-language`, {
    method: "POST",
    body: form,
    headers,
  });
  if (response.status === 401) {
    throw new Error("Unauthorized — please sign in with Google and try again.");
  }
  if (!response.ok) {
    throw new Error(`Language detection failed (HTTP ${response.status})`);
  }
  const data = await response.json();
  return {
    language: data.language || "unknown",
    confidence: typeof data.confidence === "number" ? data.confidence : 0,
  };
}

export async function getJobEventsUrl(jobId: string) {
  const base = `${API_BASE}/events/${encodeURIComponent(jobId)}`;
  return withAuthTokenParam(base);
}

/** Default text used for local voice previews (short for fast synthesis). */
export const DEFAULT_PREVIEW_TEXT =
  'Hello! This is Dubnex, your local AI voice preview.';

/**
 * Build an authenticated URL for a real TTS preview using the local Coqui
 * engine. The endpoint is GET so the browser <audio> element can stream it
 * directly. Falls back to the voice's static previewUrl when one exists.
 */
export async function resolveVoicePreviewUrl(
  voice: { previewUrl?: string | null; apiVoiceKey?: string },
  language = 'en',
  text: string = DEFAULT_PREVIEW_TEXT
): Promise<string> {
  if (voice.previewUrl) return voice.previewUrl;
  const params = new URLSearchParams({
    text,
    language,
    voice: voice.apiVoiceKey || 'default',
  });
  return withAuthTokenParam(`${API_BASE}/tts-test?${params.toString()}`);
}

export async function fetchUserProjectsFromApi(): Promise<any[]> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/projects`, { headers });
  if (res.status === 401) {
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    throw new Error(await res.text());
  }
  const data = await res.json();
  return Array.isArray(data.projects) ? data.projects : [];
}

export async function deleteProjectOnApi(projectId: string): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/projects/${encodeURIComponent(projectId)}`, {
    method: "DELETE",
    headers,
  });
  if (res.status === 401) throw new Error("Unauthorized");
  if (res.status === 403) throw new Error("Forbidden");
  if (res.status === 404) throw new Error("Project not found");
  if (!res.ok) throw new Error(await res.text());
}

export async function downloadProjectBlob(projectId: string): Promise<Blob> {
  const url = await getAuthenticatedProjectDownloadUrl(projectId, true);
  const res = await fetch(url);
  if (res.status === 401) throw new Error("Unauthorized");
  if (res.status === 403) throw new Error("Forbidden");
  if (!res.ok) throw new Error("Download failed");
  return res.blob();
}
