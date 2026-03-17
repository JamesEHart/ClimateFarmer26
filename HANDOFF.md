# HANDOFF.md — Post-Slice 7d Completion Snapshot

**Date:** 2026-03-15
**Status:** Slices 1-7d complete. Classroom-Ready Build deployed.

## What Was Built

### Slice 1 (Complete)
Core farming simulation loop: plant → grow → harvest → economy. 3 annual crops (silage corn, winter wheat, processing tomatoes), 8×8 grid with bulk ops, weather system, soil model, save/load, auto-pause, tutorial.

### Slice 2 (Complete)
Event/storylet engine + loans + 3 climate events (heatwave, water allocation cut, late frost). Perennial crops (almonds, pistachios) with dormancy, chill hours, establishment periods. Extension agent advisor (Dr. Maria Santos, 5 storylets). Emergency loan system. Fog-of-war for chill hours. Save migration V1→V2→V3.

### Slice 3 (Complete)
Stretch events (tomato surge, pumping ban). 2 new crops (sorghum, citrus navels — 7 total). Perennial yield curves (ramp→peak→decline). Cover crop system (legume, fall planting, spring auto-incorporation). Weather Service advisor (NWS Fresno, 3 storylets). Frost protection mechanism. Save migration V3→V4.

### Slice 4 (Complete)
- **4a:** Headless bot framework (6 bots: corn/almond monoculture, idle, diversified-adaptive, zero-irrigation, citrus-stability). 5 calibrated scenarios. Save migration V4→V5.
- **4b/4b.5:** Seasonal draw refactor (8 random-gated + 14 condition-only). Stress-modulated probability. Family caps. Save migration V5→V6.
- **4c:** Economic rebalancing — 4 levers (OM yield penalty, water allocation, N tightening, irrigation cost).
- **4d:** $2,000/year annual overhead. Save migration V6→V7.
- **4e:** Classroom UX clarity pass — 16 fixes including year-end expense breakdown, running net P/L, crop art overhaul, play prompt, confirm guards.
- **Stabilization:** TopBar CSS Grid layout (#78), perennial harvest UI fix (#79).

### Slice 5a: Systems Infrastructure (Complete)
New condition/effect types, `getTechLevel()` reconvergence (water/soil/crop tracks 0-3), K-lite potassium (per-cell depletion + price factor + symptom cues), auto-irrigation hook (tech-gated with cost multipliers), crop gating via `requiredFlag`, permanent regime shift modifiers (water/market/heat), separate tech/non-tech event clustering caps, harvest affordance count (#62), `pickMessage()` for message variety, agave as first gated crop. Save migration V7→V8. `SAVE_VERSION = '8.0.0'` (later bumped to `9.0.0` in Slice 6c).

### Slice 5b: Advisors + First Tech Branch (Complete)
Marcus Chen (`farm-credit`) + Valley Growers Forum (`growers-forum`) advisor characters with intro storylets. Water irrigation tech unlock (year 3, drip irrigation → auto-irrigation end-to-end). Auto-irrigation notification with 3-message rotating pool.

### Slice 5c: Full Content + Regime Shifts (Complete)
Remaining tech decisions (soil testing, crop tech, advanced water, late-game regime-aware offers). 3 regime shifts (water allocation reduction Y10-12, market crash Y15-18, heat threshold Y20-25). 2 novel crops (agave + heat-tolerant avocados). Year-30 reflection panel (#65). Tech soft-lock fix (#80). 19 condition types, 10 effect types. 9 crops (4 annual + 5 perennial).

### Slice 5d: Balance + Validate (Complete)
- **5d.1:** UX fixes — advisor threshold tuning (#82), bulk plant full-field feedback (#81), year-end "before loan" conditional copy (#87), bankruptcy reflection on loan decline (#88).
- **5d.2 "Corn Dominance Fix":** Monoculture streak penalty (escalating yield loss: 2nd=0.85, 3rd=0.70, 4th=0.55, 5th+=0.50 floor), cover crop OM protection reduction (50% vs 100%), diversified bot rewrite (proper rotation). Balance result: diversified ($301K) > corn ($193K) > citrus ($86K), all 100% survival. 6 bots × 5 scenarios tested.

### Observer Layer (Post-5d.2, expanded post-6e)
Debug-only affordances for AI test agents (`src/adapter/observer.ts`). Machine-readable state queries exposed via `window.__gameDebug`:
- `getBlockingState()` — returns `{ blocked, reason, panelTestId, choices[], speed, year, season, day }`. Choices include `enabled`, `cost`, `requiresCash` metadata. Filters by `requiresFlag` to match actual UI visibility.
- `fastForwardUntilBlocked(maxTicks)` — runs ticks until any autopause fires (does NOT auto-dismiss, unlike `fastForward()`). Accepts `onTick` callback for planting-window detection.
- `fastForwardDays(days)` — calendar-day-based advancement, returns `{ stopped, reason, ticksRun, day }`.
- `getActionState()` — returns available crops, cover crop eligibility, harvest-ready count, bulk action testids for current cell selection. Eliminates DOM scraping.
- `selectCell(row, col)` — programmatic cell selection for automation.
- `getNotifications()` / `dismissAllNotifications()` — full notification queue access.
- `setAutoPausePlanting(bool)` / `getPreferences()` — settings control without UI interaction.
- `game-observer` DOM element — hidden div with reactive `data-*` attributes for lightweight state polling.

See `Agent_Navigation_Guide.md` for AI agent usage patterns.

### Slice 6d: Scoring + Google Sign-In Submission (Complete)
5-category weighted composite scoring: financial stability (30%), soil health (20%), crop diversity (20%), climate adaptation (20%), consistency (10%). 4 tiers: Thriving (≥80), Stable (≥60), Struggling (≥40), Failed (<40). Human-readable completion code (PREFIX-SCORE-YYEARS-SCENARIO). Google Identity Services authentication for @dtechhs.org students. Authenticated result submission to backend spreadsheet. Score panel with per-component breakdown.

### Slice 6e: Endgame Payoff & Presentation Polish (Complete)
Three deliverables making the ending feel like a real conclusion:

- **6e.1 — Epilogue + Per-Category Hints:** `generateEpilogue()` produces tier-dependent, scenario-flavored narrative conclusion (headline + narrative + bridge). `generateCategoryHints()` returns max 2 improvement hints for weakest categories below raw 60. `generateAdvisorFarewells()` selects max 2 advisor farewells (most aligned + most contrasting by score component alignment). `estimateHumanFoodServings()` derives a rough food-production estimate from existing `yearSnapshots.cropCounts` — no new state, works for all saves.

- **6e.2 — EndgamePanel Extraction:** New `EndgamePanel.tsx` component extracted from AutoPausePanel. Layout: endgame art → epilogue → food servings callout → tier badge → score table → hints → advisor farewells → farm history (preserved from 5c reflection) → completion code + submission → start new game button. All existing `data-testid` values preserved. New testids: `endgame-epilogue`, `endgame-hints`, `food-servings-callout`.

- **6e.3 — Art Pass + Title Screen:** Title screen hero image with graceful fallback. Event illustrations for 4 high-impact storylets (`illustrationId` field on Storylet type): heatwave, water restriction, rootworm, orchard disease. `humanServingsPerUnit` added to all 9 CropDefinition entries. ASSETS.md updated with specs for 9 new art assets.

**No save migration in 6e** — all 6e data computed on-demand from existing GameState fields. (6c bumped SAVE_VERSION to `9.0.0` adding insurance/organic fields to ExpenseBreakdown.) Art is additive with `onError` graceful fallback — entire slice functional without art files.

### Post-7d QA Fixes + Launch Prep (Complete)
Bug fixes from release-candidate QA testing:
- **Water stress during restriction:** Auto-pause no longer shows useless "Water Field" prompt during watering bans. Sends `water_warning` notification instead. Pause token resets when restriction expires (handles overlapping restrictions correctly).
- **Planting auto-pause guard:** Skips pause when no cells are plantable (includes cover crop eligibility under perennials in fall).
- **Nitrogen advisor:** `maxOccurrences` reduced from 3 to 2 (two lessons is enough).
- **Potash copy fix:** Removed misleading "should last several seasons" — now explains depletion depends on crop type.
- **Water curtailment label:** "Buy Priority Water Access" → "Pay for Reduced Curtailment" with explicit "15 days instead of 60" framing.
- **Perennial age label:** "tree age decline" → "young tree (not yet peak)" for ramp-up phase trees.

**Debug hook gating:** All console debug hooks (`window.__gameDebug`, `window.__playtestLog`, `window.__exportPlaytestLog`) and `game-observer` DOM element gated behind `VITE_ENABLE_DEBUG === 'true'`. Student build (`npm run build`) strips them entirely. Dev server and Playwright tests retain access. See `deploy/DISABLE_DEBUG_HOOKS.md` (gitignored).

## Current Metrics

```
npm test             # 1315 unit tests, all passing (35 test files)
npm run test:browser # 123 Playwright browser tests (all passing; foreshadow natural-flow test may flake under --repeat-each stress)
npm run build        # ~95.49 KB gzipped JS (student), ~97.50 KB (debug), ~6.31 KB CSS
SAVE_VERSION         # '9.0.0'
```

## Architecture Quick Reference

```
src/
  engine/          Pure TS, zero UI deps. All game logic.
    types.ts         GameState root type, Command union, CropInstance, constants
    game.ts          createInitialState, processCommand, simulateTick, harvestCell,
                     getPerennialAgeFactor, getPerennialPhase, executeBulkPlant,
                     executeWater, executeBulkCoverCrop, addNotification, pickMessage
    scoring.ts       computeScore, generateEpilogue, generateCategoryHints,
                     generateAdvisorFarewells, estimateHumanFoodServings
    tech-levels.ts   getTechLevel() reconvergence (water/soil/crop tracks 0-3)
    calendar.ts      Day↔calendar conversion (STARTING_DAY=59 = March 1)
    weather.ts       generateDailyWeather, updateExtremeEvents
    rng.ts           Mulberry32 seeded PRNG
    playtest-log.ts  Opt-in verbose logging for human QA
    events/
      types.ts       Storylet (with advisorId, illustrationId), Condition (19 types),
                     Effect (10 types), Choice, Foreshadowing, ActiveEvent, ActiveEffect
      selector.ts    evaluateEvents — precondition checking, seasonal draw, weighted selection
      effects.ts     applyEffects — processes all Effect types including activate_frost_protection
  adapter/
    signals.ts       Bridges engine↔UI. _liveState → structuredClone → gameState signal
                     Debug hooks: window.__gameDebug (setCash, setDay, setDebt, triggerEvent,
                     setFlag, getState, publish, setScenario, fastForward,
                     getBlockingState, fastForwardUntilBlocked, fastForwardDays,
                     getActionState, selectCell, getNotifications, dismissAllNotifications,
                     setAutoPausePlanting, getPreferences)
    observer.ts      AI agent observer layer: getBlockingState, getActionState,
                     fastForwardUntilBlocked, fastForwardDays, getNotificationsDebug,
                     dismissAllNotificationsDebug
  data/
    crops.ts         9 crop definitions (4 annual + 5 perennial) with yield curves,
                     requiredFlag gating, humanServingsPerUnit
    cover-crops.ts   Cover crop definitions (legume-cover)
    scenarios.ts     5 calibrated climate scenarios with chillHours per year, marketCrashTargetCropId
    events.ts        STORYLETS array (57 storylets: seasonal draw + condition-only,
                     19 with illustrationId for event art)
  save/
    storage.ts       localStorage: auto-save, manual saves, V1→V9 migration chain
  ui/
    components/      Preact components (App, GameScreen, NewGameScreen, TopBar, FarmGrid,
                     FarmCell, SidePanel, CropMenu, AutoPausePanel, EndgamePanel,
                     NotificationBar, ConfirmDialog, Tutorial, EventPanel)
    styles/          CSS Modules
tests/
  engine/            Unit tests: game, weather, calendar, save, rng, events, chill,
                     advisors, perennials, yieldcurve, covercrop, weather-advisor,
                     slice3a1, economy, seasonal-events, balance-harness, tracking,
                     slice5a, slice5b, slice5c, slice5d, observer, scoring,
                     slice6e (31 files)
  engine/balance/    Bot runner + 6 bots + smoke/full balance suites + scenario tests
  browser/           Playwright specs (game.spec.ts — 123 tests)
```

## Key Balance Mechanics

**Economic levers (4c/4d/5d.2):**
1. OM yield penalty: `computeOMYieldFactor()` — yield drops as OM declines (floor=0.40 at OM=0.5%)
2. Water allocation enforcement: `effectiveDose = WATER_DOSE_INCHES × allocation`
3. Nitrogen tightening: N consumed at harvest, mineralization via OM
4. Irrigation cost: $8/cell
5. Annual overhead: $2,000/year
6. Monoculture streak penalty: escalating yield loss for consecutive same annual crop per cell
7. Cover crop OM protection: 50% decomposition reduction (not halt)

**Scoring (6d):**
5 categories: financial (30%), soil (20%), diversity (20%), adaptation (20%), consistency (10%). 4 tiers: Thriving ≥80, Stable ≥60, Struggling ≥40, Failed <40.

**Balance results (5d.2, 75-run smoke suite):**
- Diversified-adaptive: 100% survival, $301K median
- Corn monoculture: 100% survival, $193K median
- Citrus stability: 100% survival, $86K median
- Almond monoculture: 0% survival (establishment cost kills)
- Zero irrigation: 0% survival
- Idle farm: 0% survival (bankrupt Y26-29)

## Open / Deferred Issues

### Known test issue
- Foreshadowing browser test (`game.spec.ts:890`) is flaky (~10% failure rate under `--repeat-each` stress). Non-blocking.

### Open issues (low severity)
- **#47:** Event clustering feels spammy in some seasons. Seasonal caps exist but not per-family mutual exclusion.
- **#70:** Confirm dialog can be overwritten by scripted interaction (automation-only, overlay blocks humans).
- **#83:** Economic tension under-signaled in UI (cash trend, bankruptcy warning).
- **#84:** Crop/water messaging inconsistency (winter wheat "low water" vs. water warnings).
- **#85:** Advisor advice in notification bar feels like background toast.
- **#86:** No guidance after mid-summer harvest leaves nothing plantable.

### Slice 7 design priorities (from 5d.2 playtesting — see KNOWN_ISSUES #92-96, DECISIONS.md)
- **Advisor follow-up panel (MUST-HAVE)** — "Yes, tell me more" choices show central dialog with guidance text, not just notification toast. Reuse advisor panel frame. #92.
- **Potassium agency** — K visibility without levers feels pointless. Either add K fertilizer or make price penalty more visible at harvest so rotation becomes the implicit lever. #93.
- **Avocado unlock timing** — Fires ~Y20, 4-year establishment → too little runway. Move earlier, shorten establishment, or reframe value. #94.
- **Growers Forum recurring content** — Only intro storylet exists. Needs peer rumors, crop failure stories, foreshadowing. #95.
- **Late-game catastrophe/insurance layer** — Successful diversified runs lack drama. Foreshadowed catastrophic events + mitigation options (insurance, mutual aid, crop loss). #96.

### Other deferred features → Slice 7+
- **Corn heat/drought quality penalty** — Needs proper heat stress day tracking (separate from waterStressDays to avoid double-counting with waterFactor)
- **Monoculture pest event chain** — Rootworm, corn rot as foreshadowed storylets connecting to pellagra case study
- **Insurance / credit systems** — Credit rating, variable loan rates, insurance premiums
- **Automation policies** — Replant-same, harvest-when-ready, water-when-dry (beyond auto-irrigation)
- **Glossary / Information Index** — In-game educational reference with progressive disclosure
- **Solar lease event chain** — Multi-phase storylet (option → construction → operations → agrivoltaics)
- **Additional crops** — Table grapes (stretch). Stone Fruit, Opuntia, Guayule unlikely.
- **Zinc nutrient** — Deferred from K-lite implementation
- **Advanced accessibility** — Colorblind modes, full screen reader support

### Art assets
All art assets are present in `public/assets/`:
- `ui/` — title-hero, 4 endgame tier images (thriving/stable/struggling/failed)
- `events/` — 4 event illustrations (heatwave, water-restriction, rootworm, orchard-disease)
- `crops/` — all 9 crops with growth stage variants (including avocado)

See ASSETS.md for full manifest and prompting notes.

## Verification Commands

```bash
npm test             # 1315 unit tests (35 files)
npm run test:browser # 123 Playwright browser tests (builds first; uses VITE_ENABLE_DEBUG=true)
npm run test:all     # All tests in sequence
npm run build        # Student build (~95KB gzipped JS, debug hooks stripped)
npm run test:balance # Balance smoke (75 runs, ~5-8 min)
```

## Deployed
GitHub Pages: https://naddicott-dtech.github.io/ClimateFarmer26/
