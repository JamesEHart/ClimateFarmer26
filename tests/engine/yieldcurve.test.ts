import { describe, it, expect } from 'vitest';
import { createInitialState, processCommand, simulateTick, harvestCell, getPerennialAgeFactor, getPerennialPhase } from '../../src/engine/game.ts';
import { getCropDefinition, CROPS } from '../../src/data/crops.ts';
import { SLICE_1_SCENARIO } from '../../src/data/scenario.ts';
import { evaluateCondition } from '../../src/engine/events/selector.ts';
import { STORYLETS } from '../../src/data/events.ts';
import type { GameState, CropInstance } from '../../src/engine/types.ts';
import type { Condition } from '../../src/engine/events/types.ts';
import { SeededRNG } from '../../src/engine/rng.ts';

// ============================================================================
// Helpers
// ============================================================================

function makeState(): GameState {
  const state = createInitialState('test-player', SLICE_1_SCENARIO);
  state.speed = 1;
  return state;
}

function advanceTicks(state: GameState, n: number): void {
  for (let i = 0; i < n; i++) {
    state.autoPauseQueue = [];
    state.activeEvent = null;
    state.speed = 1;
    simulateTick(state, SLICE_1_SCENARIO);
  }
}

function advancePastYearEnd(state: GameState): number {
  const startYear = state.calendar.year;
  let ticks = 0;
  while (state.calendar.year === startYear && ticks < 400) {
    state.autoPauseQueue = [];
    state.activeEvent = null;
    state.speed = 1;
    simulateTick(state, SLICE_1_SCENARIO);
    ticks++;
  }
  return ticks;
}

/** Create a mock CropInstance with specified perennial properties */
function mockPerennialCrop(cropId: string, age: number, established: boolean): CropInstance {
  return {
    cropId,
    plantedDay: 0,
    gddAccumulated: 0,
    waterStressDays: 0,
    growthStage: 'harvestable',
    overripeDaysRemaining: -1,
    isPerennial: true,
    perennialAge: age,
    perennialEstablished: established,
    isDormant: false,
    harvestedThisSeason: false,
    chillHoursAccumulated: 1000, // enough chill hours
  };
}

// ============================================================================
// Crop Definition: yieldCurve data
// ============================================================================

describe('Yield curve data on crop definitions', () => {
  it('almonds has yieldCurve with correct values', () => {
    const def = getCropDefinition('almonds');
    expect(def.yieldCurve).toBeDefined();
    expect(def.yieldCurve!.rampUpYears).toBe(3);
    expect(def.yieldCurve!.declineStartYear).toBe(15);
    expect(def.yieldCurve!.endOfLifeYear).toBe(22);
    expect(def.yieldCurve!.declineFloor).toBe(0.2);
  });

  it('pistachios has yieldCurve with correct values', () => {
    const def = getCropDefinition('pistachios');
    expect(def.yieldCurve).toBeDefined();
    expect(def.yieldCurve!.rampUpYears).toBe(3);
    expect(def.yieldCurve!.declineStartYear).toBe(17);
    expect(def.yieldCurve!.endOfLifeYear).toBe(25);
    expect(def.yieldCurve!.declineFloor).toBe(0.2);
  });

  it('citrus has yieldCurve with correct values', () => {
    const def = getCropDefinition('citrus-navels');
    expect(def.yieldCurve).toBeDefined();
    expect(def.yieldCurve!.rampUpYears).toBe(3);
    expect(def.yieldCurve!.declineStartYear).toBe(28);
    expect(def.yieldCurve!.endOfLifeYear).toBe(35);
    expect(def.yieldCurve!.declineFloor).toBe(0.3);
  });

  it('annuals do NOT have yieldCurve', () => {
    expect(getCropDefinition('processing-tomatoes').yieldCurve).toBeUndefined();
    expect(getCropDefinition('silage-corn').yieldCurve).toBeUndefined();
    expect(getCropDefinition('winter-wheat').yieldCurve).toBeUndefined();
    expect(getCropDefinition('sorghum').yieldCurve).toBeUndefined();
  });
});

// ============================================================================
// getPerennialAgeFactor — Almonds (est=3, ramp=3, decline=15, eol=22, floor=0.2)
// ============================================================================

describe('getPerennialAgeFactor — Almonds', () => {
  const cropDef = getCropDefinition('almonds');

  it('returns 1.0 for non-perennial crop', () => {
    const crop = mockPerennialCrop('almonds', 5, true);
    crop.isPerennial = false;
    expect(getPerennialAgeFactor(crop, cropDef)).toBe(1.0);
  });

  it('returns 1.0 for unestablished perennial', () => {
    const crop = mockPerennialCrop('almonds', 2, false);
    expect(getPerennialAgeFactor(crop, cropDef)).toBe(1.0);
  });

  it('returns 1.0 if cropDef has no yieldCurve', () => {
    const annualDef = getCropDefinition('processing-tomatoes');
    const crop = mockPerennialCrop('processing-tomatoes', 5, true);
    expect(getPerennialAgeFactor(crop, annualDef)).toBe(1.0);
  });

  // Ramp phase: almonds est=3, so yp = age - 3
  // age 3 → yp=0 → 0.60
  it('age 3 (yp=0): ramp 60%', () => {
    const crop = mockPerennialCrop('almonds', 3, true);
    expect(getPerennialAgeFactor(crop, cropDef)).toBeCloseTo(0.60);
  });

  // age 4 → yp=1 → 0.80
  it('age 4 (yp=1): ramp 80%', () => {
    const crop = mockPerennialCrop('almonds', 4, true);
    expect(getPerennialAgeFactor(crop, cropDef)).toBeCloseTo(0.80);
  });

  // age 5 → yp=2 → 1.00
  it('age 5 (yp=2): ramp 100%', () => {
    const crop = mockPerennialCrop('almonds', 5, true);
    expect(getPerennialAgeFactor(crop, cropDef)).toBeCloseTo(1.00);
  });

  // Peak phase: ages 6-17 (yp=3-14) all return 1.0
  it('age 6 (yp=3): peak 100%', () => {
    const crop = mockPerennialCrop('almonds', 6, true);
    expect(getPerennialAgeFactor(crop, cropDef)).toBeCloseTo(1.00);
  });

  it('age 10 (yp=7): peak 100%', () => {
    const crop = mockPerennialCrop('almonds', 10, true);
    expect(getPerennialAgeFactor(crop, cropDef)).toBeCloseTo(1.00);
  });

  it('age 17 (yp=14): last peak year, still 100%', () => {
    const crop = mockPerennialCrop('almonds', 17, true);
    expect(getPerennialAgeFactor(crop, cropDef)).toBeCloseTo(1.00);
  });

  // Decline phase: ages 18-24 (yp=15-21), linear 1.0→0.2
  // declineDuration = 22 - 15 = 7
  // yp=15 → yearsInDecline=0 → 1.0 - 0.8*(0/7) = 1.0
  it('age 18 (yp=15): decline start, still ~100%', () => {
    const crop = mockPerennialCrop('almonds', 18, true);
    expect(getPerennialAgeFactor(crop, cropDef)).toBeCloseTo(1.0);
  });

  // yp=16 → yearsInDecline=1 → 1.0 - 0.8*(1/7) ≈ 0.886
  it('age 19 (yp=16): declining', () => {
    const crop = mockPerennialCrop('almonds', 19, true);
    const expected = 1.0 - 0.8 * (1 / 7);
    expect(getPerennialAgeFactor(crop, cropDef)).toBeCloseTo(expected, 2);
  });

  // yp=18 → yearsInDecline=3 → 1.0 - 0.8*(3/7) ≈ 0.657
  it('age 21 (yp=18): mid-decline', () => {
    const crop = mockPerennialCrop('almonds', 21, true);
    const expected = 1.0 - 0.8 * (3 / 7);
    expect(getPerennialAgeFactor(crop, cropDef)).toBeCloseTo(expected, 2);
  });

  // yp=21 → yearsInDecline=6 → 1.0 - 0.8*(6/7) ≈ 0.314
  it('age 24 (yp=21): near floor', () => {
    const crop = mockPerennialCrop('almonds', 24, true);
    const expected = 1.0 - 0.8 * (6 / 7);
    expect(getPerennialAgeFactor(crop, cropDef)).toBeCloseTo(expected, 2);
  });

  // Floor phase: age 25+ (yp=22+) → 0.2
  it('age 25 (yp=22): at floor 20%', () => {
    const crop = mockPerennialCrop('almonds', 25, true);
    expect(getPerennialAgeFactor(crop, cropDef)).toBeCloseTo(0.2);
  });

  it('age 30 (yp=27): past floor, still 20%', () => {
    const crop = mockPerennialCrop('almonds', 30, true);
    expect(getPerennialAgeFactor(crop, cropDef)).toBeCloseTo(0.2);
  });
});

// ============================================================================
// getPerennialAgeFactor — Citrus (est=3, ramp=3, decline=28, eol=35, floor=0.3)
// ============================================================================

describe('getPerennialAgeFactor — Citrus', () => {
  const cropDef = getCropDefinition('citrus-navels');

  it('age 3 (yp=0): ramp 60%', () => {
    const crop = mockPerennialCrop('citrus-navels', 3, true);
    expect(getPerennialAgeFactor(crop, cropDef)).toBeCloseTo(0.60);
  });

  it('age 5 (yp=2): ramp 100%', () => {
    const crop = mockPerennialCrop('citrus-navels', 5, true);
    expect(getPerennialAgeFactor(crop, cropDef)).toBeCloseTo(1.00);
  });

  // Citrus never declines in 30-year game: age 30 (yp=27) < declineStartYear=28
  it('age 30 (yp=27): still peak 100% — never declines in 30-year game', () => {
    const crop = mockPerennialCrop('citrus-navels', 30, true);
    expect(getPerennialAgeFactor(crop, cropDef)).toBeCloseTo(1.00);
  });

  it('age 31 (yp=28): decline starts', () => {
    const crop = mockPerennialCrop('citrus-navels', 31, true);
    expect(getPerennialAgeFactor(crop, cropDef)).toBeCloseTo(1.0);
  });

  it('age 38 (yp=35): at floor 30%', () => {
    const crop = mockPerennialCrop('citrus-navels', 38, true);
    expect(getPerennialAgeFactor(crop, cropDef)).toBeCloseTo(0.3);
  });
});

// ============================================================================
// getPerennialAgeFactor — Pistachios (est=4, ramp=3, decline=17, eol=25, floor=0.2)
// ============================================================================

describe('getPerennialAgeFactor — Pistachios', () => {
  const cropDef = getCropDefinition('pistachios');

  // yp = age - 4
  // age 4 → yp=0 → 0.60
  it('age 4 (yp=0): ramp 60%', () => {
    const crop = mockPerennialCrop('pistachios', 4, true);
    expect(getPerennialAgeFactor(crop, cropDef)).toBeCloseTo(0.60);
  });

  // age 5 → yp=1 → 0.80
  it('age 5 (yp=1): ramp 80%', () => {
    const crop = mockPerennialCrop('pistachios', 5, true);
    expect(getPerennialAgeFactor(crop, cropDef)).toBeCloseTo(0.80);
  });

  // age 6 → yp=2 → 1.00
  it('age 6 (yp=2): ramp 100%', () => {
    const crop = mockPerennialCrop('pistachios', 6, true);
    expect(getPerennialAgeFactor(crop, cropDef)).toBeCloseTo(1.00);
  });

  // Peak: age 7-20 (yp=3-16)
  it('age 20 (yp=16): last peak year', () => {
    const crop = mockPerennialCrop('pistachios', 20, true);
    expect(getPerennialAgeFactor(crop, cropDef)).toBeCloseTo(1.00);
  });

  // Decline starts: age 21 (yp=17)
  // declineDuration = 25 - 17 = 8
  it('age 21 (yp=17): decline start', () => {
    const crop = mockPerennialCrop('pistachios', 21, true);
    expect(getPerennialAgeFactor(crop, cropDef)).toBeCloseTo(1.0);
  });

  // Floor: age 29 (yp=25)
  it('age 29 (yp=25): at floor 20%', () => {
    const crop = mockPerennialCrop('pistachios', 29, true);
    expect(getPerennialAgeFactor(crop, cropDef)).toBeCloseTo(0.2);
  });
});

// ============================================================================
// Edge cases
// ============================================================================

describe('getPerennialAgeFactor edge cases', () => {
  it('rampUpYears=1: instant peak', () => {
    // Mock a crop def with rampUpYears=1
    const mockDef = {
      ...getCropDefinition('almonds'),
      yieldCurve: { rampUpYears: 1, declineStartYear: 15, endOfLifeYear: 22, declineFloor: 0.2 },
    };
    const crop = mockPerennialCrop('almonds', 3, true); // yp=0
    expect(getPerennialAgeFactor(crop, mockDef)).toBe(1.0);
  });

  it('declineStartYear == endOfLifeYear: instant drop to floor (no division by zero)', () => {
    const mockDef = {
      ...getCropDefinition('almonds'),
      yieldCurve: { rampUpYears: 3, declineStartYear: 10, endOfLifeYear: 10, declineFloor: 0.2 },
    };
    const crop = mockPerennialCrop('almonds', 13, true); // yp=10 = declineStart = endOfLife
    expect(getPerennialAgeFactor(crop, mockDef)).toBeCloseTo(0.2);
  });

  it('negative yp (age < yearsToEstablish on established crop): returns 0', () => {
    // This shouldn't normally happen, but defensively...
    const cropDef = getCropDefinition('almonds');
    const crop = mockPerennialCrop('almonds', 1, true); // age 1, est=3, yp=-2
    expect(getPerennialAgeFactor(crop, cropDef)).toBe(0);
  });
});

// ============================================================================
// getPerennialPhase — UI labels
// ============================================================================

describe('getPerennialPhase', () => {
  it('returns "Establishing" for unestablished perennial', () => {
    const crop = mockPerennialCrop('almonds', 1, false);
    const def = getCropDefinition('almonds');
    expect(getPerennialPhase(crop, def)).toBe('Establishing');
  });

  it('returns "Ramping Up" during ramp phase', () => {
    const crop = mockPerennialCrop('almonds', 3, true); // yp=0
    const def = getCropDefinition('almonds');
    expect(getPerennialPhase(crop, def)).toBe('Ramping Up');
  });

  it('returns "Peak Production" during peak', () => {
    const crop = mockPerennialCrop('almonds', 10, true); // yp=7
    const def = getCropDefinition('almonds');
    expect(getPerennialPhase(crop, def)).toBe('Peak Production');
  });

  it('returns "Declining" during decline', () => {
    const crop = mockPerennialCrop('almonds', 20, true); // yp=17
    const def = getCropDefinition('almonds');
    expect(getPerennialPhase(crop, def)).toBe('Declining');
  });

  it('returns "Past Prime" at floor', () => {
    const crop = mockPerennialCrop('almonds', 26, true); // yp=23
    const def = getCropDefinition('almonds');
    expect(getPerennialPhase(crop, def)).toBe('Past Prime');
  });

  it('returns "Peak Production" for citrus at age 30 (no decline in 30-yr game)', () => {
    const crop = mockPerennialCrop('citrus-navels', 30, true);
    const def = getCropDefinition('citrus-navels');
    expect(getPerennialPhase(crop, def)).toBe('Peak Production');
  });

  it('returns "Peak Production" for crop without yieldCurve', () => {
    const crop = mockPerennialCrop('processing-tomatoes', 5, true);
    const def = getCropDefinition('processing-tomatoes');
    expect(getPerennialPhase(crop, def)).toBe('Peak Production');
  });
});

// ============================================================================
// Integration: ageFactor in harvestCell yield calculation
// ============================================================================

describe('Yield curve integration in harvest', () => {
  it('established almond at age 3 (ramp 60%) yields less than at age 10 (peak 100%)', () => {
    // We test by creating two states and comparing harvest revenue
    const state1 = makeState();
    const state2 = makeState();

    // Plant almonds in both
    processCommand(state1, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);
    processCommand(state2, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);

    const crop1 = state1.grid[0][0].crop!;
    const crop2 = state2.grid[0][0].crop!;

    // Set both to established, harvestable, with plenty of chill hours
    for (const crop of [crop1, crop2]) {
      crop.perennialEstablished = true;
      crop.growthStage = 'harvestable';
      crop.chillHoursAccumulated = 1000;
      crop.waterStressDays = 0;
    }
    // High nitrogen isolates age factor from nitrogen dynamics (4c changed N mechanics)
    state1.grid[0][0].soil.nitrogen = 200;
    state2.grid[0][0].soil.nitrogen = 200;

    // Set ages
    crop1.perennialAge = 3;  // ramp 60%
    crop2.perennialAge = 10; // peak 100%

    const rev1 = harvestCell(state1, state1.grid[0][0]);
    const rev2 = harvestCell(state2, state2.grid[0][0]);

    // Revenue at age 3 should be ~60% of revenue at age 10
    expect(rev1).toBeLessThan(rev2);
    expect(rev1 / rev2).toBeCloseTo(0.6, 1);
  });

  it('almond at floor (age 25) yields ~20% of peak', () => {
    const statePeak = makeState();
    const stateFloor = makeState();

    processCommand(statePeak, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);
    processCommand(stateFloor, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);

    for (const st of [statePeak, stateFloor]) {
      const crop = st.grid[0][0].crop!;
      crop.perennialEstablished = true;
      crop.growthStage = 'harvestable';
      crop.chillHoursAccumulated = 1000;
      crop.waterStressDays = 0;
      // High nitrogen isolates age factor from nitrogen dynamics (4c changed N mechanics)
      st.grid[0][0].soil.nitrogen = 200;
    }

    statePeak.grid[0][0].crop!.perennialAge = 10;  // peak
    stateFloor.grid[0][0].crop!.perennialAge = 25;  // floor

    const revPeak = harvestCell(statePeak, statePeak.grid[0][0]);
    const revFloor = harvestCell(stateFloor, stateFloor.grid[0][0]);

    expect(revFloor / revPeak).toBeCloseTo(0.2, 1);
  });

  it('citrus at age 30 yields same as at age 10 (no decline)', () => {
    const state1 = makeState();
    const state2 = makeState();

    processCommand(state1, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'citrus-navels' }, SLICE_1_SCENARIO);
    processCommand(state2, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'citrus-navels' }, SLICE_1_SCENARIO);

    for (const st of [state1, state2]) {
      const crop = st.grid[0][0].crop!;
      crop.perennialEstablished = true;
      crop.growthStage = 'harvestable';
      crop.chillHoursAccumulated = 0; // citrus has no chill requirement
      crop.waterStressDays = 0;
    }

    state1.grid[0][0].crop!.perennialAge = 10; // peak
    state2.grid[0][0].crop!.perennialAge = 30; // still peak for citrus

    const rev1 = harvestCell(state1, state1.grid[0][0]);
    const rev2 = harvestCell(state2, state2.grid[0][0]);

    expect(rev1).toBe(rev2);
  });

  it('annual crops are unaffected by ageFactor (always 1.0)', () => {
    const state = makeState();
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'processing-tomatoes' }, SLICE_1_SCENARIO);
    const crop = state.grid[0][0].crop!;
    crop.growthStage = 'harvestable';

    const cropDef = getCropDefinition('processing-tomatoes');
    expect(getPerennialAgeFactor(crop, cropDef)).toBe(1.0);
  });
});

// ============================================================================
// has_declining_perennial condition
// ============================================================================

describe('has_declining_perennial condition', () => {
  it('evaluates false when no perennials are declining', () => {
    const state = makeState();
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);
    const crop = state.grid[0][0].crop!;
    crop.perennialEstablished = true;
    crop.perennialAge = 10; // peak

    const condition: Condition = { type: 'has_declining_perennial' };
    const rng = new SeededRNG(42);
    expect(evaluateCondition(condition, state, rng)).toBe(false);
  });

  it('evaluates true when an almond is in decline phase', () => {
    const state = makeState();
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);
    const crop = state.grid[0][0].crop!;
    crop.perennialEstablished = true;
    crop.perennialAge = 20; // yp=17, past declineStartYear=15

    const condition: Condition = { type: 'has_declining_perennial' };
    const rng = new SeededRNG(42);
    expect(evaluateCondition(condition, state, rng)).toBe(true);
  });

  it('evaluates false for unestablished perennial even with high age', () => {
    const state = makeState();
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);
    const crop = state.grid[0][0].crop!;
    crop.perennialEstablished = false;
    crop.perennialAge = 20;

    const condition: Condition = { type: 'has_declining_perennial' };
    const rng = new SeededRNG(42);
    expect(evaluateCondition(condition, state, rng)).toBe(false);
  });

  it('evaluates false for citrus at age 30 (still peak, not declining)', () => {
    const state = makeState();
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'citrus-navels' }, SLICE_1_SCENARIO);
    const crop = state.grid[0][0].crop!;
    crop.perennialEstablished = true;
    crop.perennialAge = 30; // yp=27 < declineStartYear=28

    const condition: Condition = { type: 'has_declining_perennial' };
    const rng = new SeededRNG(42);
    expect(evaluateCondition(condition, state, rng)).toBe(false);
  });
});

// ============================================================================
// advisor-orchard-decline storylet
// Fires while any perennial is in decline (not on entry edge).
// Gated by cooldown (730 days) and maxOccurrences (2).
// ============================================================================

describe('advisor-orchard-decline storylet', () => {
  it('exists in STORYLETS with correct properties', () => {
    const decline = STORYLETS.find(s => s.id === 'advisor-orchard-decline');
    expect(decline).toBeDefined();
    expect(decline!.type).toBe('advisor');
    expect(decline!.priority).toBe(90);
    expect(decline!.cooldownDays).toBe(730);
    expect(decline!.maxOccurrences).toBe(2);
  });

  it('has has_declining_perennial precondition', () => {
    const decline = STORYLETS.find(s => s.id === 'advisor-orchard-decline')!;
    expect(decline.preconditions).toContainEqual({ type: 'has_declining_perennial' });
  });

  it('has two choices', () => {
    const decline = STORYLETS.find(s => s.id === 'advisor-orchard-decline')!;
    expect(decline.choices).toHaveLength(2);
  });
});

// ============================================================================
// Determinism regression
// ============================================================================

describe('Slice 3a2 determinism', () => {
  it('same seed + same commands = identical ageFactor after year advances', () => {
    const state1 = makeState();
    const state2 = makeState();

    // Plant almonds on both
    processCommand(state1, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);
    processCommand(state2, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);

    // Advance both through 1 full year
    advancePastYearEnd(state1);
    advancePastYearEnd(state2);

    const crop1 = state1.grid[0][0].crop!;
    const crop2 = state2.grid[0][0].crop!;
    const def = getCropDefinition('almonds');

    expect(crop1.perennialAge).toBe(crop2.perennialAge);
    expect(getPerennialAgeFactor(crop1, def)).toBe(getPerennialAgeFactor(crop2, def));
  });
});
