import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`        -> multi-file build for Cloudflare Pages (dist/)
// `npm run build:single` -> one self-contained index.html (dist-single/) for offline/LMS use
export default defineConfig(({ mode }) => ({
  // relative base: the same build works at a domain root (Cloudflare Pages) and under
  // /MachinaForce3D/ (GitHub Pages)
  base: './',
  plugins: [react(), tailwindcss(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 2500,
  },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
}));
