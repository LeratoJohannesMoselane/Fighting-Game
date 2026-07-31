# Put your `.glb` files in THIS folder

**Full path:** `packages/babylon-humanoid/demo/public/animations/`

Files here are served from the web root, so `Mannequin_F.glb` becomes the URL
**`/animations/Mannequin_F.glb`**.

---

## You need exactly TWO files

From your extracted `Universal Animation Library 2[Standard]` folder:

| Copy this | From | It is |
| --- | --- | --- |
| **`Mannequin_F.glb`** | `Female Mannequin/Unreal-Godot/` | The **character** (rigged model) |
| **`UAL2_Standard.glb`** | `Unreal-Godot/` | **All the animations** in one file |

Result:

```
packages/babylon-humanoid/demo/public/animations/
├── Mannequin_F.glb      ← character
└── UAL2_Standard.glb    ← every animation clip
```

**Do not rename them.** Clip names live *inside* `UAL2_Standard.glb`; you map
those to your own keys in code.

Then just run the demo — those are the default paths:

```bash
pnpm --filter @aether-break/babylon-humanoid demo
```

---

## Which files to ignore, and why

Your download has more than you need:

| File | Use it? | Why |
| --- | --- | --- |
| `Unreal-Godot/UAL2_Standard.glb` | ✅ **Yes** | The animations. glTF = native for Babylon. |
| `Female Mannequin/Unreal-Godot/Mannequin_F.glb` | ✅ **Yes** | Rigged character, matching skeleton. |
| `Unreal-Godot/UAL2_Standard_RM.glb` | ⚠️ Optional | Same clips **with root motion** — the character physically travels. Use it if you want movement driven by the animation; otherwise the plain file is simpler. |
| `Unity/*.fbx` | ❌ No | **Babylon cannot load FBX.** Use the Unreal-Godot `.glb` files. |
| `Mannequin_F.blend` | ❌ No | Blender source — you're not using Blender. |
| `*_Setup.png`, `README.txt` | ❌ No | Engine setup screenshots for Unity/Unreal/Godot. |

> **The `Unreal-Godot` folder is the right one** despite the name — those are
> `.glb` (glTF binary), which is Babylon's native 3D format. The `Unity` folder
> is `.fbx`, which Babylon has no loader for.

---

## Root motion: `UAL2_Standard.glb` vs `UAL2_Standard_RM.glb`

- **`UAL2_Standard.glb`** — animations play *in place*. The character runs on
  the spot; you move it in code (`character.root.position`). **Start here** —
  it's what most game code expects.
- **`UAL2_Standard_RM.glb`** — `RM` = **Root Motion**. The hips translate, so
  the character physically travels as the clip plays.

If you load the RM file but want in-place, strip it at load time:

```ts
await controller.loadLibrary('/animations/UAL2_Standard_RM.glb', { inPlace: true });
```

---

## Three different "names" — don't conflate them

| | Example | Who decides |
| --- | --- | --- |
| **File name** | `UAL2_Standard.glb` | Quaternius — leave it alone |
| **Clip name** (inside the file) | `Sword_Slash` | Quaternius — read it, don't guess |
| **Your key** | `attack` | **You** — map it in code |

Find the real clip names (the browser console, once the demo is running):

```js
await demo.inspectGlb('/animations/UAL2_Standard.glb');
```

Then map them:

```ts
await controller.loadLibrary('/animations/UAL2_Standard.glb', {
  only:   ['Idle', 'Walk', 'Sword_Slash'],           // whatever inspect printed
  rename: { Idle: 'idle', Walk: 'walk', Sword_Slash: 'attack' },
});
controller.play('attack');
```

Leave `LIBRARY_ONLY` and `RENAME` empty on the first run — the demo will load
everything and put a button on screen for each clip, which is the quickest way
to see the real names.

---

## "Where do the characters go?"

Same folder — `Mannequin_F.glb` sits right next to the animation file.

You have two options, and **the mannequin is the better one**:

1. **`Mannequin_F.glb` (recommended).** It's rigged with the *same skeleton*
   the animations were authored against, so retargeting is a perfect 1:1 match
   — no proportion or rest-pose mismatch. This is the demo default.
2. **Procedural box-man.** Set `MODEL_URL = null` in `demo/main.ts`. Useful if
   you want a character with zero asset dependencies.

Either way the rest of the code is identical — `CharacterController` accepts
both.

---

## Version control

`.glb` files here are **gitignored**. They're CC0 so committing them is legal
and fine; to do that, delete these lines from the repo root `.gitignore`:

```
packages/babylon-humanoid/demo/public/animations/*.glb
packages/babylon-humanoid/demo/public/animations/*.gltf
```
