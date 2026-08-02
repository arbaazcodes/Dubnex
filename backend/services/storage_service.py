"""
Abstract object storage for rendered project videos.

Providers:
  - local  — keep files under OUTPUT_DIR (development default)
  - s3     — upload to S3-compatible bucket; serve via signed URLs

The AI pipeline still writes locally; this layer persists the final MP4
and cleans up the local copy when using cloud storage.
"""

from __future__ import annotations

import os
import shutil
from abc import ABC, abstractmethod
from typing import Literal
from urllib.parse import quote

from config import (
    OUTPUT_DIR,
    PUBLIC_BASE_URL,
    STORAGE_PROVIDER,
    STORAGE_DELETE_LOCAL_AFTER_UPLOAD,
    S3_BUCKET,
    S3_REGION,
    S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY,
    S3_ENDPOINT_URL,
    S3_PREFIX,
    S3_SIGNED_URL_EXPIRY,
)

Disposition = Literal["inline", "attachment"]


class StorageBackend(ABC):
    name: str

    @abstractmethod
    def upload_file(
        self,
        local_path: str,
        storage_key: str,
        content_type: str = "video/mp4",
    ) -> str:
        """Persist local_path at storage_key. Returns the storage key."""

    @abstractmethod
    def delete(self, storage_key: str) -> None:
        """Delete object if it exists (no-op if missing)."""

    @abstractmethod
    def exists(self, storage_key: str) -> bool:
        ...

    @abstractmethod
    def get_signed_url(
        self,
        storage_key: str,
        *,
        disposition: Disposition = "inline",
        filename: str | None = None,
        expires_in: int | None = None,
    ) -> str | None:
        """
        Return a time-limited URL for preview/download.
        Local backend returns None (caller streams via FileResponse).
        """

    @abstractmethod
    def resolve_local_path(self, storage_key: str) -> str | None:
        """If object is available on local disk, return absolute path."""


class LocalStorageBackend(StorageBackend):
    name = "local"

    def __init__(self, root: str | None = None):
        self.root = os.path.realpath(root or OUTPUT_DIR)
        os.makedirs(self.root, exist_ok=True)

    def _safe_path(self, storage_key: str) -> str | None:
        key = storage_key.replace("\\", "/").lstrip("/")
        if not key or ".." in key.split("/"):
            return None
        full = os.path.realpath(os.path.join(self.root, key))
        if full != self.root and not full.startswith(self.root + os.sep):
            return None
        return full

    def upload_file(self, local_path: str, storage_key: str, content_type: str = "video/mp4") -> str:
        dest = self._safe_path(storage_key)
        if not dest:
            raise ValueError("Invalid storage key")
        os.makedirs(os.path.dirname(dest) or self.root, exist_ok=True)
        src = os.path.realpath(local_path)
        if src != dest:
            shutil.copy2(local_path, dest)
        return storage_key.replace("\\", "/").lstrip("/")

    def delete(self, storage_key: str) -> None:
        path = self._safe_path(storage_key)
        if path and os.path.isfile(path):
            try:
                os.remove(path)
            except OSError:
                pass

    def exists(self, storage_key: str) -> bool:
        path = self._safe_path(storage_key)
        return bool(path and os.path.isfile(path))

    def get_signed_url(
        self,
        storage_key: str,
        *,
        disposition: Disposition = "inline",
        filename: str | None = None,
        expires_in: int | None = None,
    ) -> str | None:
        # Local mode: no cloud signed URL — API streams the file after auth.
        return None

    def resolve_local_path(self, storage_key: str) -> str | None:
        path = self._safe_path(storage_key)
        if path and os.path.isfile(path):
            return path
        return None


class S3StorageBackend(StorageBackend):
    name = "s3"

    def __init__(self):
        if not S3_BUCKET:
            raise RuntimeError("S3_BUCKET is required when STORAGE_PROVIDER=s3")
        try:
            import boto3
            from botocore.client import Config
        except ImportError as exc:
            raise RuntimeError(
                "boto3 is required for S3 storage. pip install boto3"
            ) from exc

        session_kwargs = {}
        if S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY:
            session_kwargs["aws_access_key_id"] = S3_ACCESS_KEY_ID
            session_kwargs["aws_secret_access_key"] = S3_SECRET_ACCESS_KEY

        self.bucket = S3_BUCKET
        self.prefix = S3_PREFIX
        self.expiry = S3_SIGNED_URL_EXPIRY
        client_kwargs = {
            "service_name": "s3",
            "region_name": S3_REGION,
            "config": Config(signature_version="s3v4"),
        }
        if S3_ENDPOINT_URL:
            client_kwargs["endpoint_url"] = S3_ENDPOINT_URL

        session = boto3.session.Session(**session_kwargs)
        self.client = session.client(**client_kwargs)

    def _object_key(self, storage_key: str) -> str:
        key = storage_key.replace("\\", "/").lstrip("/")
        if not key or ".." in key.split("/"):
            raise ValueError("Invalid storage key")
        if self.prefix and not key.startswith(self.prefix + "/"):
            key = f"{self.prefix}/{key}"
        return key

    def upload_file(self, local_path: str, storage_key: str, content_type: str = "video/mp4") -> str:
        key = self._object_key(storage_key)
        extra = {"ContentType": content_type}
        self.client.upload_file(local_path, self.bucket, key, ExtraArgs=extra)
        return key

    def delete(self, storage_key: str) -> None:
        try:
            key = self._object_key(storage_key)
        except ValueError:
            return
        try:
            self.client.delete_object(Bucket=self.bucket, Key=key)
        except Exception:
            pass

    def exists(self, storage_key: str) -> bool:
        try:
            key = self._object_key(storage_key)
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except Exception:
            return False

    def get_signed_url(
        self,
        storage_key: str,
        *,
        disposition: Disposition = "inline",
        filename: str | None = None,
        expires_in: int | None = None,
    ) -> str | None:
        key = self._object_key(storage_key)
        params: dict = {"Bucket": self.bucket, "Key": key}
        download_name = filename or os.path.basename(key)
        # Content-Disposition for preview vs download
        safe_name = quote(download_name)
        if disposition == "attachment":
            params["ResponseContentDisposition"] = f'attachment; filename="{safe_name}"'
        else:
            params["ResponseContentDisposition"] = f'inline; filename="{safe_name}"'
        params["ResponseContentType"] = "video/mp4"
        return self.client.generate_presigned_url(
            "get_object",
            Params=params,
            ExpiresIn=expires_in or self.expiry,
        )

    def resolve_local_path(self, storage_key: str) -> str | None:
        return None


_storage: StorageBackend | None = None


def get_storage() -> StorageBackend:
    global _storage
    if _storage is not None:
        return _storage
    provider = STORAGE_PROVIDER
    if provider == "s3":
        _storage = S3StorageBackend()
    else:
        _storage = LocalStorageBackend()
    return _storage


def build_storage_key(project_id: str, filename: str, owner_id: str | None = None) -> str:
    """Canonical object key for a rendered project video."""
    safe_name = os.path.basename(filename.replace("\\", "/"))
    if STORAGE_PROVIDER == "local":
        # Keep flat keys under OUTPUT_DIR for local/dev (matches pipeline output name)
        return safe_name
    owner = (owner_id or "anonymous").replace("/", "_")
    return f"projects/{owner}/{project_id}/{safe_name}"


def persist_rendered_video(
    *,
    local_path: str,
    project_id: str,
    filename: str,
    owner_id: str | None = None,
) -> dict:
    """
    Upload rendered MP4 via configured provider.
    Returns { storage_provider, storage_key, filename, deleted_local }.
    Does not modify the AI pipeline — only runs after render completes.
    """
    if not local_path or not os.path.isfile(local_path):
        raise FileNotFoundError(f"Rendered video not found: {local_path}")

    storage = get_storage()
    key = build_storage_key(project_id, filename, owner_id)
    stored_key = storage.upload_file(local_path, key, content_type="video/mp4")

    deleted_local = False
    if (
        storage.name != "local"
        and STORAGE_DELETE_LOCAL_AFTER_UPLOAD
        and os.path.isfile(local_path)
    ):
        try:
            os.remove(local_path)
            deleted_local = True
        except OSError:
            deleted_local = False

    return {
        "storage_provider": storage.name,
        "storage_key": stored_key,
        "filename": os.path.basename(filename),
        "deleted_local": deleted_local,
        "public_base_hint": PUBLIC_BASE_URL,
    }
