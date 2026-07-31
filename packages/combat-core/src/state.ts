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
import { initFighterResources } from './resources.js';
import type { CreateInitialStateOptions, FighterState, GameState } from './types.js';

function makeFighter(id: string, slot: 0 | 1, startX: number): FighterState {
  const kit = getKit(id);
  const buffer: ReturnType<typeof emptyActions>[] = [];
  for (let i = 0; i < INPUT_BUFFER_FRAMES; i++) {
    buffer.push(emptyActions());
  }
  const hp = kit.base.hp > 0 ? kit.base.hp : MAX_HP;
  const f: FighterState = {
    id,
    slot,
    hp,
    maxHp: hp,
    stamina: 100,
    staminaMilli: 0,
    staminaRegenDelay: 0,
    guardCrushPending: false,
    magic: 100,
    flux: 0,
    ultimate: 0,
    special: 0,
    specialMax: 0,
    specialRegenDelay: 0,
    specialRegenTimer: 0,
    comboCount: 0,
    comboTimer: 0,
    comboMoves: [],
    awakened: false,
    awakeningTimer: 0,
    awakeningUsedThisRound: false,
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
  initFighterResources(f);
  return f;
}

/**
 * Create a fresh match state.
 * Defaults: P1 = Nyra Vex (left), P2 = Bram Kade (right).
 */
export function createInitialState(options: CreateInitialStateOptions): GameState {
  const seed = options.seed | 0;
  const mode = options.mode ?? 'versus';
  const rng = seed <= 0 ? 1 : seed;

  const p1Id = options.p1Id ?? 'nyra_vex';
  const p2Id = options.p2Id ?? 'bram_kade';
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

  updateFacing(state);
  return state;
}

/** Reset fighters for a new round (keeps wins + flux carry). */
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
  const carriedFlux = f.flux | 0;
  f.hp = hp;
  f.maxHp = hp;
  initFighterResources(f);
  // Flux carries between rounds (comeback tension); awakening does not.
  f.flux = carriedFlux;
  f.ultimate = carriedFlux;
  f.awakened = false;
  f.awakeningTimer = 0;
  f.awakeningUsedThisRound = false;
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
}

export function clampToArena(f: FighterState): void {
  if (f.x < -ARENA_HALF_WIDTH) f.x = -ARENA_HALF_WIDTH;
  if (f.x > ARENA_HALF_WIDTH) f.x = ARENA_HALF_WIDTH;
  if (f.y < 0) {
    f.y = 0;
    f.vy = 0;
  }
}
