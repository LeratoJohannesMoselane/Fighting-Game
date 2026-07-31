/**
 * Match records & lifetime stats — localStorage-backed progression data.
 * Presentation-only: CombatCore stays pure; results flow in from the
 * client when a match reaches its result phase.
 */

import type { MatchConfig } from '../roster';
import { getMeta } from '../roster';

export interface MatchRecord {
  ts: number;
  mode: string;
  p1: string;
  p2: string;
  /** 0 = P1 won, 1 = P2 won, -1 = draw */
  winner: 0 | 1 | -1;
  rounds: [number, number];
  ticks: number;
}

export interface Records {
  totals: { wins: number; losses: number; draws: number };
  perChar: Record<string, { w: number; l: number }>;
  perMode: Record<string, { w: number; l: number }>;
  history: MatchRecord[];
}

const STORAGE_KEY = 'aether-break.records.v1';
const HISTORY_CAP = 25;

function empty(): Records {
  return { totals: { wins: 0, losses: 0, draws: 0 }, perChar: {}, perMode: {}, history: [] };
}

function load(): Records {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Records;
    if (!parsed.totals || !Array.isArray(parsed.history)) return empty();
    return parsed;
  } catch {
    return empty();
  }
}

let current: Records = load();

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* ignore */
  }
}

export interface ResultSnapshot {
  matchWinner: 0 | 1 | 'draw' | null;
  rounds: [number, number];
  tick: number;
}

/** Record one completed match (call once per match when phase hits 'result'). */
export function recordMatch(cfg: MatchConfig, snap: ResultSnapshot): void {
  const mode = cfg.mode ?? (cfg.opponentMode === 'cpu' ? 'cpu' : 'versus');
  const winner: 0 | 1 | -1 = snap.matchWinner === 0 ? 0 : snap.matchWinner === 1 ? 1 : -1;

  const rec: MatchRecord = {
    ts: Date.now(),
    mode,
    p1: cfg.p1Id,
    p2: cfg.p2Id,
    winner,
    rounds: snap.rounds,
    ticks: snap.tick,
  };
  current.history.unshift(rec);
  if (current.history.length > HISTORY_CAP) current.history.length = HISTORY_CAP;

  const playerWon = winner === 0;
  const drew = winner === -1;
  if (drew) current.totals.draws += 1;
  else if (playerWon) current.totals.wins += 1;
  else current.totals.losses += 1;

  // Track per-character stats from the human perspective (versus counts both sides)
  const bump = (id: string, key: 'w' | 'l') => {
    const e = (current.perChar[id] ??= { w: 0, l: 0 });
    e[key] += 1;
  };
  if (!drew) {
    bump(cfg.p1Id, playerWon ? 'w' : 'l');
    if (cfg.opponentMode === 'human') bump(cfg.p2Id, playerWon ? 'l' : 'w');
  }
  const mb = (current.perMode[mode] ??= { w: 0, l: 0 });
  if (!drew) mb[playerWon ? 'w' : 'l'] += 1;

  persist();
}

export function getRecords(): Records {
  return current;
}

export function clearRecords(): void {
  current = empty();
  persist();
}

/** Player-facing favorite fighter = most played (w+l). */
export function favoriteFighter(): string | null {
  let best: string | null = null;
  let bestGames = 0;
  for (const [id, s] of Object.entries(current.perChar)) {
    if (s.w + s.l > bestGames) {
      bestGames = s.w + s.l;
      best = id;
    }
  }
  return best;
}

export function rankFor(rec: Records): string {
  const { wins, losses } = rec.totals;
  const games = wins + losses;
  if (games < 3) return 'UNRANKED';
  const wr = wins / Math.max(1, games);
  if (wr >= 0.8 && games >= 10) return 'GRAND MAGUS';
  if (wr >= 0.65) return 'RIFT VETERAN';
  if (wr >= 0.5) return 'ADEP.';
  if (wr >= 0.35) return 'CHALLENGER';
  return 'ROOKIE';
}

export function displayName(id: string): string {
  try {
    return getMeta(id).name;
  } catch {
    return id;
  }
}
