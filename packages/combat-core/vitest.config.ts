import { defineConfig } from 'vitest/config';
import { vitestPreset } from '@aether-break/config/vitest.preset.js';

export default defineConfig({
  test: {
    ...vitestPreset,
    name: 'combat-core',
  },
});
