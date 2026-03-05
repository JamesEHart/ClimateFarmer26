import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInitialState, processCommand, simulateTick,
  getAvailableCrops, getGrowthProgress, getYieldPercentage,
  resetYearlyTracking, dismissAutoPause, executeBulkPlant, executeWater,
} from '../../src/engine/game.ts';
import type { GameState, Command } from '../../src/engine/types.ts';
import {
  STARTING_CASH, STARTING_NITROGEN, STARTING_DAY, GRID_ROWS, GRID_COLS,
  OVERRIPE_GRACE_DAYS, IRRIGATION_COST_PER_CELL, AUTO_PAUSE_PRIORITY,
} from '../../src/engine/types.ts';
import type { AutoPauseReason } from '../../src/engine/types.ts';
import { SLICE_1_SCENARIO } from '../../src/data/scenario.ts';
import { getCropDefinition } from '../../src/data/crops.ts';

let state: GameState;

beforeEach(() => {
  state = createInitialState('test-player', SLICE_1_SCENARIO);
});

// ============================================================================
// Initial State
// ============================================================================

describe('createInitialState', () => {
  it('creates state with correct starting cash', () => {
    expect(state.economy.cash).toBe(STARTING_CASH);
  });

  it('creates 8x8 grid of empty cells', () => {
    expect(state.grid.length).toBe(GRID_ROWS);
    for (const row of state.grid) {
      expect(row.length).toBe(GRID_COLS);
      for (const cell of row) {
        expect(cell.crop).toBeNull();
      }
    }
  });

  it('starts paused on Spring, Year 1, March 1', () => {
    expect(state.speed).toBe(0);
    expect(state.calendar.year).toBe(1);
    expect(state.calendar.season).toBe('spring'); // March 1 per SPEC
    expect(state.calendar.totalDay).toBe(STARTING_DAY);
  });

  it('initializes soil with correct starting values', () => {
    const soil = state.grid[0][0].soil;
    expect(soil.nitrogen).toBe(STARTING_NITROGEN);
    expect(soil.organicMatter).toBe(2.0);
    expect(soil.moisture).toBe(4.0);
    expect(soil.moistureCapacity).toBe(6.0);
  });

  it('stores player ID', () => {
    expect(state.playerId).toBe('test-player');
  });

  it('starts with no notifications', () => {
    expect(state.notifications).toHaveLength(0);
  });

  it('starts with no auto-pause events', () => {
    expect(state.autoPauseQueue).toHaveLength(0);
  });
});

// ============================================================================
// Command: SET_SPEED
// ============================================================================

describe('SET_SPEED command', () => {
  it('changes speed to 1x', () => {
    const result = processCommand(state, { type: 'SET_SPEED', speed: 1 }, SLICE_1_SCENARIO);
    expect(result.success).toBe(true);
    expect(state.speed).toBe(1);
  });

  it('changes speed to 4x', () => {
    processCommand(state, { type: 'SET_SPEED', speed: 4 }, SLICE_1_SCENARIO);
    expect(state.speed).toBe(4);
  });

  it('pauses (speed 0)', () => {
    state.speed = 2;
    processCommand(state, { type: 'SET_SPEED', speed: 0 }, SLICE_1_SCENARIO);
    expect(state.speed).toBe(0);
  });
});

// ============================================================================
// Command: PLANT_CROP
// ============================================================================

describe('PLANT_CROP command', () => {
  it('plants a crop in an empty cell during planting window', () => {
    // Advance to March (spring planting window)
    state.calendar = { day: 60, month: 3, season: 'spring', year: 1, totalDay: 59 };

    const result = processCommand(state, {
      type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'processing-tomatoes',
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(true);
    expect(state.grid[0][0].crop).not.toBeNull();
    expect(state.grid[0][0].crop!.cropId).toBe('processing-tomatoes');
    expect(state.grid[0][0].crop!.growthStage).toBe('seedling');
  });

  it('deducts seed cost from cash', () => {
    state.calendar = { day: 60, month: 3, season: 'spring', year: 1, totalDay: 59 };
    const costBefore = state.economy.cash;
    const cropDef = getCropDefinition('processing-tomatoes');

    processCommand(state, {
      type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'processing-tomatoes',
    }, SLICE_1_SCENARIO);

    expect(state.economy.cash).toBe(costBefore - cropDef.seedCostPerAcre);
  });

  it('rejects planting in occupied cell', () => {
    state.calendar = { day: 60, month: 3, season: 'spring', year: 1, totalDay: 59 };
    processCommand(state, {
      type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'processing-tomatoes',
    }, SLICE_1_SCENARIO);

    const result = processCommand(state, {
      type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn',
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(false);
    expect(result.reason).toContain('already has a crop');
  });

  it('rejects planting outside planting window', () => {
    // January — tomatoes not plantable
    state.calendar = { day: 15, month: 1, season: 'winter', year: 1, totalDay: 14 };

    const result = processCommand(state, {
      type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'processing-tomatoes',
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(false);
    expect(result.reason).toContain('March');
  });

  it('rejects planting with insufficient cash', () => {
    state.calendar = { day: 60, month: 3, season: 'spring', year: 1, totalDay: 59 };
    state.economy.cash = 10;

    const result = processCommand(state, {
      type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'processing-tomatoes',
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(false);
    expect(result.reason).toContain('Not enough cash');
  });

  it('rejects invalid cell position', () => {
    state.calendar = { day: 60, month: 3, season: 'spring', year: 1, totalDay: 59 };

    const result = processCommand(state, {
      type: 'PLANT_CROP', cellRow: 99, cellCol: 0, cropId: 'processing-tomatoes',
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(false);
  });

  it('tracks planting cost in yearly expenses', () => {
    state.calendar = { day: 60, month: 3, season: 'spring', year: 1, totalDay: 59 };
    const cropDef = getCropDefinition('silage-corn');

    processCommand(state, {
      type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn',
    }, SLICE_1_SCENARIO);

    expect(state.economy.yearlyExpenses).toBe(cropDef.seedCostPerAcre);
  });
});

// ============================================================================
// Command: PLANT_BULK
// ============================================================================

describe('PLANT_BULK command', () => {
  beforeEach(() => {
    state.calendar = { day: 60, month: 3, season: 'spring', year: 1, totalDay: 59 };
  });

  it('plants all 64 cells when cash is sufficient', () => {
    const result = processCommand(state, {
      type: 'PLANT_BULK', scope: 'all', cropId: 'silage-corn',
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(true);
    expect(result.cellsAffected).toBe(64);

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        expect(state.grid[r][c].crop).not.toBeNull();
      }
    }
  });

  it('returns partial offer when cash is insufficient for full field', () => {
    const cornCost = getCropDefinition('silage-corn').seedCostPerAcre;
    state.economy.cash = cornCost * 20; // Can afford 20 cells = 2 full rows

    const result = processCommand(state, {
      type: 'PLANT_BULK', scope: 'all', cropId: 'silage-corn',
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('partial');
    expect(result.partialOffer).toBeDefined();
    expect(result.partialOffer!.affordableRows).toBe(2);
    expect(result.partialOffer!.affordablePlots).toBe(16);
  });

  it('returns error when no fully empty rows exist for field-scope plant', () => {
    // Plant one crop in every row so no row is fully empty
    for (let r = 0; r < GRID_ROWS; r++) {
      processCommand(state, {
        type: 'PLANT_CROP', cellRow: r, cellCol: 0, cropId: 'silage-corn',
      }, SLICE_1_SCENARIO);
    }

    const result = processCommand(state, {
      type: 'PLANT_BULK', scope: 'all', cropId: 'silage-corn',
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(false);
    expect(result.reason).toContain('No fully empty rows');
  });

  it('plants a single row', () => {
    const result = processCommand(state, {
      type: 'PLANT_BULK', scope: 'row', index: 3, cropId: 'silage-corn',
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(true);
    expect(result.cellsAffected).toBe(8);

    // Row 3 should be planted
    for (let c = 0; c < GRID_COLS; c++) {
      expect(state.grid[3][c].crop).not.toBeNull();
    }
    // Row 0 should be empty
    expect(state.grid[0][0].crop).toBeNull();
  });

  it('skips occupied cells in bulk plant', () => {
    // Plant one cell first
    processCommand(state, {
      type: 'PLANT_CROP', cellRow: 3, cellCol: 0, cropId: 'processing-tomatoes',
    }, SLICE_1_SCENARIO);

    // Bulk plant row 3
    const result = processCommand(state, {
      type: 'PLANT_BULK', scope: 'row', index: 3, cropId: 'silage-corn',
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(true);
    expect(result.cellsAffected).toBe(7); // 8 minus the already-planted one
    expect(state.grid[3][0].crop!.cropId).toBe('processing-tomatoes'); // unchanged
    expect(state.grid[3][1].crop!.cropId).toBe('silage-corn'); // newly planted
  });
});

// ============================================================================
// Command: HARVEST
// ============================================================================

describe('HARVEST command', () => {
  it('rejects harvest on empty cell', () => {
    const result = processCommand(state, {
      type: 'HARVEST', cellRow: 0, cellCol: 0,
    }, SLICE_1_SCENARIO);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('No crop');
  });

  it('rejects harvest on growing crop', () => {
    state.calendar = { day: 60, month: 3, season: 'spring', year: 1, totalDay: 59 };
    processCommand(state, {
      type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn',
    }, SLICE_1_SCENARIO);

    const result = processCommand(state, {
      type: 'HARVEST', cellRow: 0, cellCol: 0,
    }, SLICE_1_SCENARIO);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('not ready');
  });

  it('harvests a crop at harvestable stage and adds revenue', () => {
    state.calendar = { day: 60, month: 3, season: 'spring', year: 1, totalDay: 59 };
    processCommand(state, {
      type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn',
    }, SLICE_1_SCENARIO);

    // Force to harvestable
    state.grid[0][0].crop!.growthStage = 'harvestable';
    state.grid[0][0].crop!.gddAccumulated = 3000;

    const cashBefore = state.economy.cash;
    const result = processCommand(state, {
      type: 'HARVEST', cellRow: 0, cellCol: 0,
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(true);
    expect(state.grid[0][0].crop).toBeNull(); // Cell cleared
    expect(state.economy.cash).toBeGreaterThan(cashBefore); // Revenue added
    expect(result.revenue).toBeDefined();
  });

  it('harvests overripe crop at reduced yield', () => {
    state.calendar = { day: 60, month: 3, season: 'spring', year: 1, totalDay: 59 };
    processCommand(state, {
      type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn',
    }, SLICE_1_SCENARIO);

    // Force to overripe with half grace period remaining
    state.grid[0][0].crop!.growthStage = 'overripe';
    state.grid[0][0].crop!.gddAccumulated = 3000;
    state.grid[0][0].crop!.overripeDaysRemaining = 15; // half of 30

    const result = processCommand(state, {
      type: 'HARVEST', cellRow: 0, cellCol: 0,
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(true);
    // Revenue should be roughly half of full harvest
    expect(result.revenue).toBeDefined();
  });
});

// ============================================================================
// Command: HARVEST_BULK
// ============================================================================

describe('HARVEST_BULK command', () => {
  it('returns message when no crops are harvestable', () => {
    const result = processCommand(state, {
      type: 'HARVEST_BULK', scope: 'all',
    }, SLICE_1_SCENARIO);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('No crops ready');
  });

  it('harvests all harvestable cells at once', () => {
    state.calendar = { day: 60, month: 3, season: 'spring', year: 1, totalDay: 59 };

    // Plant 4 cells and make them harvestable
    for (let c = 0; c < 4; c++) {
      processCommand(state, {
        type: 'PLANT_CROP', cellRow: 0, cellCol: c, cropId: 'silage-corn',
      }, SLICE_1_SCENARIO);
      state.grid[0][c].crop!.growthStage = 'harvestable';
      state.grid[0][c].crop!.gddAccumulated = 3000;
    }

    const cashBefore = state.economy.cash;
    const result = processCommand(state, {
      type: 'HARVEST_BULK', scope: 'all',
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(true);
    expect(result.cellsAffected).toBe(4);
    expect(state.economy.cash).toBeGreaterThan(cashBefore);
  });
});

// ============================================================================
// Command: WATER
// ============================================================================

describe('WATER command', () => {
  it('waters all planted cells and deducts cost', () => {
    state.calendar = { day: 60, month: 3, season: 'spring', year: 1, totalDay: 59 };

    // Plant 8 cells in row 0
    processCommand(state, {
      type: 'PLANT_BULK', scope: 'row', index: 0, cropId: 'silage-corn',
    }, SLICE_1_SCENARIO);

    // Drain moisture
    for (let c = 0; c < 8; c++) {
      state.grid[0][c].soil.moisture = 1.0;
    }

    const cashBefore = state.economy.cash;
    const result = processCommand(state, {
      type: 'WATER', scope: 'all',
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(true);
    expect(result.cellsAffected).toBe(8);
    expect(result.cost).toBe(8 * IRRIGATION_COST_PER_CELL);
    expect(state.economy.cash).toBe(cashBefore - 8 * IRRIGATION_COST_PER_CELL);

    // Moisture should increase
    expect(state.grid[0][0].soil.moisture).toBeGreaterThan(1.0);
  });

  it('caps moisture at capacity (over-watering wastes water)', () => {
    state.calendar = { day: 60, month: 3, season: 'spring', year: 1, totalDay: 59 };
    processCommand(state, {
      type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn',
    }, SLICE_1_SCENARIO);

    state.grid[0][0].soil.moisture = 5.5; // Nearly full (capacity ~6.0)
    processCommand(state, { type: 'WATER', scope: 'row', index: 0 }, SLICE_1_SCENARIO);

    expect(state.grid[0][0].soil.moisture).toBeLessThanOrEqual(state.grid[0][0].soil.moistureCapacity);
  });

  it('rejects watering with no planted cells', () => {
    const result = processCommand(state, { type: 'WATER', scope: 'all' }, SLICE_1_SCENARIO);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('No planted plots');
  });

  it('returns partial offer when cash is insufficient', () => {
    state.calendar = { day: 60, month: 3, season: 'spring', year: 1, totalDay: 59 };
    // Plant all cells
    processCommand(state, {
      type: 'PLANT_BULK', scope: 'all', cropId: 'silage-corn',
    }, SLICE_1_SCENARIO);

    state.economy.cash = IRRIGATION_COST_PER_CELL * 20; // Can afford 20 cells = 2.5 rows

    const result = processCommand(state, { type: 'WATER', scope: 'all' }, SLICE_1_SCENARIO);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('partial');
    expect(result.partialOffer).toBeDefined();
    expect(result.partialOffer!.affordableRows).toBe(2);
  });
});

// ============================================================================
// Simulation Ticks
// ============================================================================

describe('simulateTick', () => {
  it('does nothing when paused', () => {
    const dayBefore = state.calendar.totalDay;
    simulateTick(state, SLICE_1_SCENARIO);
    expect(state.calendar.totalDay).toBe(dayBefore);
  });

  it('advances day when running', () => {
    state.speed = 1;
    const dayBefore = state.calendar.totalDay;
    simulateTick(state, SLICE_1_SCENARIO);
    expect(state.calendar.totalDay).toBe(dayBefore + 1);
  });

  it('does nothing when auto-pause queue is non-empty', () => {
    state.speed = 1;
    state.autoPauseQueue.push({ reason: 'harvest_ready', message: 'test' });
    const dayBefore = state.calendar.totalDay;
    simulateTick(state, SLICE_1_SCENARIO);
    expect(state.calendar.totalDay).toBe(dayBefore);
  });

  it('soil moisture decreases over time without rain or irrigation', () => {
    state.speed = 1;
    // Advance to summer where ET is high
    state.calendar = { day: 182, month: 7, season: 'summer', year: 1, totalDay: 181 };
    state.rngState = 42;

    const moistureBefore = state.grid[0][0].soil.moisture;
    // Run several ticks
    for (let i = 0; i < 10; i++) {
      simulateTick(state, SLICE_1_SCENARIO);
      if (state.autoPauseQueue.length > 0) {
        dismissAutoPause(state);
        state.speed = 1;
      }
    }

    expect(state.grid[0][0].soil.moisture).toBeLessThan(moistureBefore);
  });

  it('crop grows with GDD accumulation', () => {
    state.calendar = { day: 60, month: 3, season: 'spring', year: 1, totalDay: 59 };
    processCommand(state, {
      type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn',
    }, SLICE_1_SCENARIO);

    state.speed = 1;
    // Run 50 ticks (50 days of spring/summer)
    for (let i = 0; i < 50; i++) {
      simulateTick(state, SLICE_1_SCENARIO);
      if (state.autoPauseQueue.length > 0) {
        dismissAutoPause(state);
        state.speed = 1;
      }
    }

    expect(state.grid[0][0].crop).not.toBeNull();
    expect(state.grid[0][0].crop!.gddAccumulated).toBeGreaterThan(0);
  });

  it('nitrogen increases during growth from mineralization (consumed at harvest)', () => {
    state.calendar = { day: 60, month: 3, season: 'spring', year: 1, totalDay: 59 };
    // Start with low nitrogen to see mineralization increase
    state.grid[0][0].soil.nitrogen = 10;
    state.grid[0][0].soil.organicMatter = 2.0;
    processCommand(state, {
      type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'processing-tomatoes',
    }, SLICE_1_SCENARIO);

    const nBefore = state.grid[0][0].soil.nitrogen;
    state.speed = 1;

    for (let i = 0; i < 30; i++) {
      simulateTick(state, SLICE_1_SCENARIO);
      if (state.autoPauseQueue.length > 0) {
        dismissAutoPause(state);
        state.speed = 1;
      }
    }

    // Nitrogen should increase during growth (mineralization adds N, consumption deferred to harvest)
    expect(state.grid[0][0].soil.nitrogen).toBeGreaterThan(nBefore);
  });

  it('does not charge cash when no crops are planted', () => {
    state.speed = 1;
    const cashBefore = state.economy.cash;

    for (let i = 0; i < 30; i++) {
      simulateTick(state, SLICE_1_SCENARIO);
      if (state.autoPauseQueue.length > 0) {
        dismissAutoPause(state);
        state.speed = 1;
      }
    }

    expect(state.economy.cash).toBe(cashBefore);
  });
});

// ============================================================================
// Auto-Pause
// ============================================================================

describe('Auto-pause', () => {
  it('triggers on year end', () => {
    state.speed = 1;
    // Set to day 364 (last day of year 1)
    state.calendar = { day: 364, month: 12, season: 'winter', year: 1, totalDay: 363 };
    state.rngState = 42;

    simulateTick(state, SLICE_1_SCENARIO);

    const yearEnd = state.autoPauseQueue.find(e => e.reason === 'year_end');
    expect(yearEnd).toBeDefined();
    expect(state.speed).toBe(0);
  });

  it('offers emergency loan on first cash <= 0 (not hard bankruptcy)', () => {
    state.speed = 1;
    state.economy.cash = 0;
    state.rngState = 42;

    simulateTick(state, SLICE_1_SCENARIO);

    // First insolvency should offer loan, not hard bankruptcy
    const loanOffer = state.autoPauseQueue.find(e => e.reason === 'loan_offer');
    expect(loanOffer).toBeDefined();
    expect(state.gameOver).toBe(true); // temporarily true until loan is accepted
  });

  it('triggers hard bankruptcy on second insolvency (loan already taken)', () => {
    state.speed = 1;
    state.economy.cash = 0;
    state.economy.totalLoansReceived = 1; // Already took a loan
    state.economy.debt = 5000;
    state.rngState = 42;

    simulateTick(state, SLICE_1_SCENARIO);

    const bankruptcy = state.autoPauseQueue.find(e => e.reason === 'bankruptcy');
    expect(bankruptcy).toBeDefined();
    expect(state.gameOver).toBe(true);
  });

  it('triggers water stress only once per season', () => {
    state.calendar = { day: 182, month: 7, season: 'summer', year: 1, totalDay: 181 };
    state.speed = 1;
    state.rngState = 42;

    // Plant a crop with very low moisture
    state.grid[0][0].crop = {
      cropId: 'silage-corn', plantedDay: 59, gddAccumulated: 500,
      waterStressDays: 0, growthStage: 'vegetative', overripeDaysRemaining: -1,
      isPerennial: false, perennialAge: 0, perennialEstablished: false, isDormant: false,
    };
    state.grid[0][0].soil.moisture = 0.5; // Below 25% of 6.0 capacity

    simulateTick(state, SLICE_1_SCENARIO);

    const waterStress = state.autoPauseQueue.filter(e => e.reason === 'water_stress');
    expect(waterStress).toHaveLength(1);
    expect(state.waterStressPausedThisSeason).toBe(true);

    // Clear queue and tick again — should NOT trigger again
    state.autoPauseQueue = [];
    state.speed = 1;
    state.grid[0][0].soil.moisture = 0.5; // Still low

    simulateTick(state, SLICE_1_SCENARIO);

    const waterStress2 = state.autoPauseQueue.filter(e => e.reason === 'water_stress');
    expect(waterStress2).toHaveLength(0);
  });
});

// ============================================================================
// Overripe Lifecycle
// ============================================================================

describe('Overripe lifecycle', () => {
  it('harvestable crops become overripe after one tick', () => {
    state.calendar = { day: 200, month: 7, season: 'summer', year: 1, totalDay: 199 };
    state.speed = 1;
    state.rngState = 42;

    state.grid[0][0].crop = {
      cropId: 'silage-corn', plantedDay: 59, gddAccumulated: 3000,
      waterStressDays: 0, growthStage: 'harvestable', overripeDaysRemaining: -1,
      isPerennial: false, perennialAge: 0, perennialEstablished: false, isDormant: false,
    };

    simulateTick(state, SLICE_1_SCENARIO);
    // Should auto-pause for harvest ready, but crop transitions to overripe
    dismissAutoPause(state);
    state.speed = 1;

    simulateTick(state, SLICE_1_SCENARIO);

    expect(state.grid[0][0].crop).not.toBeNull();
    expect(state.grid[0][0].crop!.growthStage).toBe('overripe');
    expect(state.grid[0][0].crop!.overripeDaysRemaining).toBe(OVERRIPE_GRACE_DAYS - 1);
  });

  it('crop rots after full grace period', () => {
    state.calendar = { day: 200, month: 7, season: 'summer', year: 1, totalDay: 199 };
    state.speed = 1;
    state.rngState = 42;

    state.grid[0][0].crop = {
      cropId: 'silage-corn', plantedDay: 59, gddAccumulated: 3000,
      waterStressDays: 0, growthStage: 'overripe' as const, overripeDaysRemaining: 1,
      isPerennial: false, perennialAge: 0, perennialEstablished: false, isDormant: false,
    };

    simulateTick(state, SLICE_1_SCENARIO);

    expect(state.grid[0][0].crop).toBeNull(); // Rotted away
    const rottedNotif = state.notifications.find(n => n.type === 'crop_rotted');
    expect(rottedNotif).toBeDefined();
  });

  it('yield percentage decays linearly during grace period', () => {
    const crop = {
      cropId: 'silage-corn', plantedDay: 0, gddAccumulated: 3000,
      waterStressDays: 0, growthStage: 'overripe' as const, overripeDaysRemaining: 15,
      isPerennial: false, perennialAge: 0, perennialEstablished: false, isDormant: false,
    };
    expect(getYieldPercentage(crop)).toBe(50); // 15/30 = 50%

    crop.overripeDaysRemaining = 30;
    expect(getYieldPercentage(crop)).toBe(100);

    crop.overripeDaysRemaining = 0;
    expect(getYieldPercentage(crop)).toBe(0);
  });
});

// ============================================================================
// Economic Realism
// ============================================================================

describe('Economic realism', () => {
  it('full grid of corn with good conditions is profitable', () => {
    state.calendar = { day: 60, month: 3, season: 'spring', year: 1, totalDay: 59 };

    // Plant full field
    processCommand(state, {
      type: 'PLANT_BULK', scope: 'all', cropId: 'silage-corn',
    }, SLICE_1_SCENARIO);

    const cashAfterPlanting = state.economy.cash;

    // Force all to harvestable with good conditions
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const crop = state.grid[r][c].crop!;
        crop.growthStage = 'harvestable';
        crop.gddAccumulated = 3000;
        crop.waterStressDays = 0;
        state.grid[r][c].soil.nitrogen = 100;
      }
    }

    processCommand(state, { type: 'HARVEST_BULK', scope: 'all' }, SLICE_1_SCENARIO);

    // Revenue should exceed planting cost
    expect(state.economy.cash).toBeGreaterThan(cashAfterPlanting);
    expect(state.economy.yearlyRevenue).toBeGreaterThan(state.economy.yearlyExpenses);
  });

  it('idle farm has no mid-year charges (overhead is year-end only)', () => {
    state.speed = 1;
    const startCash = state.economy.cash;

    for (let i = 0; i < 100; i++) {
      simulateTick(state, SLICE_1_SCENARIO);
      if (state.autoPauseQueue.length > 0) {
        dismissAutoPause(state);
        state.speed = 1;
      }
    }

    expect(state.economy.cash).toBe(startCash);
  });
});

// ============================================================================
// Determinism
// ============================================================================

describe('Determinism', () => {
  it('two identical runs produce identical state', () => {
    const state1 = createInitialState('test', SLICE_1_SCENARIO);
    const state2 = createInitialState('test', SLICE_1_SCENARIO);

    // Same commands
    state1.calendar = { day: 60, month: 3, season: 'spring', year: 1, totalDay: 59 };
    state2.calendar = { day: 60, month: 3, season: 'spring', year: 1, totalDay: 59 };

    processCommand(state1, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
    processCommand(state2, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);

    state1.speed = 1;
    state2.speed = 1;

    // Run 100 ticks
    for (let i = 0; i < 100; i++) {
      simulateTick(state1, SLICE_1_SCENARIO);
      simulateTick(state2, SLICE_1_SCENARIO);
      if (state1.autoPauseQueue.length > 0) {
        dismissAutoPause(state1);
        state1.speed = 1;
      }
      if (state2.autoPauseQueue.length > 0) {
        dismissAutoPause(state2);
        state2.speed = 1;
      }
    }

    expect(state1.calendar.totalDay).toBe(state2.calendar.totalDay);
    expect(state1.economy.cash).toBe(state2.economy.cash);
    expect(state1.grid[0][0].soil.moisture).toBe(state2.grid[0][0].soil.moisture);
    expect(state1.grid[0][0].soil.nitrogen).toBe(state2.grid[0][0].soil.nitrogen);
    expect(state1.rngState).toBe(state2.rngState);
  });
});

// ============================================================================
// Available Crops
// ============================================================================

describe('getAvailableCrops', () => {
  it('returns tomatoes and corn in spring', () => {
    state.calendar = { day: 60, month: 3, season: 'spring', year: 1, totalDay: 59 };
    const available = getAvailableCrops(state);
    expect(available).toContain('processing-tomatoes');
    expect(available).toContain('silage-corn');
    expect(available).not.toContain('winter-wheat');
  });

  it('returns winter wheat in fall', () => {
    state.calendar = { day: 274, month: 10, season: 'fall', year: 1, totalDay: 273 };
    const available = getAvailableCrops(state);
    expect(available).toContain('winter-wheat');
    expect(available).not.toContain('processing-tomatoes');
  });

  it('returns nothing in December', () => {
    state.calendar = { day: 345, month: 12, season: 'winter', year: 1, totalDay: 344 };
    const available = getAvailableCrops(state);
    expect(available).toHaveLength(0);
  });
});

// ============================================================================
// Year End Summary
// ============================================================================

describe('Year-end tracking', () => {
  it('resetYearlyTracking clears revenue and expenses', () => {
    state.economy.yearlyRevenue = 5000;
    state.economy.yearlyExpenses = 3000;
    state.yearEndSummaryPending = true;

    resetYearlyTracking(state);

    expect(state.economy.yearlyRevenue).toBe(0);
    expect(state.economy.yearlyExpenses).toBe(0);
    expect(state.yearEndSummaryPending).toBe(false);
  });
});

// ============================================================================
// Harvest Auto-Pause (Issue #1 fix)
// ============================================================================

describe('Harvest auto-pause', () => {
  it('auto-pauses when crop naturally reaches harvestable via GDD', () => {
    state.calendar = { day: 60, month: 3, season: 'spring', year: 1, totalDay: 59 };
    processCommand(state, {
      type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn',
    }, SLICE_1_SCENARIO);

    state.speed = 1;

    // Run until harvest auto-pause triggers or 200 days pass
    let harvestPause = false;
    for (let i = 0; i < 200; i++) {
      simulateTick(state, SLICE_1_SCENARIO);
      const harvestEvent = state.autoPauseQueue.find(e => e.reason === 'harvest_ready');
      if (harvestEvent) {
        harvestPause = true;
        break;
      }
      // Dismiss any other auto-pause events and continue
      if (state.autoPauseQueue.length > 0) {
        dismissAutoPause(state);
        state.speed = 1;
      }
    }

    expect(harvestPause).toBe(true);
    expect(state.speed).toBe(0);
  });
});

// ============================================================================
// Auto-Pause Priority Ordering (Issue #2 fix)
// ============================================================================

describe('Auto-pause priority ordering', () => {
  it('orders events by priority (highest first)', () => {
    state.speed = 1;
    state.calendar = { day: 364, month: 12, season: 'winter', year: 1, totalDay: 363 };
    state.economy.cash = 0;
    state.rngState = 42;

    // This tick should trigger both year_end and loan_offer (first insolvency)
    simulateTick(state, SLICE_1_SCENARIO);

    expect(state.autoPauseQueue.length).toBeGreaterThanOrEqual(2);
    // loan_offer (priority 95) should come before year_end (priority 40)
    const reasons = state.autoPauseQueue.map(e => e.reason);
    const loanOfferIdx = reasons.indexOf('loan_offer');
    const yearEndIdx = reasons.indexOf('year_end');
    expect(loanOfferIdx).not.toBe(-1);
    expect(yearEndIdx).not.toBe(-1);
    expect(loanOfferIdx).toBeLessThan(yearEndIdx);
  });

  it('AUTO_PAUSE_PRIORITY has correct relative ordering', () => {
    expect(AUTO_PAUSE_PRIORITY.bankruptcy).toBeGreaterThan(AUTO_PAUSE_PRIORITY.harvest_ready);
    expect(AUTO_PAUSE_PRIORITY.harvest_ready).toBeGreaterThan(AUTO_PAUSE_PRIORITY.water_stress);
    expect(AUTO_PAUSE_PRIORITY.water_stress).toBeGreaterThan(AUTO_PAUSE_PRIORITY.year_end);
  });

  it('preserves insertion order for equal-priority events (stable sort)', () => {
    // bankruptcy and year_30 both have priority 100
    state.autoPauseQueue = [
      { reason: 'year_end', message: 'first (low priority)' },
      { reason: 'bankruptcy', message: 'second (high priority)' },
      { reason: 'year_30', message: 'third (high priority, same as bankruptcy)' },
      { reason: 'water_stress', message: 'fourth (mid priority)' },
    ];

    // Sort by priority
    state.autoPauseQueue.sort(
      (a, b) => AUTO_PAUSE_PRIORITY[b.reason] - AUTO_PAUSE_PRIORITY[a.reason],
    );

    const reasons = state.autoPauseQueue.map(e => e.reason);
    // bankruptcy and year_30 are both priority 100 — insertion order preserved
    expect(reasons[0]).toBe('bankruptcy');
    expect(reasons[1]).toBe('year_30');
    // Then water_stress (60), then year_end (40)
    expect(reasons[2]).toBe('water_stress');
    expect(reasons[3]).toBe('year_end');
  });
});

// ============================================================================
// DD-1: Partial Plant Skips Partially-Filled Rows (Issue #7 fix)
// ============================================================================

describe('DD-1 complete rows', () => {
  it('partial plant offer only counts fully-empty rows', () => {
    state.calendar = { day: 60, month: 3, season: 'spring', year: 1, totalDay: 59 };

    // Plant one cell in row 0 (making it partially filled)
    processCommand(state, {
      type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'processing-tomatoes',
    }, SLICE_1_SCENARIO);

    // Set cash so we can only afford 2 full rows
    const cornCost = getCropDefinition('silage-corn').seedCostPerAcre;
    state.economy.cash = cornCost * GRID_COLS * 2; // Exactly 2 rows worth

    const result = processCommand(state, {
      type: 'PLANT_BULK', scope: 'all', cropId: 'silage-corn',
    }, SLICE_1_SCENARIO);

    // Should get partial offer — only counting fully-empty rows (7 rows, not 8)
    // With budget for 2 rows, should offer 2 rows
    expect(result.success).toBe(false);
    expect(result.reason).toBe('partial');
    expect(result.partialOffer).toBeDefined();
    expect(result.partialOffer!.affordableRows).toBe(2);
    // Should be 16 plots (2 full rows of 8)
    expect(result.partialOffer!.affordablePlots).toBe(16);
  });

  it('fully-empty field plant-all works normally', () => {
    state.calendar = { day: 60, month: 3, season: 'spring', year: 1, totalDay: 59 };

    const result = processCommand(state, {
      type: 'PLANT_BULK', scope: 'all', cropId: 'silage-corn',
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(true);
    expect(result.cellsAffected).toBe(64);
  });
});
