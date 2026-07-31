/**
 * Character select metadata — SF6-inspired palettes & copy.
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
    color: '#00BCD4',
    colorDim: '#4A148C',
    blurb: 'Cocky rift hunter. Twin pistols, trench coat, Phase Step pressure.',
  },
  {
    id: 'bram_kade',
    name: 'Bram Kade',
    title: 'Forge Warden',
    archetype: 'Close-range / Pressure',
    difficulty: 2,
    color: '#E65100',
    colorDim: '#5D4037',
    blurb: 'Imposing forge giant. Gauntlet slams, heat armor, ground-shaking heavies.',
  },
  {
    id: 'iria_sol',
    name: 'Iria Sol',
    title: 'Prism Magus',
    archetype: 'Zoner / Setup',
    difficulty: 4,
    color: '#E040FB',
    colorDim: '#00BCD4',
    blurb: 'Serene prism mage. Floating orbs, crystal staff, delayed geometry.',
  },
  {
    id: 'kellan_wisp',
    name: 'Kellan Wisp',
    title: 'Stormblade',
    archetype: 'Rushdown / Mix-up',
    difficulty: 3,
    color: '#00E5FF',
    colorDim: '#1A237E',
    blurb: 'Lightning duelist. Energy blade, coil carbine, blink-fast rushdown.',
  },
] as const;

export type OpponentMode = 'cpu' | 'human';

export interface MatchConfig {
  p1Id: string;
  p2Id: string;
  opponentMode: OpponentMode;
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
