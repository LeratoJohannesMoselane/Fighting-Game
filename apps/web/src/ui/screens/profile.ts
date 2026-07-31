/**
 * PROFILE — Stats / History / Settings tabs. LocalStorage-backed
 * records: totals, per-character, per-mode, and match history.
 */

import { ROSTER } from '../../roster';
import {
  clearRecords,
  displayName,
  favoriteFighter,
  getRecords,
  rankFor,
} from '../../services/records';
import { getSettings, updateSettings } from '../../services/settings';
import { el, footerHints, screenBackground, tabs } from '../components';
import type { ScreenFactory } from '../router';

export const profileScreen: ScreenFactory = (ctx) => {
  let tab = (ctx.params.tab as string) ?? 'stats';

  const root = el('div', 'ae-screen');
  root.appendChild(screenBackground(8));

  const header = el('div', 'ae-header');
  header.appendChild(el('h2', '', 'PROFILE'));
  header.appendChild(el('div', 'ae-header-side', getSettings().profile.tag || 'GUEST'));
  root.appendChild(header);

  const body = el('div', 'ae-body');
  body.style.flexDirection = 'column';
  root.appendChild(body);

  const content = el('div', 'ae-panel ae-scroll');
  content.style.flex = '1';
  content.style.minHeight = '0';

  const tabCtl = tabs(
    [
      { id: 'stats', label: 'STATS' },
      { id: 'history', label: 'HISTORY' },
      { id: 'settings', label: 'SETTINGS' },
    ],
    tab,
    (id) => {
      tab = id;
      renderTab();
    },
  );
  body.appendChild(tabCtl.el);
  body.appendChild(content);

  function renderStats(): void {
    const rec = getRecords();
    content.replaceChildren();

    const row = el('div', 'ae-stat-row');
    const mk = (v: string, l: string) => {
      const s = el('div', 'ae-stat');
      s.appendChild(el('div', 'st-value', v));
      s.appendChild(el('div', 'st-label', l));
      return s;
    };
    const total = rec.totals.wins + rec.totals.losses;
    const wr = total > 0 ? `${Math.round((rec.totals.wins / total) * 100)}%` : '—';
    row.append(
      mk(String(rec.totals.wins), 'Wins'),
      mk(String(rec.totals.losses), 'Losses'),
      mk(String(rec.totals.draws), 'Draws'),
      mk(wr, 'Win Rate'),
      mk(rankFor(rec), 'Rank'),
    );
    content.appendChild(row);

    const fav = favoriteFighter();
    if (fav) {
      const n = el('div', 'ae-note', `Favorite fighter: ${displayName(fav).toUpperCase()}`);
      n.style.margin = '16px 0 0';
      content.appendChild(n);
    }

    const ids = ROSTER.map((c) => c.id);
    const hasData = ids.some((id) => rec.perChar[id]);
    const h3 = el('h3', '', 'PER-FIGHTER RECORD');
    h3.style.letterSpacing = '0.2em';
    h3.style.color = 'var(--ae-gold)';
    h3.style.fontSize = '13px';
    h3.style.margin = '22px 0 8px';
    content.appendChild(h3);
    if (!hasData) {
      content.appendChild(el('div', 'ae-empty', 'No matches yet — go fight!'));
      return;
    }
    const table = el('table', 'ae-table');
    const thead = document.createElement('thead');
    const hr = el('tr');
    for (const h of ['FIGHTER', 'W', 'L', 'WIN RATE']) hr.appendChild(el('th', '', h));
    thead.appendChild(hr);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    for (const id of ids) {
      const s = rec.perChar[id];
      if (!s) continue;
      const tr = el('tr');
      tr.appendChild(el('td', 'mv-name', displayName(id).toUpperCase()));
      tr.appendChild(el('td', 'num', String(s.w)));
      tr.appendChild(el('td', 'num', String(s.l)));
      const w = s.w + s.l > 0 ? `${Math.round((s.w / (s.w + s.l)) * 100)}%` : '—';
      tr.appendChild(el('td', 'num', w));
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    content.appendChild(table);
  }

  function renderHistory(): void {
    const rec = getRecords();
    content.replaceChildren();
    if (rec.history.length === 0) {
      content.appendChild(
        el('div', 'ae-empty', 'No recorded matches. History keeps the last 25 results.'),
      );
      return;
    }
    const table = el('table', 'ae-table');
    const thead = document.createElement('thead');
    const hr = el('tr');
    for (const h of ['WHEN', 'MODE', 'MATCHUP', 'RESULT', 'ROUNDS'])
      hr.appendChild(el('th', '', h));
    thead.appendChild(hr);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    for (const r of rec.history) {
      const tr = el('tr');
      const d = new Date(r.ts);
      tr.appendChild(
        el(
          'td',
          '',
          `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        ),
      );
      tr.appendChild(el('td', 'mv-input', r.mode.toUpperCase()));
      tr.appendChild(el('td', 'mv-name', `${displayName(r.p1)} vs ${displayName(r.p2)}`));
      const res = r.winner === 0 ? 'WON' : r.winner === 1 ? 'LOST' : 'DRAW';
      const resTd = el('td', 'mv-name', res);
      resTd.style.color =
        r.winner === 0 ? 'var(--ae-gold)' : r.winner === 1 ? 'var(--ae-hot)' : 'var(--ae-dim)';
      tr.appendChild(resTd);
      tr.appendChild(el('td', 'num', `${r.rounds[0]}–${r.rounds[1]}`));
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    content.appendChild(table);
  }

  function renderSettings(): void {
    content.replaceChildren();

    const row = el('div', 'ae-setting-row');
    const l = el('div', 's-label', 'PLAYER TAG');
    l.appendChild(el('span', 's-desc', 'Shown in the main menu and online lobby'));
    const input = el('input', 'ae-input') as HTMLInputElement;
    input.maxLength = 12;
    input.value = getSettings().profile.tag;
    input.addEventListener('input', () => {
      updateSettings((s) => (s.profile.tag = input.value.toUpperCase().slice(0, 12) || 'GUEST'));
    });
    input.addEventListener('keydown', (e) => e.stopPropagation());
    row.append(l, input);
    content.appendChild(row);

    const danger = el('div', 'ae-setting-row');
    const dl = el('div', 's-label', 'CLEAR RECORDS');
    dl.appendChild(el('span', 's-desc', 'Wipe stats and match history'));
    const btn = el('button', 'ae-btn ghost', 'CLEAR');
    btn.addEventListener('click', () => {
      if (btn.dataset.armed) {
        clearRecords();
        btn.textContent = 'CLEARED';
        delete btn.dataset.armed;
        setTimeout(() => (btn.textContent = 'CLEAR'), 1200);
      } else {
        btn.dataset.armed = '1';
        btn.textContent = 'SURE?';
        setTimeout(() => {
          delete btn.dataset.armed;
          btn.textContent = 'CLEAR';
        }, 2500);
      }
    });
    danger.append(dl, btn);
    content.appendChild(danger);

    const note = el(
      'div',
      'ae-note',
      'Records, settings and control bindings live in your browser (localStorage) — no account needed.',
    );
    note.style.marginTop = '18px';
    content.appendChild(note);
  }

  function renderTab(): void {
    if (tab === 'stats') renderStats();
    else if (tab === 'history') renderHistory();
    else renderSettings();
  }

  root.appendChild(footerHints([['Esc', 'back']]));
  renderTab();

  return { el: root, onKey: () => false };
};
