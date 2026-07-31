/**
 * Arena critters — ambient wildlife that can turn hostile (SRS §9.2 stretch: living stage).
 *
 * Data only. Spatial values are fixed-point (× FP_SCALE); timers are ticks.
 * Behaviour is executed by `critters.ts` against the seeded LCG so the whole
 * system stays inside the determinism contract (ADR-0002).
 */

/** How a critter picks its moment. */
export type CritterBehavior =
  | 'chase' // beeline at the nearest fighter
  | 'stalk' // close, then circle at the edge of range before committing
  | 'drift' // floats along, strikes from a distance
  | 'skitter'; // fast, erratic darts

export interface CritterArchetype {
  id: string;
  name: string;
  behavior: CritterBehavior;
  /** Health pool (fighters deal CRITTER_DAMAGE_MULT × move damage). */
  hp: number;
  /** Damage dealt to a fighter per connected strike. */
  damage: number;
  /** Horizontal move speed (fp / tick). */
  speed: number;
  /** Strike reach measured centre-to-centre (fp). */
  attackRange: number;
  /** Ticks between strikes. */
  attackCooldown: number;
  /** Distance at which a fighter is noticed (fp). */
  aggroRange: number;
  /** Body radius used for hit detection against fighter attacks (fp). */
  radius: number;
  /** Hover height above the floor (fp). 0 = walks on the ground. */
  hoverY: number;
  /** Relative spawn weight. */
  spawnWeight: number;
  /** Flees below this % of max hp (0 = never flees). */
  fleeHpPct: number;
  /** Meter granted to whoever lands the killing blow. */
  bounty: { flux: number; stamina: number };
  /** Presentation hint — the web renderer maps this to a procedural body. */
  sprite: 'wolf' | 'scarab' | 'spirit' | 'creep';
  /** Presentation hint — dominant colour. */
  tint: string;
}

export const CRITTER_ARCHETYPES: readonly CritterArchetype[] = [
  {
    id: 'shadow_wolf',
    name: 'Shadow Wolf',
    behavior: 'stalk',
    hp: 300,
    damage: 25,
    speed: 58,
    attackRange: 1100,
    attackCooldown: 60,
    aggroRange: 9000,
    radius: 620,
    hoverY: 0,
    spawnWeight: 30,
    fleeHpPct: 25,
    bounty: { flux: 6, stamina: 8 },
    sprite: 'wolf',
    tint: '#7c3aed',
  },
  {
    id: 'crystal_scarab',
    name: 'Crystal Scarab',
    behavior: 'skitter',
    hp: 150,
    damage: 15,
    speed: 82,
    attackRange: 700,
    attackCooldown: 45,
    aggroRange: 7000,
    radius: 420,
    hoverY: 0,
    spawnWeight: 34,
    fleeHpPct: 0,
    bounty: { flux: 4, stamina: 6 },
    sprite: 'scarab',
    tint: '#22d3ee',
  },
  {
    id: 'storm_spirit',
    name: 'Storm Spirit',
    behavior: 'drift',
    hp: 400,
    damage: 35,
    speed: 40,
    attackRange: 1900,
    attackCooldown: 96,
    aggroRange: 11000,
    radius: 700,
    hoverY: 1500,
    spawnWeight: 14,
    fleeHpPct: 0,
    bounty: { flux: 12, stamina: 10 },
    sprite: 'spirit',
    tint: '#fbbf24',
  },
  {
    id: 'void_creep',
    name: 'Void Creep',
    behavior: 'chase',
    hp: 200,
    damage: 20,
    speed: 50,
    attackRange: 900,
    attackCooldown: 50,
    aggroRange: 8000,
    radius: 520,
    hoverY: 0,
    spawnWeight: 22,
    fleeHpPct: 35,
    bounty: { flux: 5, stamina: 7 },
    sprite: 'creep',
    tint: '#f43f5e',
  },
];

export function getCritterArchetype(id: string): CritterArchetype {
  for (let i = 0; i < CRITTER_ARCHETYPES.length; i++) {
    const c = CRITTER_ARCHETYPES[i];
    if (c && c.id === id) return c;
  }
  throw new Error(`Unknown critter archetype: ${id}`);
}

/** Total spawn weight, precomputed for weighted LCG selection. */
export const CRITTER_TOTAL_WEIGHT = CRITTER_ARCHETYPES.reduce((sum, c) => sum + c.spawnWeight, 0);
