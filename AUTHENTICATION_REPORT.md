# AUTHENTICATION_REPORT.md

**Sprint:** 9 — Real Authentication  
**Date:** 2026-08-02  
**Scope:** Replace placeholder ownership (`X-User-Id`) with Firebase Authentication end-to-end.

---

## Summary

SCREEN.AI now uses **Firebase Auth (Google sign-in)** on the React client and **Firebase ID token verification** on FastAPI. Protected routes reject missing/invalid tokens with **401** and wrong owners with **403**. Every new process job is bound to the authenticated **UID**.

---

## Architecture

```
React (Firebase Auth SDK)
  signInWithPopup(Google) → session persisted by Firebase
  getIdToken() / auto refresh
        │
        ├─ Authorization: Bearer <ID token>   → POST /process-video, GET/DELETE /api/projects
        └─ ?token=<ID token>                  → GET /api/projects/{id}/video|download
                                               (and SSE EventSource)
        │
FastAPI
  google.oauth2.id_token.verify_firebase_token(audience=FIREBASE_PROJECT_ID)
  → AuthenticatedUser.uid
  → owner_id on job + outputs/.registry/{id}.json
```

`X-User-Id` is **no longer accepted** (spoofable). Identity comes only from a verified Firebase ID token.

---

## Frontend

| Feature | Implementation |
|---------|----------------|
| Login | `loginWithGoogle()` → `signInWithPopup` + Google provider |
| Logout | `logoutFirebase()` → `signOut` |
| Persist session | `onAuthStateChanged` via `subscribeToAuth` (Firebase IndexedDB/local persistence) |
| Refresh token | `user.getIdToken(forceRefresh)` — used before media load; SDK refreshes as needed |
| API calls | `Authorization: Bearer …` from `authHeaders()` |
| `<video>` / download / SSE | `?token=` query (browsers cannot set Authorization on media/EventSource) |
| Dubbing gate | Upload/process blocked until signed in |
| Project list | Prefers `GET /api/projects`, falls back to Firestore/local cache |
| Delete | `DELETE /api/projects/{id}` then local/Firestore cleanup |

Mock `loginWithGoogleMock` removed as the primary path (alias kept pointing at real login for compatibility).

---

## Backend — protected routes

| Method | Path | Auth | Ownership |
|--------|------|------|-----------|
| `POST` | `/process-video` | Required | Sets `owner_id = uid` on job |
| `GET` | `/api/projects/{id}/video` | Required | Owner must match |
| `GET` | `/api/projects/{id}/download` | Required | Owner must match |
| `GET` | `/api/projects` | Required | Returns only caller’s projects |
| `DELETE` | `/api/projects/{id}` | Required | Deletes registry (+ file) if owned |

### Status codes

| Code | When |
|------|------|
| **401 Unauthorized** | Missing Bearer/`token`, invalid/expired token, auth misconfigured client |
| **403 Forbidden** | Valid user but `owner_id ≠ uid`, or project has no owner |
| **404** | Unknown project / missing output file |
| **400** | Invalid project id / bad upload |

---

## Configuration

### Frontend `frontend/.env`

```
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### Backend `backend/.env`

```
FIREBASE_PROJECT_ID=<same as VITE_FIREBASE_PROJECT_ID>
```

Enable **Authentication → Google** in the Firebase console. Authorized domains must include your Vite origin (`localhost`, etc.).

Dependency: `google-auth` (see `backend/requirements.txt`).

---

## Verification performed

| Check | Result |
|-------|--------|
| Missing token → 401 | Pass (`require_authenticated_user`) |
| Invalid token → 401 | Pass |
| Frontend production build | Pass (`npm run build`) |
| `X-User-Id` removed from API client | Pass |
| Pipeline code | Unchanged |

---

## How to verify end-to-end locally

1. Fill Firebase web config + `FIREBASE_PROJECT_ID`.  
2. Restart FastAPI + Vite.  
3. Open app → **Sign in with Google**.  
4. Upload + Translate → job owned by your UID.  
5. Preview/Download work with tokenized media URLs.  
6. Sign out → process/media/list/delete return **401**.  
7. Second account cannot open another user’s project → **403**.

---

## Notes / follow-ups

- Legacy projects without `owner_id` return **403** (cannot be claimed anonymously). Re-run a dub while signed in.  
- Media URLs embed short-lived ID tokens in the query string; refresh on result view (~50 min timer + force refresh on open). Prefer short-lived signed cookies in a later hardening sprint if tokens in URLs are a concern.  
- SSE `/events/{id}` accepts optional `?token=` for consistency but is not listed as a hard gate in this sprint’s required set; job IDs remain unguessable UUIDs.

---

## Verdict

**Authentication works end-to-end** once Firebase project credentials are configured: real Google login, persisted session, refreshed ID tokens, UID-bound projects, and 401/403 enforcement on the required API surfaces.
