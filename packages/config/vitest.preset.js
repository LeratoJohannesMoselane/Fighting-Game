/** @type {import('vitest/config').UserConfig['test']} */
export const vitestPreset = {
  globals: false,
  environment: 'node',
  include: ['src/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'],
  coverage: {
    provider: 'v8',
    reporter: ['text', 'html'],
  },
};
