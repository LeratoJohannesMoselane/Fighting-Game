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

### 2. Get the files — you need exactly two

Download **Universal Animation Library 2 [Standard]** (free, CC0) from
<https://quaternius.itch.io/universal-animation-library-2> and copy two files
into `packages/babylon-humanoid/demo/public/characters/`:

| Copy | From the pack | It is |
| --- | --- | --- |
| `Mannequin_F.glb` | `Female Mannequin/Unreal-Godot/` | The **character** (rigged) |
| `UAL2_Standard.glb` | `Unreal-Godot/` | **All animations** in one file |

```
demo/public/characters/
├── bodies/     Mannequin_F.glb  or  Superhero_*_FullBody.gltf + .bin
├── hair/       Hair_*.gltf + .bin        (optional)
└── animations/ UAL2_Standard.glb
```

**Ignore the `Unity/` folder** — it holds `.fbx`, which Babylon cannot load.
The `Unreal-Godot/` folder is the right one: `.glb` is glTF binary, Babylon's
native format. Also ignore `.blend` (that's Blender source).

`UAL2_Standard_RM.glb` is the same clips **with root motion** (the character
travels through space). Start with the plain file.

**Keep the original filenames** — clip names live *inside* the `.glb`, and you
map them to your own keys in code.

Full placement guide: [`demo/public/characters/README.md`](demo/public/characters/README.md)

### 3. Find out what the bones are actually called ← **do not skip this**

There is no universal bone-naming standard. Run this once and read the console:

```ts
import { printGlbBoneNames } from '@aether-break/babylon-humanoid';

await printGlbBoneNames(scene, '/characters/animations/UAL2_Standard.glb');
```

```
Bone count       : 22
Bones            : ['Hips', 'Spine', 'Chest', 'Neck', 'Head', 'LeftShoulder', ...]
Detected scheme  : unity
Matched slots    : 22 / 22
```

Whatever it prints is the truth for your download — trust it over any table.

### 4. Get a character

**Option A — use the pack's mannequin (recommended).** It's rigged with the
exact skeleton the animations were authored for, so retargeting is a perfect
1:1 name match with no proportion or rest-pose mismatch:

```ts
import { loadRiggedCharacter } from '@aether-break/babylon-humanoid';

const hero = await loadRiggedCharacter(scene, '/characters/bodies/Mannequin_F.glb');
```

**Option B — generate one in code** (no asset needed at all):

```ts
import { createProceduralCharacter, UNITY_SCHEME } from '@aether-break/babylon-humanoid';

const hero = createProceduralCharacter(scene, { scheme: UNITY_SCHEME });
```

Everything downstream is identical — `CharacterController` takes either.

### 5. Load + retarget + play

`UAL2_Standard.glb` is a **combined library** — every clip in one file:

```ts
import { CharacterController } from '@aether-break/babylon-humanoid';

const controller = new CharacterController(scene, hero);

await controller.loadLibrary('/characters/animations/UAL2_Standard.glb', {
  only:   ['Idle', 'Walk', 'Sword_Slash'],          // omit to load all
  rename: { Idle: 'idle', Walk: 'walk', Sword_Slash: 'attack' },
});

controller.play('idle');
```

Use the names `printGlbBoneNames` / `inspectGlb` printed — don't guess them.

If you instead have one `.glb` per clip, `controller.loadAll([{ key, url }, …])`
does the same job.

### 6. Drive it from gameplay

```ts
controller.play(isMoving ? 'walk' : 'idle');   // cross-fades automatically
```

**Building an actual game with two fighters?** See
**[USING_IN_YOUR_GAME.md](USING_IN_YOUR_GAME.md)** — `createFighterFactory()`
spawns N independently-animated fighters from one model file, and
`resolveClip()` maps CombatCore fighter state onto the pack's clip names.

```ts
const factory = await createFighterFactory(scene, {
  modelUrl:   '/characters/bodies/Mannequin_F.glb',
  libraryUrl: '/characters/animations/UAL2_Standard.glb',
  only:    clipsUsedBy(DEFAULT_CLIP_MAP),
  rename:  renameFromClipMap(DEFAULT_CLIP_MAP),
  aliases: aliasesFor(DEFAULT_CLIP_MAP),
  inPlace: true,
});
const p1 = factory.spawn('p1');
const p2 = factory.spawn('p2');

// each frame:
p1.root.position.set(f.x / 1000, f.y / 1000, 0);
p1.play(resolveClip(f));
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

Then put your files in `demo/public/characters/` and reload. With no
files present it still runs and shows the character in its T-pose bind pose
with instructions.

The demo auto-detects the naming scheme and **rebuilds the rig** to match your
files, then reports what it found on screen.

---

## API

| Export | Purpose |
| --- | --- |
| `createProceduralCharacter(scene, opts)` | Skinned box-man + 22-bone rig |
| `loadRiggedCharacter(scene, url, opts)` | Load a real rigged model (`Mannequin_F.glb`) |
| `describeRig(character)` | How well a rig maps to the humanoid slots |
| `CharacterController` | Clip library + cross-fading state machine (one character) |
| `createFighterFactory(scene, opts)` | **Spawn N independent fighters** from one model — for versus games |
| `resolveClip(fighterState)` | CombatCore phase/move → animation key |
| `DEFAULT_CLIP_MAP` / `BRAWLER_CLIP_MAP` / `ZOMBIE_CLIP_MAP` | Gameplay key → real UAL2 clip |
| `UAL2_CLIPS` | The 43 clip names in the Standard tier |
| `loadAndRetargetClip(scene, url, skeleton, opts)` | Load one `.glb`, retarget it |
| `loadAnimationLibrary(scene, url, skeleton, opts)` | Load a **combined** multi-clip `.glb`, keyed by clip name |
| `retargetAnimationGroup(group, skeleton, name, map?)` | Low-level retarget |
| `stripRootMotion(group, hipsName)` | Root-motion clip → in-place |
| `crossFade(scene, from, to, ms)` | Weight-blend two groups |
| `inspectGlb` / `printGlbBoneNames` | **Diagnostics — run first** |
| `detectScheme(boneNames)` | Identify + repair a naming scheme |
| `slotForBoneName(name)` | Any bone name → semantic slot |

### Root motion

The pack ships both variants: `UAL2_Standard.glb` (in place) and
`UAL2_Standard_RM.glb` (**R**oot **M**otion — the character travels). If you
load the RM file but want in-place, pass `inPlace: true` (or call
`stripRootMotion`) — it drops the hips *position* track and keeps rotations.

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
