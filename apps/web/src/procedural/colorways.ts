/**
 * Colorways — hue-rotated palette variants for every fighter.
 * No art files: colors are rotated in HSL space at profile level,
 * so meshes, gradients and VFX all skin consistently.
 */

import { getVisualProfile } from './profiles';
import type { BodyPartDef, FighterVisualProfile } from './types';

export interface Colorway {
  id: string;
  name: string;
  /** Hue rotation in degrees (0 = untouched). */
  hue: number;
}

export const COLORWAYS: readonly Colorway[] = [
  { id: 'classic', name: 'CLASSIC', hue: 0 },
  { id: 'viridian', name: 'VIRIDIAN', hue: 140 },
  { id: 'solar', name: 'SOLAR', hue: 40 },
  { id: 'phantom', name: 'PHANTOM', hue: 200 },
];

export function getColorway(id: string): Colorway {
  return COLORWAYS.find((c) => c.id === id) ?? COLORWAYS[0]!;
}

export function rotateHue(color: string, deg: number): string {
  if (!deg) return color;
  const c = parseColor(color);
  if (!c) return color;
  const { h, s, l } = rgbToHsl(c.r, c.g, c.b);
  const { r, g, b } = hslToRgb((h + deg + 360) % 360, s, l);
  return `rgb(${r},${g},${b})`;
}

const profileCache = new Map<string, FighterVisualProfile>();

/** Visual profile with colorway applied (cached; shared by mesh + VFX). */
export function profileWithColorway(fighterId: string, colorwayId: string): FighterVisualProfile {
  const way = getColorway(colorwayId);
  if (!way.hue) return getVisualProfile(fighterId);
  const key = `${fighterId}:${way.id}`;
  let p = profileCache.get(key);
  if (!p) {
    p = retint(getVisualProfile(fighterId), way.hue);
    profileCache.set(key, p);
  }
  return p;
}

function retint(src: FighterVisualProfile, hue: number): FighterVisualProfile {
  const rotate = (c: string) => rotateHue(c, hue);
  // Skin and outline stay loyal to the source so faces/outlines read the same.
  const exempt = new Set([src.skin, src.outline]);
  const tintPart = (part: BodyPartDef): BodyPartDef => ({
    ...part,
    color: exempt.has(part.color) ? part.color : rotate(part.color),
    shade: part.shade ? rotate(part.shade) : part.shade,
    accent: part.accent ? rotate(part.accent) : part.accent,
    rim: part.rim ? rotate(part.rim) : part.rim,
    glow: part.glow ? rotate(part.glow) : part.glow,
  });
  return {
    ...src,
    id: src.id,
    primary: rotate(src.primary),
    secondary: rotate(src.secondary),
    accent: rotate(src.accent),
    emission: rotate(src.emission),
    parts: src.parts.map(tintPart),
  };
}

/* ---------- color math ---------- */

function parseColor(c: string): { r: number; g: number; b: number } | null {
  const s = c.trim().toLowerCase();
  if (s.startsWith('#')) {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4) h = h[0]! + h[0] + h[1]! + h[1] + h[2]! + h[2];
    if (h.length < 6) return null;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  const m = /rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/.exec(s);
  if (m) return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
  return null;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) h = ((bn - rn) / d + 2) * 60;
  else h = ((rn - gn) / d + 4) * 60;
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  if (s === 0) {
    const v = Math.max(0, Math.min(255, Math.round(l * 255)));
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const conv = (t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const hn = (((h % 360) + 360) % 360) / 360;
  return {
    r: Math.round(conv(hn + 1 / 3) * 255),
    g: Math.round(conv(hn) * 255),
    b: Math.round(conv(hn - 1 / 3) * 255),
  };
}
