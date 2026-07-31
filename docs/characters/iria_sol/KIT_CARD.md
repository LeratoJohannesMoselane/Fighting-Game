# CHARACTER KIT CARD: Iria Sol

## Identity

- **Name:** Iria Sol
- **Title:** Prism Magus
- **Fantasy:** A runic staff-wielder who folds light into hard geometry. She seeds the lane with prism cards that detonate on a delay, then confirms from mid-range with staff strikes and refracted bolts. Close-range panic tools exist, but they are cooldowns—not armor.
- **Archetype:** Zoner / Setup
- **Difficulty:** 4/5
- **Visual Identity:**
  - **Palette:** Prism white `#E8F7FF`, arcane cyan `#5CE1FF`, violet core `#A78BFA`, gold rune trim `#F5D76E`, void cloak `#1A1F35`
  - **Silhouette:** Tall slim mage; vertical staff taller than head; wide cloak hem; floating card halo behind shoulders
  - **Tags:** translucent prism plates, geometric VFX, no gore, readable card outlines against dark arenas

## Stats

| Stat | Value | Engine (fp ×1000) | Notes |
|------|-------|-------------------|--------|
| HP | 920 | 920 | Below baseline 1000 — glass-adjacent zoner |
| Walk Speed | 2.45 wu/tick | 245 | Slower than Nyra (286), faster than Bram (220) |
| Dash Speed | 6.2 wu/tick | 620 | Short reposition, not a rushdown dash |
| Jump Height | 7.4 (apex) | jumpVelocity 740 | Slightly lower than Nyra |
| Weight Class | Light | weight 900 | Floatier hitstun carry; weaker anti-juggle |

**Meter:** Flux 0–100 universal. Iria gains **+10%** flux on projectile hits (setup reward), **−15%** on raw melee whiffs (punish greed).

## Unique Resource — Prism Charges

| Field | Value |
|-------|-------|
| Name | `prismCharges` |
| Max | 3 |
| Start of round | 2 |
| Recharge | +1 every 180 ticks (3.0 s) while not in hitstun |
| Spend | Gate place = 1 · Sevenfold Star consumes all remaining (min 1) for damage scaling |

## Moves

### Normals (4)

| Move | Input | Startup | Active | Recovery | Damage | Properties |
|------|-------|---------|--------|----------|--------|------------|
| **Refract Jab** | LIGHT | 5 | 5–7 | 11 | 36 | Chain → Light 2; +on-block if spaced |
| **Facet Hook** | LIGHT (cancel) | 6 | 6–9 | 14 | 48 | Soft float on air hit; cancel → Gate / Ranged |
| **Staff Sweep** | HEAVY | 14 | 14–17 | 22 | 82 | Low-profile hurtbox frame 12–17; knockdown on ground hit; **−8** on block |
| **Crown Poke** | LIGHT (air) | 7 | 7–10 | 12 (land cancel) | 40 | Jump-in; loses to anti-air 5f+ |

### Specials (2)

| Move | Input | Cooldown | Damage | Description |
|------|-------|----------|--------|-------------|
| **Prism Gate** | ABILITY_1 | 45f after place | 38 (bolt) | Spend 1 charge. Place a prism card at forward / up-forward (hold UP). After **28f** delay the gate fires a bolt toward nearest foe facing. Max 2 live gates. **Counterplay:** walk out of line, destroy gate with any hit (gate HP 1), jump the bolt. |
| **Mirror Ward** | ABILITY_2 | 90f | 0 (reflect) | 4f startup, **18f** active ward window. Reflects **one** non-ultimate projectile; reflected shot uses Iria’s facing and 70% damage. On melee hit during ward: 12 chip to Iria, ward breaks. **Counterplay:** empty jump-in, throw (when added), delayed meaty, or bait the flash. |

### Ranged

| Move | Input | Ammo / heat | Damage | Description |
|------|-------|------------|--------|-------------|
| **Split Bolt** | RANGED | Heat +22 / max 100; cool 0.9/tick | 30 | Staff tip fires a mid-speed prism shard. If a **live Gate** is in the bolt’s path, bolt **bends once** toward opponent (Ricochet assist). Recovery 16f. **Counterplay:** jump, block, Gate-less fire is linear and dashable. |

### Ultimate

| Move | Input | Damage | Description |
|------|-------|--------|-------------|
| **Sevenfold Star** | ULTIMATE (100 Flux) | 260–310 | Confirm tool. Startup **8f**, locks camera ≤ **18f** (0.3 s). Requires **either** a hit-confirm from Light/Heavy/Gate bolt in the last **20f**, **or** ≥1 live Gate on field—otherwise fizzles into a long-recovery (32f) flash (80 dmg max chip 0 if blocked). On valid confirm: constellation burst around target, knockdown, consumes remaining prism charges for **+15 dmg each** (cap 310). **Counterplay:** don’t get opened by Gate strings; block the fizzle; punish −12 fizzle recovery. |

## Gameplay Loop

**Neutral:** Walk mid-range, drop Gate at preferred spacing, threaten Split Bolt and Refract Jab. Force respect with Gate delay timers.

**Advantage:** After a Gate hit or Light 2 float, cancel into second Gate or Sevenfold if meter is full. Convert spaced Heavy knockdown into okizeme Gate.

**Disadvantage:** No armor. Mirror Ward is the only “get off me,” and it’s a read. Prefer backdash + Gate as you reset. Avoid panic Heavy (−8).

**Ultimate setup:** Tag a Gate bolt or Light 2, then Sevenfold for round-swing damage. Don’t raw-super midscreen without Gate or confirm—fizzle is free punish for Bram.

## Counterplay

- **Strengths:** Screen control, delayed threat, strong anti-projectile (Ward), high reward confirms, excellent round-steal with charged Sevenfold.
- **Weaknesses:** Low HP, weak abare, slow Heavy, dash is short, loses locked-down pressure to rushdown, Gates are destroyable.
- **Bad matchup — Kellan Wisp / rushdown:** Constant gaps closed; Ward baited; Gates never cook.
- **Good matchup — Nyra Vex:** Can Ward her gun and out-stack mid-range geometry; Nyra must risk entry.
- **Even — Bram Kade:** Bram’s armor tools crush Gates if he enters; Iria wins if she keeps him out.

## Animation Requirements

1. `idle_iria` — breath + slow card orbit  
2. `walk_iria` — gliding step, staff vertical  
3. `dash_iria` — short prism streak  
4. `jump_iria` / `land_iria`  
5. `crouch_iria` / `block_iria` / `block_air_iria`  
6. `hitstun_iria` / `launch_iria` / `knockdown_iria` / `wakeup_iria`  
7. `light_1_iria` / `light_2_iria` / `heavy_iria` / `air_light_iria`  
8. `ranged_iria` — staff thrust + bolt spawn  
9. `ability_1_iria` — card throw / plant  
10. `ability_2_iria` — ward open / shatter  
11. `ultimate_iria` — constellation pose  
12. `win_iria` / `lose_iria` / `taunt_iria`  
13. Prop anim: `gate_idle`, `gate_fire`, `gate_break`

## VFX Requirements

1. Hit sparks (light / heavy) — cyan-white shards  
2. Split Bolt projectile + trail  
3. Gate place / idle spin / fire / break  
4. Bolt bend ribbon (Gate assist)  
5. Mirror Ward bubble + reflect flash  
6. Sevenfold Star constellation burst  
7. Foot prism dust (dash)  
8. Charge full / meter glow on staff crystal  

## Audio Requirements

**Voice:** select, round start ×2, light effort ×3, heavy effort, gate place, ward, ultimate callout, win, lose, low-HP breath.  
**SFX:** staff whoosh, card flick, gate hum loop, bolt fire, glass-reflect, constellation chime, block crystal clack.

## Performance Budget

| Asset | Budget |
|-------|--------|
| Triangles LOD0 | 28k (staff + cards instanced) |
| LOD1 / LOD2 | 14k / 6k |
| Textures | 2×2K (body/cloak KTX2) + 1×1K (staff/cards atlas) |
| Unique anim clips | 18 fighter + 3 gate prop |
| VFX | ≤8 named systems; ≤12 concurrent emitters/player |
| Draw | Cards use shared atlas; no per-card unique materials |

## Roster Fit (SRS §2.4)

Matches launch fantasy: **Prism Magus**, Ability1 Gate, Ability2 Ward, Ultimate Sevenfold Star, fragile close range, cooldown-led defense.
