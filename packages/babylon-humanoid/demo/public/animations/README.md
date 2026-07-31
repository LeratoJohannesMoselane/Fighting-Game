# Put your `.glb` animation files in THIS folder

**Full path:** `packages/babylon-humanoid/demo/public/animations/`

Anything in here is served from the web root, so a file called
`IDLE_NO.glb` becomes the URL **`/animations/IDLE_NO.glb`**.

---

## Which files, and what to call them

**Short answer: do not rename anything.** Keep the pack's original filenames.
The loader reads the clip names from *inside* each `.glb`, and you map those to
your own gameplay keys in code — renaming files on disk buys you nothing and
makes it harder to re-download later.

### Step 1 — download

Get **Universal Animation Library 2 [Standard]** (free, CC0) from
<https://quaternius.itch.io/universal-animation-library-2>

### Step 2 — find the GLB files

Unzip it. Depending on the engine folder you look in, you get one of two
layouts. **Both work** — the demo auto-detects which one you have.

#### Layout A — one combined library (the Godot export)

```
demo/public/animations/
└── AnimationLibrary_Godot_Standard.glb     ← all 40+ clips in ONE file
```

This single file contains every animation as a separately named clip
(`Idle`, `Walk`, `Sword_Slash`, …). This is usually the easiest option.

#### Layout B — one file per clip

```
demo/public/animations/
├── IDLE_NO.glb
├── WALK_CARRY.glb
└── SWORD_REGULAR_A.glb
```

### Step 3 — point the demo at them

Open `demo/main.ts` and edit the config block at the top.

**For Layout A:**

```ts
const LIBRARY_URL = '/animations/AnimationLibrary_Godot_Standard.glb';
const LIBRARY_ONLY = ['Idle', 'Walk', 'Sword_Slash']; // [] = load all
```

**For Layout B:**

```ts
const LIBRARY_URL = null;
const CLIPS = [
  { key: 'idle',  url: '/animations/IDLE_NO.glb',         loop: true },
  { key: 'walk',  url: '/animations/WALK_CARRY.glb',      loop: true, inPlace: true },
  { key: 'sword', url: '/animations/SWORD_REGULAR_A.glb', loop: false },
];
```

### Step 4 — find out the real clip names

Don't guess what's inside the file. Run the demo and open the browser console:

```js
await demo.inspectGlb('/animations/AnimationLibrary_Godot_Standard.glb');
```

It prints every clip name and every bone name in your actual download. Use
those exact strings in `LIBRARY_ONLY` / `rename`.

---

## Naming: file vs. clip vs. gameplay key

Three different names, easy to conflate:

| | Example | Who decides |
| --- | --- | --- |
| **File name** | `AnimationLibrary_Godot_Standard.glb` | Quaternius — leave it alone |
| **Clip name** (inside the file) | `Sword_Slash` | Quaternius — read it with `inspectGlb` |
| **Your key** | `attack` | **You** — map it in code |

Map clip names to your own keys so gameplay code stays readable:

```ts
await controller.loadLibrary('/animations/AnimationLibrary_Godot_Standard.glb', {
  rename: {
    Idle: 'idle',
    Walk: 'walk',
    Sword_Slash: 'attack',
  },
  only: ['Idle', 'Walk', 'Sword_Slash'],
});

controller.play('attack');
```

If you skip `rename`, the clip keeps its original name and you call
`controller.play('Sword_Slash')`.

---

## Where do CHARACTERS go?

**You don't need a character file.** The character is built in code by
`createProceduralCharacter()` — that's the whole point of this package, since
you're not using Blender.

If you later want a *real* rigged model, put it in this same folder
(`demo/public/animations/` or a sibling `demo/public/models/`) and load it with
`LoadAssetContainerAsync`. Then retarget onto **its** skeleton instead of the
procedural one — `retargetAnimationGroup()` takes any skeleton:

```ts
const model = await LoadAssetContainerAsync('/models/hero.glb', scene);
model.addAllToScene();
const skeleton = model.skeletons[0];          // the model's own rig
await loadAnimationLibrary(scene, libraryUrl, skeleton);
```

Good CC0 sources for rigged characters that pair with this pack: **KayKit**,
**Kenney**, and Quaternius' own character kits.

---

## Note on version control

`.glb` files here are **gitignored** — they're CC0 and safe to ship, but they
aren't committed to this repo. Each developer downloads their own copy.

If you'd rather commit them (simpler for a small team), delete these two lines
from the repo root `.gitignore`:

```
packages/babylon-humanoid/demo/public/animations/*.glb
packages/babylon-humanoid/demo/public/animations/*.gltf
```
