import { 
    Engine, Scene, ArcRotateCamera, HemisphericLight, DirectionalLight,
    Vector3, Color3, StandardMaterial, MeshBuilder, ShadowGenerator, ParticleSystem
} from 'babylonjs';
import "babylonjs-loaders";
import * as CombatCore from './combat-core.js';
import { CharacterController } from './character-controller.js';
import { AIController } from './ai-controller.js';

const canvas = document.getElementById('renderCanvas');
const engine = new Engine(canvas, true);
const scene = new Scene(engine);

// Camera
const camera = new ArcRotateCamera("cam", Math.PI / 2, 1.08, 20, Vector3.Zero(), scene);
camera.lowerBetaLimit = 0.9; camera.upperBetaLimit = 1.35;
camera.lowerRadiusLimit = 16; camera.upperRadiusLimit = 26;
camera.attachControl(canvas, true);

// Lights
const hemi = new HemisphericLight("hemi", new Vector3(0,1,0), scene);
hemi.intensity = 0.6;
const dir = new DirectionalLight("dir", new Vector3(-0.5,-1,-0.35), scene);
dir.intensity = 1.15; dir.shadowEnabled = true;

// Arena
const ground = MeshBuilder.CreateGround("ground", { width: 28, height: 17 }, scene);
ground.material = new StandardMaterial("groundMat", scene);
ground.material.diffuseColor = new Color3(0.1, 0.05, 0.2);

const platform = MeshBuilder.CreateBox("platform", { width: 21, height: 1.3, depth: 7.5 }, scene);
platform.position.y = 0.65;
platform.material = new StandardMaterial("platMat", scene);
platform.material.diffuseColor = new Color3(0.15, 0.07, 0.28);

// === LIVING ANIMATED BACKGROUND ===
function createLivingBackground() {
    // Floating Ether Crystals (animated)
    for (let i = 0; i < 6; i++) {
        const crystal = MeshBuilder.CreateCylinder(`crystal_${i}`, {
            height: 2.8, diameterTop: 0.35, diameterBottom: 0.55, tessellation: 6
        }, scene);
        
        const mat = new StandardMaterial(`crystalMat_${i}`, scene);
        mat.diffuseColor = new Color3(0, 0.9, 0.7);
        mat.emissiveColor = new Color3(0, 0.6, 0.5);
        crystal.material = mat;
        
        crystal.position.x = -10 + (i * 4);
        crystal.position.y = 3.5 + Math.sin(i) * 1.5;
        crystal.position.z = -4 + (i % 2) * 1.5;
        
        // Gentle floating animation
        scene.registerBeforeRender(() => {
            crystal.position.y = 3.5 + Math.sin(Date.now() / 800 + i) * 1.2;
            crystal.rotation.y = Date.now() / 1200 + i;
        });
    }

    // Pulsing Energy Orbs
    for (let i = 0; i < 4; i++) {
        const orb = MeshBuilder.CreateSphere(`orb_${i}`, { diameter: 1.1 }, scene);
        const mat = new StandardMaterial(`orbMat_${i}`, scene);
        mat.diffuseColor = new Color3(0.3, 0.9, 1);
        mat.emissiveColor = new Color3(0.2, 0.7, 1);
        orb.material = mat;
        
        orb.position.x = -8 + i * 5.5;
        orb.position.y = 7.5;
        orb.position.z = 6;
        
        scene.registerBeforeRender(() => {
            const scale = 0.9 + Math.sin(Date.now() / 600 + i * 2) * 0.25;
            orb.scaling = new Vector3(scale, scale, scale);
        });
    }

    // Background Light Beams (moving)
    const beamMat = new StandardMaterial("beamMat", scene);
    beamMat.diffuseColor = new Color3(0.4, 0.6, 1);
    beamMat.emissiveColor = new Color3(0.2, 0.4, 0.9);
    beamMat.alpha = 0.25;

    for (let i = 0; i < 3; i++) {
        const beam = MeshBuilder.CreateCylinder(`beam_${i}`, {
            height: 18, diameter: 0.8, tessellation: 12
        }, scene);
        beam.material = beamMat;
        beam.position.x = -7 + i * 7;
        beam.position.y = 9;
        beam.rotation.z = 0.6;

        scene.registerBeforeRender(() => {
            beam.rotation.z = 0.6 + Math.sin(Date.now() / 1800 + i) * 0.15;
        });
    }
}

createLivingBackground();

// Fallback fighter
function createFallbackFighter(name, color) {
    const group = new MeshBuilder.CreateBox(name+"_root", {size:0.1}, scene);
    group.isVisible = false;
    const body = MeshBuilder.CreateCapsule(name+"_body", {radius:0.78, height:2.7}, scene);
    const mat = new StandardMaterial(name+"_mat", scene);
    mat.diffuseColor = color; mat.emissiveColor = color.scale(0.3);
    body.material = mat; body.parent = group;
    const head = MeshBuilder.CreateSphere(name+"_head", {diameter:1.2}, scene);
    head.position.y = 1.9; head.material = mat; head.parent = group;
    return group;
}

let p1Controller, p2Controller;
let ai = new AIController('normal');

async function createFighters() {
    const p1Model = await CharacterController.loadFromGLTF(scene, "/assets/nyra.glb", "nyra");
    const p2Model = await CharacterController.loadFromGLTF(scene, "/assets/bram.glb", "bram");

    if (p1Model) { p1Controller = p1Model; p1Controller.root.position.x = -6.5; }
    else {
        const m = createFallbackFighter("nyra", new Color3(0,0.95,0.85));
        m.position.x = -6.5;
        p1Controller = { root: m, setPosition:(x,y)=>{m.position.x=x;m.position.y=y;}, updateState:()=>{} };
    }

    if (p2Model) { p2Controller = p2Model; p2Controller.root.position.x = 6.5; }
    else {
        const m = createFallbackFighter("bram", new Color3(0.95,0.2,0.45));
        m.position.x = 6.5;
        p2Controller = { root: m, setPosition:(x,y)=>{m.position.x=x;m.position.y=y;}, updateState:()=>{} };
    }
}

const shadowGen = new ShadowGenerator(2048, dir);
ground.receiveShadows = true;

let keys = {};
window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

let combatState = CombatCore.createInitialState();
let lastTick = performance.now();
let gameRunning = true;

const p1Fill = document.getElementById('p1-health-fill');
const p2Fill = document.getElementById('p2-health-fill');
const statusEl = document.getElementById('status');
const roundEl = document.getElementById('round-info');

function getInput(player) {
    if (player === 1) return {
        left: keys['a'], right: keys['d'], jump: keys['w'],
        light: keys['j'], heavy: keys['k'],
        gun: keys['l'], magic: keys['u'], ultimate: keys['o'],
        guard: keys['shift']
    };
    return {
        left: keys['arrowleft'], right: keys['arrowright'], jump: keys['arrowup'],
        light: keys['1'], heavy: keys['2'],
        gun: keys['3'], magic: keys['4'], ultimate: keys['6'],
        guard: keys['.']
    };
}

function updateVisuals() {
    if (p1Controller?.setPosition) {
        p1Controller.setPosition(combatState.p1.x * 1.65, combatState.p1.y * 1.55);
        p1Controller.updateState?.(combatState.p1.state, combatState.p1.facing);
    }
    if (p2Controller?.setPosition) {
        p2Controller.setPosition(combatState.p2.x * 1.65, combatState.p2.y * 1.55);
        p2Controller.updateState?.(combatState.p2.state, combatState.p2.facing);
    }

    p1Fill.style.width = `${(combatState.p1.hp / CombatCore.MAX_HP) * 100}%`;
    p2Fill.style.width = `${(combatState.p2.hp / CombatCore.MAX_HP) * 100}%`;
    
    if (roundEl) roundEl.innerText = `ROUND ${combatState.round} / ${combatState.maxRounds}`;
}

function gameLoop() {
    if (!gameRunning) return;

    const now = performance.now();
    while (now - lastTick >= CombatCore.TICK_MS) {
        const p1Input = getInput(1);
        const p2Input = getInput(2);

        // AI for player 2
        const aiInput = ai.getInput(combatState, combatState.p2, combatState.p1);
        Object.assign(p2Input, aiInput);

        combatState = CombatCore.step(combatState, { p1: p1Input, p2: p2Input });
        lastTick += CombatCore.TICK_MS;

        if (combatState.winner) {
            endGame(combatState.winner);
            return;
        }
    }

    updateVisuals();
    requestAnimationFrame(gameLoop);
}

function endGame(winner) {
    gameRunning = false;
    statusEl.style.display = 'block';
    const name = winner === 'p1' ? combatState.p1.name : combatState.p2.name;
    statusEl.innerHTML = `${name.toUpperCase()} WINS THE MATCH!`;
    statusEl.style.color = winner === 'p1' ? '#00ffcc' : '#ff3366';
    
    setTimeout(() => {
        statusEl.innerHTML += '<br><span style="font-size:14px">PRESS R TO RESTART</span>';
    }, 1200);
}

window.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'r' && !gameRunning) location.reload();
});

async function start() {
    await createFighters();
    if (p1Controller?.root) shadowGen.addShadowCaster(p1Controller.root);
    if (p2Controller?.root) shadowGen.addShadowCaster(p2Controller.root);

    engine.runRenderLoop(() => scene.render());
    window.addEventListener('resize', () => engine.resize());
    gameLoop();
}

start();