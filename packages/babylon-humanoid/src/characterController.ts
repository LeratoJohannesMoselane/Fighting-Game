/**
 * Thin animation state machine over a procedural character.
 *
 * Keeps a named library of retargeted clips and cross-fades between them, so
 * gameplay code says `controller.play('walk')` instead of juggling
 * AnimationGroup weights.
 */

import type { Scene } from '@babylonjs/core/scene';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { crossFade } from './retarget';
import { loadAndRetargetClip, type LoadClipOptions } from './animationLibrary';
import type { ProceduralCharacter } from './proceduralCharacter';

export interface ClipSpec {
  /** Key you'll use at runtime, e.g. 'idle'. */
  key: string;
  /** URL of the .glb, e.g. '/animations/IDLE_NO.glb'. */
  url: string;
  loop?: boolean;
  /** Strip hips translation (root-motion clip → in-place). */
  inPlace?: boolean;
}

export class CharacterController {
  private readonly clips = new Map<string, AnimationGroup>();
  private current: AnimationGroup | null = null;
  private currentKey: string | null = null;

  constructor(
    private readonly scene: Scene,
    private readonly character: ProceduralCharacter,
  ) {}

  /**
   * Load every clip. Failures are reported but do not abort the batch — a
   * missing walk cycle shouldn't stop your idle from working.
   */
  async loadAll(specs: ClipSpec[]): Promise<{ loaded: string[]; failed: string[] }> {
    const loaded: string[] = [];
    const failed: string[] = [];

    for (const spec of specs) {
      try {
        const options: LoadClipOptions = {
          loop: spec.loop ?? true,
          inPlace: spec.inPlace ?? false,
          clipName: spec.key,
        };
        const result = await loadAndRetargetClip(
          this.scene,
          spec.url,
          this.character.skeleton,
          options,
        );
        const first = result[0];
        if (!first) {
          failed.push(spec.key);
          continue;
        }
        first.group.stop();
        this.clips.set(spec.key, first.group);
        loaded.push(spec.key);

        if (first.report.dropped > 0) {
          console.warn(
            `[${spec.key}] ${first.report.dropped} track(s) had no matching bone:`,
            first.report.unmatchedNames.slice(0, 8),
          );
        }
      } catch (err) {
        failed.push(spec.key);
        console.error(`Failed to load clip "${spec.key}" from ${spec.url}:`, err);
      }
    }
    return { loaded, failed };
  }

  /** Register an already-retargeted group. */
  add(key: string, group: AnimationGroup): void {
    group.stop();
    this.clips.set(key, group);
  }

  has(key: string): boolean {
    return this.clips.has(key);
  }

  get keys(): string[] {
    return [...this.clips.keys()];
  }

  get playing(): string | null {
    return this.currentKey;
  }

  /** Cross-fade to a clip. No-op if it's already playing. */
  play(key: string, fadeMs = 220): boolean {
    const next = this.clips.get(key);
    if (!next) {
      console.warn(`Unknown clip "${key}". Available: ${this.keys.join(', ') || '(none)'}`);
      return false;
    }
    if (this.currentKey === key) return true;

    crossFade(this.scene, this.current, next, fadeMs);
    this.current = next;
    this.currentKey = key;
    return true;
  }

  stop(): void {
    this.current?.stop();
    this.current = null;
    this.currentKey = null;
  }

  dispose(): void {
    for (const group of this.clips.values()) group.dispose();
    this.clips.clear();
    this.current = null;
    this.currentKey = null;
  }
}
