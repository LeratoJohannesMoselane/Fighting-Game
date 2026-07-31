/**
 * OPTIONS — Graphics / Audio / Controls / Accessibility / Language.
 * Everything applies live: settings subscribers rewire shake, flashes,
 * audio gain, FPS counter, particle density and HUD classes.
 */

import {
  CONTROL_ACTIONS,
  getControlBindings,
  keyLabel,
  rebindControl,
  resetControls,
} from '../../input';
import type { ActionBits } from '@aether-break/combat-core';
import { getSettings, updateSettings } from '../../services/settings';
import {
  el,
  footerHints,
  pager,
  screenBackground,
  sliderRow,
  tabs,
  toggleRow,
} from '../components';
import type { ScreenFactory } from '../router';

export const optionsScreen: ScreenFactory = (ctx) => {
  let tab = (ctx.params.tab as string) ?? 'graphics';

  const root = el('div', 'ae-screen');
  root.appendChild(screenBackground(8));

  const header = el('div', 'ae-header');
  header.appendChild(el('h2', '', 'OPTIONS'));
  header.appendChild(el('div', 'ae-header-side', 'applied instantly'));
  root.appendChild(header);

  const body = el('div', 'ae-body');
  body.style.flexDirection = 'column';
  root.appendChild(body);

  const content = el('div', 'ae-panel ae-scroll');
  content.style.flex = '1';
  content.style.minHeight = '0';
  content.style.maxWidth = '820px';
  content.style.width = '100%';
  content.style.margin = '0 auto';

  const tabCtl = tabs(
    [
      { id: 'graphics', label: 'GRAPHICS' },
      { id: 'audio', label: 'AUDIO' },
      { id: 'controls', label: 'CONTROLS' },
      { id: 'accessibility', label: 'ACCESSIBILITY' },
      { id: 'language', label: 'LANGUAGE' },
    ],
    tab,
    (id) => {
      tab = id;
      renderTab();
    },
  );
  body.appendChild(tabCtl.el);
  body.appendChild(content);

  /* ---------------- Graphics ---------------- */

  function renderGraphics(): void {
    content.replaceChildren();
    const g = getSettings().graphics;
    content.appendChild(
      toggleRow(
        'SCREEN SHAKE',
        'Impact camera shake on hits',
        () => getSettings().graphics.shake,
        (v) => updateSettings((s) => (s.graphics.shake = v)),
      ),
    );
    content.appendChild(
      toggleRow(
        'SCREEN FLASHES',
        'Hit/ultimate fullscreen flashes',
        () => getSettings().graphics.flashes,
        (v) => updateSettings((s) => (s.graphics.flashes = v)),
      ),
    );
    content.appendChild(
      toggleRow(
        'FPS COUNTER',
        'Footer frames-per-second readout',
        () => getSettings().graphics.fpsCounter,
        (v) => updateSettings((s) => (s.graphics.fpsCounter = v)),
      ),
    );
    content.appendChild(
      toggleRow(
        'HITBOX VIEWER',
        'Show hit/hurt boxes at match start (B toggles in-fight)',
        () => getSettings().graphics.hitboxes,
        (v) => updateSettings((s) => (s.graphics.hitboxes = v)),
      ),
    );
    const row = el('div', 'ae-setting-row');
    row.appendChild(el('div', 's-label', 'PARTICLE DENSITY'));
    row.appendChild(
      pager({
        values: [
          { id: 'low', label: 'LOW' },
          { id: 'high', label: 'HIGH' },
        ],
        current: g.particles === 'high' ? 1 : 0,
        onChange: (_i, id) =>
          updateSettings((s) => void (s.graphics.particles = id as 'low' | 'high')),
      }).el,
    );
    content.appendChild(row);
  }

  /* ---------------- Audio ---------------- */

  function renderAudio(): void {
    content.replaceChildren();
    content.appendChild(
      toggleRow(
        'SOUND FX',
        'Procedural hits, whooshes, UI ticks',
        () => getSettings().audio.enabled,
        (v) => updateSettings((s) => (s.audio.enabled = v)),
      ),
    );
    content.appendChild(
      sliderRow(
        'MASTER VOLUME',
        'Applies to all procedural SFX',
        () => getSettings().audio.master,
        (v) => updateSettings((s) => (s.audio.master = v)),
        { disabled: () => !getSettings().audio.enabled },
      ),
    );
    const note = el(
      'div',
      'ae-note',
      'Audio unlocks after your first click/keypress (browser autoplay policy).',
    );
    note.style.marginTop = '16px';
    content.appendChild(note);
  }

  /* ---------------- Controls (rebinding) ---------------- */

  let listening: { player: 1 | 2; action: keyof ActionBits; chip: HTMLElement } | null = null;

  function bindTable(player: 1 | 2): HTMLElement {
    const wrap = el('div', 'ae-col');
    wrap.style.flex = '1';
    const h = el('h3', '', player === 1 ? 'PLAYER 1' : 'PLAYER 2 (LOCAL)');
    h.style.letterSpacing = '0.2em';
    h.style.color = player === 1 ? 'var(--ae-blue)' : 'var(--ae-hot)';
    h.style.fontSize = '13px';
    h.style.margin = '4px 0';
    wrap.appendChild(h);

    const bindings = getControlBindings(player);
    for (const { action, label } of CONTROL_ACTIONS) {
      const row = el('div', 'ae-setting-row');
      row.style.padding = '6px 4px';
      row.appendChild(el('div', 's-label', label));
      const chip = el('button', 'ae-keychip', keyLabel(bindings[action]));
      chip.addEventListener('click', () => {
        if (listening) listening.chip.classList.remove('listening');
        listening = { player, action, chip };
        chip.classList.add('listening');
        chip.textContent = 'PRESS KEY…';
      });
      row.appendChild(chip);
      wrap.appendChild(row);
    }
    return wrap;
  }

  function renderControls(): void {
    content.replaceChildren();
    listening = null;
    const cols = el('div');
    cols.style.display = 'flex';
    cols.style.gap = '28px';
    cols.style.flexWrap = 'wrap';
    cols.append(bindTable(1), bindTable(2));
    content.appendChild(cols);

    const row = el('div');
    row.style.marginTop = '14px';
    row.style.display = 'flex';
    row.style.gap = '10px';
    const reset = el('button', 'ae-btn ghost', 'RESET TO DEFAULTS');
    reset.addEventListener('click', () => {
      resetControls();
      renderControls();
    });
    row.appendChild(reset);
    content.appendChild(row);

    const note = el(
      'div',
      'ae-note',
      'Click a binding, then press the new key (Esc cancels). Conflicts are cleared automatically. Fixed keys: P pause · B hitboxes · Enter rematch · Esc menu.',
    );
    note.style.marginTop = '14px';
    content.appendChild(note);
  }

  /* ---------------- Accessibility ---------------- */

  function renderAccessibility(): void {
    content.replaceChildren();
    content.appendChild(
      toggleRow(
        'REDUCE FLASHES',
        'Calms fullscreen flashes + background pulses (photosensitivity)',
        () => getSettings().accessibility.reduceFlashes,
        (v) => updateSettings((s) => (s.accessibility.reduceFlashes = v)),
      ),
    );
    content.appendChild(
      toggleRow(
        'HIGH CONTRAST',
        'Stronger outlines and brighter UI text',
        () => getSettings().accessibility.highContrast,
        (v) => updateSettings((s) => (s.accessibility.highContrast = v)),
      ),
    );
    content.appendChild(
      toggleRow(
        'LARGE TEXT',
        'Bigger HUD and menu text',
        () => getSettings().accessibility.largeText,
        (v) => updateSettings((s) => (s.accessibility.largeText = v)),
      ),
    );
  }

  /* ---------------- Language ---------------- */

  function renderLanguage(): void {
    content.replaceChildren();
    const row = el('div', 'ae-setting-row');
    row.appendChild(el('div', 's-label', 'MENU LANGUAGE'));
    row.appendChild(
      pager({
        values: [
          { id: 'en', label: 'ENGLISH' },
          { id: 'fr', label: 'FRANÇAIS · SOON' },
          { id: 'pt', label: 'PORTUGUÊS · SOON' },
        ],
        current: 0,
        onChange: () => {
          /* locked to EN in this build */
        },
      }).el,
    );
    content.appendChild(row);
    const note = el(
      'div',
      'ae-note',
      'English only in this build — localization hooks are ready (menus, move names, banners).',
    );
    note.style.marginTop = '16px';
    content.appendChild(note);
  }

  function renderTab(): void {
    listening = null;
    if (tab === 'graphics') renderGraphics();
    else if (tab === 'audio') renderAudio();
    else if (tab === 'controls') renderControls();
    else if (tab === 'accessibility') renderAccessibility();
    else renderLanguage();
  }

  root.appendChild(footerHints([['Esc', 'back']]));
  renderTab();

  function onListenKey(e: KeyboardEvent): boolean {
    if (!listening) return false;
    e.preventDefault();
    if (e.code !== 'Escape') {
      rebindControl(listening.player, listening.action, e.code);
    }
    listening.chip.classList.remove('listening');
    listening = null;
    renderControls();
    return true;
  }

  return {
    el: root,
    onKey: (e) => {
      if (listening) return onListenKey(e);
      return false;
    },
  };
};
