# Put your character files here

**This folder is `packages/babylon-humanoid/demo/public/characters/`.**

Everything under `demo/public/` is served from the web root, so
`characters/bodies/Superhero_Female_FullBody.gltf` becomes the URL
`/characters/bodies/Superhero_Female_FullBody.gltf`.

---

## Copy these 3 groups from your extracted packs

### 1 → `bodies/`

From **Base Characters / Godot - UE/**, copy **both** bodies with **all** their
`.bin` and `.png` files:

```
bodies/
├── Superhero_Female_FullBody.gltf
├── Superhero_Female_FullBody.bin          ← required
├── Superhero_Male_FullBody.gltf
├── Superhero_Male_FullBody.bin            ← required
├── T_Superhero_Female_Dark_BaseColor.png
├── T_Superhero_Female_Normal.png
├── T_Superhero_Female_Roughness.png
├── T_Superhero_Male_Dark.png
├── T_Superhero_Male_Normal.png
├── T_Superhero_Male_Roughness.png
├── T_Eye_Brown.png
└── T_Eye_Normal.png
```

Easiest approach: copy the **whole `Godot - UE` folder contents** in one go.

### 2 → `hair/`

From **Hairstyles / Rigged to Head Bone / glTF (Godot-Unreal)/** — note
*Rigged to Head Bone*, **not** *Origin at 0*:

```
hair/
├── Hair_Long.gltf         + Hair_Long.bin
├── Hair_Beard.gltf        + Hair_Beard.bin
├── Hair_Buns.gltf         + Hair_Buns.bin
├── Hair_Buzzed.gltf       + Hair_Buzzed.bin
├── Eyebrows_Female.gltf   + Eyebrows_Female.bin
├── Eyebrows_Regular.gltf  + Eyebrows_Regular.bin
├── T_Hair_1_BaseColor.png
├── T_Hair_1_Normal.png
├── T_Hair_2_BaseColor.png
└── T_Hair_2_Normal.png
```

Again: copying the whole `glTF (Godot-Unreal)` folder is fine.

### 3 → `animations/`

From **Universal Animation Library 2 / Unreal-Godot/**:

```
animations/
└── UAL2_Standard.glb
```

(`UAL2_Standard_RM.glb` is the root-motion variant — not needed.)

---

## Then run it

From the repo root:

```bash
pnpm install                                        # first time only
pnpm --filter @aether-break/babylon-humanoid demo
```

Open **http://localhost:5180**.

If files are missing, the page tells you exactly which ones — it won't just
show a blank canvas.

---

## The 4 mistakes that cost the most time

1. **Separating a `.gltf` from its `.bin`.** The `.gltf` is JSON that points at
   the binary by *relative filename*. Split them and the model loads as an
   empty scene **with no error message**.
2. **Leaving the textures behind.** Same relative-path reason — you get an
   untextured white model.
3. **Using `Origin at 0` hair.** That variant is centred on the world origin
   and ends up at the character's feet. Use **`Rigged to Head Bone`**.
4. **Copying the FBX folders.** Babylon has no FBX loader. Only the
   `glTF` / `Godot - UE` folders are useful here.

---

## Using a different folder

The three paths are constants at the top of `demo/main.ts`:

```ts
const BODIES_URL  = '/characters/bodies/';
const HAIR_URL    = '/characters/hair/';
const LIBRARY_URL = '/characters/animations/UAL2_Standard.glb';
```

In your own game, pass them to `createAetherRoster()` instead.

---

## Version control

`.gltf`, `.bin` and `.glb` files here are **gitignored**. They're CC0 so
committing them is fine — to do that, remove the matching lines from the repo
root `.gitignore`.
