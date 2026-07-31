/**
 * Procedural Asset System — single entry for mesh + anim + VFX + audio.
 * Driven purely by CombatCore GameState + events (no art files).
 */

import {
  fromFp,
  getKit,
  getMove,
  localBoxToWorld,
  type FighterState,
  type GameEvent,
  type GameState,
  type MoveData,
} from '@aether-break/combat-core';
import { proceduralAudio } from './audio';
import { ProceduralFighterMesh } from './mesh';
import { ProceduralVfx } from './vfx';
import type { VfxRequest } from './types';

export interface ProceduralDrawContext {
  ctx: CanvasRenderingContext2D;
  worldToScreen: (x: number, y: number) => { x: number; y: number };
  showHitboxes: boolean;
  p1Color: string;
  p2Color: string;
  presentTick: number;
}

export class ProceduralAssetSystem {
  readonly vfx = new ProceduralVfx();
  readonly audio = proceduralAudio;
  private meshes = new Map<string, ProceduralFighterMesh>();
  private lastPhase = new Map<string, string>();
  private lastMoveFrame = new Map<string, number>();
  private unlocked = false;

  reset(): void {
    this.meshes.clear();
    this.vfx.clear();
    this.lastPhase.clear();
    this.lastMoveFrame.clear();
  }

  unlockAudio(): void {
    if (!this.unlocked) {
      this.audio.unlock();
      this.unlocked = true;
    }
  }

  meshFor(fighterId: string): ProceduralFighterMesh {
    let m = this.meshes.get(fighterId);
    if (!m) {
      m = ProceduralFighterMesh.generate(fighterId);
      this.meshes.set(fighterId, m);
    }
    // Allow two instances of same id (mirror match) via slot key
    return m;
  }

  private meshKey(f: FighterState): string {
    return `${f.slot}:${f.id}`;
  }

  private getMesh(f: FighterState): ProceduralFighterMesh {
    const key = this.meshKey(f);
    let m = this.meshes.get(key);
    if (!m || m.fighterId !== f.id) {
      m = ProceduralFighterMesh.generate(f.id);
      this.meshes.set(key, m);
    }
    return m;
  }

  /** Deferred VFX resolved to screen space in draw(). */
  private pending: Array<
    | { mode: 'world'; req: VfxRequest }
    | { mode: 'attach'; slot: 0 | 1; attach: string; req: Omit<VfxRequest, 'x' | 'y'> }
  > = [];

  /** Handle CombatCore events → VFX + SFX. */
  handleEvents(events: GameEvent[], state: GameState): void {
    for (const e of events) {
      if (e.type === 'hit') {
        const atk = state.fighters[e.attacker];
        const def = state.fighters[e.defender];
        const kit = getKit(atk.id);
        const move = getMove(kit, e.moveId);
        const color = this.getMesh(atk).profile.primary;
        const sec = this.getMesh(atk).profile.accent;
        const kind =
          move?.isUltimate || move?.input === 'ULTIMATE'
            ? 'hit_ult'
            : move?.input === 'HEAVY'
              ? 'hit_heavy'
              : 'hit_light';
        this.pending.push({
          mode: 'world',
          req: {
            kind,
            x: fromFp(def.x),
            y: fromFp(def.y + 900),
            color,
            secondary: sec,
            facing: atk.facing,
            scale: kind === 'hit_ult' ? 1.4 : 1,
          },
        });
        this.audio.play('hit', {
          intensity: kind === 'hit_ult' ? 1 : kind === 'hit_heavy' ? 0.85 : 0.55,
          pitch: kind === 'hit_light' ? 1.15 : 0.9,
        });
      } else if (e.type === 'blocked') {
        const def = state.fighters[e.defender];
        this.pending.push({
          mode: 'world',
          req: {
            kind: 'block',
            x: fromFp(def.x),
            y: fromFp(def.y + 900),
            color: '#93c5fd',
          },
        });
        this.audio.play('block');
      } else if (e.type === 'attack_started') {
        const f = state.fighters[e.slot];
        const kit = getKit(f.id);
        const move = getMove(kit, e.moveId);
        this.playAttackStartSfx(move);
      } else if (e.type === 'ultimate_activated') {
        const f = state.fighters[e.slot];
        this.pending.push({
          mode: 'world',
          req: {
            kind: 'ult_aura',
            x: fromFp(f.x),
            y: fromFp(f.y + 800),
            color: this.getMesh(f).profile.primary,
            secondary: this.getMesh(f).profile.accent,
          },
        });
        this.audio.play('ult', { intensity: 1 });
      } else if (e.type === 'ultimate_ready') {
        const f = state.fighters[e.slot];
        this.pending.push({
          mode: 'world',
          req: {
            kind: 'ready_pulse',
            x: fromFp(f.x),
            y: fromFp(f.y + 800),
            color: '#fbbf24',
          },
        });
        this.audio.play('ready');
      } else if (e.type === 'projectile_spawned') {
        const f = state.fighters[e.slot];
        this.pending.push({
          mode: 'attach',
          slot: f.slot,
          attach: 'weapon_tip',
          req: {
            kind: 'muzzle',
            color: this.getMesh(f).profile.primary,
            facing: f.facing,
          },
        });
        this.audio.play('ranged');
      } else if (e.type === 'whiff') {
        this.audio.play('whiff', { intensity: 0.4 });
      } else if (e.type === 'resource_denied') {
        this.audio.play('deny');
      }
    }
  }

  private playAttackStartSfx(move: MoveData | undefined): void {
    if (!move) return;
    if (move.isUltimate || move.input === 'ULTIMATE') this.audio.play('ult', { intensity: 0.7 });
    else if (move.input === 'HEAVY') this.audio.play('heavy');
    else if (move.input === 'LIGHT') this.audio.play('light');
    else if (move.input === 'RANGED') this.audio.play('ranged');
    else if (move.input === 'SPELL') this.audio.play('spell');
  }

  /**
   * Per-frame presentation update + draw of both fighters, projectiles juice, VFX.
   * Call after CombatCore step; pass latest state.
   */
  draw(state: GameState, draw: ProceduralDrawContext): void {
    const { ctx, worldToScreen, showHitboxes, presentTick } = draw;

    // Flush VFX queued from combat events (after meshes updated below we still convert world first)
    for (const item of this.pending) {
      if (item.mode === 'world') {
        const s = worldToScreen(item.req.x, item.req.y);
        this.vfx.spawn({ ...item.req, x: s.x, y: s.y });
      }
    }
    // attach-mode resolved after mesh.update

    // Phase transitions → sfx
    for (const f of state.fighters) {
      const key = this.meshKey(f);
      const prev = this.lastPhase.get(key);
      if (prev && prev !== f.phase) {
        if (f.phase === 'dash') {
          this.audio.play('dash');
          const p = worldToScreen(fromFp(f.x), fromFp(f.y));
          this.vfx.spawn({
            kind: 'dash_dust',
            x: p.x,
            y: p.y,
            color: this.getMesh(f).profile.secondary,
            facing: f.facing,
          });
          this.vfx.spawn({
            kind: 'afterimage',
            x: p.x,
            y: p.y,
            color: this.getMesh(f).profile.primary,
            facing: f.facing,
          });
        }
        if (f.phase === 'jump') this.audio.play('jump');
        if (prev === 'jump' || prev === 'airborne') {
          if (f.phase === 'neutral' || f.phase === 'walk') this.audio.play('land');
        }
      }
      this.lastPhase.set(key, f.phase);

      // Active-frame flash VFX once per active start
      if (f.phase === 'attack' && f.move) {
        const mk = `${key}:${f.move.moveId}`;
        const prevF = this.lastMoveFrame.get(mk) ?? -1;
        const lf = f.move.localFrame;
        if (lf !== prevF) {
          this.lastMoveFrame.set(mk, lf);
          const kit = getKit(f.id);
          const move = getMove(kit, f.move.moveId);
          if (move && lf === move.active[0]) {
            const mesh = this.getMesh(f);
            const anim = mesh.update(f, presentTick);
            void anim;
            const tip = mesh.getAttachLocal('weapon_tip');
            const feet = worldToScreen(fromFp(f.x), fromFp(f.y));
            if (tip) {
              this.vfx.spawn({
                kind: move.input === 'SPELL' ? 'spell_burst' : 'muzzle',
                x: feet.x + tip.x * f.facing,
                y: feet.y + tip.y,
                color: mesh.profile.primary,
                secondary: mesh.profile.accent,
                facing: f.facing,
              });
            }
            if (move.isUltimate || move.input === 'ULTIMATE') {
              this.vfx.spawn({
                kind: 'ult_aura',
                x: feet.x,
                y: feet.y - 40,
                color: mesh.profile.primary,
                secondary: mesh.profile.accent,
              });
            }
          }
        }
      }
    }

    // Projectile trails
    for (const p of state.projectiles) {
      const s = worldToScreen(fromFp(p.x), fromFp(p.y));
      const owner = state.fighters[p.ownerSlot];
      this.vfx.spawn({
        kind: 'trail',
        x: s.x,
        y: s.y,
        color: this.getMesh(owner).profile.primary,
        secondary: this.getMesh(owner).profile.accent,
        scale: 0.9,
      });
    }

    // Draw fighters (procedural meshes)
    for (const f of state.fighters) {
      const mesh = this.getMesh(f);
      const anim = mesh.update(f, presentTick);
      const feet = worldToScreen(fromFp(f.x), fromFp(f.y));
      const flash =
        f.phase === 'hitstun'
          ? 'rgba(255,255,255,0.9)'
          : f.phase === 'blockstun'
            ? '#93c5fd'
            : undefined;
      const activeGlow = anim.attackPhase === 'active';
      mesh.draw(ctx, feet.x, feet.y, {
        facing: f.facing,
        flash,
        activeGlow,
      });

      // Name plate
      ctx.fillStyle = 'rgba(15,23,42,0.75)';
      ctx.fillRect(feet.x - 36, feet.y - 118 * mesh.profile.height, 72, 16);
      ctx.fillStyle = mesh.profile.primary;
      ctx.font = 'bold 11px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.slot === 0 ? 'P1' : 'P2', feet.x, feet.y - 106 * mesh.profile.height);

      // Attack phase label (debug-ish juice)
      if (anim.attackPhase) {
        ctx.fillStyle = anim.attackPhase === 'active' ? '#fbbf24' : '#94a3b8';
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillText(
          `${anim.label}·${anim.attackPhase}`,
          feet.x,
          feet.y - 122 * mesh.profile.height,
        );
      }

      if (showHitboxes) {
        this.drawHurtbox(ctx, f, worldToScreen, 'rgba(46,230,197,0.25)', '#2ee6c5');
        if (anim.move && anim.attackPhase === 'active') {
          this.drawMoveHitboxes(ctx, f, anim.move, worldToScreen);
        }
      }
    }

    // Attach-point VFX (need updated bones)
    for (const item of this.pending) {
      if (item.mode !== 'attach') continue;
      const f = state.fighters[item.slot];
      const mesh = this.getMesh(f);
      const feet = worldToScreen(fromFp(f.x), fromFp(f.y));
      const tip = mesh.getAttachLocal(item.attach);
      const x = feet.x + (tip ? tip.x * f.facing : f.facing * 40);
      const y = feet.y + (tip ? tip.y : -50);
      this.vfx.spawn({ ...item.req, x, y });
    }
    this.pending.length = 0;

    this.vfx.update();
    this.vfx.draw(ctx);
  }

  private drawHurtbox(
    ctx: CanvasRenderingContext2D,
    f: FighterState,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    fill: string,
    stroke: string,
  ): void {
    const box = localBoxToWorld(f.x, f.y, f.facing, f.hurtbox);
    this.drawWorldBox(ctx, box, worldToScreen, fill, stroke);
  }

  private drawMoveHitboxes(
    ctx: CanvasRenderingContext2D,
    f: FighterState,
    move: MoveData,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
  ): void {
    for (const hb of move.hitboxes) {
      const box = localBoxToWorld(f.x, f.y, f.facing, hb);
      this.drawWorldBox(ctx, box, worldToScreen, 'rgba(251,191,36,0.3)', '#fbbf24');
    }
  }

  private drawWorldBox(
    ctx: CanvasRenderingContext2D,
    box: { x: number; y: number; w: number; h: number },
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    fill: string,
    stroke: string,
  ): void {
    const a = worldToScreen(fromFp(box.x), fromFp(box.y + box.h));
    const b = worldToScreen(fromFp(box.x + box.w), fromFp(box.y));
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
  }
}

export const proceduralAssets = new ProceduralAssetSystem();
