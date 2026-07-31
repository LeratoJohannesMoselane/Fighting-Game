import {
  MAX_FLUX,
  TICK_RATE,
  getKit,
  type FighterState,
  type GameState,
} from '@aether-break/combat-core';

export interface HudMeta {
  p1Name: string;
  p2Name: string;
  opponentMode: 'cpu' | 'human';
  cpuDifficulty?: string;
}

function winsDots(wins: number): string {
  const parts: string[] = [];
  for (let i = 0; i < 3; i++) {
    parts.push(i < wins ? '●' : '○');
  }
  return parts.join(' ');
}

export class Hud {
  private readonly p1Hp = el('p1-hp');
  private readonly p2Hp = el('p2-hp');
  private readonly p1Flux = el('p1-flux');
  private readonly p2Flux = el('p2-flux');
  private readonly p1Phase = el('p1-phase');
  private readonly p2Phase = el('p2-phase');
  private readonly p1Wins = el('p1-wins');
  private readonly p2Wins = el('p2-wins');
  private readonly p1Name = el('p1-name');
  private readonly p2Name = el('p2-name');
  private readonly timer = el('timer');
  private readonly banner = el('banner');
  private readonly meta = el('match-meta');
  private readonly fpsEl = el('fps');
  private readonly flash = el('hit-flash');

  private frames = 0;
  private lastFpsTs = performance.now();

  update(state: GameState, paused: boolean, info?: HudMeta): void {
    if (info) {
      this.p1Name.textContent = info.p1Name.toUpperCase();
      this.p2Name.textContent = info.p2Name.toUpperCase();
    }

    this.setFighter(state.fighters[0], this.p1Hp, this.p1Flux, this.p1Phase, this.p1Wins);
    this.setFighter(state.fighters[1], this.p2Hp, this.p2Flux, this.p2Phase, this.p2Wins);

    const secs = Math.ceil(state.timer / TICK_RATE);
    this.timer.textContent = String(Math.max(0, secs));

    const modeBit = info?.opponentMode === 'cpu' ? `CPU ${info.cpuDifficulty ?? ''}`.trim() : '2P';
    this.meta.textContent = `Round ${state.round} · BEST OF 3 · ${modeBit} · tick ${state.tick}`;

    let banner = '';
    if (paused) banner = 'PAUSED';
    else if (state.matchPhase === 'round_intro') banner = `ROUND ${state.round}`;
    else if (state.matchPhase === 'round_end') banner = 'K.O.';
    else if (state.matchPhase === 'result') {
      const w0 = info?.p1Name?.toUpperCase() ?? 'P1';
      const w1 = info?.p2Name?.toUpperCase() ?? 'P2';
      banner =
        state.matchWinner === 0 ? `${w0} WINS` : state.matchWinner === 1 ? `${w1} WINS` : 'DRAW';
    }
    this.banner.textContent = banner;

    this.frames += 1;
    const now = performance.now();
    if (now - this.lastFpsTs >= 500) {
      const fps = Math.round((this.frames * 1000) / (now - this.lastFpsTs));
      this.frames = 0;
      this.lastFpsTs = now;
      this.fpsEl.textContent = `${fps} FPS`;
    }
  }

  flashHit(): void {
    this.flash.hidden = false;
    this.flash.classList.add('on');
    window.setTimeout(() => {
      this.flash.classList.remove('on');
    }, 50);
  }

  private setFighter(
    f: FighterState,
    hpEl: HTMLElement,
    fluxEl: HTMLElement,
    phaseEl: HTMLElement,
    winsEl: HTMLElement,
  ): void {
    let maxHp = 1000;
    try {
      maxHp = getKit(f.id).base.hp;
    } catch {
      maxHp = 1000;
    }
    const hpPct = Math.max(0, Math.min(100, (f.hp / Math.max(1, maxHp)) * 100));
    const fluxPct = Math.max(0, Math.min(100, (f.flux / MAX_FLUX) * 100));
    hpEl.style.width = `${hpPct}%`;
    fluxEl.style.width = `${fluxPct}%`;
    phaseEl.textContent = f.move ? `${f.phase}:${f.move.moveId}` : f.phase;
    winsEl.textContent = winsDots(f.wins);
  }
}

function el(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`#${id} missing`);
  return node;
}
