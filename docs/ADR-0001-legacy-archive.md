# ADR-0001 — Archive legacy prototype under `legacy/`

- **Status:** Accepted
- **Date:** 2026-07-31
- **Deciders:** Engineering (Milestone 1 kickoff)

## Context

The repository root previously held a diverged prototype:

- A 2D canvas fighter (`game.js` + `index.html`)
- A Babylon.js experiment (`src/main.js`, character/AI controllers)
- A non-boundary-compliant combat sketch (`src/combat-core.js`) that mixed floating-point rules with presentation concerns and was not a pure, testable `step(state, inputs)` package

The SRS (v1.0, 31 July 2026) requires a monorepo with a hard boundary around `packages/combat-core` (SRS §5.3), Milestone 1 greybox before online/art (SRS §9.1), and FR-010 determinism.

## Decision

1. Move all pre-SRS prototype sources into `legacy/` **untouched** via `git mv`.
2. Do **not** import from `legacy/` into `apps/` or `packages/`.
3. Rebuild from a pnpm workspaces monorepo aligned to SRS §5.3:
   - `packages/combat-core` — pure deterministic sim
   - `packages/config` — shared TS/ESLint/Vitest
   - `apps/web` — Vite + TS placeholder only (no React/Babylon in M1)
   - `docs/` — ADRs

## Consequences

- Historical reference is preserved without contaminating the new dependency graph.
- Milestone 1 can prove combat fun and determinism before renderer investment.
- Any useful numbers or kit ideas from the legacy sketch must be **re-authored** as data under `packages/combat-core/src/content/`.

## Alternatives considered

| Option | Why rejected |
|--------|----------------|
| Extend legacy in place | Violates CombatCore hard boundary; locks in float/random habits |
| Delete legacy | Loses reference material for designers/engineers |
| Wrap legacy combat-core | API and purity gaps are structural, not cosmetic |
