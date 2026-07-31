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

## Play the greybox

```bash
pnpm install
pnpm dev
```

Open the URL Vite prints (usually `http://localhost:5173/`).

### Character menu

1. Pick **your** fighter (Nyra / Bram / Iria)  
2. Pick the **opponent** fighter  
3. Choose **CPU** (AI) or **Human** (local P2)  
4. If CPU: Easy / Normal / Hard  
5. Press **FIGHT** (or `Enter`)

`Esc` or `M` returns to the menu. `Enter` rematches with the same setup.

### Controls

| | Player 1 | Player 2 (Human mode only) |
|--|----------|----------------------------|
| Move | `A` `D` | `←` `→` |
| Jump / crouch | `W` / `S` | `↑` / `↓` |
| Light / Heavy | `F` / `G` | `J` / `K` |
| Gun / Spell | `H` / `R` | `L` / `U` |
| **Awakening (Ultimate)** | `Q` | `O` |
| Guard / Dash | `Shift` / `E` | `/` / `.` |
| Rematch / Menu / Pause / Hitboxes | `Enter` / `Esc` / `P` / `B` | same |

### Resources

| Bar | Color | Spent by | Restored by |
|-----|-------|----------|-------------|
| **HP** | Teal / Red | Taking hits | — |
| **Stamina** | Gold | Guns, dashes, spells | Landing **melee** hits |
| **Magic** | Blue | Guns, spells, Awakening | Landing **melee** hits |
| **Awakening** | Violet→Gold | Full bar → super | Landing/taking melee (anime super gauge) |

Empty stamina/magic = guns and spells refuse. Full Awakening + enough magic = press `Q`/`O` for a cinematic super (Nyra Event Horizon, Bram Last Foundry, Iria Sevenfold Star).

Simulation runs at a fixed **60 Hz** via `@aether-break/combat-core`; the canvas is presentation-only. CPU AI is client-side and does not live inside CombatCore.

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

## Menu system (SF6-style)

The client ships a full browser-native menu system (`apps/web/src/ui`) — zero runtime dependencies, keyboard-first, mouse-supported:

```
MAIN MENU
├── FIGHT        → Versus (local PvP) · Training · Arcade (5-match ladder) · Online
├── CHARACTERS   → Roster · Move List (frame data) · Cosmetics (colorways)
├── TRAINING     → Practice Mode · Combo Trials (soon) · Tutorial (soon)
├── PROFILE      → Stats · History · Settings (tag, records)
├── OPTIONS      → Graphics · Audio · Controls (rebinding) · Accessibility · Language
└── EXIT
```

- **Live procedural portraits** — roster/select/cosmetics cards render the actual in-game mesh, no art files.
- **Colorways** — hue-rotated palette variants applied to mesh, gradients and VFX at match start.
- **Training mode** — infinite timer/HP, full flux, STAND/GUARD/CPU dummy, hitbox viewer (`B`).
- **Arcade mode** — 5-stage AI ladder with STAGE CLEAR / GAME OVER / CONTINUE flow.
- **Profile & records** — wins/losses, per-fighter records, last 25 matches (localStorage).
- **Options apply instantly** — shake, flashes, FPS counter, particle density, volume, rebinding, high contrast, large text, reduce-flashes.
- **Online lobby** — matchmaking/rooms UI gated behind an honest `OFFLINE BUILD` badge until the relay server milestone.

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
| Procedural mesh / anim / VFX / SFX | ✅ runtime placeholders (`apps/web/src/procedural`) |
| Menu system (select/roster/movelist/cosmetics/profile/options/training/arcade) | ✅ `apps/web/src/ui` |
| Online lobby UI | ✅ UI ready, gated (no relay server yet) |
| Renderer / Babylon 2.5D final art | ⏳ swap-in path documented |
| Online / rollback wire-up | ⏳ deferred |
| Full move set / ultimates | ⏳ deferred |
| Combo trials / tutorial content | ⏳ deferred |

## License

Project follows the Aether Break SRS v1.0. Original concept — no licensed Street Fighter assets or names.
