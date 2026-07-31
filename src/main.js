import { 
    Engine, Scene, ArcRotateCamera, HemisphericLight, DirectionalLight,
    Vector3, Color3, StandardMaterial, MeshBuilder, ShadowGenerator
} from 'babylonjs';
import "babylonjs-loaders";
import * as CombatCore from './combat-core.js';
import { CharacterController } from './character-controller.js';

const canvas = document.getElementById('renderCanvas');
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
const scene = new Scene(engine);

// Professional 2.5D Camera
const camera = new ArcRotateCamera("cam", Math.PI / 2, 1.05, 19, Vector3.Zero(), scene);
camera.lowerBetaLimit = 0.85; camera.upperBetaLimit = 1.25;
camera.lowerRadiusLimit = 15; camera.upperRadiusLimit = 24;
camera.attachControl(canvas, true);

// Lighting
const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
hemi.intensity = 0.65; hemi.diffuse = new Color3(0.85, 0.9, 1);
const dir = new DirectionalLight("dir", new Vector3(-0.6, -1, -0.4), scene);
dir.intensity = 1.1; dir.shadowEnabled = true;

// Arena
const ground = MeshBuilder.CreateGround("ground", { width: 26, height: 16 }, scene);
ground.material = new StandardMaterial("groundMat", scene);
ground.material.diffuseColor = new Color3(0.12, 0.06, 0.22);

const platform = MeshBuilder.CreateBox("platform", { width: 20, height: 1.2, depth: 7 }, scene);
platform.position.y = 0.6;
platform.material = new StandardMaterial("platMat", scene);
platform.material.diffuseColor = new Color3(0.18, 0.08, 0.32);

// Fallback fighter
function createFallbackFighter(name, color) {
    const group = new MeshBuilder.CreateBox(name + "_root", { size: 0.1 }, scene);
    group.isVisible = false;
    const body = MeshBuilder.CreateCapsule(name + "_body", { radius: 0.75, height: 2.6, subdivisions: 8 }, scene);
    const mat = new StandardMaterial(name + "_mat", scene);
    mat.diffuseColor = color; mat.emissiveColor = color.scale(0.25);
    body.material = mat; body.parent = group;
    const head = MeshBuilder.CreateSphere(name + "_head", { diameter: 1.15 }, scene);
    head.position.y = 1.85; head.material = mat; head.parent = group;
    return group;
}

let p1Controller, p2Controller;

async function createFighters() {
    const p1Model = await CharacterController.loadFromGLTF(scene, "/assets/nyra.glb", "nyra");
    const p2Model = await CharacterController.loadFromGLTF(scene, "/assets/bram.glb", "bram");

    if (p1Model) { p1Controller = p1Model; p1Controller.root.position.x = -5.5; }
    else {
        const mesh = createFallbackFighter("nyra", new Color3(0, 0.95, 0.85));
        mesh.position.x = -5.5;
        p1Controller = { root: mesh, setPosition: (x,y)=>{mesh.position.x=x;mesh.position.y=y;}, updateState:()=>{} };
    }

    if (p2Model) { p2Controller = p2Model; p2Controller.root.position.x = 5.5; }
    else {
        const mesh = createFallbackFighter("bram", new Color3(0.95, 0.2, 0.45));
        mesh.position.x = 5.5;
        p2Controller = { root: mesh, setPosition: (x,y)=>{mesh.position.x=x;mesh.position.y=y;}, updateState:()=>{} };
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

function getInput(player) {
    if (player === 1) return {
        left: keys['a'], right: keys['d'], jump: keys['w'],
        attack: keys['j']||keys['k'], guard: keys['shift'], ultimate: keys['o']
    };
    return {
        left: keys['arrowleft'], right: keys['arrowright'], jump: keys['arrowup'],
        attack: keys['1']||keys['2'], guard: keys['.'], ultimate: keys['6']
    };
}

function updateVisuals() {
    if (p1Controller?.setPosition) {
        p1Controller.setPosition(combatState.p1.x * 1.7, combatState.p1.y * 1.6);
        p1Controller.updateState?.(combatState.p1.state, combatState.p1.facing);
    }
    if (p2Controller?.setPosition) {
        p2Controller.setPosition(combatState.p2.x * 1.7, combatState.p2.y * 1.6);
        p2Controller.updateState?.(combatState.p2.state, combatState.p2.facing);
    }
    p1Fill.style.width = `${(combatState.p1.hp / CombatCore.MAX_HP) * 100}%`;
    p2Fill.style.width = `${(combatState.p2.hp / CombatCore.MAX_HP) * 100}%`;
}

function gameLoop() {
    if (!gameRunning) return;
    const now = performance.now();
    while (now - lastTick >= CombatCore.TICK_MS) {
        const inputs = { p1: getInput(1), p2: getInput(2) };
        combatState = CombatCore.step(combatState, inputs);
        lastTick += CombatCore.TICK_MS;
        const winner = CombatCore.getWinner(combatState);
        if (winner) { endGame(winner); return; }
    }
    updateVisuals();
    requestAnimationFrame(gameLoop);
}

function endGame(winner) {
    gameRunning = false;
    statusEl.style.display = 'block';
    statusEl.innerHTML = winner === 'p1' ? 'NYRA VEX WINS!' : 'BRAM KADE WINS!';
    statusEl.style.color = winner === 'p1' ? '#00ffcc' : '#ff3366';
    setTimeout(() => { statusEl.innerHTML += '<br><span style="font-size:15px">PRESS R TO RESTART</span>'; }, 900);
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