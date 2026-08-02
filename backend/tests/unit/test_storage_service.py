"""Unit tests for local storage backend."""

import os
from pathlib import Path

from services.storage_service import LocalStorageBackend, build_storage_key, persist_rendered_video


def test_local_upload_exists_delete(tmp_path, monkeypatch):
    root = tmp_path / "outputs"
    root.mkdir()
    backend = LocalStorageBackend(root=str(root))
    src = tmp_path / "clip.mp4"
    src.write_bytes(b"abc123")
    key = backend.upload_file(str(src), "proj.mp4")
    assert key == "proj.mp4"
    assert backend.exists(key)
    assert backend.resolve_local_path(key)
    assert backend.get_signed_url(key) is None
    backend.delete(key)
    assert not backend.exists(key)


def test_path_traversal_rejected(tmp_path):
    backend = LocalStorageBackend(root=str(tmp_path))
    assert backend._safe_path("../etc/passwd") is None
    assert backend._safe_path("..\\win.ini") is None


def test_build_storage_key_local(monkeypatch):
    monkeypatch.setenv("STORAGE_PROVIDER", "local")
    # build_storage_key reads STORAGE_PROVIDER at call time from config module
    import config
    monkeypatch.setattr(config, "STORAGE_PROVIDER", "local")
    import services.storage_service as ss
    monkeypatch.setattr(ss, "STORAGE_PROVIDER", "local")
    assert build_storage_key("jid", "a.mp4", "owner") == "a.mp4"


def test_persist_rendered_local(tmp_path, monkeypatch):
    out = tmp_path / "outputs"
    out.mkdir()
    monkeypatch.setenv("OUTPUT_DIR", str(out))
    import config
    monkeypatch.setattr(config, "OUTPUT_DIR", str(out))
    monkeypatch.setattr(config, "STORAGE_PROVIDER", "local")
    import services.storage_service as ss
    monkeypatch.setattr(ss, "OUTPUT_DIR", str(out))
    monkeypatch.setattr(ss, "STORAGE_PROVIDER", "local")
    ss._storage = None
    src = out / "vid.mp4"
    src.write_bytes(b"data")
    meta = persist_rendered_video(
        local_path=str(src),
        project_id="p1",
        filename="vid.mp4",
        owner_id="u1",
    )
    assert meta["storage_provider"] == "local"
    assert meta["deleted_local"] is False
