/**
 * Presentation metadata for the character select screen.
 * Combat stats come from CombatCore kits; this is UI-only.
 */

export interface CharacterMeta {
  id: string;
  name: string;
  title: string;
  archetype: string;
  difficulty: number;
  color: string;
  colorDim: string;
  blurb: string;
}

export const ROSTER: readonly CharacterMeta[] = [
  {
    id: 'nyra_vex',
    name: 'Nyra Vex',
    title: 'Rift Gunslinger',
    archetype: 'Mid-range / Harassment',
    difficulty: 2,
    color: '#2ee6c5',
    colorDim: '#147a68',
    blurb: 'Agile bounty hunter. Twin arc pistols, quick lights, blinky pressure.',
  },
  {
    id: 'bram_kade',
    name: 'Bram Kade',
    title: 'Forge Warden',
    archetype: 'Close-range / Pressure',
    difficulty: 2,
    color: '#ff4d6d',
    colorDim: '#8a1e35',
    blurb: 'Armoured enforcer. Heavy hits, scattergun, furnace-forward spell.',
  },
  {
    id: 'iria_sol',
    name: 'Iria Sol',
    title: 'Prism Magus',
    archetype: 'Zoner / Setup',
    difficulty: 4,
    color: '#5ce1ff',
    colorDim: '#a78bfa',
    blurb: 'Runic staff & prism cards. Spaces with bolts and delayed geometry.',
  },
] as const;

export type OpponentMode = 'cpu' | 'human';

export interface MatchConfig {
  p1Id: string;
  p2Id: string;
  opponentMode: OpponentMode;
  /** CPU difficulty when opponentMode === 'cpu'. */
  cpuDifficulty: 'easy' | 'normal' | 'hard';
}

export function getMeta(id: string): CharacterMeta {
  const m = ROSTER.find((c) => c.id === id);
  if (!m) throw new Error(`Unknown roster id: ${id}`);
  return m;
}

export function defaultMatchConfig(): MatchConfig {
  return {
    p1Id: 'nyra_vex',
    p2Id: 'bram_kade',
    opponentMode: 'cpu',
    cpuDifficulty: 'normal',
  };
}
