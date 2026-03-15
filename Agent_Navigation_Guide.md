# Climate Farmer — Agent Navigation Guide
Purpose: reliable UI navigation and state observation for AI/QA agents.
Updated: 2026-03-15. Build: Slice 6e complete.

---

## 1. Recommended Playtest Flow

Play the game as a student would. Do not skip mechanics with debug shortcuts — the goal is to produce observations about UX, pacing, and pedagogy.

```
1. Start new game (§2)
2. Set speed to 1× or 2× (not 4×) — observe notifications, advisor text, pacing
3. When blocked, read game-observer (§3) to understand why
4. Make deliberate choices at each autopause — record what you chose and why
5. At year-end, read the expense breakdown before dismissing
6. Every ~5 years, pause and record: cash, soil health, crop mix, observations
7. If testing a specific mechanic, play naturally until it triggers — don't inject it
```

**What makes a useful playtest report:**
- What the student saw and how they interpreted it
- Where the student felt confused, bored, or stuck
- Whether cause-and-effect was clear (did the student understand WHY something happened?)
- Specific notification/advisor text that was misleading or unhelpful

---

## 2. Start Flow

```
newgame-player-id   ← type into this input (use keyboard, not JS value assignment)
newgame-start       ← "Start New Game" button
tutorial-skip       ← dismisses tutorial overlay (may not appear if previously dismissed)
```

Always start a **fresh game** for each test session unless continuity is explicitly part of the test plan. Inherited saves with established orchards confuse observations.

---

## 3. Observer Layer (Primary Navigation Tool)

### DOM element: `data-testid="game-observer"`
Hidden div with reactive attributes. Read this ONE element to know the game's state:

```
data-blocked              "true" | "false"
data-block-reason         "harvest_ready" | "water_stress" | "year_end" | "event" | "advisor" | "loan_offer" | "bankruptcy" | "year_30" | "planting_options" | ""
data-panel                see §6 panel table for all possible values
data-speed                "0" | "1" | "2" | "4"
data-notification-count   number as string
data-year                 current game year
data-season               "spring" | "summer" | "fall" | "winter"
data-day                  total simulation day
```

### `window.__gameDebug.getBlockingState()`
Structured version of the same data, plus actionable choice info.

**Important:** `getBlockingState()` can return panels beyond standard autopauses. There are three categories of blockers:

1. **Engine autopauses** — harvest, water stress, year-end, loan offer, bankruptcy, year 30
2. **Event/advisor panels** — storylet choice panels with variable options
3. **UI-layer interstitials** — follow-up panels and organic warning panels (adapter-level, not engine-level)

Event/advisor example:
```js
{
  blocked: true, reason: "event",
  panelTestId: "event-panel", eventId: "heatwave-advisory",
  choices: [
    { testid: "event-choice-accept-risk", label: "Accept the Risk" },
    { testid: "event-choice-pre-irrigate", label: "Pre-irrigate ($200)" }
  ],
  speed: 0, year: 4, season: "summer", day: 1275
}
```

Follow-up panel (after choosing "tell me more" on an advisor):
```js
{
  blocked: true, reason: "advisor",
  panelTestId: "follow-up-panel",
  choices: [{ testid: "follow-up-dismiss", label: "OK" }],
  speed: 0, year: 3, season: "spring", day: 800
}
```

Organic warning interstitial (choosing a non-organic input while organic cert is active):
```js
{
  blocked: true, reason: "event",
  panelTestId: "organic-warning-panel",
  choices: [
    { testid: "organic-warning-proceed", label: "Use anyway" },
    { testid: "organic-warning-cancel", label: "Cancel" }
  ],
  speed: 0, year: 8, season: "summer", day: 2900
}
```

Standard autopause example:
```js
{
  blocked: true, reason: "water_stress",
  panelTestId: "autopause-panel",
  choices: [
    { testid: "autopause-action-primary", label: "Water Field" },
    { testid: "autopause-dismiss", label: "Continue without watering" }
  ],
  speed: 0, year: 3, season: "summer", day: 890
}
```

**Best practice:** Before every action, call `getBlockingState()`. If `blocked: true`, handle the blocking panel first by clicking the appropriate `testid` from `choices`. Do not click speed buttons while blocked.

**Preact state batching warning:** After clicking a dismiss/choice button, you MUST yield to the event loop (e.g., `await new Promise(r => setTimeout(r, 50))`) before calling `getBlockingState()` again. Preact batches state updates — a synchronous `.click()` followed by an immediate state read will see stale data. This applies to all panel dismissals, not just event/advisor panels.

### `window.__gameDebug.fastForwardUntilBlocked(maxTicks)`
Runs simulation ticks until ANY autopause fires. Unlike `fastForward()`, does **not** auto-dismiss anything. Respects the opt-in planting-window autopause setting if enabled. Returns:
```js
{ stopped: true, reason: "harvest_ready", ticksRun: 47 }
// or
{ stopped: false, ticksRun: 5000 }  // all ticks completed, no block
```

### `window.__gameDebug.fastForwardDays(days)`
Same as `fastForwardUntilBlocked` but takes calendar days instead of ticks (1 tick = 1 day). More intuitive for AI agents thinking in game time. Returns:
```js
{ stopped: true, reason: "year_end", ticksRun: 90, day: 424 }
// or
{ stopped: false, ticksRun: 30, day: 149 }  // advanced 30 days, no block
```
The `day` field is the final `totalDay` (absolute day since game start).

**Note:** This only detects engine-level autopauses. UI-layer interstitials (follow-up, organic warning) appear after an event choice is made, not during tick processing.

### `window.__gameDebug.getNotifications()`
Returns the full notification queue (the DOM only shows the newest):
```js
[{ message: "Dr. Santos: ...", type: "event_result", day: 412 }, ...]
```

### `window.__gameDebug.dismissAllNotifications()`
Clears notification backlog if it's interfering with testing.

---

## 4. Speed Controls

```
speed-pause    0×
speed-play     1×
speed-fast     2×
speed-fastest  4×
```

- Speed resets to 0 after every autopause. Click a speed button to resume.
- `play-prompt` appears when paused after an action — it means "click play to continue."

---

## 5. Settings

```
settings-gear                  ← opens/closes settings dropdown in TopBar
setting-auto-pause-planting    ← checkbox: auto-pause at planting window boundaries
```

The planting-window setting changes what autopauses are expected during play. When enabled, the game pauses at each season boundary where planting options change. Agents should note this setting's state when reporting observations — it affects pacing.

---

## 6. Dialog Handling

### All blocking panels
Check `getBlockingState()` first. Then click the appropriate testid:

| Block reason | Panel testid | Primary testid | Secondary testid |
|-------------|-------------|---------------|-----------------|
| harvest_ready | autopause-panel | autopause-action-primary | autopause-dismiss |
| water_stress | autopause-panel | autopause-action-primary | autopause-dismiss |
| year_end | autopause-panel | autopause-action-primary | autopause-dismiss |
| event | event-panel | event-choice-{id} | (choices vary) |
| advisor | advisor-panel | advisor-choice-{id} | (choices vary) |
| loan_offer | loan-panel | loan-accept | autopause-dismiss |
| bankruptcy | gameover-panel | gameover-new-game | — |
| year_30 | year30-panel | year30-new-game | — |
| planting_options | autopause-panel | autopause-action-primary | autopause-dismiss |
| **follow-up** | **follow-up-panel** | **follow-up-dismiss** | — |
| **organic warning** | **organic-warning-panel** | **organic-warning-proceed** | **organic-warning-cancel** |

**Follow-up panels** appear after choosing "tell me more" on an advisor event. They show explanatory text in a centered dialog. Dismiss with `follow-up-dismiss`.

**Organic warning panels** appear when a player selects a non-organic choice while holding organic certification. It's a confirm-style interstitial: proceed loses organic cert, cancel returns to the choice panel.

### Confirm dialogs
Bulk plant/water and perennial planting show confirm dialogs:
```
confirm-dialog      ← container
confirm-accept      ← "Confirm" button
confirm-cancel      ← "Cancel" button
```

### Event/advisor panels
Choices have testids: `event-choice-{choiceId}` or `advisor-choice-{choiceId}`. Use `getBlockingState().choices` to get exact testids.

---

## 7. Grid & Actions

8×8 grid, 64 cells. Cells: `data-testid="farm-cell-{row}-{col}"` (0-indexed).

**Click a cell first** — single-cell and row/col actions only render after selection.

### Planting (two-step)
```
1. action-plant             ← "Plant…" button (cell must be selected)
2. menu-crop-<cropId>       ← crop button in submenu
```
Crop IDs: `silage-corn`, `winter-wheat`, `processing-tomatoes`, `sorghum`, `almonds`, `pistachios`, `citrus-navels`, `agave` (requires `tech_crop_agave` flag), `heat-avocado` (requires flag).

Locked crops are absent from the DOM — they don't appear disabled.

### Bulk actions
```
action-plant-all-<cropId>       Confirm dialog follows (testid: confirm-accept / confirm-cancel)
action-harvest-all
action-water-all
action-plant-row-<row>-<cropId>
action-plant-col-<col>-<cropId>
action-harvest-row-<row> / action-harvest-col-<col>
action-water-row-<row> / action-water-col-<col>
```

### Planting windows (month-accurate)

Do NOT infer planting windows from season names. Use `getActionState().availableCrops` or this table:

| Crop | Months | Season(s) |
|------|--------|-----------|
| Silage Corn | Mar–May (3–5) | Spring |
| Processing Tomatoes | Mar–May (3–5) | Spring |
| Sorghum | Apr–Jun (4–6) | Spring–early Summer |
| Almonds | Jan–Mar (1–3) | Winter–early Spring |
| Pistachios | Jan–Mar (1–3) | Winter–early Spring |
| Citrus Navels | Feb–Apr (2–4) | late Winter–Spring |
| Agave | Mar–May (3–5) | Spring (requires `tech_crop_agave` flag) |
| Heat-Avocado | Feb–Apr (2–4) | late Winter–Spring (requires `tech_crop_avocado` flag) |
| Winter Wheat | Oct–Nov (10–11) | Fall |
| Cover crops | Fall only | Fall (manual convention, not engine-enforced) |

Summer (Jun–Aug) has no annual crop planting unless sorghum window overlaps into June.

### Cover crop actions
Cover crop buttons appear only in fall when eligible cells exist (empty or deciduous perennial without existing cover crop):
```
action-plant-cover-crop-bulk          Cover crop entire field
action-cover-crop-row-{row}           Cover crop a row (requires cell selection)
action-cover-crop-col-{col}           Cover crop a column (requires cell selection)
```

---

## 8. Action State Helper

### `window.__gameDebug.getActionState()`
Returns what actions are currently available. **Use this instead of DOM scraping.**

```js
{
  selectedCell: { row: 2, col: 3 },     // or null
  availableCrops: ["silage-corn", "processing-tomatoes", "sorghum"],
  coverCropsEligible: false,
  harvestReadyCount: 12,
  hasCrops: true,
  bulkActions: [                         // all currently valid testids
    "action-plant-all-silage-corn",
    "action-plant-all-processing-tomatoes",
    "action-harvest-all",
    "action-water-all",
    "action-plant-row-2-silage-corn",
    "action-harvest-row-2",
    // ... etc
  ]
}
```

Row/col actions only appear when a cell is selected. To select a cell programmatically:
```js
__gameDebug.selectCell(row, col)   // UI equivalent, not a cheat
```

---

## 9. Key Testids Reference

```
newgame-player-id / newgame-start / tutorial-skip
farm-cell-{r}-{c}
speed-pause / speed-play / speed-fast / speed-fastest
settings-gear / setting-auto-pause-planting
game-observer                    ← machine-readable state (§3)
action-plant / menu-crop-{id}
action-plant-all-{id} / action-harvest-all / action-water-all
confirm-dialog / confirm-accept / confirm-cancel
autopause-panel / autopause-action-primary / autopause-dismiss
event-panel / advisor-panel / loan-panel / gameover-panel / year30-panel
follow-up-panel / follow-up-dismiss
organic-warning-panel / organic-warning-proceed / organic-warning-cancel
topbar-cash / topbar-date / topbar-debt / topbar-year-net
notify-bar                       ← newest notification
sidebar-cell-detail              ← selected cell info
sidebar-soil-n / sidebar-soil-om / sidebar-soil-k (K requires tech_soil_testing)
save-new-game                    ← return to title (shows confirm dialog)
endgame-epilogue / endgame-hints / food-servings-callout
score-panel / score-total / completion-code / completion-copy
title-hero / event-illustration
```

---

## 10. Cheats & Debug Shortcuts

**Only use if explicitly allowed by your test plan.** These bypass normal game flow and produce observations that don't reflect student experience.

```js
// State manipulation
__gameDebug.setCash(amount)
__gameDebug.setDebt(amount)
__gameDebug.setDay(totalDay)       // Calendar surgery — no intermediate simulation
__gameDebug.setFlag(flag, bool)    // e.g. 'tech_crop_agave', 'tech_drip_irrigation', 'tech_soil_testing'
__gameDebug.setScenario(id)        // 'gradual-warming', 'early-drought', 'whiplash', 'late-escalation', 'mild-baseline'
__gameDebug.publish()              // Force UI re-render after direct state mutation

// Event injection
__gameDebug.triggerEvent(id)       // Bypasses RNG/conditions. See src/data/events.ts for IDs.

// Calendar-based fast forward (recommended over tick-based)
__gameDebug.fastForwardDays(days)  // Like fastForwardUntilBlocked but in calendar days. Returns { stopped, reason, ticksRun, day }.

// Old-style fast forward (auto-dismisses most pauses — NOT recommended for playtesting)
__gameDebug.fastForward(ticks)     // Runs ticks, auto-dismisses non-event pauses. Returns 'done'|'event'|'gameover'.

// Action state (use instead of DOM scraping)
__gameDebug.getActionState()       // Available crops, cover crop eligibility, valid bulk testids. See §8.
__gameDebug.selectCell(row, col)   // Select a cell programmatically. Required for row/col actions.

// Direct state access
__gameDebug.getState()             // Mutable live reference. Call publish() after mutation.
```

**`setDay()` warning:** Moves the calendar without simulating intermediate weather/growth. Use only for jumping to specific planting windows in targeted tests. Do not use for "time travel" during a playtest — it creates unrealistic state.

**`fastForward()` warning:** Auto-dismisses harvest, water stress, year-end, advisor, and loan pauses. This hides exactly the interactions you want to observe in a playtest. Use `fastForwardUntilBlocked()` (§3) instead.

---

## 11. Strict Automation Loop

When writing automated scripts, use this exact loop. Do not improvise.

```js
while (!done) {
  // 1. Always check state before acting
  const bs = __gameDebug.getBlockingState();

  if (bs.blocked) {
    // 2. Handle the block using ONLY the returned choices — never guess testids
    const choice = selectChoice(bs.choices);  // your decision logic
    document.querySelector(`[data-testid="${choice.testid}"]`).click();

    // 3. MUST yield after every click (Preact batches state updates)
    await new Promise(r => setTimeout(r, 50));
    continue;
  }

  // 4. Check what actions are available before acting
  const as = __gameDebug.getActionState();

  // 5. Only click testids that appear in as.bulkActions or as.availableCrops
  // ... your action logic ...

  // 6. Advance time
  const result = __gameDebug.fastForwardUntilBlocked(500);
  if (!result.stopped) break;
}
```

---

## 12. Known Automation Traps

These have caused incorrect QA findings in the past. Avoid them.

1. **Row/col actions depend on selected cell.** They only render when `selectedCell` is non-null. Call `__gameDebug.selectCell(row, col)` first, then re-read `getActionState()` to get the row/col testids.

2. **Selection changes re-render the side panel.** Clicking a new cell clears the crop menu and changes which row/col actions are visible. Read `getActionState()` after every selection change.

3. **Do not construct testids by guesswork.** Always use `getBlockingState().choices` for panel buttons and `getActionState().bulkActions` for action buttons. Constructed testids (e.g., guessing `event-choice-accept` instead of `event-choice-accept-risk`) will silently fail.

4. **Do not infer planting windows from season names.** Sorghum is available Apr–Jun (not all of "spring"). Citrus is Feb–Apr (not "winter"). Use `getActionState().availableCrops` for the ground truth.

5. **Yield after every click.** Preact batches state updates. A synchronous click + immediate state read will see stale data. Wait at least 50ms.

6. **Event/advisor cooldowns and caps are real.** If an event fires 30+ times in the same session, your script is likely not dismissing panels correctly (infinite refire). Check for testid typos (case-sensitive: `testid` vs `testId`).

---

## 13. Report Quality Standards

Separate findings into three categories:

- **Confirmed in code/UI:** You verified the behavior by reading source or observing consistent UI output across multiple runs
- **Likely real:** Behavior is consistent and not explained by automation artifacts, but you haven't traced it to specific code
- **Possibly automation artifact:** Could be caused by script timing, testid errors, stale state reads, or selection-dependent rendering

Save playtest reports to `test-results/playtests/YYYY-MM-DD-description.md` so they're reviewable.
