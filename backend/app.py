from contextlib import asynccontextmanager

from services.tts_service import generate_speech
from services.pipeline_service import process_video
from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect, Body, Request
import tempfile
import shutil
import os
import asyncio
from services.translator_service import translate_text
from services.video_renderer_service import replace_audio
from services.whisper_service import detect_language, transcribe_audio
from services.ffmpeg_service import extract_audio
from services.elevenlabs_service import get_all_voices, generate_speech
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse, RedirectResponse, Response
from fastapi.middleware.cors import CORSMiddleware
import json

from config import CORS_ORIGINS, TEMP_DIR
from services.secure_media_service import resolve_project_media
from services.firebase_auth import require_authenticated_user
from services.job_service import (
    create_job,
    update_job,
    finish_job,
    fail_job,
    get_job,
    delete_job,
    jobs as job_store,
)
from services.output_registry import delete_project_output, secure_video_url, secure_download_url
from services.db import init_db
from services.project_repository import list_projects_by_owner
from services.health_service import run_startup_checks, run_checks
from services.logging_service import configure_logging, get_logger
from services.metrics_service import metrics_payload
from services.observability_middleware import ObservabilityMiddleware


@asynccontextmanager
async def lifespan(_app: FastAPI):
    configure_logging()
    log = get_logger("screen_ai.startup")
    try:
        init_db()
    except Exception as db_exc:
        log.warning("database init failed: %s", db_exc)
    try:
        from services.job_runner import process_queued_job
        from services.queue_service import set_inline_handler, resolve_backend

        set_inline_handler(process_queued_job)
        log.info("queue backend=%s", resolve_backend(), extra={"event": "queue_backend"})
    except Exception as q_exc:
        log.warning("queue setup warning: %s", q_exc)
    try:
        _app.state.startup_checks = run_startup_checks()
    except Exception as start_exc:
        log.error("Startup checks aborted: %s", start_exc)
        raise
    yield


app = FastAPI(
    title="LuminaDub Backend",
    version="1.0.0",
    lifespan=lifespan,
)

# Last add_middleware is outermost. CORS must be outermost so ACAO headers
# are always applied (including on preflight / error responses).
app.add_middleware(ObservabilityMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)

# Public /outputs static mount removed — use /api/projects/{id}/video|download


@app.get("/")
def home():
    return {
        "status": "Backend Running",
        "app": "LuminaDub AI",
    }


@app.get("/health")
def health_live():
    """Liveness probe — process is up."""
    return {"status": "ok", "service": "screen-ai-api"}


@app.get("/ready")
def health_ready():
    """Readiness probe — required dependencies available."""
    # Whisper already loaded with the app; include it in readiness.
    result = run_checks(include_whisper=True)
    code = 200 if result["ok"] else 503
    return JSONResponse(status_code=code, content={"status": "ready" if result["ok"] else "not_ready", **result})


@app.get("/health/detailed")
def health_detailed():
    """Detailed dependency report (same payload as readiness)."""
    result = run_checks(include_whisper=True)
    code = 200 if result["ok"] else 503
    return JSONResponse(status_code=code, content=result)


@app.get("/metrics")
def prometheus_metrics():
    """Prometheus scrape endpoint (Grafana-ready)."""
    body, content_type = metrics_payload()
    return Response(content=body, media_type=content_type)

@app.post("/job")
def new_job():

    job_id = create_job()

    return {
        "job_id": job_id,
        "status": "created"
    }

@app.post("/api/detect-language")
async def detect_language_audio(payload: dict = Body(...)):
    filename = (payload or {}).get("filename", "")
    sample_text = (payload or {}).get("sampleText", "")

    lowered_name = (filename or "").lower()
    lowered_text = (sample_text or "").lower()

    if "french" in lowered_name or "paris" in lowered_name or "bonjour" in lowered_text or "oui" in lowered_text:
        detected = "French"
        confidence = 0.97
    elif "hindi" in lowered_name or "india" in lowered_name or "namaste" in lowered_text or "namaskar" in lowered_text:
        detected = "Hindi"
        confidence = 0.98
    elif "arabic" in lowered_name or "dubai" in lowered_name or "marhaban" in lowered_text or "salam" in lowered_text:
        detected = "Arabic"
        confidence = 0.95
    elif "spanish" in lowered_name or "madrid" in lowered_name or "hola" in lowered_text or "gracias" in lowered_text:
        detected = "Spanish"
        confidence = 0.96
    elif "german" in lowered_name or "berlin" in lowered_name or "hallo" in lowered_text:
        detected = "German"
        confidence = 0.92
    else:
        detected = "English"
        confidence = 0.94

    return {"detected": detected, "confidence": confidence}


@app.post("/detect-language")
async def detect_language_audio_upload(file: UploadFile = File(...)):

    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp:

        shutil.copyfileobj(file.file, temp)

        audio_path = temp.name

    result = detect_language(audio_path)

    os.remove(audio_path)

    return result


@app.post("/detect-video-language")
async def detect_video_language(file: UploadFile = File(...)):

    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp:

        shutil.copyfileobj(file.file, temp)

        video_path = temp.name

    audio_path = extract_audio(video_path)

    result = detect_language(audio_path)

    os.remove(video_path)

    os.remove(audio_path)

    return result

@app.post("/api/transcribe-audio")
async def transcribe_audio_api(payload: dict = Body(...)):
    audio = (payload or {}).get("audio")
    if not audio:
        return JSONResponse(status_code=400, content={"error": "Audio data is required."})

    return {"text": "This is a FastAPI-backed transcription placeholder. Upload a real audio pipeline implementation to replace this stub."}


@app.post("/transcribe-video")
async def transcribe_video(file: UploadFile = File(...)):

    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp:
        shutil.copyfileobj(file.file, temp)
        video_path = temp.name

    audio_path = extract_audio(video_path)

    result = transcribe_audio(audio_path)

    os.remove(video_path)
    os.remove(audio_path)

    return result

@app.post("/translate")
async def translate(
    text: str,
    source_lang: str,
    target_lang: str
):
    translated = translate_text(
        text,
        source_lang,
        target_lang
    )

    return {
        "translated_text": translated
    }
@app.get("/job/{job_id}")
def job_status(job_id: str):

    return get_job(job_id)

@app.post("/generate-audio")
async def generate_audio(text: str):
    filepath = await generate_speech(text)
    return FileResponse(
        filepath,
        media_type="audio/mpeg",
        filename="translated.mp3"
    )

@app.post("/api/chat")
async def chat_api(payload: dict = Body(...)):
    message = (payload or {}).get("message", "")
    if not message:
        return JSONResponse(status_code=400, content={"error": "Message is required."})

    from services import gemini_service
    from services.gemini_service import GeminiError

    if not gemini_service.is_configured():
        return JSONResponse(
            status_code=503,
            content={
                "error": "Gemini is not configured. Set GEMINI_API_KEY on the backend.",
            },
        )

    history = (payload or {}).get("history") or []
    system_instruction = (payload or {}).get("systemInstruction")
    model_name = (payload or {}).get("modelName")
    role = (payload or {}).get("role")

    try:
        text = await asyncio.to_thread(
            gemini_service.chat,
            message,
            history=history if isinstance(history, list) else [],
            system_instruction=system_instruction,
            role=role,
            model_name=model_name,
        )
        return {"text": text, "provider": "gemini"}
    except GeminiError as exc:
        code = exc.status_code or 502
        # Map to friendly HTTP without leaking secrets
        if code in (401, 403):
            status = 502
        elif code == 429:
            status = 429
        elif code == 503:
            status = 503
        elif code == 504:
            status = 504
        else:
            status = 502 if exc.retryable else 400
        return JSONResponse(status_code=status, content={"error": str(exc)})
    except Exception as exc:
        get_logger("screen_ai.chat").error(
            "chat failed",
            extra={"event": "chat_error", "error_type": type(exc).__name__},
        )
        return JSONResponse(
            status_code=500,
            content={"error": "Chat failed unexpectedly."},
        )


@app.post("/api/translate")
async def translate_api(payload: dict = Body(...)):
    """Structured translation helper (Gemini or NLLB via translator facade)."""
    text = (payload or {}).get("text", "")
    source_lang = (payload or {}).get("source_lang") or (payload or {}).get("sourceLang") or "en"
    target_lang = (payload or {}).get("target_lang") or (payload or {}).get("targetLang") or "en"
    if text is None or str(text).strip() == "":
        return JSONResponse(status_code=400, content={"error": "text is required."})
    try:
        translated = await asyncio.to_thread(
            translate_text, str(text), str(source_lang), str(target_lang)
        )
        from services.translator_service import resolve_translation_provider

        return {
            "translated_text": translated,
            "provider": resolve_translation_provider(),
            "source_lang": source_lang,
            "target_lang": target_lang,
        }
    except ValueError as exc:
        return JSONResponse(status_code=400, content={"error": str(exc)})
    except Exception as exc:
        from services.gemini_service import GeminiError

        if isinstance(exc, GeminiError):
            return JSONResponse(
                status_code=exc.status_code or 502,
                content={"error": str(exc)},
            )
        get_logger("screen_ai.translate").error(
            "translate failed",
            extra={"event": "translate_error", "error_type": type(exc).__name__},
        )
        return JSONResponse(status_code=500, content={"error": "Translation failed."})


@app.post("/api/analyze-video")
async def analyze_video_api(payload: dict = Body(...)):
    title = (payload or {}).get("title", "Active Video")
    duration = (payload or {}).get("duration", "00:30")
    return {
        "analysis": f"### Analysis\n- Title: {title}\n- Duration: {duration}\n- Source: FastAPI backend"
    }


@app.post("/process-video")
async def process_video_api(
    request: Request,
    target_lang: str = "en",
    voice: str = "george",
    duration: str = "",
    resolution: str = "",
    fps: str = "",
    file_size: str = "",
    file: UploadFile = File(...)
):
    allowed_ext = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
    original_name = file.filename or "upload.mp4"
    ext = os.path.splitext(original_name)[1].lower()
    if ext not in allowed_ext:
        return JSONResponse(
            status_code=400,
            content={
                "error": f"Unsupported file type '{ext or 'unknown'}'. Allowed: {', '.join(sorted(allowed_ext))}"
            },
        )

    max_upload_bytes = int(os.getenv("MAX_UPLOAD_BYTES", str(500 * 1024 * 1024)))
    user = require_authenticated_user(request)
    owner_id = user.uid

    # Create job first so we can stream the upload once into a durable worker path
    os.makedirs(TEMP_DIR, exist_ok=True)
    job_id = create_job(
        title=os.path.basename(original_name) or "Uploaded Video",
        target_language=target_lang,
        voice=voice,
        owner_id=owner_id,
        metadata={
            "fileName": os.path.basename(original_name) or "upload.mp4",
            "fileSize": file_size or "N/A",
            "duration": duration or "",
            "resolution": resolution or "",
            "fps": None,
            "voice": voice,
            "owner_id": owner_id,
        },
    )
    video_path = os.path.join(TEMP_DIR, f"{job_id}{ext or '.mp4'}")
    try:
        with open(video_path, "wb") as out:
            shutil.copyfileobj(file.file, out)
    except Exception:
        if os.path.exists(video_path):
            os.remove(video_path)
        fail_job(job_id, RuntimeError("Failed to persist upload"))
        return JSONResponse(status_code=500, content={"error": "Failed to save upload.", "job_id": job_id})

    try:
        actual_size = os.path.getsize(video_path)
    except OSError:
        actual_size = 0

    if actual_size <= 0:
        if os.path.exists(video_path):
            os.remove(video_path)
        fail_job(job_id, ValueError("Uploaded file is empty."))
        return JSONResponse(status_code=400, content={"error": "Uploaded file is empty.", "job_id": job_id})

    if actual_size > max_upload_bytes:
        if os.path.exists(video_path):
            os.remove(video_path)
        fail_job(job_id, ValueError("File too large"))
        return JSONResponse(
            status_code=413,
            content={
                "error": f"File too large ({actual_size} bytes). Max allowed is {max_upload_bytes} bytes.",
                "job_id": job_id,
            },
        )

    upload_size = file_size or f"{actual_size / (1024 * 1024):.1f} MB"

    fps_value = None
    if fps:
        try:
            fps_value = float(fps)
        except ValueError:
            fps_value = None

    # Patch metadata now that size/fps are known
    job = get_job(job_id)
    if job:
        meta = job.setdefault("metadata", {})
        meta["fileSize"] = upload_size
        meta["fps"] = fps_value
        meta["duration"] = duration or meta.get("duration") or ""
        meta["resolution"] = resolution or meta.get("resolution") or ""

    update_job(
        job_id,
        stage="Upload",
        status="queued",
        progress=10,
        message=f"Upload complete. Queued for processing (voice={voice}).",
    )

    from services.queue_service import enqueue_job

    try:
        enqueue_meta = enqueue_job(
            {
                "job_id": job_id,
                "video_path": video_path,
                "target_language": target_lang,
                "voice": voice,
                "attempt": 0,
            }
        )
    except Exception as enqueue_exc:
        if os.path.exists(video_path):
            os.remove(video_path)
        fail_job(job_id, enqueue_exc)
        return JSONResponse(
            status_code=503,
            content={"error": f"Failed to enqueue job: {enqueue_exc}", "job_id": job_id},
        )

    return JSONResponse(
        {
            "job_id": job_id,
            "status": "queued",
            "message": "Processing queued",
            "voice": voice,
            "queue": enqueue_meta.get("backend"),
        }
    )


@app.get("/api/projects/{project_id}/video")
async def stream_project_video(project_id: str, request: Request):
    """Auth gate then redirect to signed URL (S3) or stream local file."""
    media = resolve_project_media(project_id, request, disposition="inline")
    if media.get("signed_url"):
        return RedirectResponse(
            url=media["signed_url"],
            status_code=302,
            headers={"Cache-Control": "private, no-store"},
        )
    if not media.get("path"):
        return JSONResponse(status_code=404, content={"detail": "Output video file not found."})
    return FileResponse(
        path=media["path"],
        media_type="video/mp4",
        filename=media["filename"],
        content_disposition_type="inline",
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@app.get("/api/projects/{project_id}/download")
async def download_project_video(project_id: str, request: Request):
    """Auth gate then signed download URL (S3) or local attachment stream."""
    media = resolve_project_media(project_id, request, disposition="attachment")
    download_name = media["title"]
    if not str(download_name).lower().endswith(".mp4"):
        download_name = f"{download_name}.mp4"
    download_name = os.path.basename(str(download_name).replace("\\", "/")) or media["filename"]
    if media.get("signed_url"):
        return RedirectResponse(
            url=media["signed_url"],
            status_code=302,
            headers={"Cache-Control": "private, no-store"},
        )
    if not media.get("path"):
        return JSONResponse(status_code=404, content={"detail": "Output video file not found."})
    return FileResponse(
        path=media["path"],
        media_type="video/mp4",
        filename=download_name,
        content_disposition_type="attachment",
        headers={
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@app.get("/api/projects")
async def list_projects(request: Request):
    """List projects owned by the authenticated user (database-backed)."""
    user = require_authenticated_user(request)
    projects = list_projects_by_owner(user.uid)

    # Merge any in-memory jobs not yet flushed / mid-flight
    seen = {p.get("id") for p in projects}
    for job_id, job in list(job_store.items()):
        if job.get("owner_id") != user.uid:
            continue
        if job_id in seen:
            # Prefer freshest in-memory progress for active jobs
            for i, p in enumerate(projects):
                if p.get("id") == job_id and job.get("status") not in ("Completed", "Failed"):
                    projects[i] = {
                        **p,
                        "status": job.get("status"),
                        "progress": job.get("progress", p.get("progress")),
                        "transcript": job.get("transcript") or p.get("transcript") or [],
                        "timeline": job.get("timeline") or p.get("timeline") or [],
                        "logs": job.get("logs") or p.get("logs") or [],
                    }
            continue
        projects.append(
            {
                "id": job_id,
                "title": job.get("title") or "Untitled Project",
                "status": job.get("status") or "Unknown",
                "owner_id": job.get("owner_id"),
                "createdAt": job.get("created_at"),
                "completedAt": job.get("completed_at"),
                "originalLanguage": job.get("sourceLanguage"),
                "targetLanguage": job.get("targetLanguage"),
                "voice": job.get("voice"),
                "duration": (job.get("metadata") or {}).get("duration"),
                "size": (job.get("metadata") or {}).get("fileSize"),
                "resolution": (job.get("metadata") or {}).get("resolution"),
                "fps": (job.get("metadata") or {}).get("fps"),
                "translationModel": (job.get("metadata") or {}).get("translationModel"),
                "ttsModel": (job.get("metadata") or {}).get("ttsModel"),
                "processingTime": job.get("processingTime"),
                "processingTimeMs": job.get("processingTimeMs"),
                "videoUrl": job.get("videoUrl") or secure_video_url(job_id),
                "downloadUrl": job.get("downloadUrl") or secure_download_url(job_id),
                "progress": job.get("progress", 0),
                "transcript": job.get("transcript") or [],
                "timeline": job.get("timeline") or [],
                "logs": job.get("logs") or [],
            }
        )

    # Ensure secure URLs present
    for p in projects:
        pid = p.get("id")
        if pid and not p.get("videoUrl"):
            p["videoUrl"] = secure_video_url(pid)
        if pid and not p.get("downloadUrl"):
            p["downloadUrl"] = secure_download_url(pid)

    projects.sort(key=lambda r: r.get("createdAt") or r.get("completedAt") or "", reverse=True)
    return {"projects": projects}


@app.get("/api/projects/{project_id}")
async def get_project_detail(project_id: str, request: Request):
    """Fetch a single project (metadata + transcript/timeline/logs) for the owner."""
    user = require_authenticated_user(request)
    job = get_job(project_id)
    if not job:
        return JSONResponse(status_code=404, content={"detail": "Project not found"})
    owner = job.get("owner_id") or (job.get("metadata") or {}).get("owner_id")
    if owner != user.uid:
        return JSONResponse(status_code=403, content={"detail": "Forbidden"})
    meta = job.get("metadata") or {}
    return {
        "id": job["id"],
        "title": job.get("title") or "Untitled Project",
        "status": job.get("status"),
        "owner_id": owner,
        "createdAt": job.get("created_at"),
        "completedAt": job.get("completed_at"),
        "originalLanguage": job.get("sourceLanguage"),
        "targetLanguage": job.get("targetLanguage"),
        "voice": job.get("voice"),
        "duration": meta.get("duration"),
        "size": meta.get("fileSize"),
        "resolution": meta.get("resolution"),
        "fps": meta.get("fps"),
        "translationModel": meta.get("translationModel"),
        "ttsModel": meta.get("ttsModel"),
        "processingTime": job.get("processingTime"),
        "processingTimeMs": job.get("processingTimeMs"),
        "videoUrl": job.get("videoUrl") or secure_video_url(project_id),
        "downloadUrl": job.get("downloadUrl") or secure_download_url(project_id),
        "progress": job.get("progress", 0),
        "transcript": job.get("transcript") or [],
        "timeline": job.get("timeline") or job.get("transcript") or [],
        "logs": job.get("logs") or [],
        "storage_provider": job.get("storage_provider"),
        "storage_key": job.get("storage_key"),
    }


@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: str, request: Request):
    """Delete a project owned by the authenticated user."""
    user = require_authenticated_user(request)

    job = get_job(project_id)
    found = bool(job)
    if job:
        owner = job.get("owner_id") or (job.get("metadata") or {}).get("owner_id")
        if owner != user.uid:
            return JSONResponse(status_code=403, content={"detail": "Forbidden"})

    try:
        delete_job(project_id, owner_id=user.uid)
    except PermissionError:
        return JSONResponse(status_code=403, content={"detail": "Forbidden"})

    try:
        delete_project_output(project_id, user.uid, delete_file=True)
        found = True
    except FileNotFoundError:
        pass
    except PermissionError:
        return JSONResponse(status_code=403, content={"detail": "Forbidden"})
    except ValueError:
        return JSONResponse(status_code=400, content={"detail": "Invalid project id"})

    if not found:
        return JSONResponse(status_code=404, content={"detail": "Project not found"})

    return {"ok": True, "id": project_id}


@app.get("/events/{job_id}")
async def job_events(job_id: str):
    async def event_stream():
        sent_history = 0
        last_fingerprint = None
        while True:
            # Refresh from DB so Redis worker progress is visible across processes
            job = get_job(job_id, refresh=True)
            if not job:
                yield f"data: {json.dumps({'id': job_id, 'status': 'Failed', 'message': 'Job not found', 'progress': 0})}\n\n"
                break

            history = job.get("stage_history") or [job.get("stage") or job.get("status")]
            from services.job_service import STAGE_PROGRESS

            # Emit one SSE event per newly recorded stage so fast steps are not skipped
            while sent_history < len(history):
                stage = history[sent_history]
                snapshot = dict(job)
                snapshot["stage"] = stage
                if job.get("status") not in ("Completed", "Failed"):
                    if job.get("status") in ("queued", "processing") and stage == "Upload":
                        snapshot["status"] = job.get("status")
                        snapshot["progress"] = job.get("progress", STAGE_PROGRESS.get(stage, 0))
                        snapshot["message"] = job.get("message") or stage
                    else:
                        snapshot["status"] = stage
                        snapshot["progress"] = STAGE_PROGRESS.get(stage, job.get("progress", 0))
                        snapshot["message"] = job.get("message") or stage
                elif stage != "Completed" and stage != "Failed":
                    snapshot["status"] = stage
                    snapshot["progress"] = STAGE_PROGRESS.get(stage, job.get("progress", 0))
                    snapshot["message"] = stage
                else:
                    snapshot["status"] = job.get("status")
                    snapshot["progress"] = job.get("progress", 100)
                    snapshot["message"] = job.get("message", stage)

                yield f"data: {json.dumps(snapshot)}\n\n"
                last_fingerprint = (
                    snapshot.get("status"),
                    snapshot.get("progress"),
                    snapshot.get("message"),
                    len(history),
                )
                sent_history += 1

            # Re-emit when status/progress changes without a new stage (queued → processing)
            fingerprint = (
                job.get("status"),
                job.get("progress"),
                job.get("message"),
                len(history),
            )
            if sent_history >= len(history) and fingerprint != last_fingerprint:
                snapshot = dict(job)
                yield f"data: {json.dumps(snapshot)}\n\n"
                last_fingerprint = fingerprint

            if job.get("status") in ("Completed", "Failed") and sent_history >= len(history):
                break

            await asyncio.sleep(0.25)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/voices")
def voices():
    return {
        "voices": get_all_voices()
    }

@app.get("/eleven-test")
def eleven_test():

    filepath = generate_speech(
        text="Hello Arbaaz. This is ElevenLabs speaking.",
        filename="eleven_test.mp3"
    )

    return FileResponse(
        path=filepath,
        media_type="audio/mpeg",
        filename="eleven_test.mp3"
    )

@app.get("/api/pipeline-sse")
async def pipeline_sse(jobId: str):
    async def event_stream():
        payload = {
            "id": jobId,
            "status": "queued",
            "message": "FastAPI pipeline status placeholder",
            "progress": 0,
        }
        yield f"data: {json.dumps(payload)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.websocket("/live")
async def live_websocket(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            await websocket.receive_text()
            await websocket.send_text('{"text":"FastAPI live socket placeholder"}')
    except WebSocketDisconnect:
        pass


@app.post("/render-video")
async def render_video(
    video: UploadFile = File(...),
    audio: UploadFile = File(...)
):
    import uuid

    temp_dir = TEMP_DIR
    os.makedirs(temp_dir, exist_ok=True)

    safe_video_name = os.path.basename(video.filename or "video.mp4") or "video.mp4"
    safe_audio_name = os.path.basename(audio.filename or "audio.mp3") or "audio.mp3"
    if ".." in safe_video_name or ".." in safe_audio_name:
        return JSONResponse(status_code=400, content={"error": "Invalid filename."})

    video_path = os.path.join(temp_dir, f"{uuid.uuid4()}_{safe_video_name}")
    audio_path = os.path.join(temp_dir, f"{uuid.uuid4()}_{safe_audio_name}")

    try:
        with open(video_path, "wb") as buffer:
            shutil.copyfileobj(video.file, buffer)

        with open(audio_path, "wb") as buffer:
            shutil.copyfileobj(audio.file, buffer)

        output_video = replace_audio(video_path, audio_path)

        return FileResponse(
            output_video,
            media_type="video/mp4",
            filename="translated_video.mp4"
        )
    finally:
        for path in (video_path, audio_path):
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass
