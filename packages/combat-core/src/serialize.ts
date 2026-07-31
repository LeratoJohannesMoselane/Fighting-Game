import type { ActionBits, FighterState, GameState, ProjectileState } from './types.js';

/**
 * Canonical JSON serialisation with fixed key order (ADR-0002).
 * Used by getStateHash, snapshots, and determinism tests.
 *
 * Clone strategy: structured deep copy via JSON parse/stringify of the
 * canonical form — slow but guarantees plain-JSON fidelity and stable key order.
 * For hot rollback paths a later milestone may switch to a hand-rolled pool;
 * the public contract remains "plain JSON round-trip equals original".
 */

function cmpNum(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function actionsToCanonical(a: ActionBits): ActionBits {
  return {
    ability1: !!a.ability1,
    ability2: !!a.ability2,
    dash: !!a.dash,
    down: !!a.down,
    guard: !!a.guard,
    heavy: !!a.heavy,
    jump: !!a.jump,
    left: !!a.left,
    light: !!a.light,
    ranged: !!a.ranged,
    right: !!a.right,
    ultimate: !!a.ultimate,
    up: !!a.up,
  };
}

function fighterToCanonical(f: FighterState): Record<string, unknown> {
  const cooldownKeys = Object.keys(f.cooldowns).sort();
  const cooldowns: Record<string, number> = {};
  for (let i = 0; i < cooldownKeys.length; i++) {
    const k = cooldownKeys[i]!;
    cooldowns[k] = f.cooldowns[k] ?? 0;
  }
  // Keep ultimate/flux in sync for legacy snapshots.
  const ultimate = f.ultimate ?? f.flux ?? 0;
  return {
    cooldowns,
    dashRecovering: f.dashRecovering,
    dashTimer: f.dashTimer,
    facing: f.facing,
    flux: ultimate,
    guarding: f.guarding,
    hitstop: f.hitstop,
    hp: f.hp,
    hurtbox: { h: f.hurtbox.h, w: f.hurtbox.w, x: f.hurtbox.x, y: f.hurtbox.y },
    id: f.id,
    inputBuffer: f.inputBuffer.map(actionsToCanonical),
    jumpUsed: f.jumpUsed,
    knockdownTimer: f.knockdownTimer,
    magic: f.magic ?? 0,
    move: f.move
      ? {
          hasHit: f.move.hasHit,
          localFrame: f.move.localFrame,
          moveId: f.move.moveId,
          projectileSpawned: f.move.projectileSpawned,
          totalFrames: f.move.totalFrames,
        }
      : null,
    phase: f.phase,
    slot: f.slot,
    stamina: f.stamina ?? 0,
    stunFrames: f.stunFrames,
    ultimate,
    vx: f.vx,
    vy: f.vy,
    wins: f.wins,
    x: f.x,
    y: f.y,
  };
}

function projectileToCanonical(p: ProjectileState): Record<string, unknown> {
  return {
    age: p.age ?? 0,
    blockStun: p.blockStun,
    bounce: p.bounce ?? 0,
    damage: p.damage,
    facing: p.facing,
    fluxGain: p.fluxGain,
    gravity: p.gravity ?? 0,
    height: p.height,
    hitStun: p.hitStun,
    id: p.id,
    kind: p.kind ?? 'bullet',
    lifetime: p.lifetime,
    moveId: p.moveId,
    ownerSlot: p.ownerSlot,
    vx: p.vx,
    vy: p.vy,
    width: p.width,
    x: p.x,
    y: p.y,
  };
}

/** Canonical plain object (sorted keys at every level we control). */
export function toCanonical(state: GameState): Record<string, unknown> {
  const projectiles = state.projectiles
    .slice()
    .sort((a, b) => cmpNum(a.id, b.id))
    .map(projectileToCanonical);

  // Events are append-only in tick order; serialise as-is but with stable field order per event.
  const events = state.events.map((e) => sortKeysDeep(e as unknown as Record<string, unknown>));

  return {
    events,
    fighters: [fighterToCanonical(state.fighters[0]), fighterToCanonical(state.fighters[1])],
    globalHitstop: state.globalHitstop,
    matchPhase: state.matchPhase,
    matchWinner: state.matchWinner,
    mode: state.mode,
    nextProjectileId: state.nextProjectileId,
    phaseTimer: state.phaseTimer,
    projectiles,
    rng: state.rng,
    round: state.round,
    seed: state.seed,
    tick: state.tick,
    timer: state.timer,
  };
}

function sortKeysDeep(obj: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(obj).sort();
  const out: Record<string, unknown> = {};
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]!;
    const v = obj[k];
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = sortKeysDeep(v as Record<string, unknown>);
    } else if (Array.isArray(v)) {
      out[k] = v.map((item) =>
        item !== null && typeof item === 'object' && !Array.isArray(item)
          ? sortKeysDeep(item as Record<string, unknown>)
          : item,
      );
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Deterministic JSON string (canonical key order). */
export function serializeState(state: GameState): string {
  return JSON.stringify(toCanonical(state));
}

/** Restore state from a serializeState payload. */
export function deserializeState(json: string): GameState {
  const raw = JSON.parse(json) as GameState;
  return cloneState(raw);
}

function syncFighterResources(f: FighterState): void {
  // Prefer ultimate; fall back to flux for older snapshots.
  const u = f.ultimate ?? f.flux ?? 0;
  f.ultimate = u;
  f.flux = u;
  if (typeof f.stamina !== 'number') f.stamina = 100;
  if (typeof f.magic !== 'number') f.magic = 100;
}

/**
 * Deep clone via canonical JSON round-trip.
 * Guarantees: no shared references; plain JSON types only; stable for hashing.
 */
export function cloneState(state: GameState): GameState {
  const next = JSON.parse(serializeState(state)) as GameState;
  syncFighterResources(next.fighters[0]);
  syncFighterResources(next.fighters[1]);
  return next;
}

/**
 * FNV-1a 32-bit hash over the canonical serialisation (ADR-0002).
 * Returns an unsigned 32-bit integer.
 */
export function getStateHash(state: GameState): number {
  const s = serializeState(state);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    // h *= 16777619 (FNV prime) with 32-bit overflow
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
