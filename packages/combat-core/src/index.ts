/**
 * @aether-break/combat-core
 * Pure deterministic 60 Hz combat simulation (SRS §5.3 HARD BOUNDARY, FR-010).
 *
 * Zero runtime dependencies. No Date, Math.random, DOM, network, or render APIs.
 */

export {
  TICK_RATE,
  TICK_MS,
  MAX_HP,
  MAX_FLUX,
  ROUND_TICKS,
  ROUNDS_TO_WIN,
  MAX_ROUNDS,
  FP_SCALE,
  INPUT_BUFFER_FRAMES,
  ARENA_HALF_WIDTH,
  GROUND_Y,
  GRAVITY,
  JUMP_VELOCITY,
  DEFAULT_WALK_SPEED,
  DASH_SPEED,
  DASH_ACTIVE_FRAMES,
  DASH_RECOVERY_FRAMES,
  ROUND_INTRO_FRAMES,
  ROUND_END_FRAMES,
  DEFAULT_HITSTOP_FRAMES,
  DEFAULT_HURTBOX,
  BODY_HALF_WIDTH,
  LCG_MOD,
  LCG_MUL,
} from './constants.js';

export type {
  ActionBits,
  InputFrame,
  StepInputs,
  FighterPhase,
  MatchPhase,
  Box,
  HitboxDef,
  OnHitData,
  OnBlockData,
  MoveData,
  ProjectileSpawnDef,
  FighterKit,
  ActiveMoveState,
  FighterState,
  ProjectileState,
  GameEvent,
  GameState,
  CreateInitialStateOptions,
} from './types.js';

export { createInitialState } from './state.js';
export { step, stepN } from './step.js';
export {
  serializeState,
  deserializeState,
  cloneState,
  getStateHash,
  toCanonical,
} from './serialize.js';
export { emptyActions, normalizeActions, resolveSOD } from './input.js';
export { validateMoveData, assertValidMove } from './validate.js';
export type { ValidationIssue } from './validate.js';
export {
  NYRA_VEX,
  BRAM_KADE,
  IRIA_SOL,
  FIGHTER_KITS,
  getKit,
  getMove,
  findMoveByInput,
} from './content/fighters.js';
export {
  clamp,
  iabs,
  toFp,
  fromFp,
  lcgNext,
  lcgInt,
  aabbOverlap,
  localBoxToWorld,
} from './math.js';
