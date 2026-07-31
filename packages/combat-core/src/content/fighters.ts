/**
 * Greybox fighter kits — data only (SRS §9.2 NOW list).
 * Numbers use fixed-point where spatial (×1000) and frames/hp where temporal/resource.
 * Baselines from SRS §7.2 sample (arc_light_1).
 */

import type { FighterKit, MoveData } from '../types.js';
import {
  DEFAULT_HURTBOX,
  GUN_MAGIC_COST,
  GUN_STAMINA_COST,
  JUMP_VELOCITY,
  MAX_ULTIMATE,
  SPELL_MAGIC_COST,
  SPELL_STAMINA_COST,
  ULTIMATE_MAGIC_COST,
} from '../constants.js';

const HURT = { ...DEFAULT_HURTBOX };

function lightMove(id: string, cancelTo: string[] = []): MoveData {
  return {
    id,
    input: 'LIGHT',
    startup: 6,
    active: [6, 8],
    recovery: 12,
    hitboxes: [{ frame: 6, shape: 'box', x: 400, y: 400, w: 900, h: 800 }],
    hurtbox: HURT,
    onHit: {
      damage: 42,
      hitStun: 15,
      fluxGain: 8,
      staminaGain: 10,
      magicGain: 8,
      defenderUltGain: 3,
      knockbackX: 120,
      knockbackY: 0,
    },
    onBlock: { blockStun: 9, advantage: -2 },
    cancelTo,
  };
}

function heavyMove(id: string, cancelTo: string[] = []): MoveData {
  return {
    id,
    input: 'HEAVY',
    startup: 12,
    active: [12, 15],
    recovery: 18,
    hitboxes: [{ frame: 12, shape: 'box', x: 350, y: 200, w: 1100, h: 1000 }],
    hurtbox: HURT,
    onHit: {
      damage: 78,
      hitStun: 22,
      fluxGain: 14,
      staminaGain: 16,
      magicGain: 12,
      defenderUltGain: 5,
      knockbackX: 280,
      knockbackY: 200,
    },
    onBlock: { blockStun: 12, advantage: -6, chip: 2 },
    cancelTo,
  };
}

function gunMove(
  id: string,
  opts: {
    damage: number;
    speedX: number;
    startup: number;
    recovery: number;
    lifetime: number;
  },
): MoveData {
  return {
    id,
    input: 'RANGED',
    startup: opts.startup,
    active: [opts.startup, opts.startup],
    recovery: opts.recovery,
    hitboxes: [],
    hurtbox: HURT,
    // Guns spend stamina + magic; restore almost nothing (must melee to refill).
    staminaCost: GUN_STAMINA_COST,
    magicCost: GUN_MAGIC_COST,
    onHit: { damage: opts.damage, hitStun: 10, fluxGain: 2, staminaGain: 0, magicGain: 0 },
    onBlock: { blockStun: 6, advantage: -4 },
    cancelTo: [],
    projectile: {
      frame: opts.startup,
      speedX: opts.speedX,
      speedY: 0,
      lifetime: opts.lifetime,
      damage: opts.damage,
      hitStun: 10,
      blockStun: 6,
      fluxGain: 2,
      width: 200,
      height: 120,
      maxActive: 2,
    },
  };
}

function spellMove(
  id: string,
  opts: {
    damage: number;
    startup: number;
    active: readonly [number, number];
    recovery: number;
    hitbox: { x: number; y: number; w: number; h: number };
  },
): MoveData {
  return {
    id,
    input: 'SPELL',
    startup: opts.startup,
    active: opts.active,
    recovery: opts.recovery,
    hitboxes: [
      {
        frame: opts.active[0],
        shape: 'box',
        x: opts.hitbox.x,
        y: opts.hitbox.y,
        w: opts.hitbox.w,
        h: opts.hitbox.h,
      },
    ],
    hurtbox: HURT,
    staminaCost: SPELL_STAMINA_COST,
    magicCost: SPELL_MAGIC_COST,
    onHit: {
      damage: opts.damage,
      hitStun: 18,
      fluxGain: 6,
      staminaGain: 2,
      magicGain: 0,
      knockbackX: 160,
      knockbackY: 100,
    },
    onBlock: { blockStun: 10, advantage: -8, chip: 3 },
    cancelTo: [],
  };
}

/**
 * Anime-style Awakening Strike — full ultimate meter + magic.
 * Massive damage, long hitstun, cinematic hitstop.
 */
function ultimateMove(
  id: string,
  opts: {
    nameHint: string;
    damage: number;
    startup: number;
    active: readonly [number, number];
    recovery: number;
    hitbox: { x: number; y: number; w: number; h: number };
    knockbackX: number;
    knockbackY: number;
  },
): MoveData {
  void opts.nameHint;
  return {
    id,
    input: 'ULTIMATE',
    startup: opts.startup,
    active: opts.active,
    recovery: opts.recovery,
    hitboxes: [
      {
        frame: opts.active[0],
        shape: 'box',
        x: opts.hitbox.x,
        y: opts.hitbox.y,
        w: opts.hitbox.w,
        h: opts.hitbox.h,
      },
    ],
    hurtbox: HURT,
    isUltimate: true,
    ultimateCost: MAX_ULTIMATE,
    magicCost: ULTIMATE_MAGIC_COST,
    staminaCost: 10,
    onHit: {
      damage: opts.damage,
      hitStun: 40,
      fluxGain: 0,
      staminaGain: 20,
      magicGain: 5,
      defenderUltGain: 8,
      knockbackX: opts.knockbackX,
      knockbackY: opts.knockbackY,
    },
    onBlock: { blockStun: 16, advantage: -12, chip: 8 },
    cancelTo: [],
    forwardImpulse: 200,
  };
}

/** Nyra Vex — Rift Gunslinger. Agile mid-range. */
export const NYRA_VEX: FighterKit = {
  id: 'nyra_vex',
  name: 'Nyra Vex',
  version: '0.1.0',
  base: {
    hp: 1000,
    walk: 286,
    jumpVelocity: JUMP_VELOCITY,
    dashSpeed: 750,
    weight: 1000,
  },
  moves: [
    lightMove('nyra_light', ['nyra_heavy', 'nyra_event_horizon']),
    heavyMove('nyra_heavy', ['nyra_event_horizon']),
    gunMove('nyra_gun', {
      damage: 28,
      speedX: 900,
      startup: 10,
      recovery: 14,
      lifetime: 45,
    }),
    spellMove('nyra_spell', {
      damage: 45,
      startup: 14,
      active: [14, 20],
      recovery: 16,
      hitbox: { x: 200, y: 200, w: 1400, h: 1200 },
    }),
    // Event Horizon — rift crossfire super (anime confirm finisher).
    ultimateMove('nyra_event_horizon', {
      nameHint: 'Event Horizon',
      damage: 280,
      startup: 8,
      active: [8, 16],
      recovery: 28,
      hitbox: { x: 100, y: 0, w: 1600, h: 1700 },
      knockbackX: 420,
      knockbackY: 320,
    }),
  ],
};

/** Bram Kade — Forge Warden. Armoured close-range. Slower walk. */
export const BRAM_KADE: FighterKit = {
  id: 'bram_kade',
  name: 'Bram Kade',
  version: '0.1.0',
  base: {
    hp: 1000,
    walk: 220,
    jumpVelocity: JUMP_VELOCITY - 40,
    dashSpeed: 620,
    weight: 1200,
  },
  moves: [
    lightMove('bram_light', ['bram_heavy', 'bram_last_foundry']),
    heavyMove('bram_heavy', ['bram_last_foundry']),
    gunMove('bram_gun', {
      damage: 35,
      speedX: 700,
      startup: 12,
      recovery: 16,
      lifetime: 36,
    }),
    {
      ...spellMove('bram_spell', {
        damage: 55,
        startup: 16,
        active: [16, 22],
        recovery: 20,
        hitbox: { x: 200, y: 200, w: 900, h: 800 },
      }),
      forwardImpulse: 400,
    },
    // Last Foundry — overclock gauntlet slam super.
    {
      ...ultimateMove('bram_last_foundry', {
        nameHint: 'Last Foundry',
        damage: 300,
        startup: 10,
        active: [10, 18],
        recovery: 30,
        hitbox: { x: 50, y: 0, w: 1400, h: 1600 },
        knockbackX: 380,
        knockbackY: 200,
      }),
      forwardImpulse: 500,
    },
  ],
};

/**
 * Iria Sol — Prism Magus (zoner / setup).
 * Full production data: packages/content/fighters/iria_sol.json
 * Greybox kit below maps to current CombatCore MoveData (Gate/Ward full FSM = next content spike).
 */
export const IRIA_SOL: FighterKit = {
  id: 'iria_sol',
  name: 'Iria Sol',
  version: '1.0.0',
  base: {
    hp: 920,
    walk: 245,
    jumpVelocity: 740,
    dashSpeed: 620,
    weight: 900,
  },
  moves: [
    {
      id: 'iria_light_1',
      input: 'LIGHT',
      startup: 5,
      active: [5, 7],
      recovery: 11,
      hitboxes: [{ frame: 5, shape: 'box', x: 420, y: 900, w: 720, h: 360 }],
      hurtbox: { x: -520, y: 0, w: 1040, h: 1680 },
      onHit: {
        damage: 36,
        hitStun: 14,
        fluxGain: 8,
        staminaGain: 10,
        magicGain: 8,
        defenderUltGain: 3,
        knockbackX: 100,
        knockbackY: 0,
      },
      onBlock: { blockStun: 9, advantage: -2 },
      cancelTo: ['iria_light_2', 'iria_heavy', 'iria_sevenfold'],
    },
    {
      id: 'iria_light_2',
      input: 'LIGHT',
      startup: 6,
      active: [6, 9],
      recovery: 14,
      hitboxes: [{ frame: 6, shape: 'box', x: 380, y: 700, w: 860, h: 520 }],
      hurtbox: { x: -500, y: 0, w: 1000, h: 1680 },
      onHit: {
        damage: 48,
        hitStun: 18,
        fluxGain: 10,
        staminaGain: 12,
        magicGain: 10,
        defenderUltGain: 4,
        knockbackX: 120,
        knockbackY: 280,
      },
      onBlock: { blockStun: 11, advantage: -4 },
      cancelTo: ['iria_spell', 'iria_bolt', 'iria_sevenfold'],
    },
    {
      id: 'iria_heavy',
      input: 'HEAVY',
      startup: 14,
      active: [14, 17],
      recovery: 22,
      hitboxes: [{ frame: 14, shape: 'box', x: 200, y: 80, w: 1200, h: 520 }],
      hurtbox: { x: -480, y: 0, w: 960, h: 1400 },
      onHit: {
        damage: 82,
        hitStun: 24,
        fluxGain: 14,
        staminaGain: 16,
        magicGain: 12,
        defenderUltGain: 5,
        knockbackX: 320,
        knockbackY: 80,
      },
      onBlock: { blockStun: 14, advantage: -8, chip: 3 },
      cancelTo: ['iria_sevenfold'],
    },
    gunMove('iria_bolt', {
      damage: 30,
      speedX: 780,
      startup: 11,
      recovery: 16,
      lifetime: 48,
    }),
    spellMove('iria_spell', {
      damage: 38,
      startup: 10,
      active: [10, 16],
      recovery: 18,
      hitbox: { x: 900, y: 400, w: 500, h: 900 },
    }),
    // Sevenfold Star — constellation burst super.
    ultimateMove('iria_sevenfold', {
      nameHint: 'Sevenfold Star',
      damage: 270,
      startup: 8,
      active: [8, 14],
      recovery: 26,
      hitbox: { x: 0, y: 100, w: 1700, h: 1700 },
      knockbackX: 300,
      knockbackY: 400,
    }),
  ],
};

export const FIGHTER_KITS: Readonly<Record<string, FighterKit>> = {
  nyra_vex: NYRA_VEX,
  bram_kade: BRAM_KADE,
  iria_sol: IRIA_SOL,
};

export function getKit(id: string): FighterKit {
  const kit = FIGHTER_KITS[id];
  if (!kit) {
    throw new Error(`Unknown fighter kit: ${id}`);
  }
  return kit;
}

export function getMove(kit: FighterKit, moveId: string): MoveData | undefined {
  for (let i = 0; i < kit.moves.length; i++) {
    const m = kit.moves[i];
    if (m && m.id === moveId) return m;
  }
  return undefined;
}

export function findMoveByInput(kit: FighterKit, input: string): MoveData | undefined {
  for (let i = 0; i < kit.moves.length; i++) {
    const m = kit.moves[i];
    if (m && m.input === input) return m;
  }
  return undefined;
}
