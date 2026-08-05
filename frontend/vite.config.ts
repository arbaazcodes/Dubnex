import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REQUIRED_FIREBASE_ENV = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

// Cloudflare Pages must publish this `dist` folder (not the `frontend/` source tree).
// VITE_* values are inlined at `vite build` time — dashboard vars must exist during the build.
export default defineConfig(({ mode }) => {
  // Merge .env* files + process.env (Cloudflare Pages injects process.env during build).
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };

  const firebaseEnvStatus = Object.fromEntries(
    [
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_AUTH_DOMAIN',
      'VITE_FIREBASE_PROJECT_ID',
      'VITE_FIREBASE_STORAGE_BUCKET',
      'VITE_FIREBASE_MESSAGING_SENDER_ID',
      'VITE_FIREBASE_APP_ID',
      'VITE_API_BASE_URL',
    ].map((key) => [key, env[key] ? `set(len=${String(env[key]).length})` : 'MISSING'])
  );
  console.log('[vite] VITE_* at build time:', firebaseEnvStatus);

  // Cloudflare Pages sets CF_PAGES=1. Fail the build if Firebase would bake as undefined.
  if (process.env.CF_PAGES === '1') {
    const missing = REQUIRED_FIREBASE_ENV.filter((key) => !env[key]);
    if (missing.length > 0) {
      throw new Error(
        `[vite] Cloudflare Pages build missing Firebase env (must be available at BUILD time, not runtime): ${missing.join(', ')}`
      );
    }
  }

  return {
    base: '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
      rollupOptions: {
        onwarn(warning, defaultHandler) {
          if (
            warning.code === 'MODULE_LEVEL_DIRECTIVE' &&
            warning.message.includes('use client')
          ) {
            return;
          }
          defaultHandler(warning);
        },
      },
    },
  };
});
