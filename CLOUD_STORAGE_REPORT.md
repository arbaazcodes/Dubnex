# CLOUD_STORAGE_REPORT.md

**Sprint:** 10 — Cloud Storage Migration  
**Date:** 2026-08-02  
**Scope:** Abstract rendered MP4 storage; support local (dev) and S3-compatible cloud with signed URLs. AI pipeline and UI unchanged.

---

## Summary

Rendered videos are persisted through a storage service instead of relying only on files under `outputs/`. Preview and Download still use the authenticated API routes from Sprint 8/9; when cloud storage is enabled those routes **302 redirect** to short-lived signed URLs.

| Mode | Persist | Preview / Download |
|------|---------|-------------------|
| `STORAGE_PROVIDER=local` (default) | Keep MP4 under `OUTPUT_DIR` | Auth → stream via `FileResponse` |
| `STORAGE_PROVIDER=s3` | Upload to bucket; optionally delete local copy | Auth → `302` to presigned GET URL |

---

## Architecture

```
Pipeline (unchanged) → local MP4 in OUTPUT_DIR
        ↓
finish_job → persist_rendered_video()
        ↓
StorageBackend (local | s3)
        ↓
Registry: storage_provider + storage_key
        ↓
GET /api/projects/{id}/video|download
        ↓
resolve_project_media (Firebase auth + ownership)
        ↓
signed URL redirect  OR  local FileResponse
```

### New / updated modules

| File | Role |
|------|------|
| `backend/services/storage_service.py` | `StorageBackend` ABC, `LocalStorageBackend`, `S3StorageBackend`, `persist_rendered_video` |
| `backend/services/job_service.py` | After render: size capture → upload → registry + secure URLs |
| `backend/services/secure_media_service.py` | Resolves `signed_url` and/or local `path` |
| `backend/services/output_registry.py` | Stores `storage_key`; delete uses storage backend |
| `backend/app.py` | Video/download: redirect when signed URL present |
| `backend/config.py` | Storage env vars |

Pipeline (`pipeline_service` / Whisper / NLLB / TTS / FFmpeg) was **not** modified.

---

## Configuration

Documented in `backend/.env.example`:

```env
STORAGE_PROVIDER=local          # local | s3
S3_BUCKET=
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_ENDPOINT_URL=                # optional MinIO / R2 / custom
S3_PREFIX=screen-ai
S3_SIGNED_URL_EXPIRY=3600
STORAGE_DELETE_LOCAL_AFTER_UPLOAD=true
```

Dependency: `boto3` added to `backend/requirements.txt` (required only when using S3).

### Object keys

- **Local:** flat basename (e.g. `{uuid}.mp4`) under `OUTPUT_DIR` — matches pipeline output naming.
- **S3:** `{prefix}/projects/{owner_id}/{project_id}/{filename}`

---

## Preview & Download (unchanged client contract)

Frontend still calls:

- `GET /api/projects/{id}/video?token=…` (inline)
- `GET /api/projects/{id}/download?token=…` (attachment)

Flow:

1. Firebase ID token verified; ownership checked.
2. Registry/job supplies `storage_key`.
3. **S3:** generate presigned URL with `Content-Disposition` (inline vs attachment) → **302**.
4. **Local:** stream file with `FileResponse` (Range-capable for `<video>`).

Browsers follow redirects for `<video src>` and `fetch` download blobs. No UI redesign.

---

## Cleanup

When `STORAGE_PROVIDER=s3` and `STORAGE_DELETE_LOCAL_AFTER_UPLOAD=true` (default), the local rendered MP4 is removed after a successful upload. File size metadata is captured **before** delete. On upload failure, the job falls back to local file + warning log.

Project delete removes the object via the storage backend (and any leftover local basename).

---

## Verification

| Check | Result |
|-------|--------|
| Local persist + exists + no signed URL | Pass (`LOCAL_STORAGE_OK`) |
| Local registry register/delete via storage | Pass |
| App import; `/api/projects/{id}/video` + `/download` present | Pass |
| Default provider | `local` (dev-safe) |
| Pipeline / UI | Unchanged |

**S3 live upload** requires real bucket credentials; enable with `STORAGE_PROVIDER=s3` and `S3_BUCKET=…`. Use `S3_ENDPOINT_URL` for MinIO/R2. Ensure the bucket CORS policy allows GET from the frontend origin if downloads use `fetch` after redirect.

---

## How to switch to cloud

1. `pip install boto3` (or reinstall from `requirements.txt`).
2. Set `STORAGE_PROVIDER=s3` and bucket/credentials in `.env`.
3. Restart the API.
4. Complete a dubbing job → logs should show `Stored output via s3 (... deleted_local=True)`.
5. Preview/Download: auth still hits the API; media bytes come from the signed URL.

To stay on disk for development, leave `STORAGE_PROVIDER=local` (default).

---

## Out of scope / follow-ups

- Migrating historical local MP4s into the bucket
- Multi-region CDN in front of the bucket
- Direct browser upload of source video (still goes through the API)
