/**
 * Small DOM building kit + keyboard list navigation shared by every screen.
 * Zero dependencies — matches the app's imperative presentation style.
 */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Standard animated screen background (gradient field + embers). */
export function screenBackground(emberCount = 16): HTMLElement {
  const bg = el('div', 'ae-bg');
  for (let i = 0; i < emberCount; i++) {
    const e = el('span', `ae-ember ${i % 3 === 0 ? 'blue' : i % 3 === 1 ? 'red' : ''}`);
    e.style.left = `${(i * 61 + 13) % 100}%`;
    e.style.animationDuration = `${7 + (i % 5) * 2.3}s`;
    e.style.animationDelay = `${(i * 1.7) % 9}s`;
    const s = 0.7 + ((i * 37) % 10) / 14;
    e.style.width = `${4 * s}px`;
    e.style.height = `${4 * s}px`;
    bg.appendChild(e);
  }
  return bg;
}

export function footerHints(hints: Array<[keys: string, action: string]>): HTMLElement {
  const f = el('div', 'ae-footer');
  for (const [keys, action] of hints) {
    const span = el('span');
    for (const k of keys.split('+')) {
      const kbd = el('kbd', '', k);
      span.appendChild(kbd);
    }
    span.appendChild(document.createTextNode(' ' + action));
    f.appendChild(span);
  }
  return f;
}

/* ------------------------------------------------------------------ */
/* List navigation                                                      */
/* ------------------------------------------------------------------ */

export interface ListItem {
  id: string;
  label: string;
  icon?: string;
  badge?: { text: string; tone?: 'gold' | 'blue' | 'red' };
  disabled?: boolean;
  hint?: string;
}

export interface ListNavOptions {
  orientation?: 'vertical' | 'horizontal';
  onConfirm?: (item: ListItem) => void;
  /** Other keys: return true to consume. */
  onKey?: (e: KeyboardEvent) => boolean;
  onChange?: (item: ListItem) => void;
}

/**
 * Keyboard/mouse list with SF6 selection behavior:
 * hover selects, arrows move, confirm activates, disabled items skip.
 */
export class ListNav {
  readonly el = el('div', 'ae-list');
  private items: ListItem[] = [];
  private index = 0;
  private readonly opts: ListNavOptions;

  constructor(opts: ListNavOptions = {}) {
    this.opts = opts;
    if (opts.orientation === 'horizontal') {
      this.el.style.flexDirection = 'row';
    }
  }

  get current(): ListItem | null {
    return this.items[this.index] ?? null;
  }

  get selectedIndex(): number {
    return this.index;
  }

  setItems(items: ListItem[]): void {
    this.items = items;
    this.index = this.nextEnabled(items.findIndex((i) => i.disabled) === -1 ? 0 : -1, 1, true);
    if (this.index < 0) this.index = 0;
    this.render();
  }

  setIndex(i: number): void {
    if (i < 0 || i >= this.items.length) return;
    if (this.items[i]?.disabled) return;
    this.index = i;
    this.render();
    const cur = this.current;
    if (cur) this.opts.onChange?.(cur);
  }

  private nextEnabled(from: number, dir: 1 | -1, initial = false): number {
    const n = this.items.length;
    if (n === 0) return -1;
    let i = initial ? from : (from + dir + n) % n;
    if (i < 0) i = dir === 1 ? 0 : n - 1;
    for (let count = 0; count < n; count++) {
      if (!this.items[i]?.disabled) return i;
      i = (i + dir + n) % n;
    }
    return -1;
  }

  move(dir: 1 | -1): void {
    const next = this.nextEnabled(this.index, dir);
    if (next >= 0) {
      this.index = next;
      this.render();
      const cur = this.current;
      if (cur) this.opts.onChange?.(cur);
    }
  }

  confirm(): void {
    const cur = this.current;
    if (cur && !cur.disabled) this.opts.onConfirm?.(cur);
  }

  /** Route a key event; returns true when consumed. */
  handleKey(e: KeyboardEvent): boolean {
    const horiz = this.opts.orientation === 'horizontal';
    const prevKeys = horiz ? ['ArrowLeft', 'KeyA'] : ['ArrowUp', 'KeyW'];
    const nextKeys = horiz ? ['ArrowRight', 'KeyD'] : ['ArrowDown', 'KeyS'];
    if (prevKeys.includes(e.code)) {
      e.preventDefault();
      this.move(-1);
      return true;
    }
    if (nextKeys.includes(e.code)) {
      e.preventDefault();
      this.move(1);
      return true;
    }
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      this.confirm();
      return true;
    }
    return this.opts.onKey?.(e) ?? false;
  }

  private render(): void {
    clear(this.el);
    this.items.forEach((item, i) => {
      const node = el(
        'div',
        `ae-item${i === this.index ? ' selected' : ''}${item.disabled ? ' disabled' : ''}`,
      );
      node.dataset.id = item.id;
      if (item.icon) node.appendChild(el('span', 'i-icon', item.icon));
      const label = el('span', 'i-label', item.label);
      node.appendChild(label);
      if (item.badge) {
        const b = el('span', `ae-badge ${item.badge.tone ?? ''}`.trim(), item.badge.text);
        label.appendChild(b);
      }
      node.appendChild(el('span', 'i-arrow', '▸'));
      node.addEventListener('mouseenter', () => {
        if (!item.disabled) {
          this.index = i;
          this.render();
        }
      });
      node.addEventListener('click', () => {
        if (!item.disabled) {
          this.index = i;
          this.render();
          this.opts.onConfirm?.(item);
        }
      });
      this.el.appendChild(node);
    });
  }
}

/* ------------------------------------------------------------------ */
/* Small controls                                                       */
/* ------------------------------------------------------------------ */

export interface PagerOptions {
  values: ReadonlyArray<{ id: string; label: string }>;
  current: number;
  onChange: (index: number, id: string) => void;
}

/** ◀ VALUE ▶ pager control. */
export function pager(opts: PagerOptions): { el: HTMLElement; set: (i: number) => void } {
  const root = el('div', 'ae-pager');
  const left = el('button', 'pg-btn', '◀');
  const value = el('span', 'pg-value');
  const right = el('button', 'pg-btn', '▶');
  let idx = opts.current;

  const draw = () => {
    value.textContent = opts.values[idx]?.label ?? '?';
    left.disabled = false;
    right.disabled = false;
  };
  const step = (d: number) => {
    const n = opts.values.length;
    idx = (idx + d + n) % n;
    draw();
    opts.onChange(idx, opts.values[idx]!.id);
  };
  left.addEventListener('click', (e) => {
    e.stopPropagation();
    step(-1);
  });
  right.addEventListener('click', (e) => {
    e.stopPropagation();
    step(1);
  });
  root.append(left, value, right);
  draw();
  return {
    el: root,
    set: (i: number) => {
      idx = Math.max(0, Math.min(opts.values.length - 1, i));
      draw();
    },
  };
}

export function toggleRow(
  label: string,
  desc: string,
  get: () => boolean,
  set: (v: boolean) => void,
): HTMLElement {
  const row = el('div', 'ae-setting-row');
  const l = el('div', 's-label', label);
  if (desc) l.appendChild(el('span', 's-desc', desc));
  const t = el('button', `ae-toggle${get() ? ' on' : ''}`);
  t.setAttribute('role', 'switch');
  const sync = () => {
    t.classList.toggle('on', get());
    t.setAttribute('aria-checked', String(get()));
  };
  t.addEventListener('click', () => {
    set(!get());
    sync();
  });
  sync();
  row.append(l, t);
  return row;
}

export function sliderRow(
  label: string,
  desc: string,
  get: () => number,
  set: (v: number) => void,
  opts: { min?: number; max?: number; disabled?: () => boolean } = {},
): HTMLElement {
  const row = el('div', 'ae-setting-row');
  const l = el('div', 's-label', label);
  if (desc) l.appendChild(el('span', 's-desc', desc));
  const s = el('input', 'ae-slider') as HTMLInputElement;
  s.type = 'range';
  s.min = String(opts.min ?? 0);
  s.max = String(opts.max ?? 100);
  s.value = String(get());
  const syncDisabled = () => {
    s.disabled = opts.disabled?.() ?? false;
  };
  s.addEventListener('input', () => set(Number(s.value)));
  syncDisabled();
  row.append(l, s);
  return row;
}

export function tabs(
  names: ReadonlyArray<{ id: string; label: string }>,
  initial: string,
  onChange: (id: string) => void,
): { el: HTMLElement; select: (id: string) => void } {
  const root = el('div', 'ae-tabs');
  let current = initial;
  const btns: HTMLButtonElement[] = [];
  const draw = () => {
    btns.forEach((b, i) => b.classList.toggle('selected', names[i]!.id === current));
  };
  for (const t of names) {
    const b = el('button', 'ae-tab', t.label) as HTMLButtonElement;
    b.addEventListener('click', () => {
      current = t.id;
      draw();
      onChange(t.id);
    });
    btns.push(b);
    root.appendChild(b);
  }
  draw();
  return {
    el: root,
    select: (id: string) => {
      current = id;
      draw();
      onChange(id);
    },
  };
}
