import {
  BODY_HALF_WIDTH,
  DASH_ACTIVE_FRAMES,
  DASH_RECOVERY_FRAMES,
  DEFAULT_HITSTOP_FRAMES,
  GRAVITY,
  GROUND_Y,
  MAX_FLUX,
  MAX_ROUNDS,
  ROUND_END_FRAMES,
  ROUND_INTRO_FRAMES,
  ROUNDS_TO_WIN,
} from './constants.js';
import { findMoveByInput, getKit, getMove } from './content/fighters.js';
import { bufferHas, consumeBufferAction, normalizeActions, pushBuffer } from './input.js';
import { aabbOverlap, clamp, localBoxToWorld } from './math.js';
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
      s.phaseTimer -= 1;
      if (s.phaseTimer <= 0) {
        pushPhase(s, 'fighting');
      }
      return s;

    case 'round_end':
      ingestInputs(s, inputs);
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

  tickFighter(s, s.fighters[0], i0, inHitstop);
  tickFighter(s, s.fighters[1], i1, inHitstop);

  if (!inHitstop) {
    separateFighters(s);
    updateProjectiles(s);
    resolveMeleeHits(s);
    resolveProjectileHits(s);
    updateFacingSafe(s);
  } else {
    // Still tick projectile lifetime lightly? Freeze them during hitstop for readability.
  }

  // Timer always decrements (match clock is not cosmetic).
  s.timer = Math.max(0, s.timer - 1);

  checkRoundEnd(s);
  return s;
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

  if (onGround) {
    f.jumpUsed = false;
    if (input.down) {
      f.phase = 'crouch';
      f.vx = 0;
    } else if (input.left) {
      f.phase = 'walk';
      f.vx = -kit.base.walk;
    } else if (input.right) {
      f.phase = 'walk';
      f.vx = kit.base.walk;
    } else {
      f.phase = 'neutral';
      f.vx = 0;
    }

    const jumpBuf = bufferHas(f.inputBuffer, 'jump');
    if (jumpBuf.hit && !f.jumpUsed) {
      f.vy = kit.base.jumpVelocity;
      f.jumpUsed = true;
      f.phase = 'jump';
      f.inputBuffer = consumeBufferAction(f.inputBuffer, 'jump');
    }
  } else {
    f.phase = f.vy > 0 ? 'jump' : 'airborne';
    if (input.left) f.vx = -((kit.base.walk * 7) / 10) | 0;
    else if (input.right) f.vx = ((kit.base.walk * 7) / 10) | 0;
  }
}

function tryStartAction(s: GameState, f: FighterState, input: ActionBits): void {
  const kit = getKit(f.id);
  const onGround = f.y <= GROUND_Y;

  // Cancel into another move if currently attacking and cancel window allows — handled in advanceAttack.
  if (f.phase === 'attack') return;

  // Dash
  const dashBuf = bufferHas(f.inputBuffer, 'dash');
  if (dashBuf.hit && onGround && f.phase !== 'hitstun' && f.phase !== 'blockstun') {
    startDash(f, input);
    f.inputBuffer = consumeBufferAction(f.inputBuffer, 'dash');
    return;
  }

  // Attack intents in priority order: heavy > light > ranged > spell(ability1)
  const tryMove = (key: keyof ActionBits, inputName: string): boolean => {
    const buf = bufferHas(f.inputBuffer, key);
    if (!buf.hit) return false;
    const move = findMoveByInput(kit, inputName);
    if (!move) return false;
    const cd = f.cooldowns[move.id] ?? 0;
    if (cd > 0) return false;
    if (!onGround && inputName !== 'RANGED') return false; // greybox: grounded melee/spell
    startMove(s, f, move);
    f.inputBuffer = consumeBufferAction(f.inputBuffer, key);
    return true;
  };

  // Guard blocks starting attacks except we already returned early if only guarding —
  // allow attacks to break guard stance when pressed.
  if (tryMove('heavy', 'HEAVY')) return;
  if (tryMove('light', 'LIGHT')) return;
  if (tryMove('ranged', 'RANGED')) return;
  // ability1 maps to SPELL for greybox
  if (tryMove('ability1', 'SPELL')) return;
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
  // Check buffered attacks against cancel list
  const candidates: { key: keyof ActionBits; input: string }[] = [
    { key: 'heavy', input: 'HEAVY' },
    { key: 'light', input: 'LIGHT' },
    { key: 'ranged', input: 'RANGED' },
    { key: 'ability1', input: 'SPELL' },
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
  const proj: ProjectileState = {
    id,
    ownerSlot: f.slot,
    moveId: move.id,
    x: f.x + f.facing * 500,
    y: f.y + 900,
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
    p.x = (p.x + p.vx) | 0;
    p.y = (p.y + p.vy) | 0;
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
  const blocked = defender.guarding && defender.y === GROUND_Y && defender.phase !== 'hitstun';

  if (blocked) {
    defender.phase = 'blockstun';
    defender.stunFrames = move.onBlock.blockStun;
    defender.move = null;
    const chip = move.onBlock.chip ?? 0;
    if (chip > 0) {
      applyDamage(s, defender, chip);
    }
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

  // Hit
  applyDamage(s, defender, move.onHit.damage);
  attacker.flux = clamp(attacker.flux + move.onHit.fluxGain, 0, MAX_FLUX);
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
    damage: move.onHit.damage,
    tick: s.tick,
  });

  attacker.hitstop = DEFAULT_HITSTOP_FRAMES;
  defender.hitstop = DEFAULT_HITSTOP_FRAMES;
  s.globalHitstop = DEFAULT_HITSTOP_FRAMES;
}

function applyDamage(s: GameState, defender: FighterState, amount: number): void {
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
