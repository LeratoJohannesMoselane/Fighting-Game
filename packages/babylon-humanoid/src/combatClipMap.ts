/**
 * Maps Aether Break's CombatCore fighter state onto Quaternius UAL2 clip names.
 *
 * These are the ACTUAL clip names inside `UAL2_Standard.glb` (43 in the free
 * Standard tier), confirmed by inspecting the file — not invented.
 *
 * The engine-side contract is intentionally loose: `resolveClip()` takes a
 * plain object, so this module has no dependency on @aether-break/combat-core
 * and stays reusable in any project.
 */

/** Every clip in UAL2_Standard.glb [Standard tier]. */
export const UAL2_CLIPS = [
  'A_TPOSE',
  'CHEST_OPEN',
  'CLIMBUP_1M',
  'CONSUME',
  'FARM_HARVEST',
  'FARM_PLANTSEED',
  'FARM_WATERING',
  'HIT_KNOCKBACK',
  'IDLE_FOLDARMS_LOOP',
  'IDLE_LANTERN_LOOP',
  'IDLE_NO_LOOP',
  'IDLE_RAIL_CALL',
  'IDLE_RAIL_LOOP',
  'IDLE_SHIELD_BREAK',
  'IDLE_SHIELD_LOOP',
  'IDLE_TALKINGPHONE_LOOP',
  'LAYTOIDLE',
  'MELEE_HOOK',
  'MELEE_HOOK_REC',
  'NINJAJUMP_IDLE_LOOP',
  'NINJAJUMP_LAND',
  'NINJAJUMP_START',
  'OVERHANDTHROW',
  'SHIELD_DASH',
  'SHIELD_ONESHOT',
  'SLIDE_EXIT',
  'SLIDE_LOOP',
  'SLIDE_START',
  'SWORD_BLOCK',
  'SWORD_DASH',
  'SWORD_HEAVY_COMBO',
  'SWORD_REGULAR_A',
  'SWORD_REGULAR_A_REC',
  'SWORD_REGULAR_B',
  'SWORD_REGULAR_B_REC',
  'SWORD_REGULAR_C',
  'SWORD_REGULAR_COMBO',
  'TREECHOPPING_LOOP',
  'WALK_CARRY_LOOP',
  'YES',
  'ZOMBIE_IDLE_LOOP',
  'ZOMBIE_SCRATCH',
  'ZOMBIE_WALK_FWD_LOOP',
] as const;

export type Ual2Clip = (typeof UAL2_CLIPS)[number];

/**
 * Gameplay keys this package understands. Your game plays these; the map below
 * decides which UAL2 clip each one resolves to.
 */
export type FighterAnimKey =
  | 'idle'
  | 'walk'
  | 'crouch'
  | 'jump'
  | 'airborne'
  | 'land'
  | 'dash'
  | 'guard'
  | 'hitstun'
  | 'knockdown'
  | 'light'
  | 'heavy'
  | 'ranged'
  | 'spell'
  | 'ultimate';

/**
 * Default mapping: gameplay key → UAL2 clip.
 *
 * Chosen for a sword-fighter silhouette. Swap any line for a different clip
 * from `UAL2_CLIPS` to restyle a character without touching game code.
 */
export const DEFAULT_CLIP_MAP: Record<FighterAnimKey, Ual2Clip> = {
  idle: 'IDLE_SHIELD_LOOP', // combat-ready stance, not a casual idle
  walk: 'WALK_CARRY_LOOP',
  crouch: 'SLIDE_LOOP',
  jump: 'NINJAJUMP_START',
  airborne: 'NINJAJUMP_IDLE_LOOP',
  land: 'NINJAJUMP_LAND',
  dash: 'SWORD_DASH',
  guard: 'SWORD_BLOCK',
  hitstun: 'HIT_KNOCKBACK',
  knockdown: 'LAYTOIDLE',
  light: 'SWORD_REGULAR_A',
  heavy: 'SWORD_HEAVY_COMBO',
  ranged: 'OVERHANDTHROW',
  spell: 'SHIELD_ONESHOT',
  ultimate: 'SWORD_REGULAR_COMBO',
};

/** Alternate personality: unarmed brawler. */
export const BRAWLER_CLIP_MAP: Record<FighterAnimKey, Ual2Clip> = {
  ...DEFAULT_CLIP_MAP,
  idle: 'IDLE_FOLDARMS_LOOP',
  light: 'MELEE_HOOK',
  heavy: 'MELEE_HOOK',
  guard: 'IDLE_SHIELD_LOOP',
  dash: 'SHIELD_DASH',
  ultimate: 'MELEE_HOOK',
};

/** Alternate personality: shambling undead. */
export const ZOMBIE_CLIP_MAP: Record<FighterAnimKey, Ual2Clip> = {
  ...DEFAULT_CLIP_MAP,
  idle: 'ZOMBIE_IDLE_LOOP',
  walk: 'ZOMBIE_WALK_FWD_LOOP',
  light: 'ZOMBIE_SCRATCH',
  heavy: 'ZOMBIE_SCRATCH',
};

/**
 * The subset of fighter state this module needs.
 * Structurally compatible with CombatCore's `FighterState`.
 */
export interface FighterSnapshot {
  phase: string;
  /** Active move id, or null. Used to distinguish light/heavy/etc. */
  moveId?: string | null;
  /** Fixed-point vertical velocity; >0 rising, <0 falling. */
  vy?: number;
  /** True while holding guard. */
  guarding?: boolean;
}

/**
 * Decide which gameplay key a fighter should be playing this frame.
 *
 * Priority mirrors what reads best on screen: reactions and attacks beat
 * locomotion, because getting hit mid-walk should show the hit.
 */
export function resolveClip(f: FighterSnapshot): FighterAnimKey {
  switch (f.phase) {
    case 'hitstun':
      return 'hitstun';
    case 'blockstun':
      return 'guard';
    case 'knockdown':
      return 'knockdown';
    case 'dash':
      return 'dash';
    case 'guard':
      return 'guard';
    case 'attack':
      return attackKeyFor(f.moveId ?? '');
    case 'jump':
      return 'jump';
    case 'airborne':
      return 'airborne';
    case 'crouch':
      return 'crouch';
    case 'walk':
      return 'walk';
    case 'neutral':
    default:
      return f.guarding ? 'guard' : 'idle';
  }
}

/**
 * Infer the attack flavour from a move id.
 * Aether Break ids look like `nyra_light`, `bram_heavy`, `iria_sevenfold`.
 */
function attackKeyFor(moveId: string): FighterAnimKey {
  const id = moveId.toLowerCase();
  if (id.includes('light')) return 'light';
  if (id.includes('heavy')) return 'heavy';
  if (id.includes('gun') || id.includes('bolt') || id.includes('carbine')) return 'ranged';
  if (id.includes('bomb') || id.includes('snake') || id.includes('tether')) return 'ranged';
  if (id.includes('spell') || id.includes('veil')) return 'spell';
  // Supers in this roster have bespoke ids (event_horizon, last_foundry, …).
  if (
    id.includes('horizon') ||
    id.includes('foundry') ||
    id.includes('sevenfold') ||
    id.includes('tempest') ||
    id.includes('ult')
  ) {
    return 'ultimate';
  }
  return 'light';
}

/**
 * Build the `rename` map for `createFighterFactory` from a clip map.
 * Turns `{ idle: 'IDLE_SHIELD_LOOP' }` into `{ IDLE_SHIELD_LOOP: 'idle' }`.
 */
export function renameFromClipMap(map: Record<FighterAnimKey, Ual2Clip>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, clip] of Object.entries(map)) {
    // Two gameplay keys may share one clip; first wins, extras handled by
    // `aliasesFor` below.
    if (!out[clip]) out[clip] = key;
  }
  return out;
}

/** The distinct UAL2 clips a map needs — pass as `only` to skip the rest. */
export function clipsUsedBy(map: Record<FighterAnimKey, Ual2Clip>): string[] {
  return [...new Set(Object.values(map))];
}

/**
 * Gameplay keys that resolve to the same underlying clip.
 * `renameFromClipMap` keeps only one name per clip, so the rig needs aliases
 * for the rest (e.g. brawler light+heavy+ultimate all use MELEE_HOOK).
 */
export function aliasesFor(
  map: Record<FighterAnimKey, Ual2Clip>,
): Array<{ alias: FighterAnimKey; target: string }> {
  const primary = renameFromClipMap(map);
  const out: Array<{ alias: FighterAnimKey; target: string }> = [];
  for (const [key, clip] of Object.entries(map) as [FighterAnimKey, Ual2Clip][]) {
    const owner = primary[clip];
    if (owner && owner !== key) out.push({ alias: key, target: owner });
  }
  return out;
}
