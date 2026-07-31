// Professional AI Controller for Aether Break
// Difficulty levels: easy, normal, hard

export class AIController {
    constructor(difficulty = 'normal') {
        this.difficulty = difficulty;
        this.reactionDelay = difficulty === 'easy' ? 18 : difficulty === 'normal' ? 9 : 4;
        this.errorRate = difficulty === 'easy' ? 0.35 : difficulty === 'normal' ? 0.12 : 0.04;
        this.lastDecisionFrame = 0;
    }

    getInput(state, myPlayer, opponent) {
        const input = {};
        const dist = Math.abs(myPlayer.x - opponent.x);
        const myFacing = myPlayer.facing;

        // Basic movement
        if (dist > 3.5) {
            input.right = myFacing > 0;
            input.left = myFacing < 0;
        } else if (dist < 1.8) {
            input.left = myFacing > 0;
            input.right = myFacing < 0;
        }

        // Random jump
        if (Math.random() < 0.08) input.jump = true;

        // Attack decisions
        const frame = state.time;
        if (frame - this.lastDecisionFrame > this.reactionDelay) {
            this.lastDecisionFrame = frame;

            if (dist < 2.2 && Math.random() > this.errorRate) {
                input.heavy = true;
            } else if (dist < 5.5 && Math.random() > this.errorRate * 1.5) {
                input.gun = true;
            } else if (dist < 6.5 && Math.random() > this.errorRate * 2) {
                input.magic = true;
            }

            // Ultimate when possible
            if (myPlayer.flux > 85 && Math.random() > 0.6) {
                input.ultimate = true;
            }
        }

        // Guard when under pressure
        if (opponent.state === 'heavy' && dist < 3) {
            input.guard = true;
        }

        return input;
    }
}