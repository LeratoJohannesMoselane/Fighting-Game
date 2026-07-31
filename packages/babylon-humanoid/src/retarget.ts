/**
 * Animation retargeting for Babylon.js.
 *
 * THE KEY FACT (this is what the docs don't say loudly enough):
 *
 *   Babylon does NOT have automatic cross-skeleton retargeting.
 *   It can only reuse an AnimationGroup on a DIFFERENT skeleton when that
 *   skeleton is structurally IDENTICAL (same bone names, same hierarchy,
 *   same joint orientations). Then you just re-point each animation track at
 *   the matching target — which is exactly what `AnimationGroup.clone()` with
 *   a `targetConverter` does.
 *
 * SECOND KEY FACT (the usual cause of "it loads but nothing moves"):
 *
 *   In glTF/GLB, animation channels target NODES, not bones. So after import,
 *   `targetedAnimation.target` is a TransformNode, not a Bone. Your retarget
 *   function must therefore return the TransformNode linked to your bone
 *   (`bone.getTransformNode()`), NOT the bone itself.
 *
 * Because our procedural rig is built with the same bone names AND the same
 * hierarchy as the source rig, we are in the "simple" case: name-based
 * re-pointing works, and no per-bone rotation correction is needed.
 */

import type { Scene } from '@babylonjs/core/scene';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import type { Skeleton } from '@babylonjs/core/Bones/skeleton';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { normalizeBoneName, slotForBoneName, type HumanoidSlot } from './humanoidRig';

export interface RetargetReport {
  /** Tracks successfully re-pointed at one of our nodes. */
  remapped: number;
  /** Tracks dropped because no matching bone exists on the target rig. */
  dropped: number;
  /** Distinct source names that had no home (deduped, for diagnostics). */
  unmatchedNames: string[];
}

export interface RetargetResult {
  group: AnimationGroup;
  report: RetargetReport;
}

/** Lookups used to resolve a source bone name to one of our nodes. */
interface NodeLookup {
  /** Exact and normalised bone names. */
  byName: Map<string, TransformNode>;
  /** Semantic slot → node. Bridges different naming schemes. */
  bySlot: Map<HumanoidSlot, TransformNode>;
}

/**
 * Build lookups from the target skeleton.
 *
 * Two indexes, tried in order of confidence:
 *  1. by name       — exact, then punctuation/namespace-insensitive
 *  2. by slot       — semantic ("LeftArm" and "LeftUpperArm" are both the
 *                     LeftUpperArm slot), which is what makes a Mixamo clip
 *                     drive a Unity-named rig with no hand-written map.
 */
function buildNodeLookup(skeleton: Skeleton): NodeLookup {
  const byName = new Map<string, TransformNode>();
  const bySlot = new Map<HumanoidSlot, TransformNode>();

  for (const bone of skeleton.bones) {
    const node = bone.getTransformNode();
    if (!node) continue;

    byName.set(bone.name, node);
    const norm = normalizeBoneName(bone.name);
    if (!byName.has(norm)) byName.set(norm, node);

    const slot = slotForBoneName(bone.name);
    if (slot && !bySlot.has(slot)) bySlot.set(slot, node);
  }
  return { byName, bySlot };
}

/**
 * Retarget a source AnimationGroup onto a target skeleton by bone name.
 *
 * @param source     Group loaded from the .glb (left untouched).
 * @param skeleton   Your procedural character's skeleton.
 * @param newName    Name for the cloned group.
 * @param nameMap    Optional explicit source-name → target-name mapping, for
 *                   when the two rigs use different naming schemes.
 */
export function retargetAnimationGroup(
  source: AnimationGroup,
  skeleton: Skeleton,
  newName: string,
  nameMap?: Record<string, string>,
): RetargetResult {
  const lookup = buildNodeLookup(skeleton);
  const unmatched = new Set<string>();
  let remapped = 0;
  let dropped = 0;

  const resolve = (target: unknown): TransformNode | null => {
    const sourceName =
      target && typeof target === 'object' && 'name' in target
        ? String((target as { name: unknown }).name)
        : '';
    if (!sourceName) return null;

    // 1. explicit mapping wins — always honour a hand-written map.
    const mapped = nameMap?.[sourceName];
    if (mapped) {
      const viaMap = lookup.byName.get(mapped) ?? lookup.byName.get(normalizeBoneName(mapped));
      if (viaMap) return viaMap;
    }
    // 2. exact name match
    const exact = lookup.byName.get(sourceName);
    if (exact) return exact;
    // 3. punctuation/namespace-insensitive match ("mixamorig:Hips" → "Hips")
    const tolerant = lookup.byName.get(normalizeBoneName(sourceName));
    if (tolerant) return tolerant;
    // 4. semantic slot match ("LeftArm" → LeftUpperArm slot → our node)
    const slot = slotForBoneName(sourceName);
    return slot ? (lookup.bySlot.get(slot) ?? null) : null;
  };

  // `clone` walks every targeted animation and asks us for the new target.
  const cloned = source.clone(newName, (oldTarget) => {
    const node = resolve(oldTarget);
    if (node) {
      remapped += 1;
      return node;
    }
    dropped += 1;
    const n =
      oldTarget && typeof oldTarget === 'object' && 'name' in oldTarget
        ? String((oldTarget as { name: unknown }).name)
        : '<unnamed>';
    unmatched.add(n);
    // Returning null drops the track; Babylon tolerates null targets here.
    return null;
  });

  // Tracks whose target failed to resolve are removed so they can't throw.
  const bad = cloned.targetedAnimations.filter((ta) => !ta.target);
  if (bad.length > 0) {
    const keep = cloned.targetedAnimations.filter((ta) => !!ta.target);
    cloned.targetedAnimations.length = 0;
    for (const ta of keep) cloned.addTargetedAnimation(ta.animation, ta.target);
  }

  return {
    group: cloned,
    report: { remapped, dropped, unmatchedNames: [...unmatched] },
  };
}

/**
 * Strip root motion by removing POSITION tracks on the hips bone.
 * Quaternius ships root-motion and in-place variants; if you picked a
 * root-motion file but want the character to animate in place, use this.
 */
export function stripRootMotion(group: AnimationGroup, hipsBoneName: string): AnimationGroup {
  const hips = normalizeBoneName(hipsBoneName);
  const keep = group.targetedAnimations.filter((ta) => {
    const target = ta.target as { name?: unknown } | null;
    const name = target && typeof target.name === 'string' ? target.name : '';
    const isHips = normalizeBoneName(name) === hips;
    const isPosition = ta.animation.targetProperty.toLowerCase().includes('position');
    return !(isHips && isPosition);
  });

  const rebuilt = keep.map((ta) => ({ animation: ta.animation, target: ta.target }));
  group.targetedAnimations.length = 0;
  for (const ta of rebuilt) group.addTargetedAnimation(ta.animation, ta.target);
  return group;
}

/**
 * Cross-fade between two animation groups over `durationMs`.
 * Babylon has per-group weights; this drives them from the render loop.
 */
export function crossFade(
  scene: Scene,
  from: AnimationGroup | null,
  to: AnimationGroup,
  durationMs = 250,
): void {
  if (from === to) return;

  to.setWeightForAllAnimatables(from ? 0 : 1);
  if (!to.isPlaying) to.play(to.loopAnimation);

  if (!from) return;

  const start = performance.now();
  const observer = scene.onBeforeRenderObservable.add(() => {
    const t = Math.min(1, (performance.now() - start) / durationMs);
    to.setWeightForAllAnimatables(t);
    from.setWeightForAllAnimatables(1 - t);
    if (t >= 1) {
      from.stop();
      scene.onBeforeRenderObservable.remove(observer);
    }
  });
}
