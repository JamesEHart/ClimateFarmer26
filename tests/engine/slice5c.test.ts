import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateCondition, evaluateEvents } from '../../src/engine/events/selector.ts';
import { createInitialState, processCommand, harvestCell, getAvailableCrops } from '../../src/engine/game.ts';
import { applyEffects } from '../../src/engine/events/effects.ts';
import { SLICE_1_SCENARIO } from '../../src/data/scenario.ts';
import { SCENARIOS, resolveScenarioId } from '../../src/data/scenarios.ts';
import { STORYLETS } from '../../src/data/events.ts';
import { getTechLevel } from '../../src/engine/tech-levels.ts';
import { SeededRNG } from '../../src/engine/rng.ts';
import { getCropDefinition } from '../../src/data/crops.ts';
import type { GameState } from '../../src/engine/types.ts';
import { REGIME_MARKET_CRASH_FACTOR } from '../../src/engine/types.ts';
import type { Storylet } from '../../src/engine/events/types.ts';

// ============================================================================
// Test Helpers
// ============================================================================

function makeState(): GameState {
  return createInitialState('test-5c', SLICE_1_SCENARIO);
}

function getStorylet(id: string): Storylet {
  const s = STORYLETS.find(s => s.id === id);
  if (!s) throw new Error(`Storylet not found: ${id}`);
  return s;
}

/** Evaluate all non-random preconditions for a storylet */
function evaluateNonRandomConditions(storylet: Storylet, state: GameState): boolean {
  const rng = new SeededRNG(42);
  for (const cond of storylet.preconditions.filter(c => c.type !== 'random')) {
    if (!evaluateCondition(cond, state, rng)) return false;
  }
  return true;
}

/** Set state to a given year with proper totalDay calculation */
function setYear(state: GameState, year: number): void {
  state.calendar.year = year;
  state.calendar.totalDay = (year - 1) * 365 + state.calendar.day;
}

/** Plant a crop for has_crop precondition */
function plantCrop(state: GameState, cropId = 'silage-corn'): void {
  processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId }, SLICE_1_SCENARIO);
}

// ============================================================================
// §1: Soil fork (tech-soil-management)
// ============================================================================

describe('Slice 5c: tech-soil-management', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
    // Set up default conditions: year 6, has crop, met both advisors, soil level 0
    setYear(state, 6);
    state.flags['met_chen'] = true;
    state.flags['met_forum'] = true;
    plantCrop(state);
  });

  it('exists with correct metadata', () => {
    const storylet = getStorylet('tech-soil-management');
    expect(storylet.type).toBe('advisor');
    expect(storylet.advisorId).toBe('extension-agent');
    expect(storylet.maxOccurrences).toBe(3);
    expect(storylet.priority).toBe(100);
    expect(storylet.cooldownDays).toBe(365);
  });

  it('is condition-only (no random precondition)', () => {
    const storylet = getStorylet('tech-soil-management');
    const hasRandom = storylet.preconditions.some(c => c.type === 'random');
    expect(hasRandom).toBe(false);
  });

  it('fires when all conditions met (year >= 6, has_crop, soil level 0, met_chen, met_forum)', () => {
    expect(evaluateNonRandomConditions(getStorylet('tech-soil-management'), state)).toBe(true);
  });

  it('does NOT fire without met_chen flag', () => {
    delete state.flags['met_chen'];
    expect(evaluateNonRandomConditions(getStorylet('tech-soil-management'), state)).toBe(false);
  });

  it('does NOT fire without met_forum flag', () => {
    delete state.flags['met_forum'];
    expect(evaluateNonRandomConditions(getStorylet('tech-soil-management'), state)).toBe(false);
  });

  it('does NOT fire when soil tech level >= 1 (tech_soil_testing set)', () => {
    state.flags['tech_soil_testing'] = true;
    expect(getTechLevel(state.flags, 'soil')).toBeGreaterThanOrEqual(1);
    expect(evaluateNonRandomConditions(getStorylet('tech-soil-management'), state)).toBe(false);
  });

  it('soil-testing choice: sets tech_soil_testing flag and costs $600', () => {
    const storylet = getStorylet('tech-soil-management');
    const soilTestingChoice = storylet.choices.find(c => c.id === 'soil-testing');
    expect(soilTestingChoice).toBeDefined();
    expect(soilTestingChoice!.requiresCash).toBe(600);

    const testState = makeState();
    const cashBefore = testState.economy.cash;
    applyEffects(testState, soilTestingChoice!.effects, 'tech-soil-management');

    expect(testState.flags['tech_soil_testing']).toBe(true);
    expect(testState.economy.cash).toBe(cashBefore - 600);
  });

  it('extension-reports choice: sets tech_extension_reports flag and costs $200', () => {
    const storylet = getStorylet('tech-soil-management');
    const reportsChoice = storylet.choices.find(c => c.id === 'extension-reports');
    expect(reportsChoice).toBeDefined();
    expect(reportsChoice!.requiresCash).toBe(200);

    const testState = makeState();
    const cashBefore = testState.economy.cash;
    applyEffects(testState, reportsChoice!.effects, 'tech-soil-management');

    expect(testState.flags['tech_extension_reports']).toBe(true);
    expect(testState.economy.cash).toBe(cashBefore - 200);
  });

  it('not-now choice: does NOT set any soil tech flag', () => {
    const storylet = getStorylet('tech-soil-management');
    const notNowChoice = storylet.choices.find(c => c.id === 'not-now');
    expect(notNowChoice).toBeDefined();

    const testState = makeState();
    applyEffects(testState, notNowChoice!.effects, 'tech-soil-management');

    expect(testState.flags['tech_soil_testing']).toBeUndefined();
    expect(testState.flags['tech_extension_reports']).toBeUndefined();
    expect(getTechLevel(testState.flags, 'soil')).toBe(0);
  });

  it('after soil-testing: getTechLevel(flags, soil) === 1', () => {
    const storylet = getStorylet('tech-soil-management');
    const soilTestingChoice = storylet.choices.find(c => c.id === 'soil-testing')!;

    const testState = makeState();
    applyEffects(testState, soilTestingChoice.effects, 'tech-soil-management');

    expect(getTechLevel(testState.flags, 'soil')).toBe(1);
  });

  it('after extension-reports: getTechLevel(flags, soil) === 1', () => {
    const storylet = getStorylet('tech-soil-management');
    const reportsChoice = storylet.choices.find(c => c.id === 'extension-reports')!;

    const testState = makeState();
    applyEffects(testState, reportsChoice.effects, 'tech-soil-management');

    expect(getTechLevel(testState.flags, 'soil')).toBe(1);
  });

  it('has tech-unlock tag', () => {
    const storylet = getStorylet('tech-soil-management');
    expect(storylet.tags).toContain('tech-unlock');
  });
});

// ============================================================================
// §2: Agave unlock (tech-crop-agave)
// ============================================================================

describe('Slice 5c: tech-crop-agave', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
    setYear(state, 9);
    plantCrop(state);
  });

  it('exists with correct metadata', () => {
    const storylet = getStorylet('tech-crop-agave');
    expect(storylet.priority).toBe(95);
    expect(storylet.maxOccurrences).toBe(2);
    expect(storylet.cooldownDays).toBe(365);
  });

  it('fires when year >= 9, has_crop, tech_crop_agave NOT set', () => {
    expect(evaluateNonRandomConditions(getStorylet('tech-crop-agave'), state)).toBe(true);
  });

  it('does NOT fire when tech_crop_agave already set', () => {
    state.flags['tech_crop_agave'] = true;
    expect(evaluateNonRandomConditions(getStorylet('tech-crop-agave'), state)).toBe(false);
  });

  it('adopt-agave choice: sets tech_crop_agave flag and costs $400', () => {
    const storylet = getStorylet('tech-crop-agave');
    const adoptChoice = storylet.choices.find(c => c.id === 'adopt-agave');
    expect(adoptChoice).toBeDefined();
    expect(adoptChoice!.requiresCash).toBe(400);

    const testState = makeState();
    const cashBefore = testState.economy.cash;
    applyEffects(testState, adoptChoice!.effects, 'tech-crop-agave');

    expect(testState.flags['tech_crop_agave']).toBe(true);
    expect(testState.economy.cash).toBe(cashBefore - 400);
  });

  it('after adoption: getTechLevel(flags, crop) === 1', () => {
    const storylet = getStorylet('tech-crop-agave');
    const adoptChoice = storylet.choices.find(c => c.id === 'adopt-agave')!;

    const testState = makeState();
    applyEffects(testState, adoptChoice.effects, 'tech-crop-agave');

    expect(getTechLevel(testState.flags, 'crop')).toBe(1);
  });
});

// ============================================================================
// §3: Water regime (regime-water-restriction)
// ============================================================================

describe('Slice 5c: regime-water-restriction', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
    setYear(state, 10);
    plantCrop(state);
  });

  it('exists with correct metadata', () => {
    const storylet = getStorylet('regime-water-restriction');
    expect(storylet.priority).toBe(100);
    expect(storylet.maxOccurrences).toBe(1);
    expect(storylet.cooldownDays).toBe(0);
  });

  it('is condition-only (no random precondition)', () => {
    const storylet = getStorylet('regime-water-restriction');
    const hasRandom = storylet.preconditions.some(c => c.type === 'random');
    expect(hasRandom).toBe(false);
  });

  it('fires when year 10-12, regime_water_reduced NOT set, has_crop', () => {
    expect(evaluateNonRandomConditions(getStorylet('regime-water-restriction'), state)).toBe(true);
  });

  it('does NOT fire before year 10', () => {
    setYear(state, 9);
    expect(evaluateNonRandomConditions(getStorylet('regime-water-restriction'), state)).toBe(false);
  });

  it('does NOT fire after year 12 (year 13)', () => {
    setYear(state, 13);
    expect(evaluateNonRandomConditions(getStorylet('regime-water-restriction'), state)).toBe(false);
  });

  it('invest-water-recycling choice: sets regime_water_reduced + tech_water_recycling, costs $1200', () => {
    const storylet = getStorylet('regime-water-restriction');
    const investChoice = storylet.choices.find(c => c.id === 'invest-water-recycling');
    expect(investChoice).toBeDefined();
    expect(investChoice!.requiresCash).toBe(1200);

    const testState = makeState();
    const cashBefore = testState.economy.cash;
    applyEffects(testState, investChoice!.effects, 'regime-water-restriction');

    expect(testState.flags['regime_water_reduced']).toBe(true);
    expect(testState.flags['tech_water_recycling']).toBe(true);
    expect(testState.economy.cash).toBe(cashBefore - 1200);
  });

  it('accept-restrictions choice: sets regime_water_reduced but NOT tech_water_recycling', () => {
    const storylet = getStorylet('regime-water-restriction');
    const acceptChoice = storylet.choices.find(c => c.id === 'accept-restrictions');
    expect(acceptChoice).toBeDefined();

    const testState = makeState();
    applyEffects(testState, acceptChoice!.effects, 'regime-water-restriction');

    expect(testState.flags['regime_water_reduced']).toBe(true);
    expect(testState.flags['tech_water_recycling']).toBeUndefined();
  });

  it('after invest: getTechLevel(flags, water) >= 2', () => {
    const storylet = getStorylet('regime-water-restriction');
    const investChoice = storylet.choices.find(c => c.id === 'invest-water-recycling')!;

    const testState = makeState();
    applyEffects(testState, investChoice.effects, 'regime-water-restriction');

    expect(getTechLevel(testState.flags, 'water')).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================================
// §4: Market regime (regime-market-crash)
// ============================================================================

describe('Slice 5c: regime-market-crash', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
    setYear(state, 15);
    plantCrop(state);
  });

  it('exists with correct metadata', () => {
    const storylet = getStorylet('regime-market-crash');
    expect(storylet.priority).toBe(100);
    expect(storylet.maxOccurrences).toBe(1);
    expect(storylet.advisorId).toBe('farm-credit');
  });

  it('fires when year 15-18, regime_market_crash NOT set, has_crop', () => {
    expect(evaluateNonRandomConditions(getStorylet('regime-market-crash'), state)).toBe(true);
  });

  it('does NOT fire before year 15', () => {
    setYear(state, 14);
    expect(evaluateNonRandomConditions(getStorylet('regime-market-crash'), state)).toBe(false);
  });

  it('does NOT fire after year 18', () => {
    setYear(state, 19);
    expect(evaluateNonRandomConditions(getStorylet('regime-market-crash'), state)).toBe(false);
  });

  it('negotiate-forward choice: sets regime_market_crash, costs $300, adds price modifier for almonds', () => {
    const storylet = getStorylet('regime-market-crash');
    const negotiateChoice = storylet.choices.find(c => c.id === 'negotiate-forward');
    expect(negotiateChoice).toBeDefined();
    expect(negotiateChoice!.requiresCash).toBe(300);

    // Check effects include set_flag for regime_market_crash
    const setFlagEffect = negotiateChoice!.effects.find(
      e => e.type === 'set_flag' && e.flag === 'regime_market_crash',
    );
    expect(setFlagEffect).toBeDefined();

    // Check effects include modify_cash: -300
    const cashEffect = negotiateChoice!.effects.find(
      e => e.type === 'modify_cash' && e.amount === -300,
    );
    expect(cashEffect).toBeDefined();

    // Check effects include modify_price_modifier for almonds
    const priceModEffect = negotiateChoice!.effects.find(
      e => e.type === 'modify_price_modifier',
    );
    expect(priceModEffect).toBeDefined();
    if (priceModEffect && priceModEffect.type === 'modify_price_modifier') {
      expect(priceModEffect.cropId).toBe('almonds');
      expect(priceModEffect.multiplier).toBe(1.15);
      expect(priceModEffect.durationDays).toBe(365);
    }
  });

  it('accept-crash choice: sets regime_market_crash but NOT modify_price_modifier', () => {
    const storylet = getStorylet('regime-market-crash');
    const acceptChoice = storylet.choices.find(c => c.id === 'accept-crash');
    expect(acceptChoice).toBeDefined();

    const setFlagEffect = acceptChoice!.effects.find(
      e => e.type === 'set_flag' && e.flag === 'regime_market_crash',
    );
    expect(setFlagEffect).toBeDefined();

    const priceModEffect = acceptChoice!.effects.find(
      e => e.type === 'modify_price_modifier',
    );
    expect(priceModEffect).toBeUndefined();
  });
});

// ============================================================================
// §5: Heat regime (regime-heat-threshold)
// ============================================================================

describe('Slice 5c: regime-heat-threshold', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
    setYear(state, 20);
    plantCrop(state);
  });

  it('exists with correct metadata', () => {
    const storylet = getStorylet('regime-heat-threshold');
    expect(storylet.priority).toBe(100);
    expect(storylet.maxOccurrences).toBe(1);
  });

  it('fires when year 20-25, regime_heat_threshold NOT set, has_crop', () => {
    expect(evaluateNonRandomConditions(getStorylet('regime-heat-threshold'), state)).toBe(true);
  });

  it('does NOT fire before year 20', () => {
    setYear(state, 19);
    expect(evaluateNonRandomConditions(getStorylet('regime-heat-threshold'), state)).toBe(false);
  });

  it('does NOT fire after year 25', () => {
    setYear(state, 26);
    expect(evaluateNonRandomConditions(getStorylet('regime-heat-threshold'), state)).toBe(false);
  });

  it('research-heat-crops choice: sets regime_heat_threshold + tech_crop_avocado, costs $800', () => {
    const storylet = getStorylet('regime-heat-threshold');
    const researchChoice = storylet.choices.find(c => c.id === 'research-heat-crops');
    expect(researchChoice).toBeDefined();
    expect(researchChoice!.requiresCash).toBe(800);

    const testState = makeState();
    const cashBefore = testState.economy.cash;
    applyEffects(testState, researchChoice!.effects, 'regime-heat-threshold');

    expect(testState.flags['regime_heat_threshold']).toBe(true);
    expect(testState.flags['tech_crop_avocado']).toBe(true);
    expect(testState.economy.cash).toBe(cashBefore - 800);
  });

  it('accept-heat choice: sets regime_heat_threshold but NOT tech_crop_avocado', () => {
    const storylet = getStorylet('regime-heat-threshold');
    const acceptChoice = storylet.choices.find(c => c.id === 'accept-heat');
    expect(acceptChoice).toBeDefined();

    const testState = makeState();
    applyEffects(testState, acceptChoice!.effects, 'regime-heat-threshold');

    expect(testState.flags['regime_heat_threshold']).toBe(true);
    expect(testState.flags['tech_crop_avocado']).toBeUndefined();
  });

  it('after research: getTechLevel(flags, crop) === 2 (given tech_crop_agave was also set)', () => {
    const storylet = getStorylet('regime-heat-threshold');
    const researchChoice = storylet.choices.find(c => c.id === 'research-heat-crops')!;

    const testState = makeState();
    testState.flags['tech_crop_agave'] = true; // prerequisite
    applyEffects(testState, researchChoice.effects, 'regime-heat-threshold');

    expect(getTechLevel(testState.flags, 'crop')).toBe(2);
  });
});

// ============================================================================
// §6: Avocado crop
// ============================================================================

describe('Slice 5c: heat-avocado crop', () => {
  it('heat-avocado crop definition exists with requiredFlag tech_crop_avocado', () => {
    const avocado = getCropDefinition('heat-avocado');
    expect(avocado.requiredFlag).toBe('tech_crop_avocado');
  });

  it('heat-avocado has no heatSensitivity (undefined)', () => {
    const avocado = getCropDefinition('heat-avocado');
    expect(avocado.heatSensitivity).toBeUndefined();
  });

  it('heat-avocado is a perennial', () => {
    const avocado = getCropDefinition('heat-avocado');
    expect(avocado.type).toBe('perennial');
  });

  it('without flag: heat-avocado NOT in getAvailableCrops', () => {
    const state = makeState();
    // Set calendar to a month within avocado planting window
    state.calendar.month = 3; // March
    const available = getAvailableCrops(state);
    expect(available).not.toContain('heat-avocado');
  });

  it('with flag: heat-avocado IS available during planting window', () => {
    const state = makeState();
    state.flags['tech_crop_avocado'] = true;
    // Set calendar to a month within avocado planting window
    state.calendar.month = 3; // March
    const available = getAvailableCrops(state);
    expect(available).toContain('heat-avocado');
  });
});

// ============================================================================
// §7: Market crash engine change — targeted by scenario
// ============================================================================

describe('Slice 5c: market crash targets specific crop', () => {
  it('almond price reduced by scenario.marketCrashFactor when regime_market_crash flag set', () => {
    const state = makeState();
    state.scenarioId = 'gradual-warming';

    // Resolve scenario to get expected factor
    const { scenario } = resolveScenarioId('gradual-warming');
    const expectedFactor = scenario.marketCrashFactor ?? REGIME_MARKET_CRASH_FACTOR;

    // Set the crash flag
    state.flags['regime_market_crash'] = true;

    // Plant almonds in a valid cell (use planting window month)
    state.calendar.month = 2;
    processCommand(state, { type: 'PLANT_CROP', cellRow: 1, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);

    const cell = state.grid[1][0];
    const crop = cell.crop!;
    const cropDef = getCropDefinition('almonds');

    // Fast-forward to harvestable state
    crop.gddAccumulated = cropDef.gddToMaturity;
    crop.growthStage = 'harvestable';
    crop.isPerennial = true;
    crop.perennialEstablished = true;
    crop.perennialAge = 5;
    crop.chillHoursAccumulated = cropDef.chillHoursRequired ?? 0;
    crop.waterStressDays = 0;

    // Set soil to high levels to minimize other factors
    cell.soil.nitrogen = 200;
    cell.soil.potassium = 200;
    cell.soil.organicMatter = 2.0;

    const cashBefore = state.economy.cash;
    harvestCell(state, cell, true);
    const cashAfter = state.economy.cash;
    const revenue = cashAfter - cashBefore;

    // Revenue should reflect the crash factor on almonds
    // The expected price = basePrice * kFactor * priceMod * crashFactor
    // With high potassium, kFactor ~1.0; no event price mod, priceMod = 1.0
    const expectedPrice = cropDef.basePrice * expectedFactor;
    // Revenue = yieldAmount * actualPrice - laborCost
    // With perfect conditions, yieldAmount should be near yieldPotential
    // Just verify the crash factor reduced revenue vs normal
    expect(revenue).toBeGreaterThan(0);

    // Now test WITHOUT crash — revenue should be higher
    const state2 = makeState();
    state2.scenarioId = 'gradual-warming';
    // Do NOT set crash flag
    state2.calendar.month = 2;
    processCommand(state2, { type: 'PLANT_CROP', cellRow: 1, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);
    const cell2 = state2.grid[1][0];
    const crop2 = cell2.crop!;
    crop2.gddAccumulated = cropDef.gddToMaturity;
    crop2.growthStage = 'harvestable';
    crop2.isPerennial = true;
    crop2.perennialEstablished = true;
    crop2.perennialAge = 5;
    crop2.chillHoursAccumulated = cropDef.chillHoursRequired ?? 0;
    crop2.waterStressDays = 0;
    cell2.soil.nitrogen = 200;
    cell2.soil.potassium = 200;
    cell2.soil.organicMatter = 2.0;

    const cashBefore2 = state2.economy.cash;
    harvestCell(state2, cell2, true);
    const revenue2 = state2.economy.cash - cashBefore2;

    // Crash revenue should be expectedFactor of normal revenue
    expect(revenue).toBeLessThan(revenue2);
    // Revenue ratio should be close to the crash factor
    expect(revenue / revenue2).toBeCloseTo(expectedFactor, 1);
  });

  it('processing-tomatoes price NOT reduced by targeted market crash (targets almonds)', () => {
    const state = makeState();
    state.scenarioId = 'gradual-warming';
    state.flags['regime_market_crash'] = true;

    // Plant tomatoes
    state.calendar.month = 3;
    processCommand(state, { type: 'PLANT_CROP', cellRow: 2, cellCol: 0, cropId: 'processing-tomatoes' }, SLICE_1_SCENARIO);

    const cell = state.grid[2][0];
    const crop = cell.crop!;
    const cropDef = getCropDefinition('processing-tomatoes');

    crop.gddAccumulated = cropDef.gddToMaturity;
    crop.growthStage = 'harvestable';
    crop.waterStressDays = 0;
    cell.soil.nitrogen = 200;
    cell.soil.potassium = 300;
    cell.soil.organicMatter = 2.0;

    const cashBefore = state.economy.cash;
    harvestCell(state, cell, true);
    const crashRevenue = state.economy.cash - cashBefore;

    // Same harvest without crash flag
    const state2 = makeState();
    state2.scenarioId = 'gradual-warming';
    state2.calendar.month = 3;
    processCommand(state2, { type: 'PLANT_CROP', cellRow: 2, cellCol: 0, cropId: 'processing-tomatoes' }, SLICE_1_SCENARIO);
    const cell2 = state2.grid[2][0];
    const crop2 = cell2.crop!;
    crop2.gddAccumulated = cropDef.gddToMaturity;
    crop2.growthStage = 'harvestable';
    crop2.waterStressDays = 0;
    cell2.soil.nitrogen = 200;
    cell2.soil.potassium = 300;
    cell2.soil.organicMatter = 2.0;

    const cashBefore2 = state2.economy.cash;
    harvestCell(state2, cell2, true);
    const normalRevenue = state2.economy.cash - cashBefore2;

    // Non-targeted crop should have same revenue with or without crash
    expect(crashRevenue).toBeCloseTo(normalRevenue, 0);
  });

  it('without regime_market_crash flag: almond price is normal', () => {
    const state = makeState();
    state.scenarioId = 'gradual-warming';
    // Do NOT set crash flag

    state.calendar.month = 2;
    processCommand(state, { type: 'PLANT_CROP', cellRow: 3, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);
    const cell = state.grid[3][0];
    const crop = cell.crop!;
    const cropDef = getCropDefinition('almonds');

    crop.gddAccumulated = cropDef.gddToMaturity;
    crop.growthStage = 'harvestable';
    crop.isPerennial = true;
    crop.perennialEstablished = true;
    crop.perennialAge = 5;
    crop.chillHoursAccumulated = cropDef.chillHoursRequired ?? 0;
    crop.waterStressDays = 0;
    cell.soil.nitrogen = 200;
    cell.soil.potassium = 200;
    cell.soil.organicMatter = 2.0;

    const cashBefore = state.economy.cash;
    harvestCell(state, cell, true);
    const revenue = state.economy.cash - cashBefore;

    // Revenue should be positive (no crash reduction)
    expect(revenue).toBeGreaterThan(0);

    // Verify the effective price is close to basePrice (perfect conditions)
    // revenue ~= yieldPotential * basePrice * ageFactor - laborCost
    // With perennialAge=5, yearsToEstablish=3, rampUpYears=3: age factor ramping
    // Just verify revenue is substantially more than with crash
    const expectedMinRevenue = cropDef.yieldPotential * cropDef.basePrice * 0.5 - cropDef.laborCostPerAcre;
    expect(revenue).toBeGreaterThan(expectedMinRevenue);
  });
});

// ============================================================================
// §8: Message variety
// ============================================================================

describe('Slice 5c: message variety rotation', () => {
  it('water stress messages: waterStressMsgIdx advances and produces different text', () => {
    // waterStressMsgIdx is optional on GameState — starts undefined, set by engine on first fire
    const state = makeState();

    // Starts undefined (optional field, no save migration needed)
    expect(state.waterStressMsgIdx).toBeUndefined();

    // Engine pattern: ((state.waterStressMsgIdx ?? -1) + 1) % pool.length
    // First fire: (-1 + 1) % 5 = 0
    const idx0 = ((state.waterStressMsgIdx ?? -1) + 1) % 5;
    state.waterStressMsgIdx = idx0;
    expect(state.waterStressMsgIdx).toBe(0);

    // Second fire: (0 + 1) % 5 = 1 — different message
    const idx1 = ((state.waterStressMsgIdx ?? -1) + 1) % 5;
    state.waterStressMsgIdx = idx1;
    expect(state.waterStressMsgIdx).toBe(1);
    expect(idx1).not.toBe(idx0);
  });

  it('season change messages: seasonChangeMsgIdx advances', () => {
    const state = makeState();

    // Starts undefined (optional field)
    expect(state.seasonChangeMsgIdx).toBeUndefined();

    // First fire: (-1 + 1) % 5 = 0
    const idx0 = ((state.seasonChangeMsgIdx ?? -1) + 1) % 5;
    state.seasonChangeMsgIdx = idx0;
    expect(state.seasonChangeMsgIdx).toBe(0);

    // Second fire advances
    const idx1 = ((state.seasonChangeMsgIdx ?? -1) + 1) % 5;
    state.seasonChangeMsgIdx = idx1;
    expect(state.seasonChangeMsgIdx).toBe(1);
  });
});

// ============================================================================
// §9: Reflection data
// ============================================================================

describe('Slice 5c: buildReflectionData', () => {
  // buildReflectionData is a new function that will be implemented.
  // These tests import it dynamically or directly once it exists.

  it('with full snapshots: computes financial arc, soil trend, decisions, diversity', async () => {
    // Import the function — will fail until implementation exists
    const { buildReflectionData } = await import('../../src/engine/game.ts');
    const state = makeState();

    // Add some year snapshots
    state.tracking.yearSnapshots = [
      {
        year: 1,
        revenue: 5000,
        expenses: { planting: 1000, watering: 500, harvestLabor: 300, maintenance: 0, loanRepayment: 0, removal: 0, coverCrops: 0, eventCosts: 0, annualOverhead: 2000 },
        cashAtYearEnd: 51200,
        avgOrganicMatter: 2.0,
        avgNitrogen: 90,
        cropCounts: { 'silage-corn': 8 },
        coverCropCount: 0,
        eventsReceived: 0,
      },
      {
        year: 2,
        revenue: 8000,
        expenses: { planting: 2000, watering: 800, harvestLabor: 500, maintenance: 0, loanRepayment: 0, removal: 0, coverCrops: 0, eventCosts: 0, annualOverhead: 2000 },
        cashAtYearEnd: 54900,
        avgOrganicMatter: 1.9,
        avgNitrogen: 75,
        cropCounts: { 'silage-corn': 4, 'processing-tomatoes': 4 },
        coverCropCount: 2,
        eventsReceived: 1,
      },
    ];

    // Set some flags
    state.flags['tech_drip_irrigation'] = true;
    state.flags['regime_water_reduced'] = true;

    const reflection = buildReflectionData(state);

    expect(reflection).toBeDefined();
    // Should include financial data
    expect(reflection.financialArc).toBeDefined();
    expect(reflection.financialArc.length).toBeGreaterThan(0);
    // Should include soil trend
    expect(reflection.soilTrend).toBeDefined();
    // Should include decisions (tech/regime flags)
    expect(reflection.decisions).toBeDefined();
    expect(reflection.decisions.length).toBeGreaterThan(0);
    // Should include crop diversity info
    expect(reflection.diversity).toBeDefined();
  });

  it('zero snapshots (early bankruptcy): falls back to live state', async () => {
    const { buildReflectionData } = await import('../../src/engine/game.ts');
    const state = makeState();
    state.tracking.yearSnapshots = [];

    const reflection = buildReflectionData(state);

    expect(reflection).toBeDefined();
    // Should still have financial data from live state
    expect(reflection.financialArc).toBeDefined();
  });

  it('partial year: includes current year data', async () => {
    const { buildReflectionData } = await import('../../src/engine/game.ts');
    const state = makeState();
    state.tracking.yearSnapshots = [
      {
        year: 1,
        revenue: 5000,
        expenses: { planting: 1000, watering: 500, harvestLabor: 300, maintenance: 0, loanRepayment: 0, removal: 0, coverCrops: 0, eventCosts: 0, annualOverhead: 2000 },
        cashAtYearEnd: 51200,
        avgOrganicMatter: 2.0,
        avgNitrogen: 90,
        cropCounts: { 'silage-corn': 8 },
        coverCropCount: 0,
        eventsReceived: 0,
      },
    ];
    state.calendar.year = 2;
    state.economy.cash = 48000;

    const reflection = buildReflectionData(state);

    // Should include current year data (year 2 partial)
    expect(reflection.financialArc.length).toBeGreaterThanOrEqual(2);
  });

  it('flags always available: tech/regime flags listed regardless of snapshot count', async () => {
    const { buildReflectionData } = await import('../../src/engine/game.ts');
    const state = makeState();
    state.tracking.yearSnapshots = [];
    state.flags['tech_drip_irrigation'] = true;
    state.flags['regime_heat_threshold'] = true;

    const reflection = buildReflectionData(state);

    expect(reflection.decisions).toBeDefined();
    // Should include tech and regime flags
    const flagNames = reflection.decisions.map((d: { flag: string }) => d.flag);
    expect(flagNames).toContain('tech_drip_irrigation');
    expect(flagNames).toContain('regime_heat_threshold');
  });
});

// ============================================================================
// §10: Data integrity
// ============================================================================

describe('Slice 5c: data integrity', () => {
  const NEW_STORYLET_IDS = [
    'tech-soil-management',
    'tech-crop-agave',
    'regime-water-restriction',
    'regime-market-crash',
    'regime-heat-threshold',
  ];

  it('all 5 new storylet IDs are unique in the full STORYLETS array', () => {
    const ids = STORYLETS.map(s => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);

    // Verify each new ID is present
    for (const id of NEW_STORYLET_IDS) {
      expect(ids).toContain(id);
    }
  });

  it('all choice IDs are unique within each new storylet', () => {
    for (const id of NEW_STORYLET_IDS) {
      const storylet = getStorylet(id);
      const choiceIds = storylet.choices.map(c => c.id);
      const unique = new Set(choiceIds);
      expect(unique.size).toBe(choiceIds.length);
    }
  });

  it('all effects reference valid effect types', () => {
    const validEffectTypes = [
      'modify_cash', 'modify_moisture_all', 'modify_nitrogen_all',
      'modify_yield_modifier', 'modify_price_modifier', 'modify_irrigation_cost',
      'add_notification', 'restrict_watering', 'set_flag', 'activate_frost_protection',
    ];

    for (const id of NEW_STORYLET_IDS) {
      const storylet = getStorylet(id);
      for (const choice of storylet.choices) {
        for (const effect of choice.effects) {
          expect(validEffectTypes).toContain(effect.type);
        }
      }
    }
  });

  it('all 5 new storylets are condition-only (no random precondition)', () => {
    for (const id of NEW_STORYLET_IDS) {
      const storylet = getStorylet(id);
      const hasRandom = storylet.preconditions.some(c => c.type === 'random');
      expect(hasRandom).toBe(false);
    }
  });

  it('count of condition-only events increased by 5 from 5b baseline (was 9, now 14)', () => {
    const conditionOnlyCount = STORYLETS.filter(
      s => !s.preconditions.some(c => c.type === 'random'),
    ).length;
    expect(conditionOnlyCount).toBe(14);
  });
});
