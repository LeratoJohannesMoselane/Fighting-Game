# Legacy Prototype (Out of Scope)

This directory archives the pre-Milestone-1 prototype that shipped on `main` before the SRS-aligned monorepo.

## What is here

| Path | Origin |
|------|--------|
| `game.js` + root `index.html` (moved here) | Early 2D canvas fighter sketch |
| `src/*.js` | Babylon.js experiment + non-deterministic combat sketch |
| `package.json` / `package-lock.json` | Vite + Babylon single-package app |

## Why it is archived

Per **ADR-0001** and SRS §5.3 / §9.1:

- Combat rules lived beside renderer and browser APIs (violates the CombatCore hard boundary).
- Simulation used floating-point freely and was not framed as a pure `step(state, inputs)` API.
- The stack skipped ahead of the greybox vertical slice (Babylon before fun is proven).
- Milestone 1 rebuilds from a pure deterministic `packages/combat-core` with zero runtime deps.

## Rules

- **Do not import** anything from `legacy/` into `apps/` or `packages/`.
- Keep files **untouched** for historical reference only.
- New work lives under `packages/`, `apps/`, `docs/`, and `scripts/`.
