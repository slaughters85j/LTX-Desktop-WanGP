# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LTX Desktop is an Electron app for AI video generation using LTX models. Three-layer architecture:

- **Frontend** (`frontend/`): React 18 + TypeScript + Tailwind CSS renderer
- **Electron** (`electron/`): Main process managing app lifecycle, IPC, Python backend process, ffmpeg export
- **Backend** (`backend/`): Python FastAPI server (port 8000) handling ML model orchestration and generation

## Common Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Start dev server (Vite + Electron + Python backend) |
| `pnpm dev:debug` | Dev with Electron inspector + Python debugpy |
| `pnpm typecheck` | Run TypeScript (`tsc --noEmit`) and Python (`pyright`) type checks |
| `pnpm typecheck:ts` | TypeScript only |
| `pnpm typecheck:py` | Python pyright only |
| `pnpm backend:test` | Run Python pytest tests |
| `pnpm build:frontend` | Vite frontend build only |
| `pnpm build:mac` / `pnpm build:win` | Full platform builds |
| `pnpm setup:dev:mac` / `pnpm setup:dev:win` | One-time dev environment setup |

Run a single backend test: `cd backend && uv run pytest tests/test_generation.py -v --tb=short`

## CI Checks

PRs must pass: `pnpm typecheck` + `pnpm backend:test` + frontend Vite build.

## Frontend Architecture

- **Path alias**: `@/*` maps to `frontend/*`
- **State management**: React contexts only (`ProjectContext`, `AppSettingsContext`, `KeyboardShortcutsContext`) — no Redux/Zustand
- **Routing**: View-based via `ProjectContext` with views: `home`, `project`, `playground`
- **IPC bridge**: All Electron communication through `window.electronAPI` (defined in `electron/preload.ts`)
- **Backend calls**: Frontend calls `http://localhost:8000` directly
- **Styling**: Tailwind with custom semantic color tokens via CSS variables; utilities from `class-variance-authority` + `clsx` + `tailwind-merge`
- **No frontend tests** currently exist

## Backend Architecture

Request flow: `_routes/* (thin) → AppHandler → handlers/* (logic) → services/* (side effects) + state/* (mutations)`

Key patterns:
- **Routes** (`_routes/`): Thin plumbing only — parse input, call handler, return typed output. No business logic.
- **AppHandler** (`app_handler.py`): Single composition root owning all sub-handlers, state, and lock
- **State** (`state/`): Centralized `AppState` using discriminated union types for state machines (e.g., `GenerationState = GenerationRunning | GenerationComplete | GenerationError | GenerationCancelled`)
- **Services** (`services/`): Protocol interfaces with real implementations and fake test implementations. The test boundary for heavy side effects (GPU, network).
- **Concurrency**: Thread pool with shared `RLock`. Pattern: lock→read/validate→unlock→heavy work→lock→write. Never hold lock during heavy compute/IO.
- **Exception handling**: Boundary-owned traceback policy. Handlers raise `HTTPError` with `from exc` chaining; `app_factory.py` owns logging. Don't `logger.exception()` then rethrow.
- **Naming**: `*Payload` for DTOs/TypedDicts, `*Like` for structural wrappers, `Fake*` for test implementations

### Backend Testing

- Integration-first using Starlette `TestClient` against real FastAPI app
- **No mocks**: `test_no_mock_usage.py` enforces no `unittest.mock`. Swap services via `ServiceBundle` fakes only.
- Fakes live in `tests/fakes/`; `conftest.py` wires fresh `AppHandler` per test
- Pyright strict mode is also enforced as a test (`test_pyright.py`)

### Adding a Backend Feature

1. Define request/response models in `api_types.py`
2. Add endpoint in `_routes/<domain>.py` delegating to handler
3. Implement logic in `handlers/<domain>_handler.py` with lock-aware state transitions
4. If new heavy side effect needed, add service in `services/` with Protocol + real + fake implementations
5. Add integration test in `tests/` using fake services

## TypeScript Config

- Strict mode with `noUnusedLocals`, `noUnusedParameters`
- Frontend: ES2020 target, React JSX
- Electron main process: ESNext, compiled to `dist-electron/`
- Preload script must be CommonJS

## Python Config

- Python 3.13+ (per `.python-version`), managed with `uv`
- Pyright strict mode (`backend/pyrightconfig.json`)
- Dependencies in `backend/pyproject.toml`

## Key File Locations

- Backend architecture doc: `backend/architecture.md`
- Default app settings schema: `settings.json`
- Electron builder config: `electron-builder.yml`
- Video editor (largest frontend file): `frontend/views/VideoEditor.tsx`
- Project types: `frontend/types/project.ts`

## Launch Fix — ELECTRON_RUN_AS_NODE

**Problem:** LTX Desktop crashes on startup with `Cannot find module 'electron'` — `require('electron')` fails because the Electron built-in module isn't registered. `process.type` is `undefined` instead of `"browser"`.

**Root Cause:** `ELECTRON_RUN_AS_NODE=1` is set in the shell environment (VS Code's integrated terminal sets this). This env var forces Electron to skip its full initialization and run as a plain Node.js runtime, preventing the `electron` module from ever being registered.

**The Fix:** Unset the env var before launching:
```
unset ELECTRON_RUN_AS_NODE && pnpm dev        # bash
set "ELECTRON_RUN_AS_NODE=" && pnpm dev       # cmd
```

**What Does NOT Work (Dead Ends — do not retry these):**
- Switching `package.json` `"type"` to `"commonjs"` — breaks PostCSS/Tailwind configs that use `export default`
- Forcing `format: 'cjs'` in vite `rollupOptions` — `vite-plugin-electron` overrides this internally
- Renaming configs to `.mjs` + setting commonjs — CJS output works but `require("electron")` resolves to the npm package (returns a file path string) instead of the built-in API
- Custom rollup plugin (`electronCjsPlugin`) — plugin's `renderChunk` never runs because `vite-plugin-electron` runs its own internal Vite build
- Upgrading Electron to v41 + Vite 7 — Node 22.11.0 too old for Vite 7 (needs 22.12+)
- Vite 8 — needs Node 22.12+ and uses rolldown with missing native bindings
- Vite 6 + Electron 41 — `'electron' does not provide an export named 'BrowserWindow'` in ESM
- Downloading Node.js 22.22.0 — same error with the env var still set
- Downgrading Electron to v31/32/33/35 — all fail the same way
- Hiding `node_modules/electron` — built-in still returns empty object (because of env var)

**Current State:**
- `package.json` and `vite.config.ts` match the original Lightricks repo exactly
- Electron 41.0.2, Vite 7.3.1, original dependencies
- Backend Python 3.12 venv is fully set up
- `WANGP_ROOT` env var points to `C:\pinokio\api\wan.git\app`
- App launches successfully with `start.bat` or `unset ELECTRON_RUN_AS_NODE && pnpm dev`
- Node.js 22.11.0 is in use — Vite 7 warns it needs 22.12+ but works for now
