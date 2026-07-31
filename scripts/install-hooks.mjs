import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hookPath = join(root, '.git', 'hooks', 'pre-commit');
if (!existsSync(join(root, '.git', 'hooks'))) {
  // Not a git checkout (or bare) — skip silently.
  process.exit(0);
}
mkdirSync(dirname(hookPath), { recursive: true });
const hook = `#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
echo "[pre-commit] typecheck"
pnpm typecheck
echo "[pre-commit] lint"
pnpm lint
echo "[pre-commit] format"
pnpm format:check
echo "[pre-commit] test"
pnpm test
`;
writeFileSync(hookPath, hook, { mode: 0o755 });
chmodSync(hookPath, 0o755);
console.log('Installed pre-commit hook (typecheck + lint + format + test).');
