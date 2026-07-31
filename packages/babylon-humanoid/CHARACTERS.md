# Replacing Nyra, Bram, Iria & Kellan with the Quaternius base characters

You have the character pack extracted. Here's exactly which files to copy,
where, and how the four fighters are built from them.

---

## 1. Copy these files

Create three folders under your public assets directory and copy from the pack:

```
public/characters/
├── bodies/
│   ├── Superhero_Female_FullBody.gltf   ← Base Characters/Godot - UE/
│   ├── Superhero_Female_FullBody.bin    ← MUST sit next to the .gltf
│   ├── Superhero_Male_FullBody.gltf
│   ├── Superhero_Male_FullBody.bin
│   ├── T_Superhero_Female_Dark_BaseColor.png
│   ├── T_Superhero_Female_Normal.png
│   ├── T_Superhero_Female_Roughness.png
│   ├── T_Superhero_Male_Dark.png
│   ├── T_Superhero_Male_Normal.png
│   ├── T_Superhero_Male_Roughness.png
│   ├── T_Eye_Brown.png
│   └── T_Eye_Normal.png
│
├── hair/                                ← Hairstyles/Rigged to Head Bone/glTF (Godot-Unreal)/
│   ├── Hair_Long.gltf      + .bin
│   ├── Hair_Beard.gltf     + .bin
│   ├── Hair_Buns.gltf      + .bin
│   ├── Hair_Buzzed.gltf    + .bin
│   ├── Eyebrows_Female.gltf + .bin
│   ├── Eyebrows_Regular.gltf + .bin
│   ├── T_Hair_1_BaseColor.png
│   ├── T_Hair_1_Normal.png
│   ├── T_Hair_2_BaseColor.png
│   └── T_Hair_2_Normal.png
│
└── animations/
    └── UAL2_Standard.glb                ← from Universal Animation Library 2
```

### Three rules that will save you an hour

1. **Every `.gltf` needs its `.bin` beside it.** A `.gltf` is JSON that
   references the binary by *relative filename*. Split them up and the model
   loads as an empty scene with no error.
2. **Textures go in the same folder as the `.gltf` that uses them.** Same
   relative-path reason.
3. **Use `Rigged to Head Bone`, not `Origin at 0`.** Both folders exist in the
   pack. The rigged version is authored to sit on the head bone; the other one
   is centred at the world origin and will end up at the character's feet.

> **Ignore the `FBX (Unity)` and `FBX (Unreal Engine)` folders entirely.**
> Babylon has no FBX loader. The `glTF (Godot - UE)` folders are the ones you want.

---

## 2. Use it

```ts
import { createAetherRoster, placeFighters, resolveClip } from '@aether-break/babylon-humanoid';

const roster = await createAetherRoster(scene, {
  bodiesUrl:  '/characters/bodies/',
  hairUrl:    '/characters/hair/',
  libraryUrl: '/characters/animations/UAL2_Standard.glb',
});

const p1 = await roster.spawn('nyra_vex',  'p1');
const p2 = await roster.spawn('bram_kade', 'p2');
placeFighters(p1, p2);

// each frame
scene.onBeforeRenderObservable.add(() => {
  for (const [rig, f] of [[p1, state.fighters[0]], [p2, state.fighters[1]]] as const) {
    rig.root.position.set(f.x / 1000, f.y / 1000, 0);   // FP_SCALE = 1000
    rig.setFacing(f.facing);
    rig.playKey(resolveClip(f));
  }
});
```

That's it. Hair and eyebrows attach to the head bone automatically and follow
every animation.

---

## 3. How each fighter is built

Two base bodies become four distinct characters:

| | Nyra Vex | Bram Kade | Iria Sol | Kellan Wisp |
| --- | --- | --- | --- | --- |
| **Body** | Female | Male | Female | Male |
| **Hair** | `Hair_Long` | `Hair_Beard` | `Hair_Buns` | `Hair_Buzzed` |
| **Brows** | `Eyebrows_Female` | `Eyebrows_Regular` | `Eyebrows_Female` | `Eyebrows_Regular` |
| **Tint** | `#00BCD4` cyan | `#E65100` orange | `#E040FB` violet | `#00E5FF` electric |
| **Build** | 0.94 w × 1.02 h | **1.18 w** × 1.0 h | 0.90 w × 1.04 h | 0.98 w × 1.0 h |
| **Idle** | `IDLE_NO_LOOP` | `IDLE_FOLDARMS_LOOP` | `IDLE_LANTERN_LOOP` | `IDLE_FOLDARMS_LOOP` |
| **Light atk** | `SWORD_REGULAR_A` | **`MELEE_HOOK`** | `SWORD_REGULAR_A` | `SWORD_REGULAR_A` |

**Motion is the strongest signal.** Bram throwing hooks while Nyra slashes reads
as two different fighters far more than colour does. Body type and hair shape
come second; tint is the weakest cue and mostly helps players track themselves
in a busy scene.

### Tuning a character

```ts
import { AETHER_CHARACTERS } from '@aether-break/babylon-humanoid';

AETHER_CHARACTERS.iria_sol.hair = 'Hair_SimpleParted';
AETHER_CHARACTERS.iria_sol.hairColor = '#FFF1C1';
AETHER_CHARACTERS.bram_kade.widthScale = 1.3;
AETHER_CHARACTERS.kellan_wisp.clipMap.idle = 'IDLE_RAIL_LOOP';
```

Available hairstyles: `Hair_Beard`, `Hair_Buns`, `Hair_Buzzed`,
`Hair_BuzzedFemale`, `Hair_Long`, `Hair_SimpleParted`.

---

## 4. Performance

- **One factory per body type, not per character.** Nyra and Iria share the
  female body's geometry and textures on the GPU; only materials and skeletons
  are per-fighter.
- **Materials are cloned per fighter.** Necessary — Babylon shares one material
  across instances by default, so tinting Nyra would otherwise recolour Iria.
  There's a test pinning this.
- **Only the clips the roster uses are loaded** (20 of 43), retargeted once at
  spawn.
- Skip hair while iterating on gameplay: `skipHair: true`.

---

## 5. Troubleshooting

| Symptom | Cause |
| --- | --- |
| Model loads but is invisible / empty | The `.bin` isn't next to the `.gltf` |
| Model is untextured / white | PNGs aren't in the same folder as the `.gltf` |
| Hair sits at the character's feet | You used `Origin at 0` instead of `Rigged to Head Bone` |
| Hair doesn't follow the head | Not attached — check the console for the `no Head bone` error |
| All fighters are the same colour | Materials being shared; `cloneMaterials` must stay `true` |
| `Unknown character "x"` | Roster id typo — valid ids are the four in `AETHER_CHARACTERS` |
| 404s on `.bin` | Your dev server isn't serving the folder; confirm the URL in devtools |

---

## 6. What I could not verify

I don't have your actual pack files, so these are assumptions worth checking on
first run:

- **Bone naming.** Your inspect output said `unreal` with 22/22 slots for
  `Mannequin_F.glb`. The Superhero bodies are from the same author and almost
  certainly match, but run `printGlbBoneNames(scene, '/characters/bodies/Superhero_Female_FullBody.gltf')`
  to confirm. If the count differs, retargeting still works — the semantic slot
  matcher handles naming differences — but it's worth knowing.
- **Body scale.** The style scales (0.9–1.18) assume the Superhero bodies are
  roughly the mannequin's height. If they import much larger or smaller, adjust
  the `scale` field per character.
- **Hair fit.** The hairstyles are authored for these bodies, so they should sit
  correctly, but if one floats, `attachToHead` takes an `offset` and `scale`.
