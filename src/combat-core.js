// Aether Break - Professional Deterministic Combat Core (Expanded)
// 4 Characters • Guns • Magic • Ultimates • Best of 3

export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;
export const MAX_HP = 1000;
export const MAX_FLUX = 100;
export const ROUND_TIME = 99 * TICK_RATE;

const FIGHTERS = {
    nyra_vex: { name: "Nyra Vex", color: "#00ffcc", gunDamage: 28, magicDamage: 45 },
    bram_kade: { name: "Bram Kade", color: "#ff3366", gunDamage: 35, magicDamage: 38 },
    iria_sol:  { name: "Iria Sol",  color: "#aaffff", gunDamage: 22, magicDamage: 52 },
    kellan_wisp:{ name: "Kellan Wisp",color: "#ffcc00", gunDamage: 30, magicDamage: 42 }
};

export function createInitialState(mode = "versus") {
    return {
        round: 1,
        maxRounds: 3,
        time: ROUND_TIME,
        p1: createFighter('nyra_vex', -6.5),
        p2: createFighter('bram_kade', 6.5),
        rngSeed: 123456789,
        events: [],
        winner: null,
        mode
    };
}

function createFighter(id, startX) {
    const data = FIGHTERS[id];
    return {
        id,
        name: data.name,
        hp: MAX_HP,
        flux: 0,
        x: startX, y: 0, vx: 0, vy: 0,
        state: 'neutral',
        facing: startX < 0 ? 1 : -1,
        cooldowns: {},
        wins: 0,
        gunHeat: 0,
        lastAction: null
    };
}

function rng(state) {
    state.rngSeed = (state.rngSeed * 16807) % 2147483647;
    return state.rngSeed / 2147483647;
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
    updateProjectiles(s);

    s.time = Math.max(0, s.time - 1);

    // Round end check
    if (s.time <= 0 || s.p1.hp <= 0 || s.p2.hp <= 0) {
        handleRoundEnd(s);
    }

    return s;
}

function applyInput(f, input) {
    const speed = 0.24;

    if (input.left) f.vx = -speed;
    else if (input.right) f.vx = speed;
    else f.vx *= 0.6;

    if (input.jump && f.y === 0) f.vy = 0.78;

    // Light / Heavy
    if (input.light && (f.cooldowns.light || 0) <= 0) {
        f.state = 'light'; f.cooldowns.light = 12; f.lastAction = 'light';
    }
    if (input.heavy && (f.cooldowns.heavy || 0) <= 0) {
        f.state = 'heavy'; f.cooldowns.heavy = 22; f.lastAction = 'heavy';
    }

    // Gun (real projectile)
    if (input.gun && (f.cooldowns.gun || 0) <= 0 && f.gunHeat < 80) {
        f.state = 'shoot';
        f.cooldowns.gun = 18;
        f.gunHeat += 22;
        f.lastAction = 'gun';
    }

    // Magic Ability
    if (input.magic && (f.cooldowns.magic || 0) <= 0) {
        f.state = 'magic';
        f.cooldowns.magic = 45;
        f.lastAction = 'magic';
    }

    // Ultimate
    if (input.ultimate && f.flux >= MAX_FLUX && (f.cooldowns.ultimate || 0) <= 0) {
        f.state = 'ultimate';
        f.flux = 0;
        f.cooldowns.ultimate = 90;
        f.lastAction = 'ultimate';
    }

    if (input.guard) f.state = 'guard';
}

function updatePhysics(f) {
    f.x += f.vx;
    f.y += f.vy;
    f.vy -= 0.037;

    if (f.y < 0) { f.y = 0; f.vy = 0; }

    Object.keys(f.cooldowns).forEach(k => {
        if (f.cooldowns[k] > 0) f.cooldowns[k]--;
    });

    if (f.gunHeat > 0) f.gunHeat = Math.max(0, f.gunHeat - 0.8);

    // Reset state after action
    if (['light','heavy','shoot','magic'].includes(f.state) && f.cooldowns[f.state] <= 6) {
        f.state = 'neutral';
    }
    if (f.state === 'ultimate' && f.cooldowns.ultimate <= 60) f.state = 'neutral';
}

function clampArena(f) {
    if (f.x < -9.5) f.x = -9.5;
    if (f.x > 9.5) f.x = 9.5;
}

function resolveCombat(s) {
    const p1 = s.p1, p2 = s.p2;
    const dist = Math.abs(p1.x - p2.x);

    const data1 = FIGHTERS[p1.id];
    const data2 = FIGHTERS[p2.id];

    // Light attack
    if (p1.state === 'light' && dist < 2.3) {
        p2.hp = Math.max(0, p2.hp - 38);
        p1.flux = Math.min(MAX_FLUX, p1.flux + 9);
    }
    if (p2.state === 'light' && dist < 2.3) {
        p1.hp = Math.max(0, p1.hp - 36);
        p2.flux = Math.min(MAX_FLUX, p2.flux + 9);
    }

    // Heavy attack
    if (p1.state === 'heavy' && dist < 2.0) {
        p2.hp = Math.max(0, p2.hp - 72);
        p1.flux = Math.min(MAX_FLUX, p1.flux + 18);
    }
    if (p2.state === 'heavy' && dist < 2.0) {
        p1.hp = Math.max(0, p1.hp - 68);
        p2.flux = Math.min(MAX_FLUX, p2.flux + 17);
    }

    // Gun damage (close range)
    if (p1.state === 'shoot' && dist < 5.5) {
        p2.hp = Math.max(0, p2.hp - data1.gunDamage);
        p1.flux = Math.min(MAX_FLUX, p1.flux + 6);
    }
    if (p2.state === 'shoot' && dist < 5.5) {
        p1.hp = Math.max(0, p1.hp - data2.gunDamage);
        p2.flux = Math.min(MAX_FLUX, p2.flux + 6);
    }

    // Magic
    if (p1.state === 'magic' && dist < 6) {
        p2.hp = Math.max(0, p2.hp - data1.magicDamage);
        p1.flux = Math.min(MAX_FLUX, p1.flux + 22);
    }
    if (p2.state === 'magic' && dist < 6) {
        p1.hp = Math.max(0, p1.hp - data2.magicDamage);
        p2.flux = Math.min(MAX_FLUX, p2.flux + 21);
    }

    // Ultimates (big damage)
    if (p1.state === 'ultimate') {
        p2.hp = Math.max(0, p2.hp - 320);
        s.events.push({ type: 'ultimate', attacker: p1.id });
    }
    if (p2.state === 'ultimate') {
        p1.hp = Math.max(0, p1.hp - 305);
        s.events.push({ type: 'ultimate', attacker: p2.id });
    }
}

function updateProjectiles(s) {
    // Placeholder for future real projectile system
}

function handleRoundEnd(s) {
    if (s.p1.hp > s.p2.hp) s.p1.wins++;
    else if (s.p2.hp > s.p1.hp) s.p2.wins++;
    else { s.p1.wins++; s.p2.wins++; } // draw = both get point

    if (s.p1.wins >= 2 || s.p2.wins >= 2) {
        s.winner = s.p1.wins > s.p2.wins ? 'p1' : 'p2';
    } else {
        // Next round
        s.round++;
        s.time = ROUND_TIME;
        s.p1.hp = MAX_HP; s.p1.flux = 0; s.p1.gunHeat = 0;
        s.p2.hp = MAX_HP; s.p2.flux = 0; s.p2.gunHeat = 0;
        s.p1.x = -6.5; s.p2.x = 6.5;
    }
}

export function getWinner(state) {
    return state.winner;
}