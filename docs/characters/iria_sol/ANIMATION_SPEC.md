# ANIMATION SPECIFICATION: Iria Sol

## Rig Requirements

- **Base:** Standard Aether Break humanoid (shared skeleton).
- **Extra bones:**
  - `PROP_staff` (right hand socket, length ~1.1× arm span)
  - `PROP_card_orbit_0..5` (optional; can be VFX-only if budget tight)
  - `FX_staff_crystal` socket (tip of staff)
  - `FX_ward_center` (chest)
- **Root motion:** **No** for combat clips. Locomotion in-place; CombatCore owns translation.
- **Scale:** 1.0 shared humanoid; staff mesh may extend AABB for shadow only (not hit detection).

## Animation List (18 unique clips + 3 props)

| Animation Name | Duration | Key Poses | Notes |
|----------------|----------|-----------|-------|
| `idle_iria` | 60f loop | Staff vertical, weight on rear foot | Slow breath; 1 card orbit cycle / 60f |
| `walk_iria` | 32f loop | Glide, minimal hip sway | Match walk 245 fp — elegant, not march |
| `dash_iria` | 18f | Tuck cloak, staff back | First 10f = dash active feel |
| `jump_iria` | 6f + hold | Knees up, staff across | Exit into airborne loop pose |
| `land_iria` | 8f | Soft knee bend | No heavy stomp |
| `crouch_iria` | 4f → loop | Compact, staff diagonal | Readable low profile |
| `block_iria` | 4f → loop | Prism plate gesture mid | Ward-ready silhouette |
| `hitstun_iria` | 12f | Recoil chest / head snap | Light vs heavy variants via speed scale |
| `launch_iria` | 16f | Arc back | For Light 2 float |
| `knockdown_iria` | 20f | Fall to side | Hold last frame |
| `wakeup_iria` | 14f | Rise with staff plant | Invuln is data, not anim |
| `light_1_iria` | 23f | Jab with staff ferrule | Hit frames 5–7 |
| `light_2_iria` | 29f | Hooking staff head sweep | Hit 6–9; air-float pose on hit react |
| `heavy_iria` | 53f | Wide low sweep | Hit 14–17; crouch-hurt feel |
| `air_light_iria` | 29f | Down-forward poke | Jump-in |
| `ranged_iria` | 38f | Staff tip thrust | Projectile spawn f11 |
| `ability_1_iria` | 38f | Card flick from offhand | Gate place f10 |
| `ability_2_iria` | 41f | Open palm → crystal shield | Active ward 4–21 |
| `ultimate_iria` | 50f | Staff overhead → star pose | Camera lock ≤18f at impact |
| `win_iria` | 90f | Cards arrange heptagram | Victory only |
| `lose_iria` | 60f | Staff clatter, kneel | |
| `gate_idle` | 30f loop | Prism spin | Prop / VFX mesh |
| `gate_fire` | 12f | Flash open | On bolt emit |
| `gate_break` | 10f | Shatter | On destroy |

## Event Markers

| Animation | Frame | Event | Data |
|-----------|-------|-------|------|
| `light_1_iria` | 5 | `hitbox_active` | `iria_light_1` |
| `light_1_iria` | 5 | `sfx` | `iria_light_1_sfx` |
| `light_1_iria` | 5 | `vfx` | `iria_hit_light` (on hit only — emit from combat event) |
| `light_2_iria` | 6 | `hitbox_active` | `iria_light_2` |
| `light_2_iria` | 6 | `sfx` | `iria_light_2_sfx` |
| `heavy_iria` | 12 | `hurtbox_shrink` | low profile |
| `heavy_iria` | 14 | `hitbox_active` | `iria_heavy` |
| `heavy_iria` | 14 | `sfx` | `iria_heavy_sfx` |
| `ranged_iria` | 11 | `spawn_projectile` | `iria_bolt` |
| `ranged_iria` | 11 | `sfx` | `iria_ranged_sfx` |
| `ability_1_iria` | 10 | `spawn_gate` | placement rule |
| `ability_1_iria` | 10 | `sfx` | `iria_ability_1_sfx` |
| `ability_1_iria` | 10 | `vfx` | `iria_ability_1_effect` |
| `ability_2_iria` | 4 | `ward_start` | |
| `ability_2_iria` | 21 | `ward_end` | |
| `ability_2_iria` | 4 | `sfx` | `iria_ability_2_sfx` |
| `ultimate_iria` | 8 | `hitbox_active` | `iria_sevenfold` |
| `ultimate_iria` | 8 | `camera_lock` | 18f |
| `ultimate_iria` | 8 | `sfx` | `iria_ultimate_sfx` |
| `ultimate_iria` | 8 | `vo` | `iria_ultimate` |
| `gate_fire` | 0 | `spawn_projectile` | gate bolt |
| `gate_break` | 0 | `sfx` | `iria_gate_break_sfx` |

## Timing Contract (must match JSON)

CombatCore frame data is authoritative. Animation clip length ≥ `startup + (activeEnd − activeStart + 1) + recovery` for grounded normals. Presentation may pad end frames; **never** move hitbox events off data frames.

## Export Settings

- **Format:** glTF 2.0 (`.glb`)
- **Compression:** meshopt primary; Draco optional if size requires
- **LODs:** LOD0 28k / LOD1 14k / LOD2 6k tris
- **Textures:** KTX2/BasisU; body 2K, props 1K atlas
- **Naming:** `iria_<clip>.glb` or single `iria_sol.glb` with named clips
- **Up axis:** Y-up; forward −Z (Babylon default)
- **No** embedded lights/cameras

## Readability Checklist

- [ ] Staff tip readable in silhouette at Medium quality  
- [ ] Ward pose distinct from block in 12f glance test  
- [ ] Gate card color ≠ Nyra muzzle flash (cyan-violet vs teal)  
- [ ] Ultimate pose readable under 18f camera lock  
