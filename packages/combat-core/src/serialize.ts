import type { ActionBits, FighterState, GameState, ProjectileState } from './types.js';

/**
 * Canonical JSON serialisation with fixed key order (ADR-0002).
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
  const flux = f.flux ?? f.ultimate ?? 0;
  return {
    awakened: !!f.awakened,
    awakeningTimer: f.awakeningTimer ?? 0,
    awakeningUsedThisRound: !!f.awakeningUsedThisRound,
    comboCount: f.comboCount ?? 0,
    comboMoves: (f.comboMoves ?? []).slice(),
    comboTimer: f.comboTimer ?? 0,
    cooldowns,
    dashRecovering: f.dashRecovering,
    dashTimer: f.dashTimer,
    facing: f.facing,
    flux,
    guardCrushPending: !!f.guardCrushPending,
    guarding: f.guarding,
    hitstop: f.hitstop,
    hp: f.hp,
    hurtbox: { h: f.hurtbox.h, w: f.hurtbox.w, x: f.hurtbox.x, y: f.hurtbox.y },
    id: f.id,
    inputBuffer: f.inputBuffer.map(actionsToCanonical),
    jumpUsed: f.jumpUsed,
    knockdownTimer: f.knockdownTimer,
    magic: f.magic ?? 0,
    maxHp: f.maxHp ?? f.hp,
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
    special: f.special ?? 0,
    specialMax: f.specialMax ?? 0,
    specialRegenDelay: f.specialRegenDelay ?? 0,
    specialRegenTimer: f.specialRegenTimer ?? 0,
    stamina: f.stamina ?? 0,
    staminaMilli: f.staminaMilli ?? 0,
    staminaRegenDelay: f.staminaRegenDelay ?? 0,
    stunFrames: f.stunFrames,
    ultimate: flux,
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

export function toCanonical(state: GameState): Record<string, unknown> {
  const projectiles = state.projectiles
    .slice()
    .sort((a, b) => cmpNum(a.id, b.id))
    .map(projectileToCanonical);

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

export function serializeState(state: GameState): string {
  return JSON.stringify(toCanonical(state));
}

export function deserializeState(json: string): GameState {
  const raw = JSON.parse(json) as GameState;
  return cloneState(raw);
}

function syncFighterResources(f: FighterState): void {
  const flux = f.flux ?? f.ultimate ?? 0;
  f.flux = flux;
  f.ultimate = flux;
  if (typeof f.stamina !== 'number') f.stamina = 100;
  if (typeof f.staminaMilli !== 'number') f.staminaMilli = 0;
  if (typeof f.staminaRegenDelay !== 'number') f.staminaRegenDelay = 0;
  if (typeof f.guardCrushPending !== 'boolean') f.guardCrushPending = false;
  if (typeof f.magic !== 'number') f.magic = 100;
  if (typeof f.special !== 'number') f.special = 0;
  if (typeof f.specialMax !== 'number') f.specialMax = 0;
  if (typeof f.specialRegenDelay !== 'number') f.specialRegenDelay = 0;
  if (typeof f.specialRegenTimer !== 'number') f.specialRegenTimer = 0;
  if (typeof f.comboCount !== 'number') f.comboCount = 0;
  if (typeof f.comboTimer !== 'number') f.comboTimer = 0;
  if (!Array.isArray(f.comboMoves)) f.comboMoves = [];
  if (typeof f.awakened !== 'boolean') f.awakened = false;
  if (typeof f.awakeningTimer !== 'number') f.awakeningTimer = 0;
  if (typeof f.awakeningUsedThisRound !== 'boolean') f.awakeningUsedThisRound = false;
  if (typeof f.maxHp !== 'number' || f.maxHp <= 0) f.maxHp = Math.max(f.hp, 1);
}

export function cloneState(state: GameState): GameState {
  const next = JSON.parse(serializeState(state)) as GameState;
  syncFighterResources(next.fighters[0]);
  syncFighterResources(next.fighters[1]);
  return next;
}

export function getStateHash(state: GameState): number {
  const s = serializeState(state);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
