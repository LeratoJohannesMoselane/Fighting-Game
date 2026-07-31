/**
 * ARCADE — between-match flow screens.
 *   win     → STAGE CLEAR, next opponent reveal, continue/quit
 *   lose    → GAME OVER, retry same stage / forfeit
 *   victory → full ladder clear, trophy summary
 */

import { ARCADE_LADDER, arcadeStage, getMeta } from '../../roster';
import { getSettings } from '../../services/settings';
import { el, screenBackground } from '../components';
import { menuActions } from '../actions';
import { renderPortrait } from '../portrait';
import type { ScreenFactory } from '../router';

function progressDots(now: number, total: number, done: number): HTMLElement {
  const wrap = el('div', 'ae-progress-dots');
  for (let i = 0; i < total; i++) {
    wrap.appendChild(el('span', `dot${i < done ? ' done' : i === now ? ' now' : ''}`));
  }
  return wrap;
}

function center(el_: HTMLElement): HTMLElement {
  const body = el('div', 'ae-body');
  body.style.flexDirection = 'column';
  body.style.alignItems = 'center';
  body.style.justifyContent = 'center';
  body.style.gap = '16px';
  body.appendChild(el_);
  return body;
}

export const arcadeStatusScreen: ScreenFactory = (ctx) => {
  const result = (ctx.params.result as 'win' | 'lose' | 'victory') ?? 'win';
  const stageIndex = (ctx.params.stageIndex as number) ?? 0;
  const p1Id = (ctx.params.p1Id as string) ?? 'nyra_vex';
  const total = ARCADE_LADDER.length;

  // Returning to this screen after the match closes menus — mount as modal
  const root = el('div', 'ae-screen');
  root.appendChild(screenBackground(result === 'lose' ? 6 : 14));

  const wrap = el('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.alignItems = 'center';
  wrap.style.gap = '14px';

  const p1Name = getMeta(p1Id).name.toUpperCase();
  let confirm: () => void = () => ctx.back();

  if (result === 'win') {
    wrap.appendChild(el('div', 'ae-big-announce gold', `STAGE ${stageIndex + 1} CLEAR!`));
    wrap.appendChild(progressDots(stageIndex + 1, total, stageIndex + 1));

    const next = arcadeStage(stageIndex + 1);
    const nextMeta = getMeta(next.p2Id);
    const reveal = el('div', 'ae-panel');
    reveal.style.display = 'flex';
    reveal.style.alignItems = 'center';
    reveal.style.gap = '18px';
    const canvas = document.createElement('canvas');
    canvas.style.width = '130px';
    canvas.style.height = '130px';
    canvas.style.borderRadius = '12px';
    canvas.style.background = `radial-gradient(ellipse at 50% 88%, ${nextMeta.color}33, transparent 70%), rgba(0,0,0,0.4)`;
    try {
      renderPortrait(canvas, next.p2Id, getSettings().colorways.p2, { size: 190, tick: 42 });
    } catch {
      /* optional */
    }
    reveal.appendChild(canvas);
    const info = el('div');
    info.appendChild(el('div', 'cc-title', 'NEXT OPPONENT'));
    const nm = el('div', 'ae-big-announce', nextMeta.name.toUpperCase());
    nm.style.fontSize = '34px';
    nm.style.textAlign = 'left';
    info.appendChild(nm);
    info.appendChild(el('div', 'cc-diff', `${next.title} · ${next.difficulty.toUpperCase()} CPU`));
    reveal.appendChild(info);
    wrap.appendChild(reveal);

    const btns = el('div');
    btns.style.display = 'flex';
    btns.style.gap = '12px';
    const go = el('button', 'ae-btn', 'CONTINUE ⚔️');
    confirm = () => menuActions().launchArcadeStage(p1Id, stageIndex + 1);
    go.addEventListener('click', confirm);
    const quit = el('button', 'ae-btn ghost', 'QUIT RUN');
    quit.addEventListener('click', () => ctx.back());
    btns.append(go, quit);
    wrap.appendChild(btns);
    wrap.appendChild(el('div', 'ae-header-side', 'Enter continue · Esc quit run'));
  } else if (result === 'lose') {
    const announce = el('div', 'ae-big-announce', 'GAME OVER');
    announce.style.color = 'var(--ae-hot)';
    wrap.appendChild(announce);
    wrap.appendChild(progressDots(stageIndex, total, stageIndex));
    wrap.appendChild(
      el('div', 'ae-header-side', `${p1Name} fell at ${arcadeStage(stageIndex).title}`),
    );

    const btns = el('div');
    btns.style.display = 'flex';
    btns.style.gap = '12px';
    const retry = el('button', 'ae-btn gold', 'CONTINUE 💪');
    confirm = () => menuActions().launchArcadeStage(p1Id, stageIndex);
    retry.addEventListener('click', confirm);
    const give = el('button', 'ae-btn ghost', 'FORFEIT');
    give.addEventListener('click', () => ctx.back());
    btns.append(retry, give);
    wrap.appendChild(btns);
    wrap.appendChild(el('div', 'ae-header-side', 'Enter retry · Esc forfeit'));
  } else {
    const announce = el('div', 'ae-big-announce gold', '🏆 ARCADE COMPLETE!');
    wrap.appendChild(announce);
    wrap.appendChild(progressDots(total, total, total));
    wrap.appendChild(
      el('div', 'ae-header-side', `${p1Name} cleared the Ether Throne — ${total} straight wins`),
    );
    const btns = el('div');
    const back = el('button', 'ae-btn gold', 'MAIN MENU');
    confirm = () => ctx.back();
    back.addEventListener('click', confirm);
    btns.appendChild(back);
    wrap.appendChild(btns);
    wrap.appendChild(el('div', 'ae-header-side', 'Enter / Esc — main menu'));
  }

  root.appendChild(center(wrap));

  return {
    el: root,
    onKey: (e) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        confirm();
        return true;
      }
      return false; // Escape → router.back()
    },
  };
};
