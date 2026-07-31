/**
 * EXIT — browsers can't close tabs programmatically, so show a proper
 * curtain call with credits and a clean return path.
 */

import { el, screenBackground } from '../components';
import type { ScreenFactory } from '../router';

export const exitScreen: ScreenFactory = (ctx) => {
  const root = el('div', 'ae-screen');
  root.appendChild(screenBackground(6));

  const body = el('div', 'ae-body');
  body.style.flexDirection = 'column';
  body.style.alignItems = 'center';
  body.style.justifyContent = 'center';
  body.style.gap = '18px';

  const title = el('div', 'ae-big-announce gold', 'MATCH SET!');
  body.appendChild(title);
  body.appendChild(
    el('div', 'ae-header-side', 'Thanks for playing AETHER BREAK — close the tab to exit.'),
  );

  const credits = el('div', 'ae-panel');
  credits.style.textAlign = 'center';
  credits.style.minWidth = '320px';
  credits.appendChild(el('div', 'cc-title', 'AETHER BREAK GREYBOX'));
  const rows = [
    ['ENGINE', 'CombatCore · deterministic 60 Hz'],
    ['VISUALS', 'Procedural mesh / anim / VFX / SFX'],
    ['ROSTER', 'Nyra Vex · Bram Kade · Iria Sol · Kellan Wisp'],
  ];
  for (const [k, v] of rows) {
    const r = el('div', 'ae-setting-row');
    r.appendChild(el('div', 's-label', k));
    r.appendChild(el('div', 'cc-title', v));
    credits.appendChild(r);
  }
  body.appendChild(credits);

  const back = el('button', 'ae-btn ghost', 'BACK TO TITLE');
  back.addEventListener('click', () => ctx.back());
  body.appendChild(back);
  body.appendChild(el('div', 'ae-header-side', 'Esc — back'));

  root.appendChild(body);

  return {
    el: root,
    onKey: (e) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        ctx.back();
        return true;
      }
      return false;
    },
  };
};
