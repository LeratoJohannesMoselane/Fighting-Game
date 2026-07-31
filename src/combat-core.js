// packages/combat-core — Deterministic 60 Hz Combat Core (SRS compliant)
export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;
export const MAX_HP = 1000;
export const MAX_FLUX = 100;

export function createInitialState() {
    return {
        time: 90 * TICK_RATE,
        p1: createFighter('nyra_vex', -5.5),
        p2: createFighter('bram_kade', 5.5),
        rngSeed: 987654321,
        events: []
    };
}

function createFighter(id, startX) {
    return {
        id, hp: MAX_HP, flux: 0,
        x: startX, y: 0, vx: 0, vy: 0,
        state: 'neutral', facing: startX < 0 ? 1 : -1,
        cooldowns: {}, lastHitFrame: 0
    };
}

export function step(state, inputs) {
    const s = JSON.parse(JSON.stringify(state));
    applyInput(s.p1, inputs.p1 || {});
    applyInput(s.p2, inputs.p2 || {});
    updatePhysics(s.p1);
    updatePhysics(s.p2);
    clampArena(s.p1);
    clampArena(s.p2);
    resolveCombat(s);
    s.time = Math.max(0, s.time - 1);
    return s;
}

function applyInput(f, input) {
    const speed = 0.22;
    if (input.left) f.vx = -speed;
    else if (input.right) f.vx = speed;
    else f.vx *= 0.65;
    if (input.jump && f.y === 0) f.vy = 0.72;
    if (input.attack && (f.cooldowns.attack || 0) <= 0) {
        f.state = 'attack'; f.cooldowns.attack = 16;
    }
    if (input.guard) f.state = 'guard';
    if (input.ultimate && f.flux >= MAX_FLUX && (f.cooldowns.ultimate || 0) <= 0) {
        f.state = 'ultimate'; f.flux = 0; f.cooldowns.ultimate = 90;
    }
}

function updatePhysics(f) {
    f.x += f.vx; f.y += f.vy; f.vy -= 0.038;
    if (f.y < 0) { f.y = 0; f.vy = 0; }
    Object.keys(f.cooldowns).forEach(k => { if (f.cooldowns[k] > 0) f.cooldowns[k]--; });
    if (f.state === 'attack' && f.cooldowns.attack <= 10) f.state = 'neutral';
    if (f.state === 'ultimate' && f.cooldowns.ultimate <= 70) f.state = 'neutral';
}

function clampArena(f) {
    if (f.x < -9) f.x = -9; if (f.x > 9) f.x = 9;
}

function resolveCombat(s) {
    const p1 = s.p1, p2 = s.p2;
    const dist = Math.abs(p1.x - p2.x);
    if (p1.state === 'attack' && dist < 2.1) {
        p2.hp = Math.max(0, p2.hp - 52); p1.flux = Math.min(MAX_FLUX, p1.flux + 14);
        s.events.push({ type: 'hit', attacker: p1.id });
    }
    if (p2.state === 'attack' && dist < 2.1) {
        p1.hp = Math.max(0, p1.hp - 48); p2.flux = Math.min(MAX_FLUX, p2.flux + 13);
        s.events.push({ type: 'hit', attacker: p2.id });
    }
    if (p1.state === 'ultimate') { p2.hp = Math.max(0, p2.hp - 310); s.events.push({ type: 'ultimate', attacker: p1.id }); }
    if (p2.state === 'ultimate') { p1.hp = Math.max(0, p1.hp - 295); s.events.push({ type: 'ultimate', attacker: p2.id }); }
}

export function getWinner(state) {
    if (state.p1.hp <= 0) return 'p2';
    if (state.p2.hp <= 0) return 'p1';
    return null;
}