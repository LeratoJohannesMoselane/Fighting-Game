/**
 * Critter simulation — ambient wildlife that hunts the fighters.
 *
 * Runs inside CombatCore so it is part of the deterministic contract
 * (ADR-0002): every random choice comes from the state's Park–Miller LCG,
 * never `Math.random`, and every quantity is a fixed-point integer.
 *
 * The system is **opt-in**: `state.critters` stays empty unless the match was
 * created with `critters: true`, so existing replays and hashes are unaffected.
 */

import {
  ARENA_HALF_WIDTH,
  CRITTER_ATTACK_WINDUP,
  CRITTER_CONTACT_DAMAGE_MULT,
  CRITTER_DESPAWN_TICKS,
  CRITTER_FLEE_TICKS,
  CRITTER_HITSTOP,
  CRITTER_INVULN_TICKS,
  CRITTER_MAX_ACTIVE,
  CRITTER_SPAWN_COOLDOWN,
  CRITTER_SPAWN_MARGIN,
  GROUND_Y,
  MAX_STAMINA,
} from './constants.js';
import {
  CRITTER_ARCHETYPES,
  CRITTER_TOTAL_WEIGHT,
  getCritterArchetype,
} from './content/critters.js';
import { getKit, getMove } from './content/fighters.js';
import { aabbOverlap, clamp, iabs, lcgInt, localBoxToWorld } from './math.js';
import { gainFlux } from './resources.js';
import type { CritterState, FighterState, GameState } from './types.js';

/** Deterministic integer in [0, max) drawn from — and advancing — game rng. */
function roll(s: GameState, max: number): number {
  const [next, v] = lcgInt(s.rng, max);
  s.rng = next;
  return v;
}

/** Pick an archetype by spawn weight using the seeded stream. */
function pickArchetype(s: GameState): string {
  let ticket = roll(s, CRITTER_TOTAL_WEIGHT);
  for (let i = 0; i < CRITTER_ARCHETYPES.length; i++) {
    const c = CRITTER_ARCHETYPES[i]!;
    ticket -= c.spawnWeight;
    if (ticket < 0) return c.id;
  }
  return CRITTER_ARCHETYPES[0]!.id;
}

/** Advance the whole critter layer by one tick. */
export function tickCritters(s: GameState): void {
  if (!s.crittersEnabled) return;

  // Wildlife scatters during intros, KOs and results.
  if (s.matchPhase !== 'fighting') {
    for (let i = 0; i < s.critters.length; i++) {
      const c = s.critters[i]!;
      c.state = 'fleeing';
      c.fleeTimer = CRITTER_FLEE_TICKS;
    }
  }

  maybeSpawn(s);

  const survivors: CritterState[] = [];
  for (let i = 0; i < s.critters.length; i++) {
    const c = s.critters[i]!;
    tickCritter(s, c);
    if (c.hp > 0 && c.state !== 'dead' && c.age < CRITTER_DESPAWN_TICKS) {
      survivors.push(c);
    } else if (c.hp > 0 && c.age >= CRITTER_DESPAWN_TICKS && iabs(c.x) < ARENA_HALF_WIDTH) {
      // Overstayed its welcome: walk off rather than pop out of existence.
      c.state = 'fleeing';
      c.fleeTimer = CRITTER_FLEE_TICKS;
      survivors.push(c);
    }
  }
  s.critters = survivors;
}

function maybeSpawn(s: GameState): void {
  if (s.matchPhase !== 'fighting') return;
  if (s.critterSpawnTimer > 0) {
    s.critterSpawnTimer -= 1;
    return;
  }
  if (s.critters.length >= CRITTER_MAX_ACTIVE) return;

  const archId = pickArchetype(s);
  const arch = getCritterArchetype(archId);

  // Enter from whichever edge is further from the action so a critter never
  // materialises on top of a fighter mid-combo.
  const midX = ((s.fighters[0].x + s.fighters[1].x) / 2) | 0;
  const fromLeft = midX > 0 ? true : midX < 0 ? false : roll(s, 2) === 0;
  const edge = ARENA_HALF_WIDTH + CRITTER_SPAWN_MARGIN;

  s.critters.push({
    id: s.nextCritterId++,
    archetypeId: archId,
    hp: arch.hp,
    maxHp: arch.hp,
    x: fromLeft ? -edge : edge,
    y: arch.hoverY,
    vx: 0,
    facing: fromLeft ? 1 : -1,
    state: 'approaching',
    targetSlot: null,
    attackCooldown: 0,
    windup: 0,
    fleeTimer: 0,
    hurtFlash: 0,
    age: 0,
    invuln: 0,
    /** Per-critter phase offset keeps hover/wander from marching in lockstep. */
    seedOffset: roll(s, 360),
  });

  s.critterSpawnTimer = CRITTER_SPAWN_COOLDOWN;
}

function tickCritter(s: GameState, c: CritterState): void {
  const arch = getCritterArchetype(c.archetypeId);
  c.age += 1;
  if (c.attackCooldown > 0) c.attackCooldown -= 1;
  if (c.hurtFlash > 0) c.hurtFlash -= 1;
  if (c.invuln > 0) c.invuln -= 1;

  if (c.state === 'fleeing') {
    fleeStep(s, c, arch.speed);
    return;
  }

  const target = nearestFighter(s, c, arch.aggroRange);
  c.targetSlot = target ? target.slot : null;

  if (!target) {
    wanderStep(s, c, arch.speed);
    return;
  }

  const dx = target.x - c.x;
  const dist = iabs(dx);
  c.facing = dx >= 0 ? 1 : -1;

  // Committed strike: wind up, then land the blow.
  if (c.windup > 0) {
    c.windup -= 1;
    c.vx = 0;
    if (c.windup === 0) {
      resolveCritterStrike(s, c, arch.damage, arch.attackRange);
    }
    applyCritterPhysics(c, arch.hoverY);
    return;
  }

  if (dist <= arch.attackRange && c.attackCooldown <= 0) {
    c.state = 'attacking';
    c.windup = CRITTER_ATTACK_WINDUP;
    c.vx = 0;
    applyCritterPhysics(c, arch.hoverY);
    return;
  }

  switch (arch.behavior) {
    case 'chase':
      c.state = 'approaching';
      c.vx = c.facing * arch.speed;
      break;

    case 'skitter': {
      // Darts in bursts with brief pauses — hard to read, easy to punish.
      const beat = (c.age + c.seedOffset) % 40;
      c.state = 'approaching';
      c.vx = beat < 26 ? c.facing * arch.speed : 0;
      break;
    }

    case 'stalk': {
      // Hold at the edge of its reach, then dive in.
      const standoff = (arch.attackRange * 3) / 2;
      c.state = 'approaching';
      if (dist > standoff) {
        c.vx = c.facing * arch.speed;
      } else if (dist < arch.attackRange) {
        c.vx = -c.facing * ((arch.speed * 3) / 5);
      } else {
        const orbit = (c.age + c.seedOffset) % 90 < 45 ? 1 : -1;
        c.vx = ((orbit * arch.speed) / 2) | 0;
      }
      break;
    }

    case 'drift':
    default: {
      // Floats to its firing distance and hovers there.
      c.state = 'approaching';
      const hold = (arch.attackRange * 4) / 5;
      if (dist > hold) c.vx = ((c.facing * arch.speed * 4) / 5) | 0;
      else c.vx = ((-c.facing * arch.speed) / 3) | 0;
      break;
    }
  }

  applyCritterPhysics(c, arch.hoverY);
}

function fleeStep(s: GameState, c: CritterState, speed: number): void {
  if (c.fleeTimer > 0) c.fleeTimer -= 1;
  // Run for whichever exit is closer.
  const dir: 1 | -1 = c.x >= 0 ? 1 : -1;
  c.facing = dir;
  c.vx = dir * ((speed * 9) / 5);
  c.x = (c.x + c.vx) | 0;
  const gone = ARENA_HALF_WIDTH + CRITTER_SPAWN_MARGIN;
  if (c.x > gone || c.x < -gone) c.state = 'dead';
  void s;
}

function wanderStep(s: GameState, c: CritterState, speed: number): void {
  c.state = 'idle';
  // Slow sinusoidal amble derived from tick + per-critter offset (no rng churn).
  const phase = (c.age + c.seedOffset) % 240;
  const dir = phase < 120 ? 1 : -1;
  c.vx = ((dir * speed) / 3) | 0;
  c.facing = c.vx >= 0 ? 1 : -1;
  const arch = getCritterArchetype(c.archetypeId);
  applyCritterPhysics(c, arch.hoverY);
  void s;
}

function applyCritterPhysics(c: CritterState, hoverY: number): void {
  c.x = (c.x + c.vx) | 0;
  // Hovering critters bob; ground critters stay planted.
  if (hoverY > 0) {
    const bob = (((c.age + c.seedOffset) % 120) - 60) * 2;
    c.y = hoverY + bob;
  } else {
    c.y = GROUND_Y;
  }
  const edge = ARENA_HALF_WIDTH + CRITTER_SPAWN_MARGIN;
  c.x = clamp(c.x, -edge, edge);
}

function nearestFighter(s: GameState, c: CritterState, aggroRange: number): FighterState | null {
  let best: FighterState | null = null;
  let bestDist = aggroRange;
  for (let i = 0; i < s.fighters.length; i++) {
    const f = s.fighters[i]!;
    if (f.hp <= 0) continue;
    const d = iabs(f.x - c.x);
    if (d <= bestDist) {
      bestDist = d;
      best = f;
    }
  }
  return best;
}

/** Land (or whiff) a critter's strike on its target. */
function resolveCritterStrike(s: GameState, c: CritterState, damage: number, range: number): void {
  const arch = getCritterArchetype(c.archetypeId);
  c.attackCooldown = arch.attackCooldown;
  c.state = 'approaching';

  const slot = c.targetSlot;
  if (slot === null) return;
  const f = s.fighters[slot]!;
  if (f.hp <= 0) return;

  // Target may have moved out of reach during the windup — that's the tell.
  if (iabs(f.x - c.x) > range + 200) {
    s.events.push({ type: 'critter_whiff', critterId: c.id, tick: s.tick });
    return;
  }

  // Guarding in the critter's direction halves the bite and costs no stun.
  const facingCritter = (c.x - f.x) * f.facing >= 0;
  const blocked = f.guarding && f.y <= GROUND_Y && facingCritter;
  const dealt = blocked ? Math.max(1, (damage / 4) | 0) : damage;

  f.hp = clamp(f.hp - dealt, 0, f.hp);
  s.events.push({
    type: 'critter_hit',
    critterId: c.id,
    slot: f.slot,
    damage: dealt,
    blocked,
    tick: s.tick,
  });
  s.events.push({
    type: 'damage_dealt',
    slot: f.slot,
    amount: dealt,
    remainingHp: f.hp,
    tick: s.tick,
  });

  if (!blocked) {
    // A real interrupt: brief stun + knockback away from the critter.
    f.phase = 'hitstun';
    f.stunFrames = Math.max(f.stunFrames, 12);
    f.move = null;
    f.guarding = false;
    f.vx = c.facing * 70;
    f.hitstop = Math.max(f.hitstop, CRITTER_HITSTOP);
    s.globalHitstop = Math.max(s.globalHitstop, CRITTER_HITSTOP);
  }

  if (f.hp <= 0) {
    s.events.push({ type: 'death', slot: f.slot, tick: s.tick });
  }
}

/**
 * Fighters' active hitboxes damage critters.
 * Called from `step` after melee resolution so a swing hits both a rival
 * fighter and any critter sharing the space.
 */
export function resolveFighterHitsOnCritters(s: GameState): void {
  if (!s.crittersEnabled || s.critters.length === 0) return;

  for (let i = 0; i < s.fighters.length; i++) {
    const f = s.fighters[i]!;
    if (f.phase !== 'attack' || !f.move) continue;
    const kit = getKit(f.id);
    const move = getMove(kit, f.move.moveId);
    if (!move || move.hitboxes.length === 0) continue;

    const lf = f.move.localFrame;
    if (lf < move.active[0] || lf > move.active[1]) continue;

    const hb = move.hitboxes[0]!;
    const box = localBoxToWorld(f.x, f.y, f.facing, hb);

    for (let j = 0; j < s.critters.length; j++) {
      const c = s.critters[j]!;
      if (c.hp <= 0 || c.state === 'dead' || c.invuln > 0) continue;

      const arch = getCritterArchetype(c.archetypeId);
      const cx = c.x - arch.radius;
      const cy = c.y;
      const size = arch.radius * 2;
      if (!aabbOverlap(box.x, box.y, box.w, box.h, cx, cy, size, size)) continue;

      damageCritter(s, c, f, ((move.onHit.damage * CRITTER_CONTACT_DAMAGE_MULT) / 100) | 0);
    }
  }
}

/** Projectiles also hurt critters — checked from `step`'s projectile pass. */
export function resolveProjectileHitsOnCritters(s: GameState): void {
  if (!s.crittersEnabled || s.critters.length === 0) return;

  const surviving = [];
  for (let i = 0; i < s.projectiles.length; i++) {
    const p = s.projectiles[i]!;
    let consumed = false;
    for (let j = 0; j < s.critters.length; j++) {
      const c = s.critters[j]!;
      if (c.hp <= 0 || c.state === 'dead' || c.invuln > 0) continue;
      const arch = getCritterArchetype(c.archetypeId);
      const px = p.x - ((p.width / 2) | 0);
      const py = p.y - ((p.height / 2) | 0);
      if (
        !aabbOverlap(
          px,
          py,
          p.width,
          p.height,
          c.x - arch.radius,
          c.y,
          arch.radius * 2,
          arch.radius * 2,
        )
      ) {
        continue;
      }
      damageCritter(s, c, s.fighters[p.ownerSlot]!, p.damage);
      consumed = true;
      break;
    }
    if (!consumed) surviving.push(p);
  }
  s.projectiles = surviving;
}

function damageCritter(
  s: GameState,
  c: CritterState,
  attacker: FighterState,
  amount: number,
): void {
  const arch = getCritterArchetype(c.archetypeId);
  c.hp = clamp(c.hp - amount, 0, c.hp);
  c.hurtFlash = 8;
  c.invuln = CRITTER_INVULN_TICKS;
  // A struck critter drops whatever it was winding up.
  c.windup = 0;
  // Knocked back a step so chip-away feels physical.
  c.x = (c.x + attacker.facing * 120) | 0;

  s.events.push({
    type: 'critter_damaged',
    critterId: c.id,
    slot: attacker.slot,
    amount,
    remainingHp: c.hp,
    tick: s.tick,
  });

  if (c.hp <= 0) {
    c.state = 'dead';
    // Bounty: killing wildlife feeds your meters — it's worth the detour.
    gainFlux(attacker, arch.bounty.flux, s);
    attacker.stamina = clamp(attacker.stamina + arch.bounty.stamina, 0, MAX_STAMINA);
    s.events.push({
      type: 'critter_defeated',
      critterId: c.id,
      archetypeId: c.archetypeId,
      slot: attacker.slot,
      x: c.x,
      y: c.y,
      tick: s.tick,
    });
    return;
  }

  if (arch.fleeHpPct > 0 && (c.hp * 100) / c.maxHp <= arch.fleeHpPct) {
    c.state = 'fleeing';
    c.fleeTimer = CRITTER_FLEE_TICKS;
  }
}
