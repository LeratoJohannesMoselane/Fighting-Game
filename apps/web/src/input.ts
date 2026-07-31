import { emptyActions, type ActionBits } from '@aether-break/combat-core';

/** Keyboard → ActionBits for local 1v1 (presentation only; CombatCore stays pure). */
export const DEFAULT_P1_MAP: Record<string, keyof ActionBits> = {
  KeyA: 'left',
  KeyD: 'right',
  KeyW: 'jump',
  KeyS: 'down',
  KeyF: 'light',
  KeyG: 'heavy',
  KeyH: 'ranged',
  KeyR: 'ability1',
  KeyT: 'ability2', // bomb / snake
  KeyQ: 'ultimate',
  ShiftLeft: 'guard',
  KeyE: 'dash',
};

export const DEFAULT_P2_MAP: Record<string, keyof ActionBits> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'jump',
  ArrowDown: 'down',
  KeyJ: 'light',
  KeyK: 'heavy',
  KeyL: 'ranged',
  KeyU: 'ability1',
  KeyI: 'ability2', // bomb / snake / awaken with O
  KeyO: 'ultimate',
  Slash: 'guard',
  Period: 'dash',
};

/** Rebindable actions, in display order for the Controls screen. */
export const CONTROL_ACTIONS: ReadonlyArray<{ action: keyof ActionBits; label: string }> = [
  { action: 'left', label: 'Move Left' },
  { action: 'right', label: 'Move Right' },
  { action: 'jump', label: 'Jump' },
  { action: 'down', label: 'Crouch' },
  { action: 'light', label: 'Light Attack' },
  { action: 'heavy', label: 'Heavy Attack' },
  { action: 'ranged', label: 'Gun / Ranged' },
  { action: 'ability1', label: 'Spell (Ability 1)' },
  { action: 'ability2', label: 'Bomb / Snake (Ability 2)' },
  { action: 'ultimate', label: 'Ultimate' },
  { action: 'guard', label: 'Guard' },
  { action: 'dash', label: 'Dash' },
];

const STORAGE_KEY = 'aether-break.controls.v1';

function invert(map: Record<string, keyof ActionBits>): Record<string, string> {
  /** action -> code (canonical stored form) */
  const out: Record<string, string> = {};
  for (const [code, action] of Object.entries(map)) out[action] = code;
  return out;
}

function forward(stored: Record<string, string>): Record<string, keyof ActionBits> {
  const out: Record<string, keyof ActionBits> = {};
  for (const [action, code] of Object.entries(stored)) {
    out[code] = action as keyof ActionBits;
  }
  return out;
}

function loadStored(): { p1: Record<string, string>; p2: Record<string, string> } {
  const base = { p1: invert(DEFAULT_P1_MAP), p2: invert(DEFAULT_P2_MAP) };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<typeof base>;
    return {
      p1: { ...base.p1, ...(parsed.p1 ?? {}) },
      p2: { ...base.p2, ...(parsed.p2 ?? {}) },
    };
  } catch {
    return base;
  }
}

let stored = loadStored();
let p1Map = forward(stored.p1);
let p2Map = forward(stored.p2);

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    /* session-only */
  }
}

/** Current bindings as action → KeyboardEvent.code, for the controls screen. */
export function getControlBindings(player: 1 | 2): Record<string, string> {
  return { ...(player === 1 ? stored.p1 : stored.p2) };
}

/**
 * Assign `code` to `action` for a player. If the code is already bound to
 * another action for that player, the other binding is cleared (swap-free UX).
 */
export function rebindControl(player: 1 | 2, action: keyof ActionBits, code: string): void {
  const map = player === 1 ? stored.p1 : stored.p2;
  for (const [a, c] of Object.entries(map)) {
    if (c === code && a !== action) delete map[a];
  }
  map[action] = code;
  if (player === 1) p1Map = forward(stored.p1);
  else p2Map = forward(stored.p2);
  persist();
}

export function resetControls(): void {
  stored = { p1: invert(DEFAULT_P1_MAP), p2: invert(DEFAULT_P2_MAP) };
  p1Map = forward(stored.p1);
  p2Map = forward(stored.p2);
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Pretty label for a KeyboardEvent.code. */
export function keyLabel(code: string | undefined): string {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const names: Record<string, string> = {
    ShiftLeft: 'L·Shift',
    ShiftRight: 'R·Shift',
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓',
    Slash: '/',
    Period: '.',
    Comma: ',',
    Semicolon: ';',
    Space: 'Space',
    Enter: 'Enter',
    Backspace: 'Backspace',
    Quote: "'",
    BracketLeft: '[',
    BracketRight: ']',
    Minus: '-',
    Equal: '=',
    Backquote: '`',
    Backslash: '\\',
    ControlLeft: 'L·Ctrl',
    ControlRight: 'R·Ctrl',
    AltLeft: 'L·Alt',
    AltRight: 'R·Alt',
  };
  return names[code] ?? code;
}

export class LocalInput {
  private readonly held = new Set<string>();
  paused = false;
  showHitboxes = false;
  rematchRequested = false;
  menuRequested = false;
  /** When false, combat keys are ignored (menus open). */
  fighting = false;

  constructor() {
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.held.clear());
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    if (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Slash') {
      if (this.fighting) e.preventDefault();
    }

    if (down) {
      if (e.repeat) return;

      // Global: Esc always requests menu (even from fight)
      if (e.code === 'Escape') {
        this.menuRequested = true;
        return;
      }

      if (!this.fighting) return;

      if (e.code === 'KeyP') {
        this.paused = !this.paused;
        return;
      }
      if (e.code === 'KeyB') {
        this.showHitboxes = !this.showHitboxes;
        return;
      }
      if (e.code === 'Enter' || e.code === 'KeyM') {
        if (e.code === 'KeyM') {
          this.menuRequested = true;
          return;
        }
        this.rematchRequested = true;
        return;
      }
      this.held.add(e.code);
    } else {
      this.held.delete(e.code);
    }
  }

  sample(): { p1: ActionBits; p2: ActionBits } {
    if (!this.fighting) {
      return { p1: emptyActions(), p2: emptyActions() };
    }
    return {
      p1: mapHeld(this.held, p1Map),
      p2: mapHeld(this.held, p2Map),
    };
  }

  consumeRematch(): boolean {
    const v = this.rematchRequested;
    this.rematchRequested = false;
    return v;
  }

  consumeMenu(): boolean {
    const v = this.menuRequested;
    this.menuRequested = false;
    return v;
  }
}

function mapHeld(held: ReadonlySet<string>, map: Record<string, keyof ActionBits>): ActionBits {
  const a = emptyActions();
  for (const code of held) {
    const key = map[code];
    if (key) a[key] = true;
  }
  return a;
}
