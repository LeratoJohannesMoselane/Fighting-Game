// Professional Character Controller with glTF + Animation support
// Ready for Ready Player Me / Mixamo glTF models

import { SceneLoader, AnimationGroup, Vector3 } from 'babylonjs';

export class CharacterController {
    constructor(scene, rootMesh, animationGroups = []) {
        this.scene = scene;
        this.root = rootMesh;
        this.animations = animationGroups;
        this.currentAnim = null;
    }

    static async loadFromGLTF(scene, url, name = "fighter") {
        try {
            const result = await SceneLoader.ImportMeshAsync("", url, "", scene);
            const root = result.meshes[0];
            root.name = name + "_root";
            root.scaling = new Vector3(1.15, 1.15, 1.15);
            root.position.y = 0;

            const animGroups = result.animationGroups || [];
            return new CharacterController(scene, root, animGroups);
        } catch (err) {
            console.warn(`[CharacterController] Failed to load ${url}. Using procedural fallback.`, err);
            return null;
        }
    }

    playAnimation(name, loop = true, speed = 1.0) {
        if (!this.animations.length) return;
        if (this.currentAnim) this.currentAnim.stop();

        const anim = this.animations.find(a => 
            a.name.toLowerCase().includes(name.toLowerCase())
        );

        if (anim) {
            anim.play(loop);
            anim.speedRatio = speed;
            this.currentAnim = anim;
        }
    }

    updateState(state, facing) {
        if (!this.animations.length) return;

        let animName = 'idle';
        let speed = 1.0;

        switch (state) {
            case 'attack': animName = 'punch'; speed = 1.4; break;
            case 'ultimate': animName = 'punch'; speed = 0.8; break;
            default:
                if (Math.abs(this.root.position.x) > 0.1) animName = 'walk';
        }

        this.playAnimation(animName, true, speed);
        this.root.scaling.x = facing;
    }

    setPosition(x, y) {
        if (this.root) {
            this.root.position.x = x;
            this.root.position.y = y;
        }
    }
}