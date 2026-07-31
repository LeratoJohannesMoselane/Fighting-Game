# Put your .glb animation files here

1. Download **Universal Animation Library 2 [Standard]** (free) from
   <https://quaternius.itch.io/universal-animation-library-2>
2. Extract it and open the `/GLB/` folder.
3. Copy the `.glb` files you want into **this** directory.
4. Edit the `CLIPS` array at the top of `demo/main.ts` to reference them.

Example layout:

```
demo/public/animations/
  IDLE_NO.glb
  WALK_CARRY.glb
  SWORD_REGULAR_A.glb
```

They are then served at `/animations/IDLE_NO.glb`.

The pack is CC0, so these files are safe to ship — but they are **not**
committed to this repo. Download them yourself.
