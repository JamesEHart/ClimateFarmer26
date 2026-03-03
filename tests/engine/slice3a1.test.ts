import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState, processCommand, simulateTick, harvestCell, dismissAutoPause } from '../../src/engine/game.ts';
import { evaluateCondition, evaluateEvents } from '../../src/engine/events/selector.ts';
import { applyEffects, getPriceModifier } from '../../src/engine/events/effects.ts';
import { SLICE_1_SCENARIO } from '../../src/data/scenario.ts';
import { STORYLETS } from '../../src/data/events.ts';
import { CROPS, getCropDefinition } from '../../src/data/crops.ts';
import { SeededRNG } from '../../src/engine/rng.ts';
import { isYearEnd } from '../../src/engine/calendar.ts';
import type { GameState, CropInstance } from '../../src/engine/types.ts';
import type { Storylet, Condition } from '../../src/engine/events/types.ts';

// ============================================================================
// Helpers
// ============================================================================

function makeState(): GameState {
  const state = createInitialState('test-player', SLICE_1_SCENARIO);
  state.speed = 1; // Unpause so simulateTick actually advances
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

/** Advance until calendar.year changes from its current value. Returns the number of ticks advanced. */
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

function plantCrop(state: GameState, row: number, col: number, cropId: string): void {
  const result = processCommand(state, {
    type: 'PLANT_CROP',
    cellRow: row,
    cellCol: col,
    cropId,
  }, SLICE_1_SCENARIO);
  if (!result.success) {
    throw new Error(`Plant failed: ${result.reason}`);
  }
}

// ============================================================================
// Stretch Events: Tomato Market Surge
// ============================================================================

describe('Tomato Market Surge event', () => {
  it('exists in STORYLETS with correct properties', () => {
    const surge = STORYLETS.find(s => s.id === 'tomato-market-surge');
    expect(surge).toBeDefined();
    expect(surge!.type).toBe('market');
    expect(surge!.priority).toBe(45);
    expect(surge!.cooldownDays).toBe(365);
  });

  it('has correct preconditions: season_not winter, min_year 2, has_crop tomatoes, random 0.10', () => {
    const surge = STORYLETS.find(s => s.id === 'tomato-market-surge')!;
    expect(surge.preconditions).toContainEqual({ type: 'season_not', season: 'winter' });
    expect(surge.preconditions).toContainEqual({ type: 'min_year', year: 2 });
    expect(surge.preconditions).toContainEqual({ type: 'has_crop', cropId: 'processing-tomatoes' });
    expect(surge.preconditions).toContainEqual({ type: 'random', probability: 0.10 });
  });

  it('has a single choice that applies price modifier x1.4 for 60 days', () => {
    const surge = STORYLETS.find(s => s.id === 'tomato-market-surge')!;
    expect(surge.choices).toHaveLength(1);
    const choice = surge.choices[0];
    const priceEffect = choice.effects.find(
      e => e.type === 'modify_price_modifier'
    );
    expect(priceEffect).toBeDefined();
    if (priceEffect && priceEffect.type === 'modify_price_modifier') {
      expect(priceEffect.cropId).toBe('processing-tomatoes');
      expect(priceEffect.multiplier).toBe(1.4);
      expect(priceEffect.durationDays).toBe(60);
    }
  });

  it('has no foreshadowing', () => {
    const surge = STORYLETS.find(s => s.id === 'tomato-market-surge')!;
    expect(surge.foreshadowing).toBeUndefined();
  });

  it('price modifier affects tomato harvest revenue', () => {
    const state = makeState();
    // Simulate active price modifier
    state.activeEffects.push({
      effectType: 'price_modifier',
      cropId: 'processing-tomatoes',
      multiplier: 1.4,
      expiresDay: state.calendar.totalDay + 60,
      sourceEventId: 'tomato-market-surge',
    });
    const modifier = getPriceModifier(state, 'processing-tomatoes');
    expect(modifier).toBeCloseTo(1.4);
  });

  it('price modifier does NOT affect non-tomato crops', () => {
    const state = makeState();
    state.activeEffects.push({
      effectType: 'price_modifier',
      cropId: 'processing-tomatoes',
      multiplier: 1.4,
      expiresDay: state.calendar.totalDay + 60,
      sourceEventId: 'tomato-market-surge',
    });
    expect(getPriceModifier(state, 'silage-corn')).toBeCloseTo(1.0);
    expect(getPriceModifier(state, 'sorghum')).toBeCloseTo(1.0);
  });
});

  it('regression (isolation): never fires on almond-only farm across many seeds', () => {
    // QA playtest reported tomato-market-surge firing with only almonds planted.
    // Run evaluateEvents across 50 seeds × many ticks in Year 2 spring to verify
    // the has_crop precondition blocks the event.

    for (let seed = 1; seed <= 50; seed++) {
      const state = makeState();
      state.calendar = { year: 2, season: 'spring', month: 4, day: 10, totalDay: 59 + 365 + 30 };

      // Plant almonds in all cells (no tomatoes)
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          state.grid[r][c].crop = {
            cropId: 'almonds',
            plantedDay: 100,
            growthStage: 'growing' as const,
            isPerennial: true,
            perennialAge: 1,
            perennialEstablished: false,
            harvestedThisSeason: false,
            daysSinceWatered: 0,
            waterStressDays: 0,
          } as CropInstance;
        }
      }

      // Run evaluateEvents 100 times with different RNG states
      const rng = new SeededRNG(seed * 9973);
      for (let tick = 0; tick < 100; tick++) {
        const result = evaluateEvents(state, STORYLETS, rng);
        if (result.fireEvent) {
          expect(result.fireEvent.id).not.toBe('tomato-market-surge');
          // Clear activeEvent so next eval can fire
          state.activeEvent = null;
        }
      }
    }
  });

  it('regression (integration): never fires via simulateTick on almond-only farm', () => {
    // Full engine path: simulateTick → weather → soil → events → queue.
    // Tests 20 seeds × full Year 2 spring (~90 ticks each) through the real engine.
    const SLICE_1 = SLICE_1_SCENARIO;

    for (let seed = 1; seed <= 20; seed++) {
      const state = createInitialState('tomato-repro-' + seed, SLICE_1);
      state.speed = 1;

      // Plant almonds in all 64 cells
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          state.grid[r][c].crop = {
            cropId: 'almonds',
            plantedDay: state.calendar.totalDay,
            growthStage: 'growing' as const,
            isPerennial: true,
            perennialAge: 1,
            perennialEstablished: false,
            harvestedThisSeason: false,
            daysSinceWatered: 0,
            waterStressDays: 0,
          } as CropInstance;
        }
      }

      // Advance through entire Year 1 + Year 2 spring (~365 + 90 ticks)
      // Dismiss auto-pauses as they arise (mirrors bot harness behavior)
      for (let tick = 0; tick < 500; tick++) {
        // Drain auto-pause queue before each tick
        while (state.autoPauseQueue.length > 0) {
          // If an event fired, check it's not tomato-market-surge
          if (state.activeEvent) {
            expect(state.activeEvent.storyletId).not.toBe('tomato-market-surge');
            // Respond to event so it clears
            const choice = state.activeEvent.choices[0];
            if (choice) {
              processCommand(state, {
                type: 'RESPOND_EVENT',
                eventId: state.activeEvent.storyletId,
                choiceId: choice.id,
              }, SLICE_1);
            }
          }
          dismissAutoPause(state);
        }

        if (state.gameOver) break;
        // Stop after Year 2 spring (no need to go further)
        if (state.calendar.year >= 3) break;

        state.speed = 1;
        simulateTick(state, SLICE_1);
      }
    }
  });

// ============================================================================
// Stretch Events: Groundwater Pumping Ban
// ============================================================================

describe('Groundwater Pumping Ban event', () => {
  it('exists in STORYLETS with correct properties', () => {
    const ban = STORYLETS.find(s => s.id === 'groundwater-pumping-ban');
    expect(ban).toBeDefined();
    expect(ban!.type).toBe('regulatory');
    expect(ban!.priority).toBe(55);
    expect(ban!.cooldownDays).toBe(730);
  });

  it('has correct preconditions: season summer, min_year 5, random 0.12', () => {
    const ban = STORYLETS.find(s => s.id === 'groundwater-pumping-ban')!;
    expect(ban.preconditions).toContainEqual({ type: 'season', season: 'summer' });
    expect(ban.preconditions).toContainEqual({ type: 'min_year', year: 5 });
    expect(ban.preconditions).toContainEqual({ type: 'random', probability: 0.12 });
  });

  it('has two choices: Comply (restrict 30 days) and Buy rights ($1000)', () => {
    const ban = STORYLETS.find(s => s.id === 'groundwater-pumping-ban')!;
    expect(ban.choices).toHaveLength(2);

    const comply = ban.choices.find(c => c.id === 'comply');
    expect(comply).toBeDefined();
    const restrictEffect = comply!.effects.find(e => e.type === 'restrict_watering');
    expect(restrictEffect).toBeDefined();
    if (restrictEffect && restrictEffect.type === 'restrict_watering') {
      expect(restrictEffect.durationDays).toBe(30);
    }

    const buy = ban.choices.find(c => c.id === 'buy-rights');
    expect(buy).toBeDefined();
    const cashEffect = buy!.effects.find(e => e.type === 'modify_cash');
    expect(cashEffect).toBeDefined();
    if (cashEffect && cashEffect.type === 'modify_cash') {
      expect(cashEffect.amount).toBe(-1000);
    }
  });

  it('has no foreshadowing', () => {
    const ban = STORYLETS.find(s => s.id === 'groundwater-pumping-ban')!;
    expect(ban.foreshadowing).toBeUndefined();
  });
});

// ============================================================================
// New Crop: Sorghum
// ============================================================================

describe('Sorghum crop definition', () => {
  it('exists in CROPS with correct id and type', () => {
    const sorghum = CROPS['sorghum'];
    expect(sorghum).toBeDefined();
    expect(sorghum.type).toBe('annual');
  });

  it('has drought-tolerant ky of 0.50', () => {
    expect(getCropDefinition('sorghum').ky).toBe(0.50);
  });

  it('has correct planting window April-June', () => {
    const sorghum = getCropDefinition('sorghum');
    expect(sorghum.plantingWindow.startMonth).toBe(4);
    expect(sorghum.plantingWindow.endMonth).toBe(6);
  });

  it('has correct economics: $660/acre revenue at full yield', () => {
    const sorghum = getCropDefinition('sorghum');
    expect(sorghum.yieldPotential * sorghum.basePrice).toBe(660);
  });

  it('has lower seed cost than corn/tomatoes ($35)', () => {
    expect(getCropDefinition('sorghum').seedCostPerAcre).toBe(35);
  });

  it('can be planted in April', () => {
    const state = makeState();
    // Advance ~31 days from March 1 to reach April
    advanceTicks(state, 31);
    expect(state.calendar.month).toBe(4);
    plantCrop(state, 0, 0, 'sorghum');
    expect(state.grid[0][0].crop).not.toBeNull();
    expect(state.grid[0][0].crop!.cropId).toBe('sorghum');
  });

  it('is rejected outside planting window (March)', () => {
    const state = makeState();
    // Game starts in March — sorghum window is April-June
    const result = processCommand(state, {
      type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'sorghum',
    }, SLICE_1_SCENARIO);
    expect(result.success).toBe(false);
  });

  it('survives drought better than corn (lower ky = less yield loss)', () => {
    expect(getCropDefinition('sorghum').ky).toBeLessThan(getCropDefinition('silage-corn').ky);
  });
});

// ============================================================================
// New Crop: Citrus Navels (Perennial)
// ============================================================================

describe('Citrus Navels crop definition', () => {
  it('exists in CROPS with correct id and type', () => {
    expect(CROPS['citrus-navels']).toBeDefined();
    expect(CROPS['citrus-navels'].type).toBe('perennial');
  });

  it('is evergreen: no dormant seasons', () => {
    expect(getCropDefinition('citrus-navels').dormantSeasons).toBeUndefined();
  });

  it('has no chill hours requirement', () => {
    expect(getCropDefinition('citrus-navels').chillHoursRequired).toBeUndefined();
  });

  it('has correct establishment period: 3 years', () => {
    expect(getCropDefinition('citrus-navels').yearsToEstablish).toBe(3);
  });

  it('has correct economics: $4,900/acre revenue at full yield', () => {
    const citrus = getCropDefinition('citrus-navels');
    expect(citrus.yieldPotential * citrus.basePrice).toBe(4900);
  });

  it('has correct planting window February-April', () => {
    const citrus = getCropDefinition('citrus-navels');
    expect(citrus.plantingWindow.startMonth).toBe(2);
    expect(citrus.plantingWindow.endMonth).toBe(4);
  });

  it('can be planted in March (game start)', () => {
    const state = makeState();
    plantCrop(state, 0, 0, 'citrus-navels');
    expect(state.grid[0][0].crop!.cropId).toBe('citrus-navels');
    expect(state.grid[0][0].crop!.isPerennial).toBe(true);
  });

  it('has maintenance cost $150 and removal cost $400', () => {
    const citrus = getCropDefinition('citrus-navels');
    expect(citrus.annualMaintenanceCost).toBe(150);
    expect(citrus.removalCost).toBe(400);
  });

  it('has productive lifespan of 35 years', () => {
    expect(getCropDefinition('citrus-navels').productiveLifespan).toBe(35);
  });
});

// ============================================================================
// Citrus: No Dormancy Behavior
// ============================================================================

describe('Citrus evergreen behavior', () => {
  it('citrus does NOT enter dormancy when season changes to winter', () => {
    const state = makeState();
    plantCrop(state, 0, 0, 'citrus-navels');
    // Advance into winter (~275 days from March 1)
    advanceTicks(state, 275);
    expect(state.calendar.season).toBe('winter');
    expect(state.grid[0][0].crop!.isDormant).toBe(false);
  });

  it('citrus does NOT accumulate chill hours during winter', () => {
    const state = makeState();
    plantCrop(state, 0, 0, 'citrus-navels');
    // Advance through one full year
    advancePastYearEnd(state);
    expect(state.grid[0][0].crop!.chillHoursAccumulated).toBe(0);
  });
});

// ============================================================================
// Year-end harvestedThisSeason Reset
// ============================================================================

describe('Year-end harvestedThisSeason reset', () => {
  it('resets harvestedThisSeason for citrus (evergreen) at year-end', () => {
    const state = makeState();
    plantCrop(state, 0, 0, 'citrus-navels');
    const crop = state.grid[0][0].crop!;
    // Manually set as if harvested
    crop.harvestedThisSeason = true;
    crop.perennialEstablished = true;
    crop.perennialAge = 3;

    advancePastYearEnd(state);

    expect(state.grid[0][0].crop!.harvestedThisSeason).toBe(false);
  });

  it('resets harvestedThisSeason for dormant perennials too', () => {
    const state = makeState();
    plantCrop(state, 0, 0, 'almonds');
    const crop = state.grid[0][0].crop!;
    crop.harvestedThisSeason = true;
    crop.perennialEstablished = true;
    crop.perennialAge = 3;

    advancePastYearEnd(state);

    expect(state.grid[0][0].crop!.harvestedThisSeason).toBe(false);
  });

  it('double-harvest regression: harvest blocked before year-end reset', () => {
    const state = makeState();
    plantCrop(state, 0, 0, 'citrus-navels');
    const crop = state.grid[0][0].crop!;
    crop.perennialEstablished = true;
    crop.perennialAge = 4;
    crop.growthStage = 'harvestable';
    crop.harvestedThisSeason = true;

    // Try to harvest — should fail because already harvested this season
    const result = processCommand(state, {
      type: 'HARVEST', cellRow: 0, cellCol: 0,
    }, SLICE_1_SCENARIO);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Determinism regression
// ============================================================================

describe('Slice 3a1 determinism', () => {
  it('same seed + same commands = identical state after 100 ticks', () => {
    const state1 = makeState();
    const state2 = makeState();

    // Plant citrus on both (March is in planting window)
    plantCrop(state1, 0, 0, 'citrus-navels');
    plantCrop(state2, 0, 0, 'citrus-navels');

    // Advance both 100 ticks
    advanceTicks(state1, 100);
    advanceTicks(state2, 100);

    expect(state1.calendar.totalDay).toBe(state2.calendar.totalDay);
    expect(state1.economy.cash).toBe(state2.economy.cash);
    expect(state1.rngState).toBe(state2.rngState);
    expect(state1.eventRngState).toBe(state2.eventRngState);
    expect(state1.grid[0][0].soil.moisture).toBe(state2.grid[0][0].soil.moisture);
  });
});
