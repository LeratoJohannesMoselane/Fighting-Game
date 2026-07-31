const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: true });

// Game constants
const GRAVITY = 0.75;
const GROUND_Y = 380;
const WIDTH = canvas.width;
const HEIGHT = canvas.height;

// Players
let p1 = {
    x: 180, y: GROUND_Y, w: 64, h: 96,
    vx: 0, vy: 0,
    health: 100, facing: 1,
    attacking: false, attackTimer: 0,
    specialTimer: 0, jumping: false,
    color: '#00ffcc', name: 'AETHER'
};

let p2 = {
    x: 720, y: GROUND_Y, w: 64, h: 96,
    vx: 0, vy: 0,
    health: 100, facing: -1,
    attacking: false, attackTimer: 0,
    specialTimer: 0, jumping: false,
    color: '#ff00aa', name: 'NEXUS'
};

let particles = [];
let gameOver = false;
let winner = '';
let keys = {};

// Input
window.addEventListener('keydown', e => {
    keys[e.key] = true;
    
    if (!gameOver) {
        if (e.key === ' ' && p1.attackTimer <= 0) attack(p1, p2);
        if (e.key.toLowerCase() === 'q' && p1.specialTimer <= 0) specialAttack(p1, p2);
        if (e.key === 'Enter' && p2.attackTimer <= 0) attack(p2, p1);
        if (e.key === 'Shift' && p2.specialTimer <= 0) specialAttack(p2, p1);
    }
    
    if (e.key.toLowerCase() === 'r' && gameOver) restart();
});

window.addEventListener('keyup', e => keys[e.key] = false);

function attack(attacker, defender) {
    attacker.attacking = true;
    attacker.attackTimer = 18;
    
    const hitRange = 85;
    const hitX = attacker.x + (attacker.facing * 50);
    
    if (Math.abs(defender.x - hitX) < hitRange && 
        Math.abs(defender.y - attacker.y) < 70) {
        defender.health -= 18;
        createHitParticles(defender.x + 32, defender.y + 40);
    }
    
    setTimeout(() => attacker.attacking = false, 200);
}

function specialAttack(attacker, defender) {
    attacker.specialTimer = 60;
    attacker.attacking = true;
    
    const hitRange = 140;
    const hitX = attacker.x + (attacker.facing * 70);
    
    if (Math.abs(defender.x - hitX) < hitRange && 
        Math.abs(defender.y - attacker.y) < 80) {
        defender.health -= 32;
        createHitParticles(defender.x + 32, defender.y + 30, 18);
    }
    
    // Ether burst particles
    for (let i = 0; i < 25; i++) {
        particles.push({
            x: attacker.x + 32,
            y: attacker.y + 45,
            vx: (Math.random() - 0.5) * 9 + attacker.facing * 4,
            vy: (Math.random() - 0.5) * 7,
            life: 35,
            color: attacker.color
        });
    }
    
    setTimeout(() => attacker.attacking = false, 280);
}

function createHitParticles(x, y, count = 12) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8 - 1,
            life: 22,
            color: '#ffff00'
        });
    }
}

function updatePlayer(player, left, right, up, down) {
    // Horizontal movement
    player.vx = 0;
    if (keys[left]) player.vx = -5.5;
    if (keys[right]) player.vx = 5.5;
    
    // Jump
    if (keys[up] && !player.jumping) {
        player.vy = -16;
        player.jumping = true;
    }
    
    // Apply physics
    player.vy += GRAVITY;
    player.x += player.vx;
    player.y += player.vy;
    
    // Ground
    if (player.y >= GROUND_Y) {
        player.y = GROUND_Y;
        player.vy = 0;
        player.jumping = false;
    }
    
    // Boundaries
    if (player.x < 30) player.x = 30;
    if (player.x > WIDTH - player.w - 30) player.x = WIDTH - player.w - 30;
    
    // Face direction
    if (player.vx > 0) player.facing = 1;
    if (player.vx < 0) player.facing = -1;
    
    // Timers
    if (player.attackTimer > 0) player.attackTimer--;
    if (player.specialTimer > 0) player.specialTimer--;
}

// Update particles
function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.life--;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function drawPixelCharacter(player) {
    const px = Math.floor(player.x);
    const py = Math.floor(player.y);
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(px + 8, GROUND_Y + 90, 48, 10);
    
    // Body (torso)
    ctx.fillStyle = player.color;
    ctx.fillRect(px + 18, py + 38, 28, 42);
    
    // Head
    ctx.fillStyle = '#f4d9b8';
    ctx.fillRect(px + 20, py + 12, 24, 26);
    
    // Eyes
    ctx.fillStyle = '#111';
    ctx.fillRect(px + (player.facing > 0 ? 28 : 22), py + 18, 6, 6);
    
    // Legs
    ctx.fillStyle = '#222';
    ctx.fillRect(px + 20, py + 78, 10, 18);
    ctx.fillRect(px + 34, py + 78, 10, 18);
    
    // Arms
    ctx.fillStyle = player.color;
    ctx.fillRect(px + (player.facing > 0 ? 46 : 10), py + 42, 14, 22);
    ctx.fillRect(px + (player.facing > 0 ? 4 : 40), py + 42, 14, 22);
    
    // Attack effect
    if (player.attacking) {
        ctx.strokeStyle = player.specialTimer > 0 ? '#aaffff' : '#ffff00';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.rect(
            px + (player.facing * 55) - 15, 
            py + 35, 
            70, 
            35
        );
        ctx.stroke();
    }
    
    // Health bar
    ctx.fillStyle = '#222';
    ctx.fillRect(px - 4, py - 22, 72, 14);
    const hp = Math.max(0, player.health);
    ctx.fillStyle = hp > 50 ? '#00ff88' : hp > 25 ? '#ffcc00' : '#ff3366';
    ctx.fillRect(px - 4, py - 22, 72 * (hp / 100), 14);
    
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(px - 4, py - 22, 72, 14);
    
    // Name
    ctx.fillStyle = '#fff';
    ctx.font = '11px "Press Start 2P"';
    ctx.fillText(player.name, px + 8, py - 32);
}

function drawArena() {
    // Background
    ctx.fillStyle = '#0a0022';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    // Distant mountains
    ctx.fillStyle = '#1a0044';
    ctx.beginPath();
    ctx.moveTo(0, 280);
    ctx.lineTo(180, 120);
    ctx.lineTo(380, 280);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(300, 280);
    ctx.lineTo(520, 90);
    ctx.lineTo(700, 280);
    ctx.fill();
    
    // Arena platform
    ctx.fillStyle = '#220055';
    ctx.fillRect(0, GROUND_Y + 90, WIDTH, 200);
    
    // Platform details
    ctx.strokeStyle = '#4400aa';
    ctx.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
        ctx.strokeRect(i * 82, GROUND_Y + 95, 76, 28);
    }
    
    // Ether crystals
    ctx.fillStyle = '#00ffcc';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#00ffcc';
    ctx.fillRect(90, 160, 14, 38);
    ctx.fillRect(860, 160, 14, 38);
    ctx.shadowBlur = 0;
    
    // Title bar
    ctx.fillStyle = '#110033';
    ctx.fillRect(0, 0, WIDTH, 55);
    ctx.fillStyle = '#00ffcc';
    ctx.font = 'bold 26px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText('ETHER ARENA', WIDTH / 2, 38);
}

function draw() {
    drawArena();
    
    drawPixelCharacter(p1);
    drawPixelCharacter(p2);
    
    // Particles
    ctx.shadowBlur = 8;
    for (const p of particles) {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 4, 4);
    }
    ctx.shadowBlur = 0;
    
    // Game over overlay
    if (gameOver) {
        ctx.fillStyle = 'rgba(10, 0, 30, 0.85)';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        
        ctx.fillStyle = '#00ffcc';
        ctx.font = 'bold 52px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', WIDTH / 2, 220);
        
        ctx.font = 'bold 36px "Press Start 2P"';
        ctx.fillText(`${winner} WINS!`, WIDTH / 2, 280);
        
        ctx.font = '18px "Press Start 2P"';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('PRESS R TO RESTART', WIDTH / 2, 350);
    }
}

function update() {
    if (gameOver) return;
    
    updatePlayer(p1, 'a', 'd', 'w');
    updatePlayer(p2, 'ArrowLeft', 'ArrowRight', 'ArrowUp');
    
    updateParticles();
    
    // Win condition
    if (p1.health <= 0) {
        gameOver = true;
        winner = p2.name;
    }
    if (p2.health <= 0) {
        gameOver = true;
        winner = p1.name;
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

function restart() {
    p1.x = 180; p1.y = GROUND_Y; p1.health = 100; p1.vy = 0; p1.jumping = false;
    p2.x = 720; p2.y = GROUND_Y; p2.health = 100; p2.vy = 0; p2.jumping = false;
    particles = [];
    gameOver = false;
    winner = '';
}

gameLoop();