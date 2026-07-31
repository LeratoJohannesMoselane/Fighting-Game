/**
 * MAIN MENU — title column with flyout submenus (SF6 style).
 *
 * FIGHT ▸        VERSUS · TRAINING · ARCADE · ONLINE
 * TRAINING ▸     PRACTICE · COMBO TRIALS(soon) · TUTORIAL(soon)
 * CHARACTERS ▸   ROSTER · MOVE LIST · COSMETICS
 * PROFILE ▸      STATS · HISTORY · SETTINGS
 * OPTIONS        (graphics / audio / controls / accessibility / language)
 * EXIT
 */

import { getRecords, rankFor } from '../../services/records';
import { getSettings } from '../../services/settings';
import { el, footerHints, ListNav, screenBackground, type ListItem } from '../components';
import { menuActions } from '../actions';
import type { ScreenFactory } from '../router';

interface MenuNode extends ListItem {
  children?: Array<ListItem & { route?: string; params?: Record<string, unknown> }>;
  route?: string;
  params?: Record<string, unknown>;
  run?: () => void;
}

export const mainMenuScreen: ScreenFactory = (ctx) => {
  const root = el('div', 'ae-screen');
  root.appendChild(screenBackground());

  // Title
  const titleBlock = el('div', 'ae-title-block');
  const h1 = el('h1', 'ae-title');
  h1.appendChild(el('span', 't-accent', 'AETHER'));
  h1.appendChild(el('span', 't-main', 'BREAK'));
  titleBlock.appendChild(h1);
  titleBlock.appendChild(el('div', 'ae-subtitle', '2.5D Arena Fighter'));
  titleBlock.appendChild(el('div', 'ae-version', 'v1.0 · GREYBOX'));
  root.appendChild(titleBlock);

  // Layout: menu column + profile card
  const body = el('div', 'ae-body');
  body.style.justifyContent = 'center';
  body.style.alignItems = 'flex-start';
  body.style.gap = '64px';
  root.appendChild(body);

  const menuCol = el('div', 'ae-col');
  const listPanel = el('div', 'ae-panel');
  const profCol = el('div', 'ae-col');

  const settings = getSettings();
  const rec = getRecords();
  const profPanel = el('div', 'ae-panel ae-profile-card');
  const av = el('div', 'ae-avatar', (settings.profile.tag || 'G')[0]!.toUpperCase());
  profPanel.appendChild(av);
  profPanel.appendChild(el('div', 'pc-name', settings.profile.tag || 'GUEST'));
  profPanel.appendChild(el('div', 'pc-rank', rankFor(rec)));
  const st = el('div', 'pc-stats');
  st.appendChild(el('span', '', `🏆 ${rec.totals.wins}`));
  st.appendChild(el('span', '', `⚔️ ${rec.totals.wins + rec.totals.losses}`));
  st.appendChild(el('span', '', `❌ ${rec.totals.losses}`));
  profPanel.appendChild(st);
  profCol.appendChild(profPanel);

  const nodes: MenuNode[] = [
    {
      id: 'fight',
      label: 'FIGHT',
      icon: '⚔️',
      children: [
        {
          id: 'versus',
          label: 'VERSUS',
          icon: '👥',
          route: 'character-select',
          params: { mode: 'versus' },
        },
        {
          id: 'training',
          label: 'TRAINING',
          icon: '🎯',
          route: 'character-select',
          params: { mode: 'training' },
        },
        {
          id: 'arcade',
          label: 'ARCADE',
          icon: '🏆',
          route: 'character-select',
          params: { mode: 'arcade' },
        },
        { id: 'online', label: 'ONLINE', icon: '🌐', route: 'online' },
      ],
    },
    {
      id: 'characters',
      label: 'CHARACTERS',
      icon: '👤',
      children: [
        { id: 'roster', label: 'ROSTER', icon: '📋', route: 'roster' },
        { id: 'movelist', label: 'MOVE LIST', icon: '📖', route: 'movelist' },
        { id: 'cosmetics', label: 'COSMETICS', icon: '🎨', route: 'cosmetics' },
      ],
    },
    {
      id: 'training',
      label: 'TRAINING',
      icon: '🎯',
      children: [
        {
          id: 'practice',
          label: 'PRACTICE MODE',
          icon: '🥊',
          route: 'character-select',
          params: { mode: 'training' },
        },
        {
          id: 'trials',
          label: 'COMBO TRIALS',
          icon: '⛓️',
          disabled: true,
          badge: { text: 'SOON', tone: 'gold' },
        },
        {
          id: 'tutorial',
          label: 'TUTORIAL',
          icon: '🎓',
          disabled: true,
          badge: { text: 'SOON', tone: 'gold' },
        },
      ],
    },
    {
      id: 'profile',
      label: 'PROFILE',
      icon: '👑',
      children: [
        { id: 'stats', label: 'STATS', icon: '📊', route: 'profile', params: { tab: 'stats' } },
        {
          id: 'history',
          label: 'HISTORY',
          icon: '📜',
          route: 'profile',
          params: { tab: 'history' },
        },
        {
          id: 'settings',
          label: 'SETTINGS',
          icon: '✍️',
          route: 'profile',
          params: { tab: 'settings' },
        },
      ],
    },
    { id: 'options', label: 'OPTIONS', icon: '⚙️', route: 'options' },
    { id: 'exit', label: 'EXIT', icon: '🚪', route: 'exit' },
  ];

  let sub: ListNav | null = null;
  let subAnchor: HTMLElement | null = null;
  let flyoutOpen = false;

  const mainList = new ListNav({
    onConfirm: (item) => {
      const node = nodes.find((n) => n.id === item.id);
      if (!node) return;
      if (node.children) openFlyout(node);
      else if (node.route) ctx.navigate(node.route, node.params);
      else node.run?.();
    },
    onChange: (item) => {
      const node = nodes.find((n) => n.id === item.id);
      if (flyoutOpen && node?.children) openFlyout(node);
    },
    onKey: (e) => {
      if ((e.code === 'ArrowRight' || e.code === 'KeyD') && !flyoutOpen) {
        const node = nodes[mainList.selectedIndex];
        if (node?.children) {
          openFlyout(node);
          return true;
        }
      }
      return false;
    },
  });

  function openFlyout(node: MenuNode): void {
    closeFlyout();
    sub = new ListNav({
      onConfirm: (item) => {
        const child = node.children!.find((c) => c.id === item.id);
        if (!child) return;
        closeFlyout();
        if (child.route) ctx.navigate(child.route, child.params);
      },
    });
    sub.setItems(node.children!);
    const anchor = listPanel.querySelector<HTMLElement>(`.ae-item[data-id="${node.id}"]`);
    subAnchor = el('div', 'ae-flyout');
    subAnchor.appendChild(sub.el);
    if (anchor) {
      anchor.style.position = 'relative';
      anchor.appendChild(subAnchor);
    } else {
      listPanel.appendChild(subAnchor);
    }
    flyoutOpen = true;
  }

  function closeFlyout(): void {
    subAnchor?.remove();
    subAnchor = null;
    sub = null;
    flyoutOpen = false;
  }

  mainList.setItems(nodes);

  listPanel.appendChild(mainList.el);
  menuCol.appendChild(listPanel);
  body.append(menuCol, profCol);
  root.appendChild(
    footerHints([
      ['W+S', 'navigate'],
      ['D+Enter', 'confirm'],
      ['Esc', 'close menus'],
    ]),
  );

  return {
    el: root,
    onKey: (e) => {
      if (flyoutOpen) {
        if (e.code === 'Escape' || e.code === 'ArrowLeft' || e.code === 'KeyA') {
          closeFlyout();
          return true;
        }
        return sub!.handleKey(e);
      }
      if (e.code === 'Escape') {
        // At the title the game just idles — keep menus open, swallow the key
        // so the fight input handler doesn't also see it.
        menuActions().idle();
        return true;
      }
      return mainList.handleKey(e);
    },
    destroy: () => closeFlyout(),
  };
};
