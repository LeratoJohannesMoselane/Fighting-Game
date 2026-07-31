/**
 * Greybox fighter kits — data only (SRS §9.2 NOW list).
 * Numbers use fixed-point where spatial (×1000) and frames/hp where temporal/resource.
 * Baselines from SRS §7.2 sample (arc_light_1).
 */

import type { FighterKit, MoveData } from '../types.js';
import { DEFAULT_HURTBOX, JUMP_VELOCITY } from '../constants.js';

const HURT = { ...DEFAULT_HURTBOX };

function lightMove(id: string, cancelTo: string[] = []): MoveData {
  return {
    id,
    input: 'LIGHT',
    startup: 6,
    active: [6, 8],
    recovery: 12,
    // Reach past body separation (~1200) into opponent hurtbox. SRS sample scaled ×10 for fp.
    hitboxes: [{ frame: 6, shape: 'box', x: 400, y: 400, w: 900, h: 800 }],
    hurtbox: HURT,
    onHit: { damage: 42, hitStun: 15, fluxGain: 4, knockbackX: 120, knockbackY: 0 },
    onBlock: { blockStun: 9, advantage: -2 },
    cancelTo,
  };
}

function heavyMove(id: string): MoveData {
  return {
    id,
    input: 'HEAVY',
    startup: 12,
    active: [12, 15],
    recovery: 18,
    hitboxes: [{ frame: 12, shape: 'box', x: 350, y: 200, w: 1100, h: 1000 }],
    hurtbox: HURT,
    onHit: { damage: 78, hitStun: 22, fluxGain: 10, knockbackX: 280, knockbackY: 200 },
    onBlock: { blockStun: 12, advantage: -6, chip: 2 },
    cancelTo: [],
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
    onHit: { damage: opts.damage, hitStun: 10, fluxGain: 3 },
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
      fluxGain: 3,
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
    onHit: {
      damage: opts.damage,
      hitStun: 18,
      fluxGain: 8,
      knockbackX: 160,
      knockbackY: 100,
    },
    onBlock: { blockStun: 10, advantage: -8, chip: 3 },
    cancelTo: [],
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
    lightMove('nyra_light', ['nyra_heavy']),
    heavyMove('nyra_heavy'),
    gunMove('nyra_gun', {
      damage: 28,
      speedX: 900,
      startup: 10,
      recovery: 14,
      lifetime: 45,
    }),
    // Ricochet Sigil stand-in: slow orb spell (ability reserved; greybox uses SPELL input via ability1 mapping).
    spellMove('nyra_spell', {
      damage: 45,
      startup: 14,
      active: [14, 20],
      recovery: 16,
      hitbox: { x: 200, y: 200, w: 1400, h: 1200 },
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
    lightMove('bram_light', ['bram_heavy']),
    heavyMove('bram_heavy'),
    gunMove('bram_gun', {
      damage: 35,
      speedX: 700,
      startup: 12,
      recovery: 16,
      lifetime: 36,
    }),
    // Furnace Rush stand-in: forward-advancing spell hitbox.
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
      onHit: { damage: 36, hitStun: 14, fluxGain: 4, knockbackX: 100, knockbackY: 0 },
      onBlock: { blockStun: 9, advantage: -2 },
      cancelTo: ['iria_light_2', 'iria_heavy'],
    },
    {
      id: 'iria_light_2',
      input: 'LIGHT',
      startup: 6,
      active: [6, 9],
      recovery: 14,
      hitboxes: [{ frame: 6, shape: 'box', x: 380, y: 700, w: 860, h: 520 }],
      hurtbox: { x: -500, y: 0, w: 1000, h: 1680 },
      onHit: { damage: 48, hitStun: 18, fluxGain: 6, knockbackX: 120, knockbackY: 280 },
      onBlock: { blockStun: 11, advantage: -4 },
      cancelTo: ['iria_spell', 'iria_bolt'],
    },
    {
      id: 'iria_heavy',
      input: 'HEAVY',
      startup: 14,
      active: [14, 17],
      recovery: 22,
      hitboxes: [{ frame: 14, shape: 'box', x: 200, y: 80, w: 1200, h: 520 }],
      hurtbox: { x: -480, y: 0, w: 960, h: 1400 },
      onHit: { damage: 82, hitStun: 24, fluxGain: 10, knockbackX: 320, knockbackY: 80 },
      onBlock: { blockStun: 14, advantage: -8, chip: 3 },
      cancelTo: [],
    },
    gunMove('iria_bolt', {
      damage: 30,
      speedX: 780,
      startup: 11,
      recovery: 16,
      lifetime: 48,
    }),
    // Prism Gate stand-in: mid-range delayed geometry hit (full gate FSM in content JSON).
    spellMove('iria_spell', {
      damage: 38,
      startup: 10,
      active: [10, 16],
      recovery: 18,
      hitbox: { x: 900, y: 400, w: 500, h: 900 },
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
