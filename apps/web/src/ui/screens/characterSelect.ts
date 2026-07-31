/**
 * CHARACTER SELECT — sequential P1 → P2 (or CPU) lock-in with live
 * procedural portraits, colorway paging, difficulty/dummy pagers and
 * an arcade stage banner. Confirm flow: pick P1, pick P2, FIGHT.
 */

import { COLORWAYS } from '../../procedural/colorways';
import { arcadeStage, ROSTER, type GameMode, type MatchConfig } from '../../roster';
import { getSettings, updateSettings } from '../../services/settings';
import { el, footerHints, pager, screenBackground } from '../components';
import { menuActions } from '../actions';
import { renderPortrait } from '../portrait';
import type { ScreenFactory } from '../router';

type Phase = 'p1' | 'p2' | 'ready';

const MODE_LABEL: Record<GameMode, string> = {
  versus: 'VERSUS — LOCAL PVP',
  cpu: 'VERSUS — VS CPU',
  arcade: 'ARCADE LADDER',
  training: 'TRAINING — PRACTICE',
};

const DIFFS = [
  { id: 'easy', label: 'EASY' },
  { id: 'normal', label: 'NORMAL' },
  { id: 'hard', label: 'HARD' },
] as const;

const DUMMIES = [
  { id: 'stand', label: 'DUMMY: STAND' },
  { id: 'guard', label: 'DUMMY: GUARD' },
  { id: 'cpu', label: 'DUMMY: CPU' },
] as const;

export const characterSelectScreen: ScreenFactory = (ctx) => {
  const mode = (ctx.params.mode as GameMode) ?? 'versus';
  const stageIdx = (ctx.params.arcadeStage as number) ?? 0;
  const stage = arcadeStage(stageIdx);
  const isArcade = mode === 'arcade';
  const isCpu = mode === 'cpu' || isArcade || mode === 'training';

  const settings = getSettings();
  const p1 = { id: ROSTER[0]!.id, way: settings.colorways.p1 };
  const p2 = {
    id: isArcade ? stage.p2Id : ROSTER[1]!.id,
    way: settings.colorways.p2,
  };
  let difficulty: 'easy' | 'normal' | 'hard' = isArcade ? stage.difficulty : 'normal';
  let dummy: 'stand' | 'guard' | 'cpu' = 'stand';

  let phase: Phase = 'p1';
  let cursor = 0;

  /* ---------- DOM skeleton ---------- */

  const root = el('div', 'ae-screen');
  root.appendChild(screenBackground());

  const header = el('div', 'ae-header');
  header.appendChild(el('h2', '', 'SELECT YOUR FIGHTER'));
  const headerSide = el('div', 'ae-header-side');
  header.appendChild(headerSide);
  root.appendChild(header);

  const turnIndicator = el('div', 'ae-big-announce blue');
  turnIndicator.style.fontSize = '26px';

  const body = el('div', 'ae-body');
  body.style.flexDirection = 'column';
  body.style.alignItems = 'center';
  body.style.gap = '16px';
  root.appendChild(body);

  const grid = el('div', 'ae-card-grid');
  grid.style.width = 'min(860px, 94vw)';
  body.appendChild(grid);

  const controlRow = el('div');
  controlRow.style.display = 'flex';
  controlRow.style.gap = '34px';
  controlRow.style.flexWrap = 'wrap';
  controlRow.style.justifyContent = 'center';
  controlRow.style.alignItems = 'center';
  body.appendChild(controlRow);

  const fightWrap = el('div');
  fightWrap.style.marginTop = '8px';
  body.appendChild(fightWrap);

  /* ---------- pieces ---------- */

  const wayOf = (player: 1 | 2) => (player === 1 ? p1.way : p2.way);

  function makeColorwayPager(player: 1 | 2): HTMLElement {
    const holder = el('div');
    holder.appendChild(el('div', 's-label', player === 1 ? 'P1 COLORWAY' : 'P2 COLORWAY'));
    const wrap = el('div');
    wrap.style.justifyContent = 'center';
    wrap.style.marginTop = '4px';
    const pg = pager({
      values: COLORWAYS.map((c) => ({ id: c.id, label: c.name })),
      current: Math.max(
        0,
        COLORWAYS.findIndex((c) => c.id === wayOf(player)),
      ),
      onChange: (_i, id) => {
        setColorway(player, id);
      },
    });
    wrap.className = 'ae-pager';
    wrap.appendChild(pg.el);
    holder.appendChild(wrap);
    // keep a handle so keyboard Q/E cycling can reuse the pager UI
    holder.dataset.player = String(player);
    (holder as unknown as { __pager: typeof pg }).__pager = pg;
    return holder;
  }

  function setColorway(player: 1 | 2, id: string): void {
    if (player === 1) {
      p1.way = id;
      updateSettings((s) => (s.colorways.p1 = id));
    } else {
      p2.way = id;
      updateSettings((s) => (s.colorways.p2 = id));
    }
    renderGrid();
  }

  const p1PagerEl = makeColorwayPager(1);
  const p2PagerEl = makeColorwayPager(2);

  function cycleColorway(player: 1 | 2, d: 1 | -1): void {
    const holder = player === 1 ? p1PagerEl : p2PagerEl;
    const pg = (holder as unknown as { __pager: { set: (i: number) => void } }).__pager;
    const cur = COLORWAYS.findIndex((c) => c.id === wayOf(player));
    pg.set((cur + d + COLORWAYS.length) % COLORWAYS.length);
    setColorway(player, COLORWAYS[(cur + d + COLORWAYS.length) % COLORWAYS.length]!.id);
  }

  function makeDifficultyPager(): HTMLElement {
    const holder = el('div');
    holder.appendChild(el('div', 's-label', 'CPU LEVEL'));
    const wrap = el('div');
    wrap.className = 'ae-pager';
    wrap.style.marginTop = '4px';
    wrap.appendChild(
      pager({
        values: DIFFS.map((d) => ({ id: d.id as string, label: d.label })),
        current: Math.max(
          0,
          DIFFS.findIndex((d) => d.id === difficulty),
        ),
        onChange: (_i, id) => {
          difficulty = id as typeof difficulty;
        },
      }).el,
    );
    holder.appendChild(wrap);
    return holder;
  }

  function makeDummyPager(): HTMLElement {
    const holder = el('div');
    holder.appendChild(el('div', 's-label', 'TRAINING DUMMY'));
    const wrap = el('div');
    wrap.className = 'ae-pager';
    wrap.style.marginTop = '4px';
    wrap.appendChild(
      pager({
        values: DUMMIES.map((d) => ({ id: d.id as string, label: d.label })),
        current: 0,
        onChange: (_i, id) => {
          dummy = id as typeof dummy;
        },
      }).el,
    );
    holder.appendChild(wrap);
    return holder;
  }

  /* ---------- grid ---------- */

  function renderGrid(): void {
    grid.replaceChildren();
    ROSTER.forEach((c, i) => {
      const card = el('div', 'ae-char-card');
      card.style.setProperty('--cc', c.color);
      card.dataset.id = c.id;
      const isP1 = phase !== 'p1' && c.id === p1.id;
      const isP2 = phase === 'ready' && c.id === p2.id;
      const isCursor = phase !== 'ready' && i === cursor;
      if (isCursor) card.classList.add('cursor');
      if (isP1) card.classList.add('locked-p1');
      if (isP2) card.classList.add('locked-p2');

      const canvas = document.createElement('canvas');
      canvas.className = 'cc-canvas';
      card.appendChild(canvas);
      if (isP1) card.appendChild(el('div', 'cc-tag p1', 'P1'));
      if (isP2) card.appendChild(el('div', 'cc-tag p2', isCpu ? 'CPU' : 'P2'));

      card.appendChild(el('div', 'cc-name', c.name.toUpperCase()));
      card.appendChild(el('div', 'cc-title', c.title));
      card.appendChild(
        el('div', 'cc-diff', '★'.repeat(c.difficulty) + '☆'.repeat(5 - c.difficulty)),
      );

      card.addEventListener('mouseenter', () => {
        if (phase === 'ready') return;
        cursor = i;
        renderGrid();
      });
      card.addEventListener('click', () => {
        if (phase === 'ready') return;
        cursor = i;
        confirmPick();
      });

      grid.appendChild(card);

      const way = i === cursor && phase !== 'ready' ? wayOf(phase === 'p1' ? 1 : 2) : 'classic';
      try {
        renderPortrait(canvas, c.id, way, { size: 190, tick: 30 + i * 9 });
      } catch {
        /* portrait optional */
      }
    });
  }

  function renderControls(): void {
    controlRow.replaceChildren();
    controlRow.appendChild(p1PagerEl);
    if (phase !== 'p1') controlRow.appendChild(p2PagerEl);
    if (isCpu && !isArcade && mode !== 'training') controlRow.appendChild(makeDifficultyPager());
    if (mode === 'training') controlRow.appendChild(makeDummyPager());
  }

  function renderHeader(): void {
    const stageLabel = isArcade
      ? `${stage.title} — ${stage.difficulty.toUpperCase()} CPU`
      : MODE_LABEL[mode];
    headerSide.textContent = stageLabel;
    if (phase === 'p1') {
      turnIndicator.textContent = 'PLAYER 1 — CHOOSE CHARACTER';
      turnIndicator.className = 'ae-big-announce blue';
    } else if (phase === 'p2') {
      turnIndicator.textContent = isCpu ? 'CHOOSE YOUR OPPONENT' : 'PLAYER 2 — CHOOSE CHARACTER';
      turnIndicator.className = 'ae-big-announce';
    } else {
      turnIndicator.textContent = 'READY';
      turnIndicator.className = 'ae-big-announce gold';
    }
    turnIndicator.style.fontSize = '26px';
    if (!turnIndicator.isConnected) body.insertBefore(turnIndicator, grid);
  }

  function renderFight(): void {
    fightWrap.replaceChildren();
    if (phase !== 'ready') return;
    const btn = el('button', 'ae-btn', isArcade ? `FIGHT · ${stage.title}` : 'FIGHT ⚔️');
    btn.addEventListener('click', launch);
    fightWrap.appendChild(btn);
  }

  /* ---------- flow ---------- */

  function confirmPick(): void {
    const picked = ROSTER[cursor];
    if (!picked) return;
    if (phase === 'p1') {
      p1.id = picked.id;
      if (isArcade) {
        // opponent is fixed by the ladder
        p2.id = stage.p2Id;
        difficulty = stage.difficulty;
        phase = 'ready';
        cursor = ROSTER.findIndex((c) => c.id === p2.id);
      } else {
        phase = 'p2';
        cursor = ROSTER.findIndex((c) => c.id === p2.id);
      }
    } else if (phase === 'p2') {
      p2.id = picked.id;
      phase = 'ready';
    } else {
      launch();
      return;
    }
    refresh();
  }

  function stepBack(): boolean {
    if (phase === 'ready') {
      phase = isArcade ? 'p1' : 'p2';
      refresh();
      return true;
    }
    if (phase === 'p2') {
      phase = 'p1';
      cursor = ROSTER.findIndex((c) => c.id === p1.id);
      refresh();
      return true;
    }
    return false; // let router pop the screen
  }

  function launch(): void {
    const cfg: MatchConfig = {
      p1Id: p1.id,
      p2Id: p2.id,
      opponentMode: mode === 'versus' ? 'human' : 'cpu',
      cpuDifficulty: difficulty,
      mode,
      ...(mode === 'training' ? { training: { dummy } } : {}),
      ...(isArcade ? { arcadeStage: stageIdx } : {}),
    };
    menuActions().launch(cfg);
  }

  function refresh(): void {
    renderHeader();
    renderGrid();
    renderControls();
    renderFight();
  }

  root.appendChild(
    footerHints([
      ['A+D', 'browse'],
      ['Enter', 'confirm'],
      ['Q+E', 'colorway'],
      ['Backspace', 'back'],
    ]),
  );

  refresh();

  return {
    el: root,
    onKey: (e) => {
      if (e.code === 'Escape' || e.code === 'Backspace') {
        return stepBack();
      }
      if (phase !== 'ready') {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          cursor = (cursor - 1 + ROSTER.length) % ROSTER.length;
          renderGrid();
          return true;
        }
        if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          cursor = (cursor + 1) % ROSTER.length;
          renderGrid();
          return true;
        }
        if (e.code === 'KeyQ') {
          cycleColorway(phase === 'p1' ? 1 : 2, -1);
          return true;
        }
        if (e.code === 'KeyE') {
          cycleColorway(phase === 'p1' ? 1 : 2, 1);
          return true;
        }
      }
      if (e.code === 'Enter' || e.code === 'Space') {
        confirmPick();
        return true;
      }
      return false;
    },
  };
};
