# Frontend Dependency Audit Report

**Branch:** `dev`  
**Date:** 2026-08-05  
**Scope:** Required packages + shadcn/ui setup  
**Constraints honored:** No Tailwind reinstall, no UI redesign, no commit, no push

---

## Required packages

| Package | Before | After | Action |
|---------|--------|-------|--------|
| `motion` | Present (`^12.23.24`) | Present | Existing — kept |
| `lucide-react` | Present (`^0.546.0`) | Present | Existing — kept |
| `@tanstack/react-query` | Missing | `^5.101.4` | **Installed** |
| `react-hook-form` | Missing | `^7.84.0` | **Installed** |
| `zod` | Missing | `^4.4.3` | **Installed** |
| `@hookform/resolvers` | Missing | `^5.7.1` | **Installed** |
| `zustand` | Missing | `^5.0.14` | **Installed** |
| `sonner` | Missing | `^2.0.7` | **Installed** |
| `react-dropzone` | Missing | `^20.0.0` | **Installed** |
| `react-hotkeys-hook` | Missing | `^5.3.3` | **Installed** |
| `recharts` | Missing | `^3.10.1` | **Installed** |

### Summary counts

- **Existing (already satisfied):** 2 — `motion`, `lucide-react`
- **Missing → installed:** 9
- **Still missing:** 0

---

## Tailwind

- **Already configured** via `@tailwindcss/vite` + `tailwindcss` v4 + `@import "tailwindcss"` in `src/index.css`
- **Not reinstalled**

---

## shadcn/ui

| Item | Status |
|------|--------|
| Before | Not installed (no `components.json`, no `cn()` util) |
| After | Configured |

### Installed with shadcn init

- `shadcn` `^4.16.1`
- `radix-ui` `^1.6.7`
- `tw-animate-css` `^1.4.0`
- `class-variance-authority`, `clsx`, `tailwind-merge` (utility stack)

### Configuration files / paths

| File | Change |
|------|--------|
| `frontend/components.json` | **Created** (style `radix-nova`, CSS vars, `@/` aliases, lucide icons) |
| `frontend/src/lib/utils.ts` | **Created** — `cn()` helper |
| `frontend/src/components/ui/` | **Created** (empty — ready for `npx shadcn add …`) |
| `frontend/src/hooks/` | **Created** (alias target) |
| `frontend/tsconfig.json` | Added `baseUrl` + `paths["@/*"]` |
| `frontend/vite.config.ts` | Added `resolve.alias['@']` |
| `frontend/src/index.css` | Added shadcn imports + theme tokens; **kept** Plus Jakarta Sans, zinc body styles, scrollbars, animations |

### UI redesign avoided

- Existing body/typography/animation styles preserved
- Nova preset tried to switch `--font-sans` to Geist; that override was **removed**
- `@fontsource-variable/geist` was uninstalled after init
- No existing screens/components were rewritten to use shadcn primitives

---

## Verification

- `vitest run`: **18/18 passed**
- `tsc --noEmit`: **passed**
- Branch remains **`dev`**

---

## Notes

- Packages are installed only; they are **not wired** into App providers/forms yet (no redesign).
- Add UI primitives later with: `npx shadcn@latest add button` (etc.)
