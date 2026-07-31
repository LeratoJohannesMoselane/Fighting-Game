# BALANCE TEST PLAN: Iria Sol

## Goals

- Viable at mid level without requiring tournament execution for basic wins.
- Mastery depth via Gate timing, Ward reads, and Sevenfold confirms.
- No unreactable openers; no infinites; resources exhaustible.

## Damage Output

| Scenario | Expected | Method |
|----------|----------|--------|
| Light 1 → Light 2 (ground) | 84 dmg | Deterministic fixture |
| Light 1 → Light 2 → Gate bolt (if connects) | ~122 | Scripted spacing |
| Optimal BN B without ult | ≤ 286 | Lab route list |
| Sevenfold base confirm | 260 | On valid confirm |
| Sevenfold max (3 charges) | 310 | charges consumed |
| Raw fizzle on block | 0 chip, −12 | Punish window test |
| Staff Sweep raw | 82 / −8 oB | Frame display |
| Split Bolt | 30 | Projectile fixture |
| Mirror Ward reflect | 70% of incoming | vs Nyra gun 28 → 19 |

**Avg TTK (equal skill bot Normal):** ~26–32 s  
**Meter:** ~1 Sevenfold per 25–35 s active combat if zoning succeeds.

## Frame / Reactivity Gates

| Check | Pass condition |
|-------|----------------|
| Fastest attack startup | ≥ 4f (Ward); normals ≥ 5f |
| No full-screen unreactable | Bolt travel ≥ 18f mid-screen |
| Ultimate camera lock | ≤ 18f (≤ 0.3 s @ 60 Hz) |
| Gate delay | 28f telegraphed cook |
| Heavy on block | ≤ −6 … actual −8 (punishable by 5–6f lights) |

## Matchup Tests (100 matches each)

| Matchup | Target P1 win% (Iria) | Notes |
|---------|----------------------|--------|
| vs Nyra Vex | 48–55% | Ward vs gun; Nyra entry pressure |
| vs Bram Kade | 45–52% | Bram wins if he enters free |
| vs Kellan Wisp (when live) | 42–50% | Expected slight lose |
| Mirror Iria | 50% ±3 | Sanity |

**Method:** Hard bot vs Hard bot, seed sweep 1…100, log wins + average HP delta. Flag if outside band for 2 consecutive balance drops.

## Exploit Tests

- [ ] **No infinite:** juggle budget 3 hits; Light 2 float drops after budget  
- [ ] **Sevenfold** blockable on fizzle; valid ult knockdown not untechable loop  
- [ ] **No unreactable** meaty Gate + bolt same frame unblockable (bolt is blockable)  
- [ ] **Prism charges** deplete; cannot place 4th gate  
- [ ] **Ward** does not reflect ultimates  
- [ ] **Ward** broken by melee; not infinite armor  
- [ ] **Heat** blocks ranged at ≥80 until cool  
- [ ] **Corner** Gate + Heavy not 50/50 unreactable mix without gap  
- [ ] **Damage** single confirm + ult < 70% HP from full (310 + prior ≤ ~420 in one go max lab — monitor)

## Difficulty Assessment

| Axis | Rating | Why |
|------|--------|-----|
| Execution | Medium–High | Confirm windows, Gate aim, cancel routes |
| Mental stack | High | Timers, charges, Ward bait |
| Optimal depth | High | Setplay routes, matchup-specific Gate heights |
| Floor (new player) | Medium | Can spam bolt + light; loses to rushdown hard |

## Regression Fixtures (CombatCore)

1. `iria_light_1` hit/block/whiff/active bounds  
2. `iria_light_2` cancel from light_1 only  
3. `iria_heavy` −8 block advantage  
4. `iria_bolt` projectile spawn frame 11  
5. Gate delay 28f then bolt  
6. Ward reflect once  
7. Sevenfold fizzle without confirm  
8. Sevenfold damage scale with charges  
9. 10k-frame determinism seed pack includes Iria vs Nyra  

## Hotfix Policy

Adjust **JSON only** (delay, damage, cooldown, charge interval). Manifest version bump required for online.
