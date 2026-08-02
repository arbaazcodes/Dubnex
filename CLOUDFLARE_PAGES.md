# Cloudflare Pages deployment

## Root cause of blank screen / MIME error

This error:

```text
Failed to load module script: Expected a JavaScript module script but the server
responded with a MIME type of "text/html"
```

means the browser requested a `.js` module and received **HTML** (usually `index.html` from SPA fallback).

That happens when Cloudflare publishes the **`frontend/` source tree** (or any folder that is not the Vite build output) instead of **`frontend/dist`**.

- Dev `frontend/index.html` references `/src/main.tsx` (Vite-only; not a production bundle).
- Production `frontend/dist/index.html` references `/assets/index-*.js`.
- If `/assets/...` is missing, Pages SPA fallback returns `index.html` with `Content-Type: text/html`.

## Correct dashboard settings

### Option A — frontend as Root Directory (recommended)

| Setting | Value |
|--------|--------|
| Root directory | `frontend` |
| Build command | `npm ci && npm run build` |
| Build output directory | `dist` |

### Option B — repo root

| Setting | Value |
|--------|--------|
| Root directory | `/` (empty) |
| Build command | `npm run build` |
| Build output directory | `frontend/dist` |

Uses the root `package.json` build script.

## Do not

- Set output directory to `frontend` or `/`
- Deploy without running `vite build`
- Point output at a path that still contains source `index.html` with `/src/main.tsx`

## Verify after deploy

Open DevTools → Network:

1. `index.html` → 200
2. `/assets/index-*.js` → 200 and **`Content-Type: application/javascript`** (or `text/javascript`)
3. Body of that response must start with JS (`var` / `import`), not `<!DOCTYPE html>`
