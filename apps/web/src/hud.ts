import {
  MAX_FLUX,
  MAX_HP,
  TICK_RATE,
  type FighterState,
  type GameState,
} from '@aether-break/combat-core';

function winsDots(wins: number, activeColor: string): string {
  const parts: string[] = [];
  for (let i = 0; i < 3; i++) {
    parts.push(i < wins ? '●' : '○');
  }
  void activeColor;
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
  private readonly timer = el('timer');
  private readonly banner = el('banner');
  private readonly meta = el('match-meta');
  private readonly fpsEl = el('fps');
  private readonly flash = el('hit-flash');

  private frames = 0;
  private lastFpsTs = performance.now();
  private fps = 0;

  update(state: GameState, paused: boolean): void {
    this.setFighter(state.fighters[0], this.p1Hp, this.p1Flux, this.p1Phase, this.p1Wins);
    this.setFighter(state.fighters[1], this.p2Hp, this.p2Flux, this.p2Phase, this.p2Wins);

    const secs = Math.ceil(state.timer / TICK_RATE);
    this.timer.textContent = String(Math.max(0, secs));

    this.meta.textContent = `Round ${state.round} · BEST OF 3 · tick ${state.tick}`;

    let banner = '';
    if (paused) banner = 'PAUSED';
    else if (state.matchPhase === 'round_intro') banner = `ROUND ${state.round}`;
    else if (state.matchPhase === 'round_end') banner = 'K.O.';
    else if (state.matchPhase === 'result') {
      banner =
        state.matchWinner === 0
          ? 'P1 WINS MATCH'
          : state.matchWinner === 1
            ? 'P2 WINS MATCH'
            : 'DRAW';
    }
    this.banner.textContent = banner;

    this.frames += 1;
    const now = performance.now();
    if (now - this.lastFpsTs >= 500) {
      this.fps = Math.round((this.frames * 1000) / (now - this.lastFpsTs));
      this.frames = 0;
      this.lastFpsTs = now;
      this.fpsEl.textContent = `${this.fps} FPS`;
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
    const hpPct = Math.max(0, Math.min(100, (f.hp / MAX_HP) * 100));
    const fluxPct = Math.max(0, Math.min(100, (f.flux / MAX_FLUX) * 100));
    hpEl.style.width = `${hpPct}%`;
    fluxEl.style.width = `${fluxPct}%`;
    phaseEl.textContent = f.move ? `${f.phase}:${f.move.moveId}` : f.phase;
    winsEl.textContent = winsDots(f.wins, '');
  }
}

function el(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`#${id} missing`);
  return node;
}
