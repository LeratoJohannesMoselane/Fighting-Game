# Aether Break

Skill-forward **2.5D browser arena fighter** — Milestone 1 greybox vertical slice foundation.

> Two greybox fighters, one lane, local 1v1 duel, **60 Hz CombatCore**, 60 FPS target later.  
> No online promise until fun is proven. (SRS §9.1)

## Repository layout (SRS §5.3)

```
aether-break/
  apps/
    web/                 # Vite + TS placeholder ("boot OK") — no React/Babylon yet
  packages/
    combat-core/         # pure deterministic 60 Hz simulation (THIS milestone's focus)
    config/              # shared tsconfig, eslint, vitest preset
  docs/
    ADR-0001-legacy-archive.md
    ADR-0002-determinism-contract.md
  scripts/               # git hooks installer
  legacy/                # archived pre-SRS prototype (do not import)
  SRS ether arena.pdf    # authoritative SRS v1.0
```

## Prerequisites

- **Node.js 22+**
- **pnpm 9.15.0** (via Corepack)

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
```

## Setup

```bash
pnpm install
```

## Play the greybox (local 1v1)

```bash
pnpm install
pnpm dev
```

Open the URL Vite prints (usually `http://localhost:5173/`).

| | Player 1 (Nyra Vex) | Player 2 (Bram Kade) |
|--|---------------------|----------------------|
| Move | `A` `D` | `←` `→` |
| Jump / crouch | `W` / `S` | `↑` / `↓` |
| Light / Heavy | `F` / `G` | `J` / `K` |
| Gun / Spell | `H` / `R` | `L` / `U` |
| Guard / Dash | `Shift` / `E` | `/` / `.` |
| Rematch / Pause / Hitboxes | `Enter` / `P` / `B` | same |

Simulation runs at a fixed **60 Hz** via `@aether-break/combat-core`; the canvas is presentation-only.

## Scripts

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start playable greybox (`apps/web`) |
| `pnpm build` | Build all packages/apps |
| `pnpm test` | Run CombatCore Vitest suite |
| `pnpm typecheck` | Strict TypeScript across workspaces |
| `pnpm lint` | ESLint 9 flat config |
| `pnpm format` / `pnpm format:check` | Prettier write / check |
| `pnpm test:determinism` | 10 000-frame dual-run hash identity gate |
| `pnpm replay` | CLI: `pnpm replay -- --seed 42 --frames 10000` |

Pre-commit hook (installed on `pnpm install` via `prepare`): typecheck + lint + format:check + test.

## CombatCore (`@aether-break/combat-core`)

Pure ESM TypeScript. **Zero runtime dependencies.**

```ts
import {
  createInitialState,
  step,
  getStateHash,
  emptyActions,
} from '@aether-break/combat-core';

let state = createInitialState({ seed: 42 });
state = step(state, {
  p1: { ...emptyActions(), right: true, light: true },
  p2: { ...emptyActions(), guard: true },
});
console.log(getStateHash(state));
```

### Hard boundary (SRS §5.3)

Must not use: `Date`, `Math.random`, `performance`, `fetch`, `WebSocket`, DOM/browser globals, Node `fs`/`process` (except tests/scripts), Babylon, React, Web Audio.

Enforced by ESLint restricted globals/imports **and** `src/__tests__/purity.test.ts`.

### Determinism contract

See [docs/ADR-0002-determinism-contract.md](docs/ADR-0002-determinism-contract.md):

- `TICK_RATE = 60`, fixed-point ×1000, Park–Miller LCG
- Pure `step` + canonical JSON snapshots + FNV-1a `getStateHash`

### Greybox roster

| Slot | Fighter | Kit highlights |
|------|---------|----------------|
| P1 | Nyra Vex | Walk 286, light/heavy, arc gun, spell |
| P2 | Bram Kade | Walk 220, light/heavy, scattergun, furnace spell |

Move baselines from SRS §7.2 sample (light: startup 6, active 6–8, recovery 12, damage 42).

## Documentation

- [ADR-0001 — Legacy archive](docs/ADR-0001-legacy-archive.md)
- [ADR-0002 — Determinism contract](docs/ADR-0002-determinism-contract.md)
- `SRS ether arena.pdf` — full product/requirements spec
- `legacy/README.md` — out-of-scope prototype note

## Milestone status

| Area | Status |
|------|--------|
| Monorepo scaffold | ✅ |
| CombatCore v0 + tests | ✅ |
| Playable 2D greybox client | ✅ canvas local 1v1 |
| Renderer / Babylon 2.5D | ⏳ deferred |
| Online / rollback wire-up | ⏳ deferred |
| Full move set / ultimates | ⏳ deferred |

## License

Project follows the Aether Break SRS v1.0. Original concept — no licensed Street Fighter assets or names.
