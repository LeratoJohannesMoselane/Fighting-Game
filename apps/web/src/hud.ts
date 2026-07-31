import {
  MAX_MAGIC,
  MAX_STAMINA,
  MAX_ULTIMATE,
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
  private readonly p1Sta = el('p1-stamina');
  private readonly p2Sta = el('p2-stamina');
  private readonly p1Mag = el('p1-magic');
  private readonly p2Mag = el('p2-magic');
  private readonly p1Ult = el('p1-ultimate');
  private readonly p2Ult = el('p2-ultimate');
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
  private readonly ultFlash = el('ult-flash');

  private frames = 0;
  private lastFpsTs = performance.now();

  update(state: GameState, paused: boolean, info?: HudMeta): void {
    if (info) {
      this.p1Name.textContent = info.p1Name.toUpperCase();
      this.p2Name.textContent = info.p2Name.toUpperCase();
    }

    this.setFighter(state.fighters[0], {
      hp: this.p1Hp,
      sta: this.p1Sta,
      mag: this.p1Mag,
      ult: this.p1Ult,
      phase: this.p1Phase,
      wins: this.p1Wins,
    });
    this.setFighter(state.fighters[1], {
      hp: this.p2Hp,
      sta: this.p2Sta,
      mag: this.p2Mag,
      ult: this.p2Ult,
      phase: this.p2Phase,
      wins: this.p2Wins,
    });

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
    } else {
      // Live callouts
      for (const e of state.events) {
        if (e.type === 'ultimate_ready') {
          banner = e.slot === 0 ? 'P1 AWAKENING READY' : 'P2 AWAKENING READY';
        } else if (e.type === 'ultimate_activated') {
          banner = 'AWAKENING!';
        } else if (e.type === 'resource_denied') {
          banner =
            e.resource === 'ultimate'
              ? 'NEED FULL AWAKENING'
              : e.resource === 'stamina'
                ? 'NO STAMINA'
                : 'NO MAGIC';
        }
      }
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

  flashUltimate(): void {
    this.ultFlash.hidden = false;
    this.ultFlash.classList.add('on');
    window.setTimeout(() => {
      this.ultFlash.classList.remove('on');
    }, 280);
  }

  private setFighter(
    f: FighterState,
    els: {
      hp: HTMLElement;
      sta: HTMLElement;
      mag: HTMLElement;
      ult: HTMLElement;
      phase: HTMLElement;
      wins: HTMLElement;
    },
  ): void {
    let maxHp = 1000;
    try {
      maxHp = getKit(f.id).base.hp;
    } catch {
      maxHp = 1000;
    }
    const ult = f.ultimate ?? f.flux ?? 0;
    els.hp.style.width = `${pct(f.hp, maxHp)}%`;
    els.sta.style.width = `${pct(f.stamina ?? 0, MAX_STAMINA)}%`;
    els.mag.style.width = `${pct(f.magic ?? 0, MAX_MAGIC)}%`;
    els.ult.style.width = `${pct(ult, MAX_ULTIMATE)}%`;
    els.ult.classList.toggle('full', ult >= MAX_ULTIMATE);
    els.phase.textContent = f.move ? `${f.phase}:${f.move.moveId}` : f.phase;
    els.wins.textContent = winsDots(f.wins);
  }
}

function pct(v: number, max: number): number {
  return Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100));
}

function el(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`#${id} missing`);
  return node;
}
