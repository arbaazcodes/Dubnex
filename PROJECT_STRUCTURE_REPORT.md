# Project Structure Report

## Old folder structure
- root: SCREEN.AI
- frontend assets and source files at the repository root
- backend files at the repository root and under backend/
- React/Vite config files at the repository root
- Node dependencies installed at the repository root

## New folder structure
SCREEN.AI/
├── frontend/
│   ├── public/
│   ├── src/
│   ├── assets/
│   ├── components/
│   │   ├── common/
│   │   ├── upload/
│   │   ├── dashboard/
│   │   ├── player/
│   │   ├── settings/
│   │   ├── chat/
│   │   └── layout/
│   ├── pages/
│   ├── hooks/
│   ├── context/
│   ├── services/
│   ├── lib/
│   ├── utils/
│   ├── constants/
│   ├── types/
│   ├── App.tsx
│   ├── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── backend/
│   ├── app.py
│   ├── config.py
│   ├── requirements.txt
│   ├── services/
│   ├── jobs/
│   ├── outputs/
│   ├── temp/
│   └── uploads/
├── docs/
├── README.md
├── .gitignore
└── docker-compose.yml

## Files moved
- src/ -> frontend/src/
- index.html -> frontend/index.html
- package.json -> frontend/package.json
- package-lock.json -> frontend/package-lock.json
- tsconfig.json -> frontend/tsconfig.json
- vite.config.ts -> frontend/vite.config.ts

## Files renamed
- No functional renames were required.

## Imports updated
- Frontend imports were preserved and validated after the move.
- TypeScript paths continue to resolve from the frontend folder.

## Duplicate files removed
- Removed the duplicate frontend helper file src/services/videoApi.ts during the earlier frontend organization pass.

## Unused files removed
- No unused backend files were removed because the backend remains in active use.

## Empty folders removed
- Empty frontend folders created during the move were removed after the reorganization.

## Configuration files moved
- Vite configuration moved to frontend/vite.config.ts
- TypeScript configuration moved to frontend/tsconfig.json
- Frontend package manifest moved to frontend/package.json

## Remaining technical debt
- The frontend bundle is still large and Vite reports chunk-size warnings; this is non-blocking and does not affect functionality.
- App.tsx remains a large single-file component, but its behavior and UI were preserved.

## Warnings
- The Vite build still warns about large chunks, which is a performance optimization opportunity rather than a correctness issue.

## Recommendations
- Continue splitting App.tsx into smaller feature modules when time allows.
- Add a dedicated frontend README later if the project grows further.
