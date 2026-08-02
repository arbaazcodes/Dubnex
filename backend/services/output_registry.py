"""
Secure mapping from project/job IDs to output video filenames.
Prevents path traversal and survives process restarts (unlike in-memory jobs alone).
"""

from __future__ import annotations

import json
import os
import re
from typing import Any

from config import OUTPUT_DIR, PUBLIC_BASE_URL

REGISTRY_DIR = os.path.join(OUTPUT_DIR, ".registry")
_PROJECT_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")


def _ensure_registry_dir() -> None:
    os.makedirs(REGISTRY_DIR, exist_ok=True)


def is_valid_project_id(project_id: str) -> bool:
    return bool(project_id and _PROJECT_ID_RE.match(project_id))


def safe_output_basename(filename: str) -> str | None:
    """Return a basename confined to OUTPUT_DIR, or None if unsafe."""
    if not filename or not isinstance(filename, str):
        return None
    raw = filename.replace("\\", "/").strip()
    if not raw or ".." in raw.split("/"):
        return None
    name = os.path.basename(raw)
    if not name or name in (".", "..") or ".." in name:
        return None
    if os.path.sep in name or (os.path.altsep and os.path.altsep in name):
        return None
    # Only allow simple media filenames
    if not re.match(r"^[A-Za-z0-9][A-Za-z0-9._-]*\.(mp4|webm|mov)$", name, re.I):
        return None
    return name


def resolve_output_path(filename: str) -> str | None:
    """Resolve filename under OUTPUT_DIR; reject path traversal."""
    name = safe_output_basename(filename)
    if not name:
        return None
    root = os.path.realpath(OUTPUT_DIR)
    full = os.path.realpath(os.path.join(root, name))
    if full != root and not full.startswith(root + os.sep):
        return None
    if not os.path.isfile(full):
        return None
    return full


def registry_path(project_id: str) -> str:
    return os.path.join(REGISTRY_DIR, f"{project_id}.json")


def register_project_output(
    project_id: str,
    filename: str,
    owner_id: str | None = None,
    title: str | None = None,
    **extra: Any,
) -> dict[str, Any]:
    if not is_valid_project_id(project_id):
        raise ValueError("Invalid project id")
    name = safe_output_basename(filename)
    if not name:
        raise ValueError("Invalid output filename")

    storage_key = extra.get("storage_key")
    # Local file may already be deleted after cloud upload — only verify path when local
    if not storage_key and not resolve_output_path(name):
        root = os.path.realpath(OUTPUT_DIR)
        candidate = os.path.realpath(os.path.join(root, name))
        if candidate != root and not candidate.startswith(root + os.sep):
            raise ValueError("Output path escapes OUTPUT_DIR")

    _ensure_registry_dir()
    existing = get_registered_output(project_id) or {}
    record = {
        **existing,
        "project_id": project_id,
        "filename": name,
        "owner_id": owner_id if owner_id is not None else existing.get("owner_id"),
        "title": title or existing.get("title") or name,
        **extra,
    }
    with open(registry_path(project_id), "w", encoding="utf-8") as f:
        json.dump(record, f)
    return record


def get_registered_output(project_id: str) -> dict[str, Any] | None:
    if not is_valid_project_id(project_id):
        return None
    path = registry_path(project_id)
    if not os.path.isfile(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return None
        return data
    except (OSError, json.JSONDecodeError):
        return None


def list_projects_for_owner(owner_id: str) -> list[dict[str, Any]]:
    if not owner_id:
        return []
    _ensure_registry_dir()
    results: list[dict[str, Any]] = []
    try:
        entries = os.listdir(REGISTRY_DIR)
    except OSError:
        return []
    for name in entries:
        if not name.endswith(".json"):
            continue
        path = os.path.join(REGISTRY_DIR, name)
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, json.JSONDecodeError):
            continue
        if not isinstance(data, dict):
            continue
        if data.get("owner_id") != owner_id:
            continue
        results.append(data)
    results.sort(key=lambda r: r.get("created_at") or r.get("completed_at") or "", reverse=True)
    return results


def delete_project_output(project_id: str, owner_id: str, delete_file: bool = True) -> dict[str, Any]:
    """Delete registry entry (and optionally media in storage) if owned by owner_id."""
    if not is_valid_project_id(project_id):
        raise ValueError("Invalid project id")
    record = get_registered_output(project_id)
    if not record:
        raise FileNotFoundError("Project not found")
    if record.get("owner_id") != owner_id:
        raise PermissionError("Forbidden")

    if delete_file:
        storage_key = record.get("storage_key") or record.get("filename")
        if storage_key:
            try:
                from services.storage_service import get_storage

                get_storage().delete(storage_key)
            except Exception:
                pass
        # Also remove legacy local basename if different
        filename = record.get("filename")
        path = resolve_output_path(filename) if filename else None
        if path and os.path.isfile(path):
            try:
                os.remove(path)
            except OSError:
                pass

    try:
        os.remove(registry_path(project_id))
    except OSError:
        pass
    return record


def secure_video_url(project_id: str) -> str:
    return f"{PUBLIC_BASE_URL}/api/projects/{project_id}/video"


def secure_download_url(project_id: str) -> str:
    return f"{PUBLIC_BASE_URL}/api/projects/{project_id}/download"
