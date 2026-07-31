# VFX SPECIFICATION: Iria Sol

## Art Direction

Arcane industrial geometry: hard-edged prisms, refracted light shafts, no organic blood. Color communicates **source** (Iria = cyan→violet) so teammates/opponents never rely on color alone—always pair with shape (card / star / bubble).

## Effects List

| Effect Name | Type | Description | Colors | Lifetime |
|-------------|------|-------------|--------|----------|
| `iria_hit_light` | Particle burst | 8–12 thin shard flecks + 1 flash quad | `#E8F7FF` → `#5CE1FF` | 10f |
| `iria_hit_heavy` | Particle + ring | Wider shard burst + horizontal prism ring | `#5CE1FF` → `#A78BFA` | 14f |
| `iria_hit_ability` | Burst | Gate bolt impact crystal crack | `#A78BFA` core | 12f |
| `iria_ranged_trail` | Trail + head | Elongated diamond projectile, soft streak | `#5CE1FF` → `#E8F7FF` | 20f trail / bolt life |
| `iria_ability_1_effect` | Spawn mesh | Card materializes, spins, rune ticks | White plate, violet edge | place 12f + idle loop |
| `iria_gate_idle` | Loop | Slow spin + pulse every 28f countdown | Edge glow intensifies | until fire/break |
| `iria_gate_fire` | Flash | Iris open, bolt emit | Full white flash 2f | 12f |
| `iria_gate_break` | Shatter | 6 glass shards arc out | Cyan shards | 10f |
| `iria_ability_2_effect` | Shield mesh | Hex-prism bubble, one-way faces | `#93C5FD` glass | active 18f |
| `iria_ward_reflect` | Flash | Inverted bolt recolor to Iria palette | Swap to cyan | 8f |
| `iria_ultimate_effect` | Multi-burst | 7-point constellation lines converge | Gold `#F5D76E` + violet | 24f |
| `iria_dash_prism` | Foot dust | Small tetra dust | Dim cyan | 8f |
| `iria_staff_crystal_glow` | Emissive | Meter-driven crystal intensity | Violet at 100 flux | persistent |

## Gate Visual State Machine

```
spawn → idle (countdown pulse) → fire → despawn
                 ↘ break (on hit) → despawn
```

Countdown: emissive pulse period = remaining delay / 4 (readable “cook” without a UI number in greybox).

## Bolt Bend (Gate assist)

When Split Bolt path intersects a live Gate AABB:

1. Trail kink VFX at gate center (1 frame ribbon)
2. New velocity toward opponent centroid
3. One bend only (`bent: true` on projectile state)

## Performance Requirements

| Rule | Value |
|------|-------|
| Max concurrent major emitters / player | 12 |
| Pool all bursts | yes — no runtime `new` in hot path |
| Quality High | full shards + trails + ward mesh |
| Quality Medium | half particles, ward as fresnel sphere |
| Quality Low | hit quads + solid card billboards only |
| Ultimate | single prewarmed system; no extra post beyond game’s global grade |
| Overdraw | ward opacity ≤ 0.35; no full-screen heat haze |

## Integration Hooks (presentation adapter)

Subscribe to CombatCore events only:

| Event | VFX |
|-------|-----|
| `hit` (move light_*) | `iria_hit_light` at defender hurtbox center |
| `hit` (heavy) | `iria_hit_heavy` |
| `projectile_spawned` (bolt) | attach `iria_ranged_trail` |
| `projectile_spawned` (gate bolt) | `iria_gate_fire` then trail |
| `blocked` during ward | `iria_ward_reflect` |
| `attack_started` sevenfold | `iria_ultimate_effect` |
| custom `gate_placed` / `gate_broken` | place / break |

**Never** spawn gameplay-affecting collision from VFX meshes.
