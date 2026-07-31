/**
 * Public types for CombatCore v0.
 * Spatial quantities are fixed-point integers (× FP_SCALE).
 * Resources: hp, stamina, magic, ultimate (0–100 bars unless noted).
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
  /**
   * Ultimate meter gained by the attacker on hit (anime super gauge).
   * Legacy field name `fluxGain` kept for content compatibility.
   */
  fluxGain: number;
  /** Stamina restored to attacker on melee hit (guns restore 0). */
  staminaGain?: number;
  /** Magic restored to attacker on melee hit. */
  magicGain?: number;
  /** Ultimate gained by defender when struck (comeback spark). */
  defenderUltGain?: number;
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
  /** Stamina required to start this move (guns/dash). */
  staminaCost?: number;
  /** Magic required to start this move (guns/spells/ult) — legacy soft gate. */
  magicCost?: number;
  /** Special resource cost (ammo/charges). */
  specialCost?: number;
  /** Flux required (100 = full super). */
  ultimateCost?: number;
  /** @deprecated Prefer magicCost / ultimateCost. */
  fluxCost?: number;
  /** True for anime super — camera lock presentation hook. */
  isUltimate?: boolean;
  /** Reserved. */
  invulnFrames?: readonly [number, number];
  /** Movement impulse applied once on startup (fp). */
  forwardImpulse?: number;
}

export type ProjectileKind = 'bullet' | 'bomb' | 'snake' | 'orb';

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
  /** Visual / behavior archetype for presentation. */
  kind?: ProjectileKind;
  /** Gravity applied per tick (fp) — bombs arc. */
  gravity?: number;
  /** Bounce factor 0–1 when hitting ground. */
  bounce?: number;
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
  /** Max HP snapshot at round start (for awakening HP%). */
  maxHp: number;
  /**
   * Stamina (0–MAX_STAMINA). Block, dash, and some mobility spend it.
   */
  stamina: number;
  /** Fractional stamina drain accumulator (milli-points). */
  staminaMilli: number;
  /** Ticks before stamina regen resumes. */
  staminaRegenDelay: number;
  /** Next block while stamina empty → guard crush. */
  guardCrushPending: boolean;
  /**
   * Magic (0–MAX_MAGIC) — HUD alias derived from special resource for legacy bars.
   */
  magic: number;
  /**
   * Flux meter (0–100). Builds from active play; spends on ultimate (100) or awakening (50).
   * Alias: `ultimate` kept in sync for older call sites.
   */
  flux: number;
  /** @deprecated Prefer `flux` — kept in sync. */
  ultimate: number;
  /**
   * Character special resource (ammo / heat / prism charges / energy).
   */
  special: number;
  specialMax: number;
  specialRegenDelay: number;
  specialRegenTimer: number;
  /** Combo system */
  comboCount: number;
  comboTimer: number;
  comboMoves: string[];
  /** Awakening comeback mode */
  awakened: boolean;
  awakeningTimer: number;
  awakeningUsedThisRound: boolean;
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
  kind: ProjectileKind;
  gravity: number;
  bounce: number;
  /** Age in ticks since spawn (for animation). */
  age: number;
}

/** Lifecycle state of an arena critter. */
export type CritterPhase = 'idle' | 'approaching' | 'attacking' | 'fleeing' | 'dead';

/**
 * A single live critter. Positions are fixed-point like fighters, and every
 * field is plain data so the state stays JSON-canonicalisable (ADR-0002).
 */
export interface CritterState {
  id: number;
  archetypeId: string;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  vx: number;
  facing: 1 | -1;
  state: CritterPhase;
  /** Fighter currently hunted, or null while wandering. */
  targetSlot: 0 | 1 | null;
  attackCooldown: number;
  /** Frames left in the strike telegraph (0 = not winding up). */
  windup: number;
  fleeTimer: number;
  /** Frames of hurt flash left (presentation). */
  hurtFlash: number;
  /** Ticks alive. */
  age: number;
  /** Deterministic per-critter phase offset for idle motion. */
  seedOffset: number;
  /**
   * Invulnerability frames after taking a hit. Stops a single active window
   * from shredding a critter frame-by-frame, and gives knockback room to read.
   */
  invuln: number;
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
  | { type: 'ultimate_ready'; slot: 0 | 1; tick: number }
  | { type: 'ultimate_activated'; slot: 0 | 1; moveId: string; tick: number }
  | {
      type: 'resource_denied';
      slot: 0 | 1;
      resource: 'stamina' | 'magic' | 'ultimate' | 'special' | 'flux';
      moveId: string;
      tick: number;
    }
  | { type: 'awakening_activated'; slot: 0 | 1; duration: number; tick: number }
  | { type: 'awakening_deactivated'; slot: 0 | 1; tick: number }
  | {
      type: 'combo_update';
      slot: 0 | 1;
      count: number;
      damage: number;
      scaling: number;
      callout: string;
      tick: number;
    }
  | { type: 'combo_ended'; slot: 0 | 1; count: number; tick: number }
  | { type: 'guard_crush'; slot: 0 | 1; tick: number }
  | { type: 'round_end'; round: number; winner: 0 | 1 | 'draw'; tick: number }
  | { type: 'match_end'; winner: 0 | 1 | 'draw'; tick: number }
  | { type: 'phase_change'; from: MatchPhase; to: MatchPhase; tick: number }
  // --- arena critters ---
  | {
      type: 'critter_hit';
      critterId: number;
      slot: 0 | 1;
      damage: number;
      blocked: boolean;
      tick: number;
    }
  | { type: 'critter_whiff'; critterId: number; tick: number }
  | {
      type: 'critter_damaged';
      critterId: number;
      slot: 0 | 1;
      amount: number;
      remainingHp: number;
      tick: number;
    }
  | {
      type: 'critter_defeated';
      critterId: number;
      archetypeId: string;
      slot: 0 | 1;
      x: number;
      y: number;
      tick: number;
    };

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
  /** Live arena critters (empty unless the match enabled them). */
  critters: CritterState[];
  /** Next critter id. */
  nextCritterId: number;
  /** Ticks until the next spawn attempt. */
  critterSpawnTimer: number;
  /** Master switch — off keeps the simulation byte-identical to a critter-free match. */
  crittersEnabled: boolean;
}

export interface CreateInitialStateOptions {
  seed: number;
  mode?: 'versus' | 'training' | 'replay';
  /** Fighter kit id for slot 0 (default nyra_vex). */
  p1Id?: string;
  /** Fighter kit id for slot 1 (default bram_kade). */
  p2Id?: string;
  /** Spawn arena critters during the match (default false). */
  critters?: boolean;
}
