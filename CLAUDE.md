# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ClimateFarmer26 is a browser-based educational simulation game where students role-play as California farmers across multiple years, making season-by-season strategic decisions as climate impacts challenge their operations. A successful playthrough teaches diversification, water conservation, and forward-thinking agricultural practices. The student experience should be pleasant and focused on key decisions — many systems run on autopilot until the student opts into manual control.

**Status: Slice 5 planning in progress ("Adapt or Fail").** Slices 1-4 complete. Core loop + event engine + 7 crops + 2 advisors + yield curves + 5 scenarios + classroom UX. Slice 5 adds: tech tree via storylets (7-8 either/or decision points), 2 new competing advisors (banker + community), K-lite nutrients, 3 regime shifts, auto-irrigation, 2-3 novel crops, message variety, event cap. Production build: ~44KB gzipped JS.

## Workflow Rules

These are non-negotiable. They override any default AI coding behavior.

### No code without an approved blueprint
Before any feature work, produce a plan covering: user flows, data model, screens/endpoints, error handling, security basics, and a list of unknowns. Neal approves before coding begins. Use plan mode.

### TDD is non-negotiable
Write tests before implementation. Acceptance tests ("When I do X, I should see Y") define the contract in SPEC.md. Unit tests for simulation logic are written before the code they test. No exceptions.

### All interactive UI elements must have data-testid attributes
Every clickable, typeable, or otherwise interactive DOM element gets a descriptive `data-testid` (e.g., `data-testid="plant-corn-button"`, `data-testid="field-cell-3-7"`). This enables automated testing by headless browsers and AI test agents. Semantic, intuitive naming — a tester reading the test IDs should understand the UI without seeing it.

### Build in thin vertical slices
Ship the smallest end-to-end version first. Then add one slice per change. Never build "weeks of code" that gets tested at the end.

### Every change must build, run, and pass tests
If something breaks, the next action is **fix it** — not continue building features. This is the stop-the-line rule.

### No guessing — uncertainty must be explicit
If information is missing (game rules, UI copy, business logic, API details), **ask Neal or label a TODO**. Never invent requirements or fill gaps with assumptions.

### Provide proof, not promises
Every completed piece of work needs: a way to run it, a way to verify it works, and expected outputs. "It works" without evidence is not done.

### Review your own output
After producing code, do a second pass checking: spec compliance, missing edge cases, security issues, and "does this actually do what Neal wanted?"

### Prefer boring, mainstream tech
Use well-known frameworks, starter kits, and deployment paths. Novel architecture is a risk multiplier. When in doubt, pick the most common solution.

### Neal controls git
Do not commit, push, or create branches/PRs unless Neal explicitly asks.

## Commands

```bash
npm run dev          # Dev server (http://localhost:5173)
npm run build        # Type-check + production build (tsc -b && vite build)
npm run preview      # Serve production build (http://localhost:4173)
npm test             # Unit tests (vitest run)
npm run test:watch   # Unit tests in watch mode
npm run test:browser # Playwright browser tests (builds first)
npm run test:all     # Unit + browser tests
npx vitest run tests/engine/game.test.ts  # Run a single test file
npx vitest run -t "plants a crop"         # Run tests matching a name pattern
```

## Architecture

**Stack:** Preact + @preact/signals + TypeScript strict + Vite + Vitest + Playwright + CSS Modules

**Three-layer architecture:**

1. **Engine** (`src/engine/`) — Pure TypeScript, zero UI deps. All game logic lives here. Testable headlessly.
   - `types.ts` — All game state types and constants. `GameState` is the root type. `SAVE_VERSION = '7.0.0'`.
   - `game.ts` — Core: `createInitialState()`, `processCommand()`, `simulateTick()`, `harvestCell()`. Commands are discriminated unions (`Command` type).
   - `calendar.ts` — Day↔calendar conversion. Game starts at `STARTING_DAY=59` (March 1).
   - `weather.ts` — Deterministic daily weather from `ClimateScenario` + seeded RNG. `ExtremeEventState` interface for multi-day heatwave/frost tracking. `updateExtremeEvents()` modifies weather in-place. Per-season probability converted to per-day via `1-(1-p)^(1/90)`.
   - `rng.ts` — Mulberry32 seeded PRNG with save/restore state.
   - `playtest-log.ts` — Opt-in verbose logging for human QA sessions.
   - `events/types.ts` — Storylet (with advisorId), Condition (16 types), Effect (10 types incl. `activate_frost_protection`), Choice, Foreshadowing.
   - `events/selector.ts` — `evaluateEvents()` — precondition checking, foreshadowing lifecycle, weighted event selection. `drawSeasonalEvents()` — seasonal draw at season boundaries.
   - `events/effects.ts` — `applyEffects()` — processes all Effect types on GameState.

2. **Adapter** (`src/adapter/signals.ts`) — Bridges engine↔UI with Preact Signals.
   - `_liveState` is mutable (engine mutates it). `publishState()` creates a `structuredClone` for the reactive `gameState` signal.
   - Game loop: `requestAnimationFrame`-based, 12 ticks/sec × speed multiplier.
   - Player actions go through `dispatch()` → `processCommand()`. Partial-offer bulk confirm callbacks call `executeBulkPlant`/`executeWater`/`executeBulkCoverCrop` directly (already validated by prior `processCommand` call).
   - Debug hooks (`window.__gameDebug`): `setCash`, `setDay`, `setDebt`, `setTotalLoansReceived`, `setFlag`, `triggerEvent`, `getState` — for Playwright test state injection.

3. **UI** (`src/ui/`) — Preact components + CSS Modules. Reads computed signals, calls adapter functions.
   - Components: App, GameScreen, NewGameScreen, TopBar, FarmGrid, FarmCell, SidePanel (with ChillHourBar), CropMenu, AutoPausePanel, NotificationBar, ConfirmDialog, Tutorial, EventPanel

**Data files** (`src/data/`): `crops.ts` (7 crops: 4 annual + 3 perennial with yield curves), `cover-crops.ts` (legume cover crop definition), `scenarios.ts` (5 calibrated climate scenarios with chillHours per year), `events.ts` (STORYLETS: 14 total — 3 climate + 2 market/regulatory + 6 Dr. Santos advisors + 3 Weather Service advisors)

**Save system** (`src/save/storage.ts`): localStorage with corruption detection + V1→V2→V3→V4→V5→V6→V7 migration chain. Auto-save on season change. Manual named saves keyed by "Year N Season". `hasSaveData()` validates auto-save via `loadAutoSave()` (powers Continue button); `hasManualSaves()` powers Load Game button.

**Key patterns:**
- Command pattern for all player actions (discriminated union `Command` type)
- Seeded PRNG for deterministic simulation (Mulberry32) — separate weather RNG and event RNG
- `structuredClone` for signal reactivity (engine mutates, adapter clones)
- Every interactive element has `data-testid` for Playwright
- Storylet pattern for events and advisors (precondition-based selection, foreshadowing, cooldowns)
- Fog-of-war via `state.flags` map (chill hours hidden until revealed)

## Project Memory

These files are the project's living documentation. Update them as work progresses:

- `README.md` — How to install, run, and develop
- `SPEC.md` — Acceptance tests and requirements (the "contract")
- `ARCHITECTURE.md` — System design, data model, tech stack decisions
- `DECISIONS.md` — Log of key decisions and their rationale
- `KNOWN_ISSUES.md` — Bugs, limitations, and technical debt

## Architecture Principles

These come from post-mortem analysis of the previous attempt and research on well-built simulation games. Reference material in `reference/`.

- **Engine/UI separation is mandatory.** The simulation engine must run headlessly with zero UI dependencies. All game logic testable without a browser.
- **Command pattern for all player actions.** UI emits command objects; engine validates and executes. No direct state mutation from UI. Enables testing and deterministic replay.
- **Data-driven content.** Crops, technologies, events, and economic parameters live in data files (JSON), not hardcoded in logic.
- **Deterministic simulation.** Seeded RNG so that identical inputs produce identical outputs. Enables reproducible test scenarios and "replay a student's broken game" debugging.
- **Storylet pattern for events.** Climate/market events are independent chunks with preconditions, not a giant if-else tree. The engine selects events based on current game state.
- **No stubs in the UI.** If a feature appears in the interface, it must work. Prefer fewer complete features over many half-implemented ones.
- **Bulk actions from day one.** Students must never click 100 times for routine work. Row/column/field-level actions are mandatory, not stretch goals.
- **Cause-and-effect transparency.** Every outcome the student sees must explain *why* it happened in plain language.

## Codebase Exploration Tools

**jcodemunch MCP** is available for structured codebase understanding. Two indexes exist:
- `naddicott-dtech/ClimateFarmer26` — indexed from GitHub
- `local/ClimateFarmer26` — indexed from local filesystem (richer: includes test files)

**Use the local index (`local/ClimateFarmer26`) as the default.** Re-index after significant code changes:
```
mcp__jcodemunch__index_folder(path="/Users/naddicott/ClimateFarmer26", incremental=true)
```

### When to use which tool

| Task | Best tool | Why |
|------|-----------|-----|
| "What functions are in this file?" | `get_file_outline` | Returns all symbols with signatures + line numbers in one call. Better than regex for multi-line signatures. |
| "What functions exist for X?" | `search_symbols` | Searches names, signatures, summaries across the whole repo. |
| "Where is X referenced/used?" | `Grep` or `search_text` | Both are exhaustive across function bodies, string literals, comments. Grep supports regex; `search_text` is substring-only but stays within jcodemunch's token accounting. |
| "How is feature X wired across the codebase?" | `Grep` | Regex flexibility + context lines (`-A`/`-B`/`-C`) make it best for tracing cross-cutting concerns. |
| "What's the project structure?" | `get_repo_outline` / `get_file_tree` | Instant structural overview without multiple ls/Glob calls. |
| "Show me the source of function Y" | `get_symbol` | Retrieves exact source by symbol ID. Avoids reading an entire large file. |
| Broad multi-query exploration | `Agent` (subagent_type=Explore) | For deep research requiring many searches. |

### Limitations
- jcodemunch's parser can't extract symbols from some files (notably `events.ts` data arrays, some JSX components, test files). These files still work with `search_text` and `Grep`.
- `search_symbols` only matches symbol metadata (names/signatures/summaries), not function bodies. Use `search_text` or `Grep` when you need to find references inside implementations.
- After code changes, the index goes stale. Run incremental re-index before relying on jcodemunch for modified files.

## Files to Exclude from Code Review Context

- `SeniorSoftwareEngineer.md` — Role instructions and notes for a separate reviewer agent. Not part of the codebase.

## Guardrails

This section will grow as the project takes shape. Current rules:

- No server-side infrastructure beyond what's absolutely necessary (favor client-side logic)
- No storing sensitive student data
- Allowed integrations TBD (e.g., Google Sheets, Supabase) — do not add without approval
- Do not add dependencies without discussing them first
- Target hardware: Chromebooks. Performance budgets will be defined during architecture phase.
- Do not implement Slice 6+ features (completion code, Google Form, full scoring formula, insurance/credit systems, solar lease) without explicit approval. Slice 5 scope is the boundary.
