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
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
