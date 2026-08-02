# SECURE_OUTPUT_REPORT.md

**Sprint:** 8 — Secure Output Files  
**Date:** 2026-08-02  
**Scope:** Replace public `/outputs/...` access with authenticated-ready streaming endpoints. AI pipeline unchanged.

---

## Summary

Public static mounting of `backend/outputs` has been removed. Preview and Download now go through:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/projects/{project_id}/video` | Inline stream for HTML5 `<video>` (Range-capable `FileResponse`) |
| `GET /api/projects/{project_id}/download` | Attachment download |

Job completion registers the output file under `outputs/.registry/{project_id}.json` and sets `videoUrl` / `downloadUrl` to the secure API (never `/outputs/{file}`).

---

## Frontend changes (`/outputs` removed)

| Location | Before | After |
|----------|--------|-------|
| SSE project mapping (`App.tsx`) | Stored `http://…/outputs/{uuid}.mp4` | `getProjectVideoUrl` / `getProjectDownloadUrl` |
| Result player + download (`App.tsx`) | Direct `project.videoUrl` | `resolveProjectMediaUrl(...)` |
| Dashboard Preview/Download | Required `videoUrl` string | Completed status → secure API by project id |
| `ProjectDetails` | Linked raw URL | Shows `/api/projects/{id}/video` |
| `CustomVideoPlayer` | `project.videoUrl` | Secure resolve helpers |
| localStorage hydrate | Kept legacy `/outputs/` | Rewrites Completed jobs to secure URLs |
| `api.ts` | — | Added `getProjectVideoUrl`, `getProjectDownloadUrl`, `resolveProjectMediaUrl`; `X-User-Id` on upload |

No remaining frontend dependency on `http://127.0.0.1:8000/outputs/...` for runtime media.

---

## Backend security controls

1. **Project exists** — in-memory job **and/or** disk registry entry required → else `404`.
2. **File exists** — resolved under `OUTPUT_DIR` via `realpath`; missing file → `404`.
3. **Path traversal** — basename-only filenames; reject `..` segments; allowlist `*.mp4|webm|mov`; `realpath` must stay under `OUTPUT_DIR`.
4. **Ownership hook (auth prepared)**  
   - Optional `owner_id` stored on job + registry when `X-User-Id` is sent at upload.  
   - If `owner_id` set: require matching `X-User-Id` header or `user_id` query (for `<video src>`).  
   - Mismatch → `403`; missing caller → `401`.  
   - If no owner (current default while auth incomplete) → allow.
5. **No public filesystem mount** — `StaticFiles("/outputs")` removed.
6. **Caching** — `Cache-Control: private, no-store` on media responses.

---

## Verification

| Check | Result |
|-------|--------|
| Routes registered | `/api/projects/{project_id}/video`, `/download` only (no `/outputs` mount) |
| Traversal rejected | `../`, `..\`, escaped paths → `None` / `404` |
| Ownership | Owner `user-a` + caller `user-b` → `403` |
| Frontend build | `npm run build` OK |
| Pipeline | Untouched (`pipeline_service` unchanged) |

**Note:** Projects completed *before* this sprint need a matching registry entry (created on `finish_job`) **or** a re-run to preview after server restart. In-memory jobs alone are not enough after restart; registry files provide the durable map.

---

## How Preview / Download work now

1. Job finishes → `register_project_output(job_id, filename)` + secure URLs in SSE payload.  
2. UI sets `<video src="{API}/api/projects/{id}/video">`.  
3. Download fetches `{API}/api/projects/{id}/download` (blob → save).  
4. Optional future auth: send `X-User-Id` on upload + `user_id` query on media URLs (already wired when user is logged in).

---

## Follow-ups (out of scope)

- Full JWT/session auth replacing `X-User-Id`
- Signed short-lived media tokens (so `<video>` does not need query user ids)
- Backfill script for historical MP4s without registry
- Keep `outputs/.registry/` out of git (added to `backend/.gitignore`)

---

## Verdict

**Secure streaming works.** Public directory listing/direct file URLs via `/outputs` are gone; Preview and Download use project-scoped API endpoints with path-safe resolution and an ownership hook ready for production auth.
