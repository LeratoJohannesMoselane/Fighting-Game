import {
  ARENA_HALF_WIDTH,
  DEFAULT_HURTBOX,
  INPUT_BUFFER_FRAMES,
  MAX_HP,
  ROUND_INTRO_FRAMES,
  ROUND_TICKS,
} from './constants.js';
import { getKit } from './content/fighters.js';
import { emptyActions } from './input.js';
import type { CreateInitialStateOptions, FighterState, GameState } from './types.js';

function makeFighter(id: string, slot: 0 | 1, startX: number): FighterState {
  const kit = getKit(id);
  const buffer: ReturnType<typeof emptyActions>[] = [];
  for (let i = 0; i < INPUT_BUFFER_FRAMES; i++) {
    buffer.push(emptyActions());
  }
  return {
    id,
    slot,
    hp: kit.base.hp > 0 ? kit.base.hp : MAX_HP,
    flux: 0,
    x: startX,
    y: 0,
    vx: 0,
    vy: 0,
    facing: slot === 0 ? 1 : -1,
    phase: 'neutral',
    wins: 0,
    move: null,
    stunFrames: 0,
    dashTimer: 0,
    dashRecovering: false,
    hitstop: 0,
    knockdownTimer: 0,
    hurtbox: { ...DEFAULT_HURTBOX },
    cooldowns: {},
    inputBuffer: buffer,
    guarding: false,
    jumpUsed: false,
  };
}

/**
 * Create a fresh match state.
 * Defaults: P1 = Nyra Vex (left), P2 = Bram Kade (right).
 * Override with `p1Id` / `p2Id` (must exist in FIGHTER_KITS).
 */
export function createInitialState(options: CreateInitialStateOptions): GameState {
  const seed = options.seed | 0;
  const mode = options.mode ?? 'versus';
  const rng = seed <= 0 ? 1 : seed;

  const p1Id = options.p1Id ?? 'nyra_vex';
  const p2Id = options.p2Id ?? 'bram_kade';
  // Validate kits early (throws if unknown).
  getKit(p1Id);
  getKit(p2Id);

  const p1 = makeFighter(p1Id, 0, -6500);
  const p2 = makeFighter(p2Id, 1, 6500);

  const state: GameState = {
    tick: 0,
    seed,
    rng,
    mode,
    matchPhase: 'round_intro',
    phaseTimer: ROUND_INTRO_FRAMES,
    round: 1,
    timer: ROUND_TICKS,
    fighters: [p1, p2],
    projectiles: [],
    events: [{ type: 'round_start', round: 1, tick: 0 }],
    nextProjectileId: 1,
    matchWinner: null,
    globalHitstop: 0,
  };

  // Face each other
  updateFacing(state);
  return state;
}

/** Reset fighters for a new round (keeps wins). */
export function resetRoundFighters(state: GameState): void {
  const p1 = state.fighters[0];
  const p2 = state.fighters[1];
  const kit1 = getKit(p1.id);
  const kit2 = getKit(p2.id);

  resetFighterForRound(p1, -6500, kit1.base.hp, 1);
  resetFighterForRound(p2, 6500, kit2.base.hp, -1);
  state.projectiles = [];
  state.timer = ROUND_TICKS;
  state.globalHitstop = 0;
}

function resetFighterForRound(f: FighterState, x: number, hp: number, facing: 1 | -1): void {
  f.hp = hp;
  f.flux = 0;
  f.x = x;
  f.y = 0;
  f.vx = 0;
  f.vy = 0;
  f.facing = facing;
  f.phase = 'neutral';
  f.move = null;
  f.stunFrames = 0;
  f.dashTimer = 0;
  f.dashRecovering = false;
  f.hitstop = 0;
  f.knockdownTimer = 0;
  f.hurtbox = { ...DEFAULT_HURTBOX };
  f.cooldowns = {};
  f.guarding = false;
  f.jumpUsed = false;
  const buffer: ReturnType<typeof emptyActions>[] = [];
  for (let i = 0; i < INPUT_BUFFER_FRAMES; i++) {
    buffer.push(emptyActions());
  }
  f.inputBuffer = buffer;
}

export function updateFacing(state: GameState): void {
  const a = state.fighters[0];
  const b = state.fighters[1];
  if (a.x < b.x) {
    a.facing = 1;
    b.facing = -1;
  } else if (a.x > b.x) {
    a.facing = -1;
    b.facing = 1;
  }
  // equal x: keep previous facing
}

export function clampToArena(f: FighterState): void {
  if (f.x < -ARENA_HALF_WIDTH) f.x = -ARENA_HALF_WIDTH;
  if (f.x > ARENA_HALF_WIDTH) f.x = ARENA_HALF_WIDTH;
  if (f.y < 0) {
    f.y = 0;
    f.vy = 0;
  }
}
