/**
 * Purity scan: combat-core source must not reference forbidden APIs (SRS §5.3).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = join(__dirname, '..');

const FORBIDDEN_PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'Math.random', re: /\bMath\.random\b/ },
  { name: 'Date', re: /\bDate\b/ },
  { name: 'performance', re: /\bperformance\b/ },
  { name: 'fetch', re: /\bfetch\b/ },
  { name: 'WebSocket', re: /\bWebSocket\b/ },
  { name: 'window', re: /\bwindow\b/ },
  { name: 'document', re: /\bdocument\b/ },
  { name: 'localStorage', re: /\blocalStorage\b/ },
  { name: 'requestAnimationFrame', re: /\brequestAnimationFrame\b/ },
  { name: 'setTimeout', re: /\bsetTimeout\b/ },
  { name: 'setInterval', re: /\bsetInterval\b/ },
  { name: 'node:fs import', re: /from\s+['"]node:fs['"]/ },
  { name: 'fs import', re: /from\s+['"]fs['"]/ },
  { name: 'node:process import', re: /from\s+['"]node:process['"]/ },
  { name: 'babylon', re: /\bbabylonjs\b/i },
  { name: 'react', re: /from\s+['"]react['"]/ },
];

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === '__tests__') continue; // tests may use node APIs
      out.push(...listTsFiles(p));
    } else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) {
      out.push(p);
    }
  }
  return out;
}

describe('purity scan (SRS §5.3 HARD BOUNDARY)', () => {
  const files = listTsFiles(SRC_ROOT);

  it('finds production source files', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it('contains none of the forbidden identifiers', () => {
    const violations: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      // Strip block and line comments to avoid false positives in docs.
      const stripped = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      for (const { name, re } of FORBIDDEN_PATTERNS) {
        if (re.test(stripped)) {
          violations.push(`${relative(SRC_ROOT, file)}: ${name}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
