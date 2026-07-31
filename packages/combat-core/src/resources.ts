/**
 * Pure resource system for Aether Break (FR-010 safe).
 * No Date, setTimeout, rAF, or DOM — all regen is tick-counted.
 *
 * Resources:
 *  - Flux (0–100): ultimate / awakening meter, builds from active play
 *  - Stamina (0–100): defense & mobility gas tank
 *  - Special (0–max): ammo / heat / charges / energy (per fighter)
 *  - Combo: scaling + meter bonus
 *  - Awakening: manual comeback mode (HP ≤ 30% + flux ≥ 50%)
 */

import {
  MAX_FLUX,
  MAX_STAMINA,
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
} from './constants.js';
import { clamp } from './math.js';
import type { FighterState, GameState, MoveData } from './types.js';

export type StaminaBand = 'full' | 'efficient' | 'limited' | 'critical' | 'empty';

export type SpecialKind = 'ammo' | 'heat' | 'charges' | 'energy' | 'none';

export interface SpecialResourceConfig {
  kind: SpecialKind;
  max: number;
  /** Starting value (ammo full, heat 0, charges full). */
  start: number;
  /** Units restored per recharge tick pulse. */
  rechargeAmount: number;
  /** Ticks between recharge pulses while below max. */
  rechargeInterval: number;
  /** Ticks after spend before recharge begins. */
  rechargeDelay: number;
  /** Display hint for HUD. */
  display: 'ammo' | 'meter' | 'orbs' | 'hidden';
  label: string;
}

export interface FighterResourceProfile {
  special: SpecialResourceConfig;
  /** Gun/ranged spends this many special units (Nyra ammo). */
  rangedSpecialCost: number;
  /** Spell/ability1 special cost. */
  spellSpecialCost: number;
  /** Ability2 special cost. */
  ability2SpecialCost: number;
  /** Heat-style: gain special on melee hit instead of spending. */
  specialGainsOnHit?: number;
  /** Awakening unique flags (presentation + light combat hooks). */
  awakening: {
    damageDealtMul: number; // 120 = +20%
    damageTakenMul: number; // 85 = -15%
    moveSpeedMul: number; // 110 = +10%
    fluxGainMul: number; // 150 = +50%
    /** Nyra: ranged special cost becomes 0 while awakened if true. */
    freeRanged?: boolean;
    /** Bram: block costs 0 stamina while awakened. */
    freeBlock?: boolean;
    /** Iria: special recharge twice as fast. */
    fastSpecialRecharge?: boolean;
  };
}

const DEFAULT_AWAKENING = {
  damageDealtMul: 120,
  damageTakenMul: 85,
  moveSpeedMul: 110,
  fluxGainMul: 150,
};

export const RESOURCE_PROFILES: Readonly<Record<string, FighterResourceProfile>> = {
  nyra_vex: {
    special: {
      kind: 'ammo',
      max: 5,
      start: 5,
      rechargeAmount: 1,
      rechargeInterval: 120, // 2s
      rechargeDelay: 60, // 1s
      display: 'ammo',
      label: 'AMMO',
    },
    rangedSpecialCost: 1,
    spellSpecialCost: 0,
    ability2SpecialCost: 1, // bomb uses a shell
    awakening: {
      ...DEFAULT_AWAKENING,
      freeRanged: false,
      // ammo recharge handled via fastSpecialRecharge-like interval cut
      fastSpecialRecharge: true,
    },
  },
  bram_kade: {
    special: {
      kind: 'heat',
      max: 100,
      start: 0,
      rechargeAmount: 0, // heat only builds from combat, cools slowly
      rechargeInterval: 30,
      rechargeDelay: 90,
      display: 'meter',
      label: 'HEAT',
    },
    rangedSpecialCost: 0,
    spellSpecialCost: 0,
    ability2SpecialCost: 0,
    specialGainsOnHit: 8,
    awakening: {
      ...DEFAULT_AWAKENING,
      freeBlock: true,
    },
  },
  iria_sol: {
    special: {
      kind: 'charges',
      max: 3,
      start: 2,
      rechargeAmount: 1,
      rechargeInterval: 240, // 4s
      rechargeDelay: 30,
      display: 'orbs',
      label: 'PRISM',
    },
    rangedSpecialCost: 0,
    spellSpecialCost: 1,
    ability2SpecialCost: 1, // snake
    awakening: {
      ...DEFAULT_AWAKENING,
      fastSpecialRecharge: true,
    },
  },
};

export function getResourceProfile(fighterId: string): FighterResourceProfile {
  return (
    RESOURCE_PROFILES[fighterId] ?? {
      special: {
        kind: 'none',
        max: 0,
        start: 0,
        rechargeAmount: 0,
        rechargeInterval: 9999,
        rechargeDelay: 9999,
        display: 'hidden',
        label: '',
      },
      rangedSpecialCost: 0,
      spellSpecialCost: 0,
      ability2SpecialCost: 0,
      awakening: { ...DEFAULT_AWAKENING },
    }
  );
}

export function staminaBand(stamina: number): StaminaBand {
  if (stamina <= 0) return 'empty';
  if (stamina < STAMINA_THRESH_CRITICAL) return 'critical';
  if (stamina < STAMINA_THRESH_LIMITED) return 'limited';
  if (stamina < STAMINA_THRESH_EFFICIENT) return 'efficient';
  return 'full';
}

/** Stamina cost multiplier in milli (1000 = 1.0). */
export function staminaCostMul(f: FighterState): number {
  const band = staminaBand(f.stamina);
  let mul = 1000;
  if (band === 'limited') mul = 1100;
  else if (band === 'critical' || band === 'empty') mul = 1250;
  if (f.awakened) mul = ((mul * 80) / 100) | 0;
  return mul;
}

export function applyStaminaCost(f: FighterState, baseCost: number): number {
  const mul = staminaCostMul(f);
  return Math.max(0, ((baseCost * mul) / 1000) | 0);
}

export function trySpendStamina(f: FighterState, baseCost: number): boolean {
  const cost = applyStaminaCost(f, baseCost);
  if (f.stamina < cost) return false;
  f.stamina = clamp(f.stamina - cost, 0, MAX_STAMINA);
  f.staminaRegenDelay = STAMINA_REGEN_DELAY_TICKS;
  return true;
}

export function gainFlux(f: FighterState, amount: number, s: GameState): void {
  if (amount <= 0) return;
  const profile = getResourceProfile(f.id);
  const mul = f.awakened ? profile.awakening.fluxGainMul : 100;
  const gain = Math.max(0, ((amount * mul) / 100) | 0);
  const before = f.flux;
  f.flux = clamp(f.flux + gain, 0, MAX_FLUX);
  f.ultimate = f.flux; // keep alias in sync
  if (before < MAX_FLUX && f.flux >= MAX_FLUX) {
    s.events.push({ type: 'ultimate_ready', slot: f.slot, tick: s.tick });
  }
}

export function spendFlux(f: FighterState, amount: number): boolean {
  if (f.flux < amount) return false;
  f.flux = clamp(f.flux - amount, 0, MAX_FLUX);
  f.ultimate = f.flux;
  return true;
}

export function comboScalingMul(comboCount: number): number {
  // Hit N uses tier for that hit index (1-based)
  if (comboCount <= 1) return 100;
  if (comboCount === 2) return 90;
  if (comboCount === 3) return 80;
  if (comboCount === 4) return 70;
  if (comboCount === 5) return 60;
  return 50;
}

export function comboCallout(comboCount: number): string {
  if (comboCount >= 15) return 'AMAZING!';
  if (comboCount >= 10) return 'EXCELLENT!';
  if (comboCount >= 7) return 'GREAT!';
  if (comboCount >= 4) return 'GOOD!';
  if (comboCount >= 2) return 'COMBO!';
  return '';
}

export function comboFluxBonus(comboCount: number): number {
  if (comboCount >= 15) return 20;
  if (comboCount >= 10) return 10;
  if (comboCount >= 5) return 5;
  return 0;
}

/**
 * Register a successful hit for combo + scaled damage.
 * Returns damage after scaling.
 */
export function registerComboHit(
  attacker: FighterState,
  rawDamage: number,
  moveId: string,
  s: GameState,
): number {
  // Continue or start combo
  if (attacker.comboTimer <= 0) {
    attacker.comboCount = 0;
    attacker.comboMoves = [];
  }
  attacker.comboCount += 1;
  attacker.comboTimer = Math.min(
    COMBO_MAX_TIMER,
    Math.max(attacker.comboTimer, COMBO_RESET_TICKS) + COMBO_EXTEND_TICKS,
  );
  // Track last moves (cap 8)
  const moves = attacker.comboMoves.slice();
  moves.push(moveId);
  while (moves.length > 8) moves.shift();
  attacker.comboMoves = moves;

  const scale = comboScalingMul(attacker.comboCount);
  // +10% if no repeats in last 5
  const recent = moves.slice(-5);
  const unique = new Set(recent).size === recent.length && recent.length >= 2;
  const uniqueMul = unique ? 110 : 100;
  const dmg = Math.max(1, ((((rawDamage * scale) / 100) * uniqueMul) / 100) | 0);

  // Combo flux drip
  gainFlux(attacker, FLUX_ON_COMBO_HIT, s);
  const bonus = comboFluxBonus(attacker.comboCount);
  if (
    bonus > 0 &&
    (attacker.comboCount === 5 || attacker.comboCount === 10 || attacker.comboCount === 15)
  ) {
    gainFlux(attacker, bonus, s);
  }

  s.events.push({
    type: 'combo_update',
    slot: attacker.slot,
    count: attacker.comboCount,
    damage: dmg,
    scaling: scale,
    callout: comboCallout(attacker.comboCount),
    tick: s.tick,
  });

  return dmg;
}

export function tickCombo(f: FighterState, s: GameState): void {
  if (f.comboCount <= 0) return;
  if (f.comboTimer > 0) {
    f.comboTimer -= 1;
  }
  if (f.comboTimer <= 0 && f.comboCount > 0) {
    const ended = f.comboCount;
    f.comboCount = 0;
    f.comboMoves = [];
    s.events.push({ type: 'combo_ended', slot: f.slot, count: ended, tick: s.tick });
  }
}

/** Per-tick stamina regen + block drain. */
export function tickStamina(f: FighterState, guarding: boolean): void {
  if (guarding && f.y <= 0) {
    // Free block while Bram awakened
    const profile = getResourceProfile(f.id);
    if (!(f.awakened && profile.awakening.freeBlock)) {
      // cost in milli-stamina: 0.5% per frame ≈ 0.5 stamina units if max=100 → use milli
      // STAMINA_BLOCK_COST_MILLI is in 1/1000 of a stamina point
      f.staminaMilli = (f.staminaMilli ?? 0) + STAMINA_BLOCK_COST_MILLI;
      while (f.staminaMilli >= 1000 && f.stamina > 0) {
        f.stamina -= 1;
        f.staminaMilli -= 1000;
      }
      f.stamina = clamp(f.stamina, 0, MAX_STAMINA);
      f.staminaRegenDelay = STAMINA_REGEN_DELAY_TICKS;
    }
    // Guard crush arming
    if (f.stamina <= 0) {
      f.guardCrushPending = true;
    }
    return;
  }

  if (f.staminaRegenDelay > 0) {
    f.staminaRegenDelay -= 1;
    return;
  }
  if (f.stamina >= MAX_STAMINA) {
    f.staminaMilli = 0;
    return;
  }
  // 2% per second = 2 stamina / 60 ticks ≈ 33 milli per tick
  f.staminaMilli = (f.staminaMilli ?? 0) + STAMINA_REGEN_PER_TICK_MILLI;
  while (f.staminaMilli >= 1000 && f.stamina < MAX_STAMINA) {
    f.stamina += 1;
    f.staminaMilli -= 1000;
  }
  f.stamina = clamp(f.stamina, 0, MAX_STAMINA);
}

export function tickSpecial(f: FighterState): void {
  const profile = getResourceProfile(f.id);
  const cfg = profile.special;
  if (cfg.kind === 'none' || cfg.max <= 0) return;

  // Heat cools slowly when not attacking
  if (cfg.kind === 'heat') {
    if (f.specialRegenDelay > 0) {
      f.specialRegenDelay -= 1;
      return;
    }
    // cool 1 per interval
    f.specialRegenTimer += 1;
    const interval =
      profile.awakening && f.awakened
        ? Math.max(10, (cfg.rechargeInterval / 2) | 0)
        : cfg.rechargeInterval;
    if (f.specialRegenTimer >= interval && f.special > 0) {
      f.special = clamp(f.special - 1, 0, cfg.max);
      f.specialRegenTimer = 0;
    }
    return;
  }

  if (f.special >= cfg.max) {
    f.specialRegenTimer = 0;
    return;
  }
  if (f.specialRegenDelay > 0) {
    f.specialRegenDelay -= 1;
    return;
  }
  f.specialRegenTimer += 1;
  let interval = cfg.rechargeInterval;
  if (f.awakened && profile.awakening.fastSpecialRecharge) {
    interval = Math.max(15, (interval / 2) | 0);
  }
  if (f.specialRegenTimer >= interval) {
    f.special = clamp(f.special + cfg.rechargeAmount, 0, cfg.max);
    f.specialRegenTimer = 0;
  }
}

export function trySpendSpecial(f: FighterState, amount: number): boolean {
  if (amount <= 0) return true;
  const profile = getResourceProfile(f.id);
  if (profile.special.kind === 'heat' || profile.special.kind === 'none') return true;
  if (f.special < amount) return false;
  f.special -= amount;
  f.specialRegenDelay = profile.special.rechargeDelay;
  f.specialRegenTimer = 0;
  return true;
}

export function gainSpecialOnHit(f: FighterState, amount: number): void {
  const profile = getResourceProfile(f.id);
  if (!amount) return;
  if (profile.special.kind === 'heat') {
    f.special = clamp(f.special + amount, 0, profile.special.max);
    f.specialRegenDelay = profile.special.rechargeDelay;
  }
}

export function specialCostForMove(f: FighterState, move: MoveData): number {
  const profile = getResourceProfile(f.id);
  if (move.input === 'RANGED') {
    if (f.awakened && profile.awakening.freeRanged) return 0;
    return move.specialCost ?? profile.rangedSpecialCost;
  }
  if (move.input === 'SPELL') return move.specialCost ?? profile.spellSpecialCost;
  if (move.input === 'ABILITY2') return move.specialCost ?? profile.ability2SpecialCost;
  return move.specialCost ?? 0;
}

/** Manual awakening: HP% ≤ threshold, flux ≥ cost, not already awakened, once per round. */
export function tryActivateAwakening(f: FighterState, s: GameState): boolean {
  if (f.awakened) return false;
  if (f.awakeningUsedThisRound) return false;
  const maxHp = Math.max(1, f.maxHp || 1000);
  const hpPct = ((f.hp * 100) / maxHp) | 0;
  if (hpPct > AWAKENING_HP_PCT) return false;
  if (f.flux < AWAKENING_FLUX_COST) return false;
  if (!spendFlux(f, AWAKENING_FLUX_COST)) return false;

  f.awakened = true;
  f.awakeningTimer = AWAKENING_DURATION_TICKS;
  f.awakeningUsedThisRound = true;
  s.events.push({
    type: 'awakening_activated',
    slot: f.slot,
    duration: AWAKENING_DURATION_TICKS,
    tick: s.tick,
  });
  return true;
}

export function tickAwakening(f: FighterState, s: GameState): void {
  if (!f.awakened) return;
  f.awakeningTimer -= 1;
  if (f.awakeningTimer <= 0) {
    f.awakened = false;
    f.awakeningTimer = 0;
    s.events.push({ type: 'awakening_deactivated', slot: f.slot, tick: s.tick });
  }
}

export function damageDealtMultiplier(f: FighterState): number {
  if (!f.awakened) return 100;
  return getResourceProfile(f.id).awakening.damageDealtMul;
}

export function damageTakenMultiplier(f: FighterState): number {
  if (!f.awakened) return 100;
  return getResourceProfile(f.id).awakening.damageTakenMul;
}

export function moveSpeedMultiplier(f: FighterState): number {
  if (!f.awakened) return 100;
  return getResourceProfile(f.id).awakening.moveSpeedMul;
}

/** Full per-fighter resource tick (call once per sim tick while fighting). */
export function tickResources(f: FighterState, s: GameState, guarding: boolean): void {
  tickStamina(f, guarding);
  tickSpecial(f);
  tickCombo(f, s);
  tickAwakening(f, s);
  // Sync legacy ultimate alias
  f.ultimate = f.flux;
}

export function initFighterResources(f: FighterState): void {
  const profile = getResourceProfile(f.id);
  f.flux = 0;
  f.ultimate = 0;
  f.stamina = MAX_STAMINA;
  f.staminaMilli = 0;
  f.staminaRegenDelay = 0;
  f.guardCrushPending = false;
  f.special = profile.special.start;
  f.specialMax = profile.special.max;
  f.specialRegenDelay = 0;
  f.specialRegenTimer = 0;
  f.comboCount = 0;
  f.comboTimer = 0;
  f.comboMoves = [];
  f.awakened = false;
  f.awakeningTimer = 0;
  f.awakeningUsedThisRound = false;
  f.maxHp = f.hp;
  // magic kept as soft pool for legacy UI — mirror special meter % for non-ammo
  f.magic =
    profile.special.kind === 'ammo' || profile.special.kind === 'charges'
      ? clamp(((f.special * 100) / Math.max(1, profile.special.max)) | 0, 0, 100)
      : clamp(100 - f.special, 0, 100);
}

export function syncMagicAlias(f: FighterState): void {
  const profile = getResourceProfile(f.id);
  if (profile.special.kind === 'ammo' || profile.special.kind === 'charges') {
    f.magic = clamp(
      ((f.special * 100) / Math.max(1, f.specialMax || profile.special.max)) | 0,
      0,
      100,
    );
  } else if (profile.special.kind === 'heat') {
    f.magic = clamp(100 - f.special, 0, 100);
  }
  f.ultimate = f.flux;
}

export function fluxFromDamage(damage: number, side: 'dealt' | 'received'): number {
  // ~2–5% on hit dealt, ~3–8% on received
  if (side === 'dealt') {
    return clamp(2 + ((damage / 25) | 0), 2, 5);
  }
  return clamp(3 + ((damage / 20) | 0), 3, 8);
}

export { FLUX_ON_BLOCK, STAMINA_DASH_COST };
