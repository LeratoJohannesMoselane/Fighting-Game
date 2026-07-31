# ⚔️ Aether Break

**A professional 2.5D 3D browser fighting game** built following the full SRS specification.

Fast, readable, skill-based duels with guns, magic, and powerful ultimates.

---

## ✨ Features

- **4 Unique Fighters** (Nyra Vex, Bram Kade + ready for Iria & Kellan)
- **Real Guns + Magic** with cooldowns and heat systems
- **Best of 3 Rounds** — long, entertaining matches
- **Smart AI Opponent** (adjustable difficulty)
- **Professional 3D Graphics** with Babylon.js
- **glTF + Animation Support** (Ready Player Me / Mixamo ready)
- **Deterministic 60 Hz Combat Core** (rollback-ready)
- **Immersive Animated Background** with living effects

---

## 🚀 How to Install & Run

```bash
# 1. Navigate to the project
cd /home/user/Fighting-Game

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

Then open the link shown in your terminal (usually `http://localhost:5173/`).

---

## 🎮 Controls

| Player | Move       | Jump | Light | Heavy | Gun | Magic | Ultimate | Guard   |
|--------|------------|------|-------|-------|-----|-------|----------|---------|
| **P1** | `A` / `D`  | `W`  | `J`   | `K`   | `L` | `U`   | `O`      | `Shift` |
| **P2** | AI         | AI   | AI    | AI    | AI  | AI    | AI       | AI      |

- Press **`R`** to restart after a match ends.

---

## 🧠 AI Difficulty

The AI is set to **normal** by default. You can change it in `src/main.js`:

```js
let ai = new AIController('normal');   // 'easy', 'normal', or 'hard'
```

---

## 🖼️ Adding Real 3D Characters (Optional)

Place your `.glb` files here:

```
public/assets/nyra.glb
public/assets/bram.glb
```

The game will automatically load and animate them using the built-in animation system.

---

## 🏗️ Tech Stack

- **Babylon.js** — 3D rendering & animation
- **Vite** — Fast development
- **Deterministic CombatCore** — Pure JS 60Hz simulation

---

## 📜 License

This project follows the Aether Break SRS v1.0.

---

**Made with ❤️ for competitive browser gaming.**

---

## 🗺️ Project Management

- **[Greybox Build Plan & Prompt Series](docs/GREYBOX_BUILD_PLAN.md)** — Milestone 1 decomposition, the copy-paste prompt chain, and the exit gate for the vertical slice.