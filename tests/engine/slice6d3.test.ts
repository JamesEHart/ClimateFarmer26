/**
 * Slice 6d.3 Tests — Evergreen Cover Crops + Planting Auto-Pause
 *
 * §1: Evergreen cover crop eligibility (crop-definition-driven)
 * §2: Cover crop effectiveness scaling (N, OM, moisture, OM protection)
 * §3: Organic certification still counts cover crops under evergreens
 * §4: Auto-pause when planting options change
 */

import { describe, it, expect } from 'vitest';
import {
  createInitialState, processCommand, simulateTick, getAvailableCrops,
} from '../../src/engine/game.ts';
import { SLICE_1_SCENARIO } from '../../src/data/scenario.ts';
import { getCropDefinition } from '../../src/data/crops.ts';
import type { GameState } from '../../src/engine/types.ts';
import {
  GRID_ROWS, GRID_COLS, DAYS_PER_YEAR,
  ORGANIC_COVER_CROP_MIN, COVER_CROP_OM_PROTECTION,
} from '../../src/engine/types.ts';

function makeState(): GameState {
  return createInitialState('test-6d3', SLICE_1_SCENARIO);
}

/** Advance state to a specific season by ticking through days */
function advanceToSeason(state: GameState, targetSeason: string): void {
  let ticks = 0;
  while (state.calendar.season !== targetSeason && ticks < 400) {
    state.autoPauseQueue = [];
    state.activeEvent = null;
    state.speed = 1;
    simulateTick(state, SLICE_1_SCENARIO);
    ticks++;
  }
}

/** Advance past spring incorporation (into spring) */
function advancePastIncorporation(state: GameState): void {
  // Advance through winter into spring — incorporation happens at winter→spring boundary
  advanceToSeason(state, 'winter');
  advanceToSeason(state, 'spring');
}

/** Advance one full year (to year-end) */
function advanceToYearEnd(state: GameState): void {
  const startYear = state.calendar.year;
  let ticks = 0;
  while (state.calendar.year === startYear && ticks < 400) {
    state.autoPauseQueue = state.autoPauseQueue.filter(e => e.reason === 'year_end');
    state.activeEvent = null;
    state.speed = 1;
    simulateTick(state, SLICE_1_SCENARIO);
    ticks++;
  }
}

// ============================================================================
// §1: Evergreen Cover Crop Eligibility
// ============================================================================

describe('§1: Evergreen Cover Crop Eligibility', () => {
  it('citrus has coverCropEffectiveness = 0.60', () => {
    const def = getCropDefinition('citrus-navels');
    expect(def.coverCropEffectiveness).toBe(0.60);
    expect(def.dormantSeasons).toBeUndefined();
  });

  it('agave has coverCropEffectiveness = 0.85', () => {
    const def = getCropDefinition('agave');
    expect(def.coverCropEffectiveness).toBe(0.85);
  });

  it('heat-avocado has coverCropEffectiveness = 0.50', () => {
    const def = getCropDefinition('heat-avocado');
    expect(def.coverCropEffectiveness).toBe(0.50);
  });

  it('almonds (deciduous) has no coverCropEffectiveness — uses dormantSeasons instead', () => {
    const def = getCropDefinition('almonds');
    expect(def.coverCropEffectiveness).toBeUndefined();
    expect(def.dormantSeasons).toEqual(['winter']);
  });

  it('pistachios (deciduous) has no coverCropEffectiveness', () => {
    const def = getCropDefinition('pistachios');
    expect(def.coverCropEffectiveness).toBeUndefined();
    expect(def.dormantSeasons).toEqual(['winter']);
  });

  it('annuals have no coverCropEffectiveness', () => {
    expect(getCropDefinition('silage-corn').coverCropEffectiveness).toBeUndefined();
    expect(getCropDefinition('winter-wheat').coverCropEffectiveness).toBeUndefined();
  });

  it('cover crop can be planted on citrus cell in fall', () => {
    const state = makeState();
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'citrus-navels' }, SLICE_1_SCENARIO);
    advanceToSeason(state, 'fall');
    const result = processCommand(state,
      { type: 'SET_COVER_CROP', cellRow: 0, cellCol: 0, coverCropId: 'legume-cover' }, SLICE_1_SCENARIO);
    expect(result.success).toBe(true);
    expect(state.grid[0][0].coverCropId).toBe('legume-cover');
  });

  it('cover crop can be planted on agave cell in fall', () => {
    const state = makeState();
    state.flags['tech_crop_agave'] = true;
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'agave' }, SLICE_1_SCENARIO);
    advanceToSeason(state, 'fall');
    const result = processCommand(state,
      { type: 'SET_COVER_CROP', cellRow: 0, cellCol: 0, coverCropId: 'legume-cover' }, SLICE_1_SCENARIO);
    expect(result.success).toBe(true);
  });

  it('cover crop can be planted on heat-avocado cell in fall', () => {
    const state = makeState();
    state.flags['tech_crop_avocado'] = true;
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'heat-avocado' }, SLICE_1_SCENARIO);
    advanceToSeason(state, 'fall');
    const result = processCommand(state,
      { type: 'SET_COVER_CROP', cellRow: 0, cellCol: 0, coverCropId: 'legume-cover' }, SLICE_1_SCENARIO);
    expect(result.success).toBe(true);
  });

  it('cover crop still blocked on annual crop cells in fall', () => {
    const state = makeState();
    // Plant winter wheat (fall planting window) so it persists into fall
    advanceToSeason(state, 'fall');
    // Advance to October so wheat is plantable
    while (state.calendar.month < 10) {
      state.autoPauseQueue = [];
      state.activeEvent = null;
      state.speed = 1;
      simulateTick(state, SLICE_1_SCENARIO);
    }
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'winter-wheat' }, SLICE_1_SCENARIO);
    expect(state.grid[0][0].crop?.cropId).toBe('winter-wheat');

    const result = processCommand(state,
      { type: 'SET_COVER_CROP', cellRow: 0, cellCol: 0, coverCropId: 'legume-cover' }, SLICE_1_SCENARIO);
    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/annual/i);
  });

  it('deciduous perennials still eligible for cover crops (regression)', () => {
    const state = makeState();
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);
    advanceToSeason(state, 'fall');
    const result = processCommand(state,
      { type: 'SET_COVER_CROP', cellRow: 0, cellCol: 0, coverCropId: 'legume-cover' }, SLICE_1_SCENARIO);
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// §2: Cover Crop Effectiveness Scaling
// ============================================================================

describe('§2: Cover Crop Effectiveness Scaling', () => {
  // Test N bonus scaling by comparing empty cell vs citrus cell after incorporation
  it('citrus gets less N bonus than empty cell at incorporation', () => {
    const state = makeState();
    processCommand(state, { type: 'PLANT_CROP', cellRow: 1, cellCol: 0, cropId: 'citrus-navels' }, SLICE_1_SCENARIO);

    advanceToSeason(state, 'fall');

    // Record N before cover crop
    const nEmptyBefore = state.grid[0][0].soil.nitrogen;
    const nCitrusBefore = state.grid[1][0].soil.nitrogen;

    processCommand(state, { type: 'SET_COVER_CROP', cellRow: 0, cellCol: 0, coverCropId: 'legume-cover' }, SLICE_1_SCENARIO);
    processCommand(state, { type: 'SET_COVER_CROP', cellRow: 1, cellCol: 0, coverCropId: 'legume-cover' }, SLICE_1_SCENARIO);

    // Advance through winter into spring → incorporation
    advancePastIncorporation(state);

    // Both should have been incorporated
    expect(state.grid[0][0].coverCropId).toBeNull();
    expect(state.grid[1][0].coverCropId).toBeNull();

    const nEmptyGain = state.grid[0][0].soil.nitrogen - nEmptyBefore;
    const nCitrusGain = state.grid[1][0].soil.nitrogen - nCitrusBefore;

    // Empty cell: full 50 lbs N (minus some consumption during winter)
    // Citrus cell: 50 * 0.60 = 30 lbs N (minus citrus N consumption during winter)
    // Citrus consumes N too, so its net gain will be much less than empty cell's
    // The key assertion: citrus gains less than empty
    expect(nCitrusGain).toBeLessThan(nEmptyGain);
  });

  it('citrus gets less OM bonus than empty cell at incorporation', () => {
    const state = makeState();
    processCommand(state, { type: 'PLANT_CROP', cellRow: 1, cellCol: 0, cropId: 'citrus-navels' }, SLICE_1_SCENARIO);

    advanceToSeason(state, 'fall');

    // Set both to same OM
    state.grid[0][0].soil.organicMatter = 2.0;
    state.grid[1][0].soil.organicMatter = 2.0;

    processCommand(state, { type: 'SET_COVER_CROP', cellRow: 0, cellCol: 0, coverCropId: 'legume-cover' }, SLICE_1_SCENARIO);
    processCommand(state, { type: 'SET_COVER_CROP', cellRow: 1, cellCol: 0, coverCropId: 'legume-cover' }, SLICE_1_SCENARIO);

    advancePastIncorporation(state);

    // Empty cell gets full OM bonus (0.10%), citrus gets 0.06% (scaled by 0.60)
    // Both experience decomposition during winter, but the bonus delta should be visible
    expect(state.grid[0][0].soil.organicMatter).toBeGreaterThan(state.grid[1][0].soil.organicMatter);
  });

  it('OM protection is scaled: bare < evergreen cover < deciduous/empty cover', () => {
    const state = makeState();
    // Three cells at same OM:
    // [0][0] = empty + cover crop (full protection)
    // [1][0] = citrus + cover crop (60% effectiveness)
    // [2][0] = bare (no cover crop)
    const baseOM = 2.5;
    state.grid[0][0].soil.organicMatter = baseOM;
    state.grid[1][0].soil.organicMatter = baseOM;
    state.grid[2][0].soil.organicMatter = baseOM;

    processCommand(state, { type: 'PLANT_CROP', cellRow: 1, cellCol: 0, cropId: 'citrus-navels' }, SLICE_1_SCENARIO);

    advanceToSeason(state, 'fall');
    processCommand(state, { type: 'SET_COVER_CROP', cellRow: 0, cellCol: 0, coverCropId: 'legume-cover' }, SLICE_1_SCENARIO);
    processCommand(state, { type: 'SET_COVER_CROP', cellRow: 1, cellCol: 0, coverCropId: 'legume-cover' }, SLICE_1_SCENARIO);
    // [2][0] stays bare

    // Tick through 60 days of winter decomposition
    for (let i = 0; i < 60; i++) {
      state.autoPauseQueue = [];
      state.activeEvent = null;
      state.speed = 1;
      simulateTick(state, SLICE_1_SCENARIO);
    }

    // Full cover crop = most OM retained
    // Citrus cover crop = intermediate OM retained
    // Bare soil = least OM retained
    expect(state.grid[0][0].soil.organicMatter).toBeGreaterThan(state.grid[1][0].soil.organicMatter);
    expect(state.grid[1][0].soil.organicMatter).toBeGreaterThan(state.grid[2][0].soil.organicMatter);
  });

  it('all three evergreen crops have explicit effectiveness values between 0 and 1', () => {
    for (const cropId of ['citrus-navels', 'agave', 'heat-avocado']) {
      const def = getCropDefinition(cropId);
      expect(def.coverCropEffectiveness).toBeGreaterThan(0);
      expect(def.coverCropEffectiveness).toBeLessThan(1);
    }
  });

  it('avocado gets less benefit than agave (denser canopy)', () => {
    const avocado = getCropDefinition('heat-avocado');
    const agave = getCropDefinition('agave');
    expect(avocado.coverCropEffectiveness!).toBeLessThan(agave.coverCropEffectiveness!);
  });
});

// ============================================================================
// §3: Organic Certification + Evergreen Cover Crops
// ============================================================================

describe('§3: Organic Certification + Evergreen Cover Crops', () => {
  it('cover crops under evergreen perennials count for organic compliance', () => {
    const state = makeState();
    state.flags['organic_enrolled'] = true;
    state.organicCompliantYears = 2;

    // Plant citrus on 8 cells
    for (let c = 0; c < 8; c++) {
      state.grid[0][c].crop = {
        cropId: 'citrus-navels', plantedDay: 100, gddAccumulated: 0,
        isPerennial: true, establishmentYearsRemaining: 0, ageYears: 3,
      } as any;
    }

    // Cover crops on all citrus cells + 8 empty cells = 16 total
    for (let c = 0; c < 8; c++) {
      state.grid[0][c].coverCropId = 'legume-cover';
      state.grid[1][c].coverCropId = 'legume-cover';
    }

    const coverCropCells = state.grid.flat().filter(c => c.coverCropId).length;
    expect(coverCropCells).toBe(16);
    expect(coverCropCells).toBeGreaterThanOrEqual(ORGANIC_COVER_CROP_MIN);

    // Year-end should grant certification (3 compliant years reached)
    advanceToYearEnd(state);
    expect(state.flags['organic_certified']).toBe(true);
  });

  it('mixed evergreen + empty cover crops together meet organic threshold', () => {
    const state = makeState();
    state.flags['organic_enrolled'] = true;
    state.organicCompliantYears = 2;

    // Plant agave on 4 cells, avocado on 4 cells (evergreen)
    state.flags['tech_crop_agave'] = true;
    state.flags['tech_crop_avocado'] = true;
    for (let c = 0; c < 4; c++) {
      state.grid[0][c].crop = {
        cropId: 'agave', plantedDay: 100, gddAccumulated: 0,
        isPerennial: true, establishmentYearsRemaining: 0, ageYears: 5,
      } as any;
      state.grid[0][c].coverCropId = 'legume-cover';
      state.grid[1][c].crop = {
        cropId: 'heat-avocado', plantedDay: 100, gddAccumulated: 0,
        isPerennial: true, establishmentYearsRemaining: 0, ageYears: 4,
      } as any;
      state.grid[1][c].coverCropId = 'legume-cover';
    }
    // 8 more empty cells with cover crops
    for (let c = 0; c < 8; c++) {
      state.grid[2][c].coverCropId = 'legume-cover';
    }

    const coverCount = state.grid.flat().filter(c => c.coverCropId).length;
    expect(coverCount).toBe(16);

    advanceToYearEnd(state);
    expect(state.flags['organic_certified']).toBe(true);
  });
});

// ============================================================================
// §4: Planting Options Change Detection
// ============================================================================

/**
 * Build the same plantable key the adapter uses for change detection.
 * Mirrors getPlantableKey() in signals.ts.
 */
function buildPlantableKey(state: GameState): string {
  const crops = getAvailableCrops(state);
  const isFall = state.calendar.season === 'fall';
  return crops.join(',') + (isFall ? ',cover' : '');
}

/** Advance to specific month within a season, clearing blockers along the way. */
function advanceToMonth(state: GameState, targetMonth: number): void {
  let ticks = 0;
  while (state.calendar.month !== targetMonth && ticks < 400) {
    state.autoPauseQueue = [];
    state.activeEvent = null;
    state.speed = 1;
    simulateTick(state, SLICE_1_SCENARIO);
    ticks++;
  }
}

describe('§4: Planting Options Change Detection', () => {
  it('getAvailableCrops returns different crops across seasons', () => {
    const state = makeState();
    expect(state.calendar.season).toBe('spring');
    const springCrops = getAvailableCrops(state);
    expect(springCrops).toContain('silage-corn');

    // Advance to fall month 10 (October) for winter wheat
    advanceToSeason(state, 'fall');
    advanceToMonth(state, 10);
    const fallCrops = getAvailableCrops(state);
    expect(fallCrops).toContain('winter-wheat');
    expect(fallCrops).not.toContain('silage-corn');
  });

  it('crop availability set changes between spring and summer', () => {
    const state = makeState();
    const springSet = new Set(getAvailableCrops(state));
    advanceToSeason(state, 'summer');
    const summerSet = new Set(getAvailableCrops(state));
    const changed = [...springSet].some(c => !summerSet.has(c)) ||
                    [...summerSet].some(c => !springSet.has(c));
    expect(changed).toBe(true);
  });

  it('plantable key changes at fall month boundary (Sep→Oct adds winter wheat)', () => {
    const state = makeState();
    advanceToSeason(state, 'fall');
    // Should be in September (month 9) at start of fall
    expect(state.calendar.month).toBe(9);
    const sepKey = buildPlantableKey(state);

    // Advance to October (month 10)
    advanceToMonth(state, 10);
    const octKey = buildPlantableKey(state);

    // Keys should differ — October adds winter wheat
    expect(sepKey).not.toBe(octKey);
    // Verify winter wheat is the actual difference
    expect(getAvailableCrops(state)).toContain('winter-wheat');
  });

  it('plantable key is stable within the same month', () => {
    const state = makeState();
    const key1 = buildPlantableKey(state);
    // Tick a few days within March
    for (let i = 0; i < 5; i++) {
      state.autoPauseQueue = [];
      state.activeEvent = null;
      state.speed = 1;
      simulateTick(state, SLICE_1_SCENARIO);
    }
    expect(state.calendar.month).toBe(3); // still March
    const key2 = buildPlantableKey(state);
    expect(key1).toBe(key2);
  });

  it('simulated month-boundary detection fires on plantable key change', () => {
    // Simulate what the adapter game loop does: compare prev vs current key at month boundaries
    const state = makeState();
    let prevKey = buildPlantableKey(state);
    let prevMonth = state.calendar.month;
    const firedReasons: string[] = [];

    // Run through the first year, checking at each month boundary
    let ticks = 0;
    while (state.calendar.year === 1 && ticks < 400) {
      state.autoPauseQueue = [];
      state.activeEvent = null;
      state.speed = 1;
      simulateTick(state, SLICE_1_SCENARIO);
      ticks++;

      if (state.calendar.month !== prevMonth) {
        const currentKey = buildPlantableKey(state);
        if (currentKey !== prevKey) {
          firedReasons.push(`month ${prevMonth}→${state.calendar.month}`);
        }
        prevKey = currentKey;
        prevMonth = state.calendar.month;
      }
    }

    // Should detect at least one mid-season change (e.g., fall Sep→Oct for winter wheat)
    expect(firedReasons.length).toBeGreaterThan(0);
    expect(firedReasons.some(r => r.includes('9→10'))).toBe(true);
  });

  it('detection only fires when plantable key actually changes', () => {
    // Over a full year, detection should fire fewer times than total month boundaries
    // (some adjacent months have identical available crops)
    const state = makeState();
    let prevKey = buildPlantableKey(state);
    let prevMonth = state.calendar.month;
    let monthBoundaries = 0;
    let keyChanges = 0;

    let ticks = 0;
    while (state.calendar.year === 1 && ticks < 400) {
      state.autoPauseQueue = [];
      state.activeEvent = null;
      state.speed = 1;
      simulateTick(state, SLICE_1_SCENARIO);
      ticks++;

      if (state.calendar.month !== prevMonth) {
        monthBoundaries++;
        const currentKey = buildPlantableKey(state);
        if (currentKey !== prevKey) {
          keyChanges++;
        }
        prevKey = currentKey;
        prevMonth = state.calendar.month;
      }
    }

    // We cross multiple month boundaries, but key changes fewer times
    expect(monthBoundaries).toBeGreaterThan(0);
    expect(keyChanges).toBeLessThan(monthBoundaries);
    // At least one key change should occur (spring→summer or summer→fall transitions)
    expect(keyChanges).toBeGreaterThan(0);
  });
});
