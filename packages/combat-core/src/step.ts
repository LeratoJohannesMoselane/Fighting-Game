import {
  AIR_CONTROL,
  ATTACK_FRICTION,
  BODY_HALF_WIDTH,
  DASH_ACTIVE_FRAMES,
  DASH_RECOVERY_FRAMES,
  DEFAULT_HITSTOP_FRAMES,
  FLUX_ON_BLOCK,
  GRAVITY,
  GROUND_FRICTION,
  GROUND_Y,
  MAX_ROUNDS,
  MAX_STAMINA,
  ROUND_END_FRAMES,
  ROUND_INTRO_FRAMES,
  ROUNDS_TO_WIN,
  STAMINA_DASH_COST,
  STAMINA_THRESH_CRITICAL,
  ULTIMATE_FLUX_COST,
  WALK_ACCEL,
} from './constants.js';
import { findMoveByInput, getKit, getMove } from './content/fighters.js';
import {
  resolveFighterHitsOnCritters,
  resolveProjectileHitsOnCritters,
  tickCritters,
} from './critters.js';
import { bufferHas, consumeBufferAction, normalizeActions, pushBuffer } from './input.js';
import { aabbOverlap, clamp, localBoxToWorld } from './math.js';
import {
  damageDealtMultiplier,
  damageTakenMultiplier,
  fluxFromDamage,
  gainFlux,
  gainSpecialOnHit,
  getResourceProfile,
  moveSpeedMultiplier,
  registerComboHit,
  specialCostForMove,
  spendFlux,
  syncMagicAlias,
  tickResources,
  tryActivateAwakening,
  trySpendSpecial,
  trySpendStamina,
} from './resources.js';
import { cloneState } from './serialize.js';
import { clampToArena, resetRoundFighters, updateFacing } from './state.js';
import type {
  ActionBits,
  FighterState,
  GameEvent,
  GameState,
  MoveData,
  ProjectileState,
  StepInputs,
} from './types.js';

/**
 * Advance the simulation by exactly one tick.
 * Pure: returns a new state; does not mutate the input state.
 *
 * Clone strategy: deep-clone via canonical JSON at entry, then mutate the clone.
 * See ADR-0002.
 */
export function step(state: GameState, inputs: StepInputs): GameState {
  const s = cloneState(state);
  s.events = []; // per-tick event log (full history is the caller's job if needed)
  s.tick = state.tick + 1;

  switch (s.matchPhase) {
    case 'round_intro':
      ingestInputs(s, inputs);
      tickCritters(s);
      s.phaseTimer -= 1;
      if (s.phaseTimer <= 0) {
        pushPhase(s, 'fighting');
      }
      return s;

    case 'round_end':
      ingestInputs(s, inputs);
      tickCritters(s);
      s.phaseTimer -= 1;
      if (s.phaseTimer <= 0) {
        advanceAfterRoundEnd(s);
      }
      return s;

    case 'result':
    case 'rematch':
    case 'menu':
      ingestInputs(s, inputs);
      // Extension point: UI drives rematch/menu transitions later.
      return s;

    case 'fighting':
      break;
  }

  // --- Fighting tick ---
  ingestInputs(s, inputs);

  // Global hitstop (SRS §2.3): freeze movement/hit resolution presentation clocks.
  // Attack localFrame still advances so moves cannot stick past their authored duration.
  const inHitstop = s.globalHitstop > 0;
  if (inHitstop) {
    s.globalHitstop -= 1;
  }

  const i0 = s.fighters[0].inputBuffer[s.fighters[0].inputBuffer.length - 1]!;
  const i1 = s.fighters[1].inputBuffer[s.fighters[1].inputBuffer.length - 1]!;

  // Manual awakening: ULTIMATE + ABILITY2 held together (before attack consume)
  maybeAwakening(s, s.fighters[0], i0);
  maybeAwakening(s, s.fighters[1], i1);

  tickFighter(s, s.fighters[0], i0, inHitstop);
  tickFighter(s, s.fighters[1], i1, inHitstop);

  // Resource regen / combo / awakening timers (always, even in hitstop)
  tickResources(s.fighters[0], s, s.fighters[0].guarding);
  tickResources(s.fighters[1], s, s.fighters[1].guarding);
  syncMagicAlias(s.fighters[0]);
  syncMagicAlias(s.fighters[1]);

  if (!inHitstop) {
    separateFighters(s);
    updateProjectiles(s);
    resolveMeleeHits(s);
    resolveFighterHitsOnCritters(s);
    resolveProjectileHitsOnCritters(s);
    resolveProjectileHits(s);
    updateFacingSafe(s);
    tickCritters(s);
  }

  // Timer always decrements (match clock is not cosmetic).
  s.timer = Math.max(0, s.timer - 1);

  checkRoundEnd(s);
  return s;
}

function maybeAwakening(s: GameState, f: FighterState, input: ActionBits): void {
  if (input.ultimate && input.ability2) {
    tryActivateAwakening(f, s);
    // Consume so we don't also fire ult the same frame
    f.inputBuffer = consumeBufferAction(f.inputBuffer, 'ultimate');
    f.inputBuffer = consumeBufferAction(f.inputBuffer, 'ability2');
  }
}

function pushPhase(s: GameState, to: GameState['matchPhase']): void {
  const from = s.matchPhase;
  s.matchPhase = to;
  s.events.push({ type: 'phase_change', from, to, tick: s.tick });
}

function ingestInputs(s: GameState, inputs: StepInputs): void {
  const a0 = normalizeActions(inputs.p1);
  const a1 = normalizeActions(inputs.p2);
  s.fighters[0].inputBuffer = pushBuffer(s.fighters[0].inputBuffer, a0);
  s.fighters[1].inputBuffer = pushBuffer(s.fighters[1].inputBuffer, a1);
}

function tickFighter(s: GameState, f: FighterState, input: ActionBits, inHitstop: boolean): void {
  // Cooldowns always tick so moves cannot be permanently locked by hitstop.
  const cdKeys = Object.keys(f.cooldowns);
  for (let i = 0; i < cdKeys.length; i++) {
    const k = cdKeys[i]!;
    const v = f.cooldowns[k] ?? 0;
    if (v > 0) f.cooldowns[k] = v - 1;
  }

  if (f.hitstop > 0) {
    f.hitstop -= 1;
  }

  // During hitstop: advance attack frame counters only (no locomotion / new actions).
  if (inHitstop) {
    if (f.phase === 'attack' && f.move) {
      advanceAttack(s, f);
    }
    return;
  }

  // Stun / knockdown lockout
  if (f.phase === 'hitstun' || f.phase === 'blockstun') {
    f.stunFrames -= 1;
    // Knockback bleeds off on the ground so hits push you back a step
    // instead of launching a frictionless slide.
    if (f.y <= GROUND_Y && f.vx !== 0) {
      f.vx = approach(f.vx, 0, GROUND_FRICTION);
    }
    applyPhysics(f);
    if (f.stunFrames <= 0) {
      f.phase = f.y > GROUND_Y ? 'airborne' : 'neutral';
      f.stunFrames = 0;
    }
    return;
  }

  if (f.phase === 'knockdown') {
    f.knockdownTimer -= 1;
    f.vx = 0;
    if (f.knockdownTimer <= 0) {
      f.phase = 'neutral';
      f.knockdownTimer = 0;
    }
    return;
  }

  // Attack state machine
  if (f.phase === 'attack' && f.move) {
    advanceAttack(s, f);
    // Lunges (forwardImpulse) decay instead of gliding for the whole move —
    // otherwise a 48-frame super carries the fighter across the arena.
    if (f.y <= GROUND_Y && f.vx !== 0) {
      f.vx = approach(f.vx, 0, ATTACK_FRICTION);
    }
    applyPhysics(f);
    return;
  }

  // Dash
  if (f.phase === 'dash') {
    advanceDash(f);
    applyPhysics(f);
    return;
  }

  // Guard
  if (input.guard && f.y === GROUND_Y) {
    f.guarding = true;
    f.phase = 'guard';
    f.vx = 0;
    // Still allow block while buffered attacks wait
    tryStartAction(s, f, input);
    applyPhysics(f);
    return;
  }
  f.guarding = false;

  // Movement + action intent
  tryStartAction(s, f, input);

  // tryStartAction may have transitioned into attack or dash.
  if (f.move !== null || f.dashTimer > 0) {
    applyPhysics(f);
    return;
  }

  // Walk / crouch / jump / neutral
  applyLocomotion(f, input);
  applyPhysics(f);
}

function applyLocomotion(f: FighterState, input: ActionBits): void {
  const kit = getKit(f.id);
  const onGround = f.y <= GROUND_Y && f.vy <= 0;
  const speedMul = moveSpeedMultiplier(f);
  const maxWalk = ((kit.base.walk * speedMul) / 100) | 0;

  if (onGround) {
    f.jumpUsed = false;
    if (input.down) {
      f.phase = 'crouch';
      f.vx = approach(f.vx, 0, GROUND_FRICTION * 2);
    } else {
      let target = 0;
      if (input.left && !input.right) target = -maxWalk;
      else if (input.right && !input.left) target = maxWalk;

      if (target !== 0) {
        f.phase = 'walk';
        f.vx = approach(f.vx, target, WALK_ACCEL);
      } else {
        f.phase = 'neutral';
        f.vx = approach(f.vx, 0, GROUND_FRICTION);
      }
    }

    const jumpBuf = bufferHas(f.inputBuffer, 'jump');
    if (jumpBuf.hit && !f.jumpUsed && !input.down) {
      f.vy = kit.base.jumpVelocity;
      f.jumpUsed = true;
      f.phase = 'jump';
      f.vx = ((f.vx * 9) / 10) | 0;
      f.inputBuffer = consumeBufferAction(f.inputBuffer, 'jump');
    }
  } else {
    f.phase = f.vy > 0 ? 'jump' : 'airborne';
    const airTarget =
      input.left && !input.right
        ? -((maxWalk * 8) / 10) | 0
        : input.right && !input.left
          ? ((maxWalk * 8) / 10) | 0
          : f.vx;
    const accel = (WALK_ACCEL * AIR_CONTROL) | 0;
    if (input.left || input.right) {
      f.vx = approach(f.vx, airTarget, Math.max(1, accel));
    }
  }
}

/** Move current toward target by at most rate (integer). */
function approach(current: number, target: number, rate: number): number {
  if (current < target) return Math.min(current + rate, target) | 0;
  if (current > target) return Math.max(current - rate, target) | 0;
  return current | 0;
}

function tryStartAction(s: GameState, f: FighterState, input: ActionBits): void {
  const kit = getKit(f.id);
  const onGround = f.y <= GROUND_Y;

  // Cancel into another move if currently attacking and cancel window allows — handled in advanceAttack.
  if (f.phase === 'attack') return;

  // Dash (costs stamina; denied at critical/empty band effectively via trySpend)
  const dashBuf = bufferHas(f.inputBuffer, 'dash');
  if (dashBuf.hit && onGround && f.phase !== 'hitstun' && f.phase !== 'blockstun') {
    if (f.stamina < STAMINA_THRESH_CRITICAL) {
      s.events.push({
        type: 'resource_denied',
        slot: f.slot,
        resource: 'stamina',
        moveId: 'dash',
        tick: s.tick,
      });
      f.inputBuffer = consumeBufferAction(f.inputBuffer, 'dash');
    } else if (trySpendStamina(f, STAMINA_DASH_COST)) {
      startDash(f, input);
      f.inputBuffer = consumeBufferAction(f.inputBuffer, 'dash');
      return;
    } else {
      s.events.push({
        type: 'resource_denied',
        slot: f.slot,
        resource: 'stamina',
        moveId: 'dash',
        tick: s.tick,
      });
      f.inputBuffer = consumeBufferAction(f.inputBuffer, 'dash');
    }
  }

  // Attack intents: ultimate > heavy > light > ranged > spell > ability2
  const tryMove = (key: keyof ActionBits, inputName: string): boolean => {
    const buf = bufferHas(f.inputBuffer, key);
    if (!buf.hit) return false;
    const move = findMoveByInput(kit, inputName);
    if (!move) return false;
    const cd = f.cooldowns[move.id] ?? 0;
    if (cd > 0) return false;
    if (!onGround && inputName !== 'RANGED') return false;

    const denied = resourceGate(f, move);
    if (denied) {
      s.events.push({
        type: 'resource_denied',
        slot: f.slot,
        resource: denied,
        moveId: move.id,
        tick: s.tick,
      });
      f.inputBuffer = consumeBufferAction(f.inputBuffer, key);
      return false;
    }

    spendResources(f, move);
    startMove(s, f, move);
    f.inputBuffer = consumeBufferAction(f.inputBuffer, key);
    return true;
  };

  if (tryMove('ultimate', 'ULTIMATE')) return;
  if (tryMove('heavy', 'HEAVY')) return;
  if (tryMove('light', 'LIGHT')) return;
  if (tryMove('ranged', 'RANGED')) return;
  if (tryMove('ability1', 'SPELL')) return;
  if (tryMove('ability2', 'ABILITY2')) return;
}

/** Returns which resource is missing, or null if affordable. */
function resourceGate(
  f: FighterState,
  move: MoveData,
): 'stamina' | 'magic' | 'ultimate' | 'special' | 'flux' | null {
  const stam = move.staminaCost ?? 0;
  const ult =
    move.ultimateCost ?? (move.isUltimate || move.input === 'ULTIMATE' ? ULTIMATE_FLUX_COST : 0);
  const special = specialCostForMove(f, move);

  if (ult > 0 && f.flux < ult) return 'flux';
  if (stam > 0 && f.stamina < stam) return 'stamina';
  if (special > 0 && f.special < special) return 'special';
  return null;
}

function spendResources(f: FighterState, move: MoveData): void {
  const stam = move.staminaCost ?? 0;
  const ult =
    move.ultimateCost ?? (move.isUltimate || move.input === 'ULTIMATE' ? ULTIMATE_FLUX_COST : 0);
  const special = specialCostForMove(f, move);

  if (stam > 0) trySpendStamina(f, stam);
  if (ult > 0) spendFlux(f, ult);
  if (special > 0) trySpendSpecial(f, special);
  syncMagicAlias(f);
}

function startMove(s: GameState, f: FighterState, move: MoveData): void {
  const total = moveDuration(move);
  f.move = {
    moveId: move.id,
    localFrame: 0,
    totalFrames: total,
    hasHit: false,
    projectileSpawned: false,
  };
  f.phase = 'attack';
  f.guarding = false;
  f.vx = 0;
  if (move.forwardImpulse) {
    f.vx = move.forwardImpulse * f.facing;
  }
  f.hurtbox = { ...move.hurtbox };
  // Cooldown covers the whole move plus one frame so it cannot re-fire on the recovery frame.
  f.cooldowns[move.id] = total + 2;
  s.events.push({
    type: 'attack_started',
    slot: f.slot,
    moveId: move.id,
    tick: s.tick,
  });
  if (move.isUltimate || move.input === 'ULTIMATE') {
    s.events.push({
      type: 'ultimate_activated',
      slot: f.slot,
      moveId: move.id,
      tick: s.tick,
    });
    // Cinematic hitstop feel on activation
    s.globalHitstop = Math.max(s.globalHitstop, 8);
  }
}

function moveDuration(move: MoveData): number {
  // Local frames run 1..N where active is specified in the same space as startup.
  // total = activeEnd + recovery (startup is included in active start numbering).
  return move.active[1] + move.recovery;
}

function advanceAttack(s: GameState, f: FighterState): void {
  if (!f.move) {
    f.phase = 'neutral';
    return;
  }
  const kit = getKit(f.id);
  const move = getMove(kit, f.move.moveId);
  if (!move) {
    f.move = null;
    f.phase = 'neutral';
    return;
  }

  f.move.localFrame += 1;
  const lf = f.move.localFrame;

  // Spawn projectile on authored frame
  if (move.projectile && !f.move.projectileSpawned && lf === move.projectile.frame) {
    spawnProjectile(s, f, move);
    f.move.projectileSpawned = true;
  }

  // Cancel window: after first active frame if hasHit and cancelTo matches buffered input
  if (f.move.hasHit && lf >= move.active[0]) {
    tryCancel(s, f, move);
  }

  if (lf >= f.move.totalFrames) {
    // Whiff event if never hit and had melee hitboxes
    if (!f.move.hasHit && move.hitboxes.length > 0) {
      s.events.push({ type: 'whiff', slot: f.slot, moveId: move.id, tick: s.tick });
    }
    f.move = null;
    f.phase = f.y > GROUND_Y ? 'airborne' : 'neutral';
    f.hurtbox = { ...getKit(f.id).moves[0]!.hurtbox };
  }
}

function tryCancel(s: GameState, f: FighterState, current: MoveData): void {
  if (!current.cancelTo.length) return;
  const kit = getKit(f.id);
  const candidates: { key: keyof ActionBits; input: string }[] = [
    { key: 'ultimate', input: 'ULTIMATE' },
    { key: 'heavy', input: 'HEAVY' },
    { key: 'light', input: 'LIGHT' },
    { key: 'ranged', input: 'RANGED' },
    { key: 'ability1', input: 'SPELL' },
    { key: 'ability2', input: 'ABILITY2' },
  ];
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]!;
    const buf = bufferHas(f.inputBuffer, c.key);
    if (!buf.hit) continue;
    const next = findMoveByInput(kit, c.input);
    if (!next) continue;
    let allowed = false;
    for (let j = 0; j < current.cancelTo.length; j++) {
      if (current.cancelTo[j] === next.id) {
        allowed = true;
        break;
      }
    }
    if (!allowed) continue;
    const denied = resourceGate(f, next);
    if (denied) continue;
    spendResources(f, next);
    f.inputBuffer = consumeBufferAction(f.inputBuffer, c.key);
    startMove(s, f, next);
    return;
  }
}

function startDash(f: FighterState, input: ActionBits): void {
  const kit = getKit(f.id);
  let dir: 1 | -1 = f.facing;
  if (input.left && !input.right) dir = -1;
  else if (input.right && !input.left) dir = 1;
  f.phase = 'dash';
  f.dashTimer = DASH_ACTIVE_FRAMES + DASH_RECOVERY_FRAMES;
  f.dashRecovering = false;
  f.vx = kit.base.dashSpeed * dir;
  f.guarding = false;
  f.move = null;
}

function advanceDash(f: FighterState): void {
  f.dashTimer -= 1;
  const recoverStart = DASH_RECOVERY_FRAMES;
  if (f.dashTimer <= recoverStart) {
    f.dashRecovering = true;
    f.vx = 0;
  }
  if (f.dashTimer <= 0) {
    f.phase = 'neutral';
    f.dashTimer = 0;
    f.dashRecovering = false;
    f.vx = 0;
  }
}

function applyPhysics(f: FighterState): void {
  f.x = (f.x + f.vx) | 0;
  f.y = (f.y + f.vy) | 0;
  if (f.y > GROUND_Y) {
    f.vy = (f.vy - GRAVITY) | 0;
  }
  if (f.y <= GROUND_Y) {
    f.y = GROUND_Y;
    if (f.vy < 0) f.vy = 0;
    if (f.phase === 'jump' || f.phase === 'airborne') {
      f.phase = 'neutral';
      f.jumpUsed = false;
    }
  }
  clampToArena(f);
}

function separateFighters(s: GameState): void {
  const a = s.fighters[0];
  const b = s.fighters[1];
  // Full body width between centres so fighters cannot tunnel through each other.
  const minDist = BODY_HALF_WIDTH * 2;
  const dx = b.x - a.x;
  const adx = dx < 0 ? -dx : dx;
  if (adx >= minDist) return;
  // Only separate when both near the ground plane (air crosses allowed slightly).
  if (a.y > 200 || b.y > 200) return;

  const push = adx === 0 ? minDist / 2 : ((minDist - adx + 1) / 2) | 0;
  if (dx > 0 || (dx === 0 && a.slot === 0)) {
    a.x -= push;
    b.x += push;
  } else {
    a.x += push;
    b.x -= push;
  }
  // Zero closing velocity so next tick does not re-tunnel.
  if (a.vx > 0 && b.x >= a.x) a.vx = 0;
  if (a.vx < 0 && b.x <= a.x) a.vx = 0;
  if (b.vx < 0 && b.x >= a.x) b.vx = 0;
  if (b.vx > 0 && b.x <= a.x) b.vx = 0;
  clampToArena(a);
  clampToArena(b);
}

function updateFacingSafe(s: GameState): void {
  const a = s.fighters[0];
  const b = s.fighters[1];
  const lock = (f: FighterState) =>
    f.phase === 'attack' ||
    f.phase === 'hitstun' ||
    f.phase === 'blockstun' ||
    f.phase === 'dash' ||
    f.phase === 'knockdown';
  if (lock(a) || lock(b)) return;
  updateFacing(s);
}

function spawnProjectile(s: GameState, f: FighterState, move: MoveData): void {
  const def = move.projectile;
  if (!def) return;
  // Cap active projectiles from this owner+move
  const maxActive = def.maxActive ?? 3;
  let count = 0;
  for (let i = 0; i < s.projectiles.length; i++) {
    const p = s.projectiles[i]!;
    if (p.ownerSlot === f.slot && p.moveId === move.id) count++;
  }
  if (count >= maxActive) return;

  const id = s.nextProjectileId++;
  const kind = def.kind ?? (move.input === 'SPELL' ? 'orb' : 'bullet');
  const spawnY = kind === 'snake' ? f.y + 200 : kind === 'bomb' ? f.y + 1100 : f.y + 950;
  const proj: ProjectileState = {
    id,
    ownerSlot: f.slot,
    moveId: move.id,
    x: f.x + f.facing * (kind === 'snake' ? 400 : 550),
    y: spawnY,
    vx: def.speedX * f.facing,
    vy: def.speedY,
    width: def.width,
    height: def.height,
    damage: def.damage,
    hitStun: def.hitStun,
    blockStun: def.blockStun,
    fluxGain: def.fluxGain,
    lifetime: def.lifetime,
    facing: f.facing,
    kind,
    gravity: def.gravity ?? (kind === 'bomb' ? 8 : 0),
    bounce: def.bounce ?? (kind === 'bomb' ? 0.45 : 0),
    age: 0,
  };
  s.projectiles.push(proj);
  s.events.push({
    type: 'projectile_spawned',
    slot: f.slot,
    moveId: move.id,
    projectileId: id,
    tick: s.tick,
  });
}

function updateProjectiles(s: GameState): void {
  const next: ProjectileState[] = [];
  for (let i = 0; i < s.projectiles.length; i++) {
    const p = s.projectiles[i]!;
    p.age = (p.age ?? 0) + 1;

    // Snake: sine-wave vertical wriggle while crawling forward
    if (p.kind === 'snake') {
      const wriggle = (((p.age % 20) - 10) * 18) | 0;
      p.x = (p.x + p.vx) | 0;
      p.y = Math.max(GROUND_Y + 80, 200 + wriggle);
      // Keep near ground
      if (p.y < GROUND_Y + 60) p.y = GROUND_Y + 120;
    } else {
      if (p.gravity) p.vy = (p.vy - p.gravity) | 0;
      p.x = (p.x + p.vx) | 0;
      p.y = (p.y + p.vy) | 0;
      // Ground bounce for bombs
      if (p.y <= GROUND_Y + 40) {
        p.y = GROUND_Y + 40;
        if (p.bounce > 0 && p.vy < 0) {
          p.vy = (-p.vy * p.bounce) | 0;
          p.vx = ((p.vx * 85) / 100) | 0;
          if (Math.abs(p.vy) < 15) p.vy = 0;
        } else if (p.kind === 'bomb') {
          // Fuse expire soon after settling
          p.lifetime = Math.min(p.lifetime, 8);
        }
      }
    }

    p.lifetime -= 1;
    if (p.lifetime <= 0) continue;
    if (p.x < -12000 || p.x > 12000) continue;
    next.push(p);
  }
  s.projectiles = next;
}

function resolveMeleeHits(s: GameState): void {
  resolvePairMelee(s, s.fighters[0], s.fighters[1]);
  resolvePairMelee(s, s.fighters[1], s.fighters[0]);
}

function resolvePairMelee(s: GameState, attacker: FighterState, defender: FighterState): void {
  if (attacker.phase !== 'attack' || !attacker.move) return;
  if (attacker.move.hasHit) return;
  if (attacker.hitstop > 0) return;

  const kit = getKit(attacker.id);
  const move = getMove(kit, attacker.move.moveId);
  if (!move || move.hitboxes.length === 0) return;

  const lf = attacker.move.localFrame;
  if (lf < move.active[0] || lf > move.active[1]) return;

  // Active hitboxes: any def whose frame is within active window and frame <= lf
  // (greybox: use boxes whose frame is in [active.0, lf])
  let hit = false;
  for (let i = 0; i < move.hitboxes.length; i++) {
    const hb = move.hitboxes[i]!;
    if (hb.frame > lf || hb.frame < move.active[0]) continue;
    // Also allow boxes listed once to apply across whole active window
    const box = localBoxToWorld(attacker.x, attacker.y, attacker.facing, hb);
    const hurt = localBoxToWorld(defender.x, defender.y, defender.facing, defender.hurtbox);
    if (aabbOverlap(box.x, box.y, box.w, box.h, hurt.x, hurt.y, hurt.w, hurt.h)) {
      hit = true;
      break;
    }
  }

  // If no frame-specific match, try first hitbox across full active window (SRS sample style).
  if (!hit && move.hitboxes.length > 0) {
    const hb = move.hitboxes[0]!;
    const box = localBoxToWorld(attacker.x, attacker.y, attacker.facing, hb);
    const hurt = localBoxToWorld(defender.x, defender.y, defender.facing, defender.hurtbox);
    if (aabbOverlap(box.x, box.y, box.w, box.h, hurt.x, hurt.y, hurt.w, hurt.h)) {
      hit = true;
    }
  }

  if (!hit) return;

  attacker.move.hasHit = true;
  applyHitOrBlock(s, attacker, defender, move);
}

function applyHitOrBlock(
  s: GameState,
  attacker: FighterState,
  defender: FighterState,
  move: MoveData,
): void {
  let blocked = defender.guarding && defender.y === GROUND_Y && defender.phase !== 'hitstun';

  // Guard crush: empty stamina while blocking → cannot block
  if (blocked && (defender.stamina <= 0 || defender.guardCrushPending)) {
    blocked = false;
    defender.guardCrushPending = false;
    defender.guarding = false;
    s.events.push({ type: 'guard_crush', slot: defender.slot, tick: s.tick });
  }

  // Low stamina: longer blockstun
  let blockStun = move.onBlock.blockStun;
  if (defender.stamina < STAMINA_THRESH_CRITICAL) {
    blockStun += 3;
  }

  if (blocked) {
    defender.phase = 'blockstun';
    defender.stunFrames = blockStun;
    defender.move = null;
    const chip = move.onBlock.chip ?? 0;
    if (chip > 0) {
      applyDamage(s, defender, chip, attacker);
    }
    // Minimal flux for blocking
    gainFlux(defender, FLUX_ON_BLOCK, s);
    s.events.push({
      type: 'blocked',
      attacker: attacker.slot,
      defender: defender.slot,
      moveId: move.id,
      tick: s.tick,
    });
    attacker.hitstop = DEFAULT_HITSTOP_FRAMES;
    defender.hitstop = DEFAULT_HITSTOP_FRAMES;
    s.globalHitstop = DEFAULT_HITSTOP_FRAMES;
    return;
  }

  // --- Hit ---
  // Combo scaling on attacker
  let raw = move.onHit.damage;
  // Awakening damage dealt / taken
  raw = ((raw * damageDealtMultiplier(attacker)) / 100) | 0;
  raw = ((raw * damageTakenMultiplier(defender)) / 100) | 0;
  const scaled = registerComboHit(attacker, raw, move.id, s);
  applyDamage(s, defender, scaled, attacker);

  // Flux from active play (not passive)
  const dealtFlux = move.onHit.fluxGain || fluxFromDamage(scaled, 'dealt');
  gainFlux(attacker, dealtFlux, s);
  const recvFlux = move.onHit.defenderUltGain ?? fluxFromDamage(scaled, 'received');
  gainFlux(defender, recvFlux, s);

  // Special resource hooks (Bram heat builds on hit)
  {
    const p = getResourceProfile(attacker.id);
    if (p.specialGainsOnHit) gainSpecialOnHit(attacker, p.specialGainsOnHit);
  }

  // Melee restores a bit of stamina (encourage pressure)
  const isMelee = move.input === 'LIGHT' || move.input === 'HEAVY' || move.input === 'ULTIMATE';
  if (isMelee) {
    const stamGain = move.onHit.staminaGain ?? (move.input === 'HEAVY' ? 8 : 5);
    attacker.stamina = clamp(attacker.stamina + stamGain, 0, MAX_STAMINA);
    defender.stamina = clamp(defender.stamina + 2, 0, MAX_STAMINA);
  }

  defender.phase = 'hitstun';
  defender.stunFrames = move.onHit.hitStun;
  defender.move = null;
  defender.guarding = false;
  const kbX = move.onHit.knockbackX ?? 100;
  const kbY = move.onHit.knockbackY ?? 0;
  defender.vx = kbX * attacker.facing;
  defender.vy = kbY;

  s.events.push({
    type: 'hit',
    attacker: attacker.slot,
    defender: defender.slot,
    moveId: move.id,
    damage: scaled,
    tick: s.tick,
  });

  const stop = move.isUltimate || move.input === 'ULTIMATE' ? 12 : DEFAULT_HITSTOP_FRAMES;
  attacker.hitstop = stop;
  defender.hitstop = stop;
  s.globalHitstop = stop;

  syncMagicAlias(attacker);
  syncMagicAlias(defender);
}

function applyDamage(
  s: GameState,
  defender: FighterState,
  amount: number,
  _attacker?: FighterState,
): void {
  void _attacker;
  defender.hp = clamp(defender.hp - amount, 0, defender.hp);
  s.events.push({
    type: 'damage_dealt',
    slot: defender.slot,
    amount,
    remainingHp: defender.hp,
    tick: s.tick,
  });
  if (defender.hp <= 0) {
    s.events.push({ type: 'death', slot: defender.slot, tick: s.tick });
  }
}

function resolveProjectileHits(s: GameState): void {
  const remaining: ProjectileState[] = [];
  for (let i = 0; i < s.projectiles.length; i++) {
    const p = s.projectiles[i]!;
    const defender = s.fighters[p.ownerSlot === 0 ? 1 : 0];
    const hurt = localBoxToWorld(defender.x, defender.y, defender.facing, defender.hurtbox);
    const px = p.x - ((p.width / 2) | 0);
    const py = p.y - ((p.height / 2) | 0);
    if (aabbOverlap(px, py, p.width, p.height, hurt.x, hurt.y, hurt.w, hurt.h)) {
      const attacker = s.fighters[p.ownerSlot];
      const fakeMove: MoveData = {
        id: p.moveId,
        input: 'RANGED',
        startup: 0,
        active: [0, 0],
        recovery: 0,
        hitboxes: [],
        hurtbox: defender.hurtbox,
        onHit: {
          damage: p.damage,
          hitStun: p.hitStun,
          fluxGain: p.fluxGain,
          knockbackX: 80,
        },
        onBlock: { blockStun: p.blockStun, advantage: -2 },
        cancelTo: [],
      };
      applyHitOrBlock(s, attacker, defender, fakeMove);
      // projectile consumed
      continue;
    }
    remaining.push(p);
  }
  s.projectiles = remaining;
}

function checkRoundEnd(s: GameState): void {
  const p1 = s.fighters[0];
  const p2 = s.fighters[1];
  const dead1 = p1.hp <= 0;
  const dead2 = p2.hp <= 0;
  const timeout = s.timer <= 0;

  if (!dead1 && !dead2 && !timeout) return;

  let winner: 0 | 1 | 'draw';
  if (dead1 && dead2) winner = 'draw';
  else if (dead1) winner = 1;
  else if (dead2) winner = 0;
  else {
    // Timeout: higher HP wins
    if (p1.hp > p2.hp) winner = 0;
    else if (p2.hp > p1.hp) winner = 1;
    else winner = 'draw';
  }

  if (winner === 0) p1.wins += 1;
  else if (winner === 1) p2.wins += 1;

  s.events.push({ type: 'round_end', round: s.round, winner, tick: s.tick });
  pushPhase(s, 'round_end');
  s.phaseTimer = ROUND_END_FRAMES;
}

function advanceAfterRoundEnd(s: GameState): void {
  const p1 = s.fighters[0];
  const p2 = s.fighters[1];

  if (p1.wins >= ROUNDS_TO_WIN || p2.wins >= ROUNDS_TO_WIN || s.round >= MAX_ROUNDS) {
    let mw: 0 | 1 | 'draw';
    if (p1.wins > p2.wins) mw = 0;
    else if (p2.wins > p1.wins) mw = 1;
    else mw = 'draw';
    s.matchWinner = mw;
    s.events.push({ type: 'match_end', winner: mw, tick: s.tick });
    pushPhase(s, 'result');
    s.phaseTimer = 0;
    return;
  }

  // Next round
  s.round += 1;
  resetRoundFighters(s);
  pushPhase(s, 'round_intro');
  s.phaseTimer = ROUND_INTRO_FRAMES;
  s.events.push({ type: 'round_start', round: s.round, tick: s.tick });
}

/** Helper for tests: run N ticks with constant inputs. */
export function stepN(state: GameState, inputs: StepInputs, n: number): GameState {
  let s = state;
  for (let i = 0; i < n; i++) {
    s = step(s, inputs);
  }
  return s;
}

/** Collect events across steps by appending (test helper pattern). */
export function drainEvents(events: GameEvent[]): GameEvent[] {
  return events.slice();
}
