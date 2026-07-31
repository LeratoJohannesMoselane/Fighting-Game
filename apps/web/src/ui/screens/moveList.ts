/**
 * CHARACTERS → MOVE LIST — every move with input, frame data
 * (startup / active / recovery bars), damage and resource costs.
 */

import { getKit, type MoveData } from '@aether-break/combat-core';
import { getMeta, ROSTER } from '../../roster';
import { TICK_RATE } from '@aether-break/combat-core';
import { el, footerHints, pager, screenBackground } from '../components';
import type { ScreenFactory } from '../router';

function moveCost(m: MoveData): string {
  const parts: string[] = [];
  if (m.staminaCost) parts.push(`${m.staminaCost} STA`);
  if (m.specialCost) parts.push(`${m.specialCost} SPEC`);
  if (m.magicCost) parts.push(`${m.magicCost} MAG`);
  if (m.ultimateCost) parts.push(`${m.ultimateCost} FLUX`);
  return parts.join(' · ') || '—';
}

function prettyName(id: string, fighterId: string): string {
  return id.replace(`${fighterId}_`, '').replace(/_/g, ' ').toUpperCase();
}

export const moveListScreen: ScreenFactory = (ctx) => {
  let fighterId = (ctx.params.fighter as string) ?? ROSTER[0]!.id;

  const root = el('div', 'ae-screen');
  root.appendChild(screenBackground(8));

  const header = el('div', 'ae-header');
  header.appendChild(el('h2', '', 'MOVE LIST'));
  const picker = el('div');
  const pg = pager({
    values: ROSTER.map((c) => ({ id: c.id, label: c.name.toUpperCase() })),
    current: Math.max(
      0,
      ROSTER.findIndex((c) => c.id === fighterId),
    ),
    onChange: (_i, id) => {
      fighterId = id;
      renderTable();
    },
  });
  picker.appendChild(pg.el);
  header.appendChild(picker);
  root.appendChild(header);

  const body = el('div', 'ae-body');
  body.style.flexDirection = 'column';
  const panel = el('div', 'ae-panel ae-scroll');
  panel.style.flex = '1';
  panel.style.minHeight = '0';
  body.appendChild(panel);
  root.appendChild(body);

  const table = el('table', 'ae-table');
  panel.appendChild(table);

  function renderTable(): void {
    const kit = getKit(fighterId);
    const meta = getMeta(fighterId);
    table.replaceChildren();

    const head = el('tr');
    for (const h of ['MOVE', 'INPUT', 'STARTUP', 'ACTIVE', 'RECOVERY', 'DMG', 'COST', 'FRAMES']) {
      head.appendChild(el('th', '', h));
    }
    const thead = document.createElement('thead');
    thead.appendChild(head);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const totalMax = Math.max(
      ...kit.moves.map((m) => m.startup + (m.active[1] - m.active[0] + 1) + m.recovery),
    );

    for (const m of kit.moves) {
      const tr = el('tr');
      if (m.isUltimate || m.input === 'ULTIMATE') {
        tr.style.background = 'rgba(255,215,0,0.05)';
      }
      const name = el('td', 'mv-name', prettyName(m.id, fighterId));
      if (m.isUltimate || m.input === 'ULTIMATE') name.style.color = 'var(--ae-gold)';
      tr.appendChild(name);
      tr.appendChild(el('td', 'mv-input', m.input));
      tr.appendChild(el('td', 'num', String(m.startup)));
      tr.appendChild(el('td', 'num', `${m.active[0]}–${m.active[1]}`));
      tr.appendChild(el('td', 'num', String(m.recovery)));
      tr.appendChild(el('td', 'num', String(m.onHit.damage)));
      tr.appendChild(el('td', 'mv-cost', moveCost(m)));

      const activeLen = m.active[1] - m.active[0] + 1;
      const total = m.startup + activeLen + m.recovery;
      const bar = el('div', 'ae-framebar');
      const start = el('div', 'fb-start');
      start.style.width = `${(m.startup / totalMax) * 100}%`;
      const act = el('div', 'fb-active');
      act.style.width = `${(activeLen / totalMax) * 100}%`;
      const rec = el('div', 'fb-rec');
      rec.style.width = `${(m.recovery / totalMax) * 100}%`;
      bar.append(start, act, rec);
      const cell = el('td');
      cell.title = `${total}f total ≈ ${(total / TICK_RATE).toFixed(2)}s`;
      cell.appendChild(bar);
      tr.appendChild(cell);

      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    const caption = el(
      'div',
      'cc-title',
      `${meta.name.toUpperCase()} · ${kit.moves.length} moves · frame data at ${TICK_RATE} fps`,
    );
    caption.style.marginTop = '12px';
    caption.style.textAlign = 'center';
    table.appendChild(caption);
  }

  root.appendChild(
    footerHints([
      ['A+D', 'change fighter'],
      ['Esc', 'back'],
    ]),
  );
  renderTable();

  return {
    el: root,
    onKey: (e) => {
      const idx = ROSTER.findIndex((c) => c.id === fighterId);
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        const n = (idx - 1 + ROSTER.length) % ROSTER.length;
        fighterId = ROSTER[n]!.id;
        pg.set(n);
        renderTable();
        return true;
      }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        const n = (idx + 1) % ROSTER.length;
        fighterId = ROSTER[n]!.id;
        pg.set(n);
        renderTable();
        return true;
      }
      return false;
    },
  };
};
