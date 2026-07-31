/**
 * ONLINE — matchmaking lobby UI. The netcode/relay lands in a future
 * milestone, so the lobby presents real flows (casual queue, room codes)
 * with honest "offline build" gating instead of dead ends.
 */

import { getRecords, rankFor } from '../../services/records';
import { getSettings } from '../../services/settings';
import { el, footerHints, ListNav, screenBackground } from '../components';
import type { ScreenFactory } from '../router';

function randomCode(): string {
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += letters[Math.floor(Math.random() * letters.length)];
  return out;
}

export const onlineScreen: ScreenFactory = () => {
  const root = el('div', 'ae-screen');
  root.appendChild(screenBackground(14));

  const header = el('div', 'ae-header');
  header.appendChild(el('h2', '', 'ONLINE'));
  const tag = getSettings().profile.tag || 'GUEST';
  header.appendChild(el('div', 'ae-header-side', `${tag} · ${rankFor(getRecords())}`));
  root.appendChild(header);

  const body = el('div', 'ae-body');
  body.style.flexDirection = 'column';
  body.style.alignItems = 'center';
  body.style.gap = '18px';
  root.appendChild(body);

  const banner = el('div', 'ae-big-announce blue', 'ETHERNET LOBBY');
  banner.style.fontSize = '30px';
  banner.style.marginTop = '6px';
  body.appendChild(banner);

  const listPanel = el('div', 'ae-panel');
  listPanel.style.minWidth = 'min(560px, 92vw)';

  const codeBox = el('div', 'ae-code-box', '—— —— ——');

  const list = new ListNav({
    onConfirm: () => {
      /* gated — see note */
    },
  });
  list.setItems([
    {
      id: 'casual',
      label: 'CASUAL MATCH',
      icon: '🌐',
      disabled: true,
      badge: { text: 'OFFLINE BUILD', tone: 'blue' },
    },
    {
      id: 'ranked',
      label: 'RANKED MATCH',
      icon: '🏅',
      disabled: true,
      badge: { text: 'OFFLINE BUILD', tone: 'blue' },
    },
    { id: 'create', label: 'CREATE ROOM', icon: '🛠️', badge: { text: 'UI READY', tone: 'gold' } },
    { id: 'join', label: 'JOIN ROOM', icon: '🔑', badge: { text: 'UI READY', tone: 'gold' } },
  ]);
  listPanel.appendChild(list.el);
  body.appendChild(listPanel);
  body.appendChild(codeBox);

  const note = el(
    'div',
    'ae-note',
    'Matchmaking needs the relay server build (WebRTC rooms + rollback sync). The lobby UI is wired and ready; until the server lands, fight locally via VERSUS or vs CPU.',
  );
  note.style.maxWidth = '560px';
  note.style.textAlign = 'center';
  body.appendChild(note);

  // Room interactions (local mock): create shows a code; join focuses the box
  list.el.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest('.ae-item') as HTMLElement | null;
    if (!t) return;
    if (t.dataset.id === 'create') codeBox.textContent = randomCode().replace(/(...)/, '$1 ');
    if (t.dataset.id === 'join') {
      codeBox.textContent = 'ENTER CODE…';
      codeBox.focus();
    }
  });

  root.appendChild(footerHints([['Esc', 'back']]));

  return {
    el: root,
    onKey: (e) => list.handleKey(e),
  };
};
