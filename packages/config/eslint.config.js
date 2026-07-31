import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

/** Shared ESLint 9 flat config for Aether Break packages. */
export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', 'legacy/**'],
  },
  {
    files: ['**/*.{ts,tsx,js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      'no-console': 'off',
    },
  },
);

/**
 * Combat-core hard boundary: ban non-deterministic and browser/network APIs.
 * Applied by packages/combat-core/eslint.config.js on non-test sources.
 */
export const combatCoreBoundary = {
  files: ['src/**/*.ts'],
  ignores: ['src/**/*.test.ts', 'src/**/__tests__/**'],
  languageOptions: {
    globals: {
      // Explicitly mark forbidden globals so no-restricted-globals can catch them.
      Date: 'readonly',
      performance: 'readonly',
      fetch: 'readonly',
      WebSocket: 'readonly',
      window: 'readonly',
      document: 'readonly',
      localStorage: 'readonly',
      sessionStorage: 'readonly',
      navigator: 'readonly',
      process: 'readonly',
      Buffer: 'readonly',
      setTimeout: 'readonly',
      setInterval: 'readonly',
      clearTimeout: 'readonly',
      clearInterval: 'readonly',
      requestAnimationFrame: 'readonly',
      cancelAnimationFrame: 'readonly',
    },
  },
  rules: {
    'no-restricted-globals': [
      'error',
      {
        name: 'Date',
        message: 'CombatCore must not use wall-clock time (SRS §5.3 / FR-010).',
      },
      {
        name: 'performance',
        message: 'CombatCore must not use performance clocks (SRS §5.3 / FR-010).',
      },
      {
        name: 'fetch',
        message: 'CombatCore must not perform network I/O (SRS §5.3 / FR-010).',
      },
      {
        name: 'WebSocket',
        message: 'CombatCore must not perform network I/O (SRS §5.3 / FR-010).',
      },
      {
        name: 'window',
        message: 'CombatCore must not touch browser globals (SRS §5.3 / FR-010).',
      },
      {
        name: 'document',
        message: 'CombatCore must not touch browser globals (SRS §5.3 / FR-010).',
      },
      {
        name: 'process',
        message: 'CombatCore must not use Node process (SRS §5.3 / FR-010).',
      },
      {
        name: 'Buffer',
        message: 'CombatCore must not use Node Buffer (SRS §5.3 / FR-010).',
      },
      {
        name: 'setTimeout',
        message: 'CombatCore must not schedule async work (SRS §5.3 / FR-010).',
      },
      {
        name: 'setInterval',
        message: 'CombatCore must not schedule async work (SRS §5.3 / FR-010).',
      },
      {
        name: 'requestAnimationFrame',
        message: 'CombatCore must not use rAF (SRS §5.3 / FR-010).',
      },
    ],
    'no-restricted-properties': [
      'error',
      {
        object: 'Math',
        property: 'random',
        message: 'Use the seeded Park–Miller LCG instead of Math.random (ADR-0002).',
      },
    ],
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['babylonjs', 'babylonjs-*', '@babylonjs/*'],
            message: 'CombatCore must not import Babylon (SRS §5.3 HARD BOUNDARY).',
          },
          {
            group: ['react', 'react-dom', 'react/*'],
            message: 'CombatCore must not import React (SRS §5.3 HARD BOUNDARY).',
          },
          {
            group: ['fs', 'node:fs', 'path', 'node:path', 'process', 'node:process'],
            message: 'CombatCore must not import Node I/O (except in *.test.ts).',
          },
        ],
      },
    ],
  },
};
