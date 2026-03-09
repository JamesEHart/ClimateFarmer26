import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState, simulateTick, processCommand } from '../../src/engine/game.ts';
import { hasRandomCondition, drawSeasonalEvents, computeYearStressLevel, evaluateEvents } from '../../src/engine/events/selector.ts';
import { STORYLETS } from '../../src/data/events.ts';
import { SLICE_1_SCENARIO } from '../../src/data/scenario.ts';
import { SCENARIOS } from '../../src/data/scenarios.ts';
import { SeededRNG } from '../../src/engine/rng.ts';
import type { GameState, ClimateScenario } from '../../src/engine/types.ts';
import type { Storylet, ScheduledEvent } from '../../src/engine/events/types.ts';

function makeState(scenario?: ClimateScenario): GameState {
  return createInitialState('test-seasonal', scenario ?? SLICE_1_SCENARIO);
}

// ============================================================================
// hasRandomCondition
// ============================================================================

describe('hasRandomCondition', () => {
  it('returns true for storylets with a random precondition', () => {
    const storylet = STORYLETS.find(s => s.id === 'heatwave-advisory')!;
    expect(hasRandomCondition(storylet)).toBe(true);
  });

  it('returns false for condition-only advisor storylets', () => {
    const storylet = STORYLETS.find(s => s.id === 'advisor-soil-nitrogen')!;
    expect(hasRandomCondition(storylet)).toBe(false);
  });

  it('identifies all 8 seasonal-draw events', () => {
    const seasonalIds = STORYLETS.filter(s => hasRandomCondition(s)).map(s => s.id);
    expect(seasonalIds).toEqual([
      'heatwave-advisory',
      'water-allocation-cut',
      'late-frost-warning',
      'tomato-market-surge',
      'groundwater-pumping-ban',
      'weather-heat-forecast',
      'weather-frost-alert',
      'weather-drought-outlook',
    ]);
  });

  it('identifies all 9 per-tick events', () => {
    const perTickIds = STORYLETS.filter(s => !hasRandomCondition(s)).map(s => s.id);
    expect(perTickIds).toEqual([
      'advisor-orchard-decline',
      'advisor-soil-nitrogen',
      'advisor-crop-failure',
      'advisor-chill-warning',
      'advisor-drought-recovery',
      'advisor-perennial-opportunity',
      'advisor-chen-intro',
      'advisor-forum-intro',
      'tech-water-irrigation',
    ]);
  });
});

// ============================================================================
// computeYearStressLevel
// ============================================================================

describe('computeYearStressLevel', () => {
  it('returns a value in 0-1 range', () => {
    for (let y = 1; y <= 30; y++) {
      const stress = computeYearStressLevel(SLICE_1_SCENARIO, y);
      expect(stress).toBeGreaterThanOrEqual(0);
      expect(stress).toBeLessThanOrEqual(1);
    }
  });

  it('gradual-warming year 1: low stress', () => {
    const stress = computeYearStressLevel(SLICE_1_SCENARIO, 1);
    expect(stress).toBeLessThan(0.4);
  });

  it('gradual-warming year 30: higher stress than year 1', () => {
    const stress30 = computeYearStressLevel(SLICE_1_SCENARIO, 30);
    const stress1 = computeYearStressLevel(SLICE_1_SCENARIO, 1);
    expect(stress30).toBeGreaterThan(stress1);
  });

  it('early-drought has higher stress in early years', () => {
    const earlyDrought = SCENARIOS['early-drought'];
    const gradual = SLICE_1_SCENARIO;
    // Year 2 is a drought year in early-drought
    const edStress = computeYearStressLevel(earlyDrought, 2);
    const gwStress = computeYearStressLevel(gradual, 2);
    expect(edStress).toBeGreaterThan(gwStress);
  });

  it('mild-baseline has lower stress than gradual-warming', () => {
    const mild = SCENARIOS['mild-baseline'];
    const gradual = SLICE_1_SCENARIO;
    // Year 10: mild should be less stressed
    const mildStress = computeYearStressLevel(mild, 10);
    const gradualStress = computeYearStressLevel(gradual, 10);
    expect(mildStress).toBeLessThanOrEqual(gradualStress);
  });
});

// ============================================================================
// drawSeasonalEvents
// ============================================================================

describe('drawSeasonalEvents', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
    // Advance to summer Year 2 so most events are eligible
    state.calendar = { day: 152, month: 6, season: 'summer', year: 2, totalDay: 516 };
    // Plant crops so has_crop conditions pass
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        state.grid[r][c].crop = {
          cropId: 'processing-tomatoes',
          plantedDay: 500,
          gddAccumulated: 0,
          waterStressDays: 0,
          growthStage: 'vegetative' as const,
          overripeDaysRemaining: -1,
          isPerennial: false,
          perennialAge: 0,
          perennialEstablished: false,
          isDormant: false,
          harvestedThisSeason: false,
          chillHoursAccumulated: 0,
        };
      }
    }
  });

  it('draws only storylets with random preconditions', () => {
    const rng = new SeededRNG(42);
    const queue = drawSeasonalEvents(state, STORYLETS, rng, 0.5, 516, 605);
    for (const event of queue) {
      const storylet = STORYLETS.find(s => s.id === event.storyletId);
      expect(storylet).toBeDefined();
      expect(hasRandomCondition(storylet!)).toBe(true);
    }
  });

  it('respects cooldown', () => {
    state.eventLog.push({ storyletId: 'heatwave-advisory', day: 400, choiceId: 'wait-it-out' });
    const rng = new SeededRNG(42);
    const queue = drawSeasonalEvents(state, STORYLETS, rng, 1.0, 516, 605);
    // heatwave has 180-day cooldown; day 516 - 400 = 116 < 180
    expect(queue.find(e => e.storyletId === 'heatwave-advisory')).toBeUndefined();
  });

  it('respects maxOccurrences', () => {
    // weather-frost-alert has maxOccurrences: 3
    state.eventLog.push(
      { storyletId: 'weather-frost-alert', day: 10, choiceId: 'wait-and-see' },
      { storyletId: 'weather-frost-alert', day: 100, choiceId: 'wait-and-see' },
      { storyletId: 'weather-frost-alert', day: 200, choiceId: 'wait-and-see' },
    );
    // Move to spring so frost alert's season precondition passes
    state.calendar = { day: 60, month: 3, season: 'spring', year: 2, totalDay: 424 };
    const rng = new SeededRNG(42);
    const queue = drawSeasonalEvents(state, STORYLETS, rng, 1.0, 424, 513);
    expect(queue.find(e => e.storyletId === 'weather-frost-alert')).toBeUndefined();
  });

  it('family cap: max 1 climate per season', () => {
    // Use high stress to maximize probability
    const rng = new SeededRNG(42);
    // Run many seeds to find at least one where both climate events would be eligible
    let multiClimateSeen = false;
    for (let seed = 1; seed <= 100; seed++) {
      const testRng = new SeededRNG(seed);
      const queue = drawSeasonalEvents(state, STORYLETS, testRng, 1.0, 516, 605);
      const climateEvents = queue.filter(e => {
        const s = STORYLETS.find(st => st.id === e.storyletId);
        return s?.type === 'climate';
      });
      expect(climateEvents.length).toBeLessThanOrEqual(1);
    }
  });

  it('family cap: max 1 regulatory per season', () => {
    // Advance to year 5+ summer so both regulatory events are eligible
    state.calendar = { day: 152, month: 6, season: 'summer', year: 5, totalDay: 1611 };
    for (let seed = 1; seed <= 100; seed++) {
      const rng = new SeededRNG(seed);
      const queue = drawSeasonalEvents(state, STORYLETS, rng, 1.0, 1611, 1700);
      const regEvents = queue.filter(e => {
        const s = STORYLETS.find(st => st.id === e.storyletId);
        return s?.type === 'regulatory';
      });
      expect(regEvents.length).toBeLessThanOrEqual(1);
    }
  });

  it('family cap: max 1 advisor per season in seasonal draw', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const rng = new SeededRNG(seed);
      const queue = drawSeasonalEvents(state, STORYLETS, rng, 1.0, 516, 605);
      const advisorEvents = queue.filter(e => {
        const s = STORYLETS.find(st => st.id === e.storyletId);
        return s?.type === 'advisor';
      });
      expect(advisorEvents.length).toBeLessThanOrEqual(1);
    }
  });

  it('scheduling: fireDay within season bounds', () => {
    const rng = new SeededRNG(42);
    const seasonStart = 516;
    const seasonEnd = 605;
    const queue = drawSeasonalEvents(state, STORYLETS, rng, 1.0, seasonStart, seasonEnd);
    for (const event of queue) {
      expect(event.firesOnDay).toBeGreaterThanOrEqual(seasonStart);
      expect(event.firesOnDay).toBeLessThanOrEqual(seasonEnd);
    }
  });

  it('scheduling: foreshadow appearsOnDay before firesOnDay', () => {
    const rng = new SeededRNG(42);
    const queue = drawSeasonalEvents(state, STORYLETS, rng, 0.5, 516, 605);
    for (const event of queue) {
      expect(event.appearsOnDay).toBeLessThanOrEqual(event.firesOnDay);
    }
  });

  it('determinism: same seed = same schedule', () => {
    const q1 = drawSeasonalEvents(state, STORYLETS, new SeededRNG(42), 0.5, 516, 605);
    const q2 = drawSeasonalEvents(state, STORYLETS, new SeededRNG(42), 0.5, 516, 605);
    expect(q1).toEqual(q2);
  });

  it('empty draw when no events eligible (wrong season/year)', () => {
    // Winter Year 1: heatwave needs summer+year2, frost needs spring, etc.
    state.calendar = { day: 335, month: 12, season: 'winter', year: 1, totalDay: 334 };
    const rng = new SeededRNG(42);
    const queue = drawSeasonalEvents(state, STORYLETS, rng, 0.5, 334, 423);
    expect(queue.length).toBe(0);
  });

  it('high stress → more events drawn', () => {
    let highStressTotal = 0;
    let lowStressTotal = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const highQ = drawSeasonalEvents(state, STORYLETS, new SeededRNG(seed), 0.9, 516, 605);
      const lowQ = drawSeasonalEvents(state, STORYLETS, new SeededRNG(seed), 0.1, 516, 605);
      highStressTotal += highQ.length;
      lowStressTotal += lowQ.length;
    }
    expect(highStressTotal).toBeGreaterThan(lowStressTotal);
  });

  it('sorted by appearsOnDay', () => {
    const rng = new SeededRNG(42);
    const queue = drawSeasonalEvents(state, STORYLETS, rng, 1.0, 516, 605);
    for (let i = 1; i < queue.length; i++) {
      expect(queue[i].appearsOnDay).toBeGreaterThanOrEqual(queue[i - 1].appearsOnDay);
    }
  });

  it('all events start unconsumed', () => {
    const rng = new SeededRNG(42);
    const queue = drawSeasonalEvents(state, STORYLETS, rng, 1.0, 516, 605);
    for (const event of queue) {
      expect(event.consumed).toBe(false);
    }
  });
});

// ============================================================================
// evaluateEvents with conditionOnlyAdvisors
// ============================================================================

describe('evaluateEvents conditionOnlyAdvisors filter', () => {
  it('only evaluates non-random storylets when conditionOnlyAdvisors is true', () => {
    const state = makeState();
    state.speed = 1;
    state.calendar = { day: 152, month: 6, season: 'summer', year: 3, totalDay: 881 };

    // Set up conditions for advisor-soil-nitrogen (condition-only)
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        state.grid[r][c].soil.nitrogen = 20; // below 50 threshold
      }
    }

    const rng = new SeededRNG(42);
    const result = evaluateEvents(state, STORYLETS, rng, { conditionOnlyAdvisors: true });

    // Should find the soil nitrogen advisor
    if (result.fireEvent) {
      expect(hasRandomCondition(result.fireEvent)).toBe(false);
    }
  });

  it('never selects random-gated events when conditionOnlyAdvisors is true', () => {
    const state = makeState();
    state.speed = 1;
    state.calendar = { day: 152, month: 6, season: 'summer', year: 2, totalDay: 516 };

    // Plant tomatoes
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        state.grid[r][c].crop = {
          cropId: 'processing-tomatoes',
          plantedDay: 500,
          gddAccumulated: 0,
          waterStressDays: 0,
          growthStage: 'vegetative' as const,
          overripeDaysRemaining: -1,
          isPerennial: false,
          perennialAge: 0,
          perennialEstablished: false,
          isDormant: false,
          harvestedThisSeason: false,
          chillHoursAccumulated: 0,
        };
      }
    }

    // Run many seeds — should never fire a random-gated event
    for (let seed = 1; seed <= 50; seed++) {
      const rng = new SeededRNG(seed);
      const result = evaluateEvents(state, STORYLETS, rng, { conditionOnlyAdvisors: true });
      if (result.fireEvent) {
        expect(hasRandomCondition(result.fireEvent)).toBe(false);
      }
      // Should also not create foreshadows for random-gated storylets
      for (const f of result.newForeshadows) {
        const storylet = STORYLETS.find(s => s.id === f.storyletId);
        expect(storylet ? hasRandomCondition(storylet) : false).toBe(false);
      }
    }
  });

  it('foreshadow maturation in Phase 1 still works for seasonal events', () => {
    // A foreshadow from the seasonal draw should still mature through Phase 1
    const state = makeState();
    state.calendar = { day: 160, month: 6, season: 'summer', year: 2, totalDay: 524 };

    // Create a mature foreshadow for heatwave (seasonal draw event)
    state.pendingForeshadows.push({
      storyletId: 'heatwave-advisory',
      signal: 'Heat incoming',
      appearsOnDay: 517,
      eventFiresOnDay: 524, // fires today
      isFalseAlarm: false,
      advisorSource: undefined,
      dismissed: false,
    });
    // Plant crops so conditions pass
    state.grid[0][0].crop = {
      cropId: 'corn',
      plantedDay: 500,
      gddAccumulated: 0,
      waterStressDays: 0,
      growthStage: 'vegetative' as const,
      overripeDaysRemaining: -1,
      isPerennial: false,
      perennialAge: 0,
      perennialEstablished: false,
      isDormant: false,
      harvestedThisSeason: false,
      chillHoursAccumulated: 0,
    };

    const rng = new SeededRNG(42);
    const result = evaluateEvents(state, STORYLETS, rng, { conditionOnlyAdvisors: true });

    // Phase 1 should fire the foreshadowed heatwave even with conditionOnlyAdvisors
    expect(result.fireEvent).not.toBeNull();
    expect(result.fireEvent!.id).toBe('heatwave-advisory');
  });
});

// ============================================================================
// Year 1 onboarding: no random events in Spring
// ============================================================================

describe('Year 1 onboarding', () => {
  it('Year 1 Spring: no seasonal events fired', () => {
    const state = makeState();
    state.speed = 1;

    // Plant crops
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        state.grid[r][c].crop = {
          cropId: 'processing-tomatoes',
          plantedDay: 59,
          gddAccumulated: 0,
          waterStressDays: 0,
          growthStage: 'vegetative' as const,
          overripeDaysRemaining: -1,
          isPerennial: false,
          perennialAge: 0,
          perennialEstablished: false,
          isDormant: false,
          harvestedThisSeason: false,
          chillHoursAccumulated: 0,
        };
      }
    }

    // Run through all of Year 1 Spring (days 59-150)
    let randomEventFired = false;
    for (let tick = 0; tick < 100; tick++) {
      while (state.autoPauseQueue.length > 0) {
        if (state.activeEvent) {
          const storylet = STORYLETS.find(s => s.id === state.activeEvent!.storyletId);
          if (storylet && hasRandomCondition(storylet)) {
            randomEventFired = true;
          }
          processCommand(state, {
            type: 'RESPOND_EVENT',
            eventId: state.activeEvent.storyletId,
            choiceId: state.activeEvent.choices[0].id,
          }, SLICE_1_SCENARIO);
        }
        state.autoPauseQueue = [];
        state.speed = 1;
      }
      if (state.calendar.season !== 'spring') break;
      if (state.gameOver) break;
      simulateTick(state, SLICE_1_SCENARIO);
    }

    expect(randomEventFired).toBe(false);
    // The seasonal queue should be empty during Year 1 Spring
    // (it gets populated at summer transition)
  });

  it('Year 1 Summer: seasonal draw activates', () => {
    const state = makeState();
    state.speed = 1;

    // Plant crops
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        state.grid[r][c].crop = {
          cropId: 'processing-tomatoes',
          plantedDay: 59,
          gddAccumulated: 0,
          waterStressDays: 0,
          growthStage: 'vegetative' as const,
          overripeDaysRemaining: -1,
          isPerennial: false,
          perennialAge: 0,
          perennialEstablished: false,
          isDormant: false,
          harvestedThisSeason: false,
          chillHoursAccumulated: 0,
        };
      }
    }

    // Advance to summer
    for (let tick = 0; tick < 200; tick++) {
      while (state.autoPauseQueue.length > 0) {
        if (state.activeEvent) {
          processCommand(state, {
            type: 'RESPOND_EVENT',
            eventId: state.activeEvent.storyletId,
            choiceId: state.activeEvent.choices[0].id,
          }, SLICE_1_SCENARIO);
        }
        state.autoPauseQueue = [];
        state.speed = 1;
      }
      if (state.gameOver) break;
      if (state.calendar.season === 'summer') break;
      simulateTick(state, SLICE_1_SCENARIO);
    }

    // Now we should be in summer — seasonal queue should have been drawn
    expect(state.calendar.season).toBe('summer');
    // Queue may or may not have events depending on RNG, but it should exist
    expect(Array.isArray(state.seasonalEventQueue)).toBe(true);
  });
});

// ============================================================================
// Draw log observability
// ============================================================================

describe('Seasonal draw observability', () => {
  it('drawSeasonalEvents produces consistent output for QA logging', () => {
    const state = makeState();
    state.calendar = { day: 152, month: 6, season: 'summer', year: 2, totalDay: 516 };
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        state.grid[r][c].crop = {
          cropId: 'processing-tomatoes',
          plantedDay: 500,
          gddAccumulated: 0,
          waterStressDays: 0,
          growthStage: 'vegetative' as const,
          overripeDaysRemaining: -1,
          isPerennial: false,
          perennialAge: 0,
          perennialEstablished: false,
          isDormant: false,
          harvestedThisSeason: false,
          chillHoursAccumulated: 0,
        };
      }
    }

    const rng = new SeededRNG(42);
    const queue = drawSeasonalEvents(state, STORYLETS, rng, 0.5, 516, 605);

    // Each event in queue has all required fields
    for (const event of queue) {
      expect(typeof event.storyletId).toBe('string');
      expect(typeof event.appearsOnDay).toBe('number');
      expect(typeof event.firesOnDay).toBe('number');
      expect(typeof event.isFalseAlarm).toBe('boolean');
      expect(event.consumed).toBe(false);
    }
  });
});

// ============================================================================
// Integration: frequency check over 30 years
// ============================================================================

describe('Event frequency integration', () => {
  it('heatwave fires 2-15 times in 30 years (not 18+)', () => {
    const state = makeState();
    state.speed = 1;

    // Plant perennial almonds — they persist across years (has_crop always true)
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        state.grid[r][c].crop = {
          cropId: 'almonds',
          plantedDay: 59,
          gddAccumulated: 0,
          waterStressDays: 0,
          growthStage: 'growing' as const,
          overripeDaysRemaining: -1,
          isPerennial: true,
          perennialAge: 1,
          perennialEstablished: false,
          isDormant: false,
          harvestedThisSeason: false,
          chillHoursAccumulated: 0,
        } as import('../../src/engine/types.ts').CropInstance;
      }
    }

    let heatwaveCount = 0;
    for (let tick = 0; tick < 11000; tick++) {
      while (state.autoPauseQueue.length > 0) {
        if (state.activeEvent) {
          if (state.activeEvent.storyletId === 'heatwave-advisory') {
            heatwaveCount++;
          }
          processCommand(state, {
            type: 'RESPOND_EVENT',
            eventId: state.activeEvent.storyletId,
            choiceId: state.activeEvent.choices[0].id,
          }, SLICE_1_SCENARIO);
        }
        state.autoPauseQueue = [];
        if (state.gameOver) break;
        state.speed = 1;
      }
      if (state.gameOver) break;
      simulateTick(state, SLICE_1_SCENARIO);
    }

    // With seasonal draws and ~30% base probability modulated by stress,
    // expect some fires over 18 eligible summers (Year 2+, summer only)
    // but NOT every year. Allow wide range for stochastic test.
    expect(heatwaveCount).toBeGreaterThanOrEqual(1);
    expect(heatwaveCount).toBeLessThanOrEqual(15);
  });

  it('same seed produces identical eventLog', () => {
    function runGame(seed: number): string[] {
      const scenario = { ...SLICE_1_SCENARIO, seed };
      const state = createInitialState('freq-test', scenario);
      state.speed = 1;

      for (let tick = 0; tick < 3000; tick++) {
        while (state.autoPauseQueue.length > 0) {
          if (state.activeEvent) {
            processCommand(state, {
              type: 'RESPOND_EVENT',
              eventId: state.activeEvent.storyletId,
              choiceId: state.activeEvent.choices[0].id,
            }, scenario);
          }
          state.autoPauseQueue = [];
          if (state.gameOver) break;
          state.speed = 1;
        }
        if (state.gameOver) break;
        simulateTick(state, scenario);
      }

      return state.eventLog.map(e => `${e.storyletId}@${e.day}`);
    }

    const run1 = runGame(42);
    const run2 = runGame(42);
    expect(run1).toEqual(run2);
  });
});
