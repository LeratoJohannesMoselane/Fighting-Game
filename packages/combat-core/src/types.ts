/**
 * Public types for CombatCore v0.
 * All spatial quantities are fixed-point integers (× FP_SCALE) unless noted as "frames" or "hp/flux".
 */

/** Boolean action mask for one player on one frame (SRS Appendix A). */
export interface ActionBits {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  light: boolean;
  heavy: boolean;
  ranged: boolean;
  guard: boolean;
  dash: boolean;
  /** Reserved — not implemented in Milestone 1 greybox. */
  ability1: boolean;
  /** Reserved — not implemented in Milestone 1 greybox. */
  ability2: boolean;
  /** Reserved — not implemented in Milestone 1 greybox. */
  ultimate: boolean;
}

/** One player's input stamped with a simulation frame number. */
export interface InputFrame {
  frame: number;
  actions: ActionBits;
}

/** Both players' inputs for a single `step` call. */
export interface StepInputs {
  p1: ActionBits;
  p2: ActionBits;
}

/** Fighter phase in the Appendix B state machine (subset for greybox). */
export type FighterPhase =
  | 'neutral'
  | 'walk'
  | 'crouch'
  | 'jump'
  | 'airborne'
  | 'dash'
  | 'guard'
  | 'attack'
  | 'hitstun'
  | 'blockstun'
  | 'knockdown';

/** Match / round phase (Appendix B skeleton). */
export type MatchPhase = 'round_intro' | 'fighting' | 'round_end' | 'result' | 'rematch' | 'menu';

/** Axis-aligned box in fighter-local space (x positive = facing direction). */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HitboxDef {
  /** Inclusive local frame of the move when this hitbox is live. */
  frame: number;
  shape: 'box';
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface OnHitData {
  damage: number;
  hitStun: number;
  fluxGain: number;
  /** Optional knockback in fp units / tick (facing-relative). */
  knockbackX?: number;
  knockbackY?: number;
}

export interface OnBlockData {
  blockStun: number;
  advantage: number;
  /** Chip damage applied on block (default 0). */
  chip?: number;
}

/**
 * MoveData schema mirroring SRS §7.2 sample, plus greybox projectile/reserved fields.
 * Zero-dep hand-validated (see `validateMoveData`).
 */
export interface MoveData {
  id: string;
  /** Logical input that triggers the move (e.g. "LIGHT", "HEAVY", "RANGED", "SPELL"). */
  input: string;
  startup: number;
  /** Inclusive active window [start, end] in local move frames (1-based from startup start). */
  active: readonly [number, number];
  recovery: number;
  hitboxes: readonly HitboxDef[];
  hurtbox: Box;
  onHit: OnHitData;
  onBlock: OnBlockData;
  cancelTo: readonly string[];
  /** Optional projectile spawned on a given local frame. */
  projectile?: ProjectileSpawnDef;
  /** Reserved for abilities/ultimates (Milestone 2+). */
  fluxCost?: number;
  /** Reserved. */
  invulnFrames?: readonly [number, number];
  /** Movement impulse applied once on startup (fp). */
  forwardImpulse?: number;
}

export interface ProjectileSpawnDef {
  /** Local move frame when the projectile is spawned. */
  frame: number;
  speedX: number;
  speedY: number;
  /** Lifetime in ticks. */
  lifetime: number;
  damage: number;
  hitStun: number;
  blockStun: number;
  fluxGain: number;
  width: number;
  height: number;
  /** Max simultaneous instances of this projectile id from one fighter. */
  maxActive?: number;
}

export interface FighterKit {
  id: string;
  name: string;
  version: string;
  base: {
    hp: number;
    walk: number;
    jumpVelocity: number;
    dashSpeed: number;
    weight: number;
  };
  moves: readonly MoveData[];
}

export interface ActiveMoveState {
  moveId: string;
  /** Frames elapsed since move started (0 on the first active tick). */
  localFrame: number;
  /** Total duration = startup + (activeEnd - startup? handled via totalFrames). */
  totalFrames: number;
  /** Hit already connected this move (prevents multi-hit unless multi-hit moves later). */
  hasHit: boolean;
  /** Projectile already spawned for this move instance. */
  projectileSpawned: boolean;
}

export interface FighterState {
  id: string;
  slot: 0 | 1;
  hp: number;
  flux: number;
  /** Fixed-point position. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** +1 faces right, -1 faces left. */
  facing: 1 | -1;
  phase: FighterPhase;
  /** Wins this match. */
  wins: number;
  /** Active move machine, or null. */
  move: ActiveMoveState | null;
  /** Remaining stun frames (hit or block). */
  stunFrames: number;
  /** Remaining dash frames (active + recovery tracked via dashTimer/dashRecovering). */
  dashTimer: number;
  dashRecovering: boolean;
  /** Remaining hitstop frames (action timers frozen). */
  hitstop: number;
  /** Landing lag / knockdown timer. */
  knockdownTimer: number;
  /** Hurtbox override while attacking; otherwise kit default. */
  hurtbox: Box;
  /** Cooldowns remaining per move id (frames). */
  cooldowns: Record<string, number>;
  /** Input buffer of the last INPUT_BUFFER_FRAMES action snapshots (oldest → newest). */
  inputBuffer: ActionBits[];
  /** True while holding guard this tick after resolution. */
  guarding: boolean;
  /** Airborne jump already consumed until landing. */
  jumpUsed: boolean;
}

export interface ProjectileState {
  id: number;
  ownerSlot: 0 | 1;
  moveId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  damage: number;
  hitStun: number;
  blockStun: number;
  fluxGain: number;
  lifetime: number;
  /** Facing at spawn, for knockback direction. */
  facing: 1 | -1;
}

export type GameEvent =
  | { type: 'round_start'; round: number; tick: number }
  | { type: 'attack_started'; slot: 0 | 1; moveId: string; tick: number }
  | { type: 'hit'; attacker: 0 | 1; defender: 0 | 1; moveId: string; damage: number; tick: number }
  | { type: 'blocked'; attacker: 0 | 1; defender: 0 | 1; moveId: string; tick: number }
  | { type: 'whiff'; slot: 0 | 1; moveId: string; tick: number }
  | { type: 'projectile_spawned'; slot: 0 | 1; moveId: string; projectileId: number; tick: number }
  | { type: 'damage_dealt'; slot: 0 | 1; amount: number; remainingHp: number; tick: number }
  | { type: 'death'; slot: 0 | 1; tick: number }
  | { type: 'round_end'; round: number; winner: 0 | 1 | 'draw'; tick: number }
  | { type: 'match_end'; winner: 0 | 1 | 'draw'; tick: number }
  | { type: 'phase_change'; from: MatchPhase; to: MatchPhase; tick: number };

export interface GameState {
  /** Monotonic simulation tick (increments every step). */
  tick: number;
  seed: number;
  /** Current LCG state (Park–Miller). */
  rng: number;
  mode: 'versus' | 'training' | 'replay';
  matchPhase: MatchPhase;
  /** Frames remaining in current non-fighting phase hold. */
  phaseTimer: number;
  round: number;
  timer: number;
  fighters: [FighterState, FighterState];
  projectiles: ProjectileState[];
  events: GameEvent[];
  /** Next projectile id. */
  nextProjectileId: number;
  /** Match winner once match_end fires. */
  matchWinner: 0 | 1 | 'draw' | null;
  /** Hitstop remaining applied globally (both fighters frozen). */
  globalHitstop: number;
}

export interface CreateInitialStateOptions {
  seed: number;
  mode?: 'versus' | 'training' | 'replay';
  /** Fighter kit id for slot 0 (default nyra_vex). */
  p1Id?: string;
  /** Fighter kit id for slot 1 (default bram_kade). */
  p2Id?: string;
}
