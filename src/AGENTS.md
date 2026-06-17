# Agentic Coding Playbook & Guidelines

This document serves as the guide and instruction set for AI coding agents (and human developers) collaborating on the **8-Bit Gesture Platformer** repository.

---

## 🤖 Agent Role & Objective
Your objective is to help maintain, build, and optimize the 8-Bit Gesture Platformer. Always write clean, maintainable TypeScript, adhere to the established 8-bit retro arcade aesthetic, and follow safety and quality protocols.

---

## 📁 Repository Directory Map
Ensure you understand the layout of the project before proposing modifications:
- [src/main.tsx](file:///c:/Users/DTC%20USER/Desktop/RAPISTA/my-ai_appgame/src/main.tsx) — Application mounting entry point.
- [src/App.tsx](file:///c:/Users/DTC%20USER/Desktop/RAPISTA/my-ai_appgame/src/App.tsx) — Main layout. Integrates the neural engine sidebar, webcam settings, telemetry display, and the arcade game screen.
- [src/components/GameCanvas.tsx](file:///c:/Users/DTC%20USER/Desktop/RAPISTA/my-ai_appgame/src/components/GameCanvas.tsx) — Core game loop using HTML5 2D Canvas. Manages player states (`RUNNING`, `JUMPING`, `DUCKING`, etc.), obstacle spawner, scoring, retro particle effects, and collision detection.
- [src/components/ModelManager.tsx](file:///c:/Users/DTC%20USER/Desktop/RAPISTA/my-ai_appgame/src/components/ModelManager.tsx) — Manages the webcam capture feed, fetches TensorFlow.js / Teachable Machine models dynamically, handles real-time gesture inference, and reports classification confidences.
- [src/components/AudioSynth.ts](file:///c:/Users/DTC%20USER/Desktop/RAPISTA/my-ai_appgame/src/components/AudioSynth.ts) — Procedural sound synthesis engine built with the Web Audio API. Generates 8-bit vintage sound effects (jump, duck, coin, hurt, game over) procedurally.
- [src/types.ts](file:///c:/Users/DTC%20USER/Desktop/RAPISTA/my-ai_appgame/src/types.ts) — Central type definitions for players, obstacles, game state, particles, and gesture control telemetry.
- [src/index.css](file:///c:/Users/DTC%20USER/Desktop/RAPISTA/my-ai_appgame/src/index.css) — Custom styles and Tailwind CSS v4 directives. Includes CRT retro scanline/glow keyframe animations.
- [src/TASKS.md](file:///c:/Users/DTC%20USER/Desktop/RAPISTA/my-ai_appgame/src/TASKS.md) — Task list and project backlog.
- [src/PROMPTS.md](file:///c:/Users/DTC%20USER/Desktop/RAPISTA/my-ai_appgame/src/PROMPTS.md) — Shared prompt library for documentation of successful instructions.

---

## 🔄 Agentic Workflows

### 1. Task Tracking in [TASKS.md](file:///c:/Users/DTC%20USER/Desktop/RAPISTA/my-ai_appgame/src/TASKS.md)
When initiating or updating a feature:
- Mark tasks you are working on as in-progress: `[/] TASK-### — description`.
- Mark completed tasks as: `[x] TASK-### — description — finished YYYY-MM-DD`.
- Add new sub-tasks as needed under the appropriate backlog section.

### 2. Logging Prompts in [PROMPTS.md](file:///c:/Users/DTC%20USER/Desktop/RAPISTA/my-ai_appgame/src/PROMPTS.md)
When a prompt or instructional structure achieves a highly effective code change:
- Record it in `PROMPTS.md` with:
  - Date
  - Model Name
  - Intent
  - Prompt text
  - Output quality rating (1 to 5)

---

## 🛠️ Codebase Standards & Best Practices

- **Strict Type Checking**: Do not bypass TypeScript compilers. Never use `any`. Always declare precise types in `types.ts` or inline interfaces.
- **Styling**: This project uses **Tailwind CSS v4** (`@import "tailwindcss"` in `src/index.css`). Use Tailwind utility classes for all styling. If custom keyframes or styles are needed, define them in the `@theme` block or custom utility classes within `src/index.css`.
- **Procedural Sound Rules**: Do NOT add mp3, wav, or external audio asset dependencies. If you need new sound effects, add them procedurally using Web Audio API oscillators inside `AudioSynth.ts`.
- **No External Assets**: All visual sprites must be drawn procedurally on the 2D HTML5 Canvas (`GameCanvas.tsx`). Do not link to external image assets.
- **Performance & Game Loop**: Ensure the canvas drawing loop is optimized (`requestAnimationFrame`) and clean up timers/intervals on component unmount to prevent leaks.

---

## 🔒 Responsible AI Rules & Guardrails
- **Human Verification**: Every agent-produced output must be reviewed/tested by a developer before it is merged.
- **Secrets & Credentials**: Never hardcode API keys or credentials. Use `.env.local` for local secrets.
- **Network Safety**: Do not configure direct external API/web socket requests unless explicitly specified. The Teachable Machine model URL input is user-configured; validate and sanitize URLs before requesting model files.
- **Offline Capabilities**: Ensure offline fallback runs cleanly. If TensorFlow.js models fail to load or the webcam is disabled, the game must fall back to standard keyboard arrow keys gracefully.
- **Escalation**: If a model produces incorrect outputs, repeatedly gets stuck in loops, or introduces breaking changes, escalate to a human developer immediately.

---

## 🧪 Verification Protocol
Prior to finishing any coding assignment, run:
```bash
# Verify TypeScript compiler checks
npm run lint
```
And verify that the application compiles without errors:
```bash
# Verify Vite production bundle compiles
npm run build
```
