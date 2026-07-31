/** Fixed simulation rate (SRS §2.1, FR-010). */
export const TICK_RATE = 60;

/** Milliseconds per tick at the fixed rate (informational; core never reads a clock). */
export const TICK_MS = 1000 / TICK_RATE;

/** Baseline fighter health (SRS §2.1). */
export const MAX_HP = 1000;

/** Full Flux meter capacity (SRS §2.1). */
export const MAX_FLUX = 100;

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
export const GRAVITY = 37;

/** Default jump initial velocity (fp units / tick). */
export const JUMP_VELOCITY = 780;

/** Default walk speed (fp units / tick). Nyra baseline; Bram is slower in content. */
export const DEFAULT_WALK_SPEED = 286;

/** Forward dash speed impulse (fp units / tick) applied for DASH_ACTIVE_FRAMES. */
export const DASH_SPEED = 700;

/** Dash duration in frames. */
export const DASH_ACTIVE_FRAMES = 10;

/** Dash recovery frames after active. */
export const DASH_RECOVERY_FRAMES = 8;

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
