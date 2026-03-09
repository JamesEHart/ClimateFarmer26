# HANDOFF.md — Post-Slice 4 Completion Snapshot

> **ARCHIVAL DOCUMENT.** This snapshot reflects the project state as of 2026-03-06, after Slice 4 completion. Slice 5a implementation is now in progress — see CLAUDE.md, DECISIONS.md, and ARCHITECTURE.md for current status. Metrics, architecture references, and deferred feature lists below are stale.

**Date:** 2026-03-06
**Status:** Slice 4 complete (sub-slices 4a + 4b + 4b.5 + 4c + 4d + 4e + stabilization). Ready for Slice 5 planning.

## What Was Built

### Slice 1 (Complete)
Core farming simulation loop: plant → grow → harvest → economy. 3 annual crops (silage corn, winter wheat, processing tomatoes), 8×8 grid with bulk ops, weather system, soil model, save/load, auto-pause, tutorial.

### Slice 2 (Complete)
Event/storylet engine + loans + 3 climate events (heatwave, water allocation cut, late frost). Perennial crops (almonds, pistachios) with dormancy, chill hours, establishment periods. Extension agent advisor (Dr. Maria Santos, 5 storylets). Emergency loan system. Fog-of-war for chill hours. Save migration V1→V2→V3.

### Slice 3 (Complete)
Stretch events (tomato surge, pumping ban). 2 new crops (sorghum, citrus navels — 7 total). Perennial yield curves (ramp→peak→decline). Cover crop system (legume, fall planting, spring auto-incorporation). Weather Service advisor (NWS Fresno, 3 storylets). Frost protection mechanism. Save migration V3→V4.

### Slice 4a: Balance Testing Infrastructure
- Headless strategy bot framework (5 bots: monoculture corn, almond, idle, diversified-adaptive, zero-irrigation)
- 5 calibrated climate scenarios (`scenarios.ts`): gradual-warming, early-drought, whiplash, late-escalation, mild-baseline
- Full test matrix: 5 bots × 5 scenarios × 20 seeds = 500 headless 30-year runs
- Save migration V4→V5 (tracking fields + cell-level tracking)

### Slice 4b + 4b.5: Event System Refactor
- Seasonal draw semantics: 8 random-gated events drawn once per season at boundary
- Stress-modulated probability: `adjustedProbability = min(0.95, baseProbability × (0.5 + stressLevel))`
- Family caps: max 1 per type (climate/regulatory/market/advisor) per season
- 6 condition-only advisors remain per-tick
- Save migration V5→V6 (seasonalEventQueue + yearStressLevel)

### Slice 4c: Economic Rebalancing
Four levers to fix #45 (economy too lenient):
1. OM yield penalty: `computeOMYieldFactor()` — yield drops as OM declines
2. Water allocation enforcement: `effectiveDose = WATER_DOSE_INCHES × allocation`
3. Nitrogen tightening: N consumed at harvest, mineralization via OM
4. Irrigation cost increase: $24/cell

### Slice 4d: Annual Overhead + Fine-tuning
- $2,000/year annual overhead expense
- Balance result: corn monoculture ~69% survival (risky), diversified 100%, idle 0%

### Slice 4e: Classroom UX Clarity Pass
- Water warning double-gate fix (#52): `skipConfirm` for auto-pause watering
- Year-end expense breakdown (#53): 9-category line items
- Calendar display lag fix (#54)
- Row/column cost display (#55)
- Notification backlog fix (#61): batch + cap + age trim
- Game Over label fix (#57): "Final year" not "Total"
- Year-end cash label fix (#58): "before loan"
- Cover crop cell label fix (#60): "Fallow (Cover Crop)"
- Perennial onboarding warning (#71): confirm dialog on first perennial plant
- Advisor timing fix (#72): season-agnostic recommendation text
- Running net P/L in TopBar (#73)
- Crop art overhaul (#74): custom images for all 7 crops × all growth stages (no emoji)
- Play prompt (#50): pulsing "Press Play to continue"
- Continue button integrity (#67): validates auto-save before showing
- Autosave sync on manual load (#68)
- New Game confirm guard (#69)
- Save migration V6→V7 (scenarioId field)

### Stabilization (Post-4e)
- TopBar CSS Grid layout (#78): `1fr auto 1fr` eliminates speed control drift
- Perennial harvest UI fix (#79): GDD clamp after harvest, Ready badge gated on `!harvestedThisSeason`

## Current Metrics

```
npm test             # 589 unit tests, all passing (19 test files)
npm run test:browser # 96 Playwright browser tests (all passing; foreshadow natural-flow test may flake under --repeat-each stress)
npm run build        # ~43.8 KB gzipped JS, ~5.1 KB CSS
SAVE_VERSION         # '7.0.0'
```

## Architecture Quick Reference

```
src/
  engine/          Pure TS, zero UI deps. All game logic.
    types.ts         GameState root type, Command union, CropInstance, constants
    game.ts          createInitialState, processCommand, simulateTick, harvestCell,
                     getPerennialAgeFactor, getPerennialPhase, executeBulkPlant,
                     executeWater, executeBulkCoverCrop, addNotification
    calendar.ts      Day↔calendar conversion (STARTING_DAY=59 = March 1)
    weather.ts       generateDailyWeather, updateExtremeEvents
    rng.ts           Mulberry32 seeded PRNG
    playtest-log.ts  Opt-in verbose logging for human QA
    events/
      types.ts       Storylet (with advisorId), Condition (16 types), Effect (10 types),
                     Choice, Foreshadowing, ActiveEvent, ActiveEffect
      selector.ts    evaluateEvents — precondition checking, seasonal draw, weighted selection
      effects.ts     applyEffects — processes all Effect types including activate_frost_protection
  adapter/
    signals.ts       Bridges engine↔UI. _liveState → structuredClone → gameState signal
                     Debug hooks: window.__gameDebug (setCash, setDay, setDebt, triggerEvent,
                     setFlag, getState, publish, setScenario, fastForward)
  data/
    crops.ts         7 crop definitions (4 annual + 3 perennial) with yield curves
    cover-crops.ts   Cover crop definitions (legume-cover)
    scenarios.ts     5 calibrated climate scenarios with chillHours per year
    events.ts        STORYLETS array (3 climate + 2 market/regulatory + 6 Dr. Santos + 3 NWS = 14 total)
  save/
    storage.ts       localStorage: auto-save, manual saves, V1→V2→V3→V4→V5→V6→V7 migration chain
  ui/
    components/      Preact components (App, GameScreen, NewGameScreen, TopBar, FarmGrid,
                     FarmCell, SidePanel, CropMenu, AutoPausePanel, NotificationBar,
                     ConfirmDialog, Tutorial, EventPanel)
    styles/          CSS Modules
tests/
  engine/            Unit tests: game, weather, calendar, save, rng, events, chill,
                     advisors, perennials, yieldcurve, covercrop, weather-advisor,
                     slice3a1, economy, seasonal-events, balance-harness
  browser/           Playwright specs (game.spec.ts — 96 tests)
```

## Open Issues for Slice 5

### UX (deferred from Slice 4)
- **#47:** Event clustering (medium — spammy multi-event seasons). Likely fix: per-season event cap.
- **#49:** Cover crop / soil health pedagogy not landing (OM decline invisible).
- **#59:** Water warning click-fatigue. Recommended fix: automated irrigation as tech tree unlock.
- **#62:** Harvest affordance misleads when selected plot is not ready. Show "N plots ready" context.
- **#65:** Year-30 completion panel lacks educational summary / reflection prompts.
- **#66:** Soil management has limited agency after early advisor caps.
- **#70:** Confirm dialog can be overwritten by scripted interaction (automation hardening).

### Known test issue
- Foreshadowing browser test (`game.spec.ts:890`) is flaky (~10% failure rate under stress). Non-blocking.

### Deferred features → Slice 5+
- **Tech tree** — Fog-of-war event-driven tech unlocks (automated irrigation as first unlock)
- **Remaining advisors** — Financial Advisor/Banker, Farming Community
- **Insurance / credit systems** — Credit rating, variable loan rates
- **K + Zn nutrients** — Only nitrogen is modeled
- **Additional crops** — Grapes, Stone Fruit, Agave, Heat-tolerant Avocados, Opuntia, Guayule
- **Scoring + completion code** — Weighted composite formula + Google Form
- **Automation policies** — Replant-same, harvest-when-ready, water-when-dry
- **Glossary / Information Index** — In-game educational reference
- **Solar lease event chain** — Multi-phase storylet
- **Year-30 reflection panel** — Educational summary using yearSnapshots data

## Verification Commands

```bash
npm test             # Unit tests
npm run test:browser # Playwright browser tests (builds first)
npm run test:all     # All tests in sequence
npm run build        # Production build (<200KB gzipped)
```
