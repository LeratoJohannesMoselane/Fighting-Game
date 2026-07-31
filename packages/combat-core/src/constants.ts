/** Fixed simulation rate (SRS §2.1, FR-010). */
export const TICK_RATE = 60;

/** Milliseconds per tick at the fixed rate (informational; core never reads a clock). */
export const TICK_MS = 1000 / TICK_RATE;

/** Baseline fighter health (SRS §2.1). */
export const MAX_HP = 1000;

/**
 * Stamina — physical gas tank.
 * Guns and dashes spend it; close-range melee combat restores it.
 */
export const MAX_STAMINA = 100;

/**
 * Magic — arcane reservoir.
 * Guns and spells spend it; physical combat restores it.
 */
export const MAX_MAGIC = 100;

/**
 * Ultimate meter — anime super gauge (0–100).
 * Fills from landing/receiving melee; spends fully on Awakening Strike.
 * Legacy alias: MAX_FLUX.
 */
export const MAX_ULTIMATE = 100;

/** @deprecated Use MAX_ULTIMATE — kept for SRS naming compatibility. */
export const MAX_FLUX = MAX_ULTIMATE;

/** Stamina spent to fire a gun / ranged tool. */
export const GUN_STAMINA_COST = 18;

/** Magic spent to fire a gun / ranged tool. */
export const GUN_MAGIC_COST = 12;

/** Magic spent to cast a spell / ability. */
export const SPELL_MAGIC_COST = 28;

/** Stamina spent on spell (physical stance). */
export const SPELL_STAMINA_COST = 8;

/** Stamina spent on dash. */
export const DASH_STAMINA_COST = 12;

/** Magic spent when detonating a full ultimate. */
export const ULTIMATE_MAGIC_COST = 35;

/** Passive stamina regen per tick while not attacking (milli-units of bar). */
export const STAMINA_REGEN_IDLE = 0;

/** Passive magic regen is zero — must earn via melee. */
export const MAGIC_REGEN_IDLE = 0;

// --- Full resource system (tick-pure) ---

/** Stamina regen: 2 points/sec → ~33 milli-points per tick at 60 Hz. */
export const STAMINA_REGEN_PER_TICK_MILLI = 33;

/** Delay after spend before stamina regen starts (1 second). */
export const STAMINA_REGEN_DELAY_TICKS = 60;

/**
 * Block drain: 0.5% of bar per frame.
 * With MAX_STAMINA=100, 0.5 stamina/frame = 500 milli/frame (aggressive greybox).
 * Tuned to 80 milli/frame ≈ 4.8 stamina/sec so block is costly but not instant crush.
 */
export const STAMINA_BLOCK_COST_MILLI = 80;

/** Base dash stamina cost (before band multiplier). */
export const STAMINA_DASH_COST = 15;

/** Stamina band thresholds. */
export const STAMINA_THRESH_EFFICIENT = 60;
export const STAMINA_THRESH_LIMITED = 30;
export const STAMINA_THRESH_CRITICAL = 10;

/** Combo timer (frames). */
export const COMBO_RESET_TICKS = 30;
export const COMBO_EXTEND_TICKS = 10;
export const COMBO_MAX_TIMER = 90;

/** Awakening: manual only, once per round. */
export const AWAKENING_HP_PCT = 30;
export const AWAKENING_FLUX_COST = 50;
/** 15 seconds @ 60 Hz. */
export const AWAKENING_DURATION_TICKS = 15 * 60;

/** Flux drips. */
export const FLUX_ON_BLOCK = 1;
export const FLUX_ON_COMBO_HIT = 2;

/** Ultimate still costs full flux. */
export const ULTIMATE_FLUX_COST = 100;

/** Round duration in ticks: 90 seconds × 60 Hz (SRS §2.1). */
export const ROUND_TICKS = 90 * TICK_RATE;

/** Best-of-N rounds (first to 2 wins). */
export const ROUNDS_TO_WIN = 2;

/** Maximum rounds in a match (best of 3). */
export const MAX_ROUNDS = 3;

/**
 * Fixed-point scale: gameplay units × FP_SCALE are stored as integers.
 * Convention (ADR-0002): 1.000 world unit = 1000 fp units.
 */
export const FP_SCALE = 1000;

/** Input buffer depth in frames (SRS §2.1). */
export const INPUT_BUFFER_FRAMES = 6;

/** Arena half-width in fixed-point units (world x ∈ [-9.5, 9.5]). */
export const ARENA_HALF_WIDTH = 9500;

/** Ground y in fixed-point (y = 0 is the floor). */
export const GROUND_Y = 0;

/** Default gravity acceleration per tick (fp units / tick²). */
export const GRAVITY = 42;

/** Default jump initial velocity (fp units / tick). */
export const JUMP_VELOCITY = 820;

/** Default walk speed (fp units / tick). Nyra baseline; Bram is slower in content. */
export const DEFAULT_WALK_SPEED = 310;

/** Ground acceleration toward walk speed (fp / tick²). */
export const WALK_ACCEL = 55;

/** Ground friction when no input (fp / tick²). */
export const GROUND_FRICTION = 48;

/** Air control factor vs walk accel (0–1). */
export const AIR_CONTROL = 0.45;

/** Forward dash speed impulse (fp units / tick) applied for DASH_ACTIVE_FRAMES. */
export const DASH_SPEED = 820;

/** Dash duration in frames. */
export const DASH_ACTIVE_FRAMES = 12;

/** Dash recovery frames after active. */
export const DASH_RECOVERY_FRAMES = 6;

/** Round intro freeze frames before control is unlocked. */
export const ROUND_INTRO_FRAMES = 60;

/** Round end hold before advancing to Result. */
export const ROUND_END_FRAMES = 90;

/** Hit-stop frames applied on confirmed hit (cosmetic freeze of action timers). */
export const DEFAULT_HITSTOP_FRAMES = 6;

/** Hurtbox defaults (fp). Width 1.2 wu — readable greybox body. */
export const DEFAULT_HURTBOX = {
  x: -600,
  y: 0,
  w: 1200,
  h: 1600,
} as const;

/** Minimum centre-to-centre separation on the ground (fp). */
export const BODY_HALF_WIDTH = 600;

/** Park–Miller LCG modulus (2^31 − 1). */
export const LCG_MOD = 2147483647;

/** Park–Miller LCG multiplier. */
export const LCG_MUL = 16807;
