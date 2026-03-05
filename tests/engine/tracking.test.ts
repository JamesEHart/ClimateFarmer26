import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInitialState, processCommand, simulateTick, harvestCell,
  resetYearlyTracking, dismissAutoPause, executeBulkPlant, executeWater,
  executeBulkCoverCrop,
} from '../../src/engine/game.ts';
import { applyEffects } from '../../src/engine/events/effects.ts';
import type { GameState, Command } from '../../src/engine/types.ts';
import {
  STARTING_CASH, GRID_ROWS, GRID_COLS, IRRIGATION_COST_PER_CELL,
  DAYS_PER_YEAR, STARTING_DAY,
  createEmptyExpenseBreakdown, createEmptyTrackingState,
} from '../../src/engine/types.ts';
import { SLICE_1_SCENARIO } from '../../src/data/scenario.ts';
import { getCropDefinition } from '../../src/data/crops.ts';

// ============================================================================
// Helpers
// ============================================================================

let state: GameState;

beforeEach(() => {
  state = createInitialState('test-player', SLICE_1_SCENARIO);
});

function advanceTicks(st: GameState, n: number): void {
  for (let i = 0; i < n; i++) {
    st.autoPauseQueue = [];
    st.activeEvent = null;
    st.speed = 1;
    simulateTick(st, SLICE_1_SCENARIO);
  }
}

function advancePastYearEnd(st: GameState): void {
  const startYear = st.calendar.year;
  let ticks = 0;
  while (st.calendar.year === startYear && ticks < 400) {
    st.autoPauseQueue = [];
    st.activeEvent = null;
    st.speed = 1;
    simulateTick(st, SLICE_1_SCENARIO);
    ticks++;
  }
}

/** Advance to a specific month (1-12). Clears auto-pauses along the way. */
function advanceToMonth(st: GameState, targetMonth: number): void {
  let ticks = 0;
  while (st.calendar.month !== targetMonth && ticks < 400) {
    st.autoPauseQueue = [];
    st.activeEvent = null;
    st.speed = 1;
    simulateTick(st, SLICE_1_SCENARIO);
    ticks++;
  }
}

/** Plant corn in a cell and advance until harvestable, then harvest it. Returns revenue. */
function plantGrowHarvest(st: GameState, row: number, col: number, cropId: string = 'silage-corn'): number {
  processCommand(st, { type: 'PLANT_CROP', cellRow: row, cellCol: col, cropId }, SLICE_1_SCENARIO);
  // Advance until crop is harvestable
  let ticks = 0;
  while (st.grid[row][col].crop && st.grid[row][col].crop!.growthStage !== 'harvestable' && ticks < 200) {
    st.autoPauseQueue = [];
    st.activeEvent = null;
    st.speed = 1;
    simulateTick(st, SLICE_1_SCENARIO);
    ticks++;
  }
  if (st.grid[row][col].crop?.growthStage === 'harvestable') {
    return harvestCell(st, st.grid[row][col]);
  }
  return 0;
}

// ============================================================================
// Tracking Initialization
// ============================================================================

describe('Tracking initialization', () => {
  it('creates tracking state with empty snapshots and zero counters', () => {
    expect(state.tracking).toBeDefined();
    expect(state.tracking.yearSnapshots).toEqual([]);
    expect(state.tracking.cropTransitions).toBe(0);
    expect(state.tracking.droughtTolerantTypesAdopted).toEqual([]);
    expect(state.tracking.coverCropYearsUsed).toBe(0);
  });

  it('creates tracking with zeroed expense breakdown', () => {
    const exp = state.tracking.currentExpenses;
    expect(exp.planting).toBe(0);
    expect(exp.watering).toBe(0);
    expect(exp.maintenance).toBe(0);
    expect(exp.loanRepayment).toBe(0);
    expect(exp.removal).toBe(0);
    expect(exp.coverCrops).toBe(0);
    expect(exp.eventCosts).toBe(0);
  });

  it('initializes new cell fields to null', () => {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        expect(state.grid[r][c].lastCropId).toBeNull();
        expect(state.grid[r][c].lastHarvestYieldRatio).toBeNull();
      }
    }
  });

  it('initializes eventsThisSeason to 0', () => {
    expect(state.eventsThisSeason).toBe(0);
  });

  it('initializes actedSincePause to false', () => {
    expect(state.actedSincePause).toBe(false);
  });

  it('helper functions create correct defaults', () => {
    const exp = createEmptyExpenseBreakdown();
    expect(Object.values(exp).every(v => v === 0)).toBe(true);
    expect(Object.keys(exp)).toHaveLength(9);

    const trk = createEmptyTrackingState();
    expect(trk.yearSnapshots).toEqual([]);
    expect(trk.cropTransitions).toBe(0);
    expect(trk.droughtTolerantTypesAdopted).toEqual([]);
    expect(trk.coverCropYearsUsed).toBe(0);
  });
});

// ============================================================================
// Expense Tracking by Category
// ============================================================================

describe('Expense tracking', () => {
  it('tracks single-cell planting cost', () => {
    const cornCost = getCropDefinition('silage-corn').seedCostPerAcre;
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
    expect(state.tracking.currentExpenses.planting).toBe(cornCost);
  });

  it('tracks bulk planting cost', () => {
    const cornCost = getCropDefinition('silage-corn').seedCostPerAcre;
    processCommand(state, { type: 'PLANT_BULK', scope: 'all', cropId: 'silage-corn' }, SLICE_1_SCENARIO);
    expect(state.tracking.currentExpenses.planting).toBe(cornCost * 64);
  });

  it('tracks watering cost', () => {
    // Must plant crops first — watering only targets cells with crops
    processCommand(state, { type: 'PLANT_BULK', scope: 'all', cropId: 'silage-corn' }, SLICE_1_SCENARIO);
    const plantingCostBefore = state.tracking.currentExpenses.planting;

    processCommand(state, { type: 'WATER', scope: 'all' }, SLICE_1_SCENARIO);
    expect(state.tracking.currentExpenses.watering).toBe(IRRIGATION_COST_PER_CELL * 64);
    // Planting should be unchanged
    expect(state.tracking.currentExpenses.planting).toBe(plantingCostBefore);
  });

  it('tracks removal cost for perennials', () => {
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);
    const removalCost = getCropDefinition('almonds').removalCost ?? 0;
    processCommand(state, { type: 'REMOVE_CROP', cellRow: 0, cellCol: 0 }, SLICE_1_SCENARIO);
    expect(state.tracking.currentExpenses.removal).toBe(removalCost);
  });

  it('tracks cover crop cost', () => {
    // Move to fall for cover crop planting window
    while (state.calendar.season !== 'fall') {
      state.autoPauseQueue = [];
      state.activeEvent = null;
      state.speed = 1;
      simulateTick(state, SLICE_1_SCENARIO);
    }

    processCommand(state, { type: 'SET_COVER_CROP', cellRow: 0, cellCol: 0, coverCropId: 'legume-cover' }, SLICE_1_SCENARIO);
    expect(state.tracking.currentExpenses.coverCrops).toBeGreaterThan(0);
  });

  it('accumulates expenses across multiple planting actions', () => {
    const cornCost = getCropDefinition('silage-corn').seedCostPerAcre;
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 1, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
    expect(state.tracking.currentExpenses.planting).toBe(cornCost * 2);
  });
});

// ============================================================================
// Year-End Snapshot
// ============================================================================

describe('Year-end snapshot', () => {
  it('creates a snapshot when year ends', () => {
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
    advancePastYearEnd(state);

    expect(state.tracking.yearSnapshots).toHaveLength(1);
    const snap = state.tracking.yearSnapshots[0];
    expect(snap.year).toBe(1);
    expect(snap.avgOrganicMatter).toBeGreaterThan(0);
    expect(snap.avgNitrogen).toBeGreaterThan(0);
  });

  it('snapshot records crop counts from grid', () => {
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 1, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
    processCommand(state, { type: 'PLANT_CROP', cellRow: 1, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);
    advancePastYearEnd(state);

    const snap = state.tracking.yearSnapshots[0];
    // Almonds (perennial) persist through year-end
    expect(snap.cropCounts['almonds']).toBe(1);
  });

  it('snapshot records expense breakdown then resets', () => {
    const cornCost = getCropDefinition('silage-corn').seedCostPerAcre;
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
    advancePastYearEnd(state);

    // Snapshot captured the expense
    const snap = state.tracking.yearSnapshots[0];
    expect(snap.expenses.planting).toBeGreaterThanOrEqual(cornCost);

    // Current expenses should be reset (for year 2)
    expect(state.tracking.currentExpenses.planting).toBe(0);
  });

  it('year-end auto-pause includes expense breakdown in data', () => {
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);

    // Advance to year end but preserve year_end auto-pauses
    const startYear = state.calendar.year;
    let ticks = 0;
    while (state.calendar.year === startYear && ticks < 400) {
      state.autoPauseQueue = state.autoPauseQueue.filter(e => e.reason === 'year_end');
      state.activeEvent = null;
      state.speed = 1;
      simulateTick(state, SLICE_1_SCENARIO);
      ticks++;
    }

    const yearEndPause = state.autoPauseQueue.find(e => e.reason === 'year_end');
    expect(yearEndPause).toBeDefined();
    expect(yearEndPause!.data).toBeDefined();
    expect((yearEndPause!.data as Record<string, unknown>).expenseBreakdown).toBeDefined();
    const breakdown = (yearEndPause!.data as Record<string, unknown>).expenseBreakdown as Record<string, number>;
    expect(breakdown.planting).toBeGreaterThan(0);
  });

  it('records cashAtYearEnd', () => {
    advancePastYearEnd(state);
    const snap = state.tracking.yearSnapshots[0];
    expect(snap.cashAtYearEnd).toBe(state.economy.cash);
  });
});

// ============================================================================
// Crop Transition Tracking (Adaptation Scoring)
// ============================================================================

describe('Crop transition tracking', () => {
  it('does NOT count transition when lastCropId is null (first planting)', () => {
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
    expect(state.tracking.cropTransitions).toBe(0);
  });

  it('does NOT count transition when planting same crop again', () => {
    plantGrowHarvest(state, 0, 0, 'silage-corn');
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
    expect(state.tracking.cropTransitions).toBe(0);
  });

  it('does NOT count transition when previous crop had good yield (>= 0.80)', () => {
    const cell = state.grid[0][0];
    cell.lastCropId = 'silage-corn';
    cell.lastHarvestYieldRatio = 0.85;

    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'processing-tomatoes' }, SLICE_1_SCENARIO);
    expect(state.tracking.cropTransitions).toBe(0);
  });

  it('DOES count transition when previous crop had poor yield (< 0.80)', () => {
    const cell = state.grid[0][0];
    cell.lastCropId = 'silage-corn';
    cell.lastHarvestYieldRatio = 0.50;

    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'processing-tomatoes' }, SLICE_1_SCENARIO);
    expect(state.tracking.cropTransitions).toBe(1);
  });

  it('counts transition in bulk plant', () => {
    // Set up two cells as if they had poor harvests
    state.grid[0][0].lastCropId = 'silage-corn';
    state.grid[0][0].lastHarvestYieldRatio = 0.30;
    state.grid[0][1].lastCropId = 'silage-corn';
    state.grid[0][1].lastHarvestYieldRatio = 0.40;
    // Cell [0][2] has no lastCropId — should not count
    state.grid[0][2].lastCropId = null;
    state.grid[0][2].lastHarvestYieldRatio = null;

    processCommand(state, { type: 'PLANT_BULK', scope: 'all', cropId: 'processing-tomatoes' }, SLICE_1_SCENARIO);
    expect(state.tracking.cropTransitions).toBe(2);
  });

  it('sets lastCropId at harvest for annuals', () => {
    plantGrowHarvest(state, 0, 0, 'silage-corn');
    expect(state.grid[0][0].lastCropId).toBe('silage-corn');
    expect(state.grid[0][0].crop).toBeNull(); // Annual cleared after harvest
  });

  it('sets lastCropId at planting for perennials', () => {
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);
    expect(state.grid[0][0].lastCropId).toBe('almonds');
  });
});

// ============================================================================
// lastHarvestYieldRatio
// ============================================================================

describe('lastHarvestYieldRatio', () => {
  it('is set after harvesting an annual', () => {
    plantGrowHarvest(state, 0, 0, 'silage-corn');
    expect(state.grid[0][0].lastHarvestYieldRatio).not.toBeNull();
    expect(state.grid[0][0].lastHarvestYieldRatio).toBeGreaterThan(0);
    expect(state.grid[0][0].lastHarvestYieldRatio).toBeLessThanOrEqual(1);
  });

  it('is yieldAmount / yieldPotential (between 0 and 1)', () => {
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
    let ticks = 0;
    while (state.grid[0][0].crop && state.grid[0][0].crop!.growthStage !== 'harvestable' && ticks < 200) {
      state.autoPauseQueue = [];
      state.activeEvent = null;
      state.speed = 1;
      simulateTick(state, SLICE_1_SCENARIO);
      ticks++;
    }
    harvestCell(state, state.grid[0][0]);
    const ratio = state.grid[0][0].lastHarvestYieldRatio!;
    expect(ratio).toBeGreaterThan(0);
    expect(ratio).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
// Drought-Tolerant Adoption Tracking
// ============================================================================

describe('Drought-tolerant adoption tracking', () => {
  it('does NOT track before year 5', () => {
    // Sorghum planting window is April–June. Advance to April first.
    advanceToMonth(state, 4);
    expect(state.calendar.year).toBeLessThan(5);
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'sorghum' }, SLICE_1_SCENARIO);
    expect(state.tracking.droughtTolerantTypesAdopted).toEqual([]);
  });

  it('tracks sorghum adoption after year 5', () => {
    // Fast-forward to year 5 then to sorghum planting window (April–June)
    for (let y = 0; y < 4; y++) advancePastYearEnd(state);
    expect(state.calendar.year).toBe(5);
    advanceToMonth(state, 4); // April

    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'sorghum' }, SLICE_1_SCENARIO);
    expect(state.tracking.droughtTolerantTypesAdopted).toContain('sorghum');
  });

  it('does NOT double-count same crop type', () => {
    for (let y = 0; y < 4; y++) advancePastYearEnd(state);
    advanceToMonth(state, 4);

    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'sorghum' }, SLICE_1_SCENARIO);
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 1, cropId: 'sorghum' }, SLICE_1_SCENARIO);
    expect(state.tracking.droughtTolerantTypesAdopted).toEqual(['sorghum']);
  });

  it('tracks multiple drought-tolerant types (max 3)', () => {
    for (let y = 0; y < 4; y++) advancePastYearEnd(state);
    // Sorghum: April–June. Pistachios: Jan–Mar. Citrus: Feb–Apr.
    // We're at year 5 start. Advance to Feb (month 2) so pistachios + citrus plantable.
    advanceToMonth(state, 2);

    processCommand(state, { type: 'PLANT_CROP', cellRow: 1, cellCol: 0, cropId: 'pistachios' }, SLICE_1_SCENARIO);
    processCommand(state, { type: 'PLANT_CROP', cellRow: 2, cellCol: 0, cropId: 'citrus-navels' }, SLICE_1_SCENARIO);

    // Now advance to April for sorghum
    advanceToMonth(state, 4);
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'sorghum' }, SLICE_1_SCENARIO);

    expect(state.tracking.droughtTolerantTypesAdopted).toHaveLength(3);
    expect(state.tracking.droughtTolerantTypesAdopted).toContain('sorghum');
    expect(state.tracking.droughtTolerantTypesAdopted).toContain('pistachios');
    expect(state.tracking.droughtTolerantTypesAdopted).toContain('citrus-navels');
  });

  it('does NOT track non-drought-tolerant crops', () => {
    for (let y = 0; y < 4; y++) advancePastYearEnd(state);
    // Corn: March–May. Advance to March.
    advanceToMonth(state, 3);

    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
    expect(state.tracking.droughtTolerantTypesAdopted).toEqual([]);
  });

  it('tracks drought-tolerant adoption via bulk plant', () => {
    for (let y = 0; y < 4; y++) advancePastYearEnd(state);
    advanceToMonth(state, 4);

    processCommand(state, { type: 'PLANT_BULK', scope: 'row', index: 0, cropId: 'sorghum' }, SLICE_1_SCENARIO);
    expect(state.tracking.droughtTolerantTypesAdopted).toContain('sorghum');
    // Should still be just 1 entry despite 8 cells planted
    expect(state.tracking.droughtTolerantTypesAdopted).toHaveLength(1);
  });
});

// ============================================================================
// Cover Crop Year Tracking
// ============================================================================

describe('Cover crop year tracking', () => {
  it('increments coverCropYearsUsed when OM < 2.0% and >= 10 cells have cover crops', () => {
    // Degrade OM below 2.0%
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        state.grid[r][c].soil.organicMatter = 1.5;
      }
    }

    // Move to fall for cover crop planting
    while (state.calendar.season !== 'fall') {
      state.autoPauseQueue = [];
      state.activeEvent = null;
      state.speed = 1;
      simulateTick(state, SLICE_1_SCENARIO);
    }

    // Plant cover crops on 10+ cells via command
    for (let i = 0; i < 12; i++) {
      const r = Math.floor(i / GRID_COLS);
      const c = i % GRID_COLS;
      processCommand(state, { type: 'SET_COVER_CROP', cellRow: r, cellCol: c, coverCropId: 'legume-cover' }, SLICE_1_SCENARIO);
    }

    advancePastYearEnd(state);

    expect(state.tracking.coverCropYearsUsed).toBe(1);
  });

  it('does NOT increment when OM >= 2.0%', () => {
    // Set OM high enough that it stays >= 2.0% after a year of decomposition
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        state.grid[r][c].soil.organicMatter = 3.0;
      }
    }

    while (state.calendar.season !== 'fall') {
      state.autoPauseQueue = [];
      state.activeEvent = null;
      state.speed = 1;
      simulateTick(state, SLICE_1_SCENARIO);
    }

    for (let i = 0; i < 12; i++) {
      const r = Math.floor(i / GRID_COLS);
      const c = i % GRID_COLS;
      processCommand(state, { type: 'SET_COVER_CROP', cellRow: r, cellCol: c, coverCropId: 'legume-cover' }, SLICE_1_SCENARIO);
    }

    advancePastYearEnd(state);
    expect(state.tracking.coverCropYearsUsed).toBe(0);
  });

  it('does NOT increment when fewer than 10 cells have cover crops', () => {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        state.grid[r][c].soil.organicMatter = 1.5;
      }
    }

    while (state.calendar.season !== 'fall') {
      state.autoPauseQueue = [];
      state.activeEvent = null;
      state.speed = 1;
      simulateTick(state, SLICE_1_SCENARIO);
    }

    // Only 9 cells — below threshold
    for (let i = 0; i < 9; i++) {
      const r = Math.floor(i / GRID_COLS);
      const c = i % GRID_COLS;
      processCommand(state, { type: 'SET_COVER_CROP', cellRow: r, cellCol: c, coverCropId: 'legume-cover' }, SLICE_1_SCENARIO);
    }

    advancePastYearEnd(state);
    expect(state.tracking.coverCropYearsUsed).toBe(0);
  });
});

// ============================================================================
// actedSincePause Tracking
// ============================================================================

describe('actedSincePause tracking', () => {
  it('starts false', () => {
    expect(state.actedSincePause).toBe(false);
  });

  it('becomes true when player takes action while paused', () => {
    expect(state.speed).toBe(0); // Starts paused
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
    expect(state.actedSincePause).toBe(true);
  });

  it('does NOT become true for SET_SPEED command', () => {
    processCommand(state, { type: 'SET_SPEED', speed: 1 }, SLICE_1_SCENARIO);
    expect(state.actedSincePause).toBe(false);
  });

  it('resets to false when transitioning from paused to playing', () => {
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
    expect(state.actedSincePause).toBe(true);

    processCommand(state, { type: 'SET_SPEED', speed: 1 }, SLICE_1_SCENARIO);
    expect(state.actedSincePause).toBe(false);
  });

  it('does NOT reset when already playing and changing speed', () => {
    processCommand(state, { type: 'SET_SPEED', speed: 1 }, SLICE_1_SCENARIO);
    // Plant while playing (speed > 0) — flag not set because not paused
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
    expect(state.actedSincePause).toBe(false);

    // Change speed 1→2 (not from paused)
    processCommand(state, { type: 'SET_SPEED', speed: 2 }, SLICE_1_SCENARIO);
    expect(state.actedSincePause).toBe(false);
  });
});

// ============================================================================
// eventsThisSeason Tracking
// ============================================================================

describe('eventsThisSeason tracking', () => {
  it('starts at 0', () => {
    expect(state.eventsThisSeason).toBe(0);
  });

  it('resets at season change', () => {
    state.eventsThisSeason = 2;
    const startSeason = state.calendar.season;

    let ticks = 0;
    while (state.calendar.season === startSeason && ticks < 100) {
      state.autoPauseQueue = [];
      state.activeEvent = null;
      state.speed = 1;
      simulateTick(state, SLICE_1_SCENARIO);
      ticks++;
    }

    expect(state.eventsThisSeason).toBe(0);
  });
});

// ============================================================================
// eventsReceived Year Boundary
// ============================================================================

describe('eventsReceived across year boundaries', () => {
  it('counts events in Jan/Feb of year 2 (not just from March)', () => {
    // Simulate an event logged in January of year 2 (totalDay ~365-395)
    // Year 1 ends at totalDay 364. Year 2 Jan 1 = totalDay 365.
    const janDay = 365 + 10; // Jan 11, Year 2
    state.eventLog.push({
      eventId: 'test-event-jan',
      day: janDay,
      choiceId: 'test-choice',
    } as any);

    // Also add one in March of year 2 (totalDay ~425)
    const marDay = 365 + 65; // early March, Year 2
    state.eventLog.push({
      eventId: 'test-event-mar',
      day: marDay,
      choiceId: 'test-choice',
    } as any);

    // Advance to year 2 year-end
    advancePastYearEnd(state); // year 1 → year 2
    advancePastYearEnd(state); // year 2 → year 3

    // Year 2 snapshot should include BOTH events
    const snap = state.tracking.yearSnapshots[1]; // index 1 = year 2
    expect(snap.year).toBe(2);
    expect(snap.eventsReceived).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================================
// Event Cost Tracking (effects.ts integration)
// ============================================================================

describe('Event cost tracking', () => {
  it('tracks negative modify_cash effects as event costs', () => {
    const cashBefore = state.economy.cash;
    applyEffects(state, [{ type: 'modify_cash', amount: -500 }], 'test-event');
    expect(state.tracking.currentExpenses.eventCosts).toBe(500);
    expect(state.economy.cash).toBe(cashBefore - 500);
  });

  it('does NOT track positive modify_cash as event costs', () => {
    applyEffects(state, [{ type: 'modify_cash', amount: 300 }], 'test-event');
    expect(state.tracking.currentExpenses.eventCosts).toBe(0);
  });
});

// ============================================================================
// Perennial Maintenance Expense Tracking
// ============================================================================

describe('Perennial maintenance tracking', () => {
  it('tracks maintenance cost at year-end for perennials', () => {
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);
    const maintenanceCost = getCropDefinition('almonds').annualMaintenanceCost ?? 0;
    expect(maintenanceCost).toBeGreaterThan(0);

    advancePastYearEnd(state);

    const snap = state.tracking.yearSnapshots[0];
    expect(snap.expenses.maintenance).toBeGreaterThanOrEqual(maintenanceCost);
  });
});

// ============================================================================
// Integration: Full Year Cycle
// ============================================================================

describe('Full year tracking integration', () => {
  it('tracks expenses across a full year and produces correct snapshot', () => {
    const cornCost = getCropDefinition('silage-corn').seedCostPerAcre;

    // Plant some corn
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 1, cropId: 'silage-corn' }, SLICE_1_SCENARIO);

    // Water the planted cells
    processCommand(state, { type: 'WATER', scope: 'row', index: 0 }, SLICE_1_SCENARIO);

    advancePastYearEnd(state);

    const snap = state.tracking.yearSnapshots[0];
    expect(snap.year).toBe(1);
    expect(snap.expenses.planting).toBe(cornCost * 2);
    // Watering only targets cells with crops (2 cells in row 0)
    expect(snap.expenses.watering).toBe(IRRIGATION_COST_PER_CELL * 2);
    expect(snap.revenue).toBeGreaterThanOrEqual(0);
    expect(snap.cashAtYearEnd).toBeGreaterThan(0);
    expect(snap.avgOrganicMatter).toBeGreaterThan(0);
    expect(snap.avgNitrogen).toBeGreaterThan(0);

    // Expense tracking reset for year 2
    expect(state.tracking.currentExpenses.planting).toBe(0);
    expect(state.tracking.currentExpenses.watering).toBe(0);
  });

  it('accumulates multiple year snapshots', () => {
    advancePastYearEnd(state);
    expect(state.tracking.yearSnapshots).toHaveLength(1);

    advancePastYearEnd(state);
    expect(state.tracking.yearSnapshots).toHaveLength(2);
    expect(state.tracking.yearSnapshots[0].year).toBe(1);
    expect(state.tracking.yearSnapshots[1].year).toBe(2);
  });
});
