/**
 * Simple reactive CPU opponent (presentation-side).
 * Reads GameState and emits ActionBits — does not live inside CombatCore.
 */

import {
  emptyActions,
  type ActionBits,
  type FighterState,
  type GameState,
} from '@aether-break/combat-core';

export type CpuDifficulty = 'easy' | 'normal' | 'hard';

interface DiffTuning {
  reaction: number;
  errorRate: number;
  aggression: number;
  blockChance: number;
  jumpChance: number;
  rangedBias: number;
}

const TUNING: Record<CpuDifficulty, DiffTuning> = {
  easy: {
    reaction: 14,
    errorRate: 0.32,
    aggression: 0.35,
    blockChance: 0.2,
    jumpChance: 0.08,
    rangedBias: 0.15,
  },
  normal: {
    reaction: 7,
    errorRate: 0.14,
    aggression: 0.55,
    blockChance: 0.45,
    jumpChance: 0.12,
    rangedBias: 0.22,
  },
  hard: {
    reaction: 3,
    errorRate: 0.05,
    aggression: 0.72,
    blockChance: 0.7,
    jumpChance: 0.16,
    rangedBias: 0.28,
  },
};

export class CpuController {
  private readonly difficulty: CpuDifficulty;
  private readonly slot: 0 | 1;
  private cooldown = 0;
  private holdGuard = 0;
  private plan: ActionBits = emptyActions();
  private planTtl = 0;
  private rng: number;

  constructor(slot: 0 | 1, difficulty: CpuDifficulty = 'normal', seed = 1) {
    this.slot = slot;
    this.difficulty = difficulty;
    this.rng = seed <= 0 ? 1 : seed;
  }

  /** Advance internal LCG (deterministic per match seed). */
  private next(): number {
    this.rng = Math.imul(16807, this.rng) % 2147483647 | 0;
    if (this.rng <= 0) this.rng += 2147483647;
    return (this.rng % 10000) / 10000;
  }

  think(state: GameState): ActionBits {
    if (state.matchPhase !== 'fighting') {
      this.plan = emptyActions();
      this.planTtl = 0;
      return emptyActions();
    }

    const me = state.fighters[this.slot];
    const foe = state.fighters[this.slot === 0 ? 1 : 0];
    const t = TUNING[this.difficulty];

    if (this.cooldown > 0) this.cooldown -= 1;
    if (this.holdGuard > 0) this.holdGuard -= 1;
    if (this.planTtl > 0) {
      this.planTtl -= 1;
      // Still allow emergency block override
      const emergency = this.emergencyBlock(me, foe, state, t);
      if (emergency) return emergency;
      return { ...this.plan };
    }

    if (this.cooldown > 0) {
      return this.holdGuard > 0 ? { ...emptyActions(), guard: true } : emptyActions();
    }

    // Reaction delay: sometimes freeze a beat
    if (this.next() < t.reaction / 60) {
      this.cooldown = 1 + ((this.next() * 3) | 0);
      return emptyActions();
    }

    // Random error: do something dumb
    if (this.next() < t.errorRate) {
      return this.randomFlail(me, foe);
    }

    const dist = foe.x - me.x;
    const adist = dist < 0 ? -dist : dist;
    const towardRight = dist > 0;
    const actions = emptyActions();

    // Incoming projectile?
    const threatProj = this.incomingProjectile(state, me);
    if (threatProj && this.next() < t.blockChance + 0.15) {
      actions.guard = true;
      this.holdGuard = 8 + ((this.next() * 10) | 0);
      this.plan = actions;
      this.planTtl = this.holdGuard;
      return actions;
    }

    // Foe attacking close → block
    if (foe.phase === 'attack' && adist < 2200 && this.next() < t.blockChance) {
      actions.guard = true;
      this.holdGuard = 10;
      this.plan = actions;
      this.planTtl = 10;
      return actions;
    }

    // Airborne foe → sometimes wait / light
    if (foe.y > 200 && adist < 2500 && this.next() < 0.4) {
      this.faceToward(actions, towardRight);
      if (adist < 1600) actions.light = true;
      this.commit(actions, 6);
      return actions;
    }

    // Spacing logic
    if (adist > 4200) {
      // Approach + occasional gun
      this.faceToward(actions, towardRight);
      if (this.next() < t.rangedBias) {
        actions.ranged = true;
        this.commit(actions, 4);
      } else if (this.next() < 0.2) {
        actions.dash = true;
        this.faceToward(actions, towardRight);
        this.commit(actions, 3);
      } else {
        this.commit(actions, 8 + ((this.next() * 10) | 0));
      }
      return actions;
    }

    if (adist > 2000) {
      // Mid — mix approach, bolt, spell (skip guns if drained)
      this.faceToward(actions, towardRight);
      const r = this.next();
      const canGun = (me.stamina ?? 0) >= 18 && (me.magic ?? 0) >= 12;
      const canSpell = (me.magic ?? 0) >= 28;
      if (canGun && r < t.rangedBias) actions.ranged = true;
      else if (canSpell && r < t.rangedBias + 0.18) actions.ability1 = true;
      else if (r < t.aggression) {
        /* walk in */
      } else if (r < t.aggression + 0.12 && me.y === 0) {
        actions.jump = true;
      } else {
        this.faceToward(actions, !towardRight);
      }
      this.commit(actions, 5 + ((this.next() * 8) | 0));
      return actions;
    }

    // Full Awakening — fire ultimate when ready and in range
    const ult = me.ultimate ?? me.flux ?? 0;
    if (ult >= 100 && adist < 2800 && me.magic >= 30 && this.next() < 0.55 + t.aggression * 0.3) {
      actions.ultimate = true;
      this.faceToward(actions, towardRight);
      this.commit(actions, 4);
      return actions;
    }

    // Low resources — prefer melee to refill instead of gun spam
    const lowGas = (me.stamina ?? 0) < 25 || (me.magic ?? 0) < 20;

    // Close range
    this.faceToward(actions, towardRight);
    if (me.phase === 'hitstun' || me.phase === 'blockstun') {
      return emptyActions();
    }

    const r = this.next();
    if (r < 0.12 && this.next() < t.blockChance) {
      actions.guard = true;
      this.holdGuard = 6;
    } else if (r < 0.12 + t.jumpChance && me.y === 0) {
      actions.jump = true;
      if (this.next() < 0.5) this.faceToward(actions, towardRight);
    } else if (lowGas || r < 0.45 * t.aggression + 0.3) {
      actions.light = true;
    } else if (r < 0.45 * t.aggression + 0.48) {
      actions.heavy = true;
    } else if (!lowGas && r < 0.45 * t.aggression + 0.6) {
      actions.ability1 = true;
    } else if (!lowGas && r < 0.85) {
      actions.dash = true;
      if (this.next() < 0.35) this.faceToward(actions, towardRight);
      else this.faceToward(actions, !towardRight);
    } else {
      this.faceToward(actions, !towardRight);
    }

    this.commit(actions, 4 + ((this.next() * 6) | 0));
    return actions;
  }

  private commit(actions: ActionBits, ttl: number): void {
    this.plan = { ...actions };
    this.planTtl = ttl;
    this.cooldown = 2;
  }

  private faceToward(a: ActionBits, right: boolean): void {
    if (right) {
      a.right = true;
      a.left = false;
    } else {
      a.left = true;
      a.right = false;
    }
  }

  private emergencyBlock(
    me: FighterState,
    foe: FighterState,
    state: GameState,
    t: DiffTuning,
  ): ActionBits | null {
    if (me.phase === 'attack' || me.phase === 'hitstun') return null;
    if (foe.phase === 'attack' && Math.abs(foe.x - me.x) < 1800 && this.next() < t.blockChance) {
      return { ...emptyActions(), guard: true };
    }
    if (this.incomingProjectile(state, me) && this.next() < t.blockChance) {
      return { ...emptyActions(), guard: true };
    }
    return null;
  }

  private incomingProjectile(state: GameState, me: FighterState): boolean {
    for (const p of state.projectiles) {
      if (p.ownerSlot === me.slot) continue;
      const closing =
        (p.vx > 0 && p.x < me.x && me.x - p.x < 3500) ||
        (p.vx < 0 && p.x > me.x && p.x - me.x < 3500);
      if (closing) return true;
    }
    return false;
  }

  private randomFlail(me: FighterState, foe: FighterState): ActionBits {
    const a = emptyActions();
    const r = this.next();
    if (r < 0.25) a.left = true;
    else if (r < 0.5) a.right = true;
    else if (r < 0.65) a.jump = true;
    else if (r < 0.8) a.light = true;
    else a.ranged = true;
    void me;
    void foe;
    this.commit(a, 4);
    return a;
  }
}
