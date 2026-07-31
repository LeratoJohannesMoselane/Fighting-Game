# Street Fighter 6 Style Guide — Aether Break Presentation

## Goal

Procedural canvas stand-ins that **read like a premium 2.5D fighter**: bold silhouettes, ink outlines, cel bands, rim light, exaggerated attack motion, and character-specific hit juice — until final glTF LODs replace the mesh layer.

## Art direction

| Pillar | Implementation |
|--------|----------------|
| Ink & paint | Thick dark outline + 2-band cel gradient + rim light (`mesh.ts`) |
| Silhouette | Unique coat/pads/orbs/blade per fighter (`profiles.ts`) |
| Exaggeration | `profile.exaggeration` scales attack windup/strike |
| Anticipation | Late-startup squash before active frames |
| Follow-through | Elastic overshoot in recovery |
| Secondary | Hair/cape lag behind spine |
| Impact | Hitstop freeze + body squash + ink slash VFX |

## Roster palettes (SF6-aligned)

| Fighter | Primary | Secondary | Emission | Personality idle |
|---------|---------|-----------|----------|------------------|
| **Nyra Vex** | Violet `#4A148C` | Teal `#00BCD4` | Magenta `#E040FB` | Cocky gunslinger fidget |
| **Bram Kade** | Forge orange `#E65100` | Steel `#616161` | Lava `#FF6D00` | Stoic wide guard |
| **Iria Sol** | Prism white `#E0F7FA` | Cyan `#00BCD4` | Magenta `#E040FB` | Serene hover + orbs |
| **Kellan Wisp** | Storm blue `#1A237E` | Yellow `#FFEB3B` | Electric `#00E5FF` | Intense low stance |

## Skeleton (final art must match)

```
root → spine → chest → neck → head → hair
                ├─ pauldron
                ├─ l_arm → l_forearm → l_hand → weapon_l
                ├─ r_arm → r_forearm → r_hand → weapon
                └─ cape
     → l_leg → l_shin → l_foot
     → r_leg → r_shin → r_foot
```

Attach points: `r_hand`, `l_hand`, `weapon_tip`, `weapon_l_tip`, `chest`, `feet`.

## Animation phase map

| Combat phase | Visual |
|--------------|--------|
| startup | Anticipation windup (ease-in / back) |
| active (first frame) | Snap strike + extreme squash/stretch |
| active (hold) | Strike pose |
| recovery | Follow-through + elastic settle |
| hitstun | Shudder flinch |
| hitstop | Pose freeze + flash mix |

## VFX signatures

| Event | Nyra | Bram | Iria | Kellan |
|-------|------|------|------|--------|
| Light hit | Teal sparks | Embers | Prism stars | Lightning slash |
| Heavy hit | Ink slash + ring | Ember burst | Prism burst | Electric arc |
| Ult | Magenta storm | Lava rings | Rainbow prism | Full lightning |

## Final art replacement

1. Export glTF with bone names above (or remap table).  
2. LOD0 40–60k / LOD1 25–35k / LOD2 12–18k.  
3. Toon shader: base + shade ramp + rim + emission.  
4. Keep CombatCore frame events; only swap `ProceduralFighterMesh.draw` and clip playback.  
5. Do **not** put art paths in `packages/combat-core`.

## Verify in greybox

```bash
pnpm dev
```

- Character select shows 4 fighters with SF palettes.  
- Idle: personality (Nyra fidget, Bram wide, Iria float, Kellan low).  
- Light: snap punch with stretch.  
- Heavy: huge windup + ink slash on hit.  
- Hitstop: freeze + white flash + squash.  
