# Climate Farmer — Agent Navigation Guide
Purpose: reliable UI navigation and state observation for AI/QA agents.
Updated: 2026-03-10. Build: Slice 5d.2 complete.

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
data-block-reason         "harvest_ready" | "water_stress" | "year_end" | "event" | "advisor" | "loan_offer" | "bankruptcy" | "year_30" | ""
data-panel                "autopause-panel" | "event-panel" | "advisor-panel" | "loan-panel" | "gameover-panel" | "year30-panel" | ""
data-speed                "0" | "1" | "2" | "4"
data-notification-count   number as string
data-year                 current game year
data-season               "spring" | "summer" | "fall" | "winter"
data-day                  total simulation day
```

### `window.__gameDebug.getBlockingState()`
Structured version of the same data, plus actionable choice info:
```js
{
  blocked: true,
  reason: "event",
  panelTestId: "event-panel",
  eventId: "heatwave-advisory",
  choices: [
    { testid: "event-choice-accept-risk", label: "Accept the Risk" },
    { testid: "event-choice-pre-irrigate", label: "Pre-irrigate ($200)" }
  ],
  speed: 0,
  notificationCount: 3,
  year: 4,
  season: "summer",
  day: 1275
}
```

Standard autopause example (labels match actual button text):
```js
{
  blocked: true,
  reason: "water_stress",
  panelTestId: "autopause-panel",
  choices: [
    { testid: "autopause-action-primary", label: "Water Field" },
    { testid: "autopause-dismiss", label: "Continue without watering" }
  ],
  speed: 0,
  year: 3,
  season: "summer",
  day: 890
}
```

**Best practice:** Before every action, call `getBlockingState()`. If `blocked: true`, handle the blocking panel first by clicking the appropriate `testid` from `choices`. Do not click speed buttons while blocked.

**Preact state batching warning:** After clicking a dismiss/choice button, you MUST yield to the event loop (e.g., `await new Promise(r => setTimeout(r, 50))`) before calling `getBlockingState()` again. Preact batches state updates — a synchronous `.click()` followed by an immediate state read will see stale data. This applies to all panel dismissals, not just event/advisor panels.

### `window.__gameDebug.fastForwardUntilBlocked(maxTicks)`
Runs simulation ticks until ANY autopause fires. Unlike `fastForward()`, does **not** auto-dismiss anything. Returns:
```js
{ stopped: true, reason: "harvest_ready", ticksRun: 47 }
// or
{ stopped: false, ticksRun: 5000 }  // all ticks completed, no block
```

Use this instead of `fastForward()` for playtesting — it preserves every autopause for the agent to observe and respond to.

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

## 5. Grid & Actions

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

### Planting windows
- **Spring (Mar-May):** corn, tomatoes, sorghum, citrus, agave, avocado
- **Fall (Sep-Nov):** winter wheat, cover crops
- **Winter (Jan-Feb):** almonds, pistachios, citrus
- In Summer, annual crop planting is unavailable.

---

## 6. Dialog Handling

### Autopause panels
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

## 7. Key Testids Reference

```
newgame-player-id / newgame-start / tutorial-skip
farm-cell-{r}-{c}
speed-pause / speed-play / speed-fast / speed-fastest
game-observer                    ← machine-readable state (§3)
action-plant / menu-crop-{id}
action-plant-all-{id} / action-harvest-all / action-water-all
confirm-dialog / confirm-accept / confirm-cancel
autopause-panel / autopause-action-primary / autopause-dismiss
event-panel / advisor-panel / loan-panel / gameover-panel / year30-panel
topbar-cash / topbar-date / topbar-debt / topbar-year-net
notify-bar                       ← newest notification
sidebar-cell-detail              ← selected cell info
sidebar-soil-n / sidebar-soil-om / sidebar-soil-k (K requires tech_soil_testing)
save-new-game                    ← return to title (shows confirm dialog)
```

---

## 8. Cheats & Debug Shortcuts

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

// Old-style fast forward (auto-dismisses most pauses — NOT recommended for playtesting)
__gameDebug.fastForward(ticks)     // Runs ticks, auto-dismisses non-event pauses. Returns 'done'|'event'|'gameover'.

// Direct state access
__gameDebug.getState()             // Mutable live reference. Call publish() after mutation.
```

**`setDay()` warning:** Moves the calendar without simulating intermediate weather/growth. Use only for jumping to specific planting windows in targeted tests. Do not use for "time travel" during a playtest — it creates unrealistic state.

**`fastForward()` warning:** Auto-dismisses harvest, water stress, year-end, advisor, and loan pauses. This hides exactly the interactions you want to observe in a playtest. Use `fastForwardUntilBlocked()` (§3) instead.
