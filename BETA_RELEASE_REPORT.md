# BETA_RELEASE_REPORT.md

**Product:** SCREEN.AI (Pro Studio Dubbing / LuminaDub)  
**Audit date:** 2026-08-02  
**Scope:** Full-stack production beta readiness (React + FastAPI + AI pipeline)  
**Constraint:** No new features / UI redesign. Critical bugfixes only during audit.

---

## Executive Summary

The core dubbing path works end-to-end: upload → FFmpeg → Whisper → NLLB → ElevenLabs → merge → mux → preview/download, with async jobs + SSE progress, project persistence, transcript editing, and voice selection wired to FastAPI.

**Recommendation: Conditional beta (private / invite-only).**  
Suitable for a controlled beta with GPU hosts, configured ElevenLabs keys, and trusted operators. **Not ready for public internet exposure** until auth, output retention, and remaining hardening items below are addressed.

---

## Critical Issues

| ID | Area | Finding | Evidence | Status |
|----|------|---------|----------|--------|
| C1 | Security / API | `/process-video` accepted any file type/size (DoS / junk uploads) | `backend/app.py` previously had no extension or size checks | **Fixed in audit** — extension allowlist + empty-file check + `MAX_UPLOAD_BYTES` (default 500MB) returning `400`/`413` |
| C2 | Security | `/render-video` used raw `video.filename` / `audio.filename` in paths (path traversal risk) and returned a trailing-comma **tuple** instead of `FileResponse` | `backend/app.py` `render_video` | **Fixed in audit** — `os.path.basename`, `..` rejection, temp cleanup in `finally` |
| C3 | React / leaks | `EventSource` not closed on unmount or when starting a new job (duplicate streams / setState after unmount risk) | `frontend/src/App.tsx` `startSSEListener` | **Fixed in audit** — `eventSourceRef` + unmount cleanup |
| C4 | React / leaks | Preview `URL.createObjectURL` not revoked on re-upload / reset / unmount | `handleProcessFile` | **Fixed in audit** — `previewObjectUrlRef` revoke |
| C5 | Security | Unauthenticated public mount of `/outputs` exposes all rendered MP4s if host is reachable | `app.mount("/outputs", StaticFiles(...))` | **Open** — require auth, signed URLs, or private network for beta |
| C6 | Reliability | Whisper loads `large-v3` on `cuda` at **import time**; missing GPU / CUDA misconfig crashes entire API process before requests | `backend/services/whisper_service.py` L4–8; `config.py` `WHISPER_DEVICE=cuda` | **Open** — lazy load + CPU fallback for beta hosts without GPU |

---

## High Priority

| ID | Area | Finding | Notes |
|----|------|---------|-------|
| H1 | Files | Pipeline leaves orphan artifacts in `outputs/`: `segment_*.mp3`, overwritten `final_audio.mp3`, `concat.txt`, many historical `*.mp4` (~18 MP4s observed, hundreds of MB) | `pipeline_service` only deletes extracted WAV; TTS/merge intermediates not cleaned; no retention policy |
| H2 | Files | `ffmpeg_service.extract_audio` uses `tempfile.mktemp` (racey) and other routes (`/detect-language`, `/detect-video-language`, `/transcribe-video`) can leak temps if FFmpeg/Whisper throws before `os.remove` | Wrap in `try/finally` |
| H3 | Jobs | In-memory `jobs = {}` grows forever; no TTL/eviction; lost on restart | `job_service.py` — fine for single-node beta, not multi-user prod |
| H4 | Security | No auth/rate limits on `/process-video`, `/events/{id}`, `/eleven-test`, `/voices` | `/eleven-test` burns ElevenLabs quota unauthenticated |
| H5 | Error handling | Missing/invalid `ELEVENLABS_API_KEY` fails mid-job (caught by `fail_job`) but no preflight health check; placeholder voice IDs `YOUR_BUNTY_VOICE_ID` silently fall back to default | `elevenlabs_service.py` |
| H6 | GPU | No graceful handling when CUDA OOM or device unavailable after startup | Process may die mid-request |
| H7 | React | Duplicate state: `processingLogs` vs `project.logs`; `videoMetadata` vs project media fields; cloud projects overwrite localStorage on login | Can surprise users; not a crash |
| H8 | Repo hygiene | Root/backend `.gitignore` ignores `.env` but **not** `outputs/`, `temp/`, large MP4s — risk of committing binaries/secrets-adjacent artifacts | Add ignore rules before public repo |

---

## Medium Priority

| ID | Area | Finding |
|----|------|---------|
| M1 | FastAPI | Many endpoints return `200` with `null` or mock data instead of proper `404`/`422` (`GET /job/{id}` when missing; stub `/api/chat`, `/api/transcribe-audio`, `/api/pipeline-sse`) |
| M2 | FastAPI | Sync endpoints (`/translate`, `/detect-language`) have little input validation; unhandled exceptions become generic 500s |
| M3 | Pipeline | NLLB translates **full text and each segment** sequentially — double work; segment TTS is sequential HTTP to ElevenLabs |
| M4 | Pipeline | Merge uses fixed `outputs/final_audio.mp3` / `concat.txt` — concurrent jobs can race and corrupt audio |
| M5 | Frontend | Language detect `/api/detect-language` is filename heuristic mock, not Whisper — confidence UI can mislead |
| M6 | Frontend | Settings UI still exposes masked “API key” fields that are not wired to backend env |
| M7 | Frontend | `App.tsx` is a large monolith (~2.2k lines) — harder to test; acceptable for beta, not for long-term |
| M8 | Security | Firebase mock defaults in `firebase.ts` / `.env.example`; real keys via `VITE_*` are exposed to the browser (expected for Firebase, must use security rules) |
| M9 | Voices | Library voices without valid ElevenLabs IDs fall back to George — selection may not audibly change until env IDs are set |

---

## Low Priority

| ID | Area | Finding |
|----|------|---------|
| L1 | UX | Hardcoded FPS `24` in some metadata paths when real FPS unknown |
| L2 | Dead code | Legacy `server.ts` Gemini demo; unused dashboard components; placeholder WebSocket `/live` |
| L3 | Logging | `print` used for ElevenLabs voice resolution — prefer structured logging |
| L4 | CORS | Dev origins only in `.env.example` — production origin must be configured deliberately |
| L5 | TranscriptEditor | `onDraftChange` + `project.transcript` deps can reset draft during aggressive SSE updates (mitigated after job completes) |

---

## Verification Checklist

### 1. React

| Check | Result |
|-------|--------|
| Build | `npm run build` succeeds |
| Console / warnings | No build-time errors; runtime depends on browser — SSE and object URL leaks **fixed** |
| Memory leaks | Interval for elapsed time cleaned; SSE + object URL cleanup **fixed**; MediaRecorder/WebSocket still operator-driven |
| Duplicate state | Present but functional (see H7) |

### 2. FastAPI

| Check | Result |
|-------|--------|
| Unhandled exceptions | Job worker wraps pipeline in `try/except` → `fail_job`; many ad-hoc routes still lack guards |
| HTTP status codes | Improved on `/process-video` (`400`/`413`); other routes inconsistent |
| Validation | Process-video extension/size **added**; other uploads partial |

### 3. Pipeline

| Stage | Status |
|-------|--------|
| Upload | Working (async job + validation) |
| FFmpeg extract | Working; temp WAV cleaned on success path |
| Whisper | Working when CUDA/model available; brittle startup |
| Translation | Working (NLLB); sequential bottleneck |
| ElevenLabs | Working with env key; sequential per segment |
| Merge + mux | Working; fixed filenames race under concurrency |
| Preview / Download | Working via `/outputs/{uuid}.mp4` blob fetch |

### 4. Files

| Check | Result |
|-------|--------|
| Upload temp cleaned | Yes (`process-video` `finally`) |
| Extracted WAV cleaned | Yes on success |
| Segment MP3 / concat / final_audio | **Not** cleaned — orphans accumulate |
| Output MP4 retention | Unbounded growth observed |

### 5. Performance

Observed from stage evidence + architecture (short ~15s clip, single segment in sample runs):

| Stage | Relative cost | Notes |
|-------|---------------|-------|
| Model cold start | **Very high** | Whisper `large-v3` + NLLB load at process start |
| Whisper transcription | **High** | Dominates for longer videos |
| NLLB per-segment | **High** | Scales with segment count; also re-translates full text |
| ElevenLabs TTS | **High / variable** | Network + quota; sequential loop |
| FFmpeg extract/merge/mux | **Low–medium** | Usually sub-second to a few seconds |
| Total wall time | Tracked in job `processingTime` / `stage_timings` | UI shows elapsed + ETA during processing |

**Primary bottlenecks:** (1) Whisper large-v3, (2) sequential NLLB segments, (3) sequential ElevenLabs calls.  
**Concurrency risk:** shared `final_audio.mp3` / `concat.txt` / `segment_NNN.mp3` names.

### 6. Security

| Topic | Status |
|-------|--------|
| API keys | Backend via `.env` (gitignored); not hardcoded in pipeline |
| Env examples | Present (`backend/.env.example`, `frontend/.env.example`) |
| Upload validation | **Improved** on main path |
| Path traversal | **Fixed** on `/render-video`; StaticFiles serves only `OUTPUT_DIR` basenames |
| Auth | **Missing** for processing & outputs |
| `/eleven-test` | Should be disabled or protected before any shared deploy |

### 7. Error Handling

| Scenario | Behavior |
|----------|----------|
| Invalid file (extension) | Frontend blocks; backend now `400` |
| Empty / oversized file | Backend `400` / `413` |
| Missing ElevenLabs key | Runtime error → job `Failed` + log |
| Missing GPU | Likely **process fail at import** (C6) |
| FFmpeg failure | Exception → `fail_job`; some routes may leave temps |
| ElevenLabs timeout/error | Propagates to `fail_job` (no dedicated retry/timeout wrapper) |

---

## Critical Fixes Applied During Audit

1. `/process-video` file type + empty + max size validation  
2. `/render-video` filename sanitization, temp cleanup, remove erroneous trailing comma  
3. Frontend `EventSource` lifecycle management  
4. Frontend object URL revoke on replace/reset/unmount  

---

## Release Recommendation

### Ship as **private beta** if:

- [ ] Host binds to localhost / private VPC (not open `0.0.0.0` without auth)  
- [ ] `.env` has real `ELEVENLABS_API_KEY` and voice IDs for library voices you advertise  
- [ ] CUDA + Faster-Whisper verified on the beta machine **or** `WHISPER_DEVICE=cpu` tested  
- [ ] Operators understand outputs disk growth and manually prune `backend/outputs`  
- [ ] Disable or protect `/eleven-test` before sharing the URL  

### Block **public beta** until:

- [ ] Auth (or signed job tokens) on upload, SSE, and `/outputs`  
- [ ] Per-job unique intermediate filenames + cleanup of segments/`final_audio`/`concat.txt`  
- [ ] Whisper lazy-load + CPU fallback  
- [ ] Job store TTL / persistence  
- [ ] Concurrent-job safety for merge paths  

### Verdict

**CONDITIONAL GO for invite-only / operator-supervised beta.**  
**NO-GO for unrestricted public production** until Critical C5–C6 and High H1–H5 are resolved.

---

## Suggested Next Hardening Sprint (not in scope)

1. Output lifecycle manager (TTL + delete intermediates after mux)  
2. Auth gate + disable debug routes  
3. Lazy Whisper + device fallback  
4. Per-job working directories under `temp/{job_id}/`  
5. Health endpoint (`/healthz`) checking FFmpeg, Whisper device, ElevenLabs key presence  

---

*End of report.*
