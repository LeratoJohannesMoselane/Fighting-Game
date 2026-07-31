/**
 * Greybox fighter kits — data only (SRS §9.2 NOW list).
 * Numbers use fixed-point where spatial (×1000) and frames/hp where temporal/resource.
 * Baselines from SRS §7.2 sample (arc_light_1).
 */

import type { FighterKit, MoveData } from '../types.js';
import {
  DEFAULT_HURTBOX,
  GUN_STAMINA_COST,
  JUMP_VELOCITY,
  MAX_ULTIMATE,
  SPELL_STAMINA_COST,
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
      knockbackX: 45,
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
      knockbackX: 105,
      knockbackY: 100,
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
    kind?: 'bullet' | 'bomb' | 'snake' | 'orb';
    speedY?: number;
    gravity?: number;
    bounce?: number;
    width?: number;
    height?: number;
  },
): MoveData {
  const kind = opts.kind ?? 'bullet';
  return {
    id,
    input: 'RANGED',
    startup: opts.startup,
    active: [opts.startup, opts.startup],
    recovery: opts.recovery,
    hitboxes: [],
    hurtbox: HURT,
    // Guns spend stamina; special ammo/charges handled by ResourceManager.
    staminaCost: GUN_STAMINA_COST,
    magicCost: 0,
    onHit: { damage: opts.damage, hitStun: 10, fluxGain: 2, staminaGain: 0, magicGain: 0 },
    onBlock: { blockStun: 6, advantage: -4 },
    cancelTo: [],
    projectile: {
      frame: opts.startup,
      speedX: opts.speedX,
      speedY: opts.speedY ?? (kind === 'bomb' ? 110 : 0),
      lifetime: opts.lifetime,
      damage: opts.damage,
      hitStun: kind === 'snake' ? 14 : 10,
      blockStun: 6,
      fluxGain: 2,
      width: opts.width ?? (kind === 'bomb' ? 280 : kind === 'snake' ? 320 : 200),
      height: opts.height ?? (kind === 'bomb' ? 280 : kind === 'snake' ? 160 : 120),
      maxActive: kind === 'snake' ? 1 : 2,
      kind,
      gravity: opts.gravity ?? (kind === 'bomb' ? 8 : 0),
      bounce: opts.bounce ?? (kind === 'bomb' ? 0.4 : 0),
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
    magicCost: 0,
    onHit: {
      damage: opts.damage,
      hitStun: 18,
      fluxGain: 6,
      staminaGain: 2,
      magicGain: 0,
      knockbackX: 60,
      knockbackY: 50,
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
    magicCost: 0,
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
    forwardImpulse: 75,
  };
}

/** Nyra Vex — Rift Gunslinger. Agile mid-range. */
export const NYRA_VEX: FighterKit = {
  id: 'nyra_vex',
  name: 'Nyra Vex',
  version: '0.1.0',
  base: {
    hp: 1000,
    walk: 70,
    jumpVelocity: JUMP_VELOCITY,
    dashSpeed: 190,
    weight: 1000,
  },
  moves: [
    lightMove('nyra_light', ['nyra_heavy', 'nyra_event_horizon']),
    heavyMove('nyra_heavy', ['nyra_event_horizon']),
    // Twin arc pistols — fast bullets
    gunMove('nyra_gun', {
      damage: 28,
      speedX: 340,
      startup: 9,
      recovery: 13,
      lifetime: 42,
      kind: 'bullet',
    }),
    // Ricochet bomb — arcing grenade (ABILITY2)
    {
      ...gunMove('nyra_bomb', {
        damage: 48,
        speedX: 150,
        speedY: 190,
        startup: 14,
        recovery: 18,
        lifetime: 70,
        kind: 'bomb',
        gravity: 7,
        bounce: 0.5,
      }),
      input: 'ABILITY2',
    },
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
      knockbackX: 155,
      knockbackY: 160,
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
    walk: 55,
    jumpVelocity: JUMP_VELOCITY - 15,
    dashSpeed: 155,
    weight: 1200,
  },
  moves: [
    lightMove('bram_light', ['bram_heavy', 'bram_last_foundry']),
    heavyMove('bram_heavy', ['bram_last_foundry']),
    // Scattergun blast pellet
    gunMove('bram_gun', {
      damage: 35,
      speedX: 265,
      startup: 11,
      recovery: 15,
      lifetime: 34,
      kind: 'bullet',
    }),
    // Forge bomb — heavy arcing shell (ABILITY2)
    {
      ...gunMove('bram_bomb', {
        damage: 58,
        speedX: 125,
        speedY: 210,
        startup: 16,
        recovery: 20,
        lifetime: 75,
        kind: 'bomb',
        gravity: 8,
        bounce: 0.35,
      }),
      input: 'ABILITY2',
    },
    {
      ...spellMove('bram_spell', {
        damage: 55,
        startup: 16,
        active: [16, 22],
        recovery: 20,
        hitbox: { x: 200, y: 200, w: 900, h: 800 },
      }),
      forwardImpulse: 150,
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
        knockbackX: 140,
        knockbackY: 100,
      }),
      forwardImpulse: 190,
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
    walk: 62,
    jumpVelocity: 222,
    dashSpeed: 165,
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
        knockbackX: 38,
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
        knockbackX: 45,
        knockbackY: 140,
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
        knockbackX: 120,
        knockbackY: 40,
      },
      onBlock: { blockStun: 14, advantage: -8, chip: 3 },
      cancelTo: ['iria_sevenfold'],
    },
    // Prism bolt
    gunMove('iria_bolt', {
      damage: 30,
      speedX: 285,
      startup: 11,
      recovery: 15,
      lifetime: 46,
      kind: 'bullet',
    }),
    // Arcane serpent — ground snake projectile (ABILITY2)
    {
      ...gunMove('iria_snake', {
        damage: 40,
        speedX: 170,
        startup: 14,
        recovery: 18,
        lifetime: 90,
        kind: 'snake',
      }),
      input: 'ABILITY2',
    },
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
      knockbackX: 112,
      knockbackY: 200,
    }),
  ],
};

/** Kellan Wisp — Stormblade rushdown (greybox kit). */
export const KELLAN_WISP: FighterKit = {
  id: 'kellan_wisp',
  name: 'Kellan Wisp',
  version: '1.0.0',
  base: {
    hp: 960,
    walk: 74,
    jumpVelocity: JUMP_VELOCITY + 8,
    dashSpeed: 210,
    weight: 920,
  },
  moves: [
    lightMove('kellan_light', ['kellan_heavy', 'kellan_tempest']),
    heavyMove('kellan_heavy', ['kellan_tempest']),
    gunMove('kellan_carbine', {
      damage: 26,
      speedX: 350,
      startup: 8,
      recovery: 12,
      lifetime: 40,
      kind: 'bullet',
    }),
    {
      ...gunMove('kellan_tether', {
        damage: 36,
        speedX: 215,
        startup: 12,
        recovery: 16,
        lifetime: 50,
        kind: 'orb',
      }),
      input: 'ABILITY2',
    },
    spellMove('kellan_veil', {
      damage: 42,
      startup: 10,
      active: [10, 14],
      recovery: 14,
      hitbox: { x: 300, y: 200, w: 1000, h: 1000 },
    }),
    ultimateMove('kellan_tempest', {
      nameHint: 'Tempest Divide',
      damage: 275,
      startup: 7,
      active: [7, 15],
      recovery: 24,
      hitbox: { x: 50, y: 0, w: 1500, h: 1600 },
      knockbackX: 135,
      knockbackY: 140,
    }),
  ],
};

export const FIGHTER_KITS: Readonly<Record<string, FighterKit>> = {
  nyra_vex: NYRA_VEX,
  bram_kade: BRAM_KADE,
  iria_sol: IRIA_SOL,
  kellan_wisp: KELLAN_WISP,
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
