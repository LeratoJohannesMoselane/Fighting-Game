import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { vitestPreset } from '@aether-break/config/vitest.preset.js';

export default defineConfig({
  resolve: {
    alias: {
      '@aether-break/combat-core': resolve(__dirname, '../../packages/combat-core/src/index.ts'),
    },
  },
  test: {
    ...vitestPreset,
    name: 'web',
  },
});
