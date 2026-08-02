"""
Secure project video helpers: Firebase auth + storage-backed signed URLs / local stream.
"""

from __future__ import annotations

import os
from typing import Any, Literal

from fastapi import HTTPException, Request

from services.firebase_auth import AuthenticatedUser, require_authenticated_user
from services.job_service import get_job
from services.output_registry import (
    get_registered_output,
    is_valid_project_id,
    resolve_output_path,
    safe_output_basename,
)
from services.storage_service import get_storage

Disposition = Literal["inline", "attachment"]


def assert_owner(owner_id: str | None, user: AuthenticatedUser) -> None:
    if not owner_id:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: this project has no owner and cannot be accessed.",
        )
    if owner_id != user.uid:
        raise HTTPException(status_code=403, detail="Forbidden: you do not own this project.")


def resolve_project_media(
    project_id: str,
    request: Request,
    *,
    disposition: Disposition = "inline",
) -> dict[str, Any]:
    """
    Auth + ownership, then resolve media for preview/download.

    Returns:
      path         — local filesystem path when streaming locally (optional)
      signed_url   — cloud signed URL when using S3 (optional)
      filename, title, owner_id, storage_provider, storage_key, user
    """
    user = require_authenticated_user(request)

    if not is_valid_project_id(project_id):
        raise HTTPException(status_code=400, detail="Invalid project id.")

    job = get_job(project_id)
    registry = get_registered_output(project_id)

    if not job and not registry:
        raise HTTPException(status_code=404, detail="Project not found.")

    owner_id = None
    filename = None
    title = None
    storage_key = None
    storage_provider = None

    if registry:
        owner_id = registry.get("owner_id") or owner_id
        filename = registry.get("filename")
        title = registry.get("title")
        storage_key = registry.get("storage_key")
        storage_provider = registry.get("storage_provider")

    if job:
        owner_id = job.get("owner_id") or (job.get("metadata") or {}).get("owner_id") or owner_id
        title = job.get("title") or title
        storage_key = job.get("storage_key") or storage_key
        storage_provider = job.get("storage_provider") or storage_provider
        if not filename:
            filename = job.get("output_filename")
        if not filename:
            result = job.get("result") or {}
            output_video = result.get("output_video") or ""
            filename = safe_output_basename(
                output_video.replace("\\", "/").split("/")[-1] if output_video else ""
            )

    assert_owner(owner_id, user)

    if not filename and not storage_key:
        raise HTTPException(status_code=404, detail="Output video not registered for this project.")

    key = storage_key or filename
    storage = get_storage()
    provider = storage_provider or storage.name

    signed_url = None
    local_path = None

    # Prefer configured storage backend for the key
    try:
        if storage.exists(key):
            signed_url = storage.get_signed_url(
                key,
                disposition=disposition,
                filename=filename or os.path.basename(key),
            )
            local_path = storage.resolve_local_path(key)
    except Exception:
        signed_url = None
        local_path = None

    # Legacy local basename fallback
    if not signed_url and not local_path and filename:
        local_path = resolve_output_path(filename)

    if not signed_url and not local_path:
        raise HTTPException(status_code=404, detail="Output video file not found.")

    return {
        "path": local_path,
        "signed_url": signed_url,
        "filename": filename or os.path.basename(key),
        "title": title or filename or os.path.basename(key),
        "owner_id": owner_id,
        "user": user,
        "storage_provider": provider,
        "storage_key": key,
    }


# Back-compat alias used by older imports
def resolve_project_video(project_id: str, request: Request) -> dict[str, Any]:
    return resolve_project_media(project_id, request, disposition="inline")
