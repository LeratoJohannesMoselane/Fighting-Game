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
  Slash: 'guard',
  Period: 'dash',
};

export class LocalInput {
  private readonly held = new Set<string>();
  paused = false;
  showHitboxes = false;
  rematchRequested = false;

  constructor() {
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.held.clear());
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    // Ignore browser shortcuts while playing.
    if (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Slash') {
      e.preventDefault();
    }

    if (down) {
      if (e.repeat) return;
      if (e.code === 'KeyP') {
        this.paused = !this.paused;
        return;
      }
      if (e.code === 'KeyB') {
        this.showHitboxes = !this.showHitboxes;
        return;
      }
      if (e.code === 'Enter') {
        this.rematchRequested = true;
        return;
      }
      this.held.add(e.code);
    } else {
      this.held.delete(e.code);
    }
  }

  sample(): { p1: ActionBits; p2: ActionBits } {
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

  private mapHeld(map: Record<string, keyof ActionBits>): ActionBits {
    const a = emptyActions();
    for (const code of this.held) {
      const key = map[code];
      if (key) a[key] = true;
    }
    return a;
  }
}
