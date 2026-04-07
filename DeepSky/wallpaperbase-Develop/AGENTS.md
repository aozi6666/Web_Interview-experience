# AGENTS.md

## Project Overview

WallpaperBase is an Electron desktop wallpaper application written in TypeScript.
The repository contains two closely related parts:

- Main product: Electron + React app under `src/` with `main / renderer / shared` layering.
- Wallpaper engine playground: `src/we-engine/` and `apps/wallpaper-engine/` for Wallpaper Engine resource loading, rendering, and regression validation.

Primary goals:

- Keep desktop wallpaper behavior stable on Windows.
- Preserve architecture boundaries between Electron main, renderer, and shared contracts.
- Prefer simple, targeted fixes over broad refactors.

## Setup Commands

- Install dependencies: `npm install`
- Root lint: `npm run lint`
- Root tests: `npm test`
- Root production build: `npm run build`
- Root package build: `npm run package`
- Root renderer dev server: `npm start`
- Root main-process watch + Electron: `npm run start:main`
- Root preload dev build: `npm run start:preload`

Wallpaper engine workspace:

- Dev server: `npm run dev:we`
- Build: `npm run build:we`
- Test: `npm run test:we`
- Direct app Electron dev: `npm --prefix apps/wallpaper-engine run electron:dev`

## Repository Map

- `src/main/`: Electron main process, native integration, IPC handlers, services, managers.
- `src/renderer/`: React UI, hooks, page state, UI orchestration, API wrappers for IPC calls.
- `src/shared/`: cross-process channels, shared types, constants, IPC contracts.
- `src/we-engine/moyu-engine/`: wallpaper rendering engine core.
- `src/we-engine/formats/`: external wallpaper format adapters, especially Wallpaper Engine.
- `apps/wallpaper-engine/`: Vite testbed and regression app for engine-side verification.
- `release/app/`: packaged Electron app runtime dependencies.
- `docs/architecture.md`: architecture overview.
- `docs/development-guidelines.md`: coding and layering rules used in this repo.
- `AGENT.md`: historical troubleshooting notes and deep project context.

## Architecture Rules

### Main / Renderer / Shared

- Put OS, Electron, filesystem, network, tray, window, process, and native integration logic in `src/main/`.
- Put React components, hooks, page state, view formatting, and UI flows in `src/renderer/`.
- Put shared IPC channels, shared request/response types, and constants in `src/shared/`.
- Do not access Electron or Node internals directly from renderer UI code unless already routed through the approved preload / API layer.

### IPC and Contracts

- Do not hardcode IPC channel strings in business files. Define them in `src/shared/channels/`.
- Shared request/response payloads belong in `src/shared/types/`.
- Keep IPC handlers thin: validate input, call service/manager, map errors, return stable result shapes.

### Service Boundaries

- `service`: business orchestration and module lifecycle.
- `manager`: ownership of native resources, windows, processes, connections, or other runtime state.
- `api` and `hooks` in renderer should hide low-level IPC details from components.

### Wallpaper Engine Workspace

- `moyu-engine/` must not depend on `formats/`.
- `formats/` maps external wallpaper data into engine abstractions and should not contain renderer/backend implementation details.
- `apps/wallpaper-engine/` is for app assembly, debugging, and regression checks; avoid leaking app-specific logic into engine core.

## Coding Conventions

- Use TypeScript and follow existing project style.
- Prefer small, readable changes over framework-like abstractions.
- Follow existing naming:
  - `*Service.ts` for service entry points
  - `*Manager.ts` for resource/runtime owners
  - `use*.ts` for hooks
  - `<domain>Channels.ts` for IPC channel definitions
- Add comments only when the logic is non-obvious, platform-specific, or protocol-sensitive.
- Reuse existing utilities and contracts before adding new helpers.

## Change Guidelines

- First decide which layer owns the change. Do not place business logic in the wrong process.
- Do not modify unrelated files.
- Do not edit generated output or build artifacts unless the task is specifically about build output.
- Do not modify wallpaper sample assets in `resources/` unless the task explicitly requires it.
- Be careful when touching `release/app/package.json`; it affects packaged runtime dependencies.
- For bug fixes, identify the root cause before patching symptoms.

## Testing Guidance

- Run the smallest relevant verification first.
- UI or renderer changes: usually `npm run lint` and targeted manual validation.
- Root app behavior changes: consider `npm test`, relevant build command, or focused runtime verification.
- Wallpaper engine changes: prefer `npm run test:we`; use `apps/wallpaper-engine` for visual regression or reproduction when needed.
- When changing shared contracts, IPC handlers, or engine loading logic, add or update focused tests if the surrounding area already has meaningful coverage.

## Windows / Electron Notes

- This project is Windows-heavy and includes desktop embedding, Electron windows, and native bindings.
- A renderer `index.html` 404 in development is often caused by renderer compilation failure first; check build errors before changing routing.
- Preserve the startup and wallpaper switching flow unless the task explicitly changes lifecycle behavior.
- Avoid introducing duplicate wallpaper activation paths; existing logic tries to centralize backend switching and display coordination.

## Preferred Workflow For Agents

1. Read `docs/development-guidelines.md` and `docs/architecture.md` before large or architectural changes.
2. Inspect the nearest related module instead of applying repo-wide edits blindly.
3. Make the smallest change that fixes the issue while preserving established layering.
4. Verify only the paths affected by the change.
5. Summarize root cause, fix, and verification clearly.

## Useful References

- AGENTS.md format examples: https://agents.md/#examples
- Project architecture: `docs/architecture.md`
- Project development rules: `docs/development-guidelines.md`
- Historical troubleshooting context: `AGENT.md`
