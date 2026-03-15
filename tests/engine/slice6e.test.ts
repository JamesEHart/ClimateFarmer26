/**
 * Slice 6e Tests — Endgame Payoff & Presentation Polish
 *
 * §1: Epilogue generation
 * §2: Per-category hints
 * §3: Advisor farewells
 * §4: Human food servings estimate
 */

import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../src/engine/game.ts';
import { SLICE_1_SCENARIO } from '../../src/data/scenario.ts';
import type { GameState, YearSnapshot } from '../../src/engine/types.ts';
import {
  GRID_ROWS, GRID_COLS,
  createEmptyExpenseBreakdown,
} from '../../src/engine/types.ts';
import {
  computeScore,
  generateEpilogue,
  generateCategoryHints,
  generateAdvisorFarewells,
  estimateHumanFoodServings,
} from '../../src/engine/scoring.ts';
import type { ScoreResult } from '../../src/engine/scoring.ts';
import { STORYLETS } from '../../src/data/events.ts';

// ============================================================================
// Test Helpers
// ============================================================================

function makeState(): GameState {
  return createInitialState('test-6e', SLICE_1_SCENARIO);
}

/** Create a mock ScoreResult with controllable component raws */
function makeScore(overrides: Partial<Record<string, number>> = {}, tierOverride?: ScoreResult['tier']): ScoreResult {
  const raws: Record<string, number> = {
    financial: 70,
    soil: 70,
    diversity: 70,
    adaptation: 70,
    consistency: 70,
    ...overrides,
  };

  const components = [
    { id: 'financial' as const, label: 'Financial Stability', raw: raws.financial, weight: 0.30, weighted: raws.financial * 0.30, explanation: '' },
    { id: 'soil' as const, label: 'Soil Health', raw: raws.soil, weight: 0.20, weighted: raws.soil * 0.20, explanation: '' },
    { id: 'diversity' as const, label: 'Crop Diversity', raw: raws.diversity, weight: 0.20, weighted: raws.diversity * 0.20, explanation: '' },
    { id: 'adaptation' as const, label: 'Climate Adaptation', raw: raws.adaptation, weight: 0.20, weighted: raws.adaptation * 0.20, explanation: '' },
    { id: 'consistency' as const, label: 'Consistency', raw: raws.consistency, weight: 0.10, weighted: raws.consistency * 0.10, explanation: '' },
  ];

  const total = components.reduce((sum, c) => sum + c.raw * c.weight, 0);
  const tier = tierOverride ?? (total >= 80 ? 'Thriving' : total >= 60 ? 'Stable' : total >= 40 ? 'Struggling' : 'Failed');

  return {
    total,
    tier,
    components,
    completionCode: 'TEST-70-Y30-GW',
    yearsSurvived: 30,
  };
}

/** Add a year snapshot to a state */
function addSnapshot(state: GameState, overrides: Partial<YearSnapshot> = {}): void {
  state.tracking.yearSnapshots.push({
    year: state.tracking.yearSnapshots.length + 1,
    revenue: 10000,
    expenses: createEmptyExpenseBreakdown(),
    cashAtYearEnd: 50000,
    avgOrganicMatter: 2.0,
    avgNitrogen: 50,
    cropCounts: {},
    coverCropCount: 0,
    eventsReceived: 0,
    ...overrides,
  });
}

// ============================================================================
// §1: Epilogue Generation
// ============================================================================

describe('§1: Epilogue Generation', () => {
  it('returns Thriving headline for score >= 80', () => {
    const state = makeState();
    state.calendar.year = 30;
    const score = makeScore({ financial: 90, soil: 80, diversity: 85, adaptation: 80, consistency: 80 }, 'Thriving');
    const epilogue = generateEpilogue(score, state);
    expect(epilogue.headline).toBeTruthy();
    expect(epilogue.narrative).toBeTruthy();
    expect(epilogue.bridge).toBeTruthy();
    // Thriving tone should be positive/celebratory
    expect(epilogue.headline.length).toBeGreaterThan(10);
  });

  it('returns distinct text for each tier', () => {
    const state = makeState();
    state.calendar.year = 30;

    const thriving = generateEpilogue(makeScore({}, 'Thriving'), state);
    const stable = generateEpilogue(makeScore({}, 'Stable'), state);
    const struggling = generateEpilogue(makeScore({}, 'Struggling'), state);
    const failed = generateEpilogue(makeScore({}, 'Failed'), state);

    // Each tier should produce different headlines
    const headlines = new Set([thriving.headline, stable.headline, struggling.headline, failed.headline]);
    expect(headlines.size).toBe(4);
  });

  it('returns bankruptcy-appropriate text when gameOverReason is bankruptcy', () => {
    const state = makeState();
    state.gameOver = true;
    state.gameOverReason = 'bankruptcy';
    state.calendar.year = 5;
    const score = makeScore({ financial: 0 }, 'Failed');
    const epilogue = generateEpilogue(score, state);
    // Bankruptcy epilogue should be reflective, not punitive
    expect(epilogue.narrative).toBeTruthy();
    expect(epilogue.narrative).not.toContain('Congratulations');
  });

  it('includes scenario-specific flavor for each scenario', () => {
    const scenarioIds = ['gradual-warming', 'early-drought', 'whiplash', 'late-escalation', 'mild-baseline'];
    const narratives = new Set<string>();

    for (const scenarioId of scenarioIds) {
      const state = makeState();
      state.scenarioId = scenarioId;
      state.calendar.year = 30;
      const score = makeScore({}, 'Stable');
      const epilogue = generateEpilogue(score, state);
      narratives.add(epilogue.narrative);
    }

    // Each scenario should produce different narrative flavor
    expect(narratives.size).toBe(5);
  });

  it('falls back to generic flavor for unknown scenarioId', () => {
    const state = makeState();
    state.scenarioId = 'nonexistent-scenario';
    state.calendar.year = 30;
    const score = makeScore({}, 'Stable');
    // Should not throw
    const epilogue = generateEpilogue(score, state);
    expect(epilogue.narrative).toBeTruthy();
    expect(epilogue.headline).toBeTruthy();
  });

  it('references years survived in narrative', () => {
    const state = makeState();
    state.calendar.year = 15;
    const score = makeScore({}, 'Struggling');
    score.yearsSurvived = 15;
    const epilogue = generateEpilogue(score, state);
    expect(epilogue.narrative).toContain('15');
  });
});

// ============================================================================
// §2: Per-Category Hints
// ============================================================================

describe('§2: Per-Category Hints', () => {
  it('returns empty for all-high-score state', () => {
    const state = makeState();
    const score = makeScore({ financial: 80, soil: 70, diversity: 75, adaptation: 65, consistency: 90 });
    const hints = generateCategoryHints(score, state);
    expect(hints).toHaveLength(0);
  });

  it('returns hints for categories below 60', () => {
    const state = makeState();
    const score = makeScore({ financial: 80, soil: 30, diversity: 70, adaptation: 70, consistency: 70 });
    const hints = generateCategoryHints(score, state);
    expect(hints.length).toBeGreaterThan(0);
    expect(hints[0].categoryId).toBe('soil');
  });

  it('returns the 2 weakest categories, not just any 2 under 60', () => {
    const state = makeState();
    // All 5 below 60, but soil (10) and consistency (15) are weakest
    const score = makeScore({ financial: 50, soil: 10, diversity: 45, adaptation: 40, consistency: 15 });
    const hints = generateCategoryHints(score, state);
    expect(hints).toHaveLength(2);
    const ids = hints.map(h => h.categoryId);
    expect(ids).toContain('soil');
    expect(ids).toContain('consistency');
  });

  it('returns max 2 hints even when all 5 categories are low', () => {
    const state = makeState();
    const score = makeScore({ financial: 10, soil: 20, diversity: 15, adaptation: 5, consistency: 30 });
    const hints = generateCategoryHints(score, state);
    expect(hints.length).toBeLessThanOrEqual(2);
  });

  it('includes actual OM % in soil hint', () => {
    const state = makeState();
    // Set soil OM to a known value
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        state.grid[r][c].soil.organicMatter = 1.2;
      }
    }
    const score = makeScore({ soil: 20 });
    const hints = generateCategoryHints(score, state);
    const soilHint = hints.find(h => h.categoryId === 'soil');
    expect(soilHint).toBeDefined();
    expect(soilHint!.text).toContain('1.2');
  });

  it('returns financial hint when cash is 0', () => {
    const state = makeState();
    state.economy.cash = 0;
    const score = makeScore({ financial: 0 });
    const hints = generateCategoryHints(score, state);
    const financialHint = hints.find(h => h.categoryId === 'financial');
    expect(financialHint).toBeDefined();
  });

  it('each hint has categoryId, label, and non-empty text', () => {
    const state = makeState();
    const score = makeScore({ financial: 20, soil: 15 });
    const hints = generateCategoryHints(score, state);
    for (const hint of hints) {
      expect(hint.categoryId).toBeTruthy();
      expect(hint.label).toBeTruthy();
      expect(hint.text.length).toBeGreaterThan(20);
    }
  });
});

// ============================================================================
// §3: Advisor Farewells
// ============================================================================

describe('§3: Advisor Farewells', () => {
  // Find a real Santos storylet for building realistic eventLog entries
  const santosStorylet = STORYLETS.find(s => s.advisorId === 'extension-agent');
  const chenStorylet = STORYLETS.find(s => s.advisorId === 'farm-credit');
  const nwsStorylet = STORYLETS.find(s => s.advisorId === 'weather-service');
  const forumStorylet = STORYLETS.find(s => s.advisorId === 'growers-forum');

  it('returns empty when eventLog is empty', () => {
    const state = makeState();
    const score = makeScore({}, 'Stable');
    const farewells = generateAdvisorFarewells(score, state);
    expect(farewells).toHaveLength(0);
  });

  it('returns farewell for extension-agent when player interacted with Santos events', () => {
    const state = makeState();
    expect(santosStorylet).toBeDefined();
    // Use exact EventOccurrence shape: { storyletId, day, choiceId }
    state.eventLog.push({
      storyletId: santosStorylet!.id,
      day: 100,
      choiceId: santosStorylet!.choices[0].id,
    });
    state.eventLog.push({
      storyletId: santosStorylet!.id,
      day: 200,
      choiceId: santosStorylet!.choices[0].id,
    });
    const score = makeScore({ soil: 80 }, 'Stable');
    const farewells = generateAdvisorFarewells(score, state);
    expect(farewells.length).toBeGreaterThan(0);
    expect(farewells.some(f => f.advisorId === 'extension-agent')).toBe(true);
  });

  it('does not include advisors the player never met', () => {
    const state = makeState();
    expect(santosStorylet).toBeDefined();
    state.eventLog.push({
      storyletId: santosStorylet!.id,
      day: 100,
      choiceId: santosStorylet!.choices[0].id,
    });
    state.eventLog.push({
      storyletId: santosStorylet!.id,
      day: 200,
      choiceId: santosStorylet!.choices[0].id,
    });
    const score = makeScore({}, 'Stable');
    const farewells = generateAdvisorFarewells(score, state);
    // Should not include Chen, NWS, or Forum (never met)
    expect(farewells.every(f => f.advisorId === 'extension-agent')).toBe(true);
  });

  it('returns max 2 even if player met all 4 advisors', () => {
    const state = makeState();
    // Add interactions with all 4 advisors
    for (const storylet of [santosStorylet, chenStorylet, nwsStorylet, forumStorylet]) {
      if (!storylet) continue;
      state.eventLog.push({ storyletId: storylet.id, day: 100, choiceId: storylet.choices[0].id });
      state.eventLog.push({ storyletId: storylet.id, day: 200, choiceId: storylet.choices[0].id });
    }
    const score = makeScore({}, 'Stable');
    const farewells = generateAdvisorFarewells(score, state);
    expect(farewells.length).toBeLessThanOrEqual(2);
  });

  it('labels most-aligned advisor as aligned and most-contrasting as contrasting', () => {
    const state = makeState();
    // Santos (soil) and Chen (financial) — make soil high, financial low
    if (santosStorylet) {
      state.eventLog.push({ storyletId: santosStorylet.id, day: 100, choiceId: santosStorylet.choices[0].id });
      state.eventLog.push({ storyletId: santosStorylet.id, day: 200, choiceId: santosStorylet.choices[0].id });
    }
    if (chenStorylet) {
      state.eventLog.push({ storyletId: chenStorylet.id, day: 300, choiceId: chenStorylet.choices[0].id });
      state.eventLog.push({ storyletId: chenStorylet.id, day: 400, choiceId: chenStorylet.choices[0].id });
    }
    const score = makeScore({ soil: 90, financial: 20 }, 'Stable');
    const farewells = generateAdvisorFarewells(score, state);
    expect(farewells.length).toBe(2);
    const santos = farewells.find(f => f.advisorId === 'extension-agent');
    const chen = farewells.find(f => f.advisorId === 'farm-credit');
    expect(santos?.alignment).toBe('aligned');
    expect(chen?.alignment).toBe('contrasting');
  });

  it('message varies by tier', () => {
    const state = makeState();
    if (santosStorylet) {
      state.eventLog.push({ storyletId: santosStorylet.id, day: 100, choiceId: santosStorylet.choices[0].id });
      state.eventLog.push({ storyletId: santosStorylet.id, day: 200, choiceId: santosStorylet.choices[0].id });
    }

    const thrivingScore = makeScore({ soil: 90 }, 'Thriving');
    const failedScore = makeScore({ soil: 90 }, 'Failed');

    const thrivingFarewells = generateAdvisorFarewells(thrivingScore, state);
    const failedFarewells = generateAdvisorFarewells(failedScore, state);

    const thrivingSantos = thrivingFarewells.find(f => f.advisorId === 'extension-agent');
    const failedSantos = failedFarewells.find(f => f.advisorId === 'extension-agent');

    expect(thrivingSantos).toBeDefined();
    expect(failedSantos).toBeDefined();
    expect(thrivingSantos!.message).not.toBe(failedSantos!.message);
  });

  it('skips section when interactions are minimal (< 2 total)', () => {
    const state = makeState();
    // Only 1 interaction total
    if (santosStorylet) {
      state.eventLog.push({ storyletId: santosStorylet.id, day: 100, choiceId: santosStorylet.choices[0].id });
    }
    const score = makeScore({}, 'Stable');
    const farewells = generateAdvisorFarewells(score, state);
    expect(farewells).toHaveLength(0);
  });
});

// ============================================================================
// §4: Human Food Servings Estimate
// ============================================================================

describe('§4: Human Food Servings Estimate', () => {
  it('returns positive for silage-corn farm (indirect servings via energy pyramid)', () => {
    const state = makeState();
    addSnapshot(state, { cropCounts: { 'silage-corn': 30 } });
    addSnapshot(state, { cropCounts: { 'silage-corn': 30 } });
    const servings = estimateHumanFoodServings(state);
    expect(servings).toBeGreaterThan(0);
  });

  it('returns positive for diversified farm with human-food crops', () => {
    const state = makeState();
    addSnapshot(state, { cropCounts: { 'processing-tomatoes': 10, 'winter-wheat': 10, 'almonds': 5 } });
    const servings = estimateHumanFoodServings(state);
    expect(servings).toBeGreaterThan(0);
  });

  it('returns 0 for empty yearSnapshots and no planted flags (early bankruptcy)', () => {
    const state = makeState();
    // No snapshots, no flags
    const servings = estimateHumanFoodServings(state);
    expect(servings).toBe(0);
  });

  it('diversified farm produces more servings than corn-only farm', () => {
    const cornState = makeState();
    addSnapshot(cornState, { cropCounts: { 'silage-corn': 30 } });
    addSnapshot(cornState, { cropCounts: { 'silage-corn': 30 } });

    const diverseState = makeState();
    addSnapshot(diverseState, { cropCounts: { 'processing-tomatoes': 15, 'winter-wheat': 15 } });
    addSnapshot(diverseState, { cropCounts: { 'processing-tomatoes': 15, 'winter-wheat': 15 } });

    expect(estimateHumanFoodServings(diverseState)).toBeGreaterThan(estimateHumanFoodServings(cornState));
  });

  it('accumulates across multiple year snapshots', () => {
    const state1 = makeState();
    addSnapshot(state1, { cropCounts: { 'processing-tomatoes': 10 } });

    const state2 = makeState();
    addSnapshot(state2, { cropCounts: { 'processing-tomatoes': 10 } });
    addSnapshot(state2, { cropCounts: { 'processing-tomatoes': 10 } });

    // 2 years should produce roughly double 1 year
    expect(estimateHumanFoodServings(state2)).toBeGreaterThan(estimateHumanFoodServings(state1));
  });

  it('counts annuals via planted_crop_* flags when snapshots miss them', () => {
    // Annuals harvested before year-end don't appear in yearSnapshot.cropCounts.
    // The estimate should fall back to planted_crop_* flags.
    const state = makeState();
    addSnapshot(state, { cropCounts: {} }); // empty grid at year-end
    addSnapshot(state, { cropCounts: {} });
    state.flags['planted_crop_processing-tomatoes'] = true; // but tomatoes were grown!
    const servings = estimateHumanFoodServings(state);
    expect(servings).toBeGreaterThan(0);
  });

  it('does not double-count crops in both snapshots and flags', () => {
    const state = makeState();
    addSnapshot(state, { cropCounts: { 'almonds': 10 } }); // perennial, in snapshot
    state.flags['planted_crop_almonds'] = true;
    const servings = estimateHumanFoodServings(state);
    // Should only count from snapshots, not add flag-based estimate on top
    const stateNoFlag = makeState();
    addSnapshot(stateNoFlag, { cropCounts: { 'almonds': 10 } });
    expect(servings).toBe(estimateHumanFoodServings(stateNoFlag));
  });
});
