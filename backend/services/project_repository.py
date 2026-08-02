"""
Project / job persistence repository.

Keeps storage provider abstraction untouched — only metadata + output URLs/keys.
"""

from __future__ import annotations

import json
import os
from typing import Any

from sqlalchemy import select

from services.db import init_db, is_durable, session_scope
from services.project_models import ProjectRow

_initialized = False


def _ensure_init() -> None:
    global _initialized
    if not _initialized:
        init_db()
        _initialized = True
        if is_durable():
            try:
                migrate_registry_into_db()
            except Exception:
                pass


def _dumps(value: Any) -> str | None:
    if value is None:
        return None
    try:
        return json.dumps(value, ensure_ascii=False)
    except (TypeError, ValueError):
        return None


def _loads(raw: str | None, default: Any = None) -> Any:
    if not raw:
        return default
    try:
        return json.loads(raw)
    except (TypeError, ValueError, json.JSONDecodeError):
        return default


def job_to_row_fields(job: dict[str, Any]) -> dict[str, Any]:
    meta = job.get("metadata") or {}
    transcript = job.get("transcript") or []
    # Timeline uses the same timed segments as transcript (Project Details timeline tab)
    timeline = job.get("timeline")
    if timeline is None:
        timeline = transcript

    return {
        "id": job["id"],
        "owner_id": job.get("owner_id") or meta.get("owner_id"),
        "title": job.get("title"),
        "status": job.get("status"),
        "stage": job.get("stage"),
        "progress": job.get("progress"),
        "message": job.get("message"),
        "source_language": job.get("sourceLanguage"),
        "target_language": job.get("targetLanguage"),
        "voice": job.get("voice"),
        "video_url": job.get("videoUrl"),
        "download_url": job.get("downloadUrl"),
        "output_filename": job.get("output_filename"),
        "storage_provider": job.get("storage_provider"),
        "storage_key": job.get("storage_key"),
        "processing_time": job.get("processingTime") or meta.get("processingTime"),
        "processing_time_ms": job.get("processingTimeMs") or meta.get("processingTimeMs"),
        "translation_model": meta.get("translationModel"),
        "tts_model": meta.get("ttsModel"),
        "duration": meta.get("duration"),
        "size": meta.get("fileSize") or meta.get("outputFileSize"),
        "resolution": meta.get("resolution"),
        "fps": meta.get("fps"),
        "transcript_json": _dumps(transcript),
        "timeline_json": _dumps(timeline),
        "logs_json": _dumps(job.get("logs") or []),
        "metadata_json": _dumps(meta),
        "stage_history_json": _dumps(job.get("stage_history") or []),
        "stage_timings_json": _dumps(job.get("stage_timings") or {}),
        "result_json": _dumps(job.get("result")),
        "renders_json": _dumps(job.get("renders") or []),
        "versions_json": _dumps(job.get("versions") or []),
        "created_at": job.get("created_at"),
        "updated_at": job.get("updated_at"),
        "completed_at": job.get("completed_at"),
    }


def row_to_job(row: ProjectRow) -> dict[str, Any]:
    meta = _loads(row.metadata_json, {}) or {}
    if row.translation_model:
        meta.setdefault("translationModel", row.translation_model)
    if row.tts_model:
        meta.setdefault("ttsModel", row.tts_model)
    if row.duration:
        meta.setdefault("duration", row.duration)
    if row.size:
        meta.setdefault("fileSize", row.size)
    if row.resolution:
        meta.setdefault("resolution", row.resolution)
    if row.fps is not None:
        meta.setdefault("fps", row.fps)
    if row.processing_time:
        meta.setdefault("processingTime", row.processing_time)
    if row.processing_time_ms is not None:
        meta.setdefault("processingTimeMs", row.processing_time_ms)
    if row.owner_id:
        meta.setdefault("owner_id", row.owner_id)
    if row.voice:
        meta.setdefault("voice", row.voice)

    transcript = _loads(row.transcript_json, []) or []
    timeline = _loads(row.timeline_json, None)
    if timeline is None:
        timeline = transcript

    return {
        "id": row.id,
        "status": row.status,
        "stage": row.stage,
        "progress": row.progress if row.progress is not None else 0,
        "message": row.message,
        "result": _loads(row.result_json, None),
        "title": row.title or "Untitled Project",
        "sourceLanguage": row.source_language,
        "targetLanguage": row.target_language,
        "voice": row.voice,
        "owner_id": row.owner_id,
        "metadata": meta,
        "videoUrl": row.video_url,
        "downloadUrl": row.download_url,
        "output_filename": row.output_filename,
        "storage_provider": row.storage_provider,
        "storage_key": row.storage_key,
        "transcript": transcript,
        "timeline": timeline,
        "logs": _loads(row.logs_json, []) or [],
        "stage_history": _loads(row.stage_history_json, []) or [],
        "stage_timings": _loads(row.stage_timings_json, {}) or {},
        "renders": _loads(row.renders_json, []) or [],
        "versions": _loads(row.versions_json, []) or [],
        "processingTime": row.processing_time,
        "processingTimeMs": row.processing_time_ms,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "completed_at": row.completed_at,
    }


def row_to_api_project(row: ProjectRow) -> dict[str, Any]:
    """Shape used by GET /api/projects (Dashboard)."""
    job = row_to_job(row)
    return {
        "id": job["id"],
        "title": job["title"],
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
        "videoUrl": job.get("videoUrl"),
        "downloadUrl": job.get("downloadUrl"),
        "progress": job.get("progress", 0),
        "transcript": job.get("transcript") or [],
        "timeline": job.get("timeline") or [],
        "logs": job.get("logs") or [],
        "storage_provider": job.get("storage_provider"),
        "storage_key": job.get("storage_key"),
        "output_filename": job.get("output_filename"),
    }


def upsert_project(job: dict[str, Any]) -> None:
    if not job or not job.get("id"):
        return
    _ensure_init()
    fields = job_to_row_fields(job)
    with session_scope() as session:
        row = session.get(ProjectRow, fields["id"])
        if row is None:
            row = ProjectRow(**fields)
            session.add(row)
        else:
            for key, value in fields.items():
                if key == "id":
                    continue
                setattr(row, key, value)


def get_project(project_id: str) -> dict[str, Any] | None:
    if not project_id:
        return None
    _ensure_init()
    with session_scope() as session:
        row = session.get(ProjectRow, project_id)
        if not row:
            return None
        return row_to_job(row)


def list_projects_by_owner(owner_id: str) -> list[dict[str, Any]]:
    if not owner_id:
        return []
    _ensure_init()
    with session_scope() as session:
        rows = session.scalars(
            select(ProjectRow)
            .where(ProjectRow.owner_id == owner_id)
            .order_by(ProjectRow.created_at.desc())
        ).all()
        return [row_to_api_project(r) for r in rows]


def delete_project(project_id: str, owner_id: str | None = None) -> bool:
    if not project_id:
        return False
    _ensure_init()
    with session_scope() as session:
        row = session.get(ProjectRow, project_id)
        if not row:
            return False
        if owner_id is not None and row.owner_id and row.owner_id != owner_id:
            raise PermissionError("Forbidden")
        session.delete(row)
        return True


def migrate_registry_into_db() -> int:
    """One-time-ish import of outputs/.registry/*.json into the projects table."""
    from services.output_registry import REGISTRY_DIR, get_registered_output

    if not os.path.isdir(REGISTRY_DIR):
        return 0

    imported = 0
    try:
        names = os.listdir(REGISTRY_DIR)
    except OSError:
        return 0

    for name in names:
        if not name.endswith(".json"):
            continue
        project_id = name[:-5]
        with session_scope() as session:
            if session.get(ProjectRow, project_id):
                continue
        record = get_registered_output(project_id)
        if not record:
            continue
        job = {
            "id": project_id,
            "owner_id": record.get("owner_id"),
            "title": record.get("title") or "Untitled Project",
            "status": record.get("status") or "Completed",
            "stage": record.get("status") or "Completed",
            "progress": 100 if record.get("filename") else 0,
            "message": record.get("status") or "Completed",
            "sourceLanguage": record.get("originalLanguage"),
            "targetLanguage": record.get("targetLanguage"),
            "voice": record.get("voice"),
            "videoUrl": record.get("videoUrl"),
            "downloadUrl": record.get("downloadUrl"),
            "output_filename": record.get("filename"),
            "storage_provider": record.get("storage_provider") or "local",
            "storage_key": record.get("storage_key") or record.get("filename"),
            "processingTime": record.get("processingTime"),
            "transcript": [],
            "timeline": [],
            "logs": [],
            "metadata": {
                "duration": record.get("duration"),
                "fileSize": record.get("size"),
                "resolution": record.get("resolution"),
                "fps": record.get("fps"),
                "translationModel": record.get("translationModel"),
                "ttsModel": record.get("ttsModel"),
                "owner_id": record.get("owner_id"),
                "voice": record.get("voice"),
            },
            "stage_history": ["Completed"] if record.get("filename") else [],
            "stage_timings": {},
            "created_at": record.get("created_at"),
            "updated_at": record.get("completed_at") or record.get("created_at"),
            "completed_at": record.get("completed_at"),
        }
        upsert_project(job)
        imported += 1
    return imported
