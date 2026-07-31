/**
 * Procedural SFX via Web Audio API — no sound files.
 * Safe no-op until first user gesture (browser autoplay policy).
 */

import type { SfxKind } from './types';

export class ProceduralAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;
  private lastPlay = new Map<string, number>();

  unlock(): void {
    const c = this.ensure();
    if (c.state === 'suspended') {
      void c.resume();
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
  }

  play(kind: SfxKind['id'], opts: { intensity?: number; pitch?: number } = {}): void {
    if (!this.enabled) return;
    const now = performance.now();
    const last = this.lastPlay.get(kind) ?? 0;
    // light debounce
    if (now - last < 28 && kind !== 'hit' && kind !== 'ult') return;
    this.lastPlay.set(kind, now);

    const ctx = this.ensure();
    if (ctx.state === 'suspended') return;

    const intensity = opts.intensity ?? 0.6;
    const pitch = opts.pitch ?? 1;

    switch (kind) {
      case 'light':
        this.whoosh(ctx, 420 * pitch, 0.05, 0.08 * intensity);
        break;
      case 'heavy':
        this.whoosh(ctx, 180 * pitch, 0.1, 0.14 * intensity);
        this.thud(ctx, 70 * pitch, 0.12, 0.2 * intensity);
        break;
      case 'ranged':
        this.noiseBurst(ctx, 0.04, 0.1 * intensity, 1800 * pitch, 0.3);
        this.whoosh(ctx, 880 * pitch, 0.06, 0.07 * intensity);
        break;
      case 'spell':
        this.tone(ctx, 520 * pitch, 0.12, 0.08 * intensity, 'sine');
        this.tone(ctx, 780 * pitch, 0.14, 0.05 * intensity, 'triangle');
        break;
      case 'ult':
        this.tone(ctx, 110 * pitch, 0.25, 0.18 * intensity, 'sawtooth');
        this.tone(ctx, 220 * pitch, 0.3, 0.12 * intensity, 'square');
        this.noiseBurst(ctx, 0.15, 0.15 * intensity, 800, 0.5);
        this.tone(ctx, 440 * pitch, 0.4, 0.1 * intensity, 'sine');
        break;
      case 'hit':
        this.noiseBurst(ctx, 0.05, 0.16 * intensity, 1200 * pitch, 0.4);
        this.thud(ctx, 90 * pitch, 0.08, 0.14 * intensity);
        break;
      case 'block':
        this.thud(ctx, 120 * pitch, 0.07, 0.12 * intensity);
        this.tone(ctx, 240 * pitch, 0.05, 0.05 * intensity, 'triangle');
        break;
      case 'whiff':
        this.whoosh(ctx, 300 * pitch, 0.07, 0.05 * intensity);
        break;
      case 'dash':
        this.noiseBurst(ctx, 0.06, 0.08 * intensity, 600, 0.6);
        break;
      case 'jump':
        this.tone(ctx, 280 * pitch, 0.08, 0.06 * intensity, 'sine');
        break;
      case 'land':
        this.thud(ctx, 80, 0.06, 0.1 * intensity);
        break;
      case 'deny':
        this.tone(ctx, 140, 0.08, 0.06, 'square');
        this.tone(ctx, 100, 0.1, 0.05, 'square');
        break;
      case 'ready':
        this.tone(ctx, 440, 0.1, 0.07, 'sine');
        this.tone(ctx, 660, 0.14, 0.08, 'sine');
        this.tone(ctx, 880, 0.18, 0.06, 'triangle');
        break;
      case 'ui_select':
        this.tone(ctx, 640, 0.04, 0.05, 'sine');
        break;
      case 'ui_start':
        this.tone(ctx, 330, 0.08, 0.07, 'triangle');
        this.tone(ctx, 495, 0.12, 0.07, 'sine');
        break;
      default:
        break;
    }
  }

  private ensure(): AudioContext {
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private dest(): AudioNode {
    return this.master ?? this.ensure().destination;
  }

  private tone(
    ctx: AudioContext,
    freq: number,
    dur: number,
    gain: number,
    type: OscillatorType,
  ): void {
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.dest());
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private whoosh(ctx: AudioContext, freq: number, dur: number, gain: number): void {
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.4, t0 + dur);
    f.type = 'bandpass';
    f.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(f);
    f.connect(g);
    g.connect(this.dest());
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private thud(ctx: AudioContext, freq: number, dur: number, gain: number): void {
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t0 + dur);
    g.gain.setValueAtTime(Math.max(0.0001, gain), t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.dest());
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noiseBurst(
    ctx: AudioContext,
    dur: number,
    gain: number,
    cutoff: number,
    q: number,
  ): void {
    const t0 = ctx.currentTime;
    const len = Math.max(1, (ctx.sampleRate * dur) | 0);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = cutoff;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0001, gain), t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.dest());
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }
}

export const proceduralAudio = new ProceduralAudio();
