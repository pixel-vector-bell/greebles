import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' = every asset path is relative, so the build works from ANY folder.
// It ships inside the playzodark.io game center at /games/greebles/.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true, assetsDir: 'assets' },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
