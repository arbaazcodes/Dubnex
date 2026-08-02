import uuid
import os
from datetime import datetime

from config import TRANSLATION_MODEL, ELEVENLABS_MODEL
from services.output_registry import register_project_output, secure_video_url, secure_download_url
from services.logging_service import get_logger, set_job_id, reset_job_id
from services.metrics_service import (
    duration_between,
    observe_error,
    observe_job_finished,
    observe_job_started,
    observe_stage_duration,
    observe_stage_start,
)

jobs = {}
logger = get_logger("screen_ai.jobs")

# Progress percentages for each pipeline stage
STAGE_PROGRESS = {
    "Upload": 10,
    "Audio Extraction": 25,
    "Whisper": 40,
    "Translation": 55,
    "TTS": 70,
    "Audio Merge": 85,
    "Video Rendering": 95,
    "Completed": 100,
}


def _close_previous_stage(job: dict, next_stage: str | None, now_iso: str) -> None:
    """Record duration for the stage that just ended (observability only)."""
    history = job.get("stage_history") or []
    timings = job.get("stage_timings") or {}
    if not history:
        return
    prev = history[-1]
    if next_stage and prev == next_stage:
        return
    start_iso = timings.get(prev)
    dur = duration_between(start_iso, now_iso)
    if dur is None:
        return
    durations = job.setdefault("stage_durations_sec", {})
    # Only record once per stage completion
    if prev not in durations:
        durations[prev] = round(dur, 4)
        observe_stage_duration(prev, dur)
        logger.info(
            "pipeline stage completed",
            extra={
                "event": "stage_completed",
                "stage": prev,
                "duration_ms": round(dur * 1000, 2),
                "job_id": job.get("id"),
            },
        )


def _persist(job_id: str) -> None:
    """Write current in-memory job snapshot to the database."""
    job = jobs.get(job_id)
    if not job:
        return
    try:
        from services.project_repository import upsert_project

        upsert_project(job)
    except Exception:
        # Persistence must not break the live pipeline / SSE path
        pass


def create_job(
    title: str = "",
    source_language: str = "",
    target_language: str = "",
    metadata: dict | None = None,
    voice: str = "george",
    owner_id: str | None = None,
):
    """Create a unique job and return its ID."""
    job_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    meta = dict(metadata or {})
    meta.setdefault("voice", voice)
    meta.setdefault("translationModel", TRANSLATION_MODEL)
    meta.setdefault("ttsModel", ELEVENLABS_MODEL)
    if owner_id:
        meta["owner_id"] = owner_id

    jobs[job_id] = {
        "id": job_id,
        "status": "Upload",
        "stage": "Upload",
        "progress": STAGE_PROGRESS["Upload"],
        "message": "Upload received",
        "result": None,
        "title": title or "Video Job",
        "sourceLanguage": source_language,
        "targetLanguage": target_language,
        "voice": voice,
        "owner_id": owner_id,
        "metadata": meta,
        "videoUrl": None,
        "downloadUrl": None,
        "output_filename": None,
        "transcript": [],
        "timeline": [],
        "stage_history": ["Upload"],
        "stage_timings": {"Upload": now},
        "stage_durations_sec": {},
        "logs": [
            {
                "id": f"log-{job_id[:8]}-0",
                "timestamp": now,
                "level": "info",
                "message": f"Job created (voice={voice})",
                "step": "Upload",
            }
        ],
        "created_at": now,
        "updated_at": now,
    }
    observe_job_started()
    observe_stage_start("Upload")
    logger.info(
        "job created",
        extra={"event": "job_created", "job_id": job_id, "stage": "Upload"},
    )
    _persist(job_id)

    return job_id


def _append_log(job_id: str, message: str, step: str, level: str = "info"):
    job = jobs.get(job_id)
    if not job:
        return
    job["logs"].append(
        {
            "id": f"log-{uuid.uuid4().hex[:10]}",
            "timestamp": datetime.now().isoformat(),
            "level": level,
            "message": message,
            "step": step,
        }
    )


def update_job(
    job_id: str,
    progress: int | None = None,
    message: str = "",
    stage: str | None = None,
    status: str | None = None,
    **extra,
):
    """Update job progress / stage. Extra keys are merged into the job dict."""
    if job_id not in jobs:
        return

    job = jobs[job_id]
    token = set_job_id(job_id)
    try:
        if stage:
            now_iso = datetime.now().isoformat()
            history = job.setdefault("stage_history", [])
            if not history or history[-1] != stage:
                _close_previous_stage(job, stage, now_iso)
                history.append(stage)
                timings = job.setdefault("stage_timings", {})
                timings[stage] = now_iso
                observe_stage_start(stage)

            job["stage"] = stage
            if progress is None:
                progress = STAGE_PROGRESS.get(stage, job.get("progress", 0))
            if not status:
                status = stage
            if not message:
                message = stage

        if progress is not None:
            job["progress"] = progress
        if message:
            job["message"] = message
        if status:
            job["status"] = status

        for key, value in extra.items():
            job[key] = value

        job["updated_at"] = datetime.now().isoformat()

        if message or stage:
            _append_log(job_id, message or (stage or "update"), stage or job.get("stage", ""), "info")

        _persist(job_id)
    finally:
        reset_job_id(token)


def _format_duration_ms(ms: float) -> str:
    total_sec = max(0, int(round(ms / 1000)))
    mins = total_sec // 60
    secs = total_sec % 60
    if mins <= 0:
        return f"{secs}s"
    return f"{mins}m {secs:02d}s"


def _map_segments_to_transcript(segments: list) -> list:
    transcript = []
    for i, seg in enumerate(segments or []):
        seg_id = seg.get("id", i)
        transcript.append(
            {
                "id": f"t{seg_id}",
                "start": float(seg.get("start") or 0),
                "end": float(seg.get("end") or 0),
                "text": seg.get("original") or seg.get("text") or "",
                "translatedText": seg.get("translated") or seg.get("translatedText") or "",
                "speaker": "Voice",
            }
        )
    return transcript


def finish_job(job_id: str, result: dict):
    if job_id not in jobs:
        return

    job = jobs[job_id]
    token = set_job_id(job_id)
    try:
        completed_at = datetime.now().isoformat()
        _close_previous_stage(job, "Completed", completed_at)
        job["progress"] = 100
        job["stage"] = "Completed"
        job["status"] = "Completed"
        job["message"] = "Completed"
        job["result"] = result
        if isinstance(result, dict) and result.get("stage_profile"):
            meta_prof = job.setdefault("metadata", {})
            meta_prof["stage_profile"] = result["stage_profile"]
        job["updated_at"] = completed_at
        job["completed_at"] = completed_at
        history = job.setdefault("stage_history", [])
        if not history or history[-1] != "Completed":
            history.append("Completed")
            timings = job.setdefault("stage_timings", {})
            timings["Completed"] = completed_at

        output_video = (result or {}).get("output_video") or ""
        filename = output_video.replace("\\", "/").split("/")[-1]
        if filename:
            job["output_filename"] = filename
            owner_id = job.get("owner_id") or (job.get("metadata") or {}).get("owner_id")
            storage_meta: dict = {
                "storage_provider": "local",
                "storage_key": filename,
            }

            # Capture size before cloud upload may delete the local render
            if output_video and os.path.exists(output_video):
                try:
                    size_bytes = os.path.getsize(output_video)
                    meta_pre = job.setdefault("metadata", {})
                    meta_pre["outputFileName"] = filename
                    meta_pre["outputFileSizeBytes"] = size_bytes
                    meta_pre["outputFileSize"] = f"{size_bytes / (1024 * 1024):.1f} MB"
                    if not meta_pre.get("fileSize") or meta_pre.get("fileSize") in ("", "N/A"):
                        meta_pre["fileSize"] = meta_pre["outputFileSize"]
                except OSError:
                    pass

                try:
                    from services.storage_service import persist_rendered_video

                    storage_meta = persist_rendered_video(
                        local_path=output_video,
                        project_id=job_id,
                        filename=filename,
                        owner_id=owner_id,
                    )
                    _append_log(
                        job_id,
                        f"Stored output via {storage_meta.get('storage_provider')} "
                        f"(key={storage_meta.get('storage_key')}, "
                        f"deleted_local={storage_meta.get('deleted_local')})",
                        "Completed",
                        "info",
                    )
                except Exception as storage_exc:
                    _append_log(
                        job_id,
                        f"Storage upload warning: {storage_exc}. Falling back to local file.",
                        "Completed",
                        "warning",
                    )
                    storage_meta = {
                        "storage_provider": "local",
                        "storage_key": filename,
                        "filename": filename,
                        "deleted_local": False,
                    }

            try:
                register_project_output(
                    project_id=job_id,
                    filename=filename,
                    owner_id=owner_id,
                    title=job.get("title"),
                    status="Completed",
                    created_at=job.get("created_at"),
                    completed_at=completed_at,
                    originalLanguage=job.get("sourceLanguage"),
                    targetLanguage=job.get("targetLanguage"),
                    voice=job.get("voice"),
                    duration=(job.get("metadata") or {}).get("duration"),
                    size=(job.get("metadata") or {}).get("fileSize")
                    or (job.get("metadata") or {}).get("outputFileSize"),
                    resolution=(job.get("metadata") or {}).get("resolution"),
                    fps=(job.get("metadata") or {}).get("fps"),
                    translationModel=(job.get("metadata") or {}).get("translationModel"),
                    ttsModel=(job.get("metadata") or {}).get("ttsModel"),
                    processingTime=job.get("processingTime"),
                    videoUrl=secure_video_url(job_id),
                    downloadUrl=secure_download_url(job_id),
                    storage_provider=storage_meta.get("storage_provider", "local"),
                    storage_key=storage_meta.get("storage_key") or filename,
                )
            except ValueError:
                pass
            job["videoUrl"] = secure_video_url(job_id)
            job["downloadUrl"] = secure_download_url(job_id)
            job["storage_provider"] = storage_meta.get("storage_provider", "local")
            job["storage_key"] = storage_meta.get("storage_key") or filename

        # Prefer real timed segments from the pipeline result
        segments = (result or {}).get("segments") or []
        if segments:
            job["transcript"] = _map_segments_to_transcript(segments)
        else:
            original = (result or {}).get("original_text") or ""
            translated = (result or {}).get("translated_text") or ""
            if original or translated:
                job["transcript"] = [
                    {
                        "id": "t1",
                        "start": 0,
                        "end": 0,
                        "text": original,
                        "translatedText": translated,
                        "speaker": "Voice",
                    }
                ]
        job["timeline"] = list(job.get("transcript") or [])

        if (result or {}).get("language"):
            job["sourceLanguage"] = result["language"]

        voice_used = (result or {}).get("voice") or job.get("voice") or "george"
        job["voice"] = voice_used
        meta = job.setdefault("metadata", {})
        meta["voice"] = voice_used
        meta["translationModel"] = meta.get("translationModel") or TRANSLATION_MODEL
        meta["ttsModel"] = meta.get("ttsModel") or ELEVENLABS_MODEL

        # Output file size (may already be set before storage upload)
        meta = job.setdefault("metadata", {})
        if output_video and os.path.exists(output_video) and not meta.get("outputFileSizeBytes"):
            size_bytes = os.path.getsize(output_video)
            meta["outputFileName"] = filename
            meta["outputFileSizeBytes"] = size_bytes
            meta["outputFileSize"] = f"{size_bytes / (1024 * 1024):.1f} MB"
            if not meta.get("fileSize") or meta.get("fileSize") in ("", "N/A"):
                meta["fileSize"] = meta["outputFileSize"]

        # Processing wall time from stage timings
        timings = job.get("stage_timings") or {}
        start_iso = timings.get("Upload") or job.get("created_at")
        end_iso = timings.get("Completed") or completed_at
        processing_sec = duration_between(start_iso, end_iso)
        try:
            if processing_sec is not None:
                processing_ms = processing_sec * 1000
                job["processingTimeMs"] = processing_ms
                job["processingTime"] = _format_duration_ms(processing_ms)
                meta["processingTime"] = job["processingTime"]
                meta["processingTimeMs"] = processing_ms
        except Exception:
            processing_sec = None

        _append_log(
            job_id,
            f"Pipeline completed successfully (voice={voice_used}, segments={len(job.get('transcript') or [])})",
            "Completed",
            "info",
        )
        observe_job_finished("completed", processing_sec)
        logger.info(
            "job completed",
            extra={
                "event": "job_completed",
                "job_id": job_id,
                "duration_ms": round((processing_sec or 0) * 1000, 2),
                "stage": "Completed",
            },
        )
        _persist(job_id)
    finally:
        reset_job_id(token)


def fail_job(job_id: str, error):
    if job_id not in jobs:
        return

    job = jobs[job_id]
    token = set_job_id(job_id)
    try:
        now_iso = datetime.now().isoformat()
        _close_previous_stage(job, "Failed", now_iso)
        failed_stage = job.get("stage") or "Failed"
        job["status"] = "Failed"
        job["stage"] = "Failed"
        job["message"] = str(error)
        job["updated_at"] = now_iso
        timings = job.setdefault("stage_timings", {})
        timings["Failed"] = now_iso
        history = job.setdefault("stage_history", [])
        if not history or history[-1] != "Failed":
            history.append("Failed")
        _append_log(job_id, str(error), failed_stage, "error")
        dur = duration_between(job.get("created_at"), now_iso)
        observe_error("job_failed")
        observe_job_finished("failed", dur)
        logger.error(
            "job failed",
            extra={
                "event": "job_failed",
                "job_id": job_id,
                "stage": failed_stage,
                "error_type": "job_failed",
                "duration_ms": round((dur or 0) * 1000, 2),
            },
        )
        _persist(job_id)
    finally:
        reset_job_id(token)


def get_job(job_id: str, refresh: bool = False):
    if not refresh:
        job = jobs.get(job_id)
        if job:
            return job
    try:
        from services.project_repository import get_project

        stored = get_project(job_id)
        if stored:
            jobs[job_id] = stored
            return stored
    except Exception:
        pass
    return jobs.get(job_id)


def delete_job(job_id: str, owner_id: str | None = None) -> bool:
    """Remove from memory and database."""
    job = jobs.get(job_id) or get_job(job_id)
    if job and owner_id is not None:
        job_owner = job.get("owner_id") or (job.get("metadata") or {}).get("owner_id")
        if job_owner and job_owner != owner_id:
            raise PermissionError("Forbidden")
    jobs.pop(job_id, None)
    try:
        from services.project_repository import delete_project

        return delete_project(job_id, owner_id=owner_id)
    except PermissionError:
        raise
    except Exception:
        return False
