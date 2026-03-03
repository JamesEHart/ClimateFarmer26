# Good-Play Condensed Notes

Based on the build after the first full pass at Sub-Slice 4b.

## Scope
- Source: in-progress "good-faith optimizer" web-agent stream-of-consciousness.
- Goal: extract coder-relevant issues vs expected behavior.
- Important caveat: this run likely did **not** include the newest fixes (especially tomato gating), so older known issues can reappear in observations.

## High-Confidence Actionable Items
1. `#52` still present in this run: water auto-pause -> second confirmation dialog.
   - Classroom friction; already in 4d scope.

2. SidePanel labeling is confusing for cover-crop-only cells.
   - Current UI can show `Empty` while also showing `Cover Crop: Clover/Vetch Mix`.
   - Suggestion: show `Empty (Cover Crop)` or separate primary label state.

3. Notification backlog remains overwhelming in normal good play.
   - Stream showed `+113`, `+167`, `+183`, `+260`.
   - Not a crash/logic bug, but clear classroom readability risk.

4. Harvest affordance can mislead.
   - Stream reported selected plot at ~85-89% while `Harvest Field` was green.
   - Likely because some other plots were harvestable.
   - Suggestion: show `Harvest Field (N plots ready)` and/or clarify selected-plot not-ready state.

## Confirmations (Good Signals)
1. Water Allocation Cut effect appears to work.
   - Observed irrigation cost increase from `$5/plot` to `$7.50/plot` (`+50%`) after event choice.

2. Nutrient-cycle pressure is visible to player.
   - Reported corn yield decline over years with low nitrogen.
   - Supports pedagogical goal; tune in 4c rather than redesign now.

## Expected / By-Design (Not Bugs)
1. Cover crops on perennial orchard cells are allowed by design.
   - "64 eligible plots" with almonds present is expected under deciduous-perennial understory rules.

2. "No crops available this season" in summer for some annuals is expected from planting windows.

3. Partial harvest behavior (some crops ready, others not) is expected.

## Still Uncertain (Track, Don’t Overreact)
1. Tomato Market Surge reportedly fired during corn-heavy/no-tomato moments in this stream.
   - Because this QA agent is likely on an older build, do not treat as fresh regression proof.
   - Keep status: inconclusive unless reproduced on current build.

## Suggested Next Small Improvements (Low Risk)
1. Add playtest log payload enhancement on `event_fired`:
   - include lightweight crop snapshot (counts by crop ID) for instant post-hoc validation.
2. Keep 4d priorities focused (`#52`, year-end UX polish, pause-to-play), then revisit notification batching/escalation UX.

## Addendum: Year 1-6 Good-Play Report + Raw Log (2026-03-03)

### What this adds (log-backed)
1. Strong confirmation that attentive play is still very profitable pre-4c.
   - Year-end cash from log: `67,855 -> 123,547 -> 158,435 -> 186,695 -> 236,084 -> 286,343`.
   - 6-year totals from year_end payloads: revenue `374,960`, expenses `138,620`, net `+236,340`.
   - Practical implication: balance remains too lenient for competent play; 4c tuning is required.

2. Event cadence is too predictable under current per-tick probabilities.
   - From raw log:
     - `tomato-market-surge`: fired in Years `2,3,4,5,6` (once/year pattern after min_year gate).
     - `late-frost-warning`: fired in Years `1,2,3,4,5`.
     - `heatwave-advisory`: fired in Years `2,3,4,5,6`.
     - `water-allocation-cut`: fired in Years `3,4,5,6`.
   - Coder takeaway: probabilities are effectively "near-guaranteed annual events" because evaluation is daily over long windows.
   - Design implication for 4c+:
     - either lower per-tick probabilities substantially, or
     - switch to seasonal/annual draw semantics.

3. Water interruption frequency is high even for optimal behavior.
   - Water commands in raw log: 26 over 6 years (roughly 4-5/year).
   - This supports water-warning fatigue as a real classroom UX concern.

4. Water allocation surcharge behavior is correct.
   - Confirmed in stream and consistent with code: irrigation increased from `$5` to `$7.50` per plot during active allocation-cut effect, then reverted.

5. Harvest UX confusion remains real.
   - Multiple instances where `Harvest Field` was available while selected crop was <100% (because another crop was ready, usually almonds).
   - Needs clearer "some plots ready" messaging.

### Corrections to the QA narrative (for coder sanity)
1. "Tomato Market Surge fires every year 1-6" is inaccurate.
   - Raw log shows starts in Year 2 (as expected from `min_year: 2`), not Year 1.

2. Claims about tomato-surge firing with no tomatoes in Year 4 may still be environment-version mismatch.
   - This run was on deployed URL and likely not newest local fixes.
   - Keep as inconclusive unless reproduced on current code with integration test.

### Prioritized coder-relevant follow-ups
1. Keep 4c as top priority (economy leniency is clearly still present for good play).
2. After/alongside 4d, improve harvest and water-warning UX clarity.
3. Add one integration-level event test (simulateTick path) to close tomato-surge uncertainty decisively.
4. Consider event-probability model change (daily -> seasonal/annual) as a design decision, not a hotfix.
