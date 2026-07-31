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
  MAX_STAMINA,
  MAX_MAGIC,
  MAX_ULTIMATE,
  MAX_FLUX,
  GUN_STAMINA_COST,
  GUN_MAGIC_COST,
  SPELL_MAGIC_COST,
  SPELL_STAMINA_COST,
  DASH_STAMINA_COST,
  ULTIMATE_MAGIC_COST,
  STAMINA_REGEN_PER_TICK_MILLI,
  STAMINA_REGEN_DELAY_TICKS,
  STAMINA_BLOCK_COST_MILLI,
  STAMINA_DASH_COST,
  STAMINA_THRESH_EFFICIENT,
  STAMINA_THRESH_LIMITED,
  STAMINA_THRESH_CRITICAL,
  COMBO_RESET_TICKS,
  COMBO_EXTEND_TICKS,
  COMBO_MAX_TIMER,
  AWAKENING_HP_PCT,
  AWAKENING_FLUX_COST,
  AWAKENING_DURATION_TICKS,
  FLUX_ON_BLOCK,
  FLUX_ON_COMBO_HIT,
  ULTIMATE_FLUX_COST,
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
  WALK_ACCEL,
  GROUND_FRICTION,
  AIR_CONTROL,
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

export {
  getResourceProfile,
  RESOURCE_PROFILES,
  staminaBand,
  comboCallout,
  comboScalingMul,
  tryActivateAwakening,
  fluxFromDamage,
} from './resources.js';
export type {
  StaminaBand,
  SpecialKind,
  SpecialResourceConfig,
  FighterResourceProfile,
} from './resources.js';

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
  ProjectileKind,
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
  KELLAN_WISP,
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
