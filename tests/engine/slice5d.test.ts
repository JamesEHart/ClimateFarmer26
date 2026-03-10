import { describe, it, expect } from 'vitest';
import { evaluateCondition } from '../../src/engine/events/selector.ts';
import { createInitialState, processCommand, harvestCell } from '../../src/engine/game.ts';
import { SLICE_1_SCENARIO } from '../../src/data/scenario.ts';
import { STORYLETS } from '../../src/data/events.ts';
import { SeededRNG } from '../../src/engine/rng.ts';
import { getCropDefinition } from '../../src/data/crops.ts';
import type { GameState } from '../../src/engine/types.ts';
import { MONOCULTURE_PENALTY_PER_YEAR, MONOCULTURE_PENALTY_FLOOR } from '../../src/engine/types.ts';
import type { Storylet } from '../../src/engine/events/types.ts';

// ============================================================================
// Test Helpers
// ============================================================================

function makeState(): GameState {
  return createInitialState('test-5d', SLICE_1_SCENARIO);
}

function getStorylet(id: string): Storylet {
  const s = STORYLETS.find(s => s.id === id);
  if (!s) throw new Error(`Storylet not found: ${id}`);
  return s;
}

function evaluateNonRandomConditions(storylet: Storylet, state: GameState): boolean {
  const rng = new SeededRNG(42);
  for (const cond of storylet.preconditions.filter(c => c.type !== 'random')) {
    if (!evaluateCondition(cond, state, rng)) return false;
  }
  return true;
}

function setYear(state: GameState, year: number): void {
  state.calendar.year = year;
  state.calendar.totalDay = (year - 1) * 365 + state.calendar.day;
}

// ============================================================================
// A4: #82 — advisor-drought-recovery Threshold Tuning
// ============================================================================

describe('Slice 5d — advisor-drought-recovery thresholds (#82)', () => {
  const storylet = getStorylet('advisor-drought-recovery');

  it('does NOT fire at cash=$25K year 4 (at threshold, not below)', () => {
    const state = makeState();
    setYear(state, 4);
    state.economy.cash = 25000;
    expect(evaluateNonRandomConditions(storylet, state)).toBe(false);
  });

  it('fires at cash=$15K year 4 (well below threshold)', () => {
    const state = makeState();
    setYear(state, 4);
    state.economy.cash = 15000;
    expect(evaluateNonRandomConditions(storylet, state)).toBe(true);
  });

  it('does NOT fire at cash=$15K year 3 (min_year=4)', () => {
    const state = makeState();
    setYear(state, 3);
    state.economy.cash = 15000;
    expect(evaluateNonRandomConditions(storylet, state)).toBe(false);
  });

  it('cooldownDays is 730 (biennial)', () => {
    expect(storylet.cooldownDays).toBe(730);
  });

  it('maxOccurrences is 2', () => {
    expect(storylet.maxOccurrences).toBe(2);
  });

  it('cash_below threshold is 25000 (filters false positives from perennial investors)', () => {
    const cashCond = storylet.preconditions.find(c => c.type === 'cash_below');
    expect(cashCond).toBeDefined();
    expect((cashCond as { amount: number }).amount).toBe(25000);
  });
});

// ============================================================================
// A1: #81 — Bulk Plant Feedback (engine-level: failure reasons)
// ============================================================================

describe('Slice 5d — bulk plant failure reasons (#81)', () => {
  it('PLANT_BULK on fully-planted row returns failure with reason', () => {
    const state = makeState();
    // Plant an entire row first
    const scenario = SLICE_1_SCENARIO;
    state.calendar.month = 3; // March — planting window for corn
    processCommand(state, { type: 'PLANT_BULK', scope: 'row', index: 0, cropId: 'silage-corn' }, scenario);

    // Try to plant again on the same row
    const result = processCommand(state, { type: 'PLANT_BULK', scope: 'row', index: 0, cropId: 'silage-corn' }, scenario);
    expect(result.success).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('PLANT_BULK field-scope with all rows partially filled returns failure', () => {
    const state = makeState();
    const scenario = SLICE_1_SCENARIO;
    state.calendar.month = 3;
    // Plant one cell in every row (makes every row non-empty, so field-scope has no fully-empty rows)
    for (let r = 0; r < 8; r++) {
      processCommand(state, { type: 'PLANT_CROP', cellRow: r, cellCol: 0, cropId: 'silage-corn' }, scenario);
    }

    // Field-scope: no fully-empty rows available (DD-1 semantics)
    const result = processCommand(state, { type: 'PLANT_BULK', scope: 'all', cropId: 'silage-corn' }, scenario);
    expect(result.success).toBe(false);
    expect(result.reason).toBeDefined();
  });
});

// ============================================================================
// Monoculture Streak Penalty
// ============================================================================

describe('Slice 5d — monoculture streak penalty', () => {
  const scenario = SLICE_1_SCENARIO;

  /** Plant corn, advance GDD to harvestable, harvest, return revenue */
  function plantAndHarvest(state: GameState, row: number, col: number, silent = true): number {
    state.calendar.month = 3;
    processCommand(state, { type: 'PLANT_CROP', cellRow: row, cellCol: col, cropId: 'silage-corn' }, scenario);
    const cell = state.grid[row][col];
    const cropDef = getCropDefinition('silage-corn');
    // Force to harvestable
    cell.crop!.gddAccumulated = cropDef.gddToMaturity;
    cell.crop!.growthStage = 'harvestable';
    cell.crop!.waterStressDays = 0;
    // Reset all soil to perfect conditions to isolate the monoculture penalty
    cell.soil.nitrogen = 200;
    cell.soil.organicMatter = 2.0;
    cell.soil.potassium = 200;
    return harvestCell(state, cell, silent);
  }

  it('no penalty on first planting (lastCropId is null)', () => {
    const state = makeState();
    const cell = state.grid[0][0];
    expect(cell.lastCropId).toBeNull();
    const revenue1 = plantAndHarvest(state, 0, 0);
    expect(revenue1).toBeGreaterThan(0);
    // After harvest, lastCropId should be set
    expect(cell.lastCropId).toBe('silage-corn');
    expect(cell.consecutiveSameCropCount).toBe(0);
  });

  it('2nd consecutive harvest gets 15% penalty (streak=1)', () => {
    const state = makeState();
    const revenue1 = plantAndHarvest(state, 0, 0);
    const revenue2 = plantAndHarvest(state, 0, 0);
    const ratio = revenue2 / revenue1;
    // 2nd consecutive: penalty = 1.0 - MONOCULTURE_PENALTY_PER_YEAR * 1
    const expectedPenalty = 1.0 - MONOCULTURE_PENALTY_PER_YEAR;
    expect(ratio).toBeCloseTo(expectedPenalty, 1);
    expect(state.grid[0][0].consecutiveSameCropCount).toBe(1);
  });

  it('3rd consecutive harvest gets 30% penalty (streak=2)', () => {
    const state = makeState();
    const revenue1 = plantAndHarvest(state, 0, 0);
    plantAndHarvest(state, 0, 0); // 2nd — builds streak
    const revenue3 = plantAndHarvest(state, 0, 0); // 3rd
    const ratio = revenue3 / revenue1;
    const expectedPenalty = 1.0 - MONOCULTURE_PENALTY_PER_YEAR * 2;
    expect(ratio).toBeCloseTo(expectedPenalty, 1);
    expect(state.grid[0][0].consecutiveSameCropCount).toBe(2);
  });

  it('penalty floors at MONOCULTURE_PENALTY_FLOOR after enough consecutive years', () => {
    const state = makeState();
    const revenue1 = plantAndHarvest(state, 0, 0);
    // Build up streak to hit floor
    for (let i = 0; i < 6; i++) {
      plantAndHarvest(state, 0, 0);
    }
    // 7th+ consecutive: should be at floor
    const revenueFloor = plantAndHarvest(state, 0, 0);
    const ratio = revenueFloor / revenue1;
    expect(ratio).toBeCloseTo(MONOCULTURE_PENALTY_FLOOR, 1);
  });

  it('no penalty when crop is rotated (streak resets)', () => {
    const state = makeState();
    // Plant corn, harvest
    plantAndHarvest(state, 0, 0);
    expect(state.grid[0][0].lastCropId).toBe('silage-corn');
    // Plant wheat (different crop), harvest
    state.calendar.month = 10; // Fall — wheat planting window
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'winter-wheat' }, scenario);
    const cell = state.grid[0][0];
    const wheatDef = getCropDefinition('winter-wheat');
    cell.crop!.gddAccumulated = wheatDef.gddToMaturity;
    cell.crop!.growthStage = 'harvestable';
    cell.crop!.waterStressDays = 0;
    cell.soil.nitrogen = 200;
    cell.soil.organicMatter = 2.0;
    cell.soil.potassium = 200;
    const wheatRevenue = harvestCell(state, cell, true);
    expect(wheatRevenue).toBeGreaterThan(0);
    // Streak should be reset
    expect(cell.consecutiveSameCropCount).toBe(0);
    // Now plant corn again — lastCropId is 'winter-wheat', not 'silage-corn'
    expect(cell.lastCropId).toBe('winter-wheat');
    const cornRevenue = plantAndHarvest(state, 0, 0);
    // Should get full corn yield (no monoculture penalty — rotated through wheat)
    const firstCornRevenue = plantAndHarvest(state, 1, 0); // reference from fresh cell
    const ratio = cornRevenue / firstCornRevenue;
    expect(ratio).toBeCloseTo(1.0, 1);
  });

  it('does NOT apply penalty to perennials', () => {
    const state = makeState();
    state.calendar.month = 3;
    // Plant citrus
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'citrus-navels' }, scenario);
    const cell = state.grid[0][0];
    const citrusDef = getCropDefinition('citrus-navels');
    // Force established + harvestable
    cell.crop!.perennialEstablished = true;
    cell.crop!.perennialAge = 5;
    cell.crop!.gddAccumulated = citrusDef.gddToMaturity;
    cell.crop!.growthStage = 'harvestable';
    cell.crop!.waterStressDays = 0;
    cell.crop!.chillHoursAccumulated = citrusDef.chillHoursRequired ?? 0;
    cell.soil.nitrogen = 200;
    cell.soil.organicMatter = 2.0;
    cell.soil.potassium = 200;
    // lastCropId set at planting for perennials
    expect(cell.lastCropId).toBe('citrus-navels');

    // First harvest
    const rev1 = harvestCell(state, cell, true);
    expect(rev1).toBeGreaterThan(0);

    // Reset for second harvest (perennials persist)
    cell.crop!.gddAccumulated = citrusDef.gddToMaturity;
    cell.crop!.growthStage = 'harvestable';
    cell.crop!.waterStressDays = 0;
    cell.crop!.harvestedThisSeason = false;
    cell.crop!.chillHoursAccumulated = citrusDef.chillHoursRequired ?? 0;
    cell.soil.nitrogen = 200;
    cell.soil.potassium = 200;

    // Second harvest — same crop same cell, but perennial → no penalty
    const rev2 = harvestCell(state, cell, true);
    const ratio = rev2 / rev1;
    expect(ratio).toBeCloseTo(1.0, 1); // No penalty
  });

  it('shows notification on first monoculture harvest (once per game)', () => {
    const state = makeState();
    // First harvest
    plantAndHarvest(state, 0, 0, false);
    expect(state.flags['monoculture_penalty_shown']).toBeFalsy();
    // Second harvest — same crop → penalty + notification
    plantAndHarvest(state, 0, 0, false);
    expect(state.flags['monoculture_penalty_shown']).toBe(true);
    const monoNotif = state.notifications.find(n =>
      n.message.includes('Crop rotation'));
    expect(monoNotif).toBeDefined();
  });
});
