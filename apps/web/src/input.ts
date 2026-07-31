import { emptyActions, type ActionBits } from '@aether-break/combat-core';

/** Keyboard → ActionBits for local 1v1 (presentation only; CombatCore stays pure). */
const P1_MAP: Record<string, keyof ActionBits> = {
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
  ShiftRight: 'guard',
  KeyE: 'dash',
};

const P2_MAP: Record<string, keyof ActionBits> = {
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

export class LocalInput {
  private readonly held = new Set<string>();
  paused = false;
  showHitboxes = false;
  rematchRequested = false;
  menuRequested = false;
  /** When false, combat keys are ignored (character menu open). */
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
        // Enter = rematch in fight; M also opens menu via dedicated path
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
      p1: this.mapHeld(P1_MAP),
      p2: this.mapHeld(P2_MAP),
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

  private mapHeld(map: Record<string, keyof ActionBits>): ActionBits {
    const a = emptyActions();
    for (const code of this.held) {
      const key = map[code];
      if (key) a[key] = true;
    }
    return a;
  }
}
