/**
 * Persisted user settings — graphics, audio, controls, accessibility.
 * Stored in localStorage; subscribers notified on change so the
 * presentation layer (main loop, HUD, audio) can apply live.
 */

export interface GraphicsSettings {
  shake: boolean;
  flashes: boolean;
  fpsCounter: boolean;
  hitboxes: boolean;
  particles: 'low' | 'high';
}

export interface AudioSettings {
  enabled: boolean;
  /** 0–100 */
  master: number;
}

export interface AccessibilitySettings {
  reduceFlashes: boolean;
  highContrast: boolean;
  largeText: boolean;
}

export interface Settings {
  graphics: GraphicsSettings;
  audio: AudioSettings;
  accessibility: AccessibilitySettings;
  language: 'en';
  /** Selected colorways applied at match start. */
  colorways: { p1: string; p2: string };
  profile: { tag: string };
}

const STORAGE_KEY = 'aether-break.settings.v2';

const DEFAULTS: Settings = {
  graphics: { shake: true, flashes: true, fpsCounter: true, hitboxes: false, particles: 'high' },
  audio: { enabled: true, master: 70 },
  accessibility: { reduceFlashes: false, highContrast: false, largeText: false },
  language: 'en',
  colorways: { p1: 'classic', p2: 'classic' },
  profile: { tag: 'GUEST' },
};

const current: Settings = load();
const listeners = new Set<(s: Settings) => void>();

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      graphics: { ...DEFAULTS.graphics, ...parsed.graphics },
      audio: { ...DEFAULTS.audio, ...parsed.audio },
      accessibility: { ...DEFAULTS.accessibility, ...parsed.accessibility },
      language: 'en',
      colorways: { ...DEFAULTS.colorways, ...parsed.colorways },
      profile: { ...DEFAULTS.profile, ...parsed.profile },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* private mode etc. — settings become session-only */
  }
}

export function getSettings(): Settings {
  return current;
}

export function updateSettings(mutate: (s: Settings) => void): Settings {
  mutate(current);
  persist();
  for (const fn of listeners) fn(current);
  return current;
}

export function subscribeSettings(fn: (s: Settings) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
