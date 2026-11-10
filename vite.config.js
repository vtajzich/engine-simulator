import { defineConfig } from 'vite';

// Relative base so dist/ works from any folder (the project path contains '&').
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
});
