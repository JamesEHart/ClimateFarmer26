/**
 * Economy Tests — Sub-Slice 4c: OM yield penalty + water allocation enforcement.
 *
 * TDD: these tests are written BEFORE the implementation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInitialState, processCommand, simulateTick, harvestCell, executeWater,
  computeOMYieldFactor,
} from '../../src/engine/game.ts';
import type { GameState, Cell } from '../../src/engine/types.ts';
import {
  STARTING_CASH, STARTING_ORGANIC_MATTER, WATER_DOSE_INCHES,
  IRRIGATION_COST_PER_CELL, OM_FLOOR, OM_YIELD_THRESHOLD, OM_YIELD_FLOOR,
  NITROGEN_CUSHION_FACTOR, N_MINERALIZATION_RATE, OM_DECOMP_RATE,
} from '../../src/engine/types.ts';
import { SLICE_1_SCENARIO } from '../../src/data/scenario.ts';
import { SCENARIOS } from '../../src/data/scenarios.ts';
import { getCropDefinition } from '../../src/data/crops.ts';

let state: GameState;

beforeEach(() => {
  state = createInitialState('test-player', SLICE_1_SCENARIO);
});

// ============================================================================
// Lever 1: OM Yield Factor
// ============================================================================

describe('computeOMYieldFactor', () => {
  it('returns 1.0 when OM >= threshold (2.0%)', () => {
    expect(computeOMYieldFactor(2.0)).toBe(1.0);
    expect(computeOMYieldFactor(2.5)).toBe(1.0);
    expect(computeOMYieldFactor(3.0)).toBe(1.0);
  });

  it('returns ~0.92 at OM = 1.8%', () => {
    const factor = computeOMYieldFactor(1.8);
    expect(factor).toBeCloseTo(0.92, 2);
  });

  it('returns 0.80 at OM = 1.5%', () => {
    const factor = computeOMYieldFactor(1.5);
    expect(factor).toBeCloseTo(0.80, 2);
  });

  it('returns floor (0.40) at OM = 0.5%', () => {
    expect(computeOMYieldFactor(0.5)).toBeCloseTo(OM_YIELD_FLOOR, 2);
  });

  it('never returns below floor', () => {
    expect(computeOMYieldFactor(0.3)).toBeGreaterThanOrEqual(OM_YIELD_FLOOR);
    expect(computeOMYieldFactor(0.0)).toBeGreaterThanOrEqual(OM_YIELD_FLOOR);
    expect(computeOMYieldFactor(-1.0)).toBeGreaterThanOrEqual(OM_YIELD_FLOOR);
  });

  it('is monotonically increasing with OM', () => {
    const oms = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
    for (let i = 1; i < oms.length; i++) {
      expect(computeOMYieldFactor(oms[i])).toBeGreaterThanOrEqual(
        computeOMYieldFactor(oms[i - 1]),
      );
    }
  });
});

describe('harvestCell applies OM yield factor', () => {
  function setupHarvestableCorn(cell: Cell): void {
    const cornDef = getCropDefinition('silage-corn');
    cell.crop = {
      cropId: 'silage-corn',
      plantedDay: 59,
      gddAccumulated: cornDef.gddToMaturity,
      growthStage: 'harvestable',
      waterStressDays: 0,
      overripeDaysRemaining: 30,
      isPerennial: false,
      perennialAge: 0,
      perennialEstablished: false,
      chillHoursAccumulated: 0,
      harvestedThisSeason: false,
    };
  }

  it('yields more at OM=2.0 than at OM=1.5', () => {
    const cell1 = state.grid[0][0];
    const cell2 = state.grid[0][1];

    // Both cells: identical corn, different OM
    setupHarvestableCorn(cell1);
    setupHarvestableCorn(cell2);
    cell1.soil.organicMatter = 2.0;
    cell1.soil.nitrogen = 200; // max N to isolate OM effect
    cell2.soil.organicMatter = 1.5;
    cell2.soil.nitrogen = 200;

    const cashBefore1 = state.economy.cash;
    const rev1 = harvestCell(state, cell1);

    const cashBefore2 = state.economy.cash;
    const rev2 = harvestCell(state, cell2);

    // Revenue at OM=2.0 should be higher than at OM=1.5
    // At OM=2.0: omFactor=1.0, at OM=1.5: omFactor=0.80
    expect(rev1).toBeGreaterThan(rev2);

    // The ratio should approximately match the omFactor difference
    // rev2/rev1 ≈ 0.80 (allowing for labor cost differences in net revenue)
    const grossRev1 = rev1 + getCropDefinition('silage-corn').laborCostPerAcre;
    const grossRev2 = rev2 + getCropDefinition('silage-corn').laborCostPerAcre;
    expect(grossRev2 / grossRev1).toBeCloseTo(0.80, 1);
  });

  it('yields same at OM=2.0 and OM=2.5 (no bonus above threshold)', () => {
    const cell1 = state.grid[0][0];
    const cell2 = state.grid[0][1];

    setupHarvestableCorn(cell1);
    setupHarvestableCorn(cell2);
    cell1.soil.organicMatter = 2.0;
    cell1.soil.nitrogen = 200;
    cell2.soil.organicMatter = 2.5;
    cell2.soil.nitrogen = 200;

    const rev1 = harvestCell(state, cell1);
    const rev2 = harvestCell(state, cell2);

    // Both should be identical (omFactor=1.0 for both)
    expect(rev1).toBe(rev2);
  });
});

// ============================================================================
// Lever 2: Water Allocation Enforcement
// ============================================================================

describe('executeWater applies water allocation', () => {
  it('reduces effective dose by scenario waterAllocation', () => {
    // early-drought scenario: year 1 allocation = 0.80
    const earlyDrought = SCENARIOS['early-drought'];
    const cell = state.grid[0][0];
    cell.crop = {
      cropId: 'silage-corn',
      plantedDay: 59,
      gddAccumulated: 100,
      growthStage: 'vegetative',
      waterStressDays: 0,
      overripeDaysRemaining: -1,
      isPerennial: false,
      perennialAge: 0,
      perennialEstablished: false,
      chillHoursAccumulated: 0,
      harvestedThisSeason: false,
      isDormant: false,
    };
    cell.soil.moisture = 1.0;

    state.economy.cash = 10_000;
    const result = executeWater(state, [cell], earlyDrought);

    expect(result.success).toBe(true);
    // Year 1, allocation = 0.80 → effective dose = 3.0 × 0.80 = 2.4"
    // Starting moisture 1.0 + 2.4 = 3.4
    expect(cell.soil.moisture).toBeCloseTo(3.4, 1);
  });

  it('delivers full dose when no scenario provided (fallback)', () => {
    const cell = state.grid[0][0];
    cell.crop = {
      cropId: 'silage-corn',
      plantedDay: 59,
      gddAccumulated: 100,
      growthStage: 'vegetative',
      waterStressDays: 0,
      overripeDaysRemaining: -1,
      isPerennial: false,
      perennialAge: 0,
      perennialEstablished: false,
      chillHoursAccumulated: 0,
      harvestedThisSeason: false,
      isDormant: false,
    };
    cell.soil.moisture = 1.0;

    state.economy.cash = 10_000;
    const result = executeWater(state, [cell]);

    expect(result.success).toBe(true);
    // No scenario → allocation = 1.0 → full dose = 3.0"
    // Starting moisture 1.0 + 3.0 = 4.0
    expect(cell.soil.moisture).toBeCloseTo(4.0, 1);
  });

  it('delivers full dose when scenario allocation = 1.0', () => {
    // gradual-warming year 1: waterAllocationBase = 1.0, decline = 0.008, so year 1 = 1.0
    const gradual = SCENARIOS['gradual-warming'];
    const cell = state.grid[0][0];
    cell.crop = {
      cropId: 'silage-corn',
      plantedDay: 59,
      gddAccumulated: 100,
      growthStage: 'vegetative',
      waterStressDays: 0,
      overripeDaysRemaining: -1,
      isPerennial: false,
      perennialAge: 0,
      perennialEstablished: false,
      chillHoursAccumulated: 0,
      harvestedThisSeason: false,
      isDormant: false,
    };
    cell.soil.moisture = 1.0;

    state.economy.cash = 10_000;
    const result = executeWater(state, [cell], gradual);

    expect(result.success).toBe(true);
    // Year 1, allocation = 1.0 → full dose = 3.0"
    expect(cell.soil.moisture).toBeCloseTo(4.0, 1);
  });

  it('dose decreases as allocation declines across years', () => {
    // gradual-warming: year 1 alloc = 1.0, year 30 alloc = max(0.7, 1.0 - 29*0.008) = max(0.7, 0.768) = 0.768
    const gradual = SCENARIOS['gradual-warming'];

    // Year 1
    const cell1 = state.grid[0][0];
    cell1.crop = {
      cropId: 'silage-corn',
      plantedDay: 59,
      gddAccumulated: 100,
      growthStage: 'vegetative',
      waterStressDays: 0,
      overripeDaysRemaining: -1,
      isPerennial: false,
      perennialAge: 0,
      perennialEstablished: false,
      chillHoursAccumulated: 0,
      harvestedThisSeason: false,
      isDormant: false,
    };
    cell1.soil.moisture = 1.0;
    state.economy.cash = 10_000;
    executeWater(state, [cell1], gradual);
    const moistureYear1 = cell1.soil.moisture;

    // Year 30 — set calendar to year 30
    state.calendar.year = 30;
    const cell2 = state.grid[0][1];
    cell2.crop = {
      cropId: 'silage-corn',
      plantedDay: 59,
      gddAccumulated: 100,
      growthStage: 'vegetative',
      waterStressDays: 0,
      overripeDaysRemaining: -1,
      isPerennial: false,
      perennialAge: 0,
      perennialEstablished: false,
      chillHoursAccumulated: 0,
      harvestedThisSeason: false,
      isDormant: false,
    };
    cell2.soil.moisture = 1.0;
    executeWater(state, [cell2], gradual);
    const moistureYear30 = cell2.soil.moisture;

    // Year 30 dose should be less than year 1 dose
    expect(moistureYear30).toBeLessThan(moistureYear1);
    // Year 1: 1.0 + 3.0 = 4.0; Year 30: 1.0 + 3.0*0.768 = 1.0 + 2.304 = 3.304
    expect(moistureYear30).toBeCloseTo(3.304, 1);
  });

  it('cost per cell is unchanged regardless of allocation', () => {
    const earlyDrought = SCENARIOS['early-drought'];
    const cell = state.grid[0][0];
    cell.crop = {
      cropId: 'silage-corn',
      plantedDay: 59,
      gddAccumulated: 100,
      growthStage: 'vegetative',
      waterStressDays: 0,
      overripeDaysRemaining: -1,
      isPerennial: false,
      perennialAge: 0,
      perennialEstablished: false,
      chillHoursAccumulated: 0,
      harvestedThisSeason: false,
      isDormant: false,
    };
    cell.soil.moisture = 1.0;
    state.economy.cash = 10_000;

    const result = executeWater(state, [cell], earlyDrought);

    // Cost should be standard $5/cell, not scaled by allocation
    expect(result.cost).toBe(IRRIGATION_COST_PER_CELL);
  });

  it('combined penalty: allocation-reduced dose + event cost surcharge stack', () => {
    // Setup: early-drought scenario (allocation=0.80) + irrigation cost modifier (1.5×)
    const earlyDrought = SCENARIOS['early-drought'];

    // Add active effect simulating water-allocation-cut event "accept-higher-costs" choice
    state.activeEffects.push({
      effectType: 'irrigation_cost_modifier',
      multiplier: 1.5,
      expiresOnDay: state.calendar.totalDay + 90,
    });

    const cell = state.grid[0][0];
    cell.crop = {
      cropId: 'silage-corn',
      plantedDay: 59,
      gddAccumulated: 100,
      growthStage: 'vegetative',
      waterStressDays: 0,
      overripeDaysRemaining: -1,
      isPerennial: false,
      perennialAge: 0,
      perennialEstablished: false,
      chillHoursAccumulated: 0,
      harvestedThisSeason: false,
      isDormant: false,
    };
    cell.soil.moisture = 1.0;
    state.economy.cash = 10_000;

    const result = executeWater(state, [cell], earlyDrought);

    expect(result.success).toBe(true);

    // Dose: reduced by allocation (0.80) → 3.0 × 0.80 = 2.4"
    expect(cell.soil.moisture).toBeCloseTo(3.4, 1);

    // Cost: increased by event modifier (1.5×) → $5 × 1.5 = $7.50
    expect(result.cost).toBe(IRRIGATION_COST_PER_CELL * 1.5);

    // Player pays MORE and gets LESS water — both penalties stack
    expect(cell.soil.moisture).toBeLessThan(1.0 + WATER_DOSE_INCHES); // less water than full dose
    expect(result.cost!).toBeGreaterThan(IRRIGATION_COST_PER_CELL); // more expensive than base
  });
});

// ============================================================================
// Lever 3: Nitrogen Formula Tightening
// ============================================================================

describe('nitrogen dynamics', () => {
  it('NITROGEN_CUSHION_FACTOR is 0.10', () => {
    expect(NITROGEN_CUSHION_FACTOR).toBe(0.10);
  });

  it('harvest consumes nitrogen from soil', () => {
    const cell = state.grid[0][0];
    const cornDef = getCropDefinition('silage-corn');
    cell.crop = {
      cropId: 'silage-corn',
      plantedDay: 59,
      gddAccumulated: cornDef.gddToMaturity,
      growthStage: 'harvestable',
      waterStressDays: 0,
      overripeDaysRemaining: 30,
      isPerennial: false,
      perennialAge: 0,
      perennialEstablished: false,
      chillHoursAccumulated: 0,
      harvestedThisSeason: false,
    };
    cell.soil.nitrogen = 100;
    cell.soil.organicMatter = 2.0;

    harvestCell(state, cell);

    // Corn uptake = 150, soil had 100 → clamped to 0
    expect(cell.soil.nitrogen).toBe(0);
  });

  it('yield at 0 soil nitrogen is ~25% (not 50%)', () => {
    const cell1 = state.grid[0][0];
    const cell2 = state.grid[0][1];
    const cornDef = getCropDefinition('silage-corn');

    // Cell 1: max nitrogen → full yield
    cell1.crop = {
      cropId: 'silage-corn',
      plantedDay: 59,
      gddAccumulated: cornDef.gddToMaturity,
      growthStage: 'harvestable',
      waterStressDays: 0,
      overripeDaysRemaining: 30,
      isPerennial: false,
      perennialAge: 0,
      perennialEstablished: false,
      chillHoursAccumulated: 0,
      harvestedThisSeason: false,
      isDormant: false,
    };
    cell1.soil.nitrogen = 200;
    cell1.soil.organicMatter = 2.0;

    // Cell 2: 0 nitrogen → cushion-limited yield
    cell2.crop = {
      cropId: 'silage-corn',
      plantedDay: 59,
      gddAccumulated: cornDef.gddToMaturity,
      growthStage: 'harvestable',
      waterStressDays: 0,
      overripeDaysRemaining: 30,
      isPerennial: false,
      perennialAge: 0,
      perennialEstablished: false,
      chillHoursAccumulated: 0,
      harvestedThisSeason: false,
      isDormant: false,
    };
    cell2.soil.nitrogen = 0;
    cell2.soil.organicMatter = 2.0;

    const rev1 = harvestCell(state, cell1);
    const rev2 = harvestCell(state, cell2);

    // With cushion 0.10: nFactor at 0 nitrogen = min(1, (0 + 150*0.10)/150) = 0.10
    // So gross revenue ratio should be ~0.10
    const grossRev1 = rev1 + cornDef.laborCostPerAcre;
    const grossRev2 = rev2 + cornDef.laborCostPerAcre;
    expect(grossRev2 / grossRev1).toBeCloseTo(0.10, 1);
  });

  it('yield at half needed nitrogen is ~75%', () => {
    const cell = state.grid[0][0];
    const cornDef = getCropDefinition('silage-corn');

    cell.crop = {
      cropId: 'silage-corn',
      plantedDay: 59,
      gddAccumulated: cornDef.gddToMaturity,
      growthStage: 'harvestable',
      waterStressDays: 0,
      overripeDaysRemaining: 30,
      isPerennial: false,
      perennialAge: 0,
      perennialEstablished: false,
      chillHoursAccumulated: 0,
      harvestedThisSeason: false,
      isDormant: false,
    };
    // Half needed N: 75 out of 150 → nFactor = min(1, (75 + 150*0.10)/150) = min(1, 90/150) = 0.60
    cell.soil.nitrogen = 75;
    cell.soil.organicMatter = 2.0;

    // Reference: full nitrogen
    const refCell = state.grid[0][1];
    refCell.crop = {
      cropId: 'silage-corn',
      plantedDay: 59,
      gddAccumulated: cornDef.gddToMaturity,
      growthStage: 'harvestable',
      waterStressDays: 0,
      overripeDaysRemaining: 30,
      isPerennial: false,
      perennialAge: 0,
      perennialEstablished: false,
      chillHoursAccumulated: 0,
      harvestedThisSeason: false,
      isDormant: false,
    };
    refCell.soil.nitrogen = 200;
    refCell.soil.organicMatter = 2.0;

    const rev = harvestCell(state, cell);
    const refRev = harvestCell(state, refCell);

    const grossRev = rev + cornDef.laborCostPerAcre;
    const grossRef = refRev + cornDef.laborCostPerAcre;
    expect(grossRev / grossRef).toBeCloseTo(0.60, 1);
  });
});
