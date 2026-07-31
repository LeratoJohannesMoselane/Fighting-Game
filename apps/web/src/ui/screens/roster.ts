/**
 * CHARACTERS → ROSTER — fighter gallery with live portraits, base stats,
 * and shortcuts into Move List / Cosmetics.
 */

import { getKit } from '@aether-break/combat-core';
import { ROSTER } from '../../roster';
import { getSettings } from '../../services/settings';
import { el, footerHints, screenBackground } from '../components';
import { renderPortrait } from '../portrait';
import type { ScreenFactory } from '../router';

export const rosterScreen: ScreenFactory = (ctx) => {
  let cursor = 0;

  const root = el('div', 'ae-screen');
  root.appendChild(screenBackground(10));

  const header = el('div', 'ae-header');
  header.appendChild(el('h2', '', 'ROSTER'));
  header.appendChild(el('div', 'ae-header-side', `${ROSTER.length} fighters`));
  root.appendChild(header);

  const body = el('div', 'ae-body');
  body.style.alignItems = 'flex-start';
  root.appendChild(body);

  const gridWrap = el('div', 'ae-col');
  gridWrap.style.flex = '1.4';
  const grid = el('div', 'ae-card-grid');
  gridWrap.appendChild(grid);

  const detailWrap = el('div', 'ae-col');
  detailWrap.style.flex = '1';
  const detail = el('div', 'ae-panel gold');
  detailWrap.appendChild(detail);
  body.append(gridWrap, detailWrap);

  function renderDetail(): void {
    const c = ROSTER[cursor]!;
    const kit = getKit(c.id);
    detail.replaceChildren();

    const top = el('div');
    top.style.display = 'flex';
    top.style.gap = '16px';
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    canvas.style.width = '150px';
    canvas.style.height = '150px';
    canvas.style.borderRadius = '12px';
    canvas.style.background = `radial-gradient(ellipse at 50% 88%, ${c.color}33, transparent 70%), rgba(0,0,0,0.35)`;
    try {
      renderPortrait(canvas, c.id, getSettings().colorways.p1, { size: 200, tick: 30 });
    } catch {
      /* optional */
    }
    top.appendChild(canvas);

    const info = el('div');
    info.style.minWidth = '0';
    const big = el('div', 'ae-big-announce', c.name.toUpperCase());
    big.style.fontSize = '30px';
    big.style.textAlign = 'left';
    info.appendChild(big);
    info.appendChild(el('div', 'cc-title', c.title));
    info.appendChild(el('div', 'cc-diff', '★'.repeat(c.difficulty) + '☆'.repeat(5 - c.difficulty)));

    const blurb = el('p', '', c.blurb);
    blurb.style.color = 'rgba(255,255,255,0.6)';
    blurb.style.fontSize = '13px';
    blurb.style.marginTop = '10px';
    info.appendChild(blurb);
    top.appendChild(info);
    detail.appendChild(top);

    const stats = el('div', 'ae-stat-row');
    stats.style.marginTop = '14px';
    const mk = (v: string, l: string) => {
      const s = el('div', 'ae-stat');
      s.appendChild(el('div', 'st-value', v));
      s.appendChild(el('div', 'st-label', l));
      return s;
    };
    stats.append(
      mk(String(kit.base.hp), 'HP'),
      mk(String(kit.base.walk), 'Walk'),
      mk(String(kit.base.dashSpeed), 'Dash'),
      mk(String(kit.moves.length), 'Moves'),
    );
    detail.appendChild(stats);

    const row = el('div');
    row.style.display = 'flex';
    row.style.gap = '10px';
    row.style.marginTop = '14px';
    const mv = el('button', 'ae-btn ghost', `MOVE LIST`);
    mv.addEventListener('click', () => ctx.navigate('movelist', { fighter: c.id }));
    const cz = el('button', 'ae-btn ghost', 'COSMETICS');
    cz.addEventListener('click', () => ctx.navigate('cosmetics', { fighter: c.id }));
    row.append(mv, cz);
    detail.appendChild(row);
  }

  function renderGrid(): void {
    grid.replaceChildren();
    ROSTER.forEach((c, i) => {
      const card = el('div', `ae-char-card${i === cursor ? ' cursor' : ''}`);
      card.style.setProperty('--cc', c.color);
      const canvas = document.createElement('canvas');
      canvas.className = 'cc-canvas';
      card.appendChild(canvas);
      card.appendChild(el('div', 'cc-name', c.name.toUpperCase()));
      card.appendChild(el('div', 'cc-title', c.archetype));
      card.addEventListener('mouseenter', () => {
        cursor = i;
        refresh();
      });
      card.addEventListener('click', () => {
        cursor = i;
        refresh();
      });
      grid.appendChild(card);
      try {
        renderPortrait(canvas, c.id, 'classic', { size: 170, tick: 26 + i * 9 });
      } catch {
        /* optional */
      }
    });
  }

  function refresh(): void {
    renderGrid();
    renderDetail();
  }

  root.appendChild(
    footerHints([
      ['A+D', 'browse'],
      ['Esc', 'back'],
    ]),
  );
  refresh();

  return {
    el: root,
    onKey: (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        cursor = (cursor - 1 + ROSTER.length) % ROSTER.length;
        refresh();
        return true;
      }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        cursor = (cursor + 1) % ROSTER.length;
        refresh();
        return true;
      }
      if (e.code === 'Enter' || e.code === 'Space') {
        ctx.navigate('movelist', { fighter: ROSTER[cursor]!.id });
        return true;
      }
      return false;
    },
  };
};
