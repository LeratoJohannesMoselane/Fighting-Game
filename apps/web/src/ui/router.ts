/**
 * Screen router for the menu system.
 * Owns a fullscreen overlay (#ae-root) stacked above the HUD/stage.
 * Escape semantics: a screen may mark a key as handled; otherwise ESC
 * pops the stack. Closing the last screen calls onRequestClose (the
 * game either hides menus or drops straight into a match).
 */

export interface ScreenParams {
  [key: string]: unknown;
}

export interface ScreenHandle {
  el: HTMLElement;
  /** Return true if the key was consumed (Escape handled, etc.). */
  onKey?: (e: KeyboardEvent) => boolean;
  destroy?: () => void;
}

export interface ScreenCtx {
  params: ScreenParams;
  navigate: (name: string, params?: ScreenParams) => void;
  back: () => void;
  toRoot: () => void;
}

export type ScreenFactory = (ctx: ScreenCtx) => ScreenHandle;

interface StackEntry {
  name: string;
  params: ScreenParams;
  handle: ScreenHandle;
}

export class Router {
  private readonly overlay: HTMLElement;
  private readonly factories = new Map<string, ScreenFactory>();
  private stack: StackEntry[] = [];
  /** Called when the last screen is dismissed (ESC at root). */
  onLastClose: (() => void) | null = null;
  private keyListener: (e: KeyboardEvent) => void;

  constructor(host: HTMLElement) {
    this.overlay = document.createElement('div');
    this.overlay.id = 'ae-root';
    host.appendChild(this.overlay);
    this.keyListener = (e) => this.onKey(e);
    window.addEventListener('keydown', this.keyListener);
  }

  register(name: string, factory: ScreenFactory): void {
    this.factories.set(name, factory);
  }

  isOpen(): boolean {
    return this.stack.length > 0;
  }

  currentName(): string | null {
    return this.stack[this.stack.length - 1]?.name ?? null;
  }

  navigate(name: string, params: ScreenParams = {}, replace = false): void {
    const factory = this.factories.get(name);
    if (!factory) throw new Error(`Unknown screen: ${name}`);
    if (replace) this.popEntry();
    const handle = factory({
      params,
      navigate: (n, p) => this.navigate(n, p),
      back: () => this.back(),
      toRoot: () => this.toRoot(),
    });
    this.stack.push({ name, params, handle });
    this.mountTop();
  }

  back(): void {
    if (this.stack.length <= 1) {
      this.closeAll();
      this.onLastClose?.();
      return;
    }
    this.popEntry();
    this.mountTop();
  }

  toRoot(): void {
    while (this.stack.length > 1) this.popEntry();
    if (this.stack.length === 1) this.mountTop();
  }

  closeAll(): void {
    while (this.stack.length > 0) this.popEntry();
    this.overlay.replaceChildren();
    this.overlay.style.display = 'none';
  }

  private popEntry(): void {
    const e = this.stack.pop();
    e?.handle.destroy?.();
  }

  private mountTop(): void {
    this.overlay.replaceChildren();
    const top = this.stack[this.stack.length - 1];
    if (!top) {
      this.overlay.style.display = 'none';
      return;
    }
    this.overlay.style.display = 'block';
    top.handle.el.classList.add('ae-fade-in');
    this.overlay.appendChild(top.handle.el);
  }

  private onKey(e: KeyboardEvent): void {
    if (this.stack.length === 0) return;
    const top = this.stack[this.stack.length - 1]!;
    if (top.handle.onKey?.(e)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.code === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.back();
    }
  }
}
