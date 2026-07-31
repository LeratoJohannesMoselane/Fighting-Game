# @aether-break/babylon-humanoid

Procedural humanoid characters driven by **Quaternius `.glb` animation files** in
Babylon.js. **No Blender. No custom model file.** The character is built from
primitives in code; the motion comes from the downloaded `.glb` clips.

---

## The 6 steps

### 1. Install

```bash
pnpm add @babylonjs/core @babylonjs/loaders
```

### 2. Get the animations — where they go, what to name them

Download **Universal Animation Library 2 [Standard]** (free, CC0) from
<https://quaternius.itch.io/universal-animation-library-2>, then copy the `.glb`
files into your public assets folder. In this repo that is:

```
packages/babylon-humanoid/demo/public/animations/
```

Files there are served from the web root, so `IDLE_NO.glb` → `/animations/IDLE_NO.glb`.

**Keep the original filenames.** Clip names live *inside* each `.glb`; you map
them to your own keys in code, so renaming files on disk gains nothing.

The pack comes in one of two layouts, and both are supported:

**A — one combined library** (the Godot export, usually easiest):

```
animations/AnimationLibrary_Godot_Standard.glb    ← all clips in ONE file
```

**B — one file per clip:**

```
animations/IDLE_NO.glb
animations/WALK_CARRY.glb
animations/SWORD_REGULAR_A.glb
```

> **Characters?** You don't need one. The character is generated in code by
> `createProceduralCharacter()`. Only add a model file if you later want to
> replace the box-man — see "Using a real model" below.

Full placement guide: [`demo/public/animations/README.md`](demo/public/animations/README.md)

### 3. Find out what the bones are actually called ← **do not skip this**

There is no universal bone-naming standard. Run this once and read the console:

```ts
import { printGlbBoneNames } from '@aether-break/babylon-humanoid';

await printGlbBoneNames(scene, '/animations/IDLE_NO.glb');
```

```
Bone count       : 22
Bones            : ['Hips', 'Spine', 'Chest', 'Neck', 'Head', 'LeftShoulder', ...]
Detected scheme  : unity
Matched slots    : 22 / 22
```

Whatever it prints is the truth for your download — trust it over any table.

### 4. Build the character with matching bone names

```ts
import {
  createProceduralCharacter,
  UNITY_SCHEME,   // or MIXAMO_SCHEME / UNREAL_SCHEME / BLENDER_SCHEME
} from '@aether-break/babylon-humanoid';

const hero = createProceduralCharacter(scene, { scheme: UNITY_SCHEME });
```

### 5. Load + retarget + play

**Layout A — one combined library.** Map the pack's clip names to your own keys:

```ts
import { CharacterController } from '@aether-break/babylon-humanoid';

const controller = new CharacterController(scene, hero);

await controller.loadLibrary('/animations/AnimationLibrary_Godot_Standard.glb', {
  only:   ['Idle', 'Walk', 'Sword_Slash'],          // skip the other 120+
  rename: { Idle: 'idle', Walk: 'walk', Sword_Slash: 'attack' },
});

controller.play('idle');
```

**Layout B — one file per clip:**

```ts
await controller.loadAll([
  { key: 'idle',  url: '/animations/IDLE_NO.glb',          loop: true },
  { key: 'walk',  url: '/animations/WALK_CARRY.glb',       loop: true, inPlace: true },
  { key: 'sword', url: '/animations/SWORD_REGULAR_A.glb',  loop: false },
]);

controller.play('idle');
```

Not sure what's inside your file? `await printGlbBoneNames(scene, url)` lists
every clip name and bone name in your actual download.

### 6. Drive it from gameplay

```ts
controller.play(isMoving ? 'walk' : 'idle');   // cross-fades automatically
```

---

## Can Babylon retarget between skeletons?

**Short answer: only when the skeletons are structurally identical — and this
library makes them identical for you.**

The long answer, because it explains the whole design:

| | Supported? |
| --- | --- |
| Same bone names + same hierarchy | **Yes** — re-point each track. This library does that. |
| Different names, same hierarchy | **Yes, via this library** — semantic slot matching bridges the names. |
| Different proportions / rest pose | **Not automatically.** Different bone *orientations* need per-bone correction, which Babylon does not do for you. |

Babylon has no built-in cross-skeleton retargeter. What it gives you is
`AnimationGroup.clone(name, targetConverter)`, which walks every animation track
and asks *"what should this one target now?"* — that is the hook this library
uses.

We sidestep the hard part of retargeting by **building our rig to match the
source rig's hierarchy and rest pose**, so no rotation correction is ever
needed.

### The one gotcha that breaks most attempts

> **In glTF/GLB, animation tracks target `TransformNode`s — not `Bone`s.**

If your `targetConverter` returns a `Bone`, the file loads, the clip plays, and
**nothing moves**. You must return the TransformNode linked to the bone:

```ts
const node = bone.getTransformNode();   // ← this is the animation target
```

That is also why every bone in `createProceduralCharacter` is created with
`bone.linkTransformNode(node)`. Without that link there is nothing to animate.

There is a test asserting this exact behaviour:
`'animation tracks target TransformNodes, NOT Bones'`.

---

## Required bones

22 slots, in the hierarchy every humanoid retargeting system expects:

```
Hips ─┬─ Spine ── Chest ── UpperChest ─┬─ Neck ── Head
      │                                ├─ LeftShoulder  ── LeftUpperArm  ── LeftLowerArm  ── LeftHand
      │                                └─ RightShoulder ── RightUpperArm ── RightLowerArm ── RightHand
      ├─ LeftUpperLeg  ── LeftLowerLeg  ── LeftFoot  ── LeftToes
      └─ RightUpperLeg ── RightLowerLeg ── RightFoot ── RightToes
```

Names per scheme:

| Slot | Unity / Godot | Mixamo | Unreal |
| --- | --- | --- | --- |
| Hips | `Hips` | `mixamorig:Hips` | `pelvis` |
| Spine | `Spine` | `mixamorig:Spine` | `spine_01` |
| Chest | `Chest` | `mixamorig:Spine1` | `spine_02` |
| UpperChest | `UpperChest` | `mixamorig:Spine2` | `spine_03` |
| Neck | `Neck` | `mixamorig:Neck` | `neck_01` |
| Head | `Head` | `mixamorig:Head` | `head` |
| LeftShoulder | `LeftShoulder` | `mixamorig:LeftShoulder` | `clavicle_l` |
| LeftUpperArm | `LeftUpperArm` | `mixamorig:LeftArm` | `upperarm_l` |
| LeftLowerArm | `LeftLowerArm` | `mixamorig:LeftForeArm` | `lowerarm_l` |
| LeftHand | `LeftHand` | `mixamorig:LeftHand` | `hand_l` |
| LeftUpperLeg | `LeftUpperLeg` | `mixamorig:LeftUpLeg` | `thigh_l` |
| LeftLowerLeg | `LeftLowerLeg` | `mixamorig:LeftLeg` | `calf_l` |
| LeftFoot | `LeftFoot` | `mixamorig:LeftFoot` | `foot_l` |
| LeftToes | `LeftToes` | `mixamorig:LeftToeBase` | `ball_l` |

(Right side mirrors the left.)

**You don't have to match exactly.** `slotForBoneName()` resolves aliases, so a
Mixamo clip drives a Unity-named rig with no manual mapping — there are tests
covering Mixamo→Unity and Unreal→Unity.

---

## Run the demo

```bash
pnpm --filter @aether-break/babylon-humanoid demo
```

Then put your `.glb` files in `demo/public/animations/` and reload. With no
files present it still runs and shows the character in its T-pose bind pose
with instructions.

The demo auto-detects the naming scheme and **rebuilds the rig** to match your
files, then reports what it found on screen.

---

## API

| Export | Purpose |
| --- | --- |
| `createProceduralCharacter(scene, opts)` | Skinned box-man + 22-bone rig |
| `CharacterController` | Clip library + cross-fading state machine |
| `loadAndRetargetClip(scene, url, skeleton, opts)` | Load one `.glb`, retarget it |
| `loadAnimationLibrary(scene, url, skeleton, opts)` | Load a **combined** multi-clip `.glb`, keyed by clip name |
| `retargetAnimationGroup(group, skeleton, name, map?)` | Low-level retarget |
| `stripRootMotion(group, hipsName)` | Root-motion clip → in-place |
| `crossFade(scene, from, to, ms)` | Weight-blend two groups |
| `inspectGlb` / `printGlbBoneNames` | **Diagnostics — run first** |
| `detectScheme(boneNames)` | Identify + repair a naming scheme |
| `slotForBoneName(name)` | Any bone name → semantic slot |

### Using a real model instead of the box-man

Nothing here is tied to the procedural character — `retargetAnimationGroup()`
takes any skeleton. Drop a rigged `.glb` in `demo/public/models/` and retarget
onto its own rig:

```ts
const model = await LoadAssetContainerAsync('/models/hero.glb', scene);
model.addAllToScene();
await loadAnimationLibrary(scene, libraryUrl, model.skeletons[0]);
```

Caveat: a third-party model's rest pose and joint orientations may not match the
animation's, which renaming alone cannot fix (see Troubleshooting).

### Root motion

Quaternius ships root-motion and in-place variants. If you picked a root-motion
file but want the character to stay put, use `inPlace: true` (or call
`stripRootMotion`) — it removes the hips *position* track and keeps rotations.

---

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Loads, but nothing moves | Targeting `Bone` instead of `bone.getTransformNode()` |
| Limbs twisted / broken | Rest-pose mismatch. Source rig isn't a T-pose, or joint orientations differ — needs per-bone correction, not just renaming. |
| Some tracks dropped | Normal for fingers/twist/IK bones this rig doesn't have. Check `report.unmatchedNames`. |
| Character slides across the floor | Root-motion clip — set `inPlace: true` |
| `No animation groups found` | That `.glb` is a mesh, not an animation |

---

## Tests

```bash
pnpm --filter @aether-break/babylon-humanoid test
```

25 tests, all running headlessly on `NullEngine`. They don't mock the loader —
each test **exports a real `.glb`** with Babylon's serializer, re-imports it
through the glTF loader, retargets it, renders a frame, and asserts the bone
transforms actually changed.
