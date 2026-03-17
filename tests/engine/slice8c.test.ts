/**
 * Slice 8c Tests — Labor/Automation Narrative Storylets
 *
 * Tests the new `total_planted_gte` condition type and validates the
 * precondition shapes and effect shapes of the three new storylets.
 *
 * Follows TDD order: written before implementation, all tests fail red
 * until types.ts, selector.ts, and events.ts changes are complete.
 */

import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../src/engine/game.ts';
import { SLICE_1_SCENARIO } from '../../src/data/scenario.ts';
import { evaluateCondition } from '../../src/engine/events/selector.ts';
import { STORYLETS } from '../../src/data/events.ts';
import { SeededRNG } from '../../src/engine/rng.ts';
import type { GameState, CropInstance } from '../../src/engine/types.ts';
import type { Condition, Effect } from '../../src/engine/events/types.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(): GameState {
  return createInitialState('test-8c', SLICE_1_SCENARIO);
}

function makeCrop(cropId: string): CropInstance {
  return {
    cropId,
    plantedDay: 1,
    gddAccumulated: 0,
    waterStressDays: 0,
    growthStage: 'vegetative',
    overripeDaysRemaining: 0,
    isPerennial: false,
    perennialAge: 0,
    perennialEstablished: false,
    isDormant: false,
    harvestedThisSeason: false,
    chillHoursAccumulated: 0,
  };
}

/** Plant `count` cells (left-to-right, top-to-bottom) with the given cropId. */
function plantCells(state: GameState, count: number, cropId = 'processing-tomatoes'): void {
  let planted = 0;
  for (let r = 0; r < 8 && planted < count; r++) {
    for (let c = 0; c < 8 && planted < count; c++) {
      state.grid[r][c].crop = makeCrop(cropId);
      planted++;
    }
  }
}

const rng = new SeededRNG(42);

function evalCond(cond: Condition, state: GameState): boolean {
  return evaluateCondition(cond, state, rng);
}

type YieldModEffect = Extract<Effect, { type: 'modify_yield_modifier' }>;
type SetFlagEffect  = Extract<Effect, { type: 'set_flag' }>;

// ---------------------------------------------------------------------------
// §1 — total_planted_gte condition
// ---------------------------------------------------------------------------

describe('Slice 8c — total_planted_gte condition', () => {
  it('returns false when grid is empty (0 cells) and cellCount is 1', () => {
    const state = makeState();
    expect(evalCond({ type: 'total_planted_gte', cellCount: 1 }, state)).toBe(false);
  });

  it('returns false when 29 cells planted and cellCount is 30', () => {
    const state = makeState();
    plantCells(state, 29);
    expect(evalCond({ type: 'total_planted_gte', cellCount: 30 }, state)).toBe(false);
  });

  it('returns true when exactly 30 cells planted and cellCount is 30', () => {
    const state = makeState();
    plantCells(state, 30);
    expect(evalCond({ type: 'total_planted_gte', cellCount: 30 }, state)).toBe(true);
  });

  it('returns false when 39 cells planted and cellCount is 40', () => {
    const state = makeState();
    plantCells(state, 39);
    expect(evalCond({ type: 'total_planted_gte', cellCount: 40 }, state)).toBe(false);
  });

  it('returns true when 40 cells planted and cellCount is 40', () => {
    const state = makeState();
    plantCells(state, 40);
    expect(evalCond({ type: 'total_planted_gte', cellCount: 40 }, state)).toBe(true);
  });

  it('returns true when full 8×8 grid (64 cells) planted and cellCount is 64', () => {
    const state = makeState();
    plantCells(state, 64);
    expect(evalCond({ type: 'total_planted_gte', cellCount: 64 }, state)).toBe(true);
  });

  it('counts all planted cells regardless of crop type', () => {
    // Plant 30 almonds — condition counts any crop, not just labor-intensive
    const state = makeState();
    plantCells(state, 30, 'almonds');
    expect(evalCond({ type: 'total_planted_gte', cellCount: 30 }, state)).toBe(true);
  });

  it('gate accepted behavior: 29 sorghum + 1 almond (30 total) satisfies cellCount 30', () => {
    // Intentional gate trade-off: any large farm with at least one orchard crop qualifies.
    // This is documented and accepted — the scale threshold (30+) is the primary guard.
    const state = makeState();
    plantCells(state, 30, 'sorghum');
    // Overwrite last cell with almond
    state.grid[3][7].crop = makeCrop('almonds');
    expect(evalCond({ type: 'total_planted_gte', cellCount: 30 }, state)).toBe(true);
    expect(evalCond(
      { type: 'has_any_crop_in', cropIds: ['almonds', 'citrus-navels', 'pistachios', 'heat-avocado'] },
      state,
    )).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// §2 — Storylet 1: forum-labor-shortage
// ---------------------------------------------------------------------------

describe('Slice 8c — forum-labor-shortage storylet', () => {
  const getStorylet = () => STORYLETS.find(s => s.id === 'forum-labor-shortage');

  it('exists in STORYLETS', () => {
    expect(getStorylet()).toBeDefined();
  });

  it('is type community with growers-forum advisorId', () => {
    const s = getStorylet()!;
    expect(s.type).toBe('community');
    expect(s.advisorId).toBe('growers-forum');
  });

  it('has min_year 9 and max_year 16 preconditions', () => {
    const s = getStorylet()!;
    expect(s.preconditions).toContainEqual({ type: 'min_year', year: 9 });
    expect(s.preconditions).toContainEqual({ type: 'max_year', year: 16 });
  });

  it('has total_planted_gte 30 precondition', () => {
    const s = getStorylet()!;
    expect(s.preconditions).toContainEqual({ type: 'total_planted_gte', cellCount: 30 });
  });

  it('has season summer precondition', () => {
    const s = getStorylet()!;
    expect(s.preconditions).toContainEqual({ type: 'season', season: 'summer' });
  });

  it('has_any_crop_in includes orchard/tree crop IDs but NOT processing-tomatoes', () => {
    const s = getStorylet()!;
    const cond = s.preconditions.find(p => p.type === 'has_any_crop_in') as
      { type: 'has_any_crop_in'; cropIds: string[] } | undefined;
    expect(cond).toBeDefined();
    expect(cond!.cropIds).not.toContain('processing-tomatoes');
    expect(cond!.cropIds).toContain('almonds');
    expect(cond!.cropIds).toContain('citrus-navels');
    expect(cond!.cropIds).toContain('pistachios');
    expect(cond!.cropIds).toContain('heat-avocado');
  });

  it('total_planted_gte gate: 29 cells → false', () => {
    const state = makeState();
    plantCells(state, 29, 'almonds');
    expect(evalCond({ type: 'total_planted_gte', cellCount: 30 }, state)).toBe(false);
  });

  it('total_planted_gte gate: 30 cells → true', () => {
    const state = makeState();
    plantCells(state, 30, 'almonds');
    expect(evalCond({ type: 'total_planted_gte', cellCount: 30 }, state)).toBe(true);
  });

  it('has_any_crop_in gate: only silage-corn at 40 cells → false', () => {
    const state = makeState();
    plantCells(state, 40, 'silage-corn');
    expect(evalCond(
      { type: 'has_any_crop_in', cropIds: ['almonds', 'citrus-navels', 'pistachios', 'heat-avocado'] },
      state,
    )).toBe(false);
  });

  it('has_any_crop_in gate: almonds planted → true', () => {
    const state = makeState();
    plantCells(state, 35, 'almonds');
    expect(evalCond(
      { type: 'has_any_crop_in', cropIds: ['almonds', 'citrus-navels', 'pistachios', 'heat-avocado'] },
      state,
    )).toBe(true);
  });

  it('year gate: year 8 → false (min_year 9)', () => {
    const state = makeState();
    state.calendar.year = 8;
    expect(evalCond({ type: 'min_year', year: 9 }, state)).toBe(false);
  });

  it('year gate: year 17 → false (max_year 16)', () => {
    const state = makeState();
    state.calendar.year = 17;
    expect(evalCond({ type: 'max_year', year: 16 }, state)).toBe(false);
  });

  it('season gate: fall → false', () => {
    const state = makeState();
    state.calendar.season = 'fall';
    expect(evalCond({ type: 'season', season: 'summer' }, state)).toBe(false);
  });

  it('"learn more" choice sets labor_pressure_aware flag', () => {
    const s = getStorylet()!;
    const choice = s.choices.find(c => c.id === 'labor-learn-more')!;
    const setFlag = choice.effects.find(
      (e): e is SetFlagEffect => e.type === 'set_flag' && e.flag === 'labor_pressure_aware',
    );
    expect(setFlag).toBeDefined();
    expect(setFlag!.value).toBe(true);
  });

  it('maxOccurrences is 1', () => {
    expect(getStorylet()!.maxOccurrences).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// §3 — Storylet 2: advisor-automation-question
// ---------------------------------------------------------------------------

describe('Slice 8c — advisor-automation-question storylet', () => {
  const getStorylet = () => STORYLETS.find(s => s.id === 'advisor-automation-question');

  it('exists in STORYLETS', () => {
    expect(getStorylet()).toBeDefined();
  });

  it('is type advisor with extension-agent advisorId', () => {
    const s = getStorylet()!;
    expect(s.type).toBe('advisor');
    expect(s.advisorId).toBe('extension-agent');
  });

  it('has min_year 10 and max_year 16', () => {
    const s = getStorylet()!;
    expect(s.preconditions).toContainEqual({ type: 'min_year', year: 10 });
    expect(s.preconditions).toContainEqual({ type: 'max_year', year: 16 });
  });

  it('requires labor_pressure_aware flag', () => {
    const s = getStorylet()!;
    expect(s.preconditions).toContainEqual({ type: 'has_flag', flag: 'labor_pressure_aware' });
  });

  it('has total_planted_gte 30 precondition', () => {
    const s = getStorylet()!;
    expect(s.preconditions).toContainEqual({ type: 'total_planted_gte', cellCount: 30 });
  });

  it('has_any_crop_in includes orchard crops but NOT processing-tomatoes', () => {
    const s = getStorylet()!;
    const cond = s.preconditions.find(p => p.type === 'has_any_crop_in') as
      { type: 'has_any_crop_in'; cropIds: string[] } | undefined;
    expect(cond).toBeDefined();
    expect(cond!.cropIds).not.toContain('processing-tomatoes');
    expect(cond!.cropIds).toContain('almonds');
    expect(cond!.cropIds).toContain('pistachios');
    expect(cond!.cropIds).toContain('heat-avocado');
  });

  it('has_flag gate: labor_pressure_aware not set → false', () => {
    const state = makeState();
    expect(evalCond({ type: 'has_flag', flag: 'labor_pressure_aware' }, state)).toBe(false);
  });

  it('has_flag gate: labor_pressure_aware set → true', () => {
    const state = makeState();
    state.flags['labor_pressure_aware'] = true;
    expect(evalCond({ type: 'has_flag', flag: 'labor_pressure_aware' }, state)).toBe(true);
  });

  it('both choices set automation_discussed flag to true', () => {
    const s = getStorylet()!;
    expect(s.choices.length).toBeGreaterThanOrEqual(2);
    for (const choice of s.choices) {
      const setFlag = choice.effects.find(
        (e): e is SetFlagEffect => e.type === 'set_flag' && e.flag === 'automation_discussed',
      );
      expect(setFlag).toBeDefined();
      expect(setFlag!.value).toBe(true);
    }
  });

  it('maxOccurrences is 1', () => {
    expect(getStorylet()!.maxOccurrences).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// §4 — Storylet 3: forum-staffing-crunch
// ---------------------------------------------------------------------------

describe('Slice 8c — forum-staffing-crunch storylet', () => {
  const getStorylet = () => STORYLETS.find(s => s.id === 'forum-staffing-crunch');

  it('exists in STORYLETS', () => {
    expect(getStorylet()).toBeDefined();
  });

  it('is type community with growers-forum advisorId', () => {
    const s = getStorylet()!;
    expect(s.type).toBe('community');
    expect(s.advisorId).toBe('growers-forum');
  });

  it('has min_year 11 and max_year 16', () => {
    const s = getStorylet()!;
    expect(s.preconditions).toContainEqual({ type: 'min_year', year: 11 });
    expect(s.preconditions).toContainEqual({ type: 'max_year', year: 16 });
  });

  it('has total_planted_gte 40 precondition', () => {
    const s = getStorylet()!;
    expect(s.preconditions).toContainEqual({ type: 'total_planted_gte', cellCount: 40 });
  });

  it('has season summer precondition', () => {
    const s = getStorylet()!;
    expect(s.preconditions).toContainEqual({ type: 'season', season: 'summer' });
  });

  it('has_any_crop_in includes orchard/tree crop IDs but NOT processing-tomatoes', () => {
    const s = getStorylet()!;
    const cond = s.preconditions.find(p => p.type === 'has_any_crop_in') as
      { type: 'has_any_crop_in'; cropIds: string[] } | undefined;
    expect(cond).toBeDefined();
    expect(cond!.cropIds).not.toContain('processing-tomatoes');
    expect(cond!.cropIds).toContain('almonds');
    expect(cond!.cropIds).toContain('citrus-navels');
    expect(cond!.cropIds).toContain('pistachios');
    expect(cond!.cropIds).toContain('heat-avocado');
  });

  it('total_planted_gte gate: 39 cells → false', () => {
    const state = makeState();
    plantCells(state, 39, 'almonds');
    expect(evalCond({ type: 'total_planted_gte', cellCount: 40 }, state)).toBe(false);
  });

  it('total_planted_gte gate: 40 cells → true', () => {
    const state = makeState();
    plantCells(state, 40, 'almonds');
    expect(evalCond({ type: 'total_planted_gte', cellCount: 40 }, state)).toBe(true);
  });

  it('has_any_crop_in gate: only corn/wheat → false (mechanized annual farm skipped)', () => {
    const state = makeState();
    plantCells(state, 64, 'silage-corn');
    expect(evalCond(
      { type: 'has_any_crop_in', cropIds: ['almonds', 'citrus-navels', 'pistachios', 'heat-avocado'] },
      state,
    )).toBe(false);
  });

  it('has_any_crop_in gate: pistachios planted → true', () => {
    const state = makeState();
    plantCells(state, 40, 'pistachios');
    expect(evalCond(
      { type: 'has_any_crop_in', cropIds: ['almonds', 'citrus-navels', 'pistachios', 'heat-avocado'] },
      state,
    )).toBe(true);
  });

  it('maxOccurrences is 2', () => {
    expect(getStorylet()!.maxOccurrences).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// §5 — Storylet 3 effect shapes
// ---------------------------------------------------------------------------

describe('Slice 8c — forum-staffing-crunch effect shapes', () => {
  const getStorylet = () => STORYLETS.find(s => s.id === 'forum-staffing-crunch')!;

  it('pay-premium choice has modify_cash -300', () => {
    const choice = getStorylet().choices.find(c => c.id === 'staffing-pay-premium')!;
    expect(choice.effects).toContainEqual({ type: 'modify_cash', amount: -300 });
  });

  it('pay-premium choice requires $300 cash', () => {
    const choice = getStorylet().choices.find(c => c.id === 'staffing-pay-premium')!;
    expect(choice.requiresCash).toBe(300);
  });

  it('delay choice does NOT affect processing-tomatoes (not a hand-harvest bottleneck)', () => {
    const choice = getStorylet().choices.find(c => c.id === 'staffing-delay-harvest')!;
    const yieldEffects = choice.effects.filter(
      (e): e is YieldModEffect => e.type === 'modify_yield_modifier',
    );
    expect(yieldEffects.some(e => e.cropId === 'processing-tomatoes')).toBe(false);
  });

  it('delay choice has modify_yield_modifier for pistachios at 0.85 for 45 days', () => {
    const choice = getStorylet().choices.find(c => c.id === 'staffing-delay-harvest')!;
    const yieldEffects = choice.effects.filter(
      (e): e is YieldModEffect => e.type === 'modify_yield_modifier',
    );
    expect(yieldEffects.some(e => e.cropId === 'pistachios' && e.multiplier === 0.85 && e.durationDays === 45)).toBe(true);
  });

  it('delay choice has modify_yield_modifier for heat-avocado at 0.85 for 45 days', () => {
    const choice = getStorylet().choices.find(c => c.id === 'staffing-delay-harvest')!;
    const yieldEffects = choice.effects.filter(
      (e): e is YieldModEffect => e.type === 'modify_yield_modifier',
    );
    expect(yieldEffects.some(e => e.cropId === 'heat-avocado' && e.multiplier === 0.85 && e.durationDays === 45)).toBe(true);
  });

  it('delay choice has modify_yield_modifier for almonds at 0.85 for 45 days', () => {
    const choice = getStorylet().choices.find(c => c.id === 'staffing-delay-harvest')!;
    const yieldEffects = choice.effects.filter(
      (e): e is YieldModEffect => e.type === 'modify_yield_modifier',
    );
    expect(yieldEffects.some(e => e.cropId === 'almonds' && e.multiplier === 0.85 && e.durationDays === 45)).toBe(true);
  });

  it('delay choice has modify_yield_modifier for citrus-navels at 0.85 for 45 days', () => {
    const choice = getStorylet().choices.find(c => c.id === 'staffing-delay-harvest')!;
    const yieldEffects = choice.effects.filter(
      (e): e is YieldModEffect => e.type === 'modify_yield_modifier',
    );
    expect(yieldEffects.some(e => e.cropId === 'citrus-navels' && e.multiplier === 0.85 && e.durationDays === 45)).toBe(true);
  });

  it('delay choice does NOT apply wildcard cropId "*" (only affects labor-intensive crops)', () => {
    const choice = getStorylet().choices.find(c => c.id === 'staffing-delay-harvest')!;
    const yieldEffects = choice.effects.filter(
      (e): e is YieldModEffect => e.type === 'modify_yield_modifier',
    );
    expect(yieldEffects.some(e => e.cropId === '*')).toBe(false);
  });
});
