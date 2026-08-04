import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@aether-break/combat-core': resolve(__dirname, '../../packages/combat-core/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    host: true,
    // Keep browser traffic same-origin in dev; EventSource then works in the
    // hosted preview too rather than trying to reach the browser's localhost.
    proxy: {
      '/api': {
        target: process.env.RELAY_URL ?? 'http://127.0.0.1:3111',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
