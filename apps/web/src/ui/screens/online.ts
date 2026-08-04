/**
 * ONLINE — live lobby feed backed by the SSE relay. SSE is intentionally
 * one-way; room actions are normal HTTP requests and all lobby clients receive
 * the resulting event on the shared stream.
 */

import { getRecords, rankFor } from '../../services/records';
import {
  publishRealtimeEvent,
  subscribeToRealtime,
  type RealtimeStatus,
} from '../../services/realtime';
import { getSettings } from '../../services/settings';
import { el, footerHints, ListNav, screenBackground } from '../components';
import type { ScreenFactory } from '../router';

function randomCode(): string {
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += letters[Math.floor(Math.random() * letters.length)];
  return out;
}

function statusText(status: RealtimeStatus): string {
  if (status === 'connected') return 'LIVE · SSE CONNECTED';
  if (status === 'connecting') return 'CONNECTING TO RELAY…';
  if (status === 'error') return 'RECONNECTING…';
  return 'RELAY OFFLINE';
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

  const connection = el('div', 'ae-note', 'CONNECTING TO RELAY…');
  connection.setAttribute('role', 'status');
  body.appendChild(connection);

  const listPanel = el('div', 'ae-panel');
  listPanel.style.minWidth = 'min(560px, 92vw)';
  const codeBox = el('div', 'ae-code-box', '—— —— ——');
  const activity = el('div', 'ae-note', 'Waiting for live lobby events…');
  activity.style.maxWidth = '560px';
  activity.style.textAlign = 'center';

  const notify = (message: string) => {
    activity.textContent = message;
  };

  const createRoom = async () => {
    const code = randomCode();
    codeBox.textContent = code.replace(/(...)/, '$1 ');
    try {
      await publishRealtimeEvent('room.created', { code, host: tag });
      notify(`Room ${code} created. Connected players receive this event instantly.`);
    } catch {
      notify('Could not create room: relay is unavailable. Start the SSE relay and retry.');
    }
  };

  const joinRoom = async () => {
    const code = window.prompt('Enter a six-character room code')?.trim().toUpperCase();
    if (!code) return;
    if (!/^[A-Z2-9]{6}$/.test(code)) {
      notify('Room code must contain six letters/numbers.');
      return;
    }
    codeBox.textContent = code.replace(/(...)/, '$1 ');
    try {
      await publishRealtimeEvent('room.joined', { code, player: tag });
      notify(`Join request for ${code} sent to the live lobby.`);
    } catch {
      notify('Could not join room: relay is unavailable.');
    }
  };

  const list = new ListNav({
    onConfirm: (item) => {
      if (item.id === 'create') void createRoom();
      if (item.id === 'join') void joinRoom();
    },
  });
  list.setItems([
    {
      id: 'casual',
      label: 'CASUAL MATCH',
      icon: '🌐',
      disabled: true,
      badge: { text: 'COMING SOON', tone: 'blue' },
    },
    {
      id: 'ranked',
      label: 'RANKED MATCH',
      icon: '🏅',
      disabled: true,
      badge: { text: 'COMING SOON', tone: 'blue' },
    },
    { id: 'create', label: 'CREATE ROOM', icon: '🛠️', badge: { text: 'LIVE', tone: 'gold' } },
    { id: 'join', label: 'JOIN ROOM', icon: '🔑', badge: { text: 'LIVE', tone: 'gold' } },
  ]);
  listPanel.appendChild(list.el);
  body.appendChild(listPanel);
  body.appendChild(codeBox);
  body.appendChild(activity);

  const unsubscribe = subscribeToRealtime(
    'lobby',
    (event) => {
      if (event.type === 'room.created')
        notify(
          `LIVE: ${String(event.data.host ?? 'A player')} created room ${String(event.data.code ?? '')}.`,
        );
      if (event.type === 'room.joined')
        notify(
          `LIVE: ${String(event.data.player ?? 'A player')} joined room ${String(event.data.code ?? '')}.`,
        );
    },
    (status) => {
      connection.textContent = statusText(status);
      connection.className = `ae-note ${status === 'connected' ? 'blue' : ''}`;
    },
  );

  root.appendChild(
    footerHints([
      ['Enter', 'select'],
      ['Esc', 'back'],
    ]),
  );
  return { el: root, onKey: (e) => list.handleKey(e), destroy: unsubscribe };
};
