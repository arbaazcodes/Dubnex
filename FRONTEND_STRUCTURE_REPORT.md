# Frontend Structure Report

## Old structure
- src/App.tsx
- src/components/*
- src/data.ts
- src/types.ts
- src/lib/firebase.ts
- src/services/api.ts
- src/services/videoApi.ts
- src/main.tsx

## New structure
src/
+-- assets/
+-- components/
¦   +-- common/
¦   +-- dashboard/
¦   +-- upload/
¦   +-- player/
¦   +-- settings/
¦   +-- chat/
¦   +-- layout/
+-- hooks/
+-- pages/
+-- services/
+-- context/
+-- lib/
+-- utils/
+-- types/
+-- constants/
+-- App.tsx
+-- main.tsx

## Files moved
- src/types.ts -> src/types/index.ts
- src/data.ts -> src/constants/data.ts
- src/components/AdminPanel.tsx -> src/components/layout/AdminPanel.tsx
- src/components/CustomVideoPlayer.tsx -> src/components/player/CustomVideoPlayer.tsx
- src/components/HistoryTable.tsx -> src/components/dashboard/HistoryTable.tsx
- src/components/MetricCards.tsx -> src/components/dashboard/MetricCards.tsx
- src/components/PipelineWorkflow.tsx -> src/components/dashboard/PipelineWorkflow.tsx
- src/components/SettingsHub.tsx -> src/components/settings/SettingsHub.tsx
- src/components/TranscriptEditor.tsx -> src/components/chat/TranscriptEditor.tsx
- src/components/VoiceSettingsStudio.tsx -> src/components/settings/VoiceSettingsStudio.tsx

## Files deleted
- src/services/videoApi.ts

## Imports updated
- App.tsx now imports constants from src/constants/data.ts
- Component imports were updated to use the new relative paths under src/components/* and src/types

## Duplicate files removed
- Removed the duplicate API helper file src/services/videoApi.ts because it was not referenced by the frontend after the reorganization.

## Oversized files split
- App.tsx remained intact because the requested refactor only covered file organization. No business logic or UI behavior was changed.

## Remaining technical debt
- The app bundle remains large; Vite reports chunk-size warnings, but this is not caused by the reorganization.
- The frontend still uses a large single-page component structure in App.tsx; if further scaling is needed, it can be split incrementally without changing behavior.
