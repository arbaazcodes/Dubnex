import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Cloudflare Pages must publish this `dist` folder (not the `frontend/` source tree).
// Absolute asset URLs (`/assets/...`) require base "/" at the site root (*.pages.dev).
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes('use client')) {
          return;
        }
        defaultHandler(warning);
      },
    },
  },
});
