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
Status: Deferred to Slice 5. Touches engine scheduling + balance — will be designed alongside Slice 5 event surface expansion. Likely fix: per-season event cap (max 1-2 events per season) or mutual exclusion groups for related events.

**48. "Already harvested this season" confusion with perennials.** RESOLVED (4e).
Severity: LOW (UX polish). Players repeatedly clicked harvest on already-harvested perennials, getting failure messages.
Resolution: Harvest button disabled when `crop.harvestedThisSeason === true`. "Harvested this season" label shown in SidePanel. Tooltip explains status.

**49. Cover crop / soil health pedagogy not landing.**
Severity: LOW (content design). Organic matter trended steadily down (1.97% → 1.19% over 30 years) but the student never engaged with cover crops. The payoff isn't visible enough in the UI. OM decline has no dramatic consequence the student can feel — it's a slow, invisible drain.
Status: Deferred. Needs design discussion — possible interventions: OM-triggered advisor warning, visible soil quality tier (Healthy → Degraded → Depleted), yield penalty at low OM thresholds.

**50. Pause-to-play transition is not intuitive.** RESOLVED (4e).
Severity: MEDIUM (UX).
Resolution: Pulsing "Press Play to continue" prompt shown near speed controls when speed === 0 and player has taken an action or dismissed an auto-pause. Prompt disappears when speed changes to > 0.

### Playtest Findings — Slice 4b Bad-Play QA (2026-03-02)

AI agent ran an intentional bad-play scenario (almond monoculture, no adaptation) against the 4b build.

**56. Tomato-market-surge reportedly fired on almond-only farm.** INCONCLUSIVE.
Severity: MEDIUM. QA log shows `event_fired: tomato-market-surge` at Year 2 spring with only almonds planted. Code review confirms `has_crop: processing-tomatoes` precondition is present and `evaluateCondition` logic is correct. Two regression tests added: (1) isolation test — 50 seeds × 100 ticks (5,000 `evaluateEvents` calls); (2) integration test — 20 seeds through full `simulateTick` engine path covering Year 1 + Year 2 spring (~500 ticks each). Event never fires in either. Unable to reproduce under current build; monitoring with regression tests and future web QA runs.
Status: Inconclusive. Regression tests in place (`slice3a1.test.ts`). Will monitor in future QA runs.

**57. Game Over "Total expenses" shows only final-year expenses.** RESOLVED.
Severity: LOW (misleading label). Bankruptcy panel said "Total revenue/expenses" but data came from `yearlyRevenue`/`yearlyExpenses` which reset each year. Label changed to "Final year revenue/expenses".

**58. Pre-loan vs post-loan cash confusion at year-end boundary.** RESOLVED (4e).
Severity: LOW (UX polish).
Resolution: Year-end panel cash label changed from "Cash Balance" to "Cash Balance (before loan)" to clarify the snapshot timing.

**60. SidePanel shows "Empty" for cells with cover crops.** RESOLVED (4e).
Severity: LOW (UX confusion).
Resolution: Changed label to "Fallow (Cover Crop)" when cell has a cover crop but no primary crop.

**61. Notification backlog overwhelms normal gameplay.** RESOLVED (4e).
Severity: **HIGH** (classroom readability — confirmed in live classroom run).
Resolution: Three-pronged fix: (1) Bulk harvest notifications batched by crop type (one notification per crop per bulk harvest). (2) Hard cap of 30 notifications — oldest dropped when exceeded. (3) Age-based trim at season boundaries — notifications older than 180 days removed.

**62. Harvest affordance misleads when selected plot is not ready.** RESOLVED (5c).
Severity: LOW (UX).
Resolution: "Harvest Field" button now shows "(N ready)" count. Harvest-ready predicate correctly excludes dormant crops and already-harvested perennials. FieldSummary harvestable count uses same predicate.

**63. Event probabilities are effectively guaranteed annual occurrences.**
Severity: MEDIUM (design/balance). Events with 10% daily probability evaluated ~90 days/season have `1 - 0.9^90 ≈ 99.98%` chance per season.
Status: **RESOLVED** in Sub-Slice 4b.5. Moved 8 random-gated events to seasonal draw semantics (one roll per season, modulated by stress level, family caps). 6 condition-only advisors remain per-tick. Balance thresholds need re-establishment in 4c.

**59. Water warning click-fatigue.**
Severity: **HIGH** (classroom UX — confirmed in live classroom run). Repeated water_stress auto-pauses across multiple seasons cause dismissal fatigue. Classroom evidence: 13 water actions in 4 years, each requiring warning → confirm → resume loop. Related to #47 (event clustering) and #52 (double-gate).
Status: Open. **Recommended fix: automated irrigation as an early tech tree unlock** — the first purchasable tech, offered ~Year 2 at an affordable price. Teaches the tech tree mechanic while solving the #1 UX pain point. If refused, offer again later (~Year 4) so students who couldn't afford it initially get a second chance. This makes the tech tree immediately valuable and the irrigation loop opt-out rather than mandatory suffering. Requires tech tree infrastructure (deferred to future slice).

### AI QA Playthrough Findings (2026-03-04)

30-year playthrough by well-intentioned AI agent. Cross-referenced against code and existing issues.

**64. Tomato Market Surge timing drifts post-harvest in late years.**
Severity: LOW (design). Event fires after summer harvest in 16/28 years, meaning the price bonus has no strategic value — player can't act on it. In late years, the event often fires when no tomatoes exist or harvest is already complete.
Status: Deferred to future content slice. Fix: tighten the firing window to pre-harvest (spring/early summer), or add a "forward contract" mechanic so the price bonus applies to next season's harvest.

**65. Year-30 completion panel lacks educational summary.** RESOLVED (5c).
Severity: MEDIUM (educational value).
Resolution: `buildReflectionData()` + `buildReflectionSummary()` generate text-only reflection covering financial arc, soil trend, tech decisions, and crop diversity. Renders in AutoPausePanel for both year-30 completion and bankruptcy. Loan-decline path also shows reflection (#88, resolved in 5d).

**66. Soil management has limited agency after early advisor caps.**
Severity: LOW (design). `advisor-soil-nitrogen` fires max 3 times (intentional cap in events.ts). Cover crops provide recurring nitrogen restoration (+50N per incorporation), but there's no explicit "fertilize" or "soil amendment" action. After early advisor hints stop, players lack ongoing feedback about soil health trajectory.
Status: Deferred. Design question: add recurring soil tools (fertilizer purchase, soil testing), raise/remove advisor caps, or accept current cover-crop-only path. Cover crops ARE the intended answer pedagogically — but players may not realize it without continued prompting.

**67. "Continue Saved Game" can appear but do nothing when auto-save is invalid/corrupt.** RESOLVED (4e).
Severity: MEDIUM (resume UX + trust).
Resolution: `hasSaveData()` now calls `loadAutoSave() !== null` instead of checking key existence. Corrupt autosave = Continue button hidden.

### Exploit-Hunter QA Findings (2026-03-05)

AI agent ran targeted exploit-hunting session. Cross-referenced against code.

**68. Autosave desyncs after loading a manual save.** RESOLVED (4e).
Severity: MEDIUM (data integrity / resume UX).
Resolution: Added `autoSave(_liveState)` call at end of `loadSavedGame()`. One-line fix.

**69. "New Game" button has no confirmation guard.** RESOLVED (4e).
Severity: LOW (UX — auto-save provides safety net).
Resolution: Added confirm dialog before `returnToTitle()`. Uses `'return-to-title'` ConfirmActionId with message "Return to title screen? Your game is auto-saved at each season boundary."

**70. Confirm dialog can be overwritten by scripted interaction (automation only).**
Severity: LOW (automation hardening — human clicks blocked by overlay).
Status: Open / Deferred.

What happens: No guard checks `confirmDialog.value` before assignment. If a scripted `.click()` fires on a SidePanel bulk button while a confirm dialog is open, the pending confirm is silently replaced. Human clicks are blocked by the full-viewport overlay (`position: fixed; inset: 0; z-index: 100`).

Expected: Either guard against overwrite or explicitly cancel the pending confirm's callbacks before replacement.

Actual: Pending confirm's `onConfirm`/`onCancel` callbacks are silently dropped.

Evidence:
- All 7 `confirmDialog.value = {...}` assignments have no guard: `src/adapter/signals.ts:336,356,414,434,489,510` + `src/ui/components/SidePanel.tsx:83`.
- Overlay CSS blocks human clicks: `src/ui/styles/Overlay.module.css:3-11`.
Refs: src/adapter/signals.ts:336, src/ui/styles/Overlay.module.css:3

Suggested fix: Add `if (confirmDialog.value) return;` guard at top of each bulk action, or disable action handlers when confirm is open.

**Non-issues confirmed:**
- EX-01: No cash duplication via save/load. Engine state is snapshot-based; loading overwrites, doesn't merge.
- EX-02: No double-harvest payout. `harvestedThisSeason` flag prevents re-harvest.
- EX-10: No out-of-season replant exploit. `processPlant` validates planting window.
- EX-04/05: Speed buttons clickable during dialogs — cosmetic only. Overlay blocks human clicks; tick loop is independently gated by `autoPauseQueue.length === 0`. No state corruption.
- EX-07: Cross-session save visibility — by design (BUG-09, KNOWN_ISSUES line 228). Save keys are global, not player-namespaced.

### Classroom Reality-Check Findings (2026-03-05)

Observed during live classroom session with students + TA feedback. High-confidence findings.

**71. No perennial onboarding warning — multi-year zero-revenue trap.** RESOLVED (4e).
Severity: **HIGH** (classroom UX + pedagogy).
Resolution: First perennial plant per game shows years-to-first-harvest warning in confirm dialog. Flag persisted via `state.flags['perennialWarningShown']` — survives save/load, resets on new game.

**72. Advisor recommendation timing mismatch ("plant winter wheat").** RESOLVED (4e).
Severity: MEDIUM (classroom confusion).
Resolution: Updated notification text to be season-agnostic: "Dr. Santos recommends planting winter wheat in the fall to restore nitrogen naturally. Cover crops also help rebuild soil fertility."

**73. No running net P/L visible during the year.** RESOLVED (4e).
Severity: MEDIUM (classroom comprehension).
Resolution: Added "Year net: +$X,XXX" / "Year net: -$X,XXX" display to TopBar. Green when positive, red when negative. Uses existing `yearlyRevenue - yearlyExpenses` data.

**74. Crop icon color/state misread as harvest-ready on Chromebook screens.** RESOLVED (4e).
Severity: MEDIUM (classroom UX — TA-observed).
Resolution: Three reinforcing signals: (1) "Ready!" text badge on harvestable cells (color-independent). (2) SidePanel growth text enhanced with explicit "Not ready yet" prefix for growing crops. (3) Disabled harvest button tooltip shows crop name + growth %. Additionally, all growth stages replaced with custom art images (no emoji), improving visual distinction between stages.

**Non-issues (repro needed before promoting):**
- "Load Game non-functional" — cannot reproduce; load system works in all tests. Treat as tester interaction issue until repro steps provided.
- "Continue requires Player ID confusion" — by design (BUG-09). Continue uses auto-save, not player ID.

### Deferred — Accepted for Slice 1

30. **Deep save validation** — Nested field tampering (e.g., modifying crop.gddAccumulated inside a valid grid structure) is not caught by `validateSave()`. Acceptable risk for classroom use — students are not adversarial. Could add deep schema validation in a future slice if needed.

### Deferred from Slice 2 → Slice 3 (partially resolved)

**Resolved in Slice 3:**
- ~~Stretch events~~ — `tomato-market-surge` and `groundwater-pumping-ban` implemented in 3a1
- ~~Perennial decline phase / age-based yield curves~~ — 3-phase piecewise-linear yield curves (ramp → peak → decline → floor) implemented in 3a2
- ~~Cover crops~~ — Legume cover crop system (fall planting, spring incorporation, N/OM bonus) implemented in 3b
- ~~Additional crops~~ — Sorghum (drought-tolerant annual) and Citrus Navels (evergreen perennial) added in 3a1

**Still deferred → Slice 5+:**
- ~~**Tech tree**~~ — RESOLVED in Slice 5b/5c. Water/soil/crop tracks with `getTechLevel()` reconvergence. 5 tech storylets.
- ~~**Remaining advisors**~~ — RESOLVED in Slice 5b. Chen (farm-credit) + Forum (growers-forum) added. 4 advisors total.
- **Insurance / credit systems** — Credit rating, variable loan rates, insurance premiums.
- ~~**K + Zn nutrients**~~ — RESOLVED in Slice 5a. K-lite potassium implemented (affects price not yield, hidden until soil testing tech).
- ~~**Additional crops**~~ — Agave (5c) + Heat-tolerant Avocados (5c) added. Grapes deferred. Stone Fruit, Opuntia, Guayule unlikely for Classroom-Ready Build.
- **Additional climate scenarios** — 5 calibrated scenarios exist (`scenarios.ts`). Additional scenarios optional for future slices.

### AI Playtest Findings — Slice 3b Build (2026-02-26)

Automated playtest by Claude agent. Triaged per senior engineer review. Verified against code.

**51. "Plant Field" bulk buttons silently fail when some plots are occupied.** RESOLVED.
Severity: HIGH (functional). Root cause: `plantBulk()` in `signals.ts` returned early with no feedback when no fully-empty rows existed. The engine had the right error message; the adapter never asked for it. BUG-03 is the same root cause. Fixed: adapter now routes through `processCommand` and shows an info notification with the engine's error message ("No fully empty rows available. Use Plant Row to fill specific rows.").

**52. Water Warning action chains into second confirm dialog (double-gate).** RESOLVED (4e).
Severity: **HIGH** (automation + UX flow friction in long sessions).
Resolution: Added `skipConfirm` option to `waterBulk()` with 3-way affordability return type (`applied_full` | `applied_partial` | `failed`). Auto-pause primary action uses `skipConfirm: true` — single click applies water directly. Manual side-panel watering still shows confirm dialog. Auto-pause only dismisses on success (full or partial); stays open if player can't afford any irrigation.

**53. Year-end expenses don't break down categories.** RESOLVED (4e).
Severity: MEDIUM (transparency).
Resolution: Year-end panel now shows 9-category expense breakdown (planting, watering, harvest labor, maintenance, cover crops, annual overhead, loan repayment, event costs, crop removal) with zero-value suppression. Data was already in `event.data.expenseBreakdown` — just needed UI rendering.

**54. Calendar display doesn't advance immediately after "Continue to Year 2".** RESOLVED (4e).
Severity: LOW (cosmetic).
Resolution: `handleDismissAutoPause()` now advances display calendar fields (year/month/day/season) to next day values before publishing state, preventing one-frame lag.

**55. Row/Column plant buttons don't show per-plot cost.** RESOLVED (4e).
Severity: LOW (UX polish).
Resolution: Added `($/plot)` to row and column plant buttons, matching field-level pattern.

**Non-bugs (verified):**
- BUG-07 (selected cell after load): Code clears `selectedCell.value = null` in both `resumeGame` and `loadSavedGame`. Could not reproduce — likely transient rendering.
- BUG-09 (Continue doesn't require Player ID): By design — save is keyed to browser localStorage, not player ID. Classroom isolation is via separate Chromebook logins.
- BUG-08 (notification count growing): By design — notifications persist within a year. Could cap or auto-dismiss, but this is a design decision, not a bug.
- OBS-03 (annual crops auto-clear): This is the overripe grace period (30 days, then crop rots). Auto-pause fires at harvest-ready. Notification exists for crop rotting. Working as designed per SPEC DD-4.
- OBS-04 (moisture hits 0.0): Correct simulation behavior. Perennials survive dormancy at 0 moisture (reduced kc).
- OBS-05 (no undo for planting): By design per DECISIONS.md — no undo system. Row/column plant buttons skip confirmation intentionally (only field-scope requires confirmation per SPEC §2.3).
- OBS-01 (click outside to deselect): Design suggestion, not a bug. Filed mentally.
- OBS-02 (no planting window tooltips): Good suggestion for Slice 4 glossary/info system.

### 4e QA Testing Findings (2026-03-06)

AI agent ran structured 4e acceptance test pass. 21/21 gameplay checks passed. No regressions.

**75. Debug API misuse risk (QA tooling).**
Severity: LOW (debug-only, not player-facing).
Status: Open / Informational.

`setDay()` sets the day counter without simulating intermediate growth/weather. `setCash()`+`publish()` updates the UI but may leave engine tracking state inconsistent. QA agents should prefer `fastForward()` (which auto-resolves transient states) over `setDay()` for realistic testing.

**QA guidance (expanded after regression-3 false failures):**
- `fastForward(1)` advances until the next autopause/event boundary, NOT one simulation day. It may skip many days.
- `setDay()` does not resimulate intermediate weather/growth — it is state surgery, not time travel.
- Controlled text inputs must be typed or updated with real input events; direct DOM `.value` assignment does not update Preact signal state.
- Verify irrigation surcharges via real cash deltas over controlled conditions (plant, drain moisture, measure cost), not by reading stale state fields. The `irrigationCostMultiplier` field was removed in 5a — production irrigation cost is derived from `activeEffects` via `getIrrigationCostMultiplier(state)`.
- Mixing `setDay()`, direct state mutation, `publish()`, and `fastForward()` in a single test sequence creates unreliable results. Prefer one approach per scenario.

**76. Possible UI desync after direct debug mutation.**
Severity: LOW (debug-only, not player-facing).
Status: Open — needs local repro attempt.

Reported: after `setCash()` + `publish()`, some UI elements may not reflect updated state until the next natural tick. Hypothesis: `publish()` clones `_liveState` but may not re-derive all computed signals — needs local repro to confirm. Not a player-facing issue — only affects QA debug workflows.

**77. Stale RESPOND_EVENT noise in automation logs.**
Severity: LOW (automation hardening).
Status: Open / Deferred.

AI test agents sometimes send `RESPOND_EVENT` commands when no event panel is active (e.g., rapid sequential clicks). The engine correctly rejects these (no-op), but they create noise in test logs. Optional fix: suppress or debounce stale event responses in test harness.

**78. TopBar speed controls drift 30-118px during gameplay.**
Severity: MEDIUM (UX — pause button is a moving target).
Status: RESOLVED.
Resolution: Replaced flex layout with CSS Grid `1fr auto 1fr` on `.topbar`. Center column (speed controls) is structurally fixed regardless of left/right content changes. Added responsive breakpoints at 1100px (hide scenario name) and 900px (compact right-group labels). Playwright geometry regression tests verify ≤2px drift and no overlap at narrow viewports.

**79. Perennial harvest UI confusion — "Ready!" badge shows after harvest.**
Severity: MEDIUM (student confusion — contradictory UI state).
Status: RESOLVED.
Resolution: Three fixes: (1) Engine clamps `gddAccumulated` at 99% of `gddToMaturity` when `harvestedThisSeason` is true, preventing re-entry to harvestable stage. (2) FarmCell Ready badge gated on `!harvestedThisSeason`. (3) SidePanel growth text priority: isDormant → harvestedThisSeason ("Already harvested this season") → harvestable/overripe.

### Slice 5c Student Testing + Browser Validation (2026-03-09)

AI-assisted student playthrough (6-year run) + browser regression validation. Issue 1 resolved; remainder triaged.

**80. HIGH: Tech tree soft-locked by dismissing advisor intro.** RESOLVED (5c).
Severity: HIGH (gameplay — blocks all downstream tech).
Root cause: Dismissing an advisor auto-pause (e.g., `advisor-forum-intro`) logged `__dismissed__` as an eventLog occurrence, consuming `maxOccurrences` without setting the `met_forum` flag. Downstream tech events (`tech-water-irrigation`, `tech-soil-management`) had `has_flag: met_forum` / `has_flag: met_chen` preconditions, permanently gating the tech tree.
Resolution: Removed `has_flag: met_chen` and `has_flag: met_forum` preconditions from `tech-water-irrigation` and `tech-soil-management` storylets. Advisor intros remain valuable as content but are no longer hard gates for tech progression.

**81. Bulk planting silent no-op when field is full.** PARTIALLY RESOLVED (5d).
Severity: MEDIUM (UX). With a full field (e.g., all citrus), bulk plant buttons remain green/clickable but silently do nothing. Separately, a first corn bulk action showed 57/64 plots planted — confusing count that looked like the game skipped cells.
Resolution: Silent no-op fixed — bulk plant on zero empty cells now shows "All plots are already planted." notification. Row/col scope failures now surface engine's failure reason. Field-scope confirm dialog clarified with "(fully empty rows only)" to explain DD-1 semantics (57/64 is correct — field-scope only plants fully-empty rows). DD-1 planting behavior unchanged.

**82. Financial Recovery advisor over-repeats.** RESOLVED (5d).
Severity: MEDIUM (content quality). `advisor-financial-recovery` fired at starts of Years 4, 5, and 6 with identical choices, even after a profitable year. Reads as boilerplate rather than context-aware advising.
Resolution: Tightened `advisor-drought-recovery` thresholds — `cash_below` $30K→$25K (filters perennial-investment false positives), `cooldownDays` 365→730 (biennial, primary anti-spam lever), `maxOccurrences` 3→2. Pure data change.

**83. Economic tension under-signaled in UI.**
Severity: MEDIUM (pedagogy). Student run had a compelling "will we go bankrupt before the orchard pays off?" arc, but the UI gave almost no help interpreting it. Year 6 revenue drop looked arbitrary. Year-end summary dismissed and not revisitable.
Status: Deferred to Slice 6. Fix: add danger-zone signaling (cash trend indicator, bankruptcy warning), year-over-year breakdown in year-end summary, consider making year-end summary revisitable.

**84. Crop/water messaging inconsistency.**
Severity: LOW (copy). Winter Wheat described as "low water needs" but player still gets repeated water warnings. Warning copy reads like severity tiers without visible outcome differences.
Status: Deferred to Slice 6. Fix: either soften crop water description or make warning tiers visibly meaningful in gameplay.

**85. Advisor advice delivered in notification bar feels like background toast.**
Severity: LOW (UX/product). When player accepts advisor choices (e.g., "tell me the advice"), the response lands in the bottom notification bar — easy to miss. Students may not read it as important guidance.
Status: Deferred to Slice 6 (see #92 for design direction). Fix: consider central-dialog acknowledgement for "yes, tell me" choices; keep decline paths lightweight.

**86. No guidance after mid-summer harvest leaves nothing plantable.**
Severity: LOW (onboarding). After harvesting annuals in summer, new players face empty fields with no valid planting window and no explanation of what to do next.
Status: Deferred to Slice 6. Fix: one lightweight tutorial/advisor line the first time a player enters a season with no valid planting window.

**87. Year-end "Cash Total (before loan)" copy polish.** RESOLVED (5d).
Severity: LOW (copy). "Before loan" annotation on year-end cash display is confusing when the player hasn't interacted with the loan system.
Resolution: Year-end table conditionally shows "Cash Balance (before loan)" only when `totalLoansReceived > 0`. Otherwise shows "Cash Balance". Data flows through `YearEndData.hasLoans` interface field.

**88. Bankruptcy path skips reflection summary on loan decline.** RESOLVED (5d).
Severity: LOW (product decision). When a player declines the emergency loan, the game routes straight to title screen without showing any reflection/game-over summary.
Resolution: Added `declineLoan()` in `signals.ts` — sets `gameOverReason = 'bankruptcy'`, pushes bankruptcy auto-pause with decline message, then dismisses loan_offer. Existing bankruptcy panel renders `buildReflectionSummary()` automatically.

**89. Corn monoculture dominates diversified strategy.** RESOLVED (5d.2).
Severity: HIGH (educational). Corn monoculture with cover crops + tech ($793K median) outperformed diversified ($220K median), violating the educational goal that diversification should be rewarded.
Resolution: Three-part fix:
1. **Monoculture streak penalty** — escalating yield loss for consecutive same annual crop in same cell: 2nd year 0.85, 3rd 0.70, 4th 0.55, 5th+ floored at 0.50. Based on NIFA/Illinois rotation data + SDSU rootworm research.
2. **Cover crop OM protection reduction** — cover crops reduce OM decomposition by 50% (not halt it entirely). More realistic soil dynamics.
3. **Diversified bot rewrite** — bot now rotates corn/tomatoes from Y1 (avoids streak penalty), starts cover crops at Y2. Tests what a student who understands rotation would actually do.
Result: diversified ($301K) > corn ($193K) > citrus ($86K). All 100% survival. Corn stays attractive but continuous corn gets progressively fragile via visible agronomic causes.
Deferred to Slice 6: Corn pollination heat/drought quality penalty (needs proper heat stress tracking separate from waterStressDays). Monoculture pest event chain (rootworm, corn rot) as foreshadowed storylets.

**90. Soil testing payoff not visible enough to students.** RESOLVED (5d copy fix).
Severity: MEDIUM (pedagogy). Students reported "I bought the tech and nothing changed." Soil testing unlocks potassium visibility in plot details, but students don't know to look there.
Resolution: Updated notification copy to explicitly say "Click any plot to see the new Potassium reading." Future: consider auto-selecting a plot or pulsing the K row on first reveal.

**91. Nitrogen advisor copy references "soil test results" before soil testing is available.** RESOLVED (5d copy fix).
Severity: MEDIUM (content consistency). `advisor-soil-nitrogen` said "I've been looking at the soil test results for your fields" but fires at Year 2 before soil testing tech (Year 6). Confuses the relationship between nitrogen advice and the later soil testing decision.
Resolution: Changed copy to "I've been watching your crops closely, and the growth patterns tell me your soil nitrogen is getting low."

**Non-issues confirmed:**
- Avocado planting not showing confirmation dialog: correct behavior. Perennial confirm dialog only shows for the first-ever perennial plant (`perennialWarningShown` flag). If another perennial was planted first, subsequent perennials skip the confirm. Not a bug.

### Playtest Findings — Lead Playthrough (2026-03-10)

Neal's full 30-year playthrough + student tester observations on Slice 5d.2 build. No regressions found. All major Slice 5 beats fired (irrigation, soil testing, agave, market crash Y15, heat threshold Y20, orchard decline Y23). Diversification was resilient and profitable. Climate pressure visible in last decade. Findings are design/content priorities for Slice 6.

**92. Advisor "yes, tell me" guidance buried in notification bar.** MUST-HAVE for Slice 6.
Severity: MEDIUM (pedagogy — educational payoff channel). When players accept advisor advice (e.g., "Apply Nitrogen Fertilizer," "Tell me about soil testing"), the follow-up explanation lands in the bottom notification bar as a toast. Students who chose "yes, explain" are signaling they *want* the information, but the delivery channel treats it as background noise. Players who decline ("nah, I'm good") get an appropriately lightweight dismiss.
Fix: "Yes/tell me more" choices should show a central follow-up dialog (reusing advisor panel frame — same character, same visual context) with the explanatory text. Decline choices dismiss cleanly as today. Notification still added as a log record in both cases. This is the difference between "here's important information you asked for" (center screen, must acknowledge) and "oh by the way" (bottom toast, easy to miss).
See also: #85 (same root issue identified in 5c testing).

**93. Potassium visibility lacks actionable levers.**
Severity: MEDIUM (pedagogy — information without agency). After unlocking soil testing tech, students see potassium values but have no clear understanding of what depletes K, what restores it, or what they can do about it. The number is effectively noise without a legible cause-and-effect loop. K is consumed at harvest (per-crop uptake rates), but without visible replenishment mechanics or clear price impact signaling, the information doesn't drive decisions.
Two directions for Slice 6: (A) Add a K lever — potassium fertilizer purchase option. (B) Make K's effect more visible at harvest — "Potassium-depleted soil reduced crop quality — sale price dropped 15%." Option B is more pedagogically interesting: it connects to rotation (different crops have different K uptake rates) without adding new mechanics. Either way, students need to see the consequence AND understand the lever.

**94. Avocado unlock arrives too late for economic impact.**
Severity: MEDIUM (pacing). `regime-heat-threshold` fires ~Year 20, unlocking heat-tolerant avocado research. With a 4-year establishment period, meaningful production starts ~Year 24-25. Only 5-6 years of production before Year 30 — too little runway for the crop to feel like a compelling profit pivot.
Fix options for Slice 6: move the unlock earlier (Y15-17), shorten establishment period, or reframe avocado's value as resilience/scoring rather than late-game cash pivot. The crop needs to matter in actual play, not just on paper.

**95. Growers Forum effectively disappears after intro.**
Severity: MEDIUM (content). Only the intro storylet (`growers-forum-intro`) exists. In a 30-year playthrough, the Forum appears once and then vanishes as an ongoing voice. Santos and Chen have recurring presence; the Forum does not.
Fix for Slice 6: add recurring forum-driven content — peer rumors, crop failure stories, foreshadowing of upcoming regime shifts, "interactive novel" moments. The Forum's narrative role (anecdotal, community-based, sometimes wrong) is distinct from Santos (scientific) and Chen (financial) but needs actual content to fill it.

**96. Successful diversified runs lack late-game drama.**
Severity: MEDIUM (engagement/pedagogy). A well-played diversified run finishes very safely ($640K cash, $1.5M total revenue). The last decade is margin erosion, not existential threat. There's no moment where the student thinks "I might actually lose this."
Fix for Slice 6: foreshadowed catastrophic events with mitigation options (not random punishment). Design candidates: crop insurance mechanic, total crop loss / severe damage events (pest outbreak, disease, extreme weather), community-rumor foreshadowing, mutual aid / "help another farmer" narrative choices. The goal is drama and stakes, not numerical harshness — the player should have seen it coming and had choices about how to prepare.

**97. Root-cause visibility for revenue changes is weak.**
Severity: MEDIUM (pedagogy). When revenue drops sharply (e.g., Year 2 after first harvest), the student sees the cash number change but has no explanation of *why*. The year-end expense breakdown helps post-hoc, but in the moment the cause-and-effect link is missing. Possible approaches: harvest notification showing per-crop revenue breakdown, inline yield-factor explanation ("OM penalty: -15%"), or a "why did my revenue drop?" advisor trigger.

**98. Organic transition failure is too easy to miss.**
Severity: MEDIUM (pedagogy/UX). When a player breaks organic certification (e.g., using synthetic fertilizer while enrolled), the decisive consequence is delivered as a notification bar toast — the same visual weight as "Crops watered." The organic warning interstitial catches pre-choice, but if the player proceeds, the result message is easily missed. Should be a more prominent UI signal (e.g., centered flash, or advisor follow-up).

**100. Negative harvest revenue is unexplained.**
Severity: MEDIUM (pedagogy). When yield penalties (OM, water stress, monoculture streak) stack heavily enough, harvest revenue can go negative after subtracting labor/seed costs. Students see absurd-looking negative revenue with no explanation of why. Confirmed on both tomatoes and orchard crops. Should show an explicit breakdown before or at harvest: gross yield, penalties applied, costs, net revenue. Without this, the cause-and-effect link — the game's core educational value — is broken at precisely the moment it matters most.

**99. Row/column bulk actions are automation-hostile.**
Severity: LOW (dev tooling, not student-facing). Row/col bulk action testids only render when a cell is selected, and re-render on every new selection. This caused AI testers to report "only one row planted" and wrong-testid errors. Mitigated by `__gameDebug.getActionState()` and `__gameDebug.selectCell()` helpers (added post-6e), which remove the need for brittle DOM scraping. Not a product bug — the UI works correctly for human users.

### Deferred to Slice 5+ / Later Discussion

- ~~**Balance testing suite**~~ — RESOLVED in Slice 4a. 5 bots × 5 scenarios × 20 seeds = 500 headless 30-year runs.
- ~~**Economic rebalancing**~~ — RESOLVED in Slice 4c/4d. Four levers + annual overhead. Monoculture streak penalty added in 5d.2.
- **Event system tuning** — Per-season event cap, mutual exclusion groups (see #47).
- **Web-aware AI exploratory QA** — Supplement headless bots with AI agents playing the web UI. Six player personas defined. Not yet executed as a full sweep.
- **Automation policies** — Replant-same, harvest-when-ready, water-when-dry. Unlocked via tech tree.
- **Glossary / Information Index** — In-game educational reference with progressive disclosure.
- **Solar lease event chain** — Multi-phase storylet (option → construction → operations → agrivoltaics).
- ~~**Scoring + Completion code + Google Sign-In submission**~~ — RESOLVED in Slice 6d/6e. 5-category weighted composite scoring, 4 tiers, human-readable completion code, Google Identity Services auth, EndgamePanel with epilogue + hints + advisor farewells + food servings estimate.
- ~~**Year-30 reflection panel**~~ — RESOLVED in Slice 5c (#65), loan-decline gap fixed in 5d (#88), extracted to EndgamePanel in 6e. `buildReflectionSummary()` now in `EndgamePanel.tsx`. Covers financial arc, soil trend, tech decisions, crop diversity. Shows on year-30 completion, bankruptcy, and loan-decline paths. Enhanced in 6e with epilogue, advisor farewells, food servings estimate, and per-category improvement hints.
- ~~**SPEC §30 balance targets need revision**~~ — MOSTLY RESOLVED in 5d.2. Balance tests broadened: qualitative ordering constraints (diversified > corn > almond), regression floors from observed data, anti-luck variance checks. Old per-bot exact targets replaced with floors. One structural gate remains: "≥3 strategy families survive ≥60% of runs" (retained as a genuine quality constraint — ensures multiple viable paths exist). Corn dominance fixed via monoculture streak penalty (#89).
- **QA test protocol: require fresh saves** — AI tester sessions sometimes inherit prior-state perennials and costs, making results confusing. Not a product bug — test protocol should require fresh games unless continuity is intentional.
- **Chromebook performance sanity pass** — AI tester reported background-tab throttling, apparent freezes, and large notification queues. Likely environmental (extension disconnects, Chrome throttling), but worth one manual pass on real hardware with many tabs open and a long notification history before classroom launch.
- **Save migration chain bloat** — `src/save/storage.ts` has a V1→V8 migration chain duplicated in both `readSave()` (lines 58-143) and `listManualSaves()` (lines 171-234). Each version bump requires touching 5+ locations (SAVE_VERSION, validateSave, new type guard, new migration function, both chain helpers). V1-V4 saves are almost certainly unused in the wild (students started earliest on V5/Slice 3). Should refactor: collapse old versions into a single "legacy→V7" step, extract shared migration pipeline used by both `readSave` and `listManualSaves`, and keep only last 1-2 version migrations as individual steps.
- **Forum thread-style layout** — Forum/community storylets currently render as plain paragraph blocks, identical to advisor speeches. Should feel visually distinct: speaker handles on their own line, compact post/reply blocks with subtle separation, social-feed feel. Presentation polish only — no mechanics change. Low priority.
- **Advanced accessibility** (colorblind modes, full screen reader support) — Baseline keyboard nav + ARIA in Slice 1.
- **Sound / music** — Not essential for classroom use.
- **Farm expansion (neighbor buyout)** — Likely v2, not Classroom-Ready Build.

### Deferred — Post-Slice 4 / Academic Integrity

- **Agent policy notice (soft deterrent)** — Production-only `<meta name="ai-agent-policy">` tag asking well-behaved AI agents not to play the game for students. Low effort (~30 min), only a soft deterrent for agents that respect such instructions. Implementation: inject in `src/main.tsx` gated on `import.meta.env.PROD`. Verify with test: present in prod build, absent in dev.
- **Behavioral suspicion scoring** — Client-side heuristic to flag sessions that look AI-automated: `event.isTrusted === false`, inhuman action timing (fast + perfectly regular), scripted sweep patterns, zero hover/scroll behavior with high throughput. Produces a `suspicionScore` with confidence band (low/medium/high). If above threshold, marks session as `tainted_for_review` in teacher report with "interview student for understanding" recommendation. Important limits: cannot detect passive DOM reading; good automation can mimic humans; assistive tech can false-positive. NOT auto-fail — teacher triage tool only. Requires completion code / teacher reporting infrastructure (4f) to be useful.
