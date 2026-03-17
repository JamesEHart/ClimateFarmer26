# ARCHITECTURE.md — Technical Design Document (Draft)

> **Status: Living document. Slices 1-6e complete. Classroom-Ready Build deployed.**
> Cross-references: `reference/SIMULATION_PATTERNS.md`, `reference/BackgroundDeepResearch.md`

## 1. Overview

**ClimateFarmer26** is a browser-based educational simulation game set in California's San Joaquin Valley. Students role-play as farmers over 30 in-game years, making strategic decisions about crops, technology, and land use as climate change reshapes agriculture. The game runs entirely client-side and targets Chromebook hardware.

**Design philosophy:** Small number of well-built *systems* that operate on a large amount of *data*. Adding a new crop or event should require a JSON entry, not new code.

## 2. Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Language | TypeScript (strict mode) | Type safety for complex game state |
| UI Framework | Preact | React API, ~3KB, Chromebook-friendly |
| UI State | Preact Signals (`@preact/signals`) | Lightweight reactivity, no extra library |
| Build Tool | Vite | Fast builds, pairs with Vitest |
| Unit Tests | Vitest | Fast headless TDD for simulation engine |
| Browser Tests | Playwright | Chromium-based, data-testid support |
| CSS | CSS Modules | Scoped, zero runtime cost |
| Hosting | GitHub Pages | Free static hosting |
| Result Reporting | Completion code + Google Sign-In submission *(Slice 6d)* | Authenticated via Google Identity Services |

## 3. Performance Budget

### Target Hardware: 2023 Education Chromebook (~$400)
- **CPU:** Intel N100/N200 or Celeron N4500 (low single-thread performance)
- **RAM:** 4–8 GB total (Chrome OS + browser tabs consume ~2 GB; our game gets ~500 MB–1 GB)
- **Display:** 1366x768 (common) to 1920x1080
- **GPU:** Integrated (Intel UHD or equivalent)
- **Context:** Students likely have 3–5 other tabs open (Google Classroom, Docs, etc.)

### Budgets
| Metric | Target | Hard Limit |
|--------|--------|------------|
| Simulation tick (1 day) | ≤2 ms | ≤4 ms |
| DOM render update | ≤8 ms | ≤16 ms (60fps) |
| Total frame budget | ≤12 ms | ≤33 ms (30fps) |
| JS bundle (gzipped) | ≤100 KB | ≤200 KB |
| Memory (runtime heap) | ≤50 MB | ≤100 MB |
| Initial page load | ≤2 seconds | ≤4 seconds |
| Largest Contentful Paint | ≤1.5 seconds | ≤3 seconds |

### Performance Design Rules
- **2D graphics only.** No WebGL, no 3D rendering. CSS + DOM + optional small canvas overlays for visual effects (weather animations).
- **64-cell grid = 64 DOM elements.** Trivial for any browser. No virtual scrolling needed.
- **Simulation ticks are pure math.** No DOM access, no allocation-heavy operations in the hot path.
- **Batch DOM updates.** Simulation runs N ticks, then UI reads final state once per animation frame.
- **No per-tick object allocation.** Reuse structures. Avoid creating temporary objects in the simulation loop.
- **Decouple sim rate from render rate.** At 4x speed (48 ticks/sec), the engine runs ~2 ticks per frame at 30fps. UI renders once per frame, not per tick.

## 4. Architecture Layers

Following the **State → Systems → Presentation** pattern from proven simulation games (Factorio, Civ IV, RimWorld):

```
┌─────────────────────────────────────┐
│          PRESENTATION (UI)          │  Preact components + CSS Modules
│  Renders state. Emits commands.     │  Knows nothing about game rules.
│  All interactive elements have      │
│  data-testid attributes.            │
├─────────────────────────────────────┤
│          ADAPTER LAYER              │  Preact Signals that expose
│  Bridges engine state → UI state.   │  engine state reactively.
│  Translates UI actions → commands.  │
├─────────────────────────────────────┤
│          SYSTEMS (Engine)           │  Pure TypeScript. Zero DOM deps.
│  Game rules. Processes commands.    │  Fully testable headlessly.
│  Advances simulation ticks.         │  Deterministic with seeded RNG.
│  Evaluates event/storylet triggers. │
├─────────────────────────────────────┤
│          STATE (Data)               │  Plain TypeScript objects/arrays.
│  Farm grid, economy, soil, weather, │  Serializable (for save/load).
│  tech tree, event history.          │  Single source of truth.
├─────────────────────────────────────┤
│          CONTENT (JSON)             │  Crop definitions, event pools,
│  Data files loaded at startup.      │  climate scenarios, advisor
│  No game logic in data files.       │  dialogue, tech descriptions.
└─────────────────────────────────────┘
```

### Key boundary rules:
- **UI → Engine:** Only via Command objects (e.g., `PlantCropCommand`, `BuyTechCommand`). Never direct state mutation.
- **Engine → UI:** Only via readable state (Signals). Engine never touches DOM.
- **Content → Engine:** Engine reads JSON data files. Content files contain parameters, never logic.
- **Engine is headless-testable.** All game logic can run in Vitest without a browser.

## 5. Core Systems

### 5.1 Simulation Clock

The game runs on a **variable-speed tick loop** inspired by Factorio/RimWorld:

- **Internal time unit:** 1 tick = 1 in-game day
- **Speed settings:** Paused (0x), Slow (0.5x), Normal (1x), Fast (2x), Fast-Forward (4x)
- **Target pacing at 1x:** ~1 in-game year per 30 real seconds → ~12 ticks per real second
- **Auto-pause triggers:** Events requiring player decision, empty fields needing planting, advisor interrupts, harvest-ready notifications, critical warnings
- **Manual pause:** Player can pause anytime
- **Headless mode:** Unlimited tick rate (for automated testing)

```
Game Loop (per animation frame):
  1. Calculate how many ticks to simulate this frame (based on speed + elapsed time)
  2. For each tick:
     a. Advance calendar (day → month → season → year)
     b. Run weather system (read from scenario)
     c. Run crop growth system (GDD accumulation, water balance)
     d. Run soil system (nutrient cycling, erosion, OM changes)
     e. Run event selector (check storylet preconditions)
     f. Process automation policies
     g. Run economy system (daily costs like irrigation energy)
     h. Check interrupt conditions (auto-pause triggers)
     i. If interrupt triggered → break, set paused, queue notification
  3. Push final state to UI (Signals update → Preact re-renders)
```

### 5.2 Command System

All player actions flow through a command queue (Command Pattern):

```typescript
// Discriminated union — each command type is fully typed. Adding a new
// command type causes compile errors everywhere it isn't handled yet.
type Command =
  | { type: "PLANT_CROP"; day: number; row: number; col: number; cropId: string }
  | { type: "HARVEST"; day: number; row: number; col: number }
  | { type: "HARVEST_BULK"; day: number; scope: "all" | "row" | "col"; index?: number }
  | { type: "PLANT_BULK"; day: number; scope: "all" | "row" | "col"; index?: number; cropId: string }
  | { type: "WATER"; day: number; scope: "all" | "row" | "col" | "cell"; row?: number; col?: number }
  | { type: "BUY_TECH"; day: number; techId: string; tier: number }
  | { type: "SET_AUTOMATION"; day: number; scope: "cell" | "row" | "col" | "farm"; policy: AutomationPolicy; row?: number; col?: number }
  | { type: "RESPOND_EVENT"; day: number; eventId: string; choiceId: string }
  | { type: "BUY_INSURANCE"; day: number }
  | { type: "TAKE_LOAN"; day: number }
  | { type: "SET_COVER_CROP"; day: number; row: number; col: number; coverCropId: string | null }
  | { type: "SET_SPEED"; day: number; speed: 0 | 0.5 | 1 | 2 | 4 };
```

The engine validates each command before execution (Do you have enough cash? Is the cell empty? Is the tech available?). Invalid commands are rejected with a typed reason. The discriminated union ensures exhaustive handling — the TypeScript compiler flags any unhandled command type.

**Note on scope:** The full discriminated union is defined here for architectural completeness. Slice 1 implements: `PLANT_CROP`, `PLANT_BULK`, `HARVEST`, `HARVEST_BULK`, `WATER`, and `SET_SPEED`. Slice 2 adds: `RESPOND_EVENT`, `TAKE_LOAN` (parameterless — amount is engine-computed), and `REMOVE_CROP`. Slice 3 adds: `SET_COVER_CROP` (single cell) and `SET_COVER_CROP_BULK` (field/row/col scope, DD-1 pattern). Other command variants are added in the slice where their system is built.

**Benefits:**
- **Testability:** Issue a sequence of commands in headless tests to reproduce any game state
- **Determinism:** Same scenario seed + same commands = identical game state (enables automated balance testing)
- **AI test agents:** Headless tests issue commands, not DOM clicks
- **Type safety:** No `unknown` payloads; every command's data is checked at compile time

### 5.3 Climate Scenario System

Climate is **pre-rendered as seasonal parameters, not daily entries.** Each scenario defines 30 years of seasonal climate profiles. The engine generates daily weather deterministically from these parameters using the scenario's seeded RNG. This keeps scenario files small (~5-10 KB each) while producing realistic day-to-day variability.

```typescript
interface ClimateScenario {
  id: string;
  name: string;                        // e.g., "Gradual Warming"
  description: string;                 // post-game reveal
  seed: number;                        // RNG seed for daily weather generation
  years: YearClimate[];                // 30 entries
  metadata: {
    droughtYears: number[];            // for balance testing
    floodYears: number[];
    heatwaveYears: number[];
    severityRating: number;            // 1-5 difficulty
  };
}

interface YearClimate {
  year: number;                        // 1-30
  seasons: {
    spring: SeasonParams;
    summer: SeasonParams;
    fall: SeasonParams;
    winter: SeasonParams;
  };
  events: ScenarioEvent[];            // specific triggered events this year
  chillHours: number;                  // accumulated winter chill (affects perennials)
  waterAllocation: number;             // 0-1 fraction of normal allocation
}

interface SeasonParams {
  avgTempHigh: number;                 // °F
  avgTempLow: number;                  // °F
  tempVariance: number;                // daily deviation range
  precipProbability: number;           // 0-1 chance of rain any given day
  precipIntensity: number;             // inches when it rains
  avgET0: number;                      // reference evapotranspiration
  heatwaveProbability: number;         // 0-1 chance of multi-day heat event
  frostProbability: number;            // 0-1 chance of frost event
  windAvg: number;                     // mph average (for erosion/fire risk)
}
```

**Daily weather generation:** Each tick, the engine generates that day's weather from the current season's parameters using the scenario seed. Same seed + same parameters = identical daily weather on every run. This is how determinism is maintained without storing 10,950 daily entries.

**Data size budget:** 30 years x 4 seasons x ~10 params = ~1,200 numbers + events. At ~10 KB per scenario, 8 scenarios = ~80 KB total. Well within bundle limits. Scenarios can be bundled or lazy-loaded on game start.

**Scenario selection:** On new game, pick randomly from scenarios the student hasn't played recently (tracked in localStorage). Students cannot predict which scenario they'll get.

**Scenario pool for Classroom-Ready Build:** 5 calibrated scenarios required for Slice 4 sign-off (additional scenarios optional for Slice 5+):
1. **Gradual warming** — manageable with adaptation (current "Slice 1 Baseline")
2. **Early severe drought** — tests early-game resilience
3. **Whiplash** — drought-flood-drought cycles
4. **Late-game heat escalation** — manageable early, harsh later
5. **Relatively mild baseline** — allows some students to succeed more easily

**Scenario selection:** Random from recently-unplayed pool (tracked in localStorage). Students cannot predict which scenario they'll get. With 5 scenarios and recently-played exclusion, repeat play is meaningfully less predictable.

**Balance testing:** Full matrix: 5 strategy bots × 5 scenarios × ≥20 seeds = ≥500 headless 30-year runs. See §12 Layer 2 and §12.1 for protocol.

### 5.4 Event / Storylet System

The unified system that drives **narrative events, tech tree progression, advisor appearances, and the solar lease storyline.** Inspired by King of Dragon Pass.

```typescript
interface Storylet {
  id: string;
  type: "climate" | "market" | "tech_unlock" | "advisor" | "solar" | "regulatory";
  preconditions: Condition[];        // ALL must be true to be eligible
  priority: number;                  // higher = more likely to be selected
  cooldownDays: number;              // minimum days before this can fire again
  foreshadowing?: Foreshadowing;     // optional early warning signal
  choices: Choice[];                 // what the player can do
  autoResolve?: Resolution;          // what happens if player ignores / time expires
  tags: string[];                    // for filtering/categorization
}

interface Condition {
  type: "state_check" | "calendar" | "random" | "scenario_trigger";
  // Examples:
  // { type: "state_check", field: "economy.cash", op: "<", value: 10000 }
  // { type: "calendar", season: "spring" }
  // { type: "state_check", field: "farm.cropFailures5yr", op: ">=", value: 2 }
  // { type: "scenario_trigger", eventId: "drought_2031" }
}

interface Foreshadowing {
  signal: string;                    // narrative text shown to player
  daysBeforeEvent: number;           // how far in advance
  reliability: number;               // 0-1; <1 means sometimes a false alarm
  advisorSource?: string;            // which advisor delivers this signal
}

interface Choice {
  id: string;
  label: string;                     // what the player sees
  cost?: number;                     // cash cost
  effects: Effect[];                 // what happens
  unlocks?: string[];                // tech tree nodes revealed
  advisorRecommends?: string;        // which advisor recommends this
}
```

**The event loop each tick:**
1. Gather all storylets whose preconditions are met
2. Remove any on cooldown
3. Check foreshadowing: if an event is N days away and has foreshadowing, emit the signal now
4. If multiple events are eligible, select by priority (with weighted randomness)
5. If selected event requires player input → auto-pause, show event panel
6. If auto-resolve → apply effects silently (or with notification)

**Tech tree integration:** A `tech_unlock` storylet fires when the player encounters a problem (e.g., fruit drop → zinc deficiency). The choices include investment options that reveal new branches. The tech tree VIEW is a retrospective visualization of which `tech_unlock` storylets have fired and how the player responded.

**Solar lease integration:** A multi-storylet chain:
1. `solar_option` — precondition: low cash OR frequent crop failures. The landman offers an option agreement.
2. `solar_proceed` — precondition: solar option accepted AND random chance (permits approved). Construction begins.
3. `solar_operations` — precondition: construction complete. Steady income begins.
4. `solar_agrivoltaics` — precondition: solar operations active AND tech knowledge. Player can negotiate dual-use.

### 5.5 Farm Grid

8x8 grid (64 cells). Each cell has independent state:

```typescript
interface Cell {
  row: number;                       // 0-7
  col: number;                       // 0-7
  crop: CropInstance | null;         // what's planted
  soil: SoilState;                   // nutrients, OM, water
  status: "farmable" | "solar_option" | "solar_construction" | "solar_active";
  coverCropId: string | null;         // off-season choice (Slice 3: 'legume-cover' or null)
  automationPolicy: AutomationPolicy | null; // e.g., "replant_same"
}

interface CropInstance {
  cropId: string;                    // references crop definition JSON
  plantedDay: number;                // when planted
  gddAccumulated: number;           // growth progress
  waterStressDays: number;           // cumulative stress
  nutrientStress: NutrientStress;    // N, K, Zn deficiency tracking
  growthStage: "seedling" | "vegetative" | "flowering" | "mature" | "harvestable" | "overripe";
  isPerennial: boolean;
  perennialAge?: number;             // years since establishment
  perennialEstablished?: boolean;    // producing fruit yet?
}

interface SoilState {
  nitrogen: number;                  // lbs/acre equivalent
  potassium: number;                 // lbs/acre equivalent
  zinc: number;                      // ppm equivalent (micronutrient)
  organicMatter: number;             // percentage (affects water retention + nutrient release)
  moisture: number;                  // current water level
  moistureCapacity: number;          // max water (function of OM)
  erosionRisk: number;               // 0-1 based on cover and practices
}
```

**Bulk operations:** "Plant All," "Plant Row N," "Plant Column N," "Harvest All," "Water All," and equivalents. Each translates to multiple commands issued atomically.

### 5.6 Nutrient & Soil System

Nutrient model with progressive disclosure gated by tech investment:

| Nutrient | Role | Implemented | Visibility | Impact |
|----------|------|-------------|------------|--------|
| **Nitrogen (N)** | Yield volume ("gas pedal") | Slice 1 (full simulation) | Always visible | Yield penalty when depleted |
| **Potassium (K)** | Quality/defense | Slice 5 (K-lite) | Hidden until `tech_soil_testing`; **symptom cues always visible** | Price/quality penalty (max 30%), affects ALL players |
| **Zinc (Zn)** | Critical checkpoint (fruit set) | Deferred (Slice 6+) | — | — |

**K-lite design principle:** K depletion affects ALL players equally — soil testing reveals the CAUSE and enables targeted management, but "head in the sand" is NOT a winning strategy. Players without soil testing get ambiguous symptom cues ("leaf edges look stressed," "harvest quality seems lower than expected") and price penalties. Soil testing reveals K levels numerically and unlocks precision fertilization options.

**Daily soil update per cell (currently implemented):**
```
N(t+1) = N(t) + legume_fixation + OM_mineralization - crop_uptake
K(t+1) = K(t) + OM_K_mineralization - crop_removal     (Slice 5: slower cycling than N)
OM(t+1) = OM(t) + residue_input - decomposition_rate * OM(t)
moisture(t+1) = moisture(t) + irrigation + rain - ET - drainage
moistureCapacity = base_capacity + OM_bonus             (per 1% OM ≈ +0.8in)
```

**Over-application consequences (deferred):** Excess N → regulatory fine event (nitrate leaching). Deferred to Slice 6+ with regulatory compliance system.

### 5.7 Crop System

Crops are **data-driven definitions** loaded from JSON. The engine processes them generically:

```typescript
interface CropDefinition {
  id: string;
  name: string;
  type: "annual" | "perennial";
  category: "current" | "future";

  // Growth
  gddBase: number;                   // base temperature (°F)
  gddToMaturity: number;             // GDD sum needed
  plantingWindow: { startMonth: number; endMonth: number };
  harvestWindow?: { startMonth: number; endMonth: number };

  // Water
  waterUsePerDay: number;            // inches (at full Kc)
  cropCoefficients: { stage: string; kc: number }[];
  ky: number;                        // yield response to water stress

  // Nutrients
  nitrogenUptake: number;            // lbs/acre at full yield
  potassiumUptake: number;
  zincSensitivity: number;           // 0-1; higher = more vulnerable to Zn deficiency

  // Economics
  yieldPotential: number;
  yieldUnit: string;
  basePrice: number;
  priceVolatility: number;           // 0-1
  laborHoursPerAcre: number;
  seedCostPerAcre: number;

  // Perennial-specific
  yearsToEstablish?: number;
  productiveLifespan?: number;
  removalCost?: number;
  chillHoursRequired?: number;
  yieldCurve?: {                       // Slice 3: age-based yield factor
    rampUpYears: number;               // years post-establishment to reach peak (3)
    declineStartYear: number;          // years post-establishment when decline begins
    endOfLifeYear: number;             // years post-establishment when floor is reached
    declineFloor: number;              // minimum yield fraction (0.2)
  };

  // Cover crop interactions
  canDoubleCrop?: boolean;
  doubleCropWith?: string[];         // crop IDs that can follow this

  // Descriptions (for Glossary)
  shortDescription: string;
  glossaryEntry: string;             // detailed educational content
  realWorldNotes: string;            // ties to actual CA agriculture
}
```

**Yield calculation at harvest:**
```
baseYield = yieldPotential
waterFactor = 1 - ky * (1 - ETactual/ETfull)
nitrogenFactor = min(1, soilN / nitrogenUptake)
potassiumFactor = min(1, soilK / potassiumUptake)  // affects quality/price, not volume
zincFactor = if soilZn < threshold AND flowering → catastrophic loss (0.1-0.3)
             else 1.0
climateFactor = heatStressPenalty * frostPenalty * smokeePenalty

ageFactor = getPerennialAgeFactor(crop, cropDef)  // Slice 3: ramp→peak→decline
actualYield = baseYield * waterFactor * nitrogenFactor * zincFactor * climateFactor * ageFactor
actualPrice = basePrice * potassiumFactor * marketConditions
revenue = actualYield * actualPrice
```

### 5.8 Economy System

```typescript
interface EconomyState {
  cash: number;
  debt: number;
  creditRating: number;              // affects loan terms; degrades with missed payments
  insurancePremiumRate: number;      // increases with claims history
  insuranceActive: boolean;
  loanInterestRate: number;          // function of credit rating
  totalClaimsHistory: number;        // affects insurability
  yearlyRevenue: number;             // tracking
  yearlyExpenses: number;            // tracking
}
```

**Bankruptcy (Slice 2):** Cash ≤ $0.
- **First insolvency:** Bank offers one emergency loan (fixed 10% annual interest, parameterless TAKE_LOAN — amount engine-computed). Auto-repayment: 20% of gross harvest revenue per cell at harvest time.
- **Second insolvency OR debt > $100k:** Hard game over.
- **Graceful end:** Reach year 30 → retirement event with final score.

**Implementation note (current through Slice 4):** The actual EconomyState in `types.ts` has: `cash`, `debt`, `totalLoansReceived` (0 or 1), `interestPaidThisYear`, `yearlyRevenue`, `yearlyExpenses`. Fields like `creditRating`, `insurancePremiumRate`, `insuranceActive` are aspirational design — deferred to Slice 6+. The interface shown above represents the full target, not current implementation.

**Insurance (deferred to Slice 6+):** Premium rate increases with claim history. After too many claims, insurance becomes unavailable ("uninsurable"). Not in scope for Slices 1-5.

### 5.9 Advisor System

4 advisor characters, each a made-up person with a real-world-grounded role:

| Advisor | Role | Reliability | Trigger Pattern | Status |
|---------|------|-------------|-----------------|--------|
| Dr. Maria Santos (County Extension Agent) | Crops, soil, tech recommendations | High (almost always correct) | Soil health drops, crop failures, new tech available | Slice 2c: 5 storylets implemented |
| NWS Fresno (Weather Service) | Forecasts, extreme event warnings | Medium (sometimes wrong — false alarms) | Seasonal forecasts, approaching events | Slice 3c: 3 storylets (heat forecast, frost alert, drought outlook) |
| Marcus Chen (Valley Farm Credit) | ROI, cash flow, profit maximization | High for facts, debatable for strategy. Blind spot: long-term risk | Financial stress, tech decisions, high cash, crop strategy | Slice 5: competing advisor for tech decisions |
| Valley Growers Forum | Tips, market gossip, anecdotes, novel crop rumors | Low-Medium (sometimes wrong, occasionally visionary) | Random/periodic, market rumors, novel approaches, community trends | Slice 5: wild-card advisor, source of unconventional ideas |

Advisors appear as **game-pausing overlay panels** with character portrait, dialogue, and 2–3 choices. Advisor appearances are storylets in the event system — same mechanism, tagged as `type: "advisor"`. Each advisor has a unique `advisorId` on its storylets for UI character routing (Slice 3c).

### 5.10 Glossary / Information Index

An in-game reference that students can open at any time (pauses game while reading):

- **Hyperlinked from game UI:** Crop names, nutrient indicators, event descriptions, tech items all link to glossary entries.
- **Content:** Educational explanations of farming concepts, ecology, climate science, economics. Written in student-friendly language with real-world context.
- **Structure:** Alphabetical + categorized (Crops, Soil & Nutrients, Climate, Technology, Economics).
- **Progressive disclosure:** Glossary entries for tech/crops the student hasn't encountered yet are hidden or grayed out (matches fog-of-war tech tree).
- **Data-driven:** Glossary content lives in JSON alongside the game content it describes.

### 5.11 Automation System

Players can set **policies** per cell, row, column, or whole farm:

```typescript
interface AutomationPolicy {
  action: "replant_same" | "replant_crop" | "harvest_when_ready" | "water_when_dry" | "apply_cover_crop";
  cropId?: string;                   // for "replant_crop"
  coverCropId?: string;              // for "apply_cover_crop"
  threshold?: number;                // for "water_when_dry" — soil moisture trigger
}
```

Automations execute during normal/fast-forward time without pausing. They generate commands that the engine validates normally (sufficient cash, crop available, etc.). If an automation fails (not enough cash to replant), it fires a notification.

**Early game:** Limited automation available (forces manual learning).
**Late game:** Full automation unlocked through tech tree events, enabling fast-forward play.

### 5.12 Save / Resume

Game state is serialized to **localStorage** as JSON. No command log is stored (undo/rewind is not supported — this keeps saves small and predictable).

```typescript
interface SaveGame {
  version: string;                   // schema version for migration
  scenarioId: string;                // which climate scenario
  currentDay: number;                // in-game day (0–10949)
  farmGrid: CellSnapshot[];         // 64 cells: crop, soil, status
  economy: EconomyState;            // cash, debt, credit, insurance
  techTree: TechNodeSnapshot[];     // discovered/purchased nodes
  advisorLog: AdvisorLogEntry[];    // key advisor interactions (for retrospective)
  eventsOccurred: string[];         // IDs of past events (prevent repeats)
  eventsInProgress: EventProgress[];// multi-phase events (e.g., solar lease)
  recentScenarios: string[];        // IDs of recently played scenarios
  playerId: string;                 // teacher-assigned ID or chosen nickname (see Privacy)
  timestamp: number;                // real-world save time
}
```

**localStorage budget:**
- Chrome/ChromeOS limit: ~5–10 MB per origin
- Estimated save size: ~20–30 KB (64 cells x ~200 bytes + economy/tech/events ~5 KB + metadata)
- At 30 KB per save, we could store ~150+ saves before hitting limits
- Auto-save keeps only the latest auto-save (overwrites each season); manual saves are separate slots
- If localStorage is unavailable or full, warn the player and offer to export save as a downloadable JSON file

**Auto-save:** Every season transition (4x per year), overwriting the previous auto-save.
**Manual save:** Player can save to named slots. Limit to 3 manual slots.
**Resume:** On page load, detect existing save and offer to continue or start new game.
**Completion code** *(Slice 6d — implemented)*: Human-readable code generated at year 30 or bankruptcy. Format: `PREFIX-SCORE-YYEARS-SCENARIO` (e.g., `NEAL-78-Y30-GW`). Screenshot-friendly backup. Authenticated submission via Google Identity Services for @dtechhs.org accounts.

## 6. Data Files Structure

Game content lives in data modules under `src/data/`:

**Current implementation (Slice 3):**
```
src/data/
  crops.ts          # 9 crop definitions (4 annual + 5 perennial)
  cover-crops.ts    # Cover crop definitions (Slice 3b)
  scenarios.ts      # 5 calibrated climate scenarios with chillHours, marketCrashTargetCropId
  events.ts         # STORYLETS array (57 storylets: seasonal draw + condition-only advisors/tech/regime)
```

All content is defined as typed TypeScript constants, validated at compile time by `tsc --strict`. This provides the data-driven benefits (adding content = editing data, not engine logic) with compile-time type safety.

**Future target (Slice 5+):** As content grows beyond the Slice 4 baseline (12+ crops, scenarios beyond the 5 required, tech tree, glossary), consider migrating to JSON files with Zod runtime validation. Proposed structure:

```
data/
  crops/
    current.json        # 7 current San Joaquin Valley crops
    future.json         # 5 future/adaptive crops
    cover-crops.json    # cover crop options
  scenarios/
    gradual-warming.json
    early-drought.json
    whiplash.json
    late-escalation.json
    mild.json
  events/
    climate-events.json
    market-events.json
    tech-unlock-events.json
    advisor-events.json
    solar-lease-chain.json
    regulatory-events.json
  advisors/
    characters.json     # advisor names, portraits, personalities
  glossary/
    entries.json        # educational content
  economy/
    base-costs.json     # seed, labor, water, equipment costs
    tech-costs.json     # prices for upgrades/investments
```

Migration to JSON is optional — the current TS approach works well and provides stronger guarantees. Revisit when content volume makes it worthwhile (e.g., if teachers need to edit content without touching TypeScript).

## 7. UI Layout (Conceptual)

```
┌─────────────────────────────────────────────────────┐
│ [Season Icon] March Year 3    [⏸ ▶ ▶▶ ▶▶▶]  $42,300│  ← Top Bar
│ Upcoming: Corn harvest (2 weeks) | Advisor tip avail │
├──────────────────────────┬──────────────────────────┤
│                          │  [Soil Health] ████░░ 67 │  ← Side Panel
│   ┌──┬──┬──┬──┬──┬──┬──┬──┐  │  [Water Supply] ███████ 89│
│   │🌽│🌽│🌽│🌽│🍅│🍅│🍅│🍅│  │  [N] ██████░░ 72          │
│   ├──┼──┼──┼──┼──┼──┼──┼──┤  │  [K] █████░░░ 58          │
│   │🌽│🌽│🌽│🌽│🍅│🍅│🍅│🍅│  │  [Zn] ??? (no monitoring)│
│   ├──┼──┼──┼──┼──┼──┼──┼──┤  │                          │
│   │🌾│🌾│🌾│🌾│░░│░░│░░│░░│  │  ──── Advisors ────      │
│   ├──┼──┼──┼──┼──┼──┼──┼──┤  │  💬 Extension Agent (1)   │
│   │🌾│🌾│🌾│🌾│░░│░░│░░│░░│  │                          │
│   ├──┼──┼──┼──┼──┼──┼──┼──┤  │  ──── Actions ────       │
│   │🌰│🌰│🌰│🌰│🌰│🌰│🌰│🌰│  │  [Plant...] [Harvest All]│
│   ├──┼──┼──┼──┼──┼──┼──┼──┤  │  [Water All] [Tech Tree]  │
│   │🌰│🌰│🌰│🌰│🌰│🌰│🌰│🌰│  │  [Glossary] [Save]       │
│   ├──┼──┼──┼──┼──┼──┼──┼──┤  │                          │
│   │🌰│🌰│🌰│🌰│🌰│🌰│🌰│🌰│  │  ──── Selected Cell ──── │
│   └──┴──┴──┴──┴──┴──┴──┴──┘  │  Row 5, Col 3: Almonds   │
│          8x8 Farm Grid       │  Year 4/25, Producing     │
│                              │  Growth: ████████ 100%    │
│                              │  Soil N: 45  K: 62  Zn: ? │
├──────────────────────────────┴──────────────────────────┤
│ 📰 "Your tomato leaves look a bit pale this season."    │  ← Notification Bar
│    [Learn more →]  [Dismiss]                            │
└─────────────────────────────────────────────────────────┘
```

All grid cells, buttons, panels, and interactive elements have `data-testid` attributes.

## 8. Crop Roster (Classroom-Ready Build)

### Current San Joaquin Valley Crops
| Crop | Type | Strategic Role | Key Mechanic | Status |
|------|------|---------------|-------------|--------|
| Processing Tomatoes | Annual | High-value, heavy N feeder | Rotation essential; depletes soil fast | Slice 1 |
| Silage Corn | Annual | Reliable feed crop | Can double-crop with winter forage | Slice 1 |
| Winter Wheat | Annual | Low-value, low-maintenance | Winter crop; rotation partner | Slice 1 |
| Sorghum | Annual | Drought-tolerant survival crop | ky=0.50 (half of tomatoes); $660/acre | Slice 3a1 |
| Almonds | Perennial | Current king, highest value | Water-intensive; needs chill hours (declining with climate) | Slice 2b |
| Pistachios | Perennial | Climate-adapted nut | Salt/drought tolerant; the natural replacement for almonds | Slice 2b |
| Citrus (Navels) | Perennial | Stable, moderate value, never declines | Evergreen (no dormancy, no chill hours); $4,900/acre | Slice 3a1 |
| Grapes | Perennial | High-value, versatile | Heat-sensitive >105°F; smoke taint risk from wildfires | Deferred |
| Stone Fruit (Peaches) | Perennial | High value, high labor | Needs chill hours; labor-intensive harvest | Deferred |

### Future / Adaptive Crops (unlocked via tech tree events)
| Crop | Type | Strategic Role | Unlock Trigger |
|------|------|---------------|---------------|
| Agave | Perennial | Ultra-drought-tolerant | Severe drought + extension agent recommendation |
| Heat-tolerant Avocados | Perennial | High-value subtropical | Temperature trend crosses threshold + market event |
| Opuntia (Prickly Pear) | Perennial | Multi-use desert crop | Drought conditions + community tip |
| Winter Wheat/Triticale | Annual | Dryland fallback | Water allocation cut + extension agent |
| Guayule | Perennial | Low-water industrial (rubber) | Multiple water crises + research investment |

### Cover Crops / Off-Season Strategies

**Slice 3b implements:** Legume cover (Clover/Vetch mix) with fall-only planting window and spring auto-incorporate.

| Option | N Effect | OM Effect | Moisture Effect | Winter ET | Cost | Status |
|--------|----------|-----------|-----------------|-----------|------|--------|
| Legume cover (Clover/Vetch) | +50 lbs/ac | +0.10% | -0.5in at incorporate | 0.2× (replaces bare 0.3×) | $30/plot | Slice 3b |
| Bare / clean cultivation | none | -decomposition | none | 0.3× (bare soil) | free | Default |
| Mustard | neutral | +0.05% | TBD | TBD | TBD | Deferred |
| Resident vegetation | neutral | +0.03% | TBD | TBD | free | Deferred |

**Cover crop lifecycle:** Plant in fall (months 9-11) → grows over winter (halts OM decomposition) → auto-incorporated at winter→spring transition (applies N + OM bonuses, moisture drawdown).

**Eligible cells:** Empty cells OR deciduous perennials (crops with `dormantSeasons` defined — almonds, pistachios). Evergreen perennials (citrus — no `dormantSeasons`) are rejected. Deciduous perennials are eligible throughout the fall planting window, not only when dormant.

**ET rules with cover crops:**
```
empty + no cover    → ET = et0 × 0.3  (bare soil)
empty + cover       → ET = et0 × 0.2  (cover replaces bare)
crop + no cover     → ET = et0 × getCropCoefficient(crop)
crop + cover        → ET = et0 × max(getCropCoefficient(crop), 0.2)
dormant + cover     → ET = et0 × max(0.2, 0.2) = 0.2
```

### Perennial Yield Curves (Slice 3a2)

**3-phase piecewise-linear curve:**
```
Phase 1: Establishing (age < yearsToEstablish) → yield = 0
Phase 2: Ramp (rampUpYears post-establishment) → 0.6 → 0.8 → 1.0
Phase 3: Peak → yield = 1.0
Phase 4: Decline (linear to floor) → 1.0 → declineFloor
Phase 5: Past lifespan → yield = declineFloor
```

**Locked formula (getPerennialAgeFactor):**
```
yp = perennialAge - yearsToEstablish   // productive years
if yp < rampUpYears:
  if rampUpYears <= 1: return 1.0
  return 0.6 + 0.4 × (yp / (rampUpYears - 1))
if yp < declineStartYear: return 1.0
if yp >= endOfLifeYear: return declineFloor
return 1.0 - (1.0 - declineFloor) × ((yp - declineStartYear) / (endOfLifeYear - declineStartYear))
```

**Crop curve data:**
| Crop | rampUpYears | declineStartYear | endOfLifeYear | declineFloor |
|------|-------------|------------------|---------------|-------------|
| Almonds | 3 | 15 | 22 | 0.2 |
| Pistachios | 3 | 17 | 25 | 0.2 |
| Citrus | 3 | 28 | 35 | 0.3 |

## 9. Key Design Patterns Applied

| Pattern | From | How We Use It |
|---------|------|--------------|
| **Data-Driven Design** | Civ IV, RimWorld, Factorio | All crops, events, advisors, techs defined in JSON. Engine is generic. |
| **Command Pattern** | StarCraft, Factorio | All player actions are command objects. Enables testing, deterministic runs, and type-safe validation. |
| **Deterministic Simulation** | Factorio | Seeded RNG. Same scenario + same commands = identical result. |
| **Storylet System** | King of Dragon Pass, Crusader Kings | Events, tech unlocks, advisors all use the same precondition-based selection system. |
| **Layered Architecture** | All major sims | State → Systems → Presentation with strict boundaries. |
| **Fog of War (Tech Tree)** | 4X games | Students don't see the full tech tree. Problems reveal branches. Retrospective view fills in over time. |

## 10. Privacy & Student Data

### Principle: Minimize data collection. No PII required by the app.

- **Player identity:** Students enter a "Player ID" — a teacher-assigned code (e.g., "Period3-14") or a self-chosen nickname. **Real names are never required.** The field label should say "Player ID" not "Name." However, **students may still enter identifiable information** (e.g., their actual name as a nickname). The app cannot prevent this, so teachers should instruct students to use assigned codes.
- **localStorage:** All save data stays on the student's device. Nothing is transmitted unless the student voluntarily signs in with Google and clicks "Submit Results."
- **Completion code** *(Slice 6d — implemented)*: Contains Player ID, score, years survived, and scenario ID. Human-readable format for screenshots as backup.
- **Google Sign-In submission** *(Slice 6d — implemented)*: Students authenticate via Google Identity Services (@dtechhs.org domain). Results POST to teacher's backend spreadsheet. The student initiates submission — it's their action to sign in and click submit. Our app never collects or stores real names.
- **No analytics, no tracking, no cookies** beyond localStorage for save data.
- **Regulatory note:** This app is *designed* to avoid collecting PII: it requires no accounts, stores data only on-device, and transmits nothing without explicit student action. However, **we do not assert legal compliance with COPPA, FERPA, or any other regulation.** Schools deploying this should review it under their own data governance policies. Neal should consult with his school's IT/privacy office before classroom use if required by district policy.

## 11. `data-testid` Naming Convention

All interactive DOM elements get `data-testid` attributes following this standard:

**Format:** `{area}-{element}-{qualifier}` in kebab-case.

| Area | Examples |
|------|---------|
| `farm` | `farm-cell-3-7`, `farm-grid`, `farm-row-header-3` |
| `action` | `action-plant-all`, `action-harvest-row-2`, `action-water-all` |
| `speed` | `speed-toggle`, `speed-fast`, `speed-fastest` |
| `topbar` | `topbar-date`, `topbar-cash`, `topbar-season-icon` |
| `sidebar` | `sidebar-soil-n`, `sidebar-soil-k`, `sidebar-water-supply` |
| `advisor` | `advisor-panel-extension`, `advisor-choice-1`, `advisor-dismiss` |
| `event` | `event-panel`, `event-choice-accept`, `event-choice-decline` |
| `glossary` | `glossary-open`, `glossary-entry-nitrogen`, `glossary-close` |
| `menu` | `menu-crop-tomatoes`, `menu-crop-almonds`, `menu-cancel` |
| `save` | `save-button`, `save-slot-1`, `save-resume`, `save-new-game` |
| `tech` | `tech-tree-view`, `tech-node-drip-irrigation` |
| `notify` | `notify-bar`, `notify-dismiss`, `notify-learn-more` |

**Rules:**
- Grid cells use `farm-cell-{row}-{col}` (zero-indexed).
- Crop-specific buttons use the crop's JSON `id` as qualifier.
- All test IDs must be stable across sessions (no generated/random IDs).
- A tester reading the IDs should understand the UI without seeing it.

## 12. Testing Strategy

### Layer 1: Engine Unit Tests (Vitest — fast, headless)
- Crop growth math: "Corn planted day 100 with daily GDD=20 reaches maturity by day 240"
- Water balance: "Field with 2in moisture, 0.2in ET, no rain → 1.8in moisture next day"
- Nutrient cycling: "Tomato crop removes 200lbs N; soil N drops from 250 to 50"
- Economy: "Harvesting 100 bu sorghum at $6 on 4 cells adds $2,400 to cash"
- Event preconditions: "Storylet with condition cash<5000 fires when cash is 4999, not when 5001"
- Command validation: "PlantCrop command rejected when cell is occupied"
- Determinism: "Two runs with same seed + same commands produce identical state at day 1000"

### Layer 2: Scenario Balance Tests (Vitest — headless, automated strategies)

Automated headless tests that run full 30-year games with scripted strategies. These validate that the economy produces the right difficulty curve: bad strategies fail, good strategies succeed, and luck doesn't dominate.

**Required strategy bots (minimum 5):**

| Bot Name | Behavior | Expected Outcome |
|----------|----------|-----------------|
| `almond-monoculture` | Plant 64 almonds ASAP, water when prompted, no other actions | ≤40% survival; median cash below $50k |
| `corn-monoculture` | Plant 64 corn every spring, water once per season | ≤60% survival; modest or bankrupt |
| `zero-irrigation` | Plant annual mix, never water | ≤20% survival; bankrupt by year 10 |
| `diversified-adaptive` | Mixed crops, rotates based on conditions, uses cover crops, heeds advisor events | ≥80% survival; median cash well above $50k |
| `citrus-stability` | All citrus, consistent watering | 60-80% survival; moderate cash |

**Required test matrix:**
- Each strategy bot runs against **every scenario** in the pool
- Each strategy × scenario combination runs with **≥20 different RNG seeds**
- Results aggregated as: survival rate, median final cash, p10 final cash, median bankruptcy year (if applicable)

**Pass/fail metrics (all must pass before classroom deployment):**
- Monoculture bots survive ≤40-60% of runs (per archetype targets in SPEC.md §30.1)
- Diversified-adaptive bot survives ≥80% of runs
- Diversified-adaptive bot has **0% bankruptcy rate** across all seeds and scenarios (no unwinnable seeds)
- **Same-seed dominance**: for every seed where a monoculture bot survives, the diversified-adaptive bot with the same seed must also survive
- ≥3 distinct strategy families complete 30 years with positive cash in ≥60% of runs
- No scenario is unwinnable (every scenario has at least one strategy with ≥60% survival)
- Variance within a strategy: p25-to-p75 cash spread is <2× (luck doesn't dominate)
- Soil pedagogy: monoculture without cover crops shows ≥20% yield decline by year 15; cover crop users maintain OM ≥ 1.5%

**Statistical requirements:**
- All balance assertions use **median and p10**, not single-run or best-case
- Seed selection: sequential integers starting from 1 (deterministic, reproducible)
- Strategy bots issue commands via `processCommand()` — same validation path as real players

### Layer 3: Browser Integration Tests (Playwright — Chromium)
- "Click cell (3,4) → Plant menu appears with available crops"
- "Click 'Plant All' with corn selected → all 64 cells show corn indicator"
- "Speed set to 4x → calendar advances visibly → auto-pauses on event"
- "Glossary link on 'Nitrogen' opens glossary panel; game is paused"
- "Save game, reload page, resume → game state matches"
- "Complete 30-year game → completion code generated → Google Sign-In submission works"

### Layer 4: Performance Tests (Vitest + Playwright)
- "Simulation tick completes in <4ms on reference hardware"
- "64-cell DOM update completes in <16ms"
- "Running at 4x speed maintains 30fps"
- "Page load to interactive in <4 seconds on throttled connection"

### Layer 5: Playability Tests (Manual / AI Agent)
- "A student can complete one in-game year without instructor rescue"
- "All routine operations (plant, harvest, water) achievable in ≤3 clicks"
- "Every event explains what happened and why in plain language"
- "Every advisor recommendation is traceable in retrospect"

## 12.1 Balance-Tuning Protocol

Balance tuning follows a strict sequence. No hand-tuning. No "it feels about right." Data in, decisions out.

### Prerequisites
1. Layer 2 balance test suite is fully implemented and running
2. All 5 strategy bots produce reproducible results across ≥20 seeds
3. Baseline metrics are recorded (current economy, pre-tuning)

### Tuning Cycle
1. **Run full matrix** — all bots × all scenarios × all seeds. Record survival rates, median cash, p10 cash, bankruptcy timing.
2. **Identify failing metrics** — compare results to targets in SPEC.md §30.1. Document which archetypes are too easy or too hard.
3. **Adjust ONE parameter category** — pick the lever most likely to fix the largest gap. Categories:
   - Crop economics (revenue, costs, maintenance)
   - Climate severity (drought ramp, water allocation curve, chill hour decline)
   - Event impacts (cost magnitudes, duration, frequency)
   - Soil dynamics (OM decay rate, nitrogen depletion, yield penalty thresholds)
   - New mechanics (monoculture pest pressure, escalating maintenance)
4. **Rerun full matrix** — verify the change moved metrics in the right direction without breaking other archetypes.
5. **Repeat** until all pass/fail metrics are green.

### Rules
- Never tune more than one category per cycle (isolate cause and effect)
- Never tune without rerunning the full matrix afterward
- If a change fixes one archetype but breaks another, revert and find a different lever
- Document every parameter change and its measured impact in DECISIONS.md
- The tuning protocol itself is tested: changing a single parameter should produce a measurably different outcome in the balance suite

### Scenario Calibration
- **5 calibrated scenarios required for Slice 4 sign-off** (see §5.3 for the five scenario types)
- Calibrate the current scenario ("Gradual Warming") first, then add and calibrate the remaining four
- Each new scenario is calibrated against the full bot matrix before sign-off
- Every scenario must have at least one strategy family with ≥60% survival (no unwinnable scenarios)
- Scenario difficulty must vary: the "Relatively Mild" scenario should have ≥3 strategy families surviving; the "Early Severe Drought" should have ≤2 strategy families surviving easily
- Full sign-off matrix: 5 bots × 5 scenarios × ≥20 seeds = ≥500 runs, all pass/fail metrics green

## 13. Development Slicing (Proposed)

The full architecture above describes the complete Classroom-Ready Build. Development should proceed in vertical slices, each fully working and testable before the next begins. **No slice ships with stubs.**

### Slice 1: Core Farm Loop
The thinnest playable game. A student can plant crops, watch them grow, harvest, and see money change. Time flows. Weather matters.

**Includes:**
- 8x8 grid with bulk operations (plant all/row/col, harvest all/row/col, water all/row/col)
- 3 annual crops only (Processing Tomatoes, Silage Corn, Winter Wheat)
- Time controls (pause, 1x, 2x, 4x) with calendar display
- Daily simulation: weather from 1 scenario, GDD accumulation, water balance
- Nitrogen tracking (single nutrient — the most visible and educational)
- Simple economy: cash, planting costs, harvest revenue, irrigation costs
- Basic UI: grid, top bar, side panel, cell detail, notification bar
- Save/resume (localStorage)
- All data-testid attributes in place
- Baseline accessibility: all controls keyboard-navigable (Tab/Enter/Space), ARIA labels on interactive elements, visible focus indicators. This is a classroom product — accessibility is baked in from the start, not bolted on later.
- 3-step tooltip tutorial with Skip + Don't show again (see SPEC.md DD-3)
- Auto-pause system: harvest ready, water stress, bankruptcy, year-end (see SPEC.md §3.6)
- Overripe crop lifecycle: 30-day grace period with linear yield decay (see SPEC.md DD-4)
- Full engine unit tests + Playwright browser tests

**Does NOT include:** Events, advisors, tech tree, perennials, automation, glossary, solar lease, K/Zn nutrients, cover crops, completion code. These are not stubbed — they simply don't exist yet. *(All except glossary, solar lease, Zn, and completion code are now implemented in Slices 2-5.)*

**Acceptance gate:** A student can play through 5 in-game years, planting and harvesting annual crops, and their cash balance reflects realistic costs/revenues. Save/resume works. All controls are keyboard-accessible. All tests pass. Runs at 30fps on Chromebook.

### Slice 2: Events, Perennials, Loans & Advisor ✅ COMPLETE
The game becomes strategic. Things happen that require decisions. Long-term investments become possible. First advisor provides educational guidance.

**Delivered:** Storylet/event engine + foreshadowing + 1 advisor (extension agent, 5 storylets) + perennial crops (almonds, pistachios) + 3 climate events + emergency loan + chill-hour tracking (fog-of-war reveal) + save migration (V1→V2→V3). 300 unit tests, 65 browser tests, 32.38KB gzipped.

**Deferred to Slice 3:** Stretch events (tomato market surge, groundwater pumping ban), tech tree, remaining advisors, insurance, credit systems, perennial decline phase, age-based yield curve, K+Zn nutrients, cover crops, additional crops and scenarios.

**Sub-sliced as:** 2a (event engine + loans + 3 events) → 2b (perennials) → 2c (advisor + chill hours). Each independently reviewed.

### Slice 3: Depth & Discovery ← COMPLETE
Adaptation tradeoffs, perennial lifecycle, cover crop system, and weather advisor.

**Sub-slices:**
- 3a1: Stretch events (tomato surge, pumping ban) + 2 new crops (sorghum, citrus navels) + citrus harvest cadence fix
- 3a2: Perennial yield curves (ramp→peak→decline) + decline advisor + phase UI
- 3b: Cover crop system (legume + bare, fall planting, spring auto-incorporate) + V3→V4 save migration
- 3c: Weather Service advisor (NWS Fresno, 3 storylets) + frost protection mechanism + advisor UI routing

**Explicitly deferred to Slice 5+:** Tech tree, K+Zn nutrients, insurance/credit expansion, remaining advisors (Financial, Community), automation policies. Multi-scenario resolved in Slice 4a (5 scenarios).

### Slice 4: Balance, Scoring & Classroom Readiness (Complete)
Everything needed to hand this to students with confidence.

**4a — Balance Testing Infrastructure:** Headless strategy bot framework (5 bots: monoculture-corn, monoculture-almond, idle, diversified-adaptive, zero-irrigation). 5 calibrated climate scenarios in `scenarios.ts`. Full test matrix: 5 bots × 5 scenarios × 20 seeds = 500 headless 30-year runs. Save migration V4→V5.

**4b + 4b.5 — Event System Refactor:** Seasonal draw semantics (8 random-gated events drawn once per season). Stress-modulated probability. Family caps (max 1 per type per season). 6 condition-only advisors remain per-tick. Save migration V5→V6.

**4c — Economic Rebalancing:** Four levers (OM yield penalty, water allocation enforcement, nitrogen tightening, irrigation cost increase). Data-driven from balance test results.

**4d — Annual Overhead:** $2,000/year overhead. Corn monoculture ~69% survival (risky), diversified 100%, idle 0%.

**4e — Classroom UX Clarity Pass:** Water warning double-gate fix (#52), year-end expense breakdown (#53), notification backlog fix (#61), perennial onboarding warning (#71), running net P/L in TopBar (#73), crop art overhaul (#74), play prompt (#50), continue button integrity (#67), autosave sync (#68), new game confirm guard (#69). Save migration V6→V7.

**Stabilization:** TopBar CSS Grid layout (#78), perennial harvest UI fix (#79).

### Slice 5: Adapt or Fail (Complete)
Strategic depth, competing advisors, tech branching, and climate escalation. Transforms strategic flatness into genuine decision-making.

**Sub-slices:**
- 5a: System extensions ✅ — New condition types (19 total), `getTechLevel()` reconvergence (3 tracks: water/soil/crop), K-lite potassium (per-cell depletion + price factor + symptom cues), auto-irrigation hook (tech-gated with cost multipliers), crop gating via `requiredFlag`, permanent regime shift modifiers (water/market/heat), separate tech/non-tech event clustering caps, harvest affordance count, `pickMessage()` for message variety, agave as first gated crop, save migration V7→V8 (SAVE_VERSION='8.0.0').
- 5b: Advisors + first tech branch ✅ — Marcus Chen (`farm-credit`) + Valley Growers Forum (`growers-forum`) advisor characters with intro storylets, water irrigation tech unlock (year 3, drip irrigation → auto-irrigation end-to-end), auto-irrigation notification with 3-message rotating pool (no-repeat), `autoIrrigationMsgIdx` on GameState.
- 5c: Full content + regime shifts ✅ — Remaining tech decisions (soil testing, crop tech, advanced water, late-game regime-aware offers), 3 regime shifts (water allocation Y10-12, market crash Y15-18, heat threshold Y20-25), 2 novel crops (agave + heat-tolerant avocados), Year-30 reflection panel, tech soft-lock fix (#80). 22 storylets total, 9 crops.
- 5d: Balance + validate ✅ — UX fixes (#81 bulk plant feedback, #82 advisor thresholds, #87 year-end copy, #88 bankruptcy reflection). 5d.2 "Corn Dominance Fix": monoculture streak penalty (escalating yield loss), cover crop OM protection reduction (50%), diversified bot rotation rewrite. Balance: diversified ($301K) > corn ($193K) > citrus ($86K).

**Key systems:** Tech decisions via storylets (not separate UI). Tech level abstraction (water 0-3, soil 0-3, crop 0-2) for reconvergence. Pain-triggered offers. Hybrid reoffer policy. Persistent regime shifts via flags.

### Slice 6: Scoring & Endgame (Complete)
Assessment, endgame presentation, and visual polish.

- 6d: Scoring + submission ✅ — 5-category weighted composite scoring (financial 30%, soil 20%, diversity 20%, adaptation 20%, consistency 10%). 4 tiers (Thriving/Stable/Struggling/Failed). Human-readable completion code. Google Identity Services authentication for @dtechhs.org students. Authenticated result submission to backend spreadsheet.
- 6e: Endgame payoff ✅ — `generateEpilogue()` (tier-dependent, scenario-flavored narrative conclusion), `generateCategoryHints()` (max 2 weakest categories below raw 60), `generateAdvisorFarewells()` (aligned/contrasting from score components), `estimateHumanFoodServings()` (derived from yearSnapshots, no new state). EndgamePanel extracted from AutoPausePanel. Title screen hero image. Event illustrations for 4 high-impact storylets (`illustrationId` on Storylet type). `humanServingsPerUnit` on CropDefinition. All art uses graceful `onError` fallback.

**New engine exports (6d/6e):** `scoring.ts` — `computeScore()`, `generateEpilogue()`, `generateCategoryHints()`, `generateAdvisorFarewells()`, `estimateHumanFoodServings()`. Types: `ScoreResult`, `EpilogueData`, `CategoryHint`, `AdvisorFarewell`.

**Save migration:** V8→V9 in Slice 6c (adds insurance/organic fields to ExpenseBreakdown). `SAVE_VERSION = '9.0.0'`. Slice 6e data derived on-demand — no additional migration.

**Deferred to Slice 7+:** Insurance/credit systems, glossary, solar lease event chain, automation policies beyond irrigation, full tech tree UI.

## 14. Open Questions

### Resolved for Slice 1 (see SPEC.md — Locked Design Decisions)
- [x] Starting conditions: $50,000 cash, Spring Year 1 Day 1, all 64 plots empty, 100 lbs/acre N, 2.0% OM, 4.0in moisture, paused on launch.
- [x] Tutorial: 3-step tooltip tour with Skip + Don't show again. All elements have data-testid for AI testers.
- [x] Watering model: Manual ~14-day dose with first-per-season auto-pause at 25% moisture.
- [x] Bulk operations: Round down to complete rows when cash is insufficient; confirmation dialog.
- [x] Overripe crops: Auto-pause at harvestable → 30-day grace period → linear yield decay → rot.
- [x] Bankruptcy: Cash ≤ $0 = game over in Slice 1 (no credit/loans until Slice 2).
- [ ] Performance test setup: how do we simulate Chromebook performance in CI? (Chrome DevTools throttling profile) — deferred to implementation

### Resolved for Slice 2 (see DECISIONS.md — Slice 2 Design Decisions) ✅
- [x] Loan terms: One-time emergency loan, fixed 10% annual interest, parameterless TAKE_LOAN command (engine-computed amount), 20% of gross harvest revenue auto-repayment. No credit rating or insurance in Slice 2.
- [x] Advisor: Extension Agent only ("Dr. Maria Santos"). 5 advisor storylets with tiered priorities (100 for critical, 90 for suggestions). maxOccurrences caps prevent dominating event cadence.
- [x] Perennial lifecycle: Binary yield (0 during establishment, 1.0 after). Chill-hour tracking added in 2c with fog-of-war reveal. No decline phase until Slice 3.
- [x] Chill hours: Pre-defined per year in scenario data (800→700→630→570). Daily accumulation during dormancy. Yield penalty at harvest: `clamp(accumulated/required, 0, 1)`. Almonds fail before pistachios as climate warms.
- [x] Save migration: V1→V2→V3 chain with explicit version detection. Both `readSave()` and `listManualSaves()` use the same path.

### Resolved for Slice 4 (see SPEC.md §30-32)
- [x] Scoring formula: Weighted composite — financial stability 30%, soil health 20%, crop diversity 20%, climate adaptation 20%, consistency 10%. See SPEC.md §31.
- [x] Balance targets: Strategy archetype survival rates and cash targets defined. See SPEC.md §30.1.
- [x] Anti-luck requirement: Median and p10 across ≥20 seeds, not single runs. See SPEC.md §30.3.
- [x] Multiple viable paths: ≥3 distinct strategy families must survive. See SPEC.md §30.2.
- [x] Soil pedagogy targets: Monoculture without cover crops shows ≥20% yield decline; cover crop users maintain OM ≥ 1.5%. See SPEC.md §30.4.
- [x] Balance-tuning protocol: Tune one category per cycle, rerun full matrix, document in DECISIONS.md. See ARCHITECTURE.md §12.1.
- [x] Climate scenario count: 5 calibrated scenarios required for Slice 4 sign-off; additional scenarios optional for Slice 5+. See §5.3.

### Deferrable (decide during later slices)
- [ ] Irrigation upgrade specifics and costs (Slice 5+ — tech tree detail)
- [ ] Farm expansion / neighbor buyout event (likely v2, not Classroom-Ready Build)
- [ ] Agrivoltaics detail level in solar lease chain (Slice 5+)
- [ ] Market price model: static base + event modifiers is sufficient for Slice 1-2; full supply/demand is likely overkill
- [ ] Advanced accessibility: colorblind modes, full screen reader support (Slice 4+; baseline keyboard nav + ARIA labels are in Slice 1)
- [ ] Sound / music (defer — nice to have, not essential for classroom use)
