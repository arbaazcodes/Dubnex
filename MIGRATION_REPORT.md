# Frontend-to-FastAPI migration report

## Goal
Migrate the React frontend so that all runtime API traffic uses the FastAPI backend at http://127.0.0.1:8000 while keeping the current UI behavior and layout unchanged.

## Constraints
- Do not delete server.ts.
- Do not make the frontend depend on server.ts at runtime.
- Keep the UI visually unchanged.

## Files to be modified
1. src/App.tsx
2. backend/app.py

## Planned changes
### Frontend
- Replace every frontend request that currently targets the Node server with requests to the FastAPI backend.
- Update chat, analysis, transcription, language detection, pipeline status, and live voice routes to use http://127.0.0.1:8000.
- Keep the existing React component structure and UI text unchanged.

### Backend
- Add FastAPI routes that match the frontend’s expected endpoints:
  - /api/detect-language
  - /api/chat
  - /api/analyze-video
  - /api/transcribe-audio
  - /api/pipeline-sse
  - /live (WebSocket)
- Enable CORS so the Vite frontend can call the FastAPI backend.

## Why this is necessary
The current frontend still uses Node server routes for several features, even though the FastAPI backend already exists and provides the media-processing workflow. This creates a split backend dependency that is not appropriate for a single-backend architecture.
