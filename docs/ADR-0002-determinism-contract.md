# ADR-0002 — CombatCore determinism contract

- **Status:** Accepted
- **Date:** 2026-07-31
- **Deciders:** Engineering (Milestone 1 kickoff)

## Context

FR-010 and SRS §6.3 require a fixed 60 Hz simulation that produces identical state hashes across Node and supported browsers from the same seed + input stream. Rollback (Milestone 2) depends on serialisable snapshots and pure stepping.

## Decision

### Fixed-point convention

- All positions, velocities, box dimensions, and impulses are **integers** in **milli-units**: `FP_SCALE = 1000` (1.000 world unit = 1000 stored units).
- HP, flux, frame counters, and enum-like phases remain ordinary integers (not scaled).
- Gravity, walk, jump, dash values are authored already scaled (e.g. walk `286` ≈ 0.286 wu/tick).
- No `Math.random`. Division uses truncating `| 0` or integer ratios where needed.

### PRNG

- Park–Miller LCG: `state' = (16807 * state) mod (2^31 − 1)`, Schrage multiplication for overflow safety.
- Seed `≤ 0` coerces to `1`. RNG state lives on `GameState.rng` and is part of the hash.
- Milestone 1 combat paths rarely consume RNG; the generator is present for bots/fuzz later.

### Pure `step(state, inputs)`

- `step` deep-clones via **canonical JSON round-trip** (`serializeState` → `JSON.parse`), mutates the clone, returns it.
- Per-tick `events` array is fresh (callers who need full history must append).
- No wall clock, DOM, network, filesystem, or renderer imports in production sources.
- ESLint restricted globals/imports + a purity scan unit test enforce the boundary.

### Canonical serialisation & hash

- `toCanonical` emits plain objects with **sorted keys** and projectiles sorted by `id`.
- `getStateHash` is **FNV-1a 32-bit** over `JSON.stringify(canonical)`.
- `serializeState` / `deserializeState` / `cloneState` support rollback snapshots (§6.1).

### Input

- 6-frame buffer; simultaneous opposite directions cancel (FR-011).
- Buffered edges consume on action start (jump, dash, attacks).

### Iteration order

- No `Object.keys` dependence for gameplay outcomes except cooldown tick-down, which sorts is unnecessary because subtraction is commutative; projectile resolution walks array order (spawn order). Cooldown key order does not affect outcomes.

## Known limitations (Milestone 1)

- Clone-every-tick via JSON is simple and correct, not allocation-optimal; a pooled structural clone may replace it before online soak.
- Hitboxes use AABB only; no multi-hit moves, throws, parry, or combo scaling yet.
- Abilities/ultimates are reserved fields; greybox maps `ability1` → SPELL data only.
- Facing lock during attack/stun is simplified; no crouch-block height bands.
- Cross-runtime browser hash proof is deferred to the next prompt (`scripts/replay.ts` is the CLI seed).
- Turborepo deferred (pnpm workspaces only) to keep kickoff friction-free.

## Consequences

- Determinism tests (`pnpm test:determinism`, 10k-frame suite) are release gates.
- Content authors must express spatial data in milli-units.
- Presentation adapters convert `fp → world` only at the boundary (`fromFp`).
