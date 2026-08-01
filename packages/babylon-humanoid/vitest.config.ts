import { defineConfig } from 'vitest/config';
import { vitestPreset } from '@aether-break/config/vitest.preset.js';

export default defineConfig({
  test: {
    ...vitestPreset,
    name: 'babylon-humanoid',
    // GLB export/import round-trips are slower than pure logic tests.
    testTimeout: 30000,
  },
});
