import { proceduralAudio } from './procedural';
import { defaultMatchConfig, getMeta, ROSTER, type MatchConfig, type OpponentMode } from './roster';

export type MenuResult = MatchConfig;

/**
 * Character select + mode select overlay.
 * Returns a promise that resolves when the player hits FIGHT.
 */
export function mountCharacterMenu(root: HTMLElement): {
  waitForStart: () => Promise<MatchConfig>;
  show: () => void;
  hide: () => void;
  isOpen: () => boolean;
} {
  let config = defaultMatchConfig();
  let resolveStart: ((c: MatchConfig) => void) | null = null;
  let open = true;

  const overlay = document.createElement('div');
  overlay.id = 'char-menu';
  overlay.className = 'char-menu';
  overlay.innerHTML = `
    <div class="char-menu-panel">
      <header class="char-menu-head">
        <h1>AETHER BREAK</h1>
        <p class="char-menu-sub">Choose your fighter · Choose the opponent · Fight</p>
      </header>

      <section class="char-section">
        <h2>1 · Your character <span class="hint">(Player 1)</span></h2>
        <div class="char-grid" id="p1-grid" role="listbox" aria-label="Player 1 character"></div>
      </section>

      <section class="char-section">
        <h2>2 · Opponent character <span class="hint">(Player 2 / CPU)</span></h2>
        <div class="char-grid" id="p2-grid" role="listbox" aria-label="Opponent character"></div>
      </section>

      <section class="char-section mode-section">
        <h2>3 · Opponent type</h2>
        <div class="mode-row">
          <button type="button" class="mode-btn" data-mode="cpu" id="mode-cpu">
            <strong>CPU</strong>
            <span>AI fights on its own</span>
          </button>
          <button type="button" class="mode-btn" data-mode="human" id="mode-human">
            <strong>Human</strong>
            <span>Local 2-player (same keyboard)</span>
          </button>
        </div>
        <div class="cpu-diff" id="cpu-diff-wrap">
          <span>CPU level</span>
          <div class="diff-row">
            <button type="button" class="diff-btn" data-diff="easy">Easy</button>
            <button type="button" class="diff-btn" data-diff="normal">Normal</button>
            <button type="button" class="diff-btn" data-diff="hard">Hard</button>
          </div>
        </div>
      </section>

      <section class="char-preview" id="char-preview"></section>

      <footer class="char-menu-foot">
        <button type="button" class="fight-btn" id="fight-btn">FIGHT</button>
        <p class="char-menu-keys">Click cards to select · <kbd>Enter</kbd> also starts</p>
      </footer>
    </div>
  `;

  root.appendChild(overlay);

  const p1Grid = overlay.querySelector('#p1-grid') as HTMLElement;
  const p2Grid = overlay.querySelector('#p2-grid') as HTMLElement;
  const preview = overlay.querySelector('#char-preview') as HTMLElement;
  const fightBtn = overlay.querySelector('#fight-btn') as HTMLButtonElement;
  const cpuDiffWrap = overlay.querySelector('#cpu-diff-wrap') as HTMLElement;

  function cardHtml(id: string, selected: boolean, slot: 'p1' | 'p2'): string {
    const m = getMeta(id);
    const stars = '★'.repeat(m.difficulty) + '☆'.repeat(5 - m.difficulty);
    return `
      <button type="button" class="char-card ${selected ? 'selected' : ''}"
        data-id="${m.id}" data-slot="${slot}" role="option" aria-selected="${selected}"
        style="--card-color:${m.color};--card-dim:${m.colorDim}">
        <div class="char-card-swatch"></div>
        <div class="char-card-body">
          <div class="char-card-name">${m.name}</div>
          <div class="char-card-title">${m.title}</div>
          <div class="char-card-arch">${m.archetype}</div>
          <div class="char-card-diff">${stars}</div>
        </div>
      </button>
    `;
  }

  function renderGrids(): void {
    p1Grid.innerHTML = ROSTER.map((c) => cardHtml(c.id, c.id === config.p1Id, 'p1')).join('');
    p2Grid.innerHTML = ROSTER.map((c) => cardHtml(c.id, c.id === config.p2Id, 'p2')).join('');
  }

  function renderModes(): void {
    overlay.querySelectorAll('.mode-btn').forEach((btn) => {
      const mode = (btn as HTMLElement).dataset.mode as OpponentMode;
      btn.classList.toggle('selected', mode === config.opponentMode);
    });
    overlay.querySelectorAll('.diff-btn').forEach((btn) => {
      const d = (btn as HTMLElement).dataset.diff;
      btn.classList.toggle('selected', d === config.cpuDifficulty);
    });
    cpuDiffWrap.hidden = config.opponentMode !== 'cpu';
  }

  function renderPreview(): void {
    const a = getMeta(config.p1Id);
    const b = getMeta(config.p2Id);
    const modeLabel =
      config.opponentMode === 'cpu' ? `CPU (${config.cpuDifficulty})` : 'Human (local P2)';
    preview.innerHTML = `
      <div class="preview-side" style="--c:${a.color}">
        <div class="preview-label">YOU · P1</div>
        <div class="preview-name">${a.name}</div>
        <p>${a.blurb}</p>
      </div>
      <div class="preview-vs">VS</div>
      <div class="preview-side" style="--c:${b.color}">
        <div class="preview-label">OPPONENT · ${modeLabel}</div>
        <div class="preview-name">${b.name}</div>
        <p>${b.blurb}</p>
      </div>
    `;
  }

  function refresh(): void {
    renderGrids();
    renderModes();
    renderPreview();
  }

  overlay.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    const card = t.closest('.char-card') as HTMLElement | null;
    if (card) {
      const id = card.dataset.id!;
      const slot = card.dataset.slot;
      if (slot === 'p1') config = { ...config, p1Id: id };
      else config = { ...config, p2Id: id };
      proceduralAudio.unlock();
      proceduralAudio.play('ui_select');
      refresh();
      return;
    }
    const modeBtn = t.closest('.mode-btn') as HTMLElement | null;
    if (modeBtn?.dataset.mode) {
      config = { ...config, opponentMode: modeBtn.dataset.mode as OpponentMode };
      proceduralAudio.unlock();
      proceduralAudio.play('ui_select');
      refresh();
      return;
    }
    const diffBtn = t.closest('.diff-btn') as HTMLElement | null;
    if (diffBtn?.dataset.diff) {
      config = {
        ...config,
        cpuDifficulty: diffBtn.dataset.diff as MatchConfig['cpuDifficulty'],
      };
      proceduralAudio.unlock();
      proceduralAudio.play('ui_select');
      refresh();
      return;
    }
  });

  function start(): void {
    if (!resolveStart) return;
    const done = resolveStart;
    resolveStart = null;
    open = false;
    overlay.classList.add('hidden');
    proceduralAudio.unlock();
    proceduralAudio.play('ui_start');
    done({ ...config });
  }

  fightBtn.addEventListener('click', start);

  const onKey = (e: KeyboardEvent): void => {
    if (!open) return;
    if (e.code === 'Enter') {
      e.preventDefault();
      start();
    }
  };
  window.addEventListener('keydown', onKey);

  refresh();

  return {
    waitForStart: () =>
      new Promise<MatchConfig>((resolve) => {
        resolveStart = resolve;
        open = true;
        overlay.classList.remove('hidden');
        refresh();
      }),
    show: () => {
      open = true;
      overlay.classList.remove('hidden');
      refresh();
    },
    hide: () => {
      open = false;
      overlay.classList.add('hidden');
    },
    isOpen: () => open,
  };
}
