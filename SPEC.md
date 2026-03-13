# SPEC.md — Acceptance Tests & Requirements

> **Status: Living document. Slices 1-5d implemented. Classroom-Ready Build deployed.**
> Format: **When** [user action], **I should see** [expected result].
> Negative cases use: **When** [action], **I should NOT see** [bad outcome] / **the system should** [prevent it].

### Terminology Note

Student-facing UI uses farm language: **"plots"** (not cells), **"field"** (not grid), **"rows"** and **"columns"**. Code and `data-testid` attributes use engineering terms (`farm-cell-3-7`, `farm-grid`) for consistency with ARCHITECTURE.md §11. This spec uses both: farm terms when describing what students see, code terms when referencing test IDs.

---

## Slice 1: Core Farm Loop

### Starting Conditions

These defaults are used throughout the tests below. If any change, the test values change with them.

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Starting cash | $50,000 | Enough for ~2 seasons of planting a full field; mistakes are affordable but not free |
| Starting season | Spring, Year 1, Day 1 | Spring is planting time — students can act immediately |
| Starting field | All 64 plots empty, all farmable | Clean slate; student's first decision is what to plant |
| Starting soil N | 100 lbs/acre per plot | Moderate — enough for one crop without fertilizer; depletion visible by year 2 |
| Starting soil OM | 2.0% | Typical Central Valley agricultural soil |
| Starting soil moisture | 4.0 inches (of 6.0 capacity) | Spring start with reasonable water; ~14 days before first watering needed in dry weather |
| Climate scenario | 1 scenario bundled ("Slice 1 Baseline") | Mild-to-moderate difficulty; includes one dry summer (Year 3) for drama |
| Speed on launch | Paused (0x) | Game starts paused so student can read the UI and choose first action |
| Crops available | Processing Tomatoes, Silage Corn, Winter Wheat, Almonds, Pistachios (Slice 2), Sorghum, Citrus Navels (Slice 3) | All unlocked from game start — no tech gating |

---

### Locked Design Decisions

These were open questions in the first draft. Now resolved with Neal's input + Senior Engineer recommendation.

#### DD-1: Bulk operation when cash is insufficient
**Decision:** Confirmation dialog, rounded down to the maximum number of complete rows. The dialog uses farm terminology and keeps students in bulk-operation mode.

Example: Player clicks "Plant Field" with Silage Corn but can only afford 30 of 64 plots. Since a row is 8 plots, the system offers the nearest complete-row count: "You can afford to plant 3 full rows (24 plots) of Silage Corn for $2,400. Plant 3 rows?" Fill order: top-to-bottom (row 0 first), skipping rows that already have crops. If the student needs to plant the remaining rows later, they use "Plant Row" after earning more cash.

For "Plant Row" and "Plant Column" (max 8 plots): all-or-nothing, since the cost is small. "Not enough cash to plant this row ($800 needed, $600 available)."

For "Water Field" with insufficient cash: same pattern — round down to complete rows. "You can afford to water 5 rows (40 plots) for $200. Water 5 rows?"

#### DD-2: Year 30 ending & bankruptcy
**Year 30:** Game pauses with "You completed 30 years of farming! Final cash: $X." Simple message, no score or completion code (deferred to Slice 6).

**Bankruptcy:** Cash ≤ $0 is game over. The system shows a final report: what happened, what the student might try differently, and a "Start New Game" button. No emergency loans or further credit in Slice 1 (soft recovery with loans is Slice 2).

#### DD-3: Onboarding / first-time experience
**Decision:** Brief 3-step tooltip tour on first launch: "1. Click a plot to select it → 2. Plant a crop → 3. Press Play to start time." Includes a "Skip" button and a "Don't show again" checkbox (persisted in localStorage). All tooltip elements have `data-testid` attributes so AI test agents can click through or dismiss the tour programmatically.

#### DD-4: Overripe crop behavior
**Decision:** When a crop reaches harvestable stage, the game auto-pauses with options: "Harvest" (immediate) or "Continue" (dismiss and keep playing). If the student continues without harvesting, the crop enters a **30-day grace period.** During this period, yield degrades linearly (100% → 0%). After 30 days, the crop rots: yield drops to zero, the plot is cleared, and a notification explains the loss. The student learns to harvest on time.

*Future slice note:* In Slice 2+, rotting crops could trigger a secondary event offering to sell as animal feed at a steep discount. This doesn't exist in Slice 1.

#### DD-5: Watering model
**Decision:** Manual "biweekly dose" watering — each Water action provides enough moisture for approximately **14 days** (2 weeks) under typical summer ET conditions. This is the low-tech "sprinkler from a garden hose" level. The student decides when to water and whether the cost is worth it.

**Auto-pause for water stress:** The game auto-pauses the **first time per season** that any planted plot's moisture drops below 25% of capacity. The notification says "Some of your crops need water!" with a "Water Field" action button and a "Continue without watering" option. After this first warning per season, subsequent moisture drops show visual warnings on affected plots but do not auto-pause. This teaches the concept without nagging.

**Visual indicators (no auto-pause):** Plots show a yellow moisture warning at 30% capacity and a red wilting indicator at 15% capacity. These are always visible regardless of auto-pause history.

*Future slice note:* Irrigation system upgrades (drip, AI-driven), buying/leasing neighbor's water rights, and seasonal irrigation contracts are tech tree options in Slice 5+. Water rights trading is a real practice in California's San Joaquin Valley (~1.5M acre-feet traded annually).

---

### 1. New Game & Main Screen

#### 1.1 Game Launch
- **When** I open the app for the first time (no save data), **I should see** a "New Game" screen with a Player ID input field (labeled "Player ID", NOT "Name") and a "Start" button.
- **When** I enter a Player ID and click Start, **I should see** the main game screen: farm field (8x8 grid), top bar (date, cash, speed controls), side panel, and notification bar.
- **When** the game starts, **I should see** "Spring — Year 1" in the top bar, cash showing "$50,000", and all 64 plots empty.
- **When** the game starts, **I should see** the simulation paused (speed indicator shows paused).

#### 1.2 Player ID Validation
- **When** I try to start a game with an empty Player ID, **the system should** prevent it and show a message explaining a Player ID is needed.
- **When** I enter a Player ID with special characters or spaces, **the system should** accept it (students may use codes like "P3-14" or "Team Blue").
- **When** I enter a Player ID longer than 30 characters, **the system should** truncate to 30 characters and show the truncated result before the student clicks Start.

#### 1.3 First-Time Tutorial
- **When** I start a new game for the first time (no "Don't show again" flag in localStorage), **I should see** a 3-step tooltip tour: Step 1 highlights a plot ("Click a plot to select it"), Step 2 highlights the Plant button ("Plant a crop"), Step 3 highlights the Play button ("Press Play to start time").
- **When** I click "Next" on each tooltip step, **I should see** the next step. After the last step, the tour ends.
- **When** I click "Skip" at any point during the tour, **I should see** the tour close immediately.
- **When** I check "Don't show again" and finish or skip the tour, **the tour should NOT** appear on future game starts.
- **When** an AI test agent needs to bypass the tutorial, **it should** be able to click `tutorial-skip` to dismiss the tour in one action.

---

### 2. Farm Grid Interactions

#### 2.1 Plot Selection
- **When** I click a farm plot, **I should see** the plot highlighted and the side panel showing that plot's details: crop (or "Empty"), soil nitrogen, soil moisture, organic matter.
- **When** I click a different plot, **I should see** the selection move to the new plot and the side panel update.
- **When** I click the already-selected plot again, **I should see** the plot deselected and the side panel return to its default view (field summary).

#### 2.2 Planting — Single Plot
- **When** I click an empty plot and click "Plant...", **I should see** a crop selection menu listing the 3 available crops (Processing Tomatoes, Silage Corn, Winter Wheat) with their planting cost displayed per plot.
- **When** I select "Processing Tomatoes" from the crop menu, **I should see** the plot update to show a tomato indicator (seedling stage), and my cash decrease by the seed cost.
- **When** I try to plant in a plot that already has a crop, **the system should** disable the "Plant" button (greyed out). Tooltip: "This plot already has a crop."
- **When** I try to plant a crop outside its planting window (e.g., tomatoes in winter), **the system should** show that crop greyed out in the menu with a tooltip: "Planting window: March–May."
- **When** I don't have enough cash to plant a crop, **the system should** show that crop greyed out in the menu with a tooltip: "Cost: $150. Available: $80."

#### 2.3 Planting — Bulk Operations
- **When** I click "Plant Field" with a crop selected and enough cash for all empty plots, **I should see** a confirmation: "Plant all 64 plots with Silage Corn for $6,400?" After confirming, all empty plots are planted, cash is reduced, and a notification shows how many plots were planted.
- **When** I click "Plant Row 3" with a crop selected, **I should see** all empty plots in row 3 (up to 8) planted, and only those plots' cost deducted.
- **When** I click "Plant Column 5" with a crop selected, **I should see** all empty plots in column 5 (up to 8) planted.
- **When** some plots in a row are already occupied and I use "Plant Row", **I should see** only the empty plots get planted. Already-occupied plots are untouched. Cost reflects only the plots actually planted.
- **When** I click "Plant Field" but can only afford a partial field, **I should see** a confirmation dialog offering the maximum number of complete rows I can afford: "You can afford to plant 3 full rows (24 plots) of Silage Corn for $2,400. Plant 3 rows?" Fill order: top-to-bottom, skipping rows with existing crops.
- **When** I can't afford even one complete row (8 plots), **the system should** show: "Not enough cash to plant a full row. Cost per row: $800, Available: $600." The student can still plant individual plots.

#### 2.4 Harvesting — Single Plot
- **When** I click a plot with a crop in "harvestable" stage, **I should see** a "Harvest" button enabled in the side panel.
- **When** I click "Harvest" on a harvestable plot, **I should see** the crop removed from the plot (plot becomes empty), cash increase by the harvest revenue, and a notification showing yield and revenue (e.g., "Harvested Processing Tomatoes: 32 tons at $70/ton = $2,240").
- **When** I click a plot with a crop that isn't harvestable yet (still growing), **I should see** the "Harvest" button disabled with a tooltip showing growth progress: "Silage Corn — 65% grown. Ready in ~20 days."
- **When** a crop is in its 30-day overripe grace period, **I should see** a warning indicator on the plot (amber color) and reduced yield shown in the side panel: "Yield: 85% (overripe — harvest soon!)".

#### 2.5 Harvesting — Bulk Operations
- **When** I click "Harvest Field", **I should see** all harvestable plots harvested at once, total revenue displayed in a summary notification, and plots cleared to empty.
- **When** I click "Harvest Row 2", **I should see** only harvestable plots in row 2 harvested.
- **When** no plots are harvestable and I click "Harvest Field", **the system should** show a notification: "No crops ready to harvest."

#### 2.6 Watering
- **When** I click "Water Field", **I should see** all planted plots receive irrigation (providing ~14 days of moisture under typical conditions), cash decrease by irrigation cost, and soil moisture bars update in the side panel.
- **When** I click "Water Row" or "Water Column", **I should see** only plots in that scope irrigated.
- **When** I click "Water Field" but can only afford partial coverage, **I should see** a confirmation offering the maximum number of complete rows: "You can afford to water 5 rows (40 plots) for $200. Water 5 rows?"
- **When** all plots are already at maximum moisture and I water anyway, **the system should** still deduct the cost. Excess water is wasted (runoff). This teaches about over-irrigation — a real agricultural problem.
- **When** soil moisture is above 80% capacity on a plot, **I should see** a hint in the plant menu: "Soil moisture is high — watering may not be needed yet."

---

### 3. Time & Simulation

#### 3.1 Speed Controls
- **When** I click the Play button (1x), **I should see** the simulation start running — the date in the top bar advances day by day, and crop growth progresses visibly.
- **When** I click 2x speed, **I should see** time advance roughly twice as fast as 1x.
- **When** I click 4x speed, **I should see** time advance roughly four times as fast as 1x.
- **When** I click Pause, **I should see** time stop — the date freezes, no simulation ticks occur, but I can still interact with the field and panels.
- **When** I change speed while the game is running, **I should see** the speed change take effect immediately (no need to pause first).

#### 3.2 Calendar Display
- **When** the simulation is running, **I should see** the current date displayed in the top bar showing at minimum: the season name (Spring/Summer/Fall/Winter), the current month, and the year number (Year 1 through Year 30).
- **When** the season changes (e.g., Spring → Summer), **I should see** the season display update and a brief notification marking the transition ("Summer — Year 1").
- **When** the year changes (Day 365 → Day 1 of next year), **I should see** an end-of-year summary showing: total revenue, total expenses, net profit/loss, ending cash balance, and a brief narrative about the year.

#### 3.3 Crop Growth Progression
- **When** a crop is planted and time passes, **I should see** the crop's growth stage advance: seedling → vegetative → flowering → mature → harvestable.
- **When** I select a growing plot, **I should see** a growth progress indicator in the side panel (e.g., a bar showing GDD accumulated vs. GDD needed).
- **When** the temperature is too cold for growth (below crop's GDD base temp), **I should see** the crop's growth stall — no visible progress on cold days.
- **When** I plant Winter Wheat in fall and the season turns cold, **I should see** it grow slowly (it has a lower base temp than tomatoes/corn), demonstrating it's suited for cool seasons.

#### 3.4 Weather Display
- **When** the simulation is running, **I should see** a current weather indicator somewhere on screen showing approximate temperature and whether it's a rainy day, dry day, or hot day.
- **When** a day is notably hot (heat event), **I should see** a visual cue (warm color, heat icon).
- **When** it rains, **I should see** a rain indicator and soil moisture increase in the affected plots.

#### 3.5 Season & Planting Windows
- **When** it's Spring, **I should see** Processing Tomatoes and Silage Corn available in the plant menu (these are warm-season crops).
- **When** it's Fall, **I should see** Winter Wheat available in the plant menu (it's a cool-season crop).
- **When** it's midsummer, **I should see** that tomatoes and corn may still be plantable (if within their window) but Winter Wheat is greyed out with tooltip: "Planting window: October–November."
- **When** I try to plant a crop outside its planting window, **the system should** prevent it — the crop appears greyed out in the menu with its planting window shown.

#### 3.6 Auto-Pause Triggers (Slice 1)

The game auto-pauses for these events. Each auto-pause shows a notification with action buttons.

| Trigger | Notification | Actions |
|---------|-------------|---------|
| Any crop reaches harvestable stage | "Your [crop] is ready to harvest!" | "Harvest Field" / "Harvest [scope]" / "Continue" |
| First moisture drop below 25% capacity per season | "Some of your crops need water!" | "Water Field" / "Continue without watering" |
| Cash drops to ≤ $0 | "You've run out of money." | Shows game-over panel (see §5.4) |
| Year ends (Day 365) | Year-end summary panel | "Continue to Year N+1" |
| Year 30 ends | "Congratulations! You completed 30 years." | Shows final cash, "Start New Game" |

- **When** multiple auto-pause conditions trigger on the same tick, **the system should** queue them and show them one at a time, most urgent first (bankruptcy > harvest ready > water stress > year end).

#### 3.7 Overripe Crop Lifecycle
- **When** a crop reaches "harvestable" and the game auto-pauses, **I should see** options to harvest or continue playing.
- **When** I click "Continue" without harvesting, **I should see** the crop enter a 30-day grace period. The plot shows an amber "overripe" indicator. The side panel shows: "Overripe — yield declining. 25 days until crop loss."
- **When** the grace period is active and I select the plot, **I should see** the current yield percentage decreasing (e.g., "Yield: 72% of maximum. Harvest now or lose it in 18 days.").
- **When** the 30-day grace period expires without harvest, **I should see** the crop removed, the plot cleared to empty, and a notification: "Your [crop] rotted in the field. Total loss." Revenue: $0.
- **When** I harvest during the grace period, **I should see** yield proportional to how many grace days remain (day 0 of grace = 100%, day 15 = 50%, day 30 = 0%).

---

### 4. Nitrogen & Soil (Slice 1 — N only)

#### 4.1 Nitrogen Display
- **When** I select a plot, **I should see** its soil nitrogen level displayed as a number and a visual bar in the side panel (e.g., "N: 72 lbs/acre" with a colored bar).
- **When** nitrogen is high (≥80 lbs/acre), **I should see** a green indicator.
- **When** nitrogen is moderate (40–79 lbs/acre), **I should see** a yellow indicator.
- **When** nitrogen is low (<40 lbs/acre), **I should see** a red indicator and a narrative hint in the notification bar (e.g., "Your crops in row 3 look unusually pale this season.").

#### 4.2 Nitrogen Depletion
- **When** I plant tomatoes (heavy N feeder) and harvest, **I should see** the plot's nitrogen level significantly reduced after harvest.
- **When** I plant the same plot with tomatoes again without adding nitrogen, **I should see** lower yield the second time, and the notification bar should hint at the reason.
- **When** I plant corn (moderate N feeder) and harvest, **I should see** less nitrogen depletion than tomatoes.
- **When** I let a plot sit empty for a season, **I should see** nitrogen slowly recover via organic matter mineralization (but slowly — not enough to sustain continuous heavy cropping).

#### 4.3 Nitrogen & Yield Relationship
- **When** a plot has full nitrogen and adequate water, **I should see** yield at or near the crop's maximum potential.
- **When** a plot has low nitrogen but adequate water, **I should see** yield reduced proportionally (the formula: yield × min(1, soilN / cropNitrogenUptake)).
- **When** both nitrogen and water are low, **I should see** yield reduced by BOTH factors (they compound — this is a key learning moment).

#### 4.4 Soil Moisture
- **When** I select a plot, **I should see** its soil moisture level displayed (numerical + bar).
- **When** it doesn't rain and I don't irrigate, **I should see** soil moisture decrease daily (due to evapotranspiration).
- **When** I irrigate, **I should see** moisture increase. Excess above capacity is wasted (runoff).
- **When** moisture drops below 30% capacity, **I should see** a yellow moisture warning on the plot.
- **When** moisture drops below 15% capacity, **I should see** a red wilting indicator on the plot, and the crop accumulates stress days that reduce final yield.

#### 4.5 Organic Matter (Passive Simulation)
The engine fully simulates OM changes each tick. However, there are no Slice 1 player actions that directly control OM (cover crops and compost are Slice 3). OM is an observable indicator that changes slowly based on cropping decisions.

- **When** I select a plot, **I should see** its organic matter percentage displayed (e.g., "OM: 2.0%").
- **When** I grow crops and harvest for several years, **I should see** OM decrease very slowly (noticeable over 5+ years, not season-to-season).
- **When** OM decreases, **I should see** the plot's moisture capacity decrease slightly (the OM → water-holding relationship: each 1% OM ≈ +0.8 inches capacity).

---

### 5. Economy

#### 5.1 Cash Display
- **When** I look at the top bar, **I should see** my current cash balance displayed prominently.
- **When** I plant crops, **I should see** cash decrease immediately and the new balance shown.
- **When** I harvest, **I should see** cash increase and the new balance shown.
- **When** I irrigate, **I should see** cash decrease and the new balance shown.
- **When** cash changes, **I should see** a brief green flash (increase) or red flash (decrease) on the cash display, making the change noticeable.

#### 5.2 Cost Transparency
- **When** I open the plant menu, **I should see** the per-plot cost for each crop (seed cost).
- **When** I'm about to do a bulk operation, **I should see** the total cost in the confirmation dialog before committing (e.g., "Plant 64 plots of Corn for $6,400?").
- **When** I harvest, **I should see** both yield and revenue clearly (e.g., "32 tons × $70/ton = $2,240").
- **When** I irrigate, **I should see** the irrigation cost (per plot × number of plots watered).

#### 5.3 Year-End Summary
- **When** Year 1 ends, **I should see** a summary panel showing:
  - Total revenue from all harvests this year
  - Total expenses (planting + irrigation in Slice 1; itemized breakdown in Slice 4 — see §32.2)
  - Net profit or loss
  - Ending cash balance
  - Brief narrative about what happened ("Year 1: You planted 32 plots of corn and 16 plots of tomatoes...")
- **When** I have a profitable year, **I should see** a positive tone in the summary.
- **When** I lose money, **I should see** a cautionary tone (not punishing, but clear that expenses exceeded revenue).

#### 5.4 Bankruptcy
- **When** my cash drops to $0 or below, **the system should** auto-pause and display a game-over panel with:
  - A final report: starting cash, total revenue, total expenses, what went wrong
  - A suggestion for what to try differently (e.g., "Consider diversifying crops" or "Watch soil nitrogen levels")
  - A "Start New Game" button
- **When** I have crops still growing but cash is $0, **the system should** still trigger game over — there is no credit in Slice 1. (Emergency loans are a Slice 2 feature.)
- **When** I reach game over, **I should NOT** be forced to close and reopen the browser. The "Start New Game" button returns to the new-game screen.

#### 5.5 Economic Realism Checks (Engine Tests)
- **When** I plant a full field (64 plots) of Processing Tomatoes and successfully grow/harvest them with adequate water and nitrogen, **the revenue should** exceed the planting + irrigation costs (farming a full field well should be profitable).
- **When** I plant tomatoes repeatedly on the same plots without managing nitrogen, **I should see** yields decline year-over-year until farming becomes unprofitable (demonstrating soil depletion).
- **When** I do nothing (don't plant anything), **I should see** cash decrease by $2,000 per year at year-end (annual farm overhead: property taxes, insurance, base upkeep). An idle farm should go bankrupt well before year 30. No mid-year charges should appear without farming activity.
- **When** the dry summer hits (Year 3 in baseline scenario), **I should see** higher water stress on crops unless I irrigate more often, resulting in lower yields — a natural demonstration of climate risk.

---

### 6. Save & Resume

#### 6.1 Auto-Save
- **When** a season transition occurs (every ~90 in-game days), **the system should** automatically save the game state to localStorage.
- **When** I close the browser tab and reopen the app, **I should see** a "Continue" option alongside "New Game" that loads from the most recent auto-save.
- **When** I click "Continue", **I should see** the game resume in exactly the state I left it: same day, same cash, same crops, same soil conditions, same Player ID.

#### 6.2 Manual Save
- **When** I click the "Save" button, **I should see** the game saved to a named slot with a timestamp.
- **When** I have a saved game and start a new one, **the old save should** still be accessible from a load menu.
- **When** localStorage is full, **the system should** show a warning rather than silently failing.

#### 6.3 Save Integrity
- **When** I save, close, and reload, **the game state should** be identical: same day, same cash (to the cent), same soil values per plot, same crop growth stages, same RNG state. A headless test can verify this by comparing serialized state before save and after load.
- **When** I resume and unpause, **the simulation should** continue deterministically from where it left off (same RNG state).
- **When** a save file is corrupted (manually tampered with), **the system should** detect the problem and show an error rather than loading into a broken state.

---

### 7. Accessibility (Baseline — Slice 1)

#### 7.1 Keyboard Navigation
- **When** I press Tab, **I should see** focus move through all interactive elements in a logical order: top bar controls → grid plots → side panel buttons → action buttons.
- **When** a grid plot has focus and I press Enter, **I should see** the same behavior as clicking it (select/deselect).
- **When** I'm in the crop menu and press Escape, **I should see** the menu close without making a selection.
- **When** I use arrow keys on the grid, **I should see** focus move to adjacent plots (left/right/up/down).

#### 7.2 Focus Indicators
- **When** any interactive element has keyboard focus, **I should see** a clearly visible focus ring or highlight (not just the default browser outline — it must be visible against the game's background colors).

#### 7.3 ARIA Labels
- **When** a screen reader reads a grid plot, **it should** announce the plot's contents meaningfully (e.g., "Row 3, Column 5: Processing Tomatoes, vegetative stage, nitrogen 68" not just "cell").
- **When** a screen reader reads a speed control button, **it should** announce the current state (e.g., "Pause — currently playing at 1x speed").
- **When** a notification appears, **it should** be announced to screen readers (using an ARIA live region).

---

### 8. UI Polish & Clarity (Slice 1 Minimum)

#### 8.1 Responsive Basics
- **When** I view the game on a 1366×768 screen (common Chromebook resolution), **I should see** the full game interface without horizontal scrolling. Grid plots should be large enough to be easily clickable.
- **When** I view the game on a 1920×1080 screen, **I should see** the interface scale up gracefully (larger plots, more whitespace, same layout).

#### 8.2 Plot Visual States
- **When** a plot is empty, **I should see** it displayed as bare soil (distinct from planted plots).
- **When** a plot has a growing crop, **I should see** an indicator of which crop it is and its approximate growth stage (visual difference between seedling and mature).
- **When** a plot's crop is harvestable, **I should see** a clear "ready" visual (distinct color, icon, or badge — e.g., golden border).
- **When** a plot's crop is overripe (in grace period), **I should see** an amber warning indicator distinct from the harvestable state.
- **When** a plot's soil moisture is below 30%, **I should see** a yellow dryness indicator.
- **When** a plot's soil moisture is below 15%, **I should see** a red wilting indicator.

#### 8.3 Notification Bar
- **When** something notable happens (harvest, season change, low nitrogen hint, water stress), **I should see** a message appear in the notification bar at the bottom of the screen.
- **When** I click "Dismiss" on a notification, **I should see** it disappear.
- **When** multiple notifications queue up, **I should see** them displayed in order (newest first or a count indicator showing how many are pending).

#### 8.4 Empty State
- **When** I start a new game and the field is empty (after completing or skipping the tutorial), **I should see** a subtle prompt: "Select a plot and plant your first crop!"

---

### 9. Performance

#### 9.1 Frame Rate
- **When** running at 4x speed with a full field of growing crops, **the game should** maintain at least 30fps on a 2023 Chromebook (Intel N100, 4GB RAM, Chrome OS).
- **When** running at 1x speed, **the game should** feel smooth with no perceptible lag between clicking a button and seeing its effect.

#### 9.2 Simulation Tick Speed
- **When** running headless engine tests, **a single simulation tick should** complete in ≤4ms (hard ceiling; typical should be ≤1ms).
- **When** running at 4x speed (48 ticks/sec) at 30fps, **the engine runs ~2 ticks per frame.** Total simulation time per frame should be ≤8ms, leaving ≥25ms of the 33ms frame budget for rendering.

*Math: 1x = 12 ticks/sec. 4x = 48 ticks/sec. At 30fps: 48 ÷ 30 ≈ 1.6 ticks/frame (rounded up to 2). At 2 ticks × 4ms ceiling = 8ms max sim cost per frame.*

#### 9.3 Load Time
- **When** I open the app, **I should see** the game interface rendered and interactive within 4 seconds on a Chromebook (including loading the climate scenario data).
- **When** the JS bundle is measured, **it should** be ≤200KB gzipped.

---

### 10. Negative Cases & Edge Cases

#### 10.1 Rapid Clicking
- **When** I rapidly click "Plant Field" multiple times, **the system should** only plant once (idempotent — second click sees plots already occupied). Cash should only be deducted once.
- **When** I rapidly click "Harvest Field" multiple times, **the system should** only harvest once (second click finds no harvestable plots).

#### 10.2 Speed + Actions
- **When** I issue a plant command while the game is running at 4x, **the system should** process the command at the correct in-game time (not duplicated across ticks).
- **When** I pause, plant, then unpause, **the game should** resume with the crop already in the ground at the day it was planted.

#### 10.3 Season Boundaries
- **When** the last day of a season ticks over, **the system should** transition cleanly to the next season with no visual glitches and no simulation errors.
- **When** Year 30 ends, **the system should** show "Congratulations! You completed 30 years of farming!" with final cash balance and a "Start New Game" button.

#### 10.4 Empty Field + No Cash
- **When** I let time run with no crops planted, **the system should** still tick correctly (soil moisture changes with weather, but no crop-related calculations). Cash remains unchanged.
- **When** I have no crops, no harvestable crops, and cash ≤ $0, **the system should** trigger game over (see §5.4).

#### 10.5 Invalid States
- **When** a simulation bug causes NaN or Infinity in any value (cash, soil N, moisture, yield), **the system should** catch it via runtime assertions and pause with an error message rather than silently propagating bad data. (This is a test for the engine, not something the student should ever see.)
- **When** the game attempts to read a crop definition that doesn't exist (bad cropId), **the system should** throw a clear error at command validation time, not during growth simulation.

---

### 11. data-testid Coverage (Slice 1)

Every interactive element listed below MUST have a data-testid. Tests will verify their presence.

#### Top Bar
- `topbar-date` — current date display
- `topbar-cash` — cash balance display
- `topbar-season-icon` — season indicator
- `speed-pause` — pause button
- `speed-play` — 1x speed button
- `speed-fast` — 2x speed button
- `speed-fastest` — 4x speed button

#### Farm Grid
- `farm-grid` — the grid container
- `farm-cell-{row}-{col}` — each of the 64 plots (e.g., `farm-cell-0-0` through `farm-cell-7-7`)

#### Actions
- `action-plant` — open plant menu (single plot context)
- `action-plant-all` — plant all empty plots ("Plant Field")
- `action-plant-row-{n}` — plant row n
- `action-plant-col-{n}` — plant column n
- `action-harvest` — harvest single plot
- `action-harvest-all` — harvest all ready plots ("Harvest Field")
- `action-harvest-row-{n}` — harvest row n
- `action-harvest-col-{n}` — harvest column n
- `action-water-all` — water all planted plots ("Water Field")
- `action-water-row-{n}` — water row n
- `action-water-col-{n}` — water column n

#### Crop Menu
- `menu-crop-{cropId}` — each crop option (e.g., `menu-crop-processing-tomatoes`)
- `menu-cancel` — cancel/close the crop menu

#### Side Panel
- `sidebar-soil-n` — nitrogen display
- `sidebar-soil-moisture` — moisture display
- `sidebar-soil-om` — organic matter display
- `sidebar-crop-name` — current crop name in selected plot
- `sidebar-crop-growth` — growth progress bar/indicator
- `sidebar-cell-detail` — plot detail container

#### Save/Load
- `save-button` — manual save button
- `save-new-game` — new game button
- `save-resume` — continue/resume button

#### Notifications
- `notify-bar` — notification bar container
- `notify-dismiss` — dismiss button on current notification

#### Auto-Pause Panels
- `autopause-panel` — the auto-pause overlay container
- `autopause-action-primary` — primary action button (e.g., "Harvest Field", "Water Field")
- `autopause-action-secondary` — secondary action (e.g., "Continue", "Continue without watering")
- `autopause-dismiss` — dismiss/acknowledge button

#### New Game Screen
- `newgame-player-id` — Player ID input field
- `newgame-start` — Start button

#### Tutorial
- `tutorial-overlay` — tutorial container
- `tutorial-step` — current tooltip step
- `tutorial-next` — "Next" button
- `tutorial-skip` — "Skip" button
- `tutorial-dont-show` — "Don't show again" checkbox

#### Game Over / Year 30
- `gameover-panel` — game over overlay
- `gameover-report` — final report content
- `gameover-new-game` — "Start New Game" button
- `year30-panel` — Year 30 completion overlay
- `year30-new-game` — "Start New Game" button

#### Bulk Confirmation Dialog
- `confirm-dialog` — confirmation dialog container
- `confirm-accept` — accept/confirm button
- `confirm-cancel` — cancel button
- `confirm-message` — the message text (e.g., "Plant 3 rows for $2,400?")

---

## Slice 2: Events, Perennials, Loans & Advisor

> **Status: APPROVED — Locked for implementation.**
> Sub-sliced into 2a (events + loans), 2b (perennials), 2c (advisor + chill hours).

### Slice 2 Scope Lock

- **Core (must ship):** Storylet/event engine + foreshadowing + 1 advisor (extension agent) + perennials (almonds, pistachios) + 3 events + minimal emergency loan
- **Stretch (only after Core passes all gates):** Market price fluctuation events OR a 2nd advisor
- **Deferred to Slice 3:** Tech tree, remaining advisors, insurance, credit systems, perennial decline phase

---

### Sub-Slice 2a: Event System + Emergency Loan

#### 12. Event System

##### 12.1 Event Triggers
- **When** the game simulation is running and an event's preconditions are met, **the system should** auto-pause and display an event panel with the event title, description, and choice buttons.
- **When** an event fires, **I should see** the event panel overlay with clearly described choices and their costs/consequences.
- **When** I click a choice button, **I should see** the effects applied immediately (cash changes, notifications, etc.) and the game resume.
- **When** multiple events are eligible on the same tick, **the system should** select the highest-priority event (priority >= 100 is guaranteed; otherwise weighted random by priority).
- **When** an event has a cooldown, **the system should NOT** fire the same event again within the cooldown period.

##### 12.2 Concrete Events (2a)
- **When** it is summer, year 2+, **I may see** a "Heatwave Advisory" event. Choices: Emergency irrigation ($500, moisture boost) or Wait and hope (yield penalty for 14 days).
- **When** it is summer, year 3+, **I may see** a "Water Allocation Cut" event. Choices: Accept higher costs (irrigation +50% for 90 days) or Cut irrigation (watering restricted 45 days).
- **When** it is spring, crops are planted, **I may see** a "Late Frost Warning" event. Choices: Frost protection ($300) or Accept the risk (yield penalty for 7 days).

##### 12.3 Foreshadowing
- **When** an event with foreshadowing is approaching, **I should see** a notification N days before the event fires (e.g., "Weather service reports: high pressure building. Possible record heat next week.").
- **When** foreshadowing has reliability < 1.0, **I may see** false alarms — the notification appears but the event does not fire. A follow-up notification should say the predicted event did not materialize.
- **When** foreshadowing fires and the event follows, **I should see** the event panel auto-pause when the foreshadowed day arrives.

##### 12.4 Event Effects
- **When** an event choice applies a yield modifier, **I should see** affected crop harvests reflect the modifier during the effect duration.
- **When** an event choice applies a watering restriction, **the system should** block WATER commands for the duration. Water buttons should be disabled with a tooltip explaining the restriction.
- **When** multiple active effects stack on the same crop, **the system should** multiply them together (e.g., two 0.85 modifiers = 0.7225). Modifier product is clamped to [0.0, 10.0].
- **When** an active effect's duration expires, **I should see** it stop affecting calculations immediately.

#### 13. Emergency Loan

##### 13.1 First Bankruptcy — Loan Offer
- **When** my cash drops to $0 or below for the first time, **I should NOT** see a game-over screen. Instead, the game auto-pauses with a loan offer panel showing: the loan amount, 10% annual interest rate, and a warning that this is a one-time opportunity.
- **When** the loan is offered, the amount **should be** automatically calculated by the engine: enough to cover my deficit plus a $5,000 buffer, rounded up to the nearest $1,000.
- **When** I click "Accept Loan", **I should see** my cash increase by the loan amount, a debt counter appear in the top bar, and the game resume.
- **When** I click "Decline Loan", **I should see** the game-over panel (same as Slice 1 bankruptcy).

##### 13.2 Debt Mechanics
- **When** I have outstanding debt, **I should see** it displayed in the top bar next to cash (e.g., "Cash: $12,000 | Debt: $8,000" with debt in red).
- **When** I harvest a crop while in debt, **I should see** 20% of the gross harvest revenue automatically applied to debt repayment, with a notification explaining the deduction (e.g., "$200 applied to loan repayment. Remaining debt: $7,800").
- **When** the year ends and I have debt, **I should see** interest paid and remaining debt in the year-end summary.
- **When** my cash drops to $0 or below a second time (after already taking a loan), **I should see** the game-over panel — no second loans.
- **When** my debt exceeds $100,000, **I should see** the game-over panel with a message about debt becoming unsustainable.

#### 14. Auto-Pause Priorities (Slice 2 additions)

| Reason | Priority | New in Slice 2? |
|--------|----------|-----------------|
| bankruptcy | 100 | No |
| year_30 | 100 | No |
| loan_offer | 95 | Yes |
| event | 85 | Yes |
| advisor | 82 | Yes |
| harvest_ready | 80 | No |
| water_stress | 60 | No |
| year_end | 40 | No |

#### 15. Save Versioning
- **When** I load a v2 save, **the system should** load it normally.
- **When** I load a v1 save (from Slice 1), **the system should** either fill missing fields with safe defaults and load, or show "Save from older version — please start a new game." Either is acceptable.

---

### Sub-Slice 2b: Perennial Crops

#### 16. Perennial Planting

##### 16.1 Crop Menu
- **When** I open the plant menu, **I should see** perennial crops (Almonds, Pistachios) alongside annual crops, with their establishment cost shown (e.g., "$960/plot") and a warning: "Takes 3 years before first harvest."
- **When** it is outside the perennial planting window (Jan-Mar), **I should see** perennial crops greyed out with tooltip: "Planting window: January–March."
- **When** I don't have enough cash for the establishment cost, **I should see** the perennial crop greyed out with tooltip showing cost vs. available cash.

##### 16.2 Establishment Period
- **When** I plant almonds, **I should see** a tree indicator in the cell and "Establishing — Year 1/3" in the side panel.
- **When** time passes during establishment, **I should see** the year counter increment at year boundaries (Year 1/3 → Year 2/3 → Year 3/3 → "Producing").
- **When** a perennial crop is in establishment, **I should NOT** see a "Harvest" button or any harvest revenue.
- **When** the year ends with perennials planted, **I should see** maintenance costs deducted ($200/plot for almonds, $180/plot for pistachios) in the year-end summary.

##### 16.3 Dormancy
- **When** winter arrives and I have perennials, **I should see** the perennial cells show a muted/dormant visual (distinct from growing state).
- **When** a perennial is dormant, **I should NOT** see GDD accumulation or growth stage changes.
- **When** spring arrives after dormancy, **I should see** the perennial resume normal growth.

##### 16.4 Perennial Harvest
- **When** a perennial crop reaches harvestable stage (after establishment), **I should see** the auto-pause and harvest option, same as annuals.
- **When** I harvest a perennial crop, **I should see** revenue added to cash but the crop REMAINS in the cell (not cleared to empty). The cell shows the tree still present.
- **When** a perennial crop becomes overripe, **I should see** the same 30-day grace period as annuals, BUT the crop survives (yield = 0 for that year, crop is not destroyed).

##### 16.5 Perennial Removal
- **When** I select a cell with a perennial crop, **I should see** a "Remove" button in the side panel (not available for annual crops).
- **When** I click "Remove", **I should see** a confirmation dialog: "Remove almonds? This costs $500 and cannot be undone. The plot will be cleared for replanting."
- **When** I confirm removal, **I should see** the removal cost deducted, the cell cleared to empty, and a notification confirming the removal.

##### 16.6 Hard Boundary (NOT in 2b)
- **I should NOT** see any chill-hour data, chill-hour warnings, or chill-related yield penalties in Sub-Slice 2b. Chill mechanics ship in 2c.
- **I should NOT** see yield decline over time. Binary yield only: 0 during establishment, full production after.

---

### Sub-Slice 2c: Extension Agent Advisor + Chill Hours

#### 17. Extension Agent Advisor

##### 17.1 Advisor Appearance
- **When** the extension agent's trigger conditions are met, **the system should** auto-pause and show an advisor panel with: the advisor's name ("Dr. Maria Santos"), role ("County Extension Agent"), and dialogue text with recommendations.
- **When** the advisor panel appears, **I should see** 1-2 choice buttons (e.g., "Thanks for the advice" or "Tell me more about pistachios").
- **When** I click a choice, **I should see** the advisor panel dismiss and the game resume.

##### 17.2 Advisor Triggers
- **When** my average soil nitrogen drops below 50 lbs/acre (year 2+), **I should see** the extension agent recommend crop rotation.
- **When** I experience my first crop failure, **I should see** the extension agent recommend diversification.
- **When** I have perennials planted and it's year 8+, **I should see** the extension agent warn about declining chill hours and suggest pistachios.
- **When** my cash drops below $30,000 (year 4+), **I should see** the extension agent offer water conservation tips.
- **When** my cash is above $40,000, I have no debt, and no perennials (year 3+), **I should see** the extension agent suggest planting perennial crops (one-time).

##### 17.3 Advisor Cooldowns
- **When** the extension agent has appeared recently (within cooldown period), **the system should NOT** show the same advisor message again. Each trigger has its own cooldown.
- **When** I play a full 30-year game with poor practices (monoculture, no rotation), **I should see** the extension agent appear at least 3 times with relevant advice.

#### 18. Chill Hours

##### 18.1 Fog-of-War Reveal
- **When** I start a new game, **I should NOT** see any chill-hour data in the side panel.
- **When** the extension agent fires the chill-hour warning (trigger #3) OR I plant my first perennial, **I should see** chill-hour data appear in the side panel for perennial cells. This is permanent — once revealed, it stays visible.
- **When** chill-hour data is revealed, **I should see** the current winter's accumulated chill hours and the crop's requirement (e.g., "Chill hours: 680 / 700 required").

##### 18.2 Chill-Hour Mechanics
- **When** winter arrives and I have perennials, **the system should** accumulate chill hours daily during dormancy, using pre-defined yearly chill values from the scenario data (see §18.3).
- **When** a perennial's accumulated chill hours are below its requirement at spring, **I should see** a yield penalty proportional to the deficit.
- **When** the climate scenario has declining chill hours over 30 years, **I should see** almonds (700 required) become unreliable before pistachios (600 required) — this is the core teachable moment.
- **When** chill-hour deficit causes a yield penalty, **I should see** an explanation in the side panel or notification (e.g., "Insufficient winter chill: almond yield reduced to 60%.").

##### 18.3 Chill Hours in Scenario Data
- **When** the scenario generates winter weather, **the system should** use pre-defined chill hours that decline over 30 years: ~800 (years 1-5) → ~700 (years 6-15) → ~630 (years 16-25) → ~570 (years 26-30).

#### 19. Stretch Events (Slice 3 — sub-slice 3a1)

##### 19.1 Market Price Fluctuation
- **When** it is not winter, year 2+, **I may see** a "Tomato Market Surge" event (type: market, priority 45, cooldown 365 days, 10% random chance).
- **When** the event fires, **I should see** a single choice: Acknowledge → tomato price x1.4 for 60 days.
- **When** a price modifier is active, **I should see** affected crop harvests reflect the modified price.
- **When** I harvest tomatoes during a price surge, **I should see** revenue at 1.4x base price.
- **When** the 60-day duration expires, **I should see** tomato prices return to normal.

##### 19.2 Regulatory Water Restriction
- **When** it is summer, year 5+, **I may see** a "Groundwater Pumping Ban" event (type: regulatory, priority 55, cooldown 730 days, 12% random chance).
- **When** the event fires, **I should see** two choices: Comply (no irrigation 30 days) or Buy surface water rights ($1,000).
- **When** I choose Comply, **I should NOT** be able to water any plots for 30 days.
- **When** I choose Buy surface water rights, **I should see** $1,000 deducted and watering remains available.
- **This event has no foreshadowing** — matches real-world sudden regulatory action.

---

## Slice 3: Depth & Discovery

### Sub-slice 3a1: New Crops

#### 20. Sorghum (Annual)

##### 20.1 Planting & Growth
- **When** I open the plant menu during April-June, **I should see** Sorghum available with cost $35/plot.
- **When** I plant sorghum, **I should see** it grow based on GDD accumulation (base 50°F, 2200 GDD to maturity).
- **When** I plant sorghum outside April-June, **I should see** sorghum greyed out with tooltip: "Planting window: April-June."

##### 20.2 Drought Tolerance
- **When** I compare sorghum to corn under identical water stress, **I should see** sorghum suffer less yield loss (ky=0.50 vs corn's ky=1.00).
- **When** water is scarce, sorghum is the "survival crop" — lower revenue ($660/acre) but survives conditions that kill tomatoes/corn.

##### 20.3 Economics
- **When** I harvest sorghum at full yield, **I should see** revenue of $660/plot (110 bu × $6/bu).
- **When** I harvest sorghum under severe water stress, **I should see** reduced yield but proportionally less loss than tomatoes or corn.

#### 21. Citrus Navels (Perennial)

##### 21.1 Planting & Establishment
- **When** I open the plant menu during February-April, **I should see** Citrus Navels available with cost $800/plot and warning: "Takes 3 years before first harvest."
- **When** I plant citrus, **I should see** "Establishing — Year 1/3" in the side panel.
- **When** 3 years pass, **I should see** citrus become "Producing" (established).

##### 21.2 Evergreen Behavior (No Dormancy)
- **When** winter arrives and I have citrus, **I should NOT** see the dormant visual state. Citrus is evergreen — it stays green year-round.
- **When** citrus is in winter, **I should see** it continue consuming water (no dormancy kc reduction).
- **I should NOT** see chill-hour accumulation or chill penalties for citrus (no `chillHoursRequired`).

##### 21.3 Harvest Cadence
- **When** I harvest citrus in year 1 of production, **I should see** the harvest succeed and `harvestedThisSeason` set.
- **When** the year boundary passes (year-end), **I should see** `harvestedThisSeason` reset for all perennials (including citrus).
- **When** year 2 arrives after harvest, **I should be able to** harvest citrus again.
- **When** I harvest citrus and the year-end tick occurs on the same day, **I should NOT** be able to harvest twice on that day (double-harvest regression guard).

##### 21.4 Economics
- **When** I harvest citrus at full yield, **I should see** revenue of $4,900/plot (350 boxes × $14/box).
- **When** I compare citrus to almonds, citrus is less profitable at peak ($4,900 vs $6,250) but never declines and never loses chill hours.
- **When** I have citrus in year 20+, **I should see** stable production while almonds suffer chill-hour deficits.

##### 21.5 Maintenance & Removal
- **When** the year ends with citrus planted, **I should see** maintenance costs deducted ($150/plot).
- **When** I click "Remove" on citrus, **I should see** a confirmation dialog with removal cost ($400).

### Sub-slice 3a2: Perennial Yield Curves

#### 22. Age-Based Yield Factor

##### 22.1 Ramp Phase
- **When** an almond tree becomes established (age 3, productive year 0), **I should see** yield at 60% of potential.
- **When** the almond tree reaches age 4 (productive year 1), **I should see** yield at 80%.
- **When** the almond tree reaches age 5 (productive year 2), **I should see** yield at 100% (peak).

##### 22.2 Peak Phase
- **When** an almond tree is ages 6-17, **I should see** yield consistently at 100%.
- **When** a pistachio tree is ages 7-20, **I should see** yield consistently at 100%.
- **When** citrus is ages 6-30+, **I should see** yield consistently at 100% (never declines in 30-year game).

##### 22.3 Decline Phase
- **When** an almond tree reaches age 18, **I should see** yield begin declining linearly from 100%.
- **When** an almond tree reaches age 25+, **I should see** yield at floor (20%) — tree is past prime but still alive.
- **When** a pistachio tree reaches age 21, **I should see** decline begin.
- **When** a pistachio tree reaches age 29+, **I should see** yield at floor (20%).

##### 22.4 Phase Labels in Side Panel
- **When** I select a perennial cell, **I should see** one of: "Establishing", "Ramping Up (X%)", "Peak Production", "Declining", "Past Prime" based on tree age.
- **When** a perennial is in peak phase, **I should see** "Years until decline: N" information.
- **When** a perennial is declining, **I should see** "Replacement recommended" guidance.

##### 22.5 Decline Advisor
- **When** any established perennial enters the decline phase, **I should see** Dr. Santos advise: "Your trees are getting old. Consider planting replacement trees soon." (priority 90, max 2 occurrences, cooldown 730 days).

##### 22.6 Yield Factor Integration
- **When** I harvest a perennial, **the system should** apply: baseYield × waterFactor × nFactor × yieldMod × chillFactor × ageFactor. The age factor is the last multiplicative factor before final clamp.

### Sub-slice 3b: Cover Crops

#### 23. Cover Crop Planting

##### 23.1 Planting Window
- **When** it is fall (months 9-11, September-November), **I should see** a "Plant Cover Crop" button in the side panel.
- **When** it is NOT fall, **I should NOT** see the cover crop planting option.

##### 23.2 Eligible Cells
- **When** I try to plant a cover crop on an empty cell, **the system should** allow it.
- **When** I try to plant a cover crop on a cell with a deciduous perennial (has `dormantSeasons`), **the system should** allow it regardless of current dormancy state (understory planting — real orchard practice).
- **When** I try to plant a cover crop on a cell with an evergreen perennial (citrus — no `dormantSeasons`), **the system should** reject it.
- **When** I try to plant a cover crop on a cell with a growing annual, **the system should** reject it.

##### 23.3 Cost
- **When** I plant a legume cover crop, **I should see** $30 deducted per plot.
- **When** I plant cover crops on the full field (64 plots), **I should see** $1,920 deducted total.

##### 23.4 Bulk Operations
- **When** I click "Plant Cover Crop — Field" and can't afford all 64 plots, **I should see** the DD-1 partial-offer pattern: round down to complete rows.
- **When** I click "Plant Cover Crop — Row/Col", **it should** be all-or-nothing for that scope.

#### 24. Cover Crop Winter Behavior

##### 24.1 ET Rules
- **When** a cover crop is planted on an empty cell, **the system should** use ET = et0 × 0.2 (instead of bare-soil 0.3).
- **When** a cover crop is planted alongside a dormant perennial, **the system should** use ET = et0 × max(crop_kc, 0.2). For dormant perennial (kc=0.2): max(0.2, 0.2) = 0.2.
- **When** a cell has a cover crop, **the system should** halt OM decomposition during winter (cover crop roots protect soil).

##### 24.2 Visual Indicator
- **When** a cell has a cover crop planted, **I should see** a visual indicator on the farm cell (subtle green tint or clover icon).

#### 25. Cover Crop Incorporation (Spring)

##### 25.1 Auto-Incorporate
- **When** the season changes from winter to spring, **the system should** automatically incorporate all cover crops.
- **When** cover crops are incorporated, **I should see** a notification: "Cover crops incorporated on N plots: +50 lbs/ac nitrogen, +0.10% organic matter, -0.5in moisture."

##### 25.2 Soil Effects
- **When** a legume cover crop is incorporated, **I should see** nitrogen increase by +50 (clamped to [0, 200]).
- **When** a legume cover crop is incorporated, **I should see** organic matter increase by +0.10%.
- **When** a legume cover crop is incorporated, **I should see** moisture decrease by 0.5 inches (tradeoff — fields start spring drier).

##### 25.3 Post-Incorporation
- **When** cover crops are incorporated, **the system should** clear `coverCropId` on all affected cells.
- **When** spring arrives after incorporation, **the cell should** be available for normal planting.

#### 26. Save Migration (V3 → V4)
- **When** I load a v3 save, **the system should** migrate it to v4 by adding `coverCropId: null` to all cells and `frostProtectionEndsDay: 0` to GameState.
- **When** I view manual saves from a v3 game, **the system should** show them in the Load Game list (migration applied in `listManualSaves` too).
- **When** I load a v1 or v2 save, **the system should** chain migrations: V1→V2→V3→V4.

### Sub-slice 3c: Weather Service Advisor

#### 27. Weather Service Character

##### 27.1 Advisor Appearance
- **When** a weather service storylet fires, **I should see** the advisor panel with name "NWS Fresno", role "National Weather Service — Fresno Office", and subtitle "Forecast accuracy varies by timeframe".
- **When** I see a weather advisor event, **I should see** confidence language in the description ("High confidence", "Moderate confidence", or "Low confidence").

##### 27.2 Character Routing
- **When** an extension agent (Dr. Santos) storylet fires, **I should see** the Dr. Santos character in the advisor panel.
- **When** a weather service storylet fires, **I should see** the NWS Fresno character in the advisor panel. These are distinct advisor characters.

#### 28. Weather Storylets

##### 28.1 Heat Forecast
- **When** it is summer, year 2+, and I have crops, **I may see** a "Heat Forecast" (priority 85, cooldown 180 days, max 4 occurrences, 25% random). Description includes "High confidence."
- **When** I choose "Pre-irrigate Fields", **I should see** $200 deducted and +1.5 inches moisture added to all cells.
- **When** I choose "Monitor Conditions", **I should see** an informational notification only.

##### 28.2 Frost Alert
- **When** it is spring and I have crops, **I may see** a "Frost Alert" (priority 85, cooldown 365 days, max 3 occurrences, 20% random). Description includes "Moderate confidence."
- **When** I choose "Deploy Frost Protection", **I should see** $150 deducted and a "Frost Protection Active (14 days)" indicator.
- **When** I choose "Wait and See", **I should see** an informational notification only.

##### 28.3 Drought Outlook
- **When** it is spring, year 5+, **I may see** a "Drought Outlook" (priority 80, cooldown 730 days, max 2 occurrences, 15% random). Description includes "Low confidence."
- **When** I choose "Plan for Drought", **I should see** an informational notification mentioning sorghum as a drought-tolerant option.
- **When** I choose "Too Uncertain to Act", **I should see** an informational notification.

#### 29. Frost Protection Mechanism

##### 29.1 Activation
- **When** I choose "Deploy Frost Protection" from the weather-frost-alert, **I should see** `frostProtectionEndsDay` set to current day + 14.
- **When** frost protection is active, **I should see** "Frost Protection Active (X days remaining)" in the UI.

##### 29.2 Interaction with Late Frost Warning
- **When** a late-frost-warning event fires while frost protection is active, and I choose "Accept the Risk", **I should see** a yield penalty of 0.85 (not the full 0.70). A notification explains: "Your frost protection reduced crop losses."
- **When** frost protection is consumed by a frost event, **I should see** `frostProtectionEndsDay` reset to 0 (protection used up).

##### 29.3 Full Protection Overrides
- **When** a late-frost-warning event fires while frost protection is active, and I choose "Frost Protection" ($300 full protection), **I should see** no yield penalty and the weather protection is NOT consumed (remains active for future frost events).

##### 29.4 Natural Expiry
- **When** frost protection expires naturally (14 days pass with no frost event), **it should** become inactive silently. No notification, no yield effect. UI indicator disappears.

##### 29.5 Non-Frost Events
- **When** a heatwave or other non-frost event fires while frost protection is active, **the system should NOT** consume or modify frost protection. Only late-frost-warning events interact with it.

---

## Slice 4: Balance, Scoring & Classroom Readiness

### 30. Balance & Pedagogy Contract

The game must produce outcomes where **strategy matters more than luck**. Bad farming should fail. Good farming should succeed. Monoculture should be risky. Diversification and climate adaptation should be rewarded. These targets are validated by headless balance tests (ARCHITECTURE.md §12 Layer 2) across multiple seeds and scenarios.

#### 30.1 Strategy Archetype Targets

Five reference strategies define the difficulty curve. All targets are evaluated as **medians and 10th-percentile (p10) outcomes across ≥20 seeds per scenario**, not single runs.

| Archetype | Description | 30-Year Survival Rate | Median Final Cash | Intent |
|-----------|-------------|----------------------|-------------------|--------|
| **Almond Monoculture** | 64 almonds year 1, no adaptation | ≤40% | Below starting cash | Monoculture + ignoring climate = failure |
| **Corn Monoculture** | 64 corn every spring, basic watering | ≤60% | Modest or bankrupt | Repetitive low-value strategy struggles |
| **Zero Irrigation** | Plant and abandon, never water | ≤20% | Bankrupt by year 10 | Neglect = fast failure |
| **Diversified Adaptive** | Mixed crops, rotates with conditions, uses cover crops, heeds advisors | ≥80% | Well above starting cash | Smart play is rewarded |
| **Citrus Stability** | All citrus, consistent watering | 60-80% | Moderate | Safe but not optimal |

- **When** the almond monoculture strategy is run across all scenarios and seeds, **its median final cash should be** below starting cash ($50,000), and **its p10 should be** bankrupt (cash ≤ 0).
- **When** the diversified adaptive strategy is run, **its median final cash should be** well above starting cash, and **its p10 should be** above starting cash (survives even bad luck).
- **When** any two strategy archetypes are compared, **I should see** that the diversified adaptive strategy outperforms monocultures in median outcome across all scenarios.

#### 30.2 Multiple Viable Paths

- **When** balance tests are run, **at least 3 distinct strategy families** (e.g., diversified annual rotation, mixed perennial/annual, citrus-heavy with cover crops) must complete 30 years with positive cash in ≥60% of runs.
- **No single strategy should be** the only winning path. If only one strategy family survives, the balance is broken.
- **When** a student plays thoughtfully (reads advisors, rotates crops, manages water), **they should** succeed regardless of which specific crop mix they chose.

#### 30.3 Anti-Luck Requirement

- **When** evaluating game balance, outcomes must be judged on **median and p10** across ≥20 seeds per scenario, not best-case or single runs.
- **When** two students play the same strategy with different RNG seeds, **the variance in final cash should be** less than 2× between p25 and p75 (consistent strategies produce consistent results; luck doesn't dominate).
- **When** the diversified-adaptive bot is run across all scenarios and seeds, **no individual seed should** produce bankruptcy (0% bankruptcy rate for the best strategy — no unwinnable seeds exist).
- **When** any monoculture bot survives a scenario, **switching to the diversified-adaptive bot with the same seed should also** survive (good strategy never does worse than bad strategy on the same luck).

#### 30.4 Soil & Nutrient Pedagogy Targets

- **When** a student plants the same annual crop for 10+ years without cover crops or fertilizer, **they should see** nitrogen depletion cause measurable yield loss (≥20% reduction from peak).
- **When** a student uses cover crops consistently, **they should see** organic matter stabilize or increase (not decline below 1.5% after 30 years).
- **When** a student ignores soil health entirely (no cover crops, no fertilizer events), **they should see** OM drop below 1.5% by year 20, with visible yield drag.
- **When** comparing two otherwise-identical strategies, one with cover crops and one without, **the cover crop strategy should** outperform by a measurable margin (≥10% higher median final cash over 30 years).

### 31. Scoring & End-of-Game Evaluation — DEFERRED TO SLICE 6

> **Note:** Scoring formula, completion code, and Google Form integration are deferred to Slice 6. Slice 5 ships a Year-30 reflection panel using `yearSnapshots` data (narrative summary, not scored). For initial classroom use, assessment is via screenshots + bell ringer questions + classroom discussion. The spec below is retained as the design target for Slice 6.

#### 31.1 Scoring Formula

The end-of-game score rewards **resilient, sustainable farming** — not just maximum cash. The score is a weighted composite:

| Component | Weight | What It Measures | How Calculated |
|-----------|--------|-----------------|----------------|
| Financial Stability | 30% | Survived and prospered | Normalized final cash (0-100 scale, capped at reasonable ceiling) |
| Soil Health | 20% | Long-term stewardship | Average final OM% across field, normalized. Bonus for OM ≥ 2.0% (maintained or improved). |
| Crop Diversity | 20% | Adaptation and resilience | Shannon diversity index of crops planted across all years, normalized |
| Climate Adaptation | 20% | Responded to changing conditions | Outcome-based: crop transitions away from failing crops + drought-tolerant crop adoption + cover crop usage after soil decline. No credit for advisor interaction itself. |
| Consistency | 10% | Not a boom-bust rollercoaster | Inverse of year-over-year revenue variance, normalized |

- Possible future supporting metric for sustainability scoring: [SLICE6_SERVINGS_METRIC.md](/Users/naddicott/ClimateFarmer26/SLICE6_SERVINGS_METRIC.md)

- **When** a student completes 30 years, **I should see** a score breakdown showing each component with a sub-score and explanation.
- **When** a student goes bankrupt, **I should see** a partial score based on years survived and the components above up to that point.
- **When** two students compare scores, **the student who diversified and adapted should** outscore the student who monocultured, even if the monoculture student has more final cash.
- **When** two students make identical farming decisions but one clicks every advisor panel and the other dismisses them, **their scores should be** identical. No points for opening or accepting advisor prompts.
- Advisor engagement (panels viewed, choices made) is tracked as a **non-scored metric** for teacher analytics/debrief only, not included in the resilience score.

#### 31.2 Completion Code

- **When** I complete 30 years (or go bankrupt), **I should see** a human-readable completion code showing my player prefix, score, years survived, and scenario (e.g., `NEAL-78-Y30-GW`). This is a screenshot-friendly backup artifact, not a security mechanism.
- **When** I sign in with my school Google account and click "Submit Results", **the teacher should** see my results in the backend spreadsheet (authenticated via Google Identity Services).

#### 31.3 Leaderboard Framing

- The score is presented as a **farm resilience rating**, not a competition ranking. Language should frame it as "How sustainable was your farm?" not "Did you beat your classmates?"
- **When** I see my final score, **I should see** qualitative tiers: "Thriving" (80+), "Stable" (60-79), "Struggling" (40-59), "Failed" (<40).

### 32. UX Fixes (from Playtesting)

#### 32.1 Water Auto-Pause Double Confirmation (#52)
- **When** a water-stress auto-pause fires and I click "Water Field", **I should NOT** see a second confirmation dialog. The auto-pause IS the confirmation.

#### 32.2 Year-End Expense Breakdown (#53)
- **When** the year-end summary appears, **I should see** expense categories: Planting, Watering, Maintenance (with per-crop breakdown), and Loan Repayment.
- **When** I have perennial maintenance costs, **I should see** them itemized (e.g., "Almond maintenance: 8 trees × $200 = $1,600").

#### 32.3 Calendar Display Lag (#54)
- **When** I click "Continue to Year N", **I should see** the calendar update immediately (not wait for next simulation tick).

#### 32.4 Event Clustering Cap (#47) — SLICE 5
- **When** events fire during a season, **the system should** enforce separate caps: max 1 tech-unlock event + max 1 non-tech event per season (excluding condition-only advisors, which have their own cadence).
- **When** a tech-unlock event has already fired this season, **the system should** suppress additional tech-unlock events until next season.
- **When** a non-tech event (climate/market/regulatory) has already fired this season, **the system should** suppress additional non-tech events until next season.
- Tech offers **must not** starve climate pressure events, and vice versa.

#### 32.5 Pause-to-Play Transition (#50)
- **When** the game is paused at 0x speed and I have taken an action (planted, watered, etc.), **I should see** a visual prompt near the speed controls indicating I need to press play to continue.

#### 32.6 Harvest-Ready Badge and Post-Harvest Suppression (#48, #79)
- **When** a crop reaches harvestable stage, **I should see** a "Ready!" badge on the cell (`harvest-indicator-{row}-{col}`).
- **When** a crop is overripe, **I should see** a "Harvest!" badge on the cell.
- **When** a perennial has been harvested this season (`harvestedThisSeason === true`), **I should NOT see** the Ready/Harvest badge, the harvest button should be disabled, and the SidePanel should show "Already harvested this season".
- **When** a perennial is dormant, **I should NOT see** the Ready/Harvest badge and the harvest button should be disabled with a "Trees are dormant during winter" tooltip.

#### 32.7 TopBar Layout Stability (#78)
- **When** right-side content changes during gameplay (debt appearing/disappearing, frost protection indicator), the speed controls in the center of the TopBar **must not** drift more than 2px horizontally.
- **When** the viewport is narrow (1024px), the Save and New Game buttons **must** remain within the viewport.
- **When** the viewport is very narrow (900px), speed controls **must not** overlap the right-group content.

### Slice 4 data-testid Coverage

#### Scoring & End Game — DEFERRED TO SLICE 6
- `score-panel` — final score display container (Slice 6)
- `score-total` — total composite score (Slice 6)
- `score-financial` — financial stability sub-score (Slice 6)
- `score-soil` — soil health sub-score (Slice 6)
- `score-diversity` — crop diversity sub-score (Slice 6)
- `score-adaptation` — climate adaptation sub-score (Slice 6)
- `score-consistency` — consistency sub-score (Slice 6)
- `completion-code` — completion code display (Slice 6)
- `completion-copy` — copy code button (Slice 6)

#### UX Improvements
- `expense-breakdown` — year-end expense category breakdown
- `expense-line-{category}` — individual expense line item
- `play-prompt` — visual prompt to resume after action while paused
- `harvest-indicator-{row}-{col}` — harvest-ready badge (shows "Ready!" or "Harvest!"; suppressed when `harvestedThisSeason` is true or crop is dormant)

---

### Slice 3 data-testid Coverage

#### New Crops
- `menu-crop-sorghum` — sorghum option in crop menu
- `menu-crop-citrus-navels` — citrus option in crop menu

#### Perennial Phase
- `sidebar-perennial-phase` — phase label ("Establishing", "Ramping Up", "Peak", "Declining", "Past Prime")
- `sidebar-perennial-decline-info` — decline timing info ("Years until decline: N" or "Replacement recommended")

#### Cover Crops
- `action-plant-cover-crop` — single-cell cover crop button
- `action-plant-cover-crop-bulk` — bulk cover crop button
- `farm-cell-cover-{row}-{col}` — cover crop indicator on farm cell

#### Weather Advisor
- `advisor-panel` — shared advisor panel (weather and extension agent use the same panel with `advisorId` routing)
- `frost-protection-status` — frost protection active indicator

---

### Slice 2 data-testid Coverage

#### Event Panel
- `event-panel` — event overlay container
- `event-title` — event title heading
- `event-description` — narrative description
- `event-choice-{choiceId}` — each choice button (e.g., `event-choice-irrigate-extra`)
- `event-choice-cost-{choiceId}` — cost display for a choice

#### Advisor Panel
- `advisor-panel` — advisor overlay container
- `advisor-portrait` — emoji/portrait element
- `advisor-name` — advisor's name
- `advisor-role` — advisor's role subtitle
- `event-description` — dialogue text (shared test ID with event panel)
- `advisor-choice-{choiceId}` — choice buttons

#### Loan Panel
- `loan-panel` — loan offer overlay
- `loan-accept` — accept loan button
- `loan-decline` — decline (game over) button
- `loan-amount` — loan amount display
- `loan-rate` — interest rate display
- `topbar-debt` — debt display in top bar

#### Perennial Indicators
- `sidebar-perennial-age` — age display (e.g., "Year 2/3 — Establishing")
- `sidebar-perennial-chill` — chill hours display (2c only)
- `sidebar-perennial-status` — "Establishing" / "Producing" / "Dormant"
- `action-remove-crop` — remove perennial button
- `menu-crop-almonds` — almond option in crop menu
- `menu-crop-pistachios` — pistachio option in crop menu

---

---

## Slice 5: Adapt or Fail

### 33. Tech Decision Framework

#### 33.1 Tech Levels & Reconvergence
- The engine tracks three capability tracks: water (0-3), soil (0-3), crop (0-2). Levels are computed from `state.flags`, not stored separately.
- **When** two students have reached the same tech level via different specific technologies, **they should see** equivalent downstream tech offers. Different paths, same capability = same future options.

#### 33.2 Tech Decisions via Storylets
- **When** a tech decision fires (roughly every 3 years, years 3-24), **I should see** an advisor event with 2-3 mutually exclusive choices.
- **When** I pick a tech choice, **I should see** a flag set and an immediate or progressive mechanical benefit (e.g., auto-irrigation, K visibility, novel crop unlocked).
- **When** I skip/dismiss a tech decision, **the underlying problem should** resurface later with a different solution at different terms (hybrid reoffer).
- **When** a reoffer appears, **the terms should** reflect my current financial and farm state (cash, debt, crop health), not be a fixed cheaper version.

#### 33.3 Pain-Triggered Offers
- **When** I have experienced water stress repeatedly, **tech offers related to irrigation should** appear.
- **When** I have experienced yield loss or quality decline, **tech offers related to soil/nutrients should** appear.
- **When** I have not experienced a specific pain, **the corresponding tech offer may still appear** but with lower priority.

#### 33.4 Auto-Irrigation
- **When** I have any water-level-1+ tech (drip, deficit, smart irrigation), **the system should** auto-irrigate when moisture drops below threshold instead of showing a water_stress auto-pause.
- **When** auto-irrigation fires, **I should see** a notification (with varied text — never the same message twice in a row).
- **When** auto-irrigation fires, **it should** cost money (reduced from manual: 30% savings at level 1, 50% at level 2).
- **When** I can't afford auto-irrigation, **the system should** fall back to a water_stress auto-pause.

### 34. Competing Advisors

- **When** a major decision appears (tech choices, regime shift responses), **I should see** conflicting recommendations from different advisors.
- **When** Dr. Santos recommends a sustainability option, **Marcus Chen (Valley Farm Credit) should** recommend the ROI-maximizing option.
- **When** a novel or unconventional option exists, **the Valley Growers Forum should** be the source.
- Advisors should have visible character flaws: Santos can be too conservative, Chen too focused on short-term returns, the Forum sometimes wrong.

### 35. K-Lite Potassium

- **When** any crop is harvested, **the system should** deplete potassium from the cell's soil based on crop-specific uptake.
- **When** potassium is low, **harvest prices should** be reduced (quality penalty, max 30% reduction). This affects ALL players regardless of soil testing.
- **When** potassium is low and I do NOT have soil testing tech, **I should see** ambiguous symptom cues: "leaf edges look stressed," "harvest quality seems lower than expected," "quality likely reduced by an unmeasured nutrient issue."
- **When** potassium is low and I DO have soil testing tech, **I should see** the K level numerically in SidePanel and specific advisor guidance on K management.
- **When** I do not monitor K, **I should NOT** gain a strategic advantage over players who do — K penalties apply equally regardless of awareness.

### 36. Regime Shifts (Persistent)

- **When** a regime shift fires, **ALL choices should** lead to the permanent state change. The player chooses HOW to cope, not WHETHER the shift happens.
- **When** the water regime shift fires (year 10-12), **water allocation should** permanently drop to 80% for the rest of the game.
- **When** the market regime shift fires (year 15-18), **one dominant crop's price should** permanently drop 25-40%. Which crop is affected varies by scenario.
- **When** the heat regime shift fires (year 20-25), **heat-sensitive crops should** receive a permanent yield penalty.

### 37. Novel Crops (Tech-Gated)

- **When** I have NOT unlocked a novel crop via tech research, **I should NOT see** it in the crop menu or be able to plant it.
- **When** I unlock a novel crop, **I should see** it appear in the crop menu with a "NEW" indicator and be able to plant it.
- Novel crops: agave (drought-adapted perennial), heat-tolerant avocados (heat-adapted perennial), table grapes (high-value, heat-vulnerable perennial — stretch).

### 38. Message Variety

- **When** water stress fires repeatedly, **I should see** different notification text each time (pool of ≥5 variants).
- **When** a season changes, **I should see** contextual messages that reference current farm state, not identical text every season.
- **When** the same auto-pause reason fires again, **I should NOT see** the exact same message text as last time.

### 39. Year-30 Reflection Panel

- **When** I complete 30 years, **I should see** a reflection panel summarizing my farming arc: financial trajectory, soil health trend, key decisions, crops grown, advisors consulted, regime shifts weathered.
- **When** I go bankrupt, **I should see** a similar panel for the years I survived.
- The reflection panel uses `yearSnapshots` data. No composite score yet (Slice 6).

### 40. Harvest Affordance (#62)

- **When** any plots on the field are harvestable, **the Harvest Field button should** show "(N ready)" with the count of harvestable plots.
- **When** no plots are harvestable, **the button should** show no count.

### Slice 5 data-testid Coverage

#### Tech Decisions
- `tech-choice-{choiceId}` — tech decision choice button
- `tech-decision-panel` — tech decision event panel

#### Advisors
- `advisor-panel-farm-credit` — banker advisor panel
- `advisor-panel-growers-forum` — community advisor panel

#### Novel Crops
- `menu-crop-agave` — agave option in crop menu (when unlocked)
- `menu-crop-heat-avocado` — heat-tolerant avocado option (when unlocked)
- `menu-crop-table-grapes` — table grape option (when unlocked)
- `crop-locked-{cropId}` — locked crop indicator (not yet researched)

#### Reflection
- `reflection-panel` — year-30 reflection display
- `reflection-financial` — financial arc summary
- `reflection-soil` — soil health trajectory
- `reflection-decisions` — key decisions summary

#### Soil (K-lite)
- `sidebar-soil-k` — potassium display (when soil testing unlocked)
- `sidebar-soil-k-hidden` — hidden K indicator ("???")

*Slice 6 specs (scoring, completion code, Google Form) will be added after Slice 5 ships.*
