import {
  MAX_FLUX,
  MAX_STAMINA,
  TICK_RATE,
  comboCallout,
  getKit,
  getResourceProfile,
  staminaBand,
  type FighterState,
  type GameState,
} from '@aether-break/combat-core';

export interface HudMeta {
  p1Name: string;
  p2Name: string;
  opponentMode: 'cpu' | 'human';
  cpuDifficulty?: string;
  /** Game mode — training shows an infinite timer. */
  mode?: 'versus' | 'cpu' | 'arcade' | 'training';
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
  private readonly p1Special = el('p1-special');
  private readonly p2Special = el('p2-special');
  private readonly p1Phase = el('p1-phase');
  private readonly p2Phase = el('p2-phase');
  private readonly p1Wins = el('p1-wins');
  private readonly p2Wins = el('p2-wins');
  private readonly p1Name = el('p1-name');
  private readonly p2Name = el('p2-name');
  private readonly p1Awake = el('p1-awake');
  private readonly p2Awake = el('p2-awake');
  private readonly timer = el('timer');
  private readonly banner = el('banner');
  private readonly meta = el('match-meta');
  private readonly fpsEl = el('fps');
  private readonly flash = el('hit-flash');
  private readonly ultFlash = el('ult-flash');
  private readonly comboEl = el('combo-display');

  private frames = 0;
  private lastFpsTs = performance.now();
  private lastComboCallout = '';

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
      special: this.p1Special,
      phase: this.p1Phase,
      wins: this.p1Wins,
      awake: this.p1Awake,
    });
    this.setFighter(state.fighters[1], {
      hp: this.p2Hp,
      sta: this.p2Sta,
      mag: this.p2Mag,
      ult: this.p2Ult,
      special: this.p2Special,
      phase: this.p2Phase,
      wins: this.p2Wins,
      awake: this.p2Awake,
    });

    // Combo display — show higher active combo
    const c0 = state.fighters[0].comboCount ?? 0;
    const c1 = state.fighters[1].comboCount ?? 0;
    const best = Math.max(c0, c1);
    const callout = comboCallout(best);
    if (best >= 2) {
      this.comboEl.hidden = false;
      this.comboEl.innerHTML = `<div class="combo-count">${best}</div><div class="combo-text">${callout || 'HIT'}</div>`;
      if (callout && callout !== this.lastComboCallout && best >= 4) {
        this.lastComboCallout = callout;
      }
    } else {
      this.comboEl.hidden = true;
      this.lastComboCallout = '';
    }

    const isTraining = info?.mode === 'training';
    const secs = Math.ceil(state.timer / TICK_RATE);
    this.timer.textContent = isTraining ? '∞' : String(Math.max(0, secs));
    this.timer.style.color = isTraining ? 'var(--ae-blue, #00d2ff)' : '';

    const modeBit =
      info?.mode === 'training'
        ? 'TRAINING'
        : info?.mode === 'arcade'
          ? 'ARCADE'
          : info?.opponentMode === 'cpu'
            ? `CPU ${info.cpuDifficulty ?? ''}`.trim()
            : '2P';
    this.meta.textContent = isTraining
      ? `TRAINING · ${modeBit} · tick ${state.tick}`
      : `Round ${state.round} · BEST OF 3 · ${modeBit} · tick ${state.tick}`;

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
      for (const e of state.events) {
        if (e.type === 'ultimate_ready') {
          banner = e.slot === 0 ? 'P1 FLUX MAX' : 'P2 FLUX MAX';
        } else if (e.type === 'ultimate_activated') {
          banner = 'ULTIMATE!';
        } else if (e.type === 'awakening_activated') {
          banner = e.slot === 0 ? 'P1 AWAKENED' : 'P2 AWAKENED';
        } else if (e.type === 'guard_crush') {
          banner = 'GUARD CRUSH!';
        } else if (e.type === 'combo_update' && e.callout) {
          banner = e.callout;
        } else if (e.type === 'resource_denied') {
          banner =
            e.resource === 'flux' || e.resource === 'ultimate'
              ? 'NEED FLUX'
              : e.resource === 'stamina'
                ? 'NO STAMINA'
                : e.resource === 'special'
                  ? 'NO AMMO/CHARGE'
                  : 'DENIED';
        }
      }
    }
    this.banner.textContent = banner;

    // Screen awakening vignette class on stage
    const stage = document.querySelector('.stage-wrap');
    if (stage) {
      const anyAwake = state.fighters.some((f) => f.awakened);
      stage.classList.toggle('awakened-stage', anyAwake);
    }

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
      special: HTMLElement;
      phase: HTMLElement;
      wins: HTMLElement;
      awake: HTMLElement;
    },
  ): void {
    let maxHp = 1000;
    try {
      maxHp = f.maxHp || getKit(f.id).base.hp;
    } catch {
      maxHp = 1000;
    }
    const flux = f.flux ?? f.ultimate ?? 0;
    els.hp.style.width = `${pct(f.hp, maxHp)}%`;
    els.sta.style.width = `${pct(f.stamina ?? 0, MAX_STAMINA)}%`;
    // Stamina band color
    const band = staminaBand(f.stamina ?? 0);
    els.sta.className = 'fill sta-' + band;
    els.sta.parentElement?.classList.toggle(
      'critical-pulse',
      band === 'critical' || band === 'empty',
    );

    // Magic bar shows special as % for ammo/charges, or inverse heat
    const profile = getResourceProfile(f.id);
    const specMax = Math.max(1, f.specialMax || profile.special.max || 1);
    let magPct = f.magic ?? 0;
    if (profile.special.kind === 'ammo' || profile.special.kind === 'charges') {
      magPct = ((f.special ?? 0) * 100) / specMax;
    } else if (profile.special.kind === 'heat') {
      magPct = f.special ?? 0;
    }
    els.mag.style.width = `${Math.max(0, Math.min(100, magPct))}%`;
    els.mag.classList.toggle('heat-hot', profile.special.kind === 'heat' && (f.special ?? 0) > 70);

    els.ult.style.width = `${pct(flux, MAX_FLUX)}%`;
    els.ult.classList.toggle('full', flux >= MAX_FLUX);

    // Special icons / orbs
    this.renderSpecial(els.special, f, profile.special.display, profile.special.label, specMax);

    els.phase.textContent = f.move
      ? `${f.phase}:${f.move.moveId}`
      : f.awakened
        ? `AWAKENED ${Math.ceil((f.awakeningTimer ?? 0) / 60)}s`
        : f.phase;
    els.wins.textContent = winsDots(f.wins);
    els.awake.hidden = !f.awakened;
    els.awake.textContent = '⚡ AWAKENED';
  }

  private renderSpecial(
    el: HTMLElement,
    f: FighterState,
    display: string,
    label: string,
    max: number,
  ): void {
    if (display === 'hidden' || max <= 0) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const cur = f.special ?? 0;
    if (display === 'ammo' || display === 'orbs') {
      let html = `<span class="special-label">${label}</span><span class="special-icons">`;
      for (let i = 0; i < max; i++) {
        html += `<i class="orb ${i < cur ? 'on' : 'off'}"></i>`;
      }
      html += '</span>';
      el.innerHTML = html;
    } else {
      el.innerHTML = `<span class="special-label">${label}</span><span class="special-meter"><i style="width:${pct(cur, max)}%"></i></span>`;
    }
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
