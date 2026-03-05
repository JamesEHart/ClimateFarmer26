# KNOWN_ISSUES.md

## Pre-Development (Planning Phase)

### Resolved from Senior Engineer Review (2026-02-12)

1. **Climate data size** — Original design stored 10,950 daily weather entries per scenario (~500KB-1MB each). Revised to seasonal parameters + procedural daily generation (~10KB each). Resolved in ARCHITECTURE.md §5.3.

2. **Command type safety** — Original `Command` interface used `payload: unknown`, defeating TypeScript safety. Revised to discriminated union with fully-typed command variants. Resolved in ARCHITECTURE.md §5.2.

3. **localStorage bloat** — Original save included full command log (unbounded growth). Revised to state-snapshot-only saves (~20-30KB). No undo/rewind. localStorage budget: 5-10MB available, well within limits. Resolved in ARCHITECTURE.md §5.12.

4. **Privacy/student data** — Original design stored "studentName" in save and completion code. Revised to "playerId" (teacher-assigned code or nickname). App does not require PII, but cannot prevent students from entering identifiable info as their Player ID — teachers should instruct use of assigned codes. Added privacy section to ARCHITECTURE.md §10.

5. **Doc drift (lettuce)** — Test example referenced lettuce, which isn't in the San Joaquin Valley crop roster. Fixed to sorghum.

6. **Undo references** — Stale references to undo/replay capability removed after decision to not support undo (saves are snapshots, not command logs).

7. **Open question categorization** — Split into blocking-for-Slice-1, blocking-for-Slice-2, and deferrable. Added in ARCHITECTURE.md §14.

8. **Scope risk / slicing** — Added explicit Slice 1-4 breakdown in ARCHITECTURE.md §13, defining what's in each slice and what the acceptance gate is.

9. **data-testid naming convention** — Added standard in ARCHITECTURE.md §11.

### Resolved from SPEC.md Senior Engineer Review (2026-02-12)

10. **Conflicting performance criteria** — SPEC.md stated tick ≤4ms AND 48 ticks/frame ≤16ms (which implies ≤0.33ms/tick). The "48 ticks per frame" math was wrong: at 4x speed (48 ticks/sec) and 30fps, there are ~2 ticks per frame, not 48. Fixed in SPEC.md §9.2 and ARCHITECTURE.md §3.

11. **Ambiguous either/or acceptance tests** — Several tests said "either X or Y" which blocks deterministic implementation. Each resolved to a single behavior: disabled buttons with tooltips (not messages). Resolved in SPEC.md §2.2, §2.4.

12. **Watering pacing math inconsistent** — Original claimed "every 2-3 real-time seconds" but calculated "week in ~0.6s." Resolved by switching to 14-day water dose with first-per-season auto-pause at 25% moisture. Resolved in SPEC.md DD-5.

13. **OM "display-only" contradiction** — Section said "display only" but tested simulation changes (OM decrease, moisture capacity effect). Clarified: OM is fully simulated by the engine, but no Slice 1 player actions control it directly. It's "passively simulated," not "display only." Resolved in SPEC.md §4.5.

14. **Bankruptcy behavior ambiguous** — Three sections described slightly different conditions. Unified: cash ≤ $0 = game over in Slice 1 (no credit, no loans until Slice 2). Resolved in SPEC.md §5.4.

15. **DD-4 title mislabeled** — "What happens to crops in wrong season" was actually about overripe behavior. Retitled and resolved as 30-day grace period with linear yield decay. Resolved in SPEC.md DD-4, §3.7.

### Resolved from Slice 1 Implementation Review (2026-02-12)

16. **Harvest auto-pause never triggers** — Condition checked `harvestable && overripeDaysRemaining === 30` but overripeDaysRemaining is -1 when crop first reaches harvestable. Fixed to trigger on `growthStage === 'harvestable'`.

17. **Auto-pause priority order** — Events were displayed in insertion order, not urgency order. Added `AUTO_PAUSE_PRIORITY` map and stable sort in `simulateTick`.

18. **Plant/Water Field skips confirmation** — Affordable field-scope bulk ops executed immediately without confirmation. SPEC requires confirmation always. Fixed.

19. **Column bulk actions missing** — SidePanel only had row-scope buttons. Added Plant/Harvest/Water Column buttons per SPEC §2.3/§2.5/§2.6.

20. **Manual save to named slot** — Only auto-save existed. Added named slots keyed by "Year N Season", title screen load/delete menu.

21. **hasSaveData() false positive** — Returned true for manual-only saves, showing misleading "Continue" button. Fixed to only check auto-save.

22. **DD-1 complete rows counted partial rows** — Partial plant offers included partially-filled rows. Fixed to require all cells in a row to be empty.

23. **Missing data-testids** — Added conditional testids for gameover-panel, year30-panel, autopause-dismiss, save-new-game per SPEC §11.

24. **RNG continuity in warmup** — `createInitialState` warmup only called `generateDailyWeather`, not `updateExtremeEvents`, causing RNG state drift. Fixed to call both.

25. **Event probability under-targeting** — Linear `p/90` approximation under-targets by ~28% at p=0.4. Replaced with exact formula `1-(1-p)^(1/90)`.

26. **Streak test gap** — Only checked `maxStreak >= 3`, not all streaks. Fixed to validate `minStreak >= 3`.

27. **Bulk ops bypass processCommand** — Affordable-path confirm callbacks called engine functions directly, skipping validation. Fixed to route through `processCommand`.

28. **Duplicate testids on crop buttons** — Per-crop buttons shared testids. Fixed by including cropId: `action-plant-all-{cropId}`.

29. **Unsafe cast in warmup** — `warmup as GameState` was brittle. Extracted `ExtremeEventState` interface.

### Resolved from Slice 2a Senior Engineer Review (2026-02-24)

31. **HIGH: Event/advisor dismiss deadlocks activeEvent** — Dismissing event/advisor auto-pause overlay called `handleDismissAutoPause()` without clearing `activeEvent`, permanently blocking all future events (evaluateEvents returns null when activeEvent is set). Fixed: `dismissAutoPause` now detects event/advisor reason and clears activeEvent, logging as `__dismissed__`.

32. **HIGH: Foreshadowing fires same tick as event** — `evaluateEvents` created foreshadowing and fired the event in the same evaluation pass, defeating the purpose of advance warnings. Fixed: complete foreshadowing lifecycle — when conditions pass, foreshadow is created but event is NOT eligible to fire. Event becomes eligible only when `totalDay >= eventFiresOnDay`. False alarms expire silently at `eventFiresOnDay`.

33. **MEDIUM: Irrigation cost multiplier not in affordability checks** — `processWater` used base `IRRIGATION_COST_PER_CELL` for affordability but `executeWater` applied the event-driven cost multiplier, allowing watering when the player couldn't actually afford it. Fixed: `processWater` now applies `getIrrigationCostMultiplier()` in all affordability calculations. Adapter's water confirmation dialog also updated.

34. **LOW: Event RNG warmup no-op loop** — Empty for-loop with misleading comment about future consistency. Removed loop, added clear comment explaining why no event RNG warmup is needed.

35. **TAKE_LOAN guard** — `TAKE_LOAN` command was valid at any time (only checked `totalLoansReceived`). Fixed: now requires active `loan_offer` in `autoPauseQueue`, preventing command from being dispatched outside the loan offer flow.

### Resolved from Slice 2a Senior Engineer Review Round 2 (2026-02-24)

36. **MEDIUM: Foreshadowed events dropped on maturity day** — When multiple events matured on the same tick, all mature foreshadows were dismissed before weighted selection. If a foreshadowed event lost the random roll, its foreshadow was gone permanently. Fixed: foreshadowed events now fire with guaranteed priority (the player was warned, so the event must follow through). Only one fires per tick; others stay pending for subsequent ticks.

37. **LOW: Migration fallback used hardcoded event RNG seed** — `migrateV1ToV2` set `eventRngState = 42` for v1 saves. Fixed: now derives seed from `SLICE_1_SCENARIO.seed + EVENT_RNG_SEED_OFFSET` to match what `createInitialState` would produce.

### Resolved from Slice 2a Review Round 3 (2026-02-24)

38. **MEDIUM: False-alarm foreshadow churn** — Dismissed false-alarm foreshadows were immediately re-created on the same tick because Phase 2 saw no pending foreshadow for the storylet. Fixed: Phase 2 now skips storylets with foreshadows dismissed on the current day (`eventFiresOnDay === totalDay`).

39. **Loan panel browser test unskipped** — Added `window.__gameDebug` hook (setCash, setDay, setDebt, triggerEvent, etc.) for Playwright state injection. Loan tests now force `cash=0` directly, enabling 3 new browser tests: panel appears, accept adds debt, decline ends game. Removed `test.skip`.

40. **HIGH: Flaky event panel browser tests** — Event panel tests relied on `dismissAutoPausesUntil` waiting for natural RNG-driven events (probabilistic timing). Failed 1/5 under stress. Fixed: `triggerEvent` debug hook injects events directly, making event panel structure/interaction tests deterministic. Foreshadow test kept as natural-flow (tests the whole pipeline). Originally stress-tested 30/30 passes. **Regression after 4c/4d rebalancing:** foreshadowing test (game.spec.ts:884) now fails ~10% under `--repeat-each=20` (2/20). Root cause: changed economic parameters (STARTING_NITROGEN 95→99, IRRIGATION_COST 24→8, ANNUAL_OVERHEAD added) shift the simulation trajectory so condition-only advisors sometimes fire before any seasonal draw event. The test assumes `fastForward` always stops on a foreshadowed event, but condition-only advisors have no foreshadowing. Fix: filter to only count seasonal events, or use `triggerEvent` to inject a foreshadowed event deterministically.

### Resolved from Slice 2c Senior Engineer Review (2026-02-25)

41. **MEDIUM: "Apply Nitrogen Fertilizer" advisor choice was a no-op** — The `advisor-soil-nitrogen` storylet's "buy fertilizer" choice had `modify_cash: -400` but no effect on soil nitrogen. Students paid $400 for nothing. Fixed: added `modify_nitrogen_all` effect type to the effect system. Buy-fertilizer choice now applies +60 nitrogen to all cells, clamped to [0, 200].

42. **MEDIUM: Manual-save migration not surfaced in Load Game list** — `readSave()` had V1→V2→V3 migration, but `listManualSaves()` used `validateSave()` (exact version match only). Old-version manual saves were invisible in the Load Game menu despite being loadable. Fixed: `listManualSaves()` now uses the same migration chain as `readSave()`.

43. **LOW: Chill accumulation ~1.1% under target** — Dormancy entry day did an early `return` before the accumulation block, so 89/90 dormancy days accumulated chill. Over a winter with 800 target chill hours, the actual total was ~791. Fixed: removed early return; dormancy entry day now falls through to the accumulation block.

44. **LOW (hygiene): playwright-report tracked in git** — Generated `playwright-report/` and `test-results/` directories were not in `.gitignore`. Fixed: added both to `.gitignore`.

### Playtest Findings — Slice 3b (2026-02-26)

Two students were instructed to "play badly" (try to lose). Neither triggered bankruptcy. One submitted a playtest log covering a full 30-year run.

**45. Economy is too lenient — impossible to lose with almond monoculture.** RESOLVED (4c + 4d).
Severity: HIGH (balance). Originally: student planted 64 almonds, finished year 30 with $404,223. No failure pressure.
Resolution: Sub-Slice 4c added four economic levers (OM yield penalty, water allocation enforcement, nitrogen tightening, irrigation cost increase). Sub-Slice 4d added $2,000/year annual overhead. Result: almond monoculture 0% survival, corn monoculture ~69% (risky), idle farm 0% (bankrupt year 27), diversified 100%. Balance verified across 500 headless runs (5 bots × 5 scenarios × 20 seeds). Good play (diversified strategy) still earns ~$670K — this is correct pedagogy (reward for smart decisions, not a cap on success).

**46. Tomato Market Surge fires when player has no tomatoes.** RESOLVED.
Severity: MEDIUM (event noise). `tomato-market-surge` had no precondition requiring tomato production. Fixed: added `has_crop: processing-tomatoes` precondition. Event now only fires when player actually has tomatoes planted.

**47. Event clustering feels spammy.**
Severity: MEDIUM (UX). Multiple events sometimes fire in the same season (heatwave + water cut + pumping ban + tomato surge). Each auto-pauses the game, requiring separate dismissal. Students reported it feeling more like whack-a-mole than strategic decision-making.
Status: Deferred to Slice 4. Likely fix: per-season event cap (max 1-2 events per season) or mutual exclusion groups for related events. Needs design discussion — cap could suppress important events.

**48. "Already harvested this season" confusion with perennials.**
Severity: LOW (UX polish). Players repeatedly clicked harvest on already-harvested perennials, getting failure messages. The validation works correctly, but the UI doesn't clearly indicate that a perennial has already been harvested this season.
Status: Deferred. Fix: disable/gray out harvest button when `crop.harvestedThisSeason === true`, add visual indicator on cell.

**49. Cover crop / soil health pedagogy not landing.**
Severity: LOW (content design). Organic matter trended steadily down (1.97% → 1.19% over 30 years) but the student never engaged with cover crops. The payoff isn't visible enough in the UI. OM decline has no dramatic consequence the student can feel — it's a slow, invisible drain.
Status: Deferred. Needs design discussion — possible interventions: OM-triggered advisor warning, visible soil quality tier (Healthy → Degraded → Depleted), yield penalty at low OM thresholds.

**50. Pause-to-play transition is not intuitive.**
Severity: MEDIUM (UX). After planting/watering at game start (or after any auto-pause), the game is paused at 0x speed. There is no clear UI signal that the player needs to press play to continue. Multiple playtesters were confused about why nothing was happening. The current speed controls exist but don't draw attention when they're the required next action.
Status: Deferred. Needs design discussion. Options: (a) auto-resume at 1x after player actions when game is paused, (b) pulsing/highlighting speed controls when game is paused and player has taken an action, (c) contextual prompt ("Press play to continue"). Each has tradeoffs — auto-resume may surprise students; visual hints are less disruptive.

### Playtest Findings — Slice 4b Bad-Play QA (2026-03-02)

AI agent ran an intentional bad-play scenario (almond monoculture, no adaptation) against the 4b build.

**56. Tomato-market-surge reportedly fired on almond-only farm.** INCONCLUSIVE.
Severity: MEDIUM. QA log shows `event_fired: tomato-market-surge` at Year 2 spring with only almonds planted. Code review confirms `has_crop: processing-tomatoes` precondition is present and `evaluateCondition` logic is correct. Two regression tests added: (1) isolation test — 50 seeds × 100 ticks (5,000 `evaluateEvents` calls); (2) integration test — 20 seeds through full `simulateTick` engine path covering Year 1 + Year 2 spring (~500 ticks each). Event never fires in either. Unable to reproduce under current build; monitoring with regression tests and future web QA runs.
Status: Inconclusive. Regression tests in place (`slice3a1.test.ts`). Will monitor in future QA runs.

**57. Game Over "Total expenses" shows only final-year expenses.** RESOLVED.
Severity: LOW (misleading label). Bankruptcy panel said "Total revenue/expenses" but data came from `yearlyRevenue`/`yearlyExpenses` which reset each year. Label changed to "Final year revenue/expenses". TODO: show lifetime totals in 4e using `tracking.yearSnapshots`.

**58. Pre-loan vs post-loan cash confusion at year-end boundary.**
Severity: LOW (UX polish). Year-end panel shows pre-loan snapshot cash while TopBar shows post-loan live cash simultaneously. Not a bug — auto-pause queue ordering is correct (year_end data frozen before loan). Confusing for students.
Status: Deferred to 4d. Fix: add explicit copy in year-end panel ("Pre-loan cash") or sequence panels to avoid conflicting numbers.

**60. SidePanel shows "Empty" for cells with cover crops.**
Severity: LOW (UX confusion). When a cell has only a cover crop (no primary crop), SidePanel shows "Empty" as the primary label alongside "Cover Crop: Clover/Vetch Mix". Should show "Empty (Cover Crop)" or separate the label state.
Status: Deferred to 4d.

**61. Notification backlog overwhelms normal gameplay.**
Severity: MEDIUM (classroom readability). Good-play QA showed notification counts of +113, +167, +183, +260. Not a logic bug, but clear UX concern. Needs batching, summarization, or escalation design.
Status: Deferred. Requires design discussion on notification model.

**62. Harvest affordance misleads when selected plot is not ready.**
Severity: LOW (UX). "Harvest Field" button shows green/active when ANY plot is harvestable, even if the currently selected plot is at 85%. Students click expecting to harvest the selected cell. Should show "Harvest Field (N plots ready)" or clarify selected-plot state.
Status: Deferred to 4d.

**63. Event probabilities are effectively guaranteed annual occurrences.**
Severity: MEDIUM (design/balance). Events with 10% daily probability evaluated ~90 days/season have `1 - 0.9^90 ≈ 99.98%` chance per season.
Status: **RESOLVED** in Sub-Slice 4b.5. Moved 8 random-gated events to seasonal draw semantics (one roll per season, modulated by stress level, family caps). 6 condition-only advisors remain per-tick. Balance thresholds need re-establishment in 4c.

**59. Water warning click-fatigue.**
Severity: LOW (UX). Repeated water_stress auto-pauses across multiple seasons cause dismissal fatigue. Related to #47 (event clustering).
Status: Deferred. Consider suppression/escalation UX pass after 4c balance tuning and #47 event cap implementation.

### AI QA Playthrough Findings (2026-03-04)

30-year playthrough by well-intentioned AI agent. Cross-referenced against code and existing issues.

**64. Tomato Market Surge timing drifts post-harvest in late years.**
Severity: LOW (design). Event fires after summer harvest in 16/28 years, meaning the price bonus has no strategic value — player can't act on it. In late years, the event often fires when no tomatoes exist or harvest is already complete.
Status: Deferred to future content slice. Fix: tighten the firing window to pre-harvest (spring/early summer), or add a "forward contract" mechanic so the price bonus applies to next season's harvest.

**65. Year-30 completion panel lacks educational summary.**
Severity: MEDIUM (educational value). Current UI: "Congratulations!" title + "Start New Game" button. No financial arc, soil health delta, key decision highlights, or reflection prompts. The tracking data exists in `yearSnapshots` — the UI just doesn't surface it. For a classroom tool, this is the most important screen students will see.
Status: Deferred to future slice. Requires design discussion on what metrics to highlight and what reflection questions to prompt.

**66. Soil management has limited agency after early advisor caps.**
Severity: LOW (design). `advisor-soil-nitrogen` fires max 3 times (intentional cap in events.ts). Cover crops provide recurring nitrogen restoration (+50N per incorporation), but there's no explicit "fertilize" or "soil amendment" action. After early advisor hints stop, players lack ongoing feedback about soil health trajectory.
Status: Deferred. Design question: add recurring soil tools (fertilizer purchase, soil testing), raise/remove advisor caps, or accept current cover-crop-only path. Cover crops ARE the intended answer pedagogically — but players may not realize it without continued prompting.

### Deferred — Accepted for Slice 1

30. **Deep save validation** — Nested field tampering (e.g., modifying crop.gddAccumulated inside a valid grid structure) is not caught by `validateSave()`. Acceptable risk for classroom use — students are not adversarial. Could add deep schema validation in a future slice if needed.

### Deferred from Slice 2 → Slice 3 (partially resolved)

**Resolved in Slice 3:**
- ~~Stretch events~~ — `tomato-market-surge` and `groundwater-pumping-ban` implemented in 3a1
- ~~Perennial decline phase / age-based yield curves~~ — 3-phase piecewise-linear yield curves (ramp → peak → decline → floor) implemented in 3a2
- ~~Cover crops~~ — Legume cover crop system (fall planting, spring incorporation, N/OM bonus) implemented in 3b
- ~~Additional crops~~ — Sorghum (drought-tolerant annual) and Citrus Navels (evergreen perennial) added in 3a1

**Still deferred → Slice 4+:**
- **Tech tree** — Fog-of-war event-driven tech unlocks (ARCHITECTURE.md §5.4). Not started.
- **Remaining advisors** — Financial Advisor/Banker, Farming Community. (Weather Service completed in 3c.)
- **Insurance / credit systems** — Credit rating, variable loan rates, insurance premiums.
- **K + Zn nutrients** — Only nitrogen is modeled.
- **Additional crops** — Grapes, Stone Fruit, Agave, Heat-tolerant Avocados, Opuntia, Guayule remain.
- **Additional climate scenarios** — Only 1 scenario exists. Need 5-8 for classroom use.

### AI Playtest Findings — Slice 3b Build (2026-02-26)

Automated playtest by Claude agent. Triaged per senior engineer review. Verified against code.

**51. "Plant Field" bulk buttons silently fail when some plots are occupied.** RESOLVED.
Severity: HIGH (functional). Root cause: `plantBulk()` in `signals.ts` returned early with no feedback when no fully-empty rows existed. The engine had the right error message; the adapter never asked for it. BUG-03 is the same root cause. Fixed: adapter now routes through `processCommand` and shows an info notification with the engine's error message ("No fully empty rows available. Use Plant Row to fill specific rows.").

**52. Water Warning "Water Field" chains into redundant second confirmation.**
Severity: **HIGH** (UX flow — causes apparent freeze in long sessions). Auto-pause primary action calls `waterBulk('all')` which itself shows a confirmation dialog — double confirmation. The second dialog can appear hidden behind the auto-pause panel, causing what looks like a game freeze. Confirmed in 30-year QA playthrough: repeated instances of Water Warning + hidden Confirm causing apparent UI lock. Harvest auto-pause doesn't have this problem because `harvestBulk` dispatches directly.
Status: Deferred to 4d. Fix: add a `skipConfirm` parameter to `waterBulk` when called from auto-pause context, or dispatch `WATER` command directly from the auto-pause handler. Add Playwright regression test: "no hidden confirm dialog remains after water warning action."

**53. Year-end expenses don't break down categories.**
Severity: MEDIUM (transparency). Not a logic bug — the $1,600 discrepancy is exactly 8 almonds × $200 annual maintenance, correctly charged at year-end. But the year-end summary only shows aggregated "Expenses" with no line items. Violates cause-and-effect transparency principle.
Status: Deferred. Fix: add expense breakdown (planting, watering, maintenance, loan repayment) to year-end summary.

**54. Calendar display doesn't advance immediately after "Continue to Year 2".**
Severity: LOW (cosmetic). Header shows "Winter — December, Year 1" after clicking continue until the next simulation tick updates the calendar. Revenue/Expenses reset correctly.
Status: Deferred. Fix: call `publishState()` after `resetYearlyTracking` in the dismiss handler.

**55. Row/Column plant buttons don't show per-plot cost.**
Severity: LOW (UX polish). "Plant Field" buttons show "$X/plot" but row/column variants don't. Inconsistent.
Status: Deferred.

**Non-bugs (verified):**
- BUG-07 (selected cell after load): Code clears `selectedCell.value = null` in both `resumeGame` and `loadSavedGame`. Could not reproduce — likely transient rendering.
- BUG-09 (Continue doesn't require Player ID): By design — save is keyed to browser localStorage, not player ID. Classroom isolation is via separate Chromebook logins.
- BUG-08 (notification count growing): By design — notifications persist within a year. Could cap or auto-dismiss, but this is a design decision, not a bug.
- OBS-03 (annual crops auto-clear): This is the overripe grace period (30 days, then crop rots). Auto-pause fires at harvest-ready. Notification exists for crop rotting. Working as designed per SPEC DD-4.
- OBS-04 (moisture hits 0.0): Correct simulation behavior. Perennials survive dormancy at 0 moisture (reduced kc).
- OBS-05 (no undo for planting): By design per DECISIONS.md — no undo system. Row/column plant buttons skip confirmation intentionally (only field-scope requires confirmation per SPEC §2.3).
- OBS-01 (click outside to deselect): Design suggestion, not a bug. Filed mentally.
- OBS-02 (no planting window tooltips): Good suggestion for Slice 4 glossary/info system.

### Deferred to Slice 4 / Later Discussion

- **Balance testing suite** — Headless automated strategy tests running full 30-year games against multiple scenarios (ARCHITECTURE.md §12 Layer 2). Required before classroom deployment. Strategies to test: monoculture almond, monoculture corn, diversified adaptive, zero-irrigation, maximum debt. Target: monoculture should fail in ≥60% of drought-heavy scenarios; well-diversified strategies should survive ≥80%. See playtest findings #45.
- **Economic rebalancing** — Starting cash, maintenance costs, drought severity, event impacts all need systematic tuning based on balance test results. NOT hand-tuned — data-driven from headless test suite.
- **Event system tuning** — Per-season event cap, mutual exclusion groups, relevance gating (see #46, #47).
- **Web-aware AI exploratory QA** — Supplement headless balance bots with AI agents playing the actual web UI via Playwright/browser automation. Catches UX, decision-quality, and exploitability issues that headless engine-only bots cannot see. Six player personas defined: (1) Optimal-seeking strategist, (2) Intentional self-sabotage, (3) Advisor maximizer, (4) Advisor skeptic, (5) Low-effort student, (6) Late adapter. Each run produces: decision log by year/season, top-5 observations, outcome summary, bugs/UX issues. Planned timing: initial runs after 4b baseline (optimal + sabotage), regression during 4c tuning (optimal + low-effort), full sweep after 4d+4e for classroom sign-off. See Slice 4 plan sub-slice 4d.5.
- **Automation policies** — Replant-same, harvest-when-ready, water-when-dry. Unlocked via tech tree.
- **Glossary / Information Index** — In-game educational reference with progressive disclosure.
- **Solar lease event chain** — Multi-phase storylet (option → construction → operations → agrivoltaics).
- **Completion code + Google Form** — End-of-game reporting for teacher assessment.
- **Advanced accessibility** (colorblind modes, full screen reader support) — Baseline keyboard nav + ARIA in Slice 1.
- **Sound / music** — Not essential for classroom use.
- **Farm expansion (neighbor buyout)** — Likely v2, not Classroom-Ready Build.

### Deferred — Post-Slice 4 / Academic Integrity

- **Agent policy notice (soft deterrent)** — Production-only `<meta name="ai-agent-policy">` tag asking well-behaved AI agents not to play the game for students. Low effort (~30 min), only a soft deterrent for agents that respect such instructions. Implementation: inject in `src/main.tsx` gated on `import.meta.env.PROD`. Verify with test: present in prod build, absent in dev.
- **Behavioral suspicion scoring** — Client-side heuristic to flag sessions that look AI-automated: `event.isTrusted === false`, inhuman action timing (fast + perfectly regular), scripted sweep patterns, zero hover/scroll behavior with high throughput. Produces a `suspicionScore` with confidence band (low/medium/high). If above threshold, marks session as `tainted_for_review` in teacher report with "interview student for understanding" recommendation. Important limits: cannot detect passive DOM reading; good automation can mimic humans; assistive tech can false-positive. NOT auto-fail — teacher triage tool only. Requires completion code / teacher reporting infrastructure (4f) to be useful.
