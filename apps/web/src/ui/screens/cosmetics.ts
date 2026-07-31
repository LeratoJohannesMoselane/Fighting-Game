/**
 * CHARACTERS → COSMETICS — colorway picker per player slot with live
 * procedural portrait previews. Selection persists and is applied at
 * match start (meshes, gradients and VFX all reskin).
 */

import { COLORWAYS } from '../../procedural/colorways';
import { getMeta, ROSTER } from '../../roster';
import { getSettings, updateSettings } from '../../services/settings';
import { el, footerHints, pager, screenBackground, tabs } from '../components';
import { renderPortrait } from '../portrait';
import type { ScreenFactory } from '../router';

export const cosmeticsScreen: ScreenFactory = (ctx) => {
  let fighterId = (ctx.params.fighter as string) ?? ROSTER[0]!.id;
  let slot: 'p1' | 'p2' = 'p1';

  const root = el('div', 'ae-screen');
  root.appendChild(screenBackground(8));

  const header = el('div', 'ae-header');
  header.appendChild(el('h2', '', 'COSMETICS'));

  const fighterPager = pager({
    values: ROSTER.map((c) => ({ id: c.id, label: c.name.toUpperCase() })),
    current: Math.max(
      0,
      ROSTER.findIndex((c) => c.id === fighterId),
    ),
    onChange: (_i, id) => {
      fighterId = id;
      renderCards();
    },
  });
  header.appendChild(fighterPager.el);
  root.appendChild(header);

  const body = el('div', 'ae-body');
  body.style.flexDirection = 'column';
  body.style.alignItems = 'center';
  root.appendChild(body);

  const tabCtl = tabs(
    [
      { id: 'p1', label: 'P1 COLORWAY' },
      { id: 'p2', label: 'P2 COLORWAY' },
    ],
    'p1',
    (id) => {
      slot = id as 'p1' | 'p2';
      renderCards();
    },
  );
  tabCtl.el.style.width = 'min(640px, 90vw)';
  body.appendChild(tabCtl.el);

  const note = el(
    'div',
    'ae-note',
    'Colorways are live palette rotations — the fighter mesh, cel gradients and hit VFX all reskin. Applied to your next match.',
  );
  note.style.maxWidth = '640px';
  note.style.marginBottom = '8px';
  body.appendChild(note);

  const grid = el('div', 'ae-card-grid');
  grid.style.width = 'min(860px, 94vw)';
  body.appendChild(grid);

  function currentWay(): string {
    return getSettings().colorways[slot];
  }

  function renderCards(): void {
    grid.replaceChildren();
    for (const way of COLORWAYS) {
      const selected = currentWay() === way.id;
      const card = el('div', `ae-char-card${selected ? ' cursor' : ''}`);
      card.style.setProperty('--cc', getMeta(fighterId).color);
      const canvas = document.createElement('canvas');
      canvas.className = 'cc-canvas';
      card.appendChild(canvas);
      card.appendChild(el('div', 'cc-name', way.name));
      card.appendChild(
        el(
          'div',
          'cc-title',
          selected ? `EQUIPPED — ${slot.toUpperCase()}` : `EQUIP TO ${slot.toUpperCase()}`,
        ),
      );
      card.addEventListener('click', () => {
        updateSettings((s) => {
          if (slot === 'p1') s.colorways.p1 = way.id;
          else s.colorways.p2 = way.id;
        });
        renderCards();
      });
      grid.appendChild(card);
      try {
        renderPortrait(canvas, fighterId, way.id, { size: 190, tick: 34 });
      } catch {
        /* optional */
      }
    }
  }

  root.appendChild(
    footerHints([
      ['W+S', 'player slot'],
      ['A+D', 'fighter'],
      ['Enter', 'equip'],
      ['Esc', 'back'],
    ]),
  );
  renderCards();

  return {
    el: root,
    onKey: (e) => {
      if (
        e.code === 'ArrowUp' ||
        e.code === 'KeyW' ||
        e.code === 'ArrowDown' ||
        e.code === 'KeyS'
      ) {
        slot = slot === 'p1' ? 'p2' : 'p1';
        tabCtl.select(slot);
        return true;
      }
      const idx = ROSTER.findIndex((c) => c.id === fighterId);
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        fighterId = ROSTER[(idx - 1 + ROSTER.length) % ROSTER.length]!.id;
        fighterPager.set(ROSTER.findIndex((c) => c.id === fighterId));
        renderCards();
        return true;
      }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        fighterId = ROSTER[(idx + 1) % ROSTER.length]!.id;
        fighterPager.set(ROSTER.findIndex((c) => c.id === fighterId));
        renderCards();
        return true;
      }
      if (e.code === 'Enter' || e.code === 'Space') {
        // cycle to next colorway
        const cur = COLORWAYS.findIndex((c) => c.id === currentWay());
        const next = COLORWAYS[(cur + 1) % COLORWAYS.length]!;
        updateSettings((s) => {
          if (slot === 'p1') s.colorways.p1 = next.id;
          else s.colorways.p2 = next.id;
        });
        renderCards();
        return true;
      }
      return false;
    },
  };
};
