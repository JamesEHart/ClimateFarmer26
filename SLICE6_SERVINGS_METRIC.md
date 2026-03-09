# Slice 6 Idea: Human Servings Equivalent

This note captures a possible Slice 6 scoring input: track how much harvested output was converted into food for people, with a penalty for feed-first crops and livestock conversion loss.

## Goal

Add a Year-30 stat that rewards producing human-edible food, not just revenue. This can support the future sustainability / climate-adaptation score without replacing the main resilience score.

Suggested framing: **Human Servings Equivalent** rather than literal servings.

## Why This Is Feasible

The engine already computes actual harvested output in one place: `harvestCell()` in `src/engine/game.ts`.

That means we can record this stat at harvest time instead of trying to reconstruct it later from year-end summaries.

## Minimal Implementation Shape

1. Add per-crop food conversion metadata.
2. Add a lifetime tracking accumulator.
3. Update `harvestCell()` to convert `yieldAmount` into human-food-equivalent servings.
4. Surface the final total in the Year-30 / Slice 6 scoring output.

## Recommended Data Model

Each crop should get:

- `foodUseCategory`: `'human_food' | 'animal_feed' | 'mixed'`
- `servingsPerUnit`: number

`servingsPerUnit` should match the crop's existing `yieldUnit` (`tons`, `bu`, `lbs`, `boxes`).

## First-Pass Scoring Formula

At harvest:

`effectiveServings = yieldAmount * servingsPerUnit * foodUseMultiplier`

Suggested first-pass multipliers:

- `human_food`: `1.0`
- `animal_feed`: `0.1`
- `mixed`: fixed split, for example `0.5`

The `0.1` feed multiplier represents the rough 90% energy loss from routing crops through livestock instead of feeding people directly.

## Scope Recommendation

Keep this as a coarse, documented game metric in the first pass. Do not overclaim scientific precision.

Use it as one signal inside Slice 6 scoring, not as the only sustainability metric.

## Main Design Risk

The code change is small. The real work is agreeing on crop assumptions:

- corn and sorghum are easiest to treat as feed-first in this game
- tomatoes, citrus, almonds, pistachios are straightforward human food
- wheat is human food but implies processing assumptions
- agave needs an explicit game-design stance because it is not a staple food metric

## Recommended Decision

If adopted, document the assumptions in `DECISIONS.md` when Slice 6 planning starts.
