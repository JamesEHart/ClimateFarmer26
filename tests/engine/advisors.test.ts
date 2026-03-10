import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateCondition, evaluateEvents } from '../../src/engine/events/selector.ts';
import { createInitialState, processCommand } from '../../src/engine/game.ts';
import { SLICE_1_SCENARIO } from '../../src/data/scenario.ts';
import { STORYLETS } from '../../src/data/events.ts';
import { SeededRNG } from '../../src/engine/rng.ts';
import type { GameState } from '../../src/engine/types.ts';
import type { Storylet } from '../../src/engine/events/types.ts';

// ============================================================================
// Test Helpers
// ============================================================================

function makeState(): GameState {
  return createInitialState('test-player', SLICE_1_SCENARIO);
}

function getStorylet(id: string): Storylet {
  const s = STORYLETS.find(s => s.id === id);
  if (!s) throw new Error(`Storylet not found: ${id}`);
  return s;
}

// ============================================================================
// Advisor Storylet Definitions
// ============================================================================

describe('Advisor storylet definitions', () => {
  it('all 5 advisors exist and have type=advisor', () => {
    const advisorIds = [
      'advisor-soil-nitrogen',
      'advisor-crop-failure',
      'advisor-chill-warning',
      'advisor-drought-recovery',
      'advisor-perennial-opportunity',
    ];

    for (const id of advisorIds) {
      const storylet = getStorylet(id);
      expect(storylet.type).toBe('advisor');
    }
  });

  it('all advisors have maxOccurrences set', () => {
    const advisors = STORYLETS.filter(s => s.type === 'advisor');
    expect(advisors.length).toBe(14);
    for (const a of advisors) {
      expect(a.maxOccurrences).toBeDefined();
      expect(a.maxOccurrences).toBeGreaterThan(0);
    }
  });

  it('critical advisors have priority 100, suggestion advisors have 90', () => {
    expect(getStorylet('advisor-soil-nitrogen').priority).toBe(100);
    expect(getStorylet('advisor-crop-failure').priority).toBe(100);
    expect(getStorylet('advisor-chill-warning').priority).toBe(100);
    expect(getStorylet('advisor-drought-recovery').priority).toBe(90);
    expect(getStorylet('advisor-perennial-opportunity').priority).toBe(90);
  });

  it('all advisors have at least one choice', () => {
    const advisors = STORYLETS.filter(s => s.type === 'advisor');
    for (const a of advisors) {
      expect(a.choices.length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ============================================================================
// advisor-soil-nitrogen conditions
// ============================================================================

describe('advisor-soil-nitrogen', () => {
  let state: GameState;
  let rng: SeededRNG;

  beforeEach(() => {
    state = makeState();
    rng = new SeededRNG(42);
  });

  it('fires when avg nitrogen < 50 and year >= 2', () => {
    state.calendar.year = 3;
    for (const row of state.grid) {
      for (const cell of row) {
        cell.soil.nitrogen = 30;
      }
    }

    const storylet = getStorylet('advisor-soil-nitrogen');
    // Check non-random conditions
    for (const cond of storylet.preconditions.filter(c => c.type !== 'random')) {
      expect(evaluateCondition(cond, state, rng)).toBe(true);
    }
  });

  it('does NOT fire when nitrogen is sufficient', () => {
    state.calendar.year = 3;
    // Default nitrogen is 100 — well above threshold
    const storylet = getStorylet('advisor-soil-nitrogen');
    const avgNCondition = storylet.preconditions.find(c => c.type === 'avg_nitrogen_below');
    expect(avgNCondition).toBeDefined();
    expect(evaluateCondition(avgNCondition!, state, rng)).toBe(false);
  });

  it('does NOT fire in year 1', () => {
    state.calendar.year = 1;
    for (const row of state.grid) {
      for (const cell of row) {
        cell.soil.nitrogen = 30;
      }
    }
    const minYear = getStorylet('advisor-soil-nitrogen').preconditions.find(c => c.type === 'min_year');
    expect(evaluateCondition(minYear!, state, rng)).toBe(false);
  });

  it('#72: acknowledge choice notification mentions fall and cover crops', () => {
    const storylet = getStorylet('advisor-soil-nitrogen');
    const ackChoice = storylet.choices.find(c => c.id === 'acknowledge');
    expect(ackChoice).toBeDefined();
    const notifEffect = ackChoice!.effects.find(e => e.type === 'add_notification');
    expect(notifEffect).toBeDefined();
    const msg = (notifEffect as { message: string }).message;
    expect(msg).toMatch(/fall/i);
    expect(msg).toMatch(/cover crop/i);
  });
});

// ============================================================================
// advisor-crop-failure conditions
// ============================================================================

describe('advisor-crop-failure', () => {
  let state: GameState;
  let rng: SeededRNG;

  beforeEach(() => {
    state = makeState();
    rng = new SeededRNG(42);
  });

  it('fires when consecutive crop failures >= 1', () => {
    state.cropFailureStreak = 1;
    const storylet = getStorylet('advisor-crop-failure');
    const failCond = storylet.preconditions.find(c => c.type === 'consecutive_crop_failures');
    expect(evaluateCondition(failCond!, state, rng)).toBe(true);
  });

  it('does NOT fire with zero failures', () => {
    state.cropFailureStreak = 0;
    const storylet = getStorylet('advisor-crop-failure');
    const failCond = storylet.preconditions.find(c => c.type === 'consecutive_crop_failures');
    expect(evaluateCondition(failCond!, state, rng)).toBe(false);
  });
});

// ============================================================================
// advisor-chill-warning conditions
// ============================================================================

describe('advisor-chill-warning', () => {
  let state: GameState;
  let rng: SeededRNG;

  beforeEach(() => {
    state = makeState();
    rng = new SeededRNG(42);
  });

  it('fires when perennial is planted and year >= 8', () => {
    state.calendar.year = 10;
    state.grid[0][0].crop = {
      cropId: 'almonds', plantedDay: 59, gddAccumulated: 0,
      waterStressDays: 0, growthStage: 'seedling', overripeDaysRemaining: -1,
      isPerennial: true, perennialAge: 0, perennialEstablished: false, isDormant: false,
      harvestedThisSeason: false, chillHoursAccumulated: 0,
    };

    const storylet = getStorylet('advisor-chill-warning');
    for (const cond of storylet.preconditions.filter(c => c.type !== 'random')) {
      expect(evaluateCondition(cond, state, rng)).toBe(true);
    }
  });

  it('does NOT fire before year 8', () => {
    state.calendar.year = 5;
    state.grid[0][0].crop = {
      cropId: 'almonds', plantedDay: 59, gddAccumulated: 0,
      waterStressDays: 0, growthStage: 'seedling', overripeDaysRemaining: -1,
      isPerennial: true, perennialAge: 0, perennialEstablished: false, isDormant: false,
      harvestedThisSeason: false, chillHoursAccumulated: 0,
    };

    const minYear = getStorylet('advisor-chill-warning').preconditions.find(c => c.type === 'min_year');
    expect(evaluateCondition(minYear!, state, rng)).toBe(false);
  });

  it('chill-warning choice includes set_flag for chillHoursRevealed', () => {
    const storylet = getStorylet('advisor-chill-warning');
    const allEffects = storylet.choices.flatMap(c => c.effects);
    const setFlag = allEffects.find(e => e.type === 'set_flag' && 'flag' in e && e.flag === 'chillHoursRevealed');
    expect(setFlag).toBeDefined();
  });
});

// ============================================================================
// advisor-drought-recovery conditions
// ============================================================================

describe('advisor-drought-recovery', () => {
  let state: GameState;
  let rng: SeededRNG;

  beforeEach(() => {
    state = makeState();
    rng = new SeededRNG(42);
  });

  it('fires when cash < 30000 and year >= 4', () => {
    state.calendar.year = 5;
    state.economy.cash = 20000;

    const storylet = getStorylet('advisor-drought-recovery');
    for (const cond of storylet.preconditions.filter(c => c.type !== 'random')) {
      expect(evaluateCondition(cond, state, rng)).toBe(true);
    }
  });

  it('does NOT fire when cash is sufficient', () => {
    state.calendar.year = 5;
    state.economy.cash = 50000;
    const cashCond = getStorylet('advisor-drought-recovery').preconditions.find(c => c.type === 'cash_below');
    expect(evaluateCondition(cashCond!, state, rng)).toBe(false);
  });
});

// ============================================================================
// advisor-perennial-opportunity conditions
// ============================================================================

describe('advisor-perennial-opportunity', () => {
  let state: GameState;
  let rng: SeededRNG;

  beforeEach(() => {
    state = makeState();
    rng = new SeededRNG(42);
  });

  it('fires when cash > 40000, no debt, no perennial planted, year >= 3', () => {
    state.calendar.year = 4;
    state.economy.cash = 50000;
    state.economy.debt = 0;
    // No perennials planted (default)

    const storylet = getStorylet('advisor-perennial-opportunity');
    for (const cond of storylet.preconditions.filter(c => c.type !== 'random')) {
      expect(evaluateCondition(cond, state, rng)).toBe(true);
    }
  });

  it('does NOT fire when perennial is already planted', () => {
    state.calendar.year = 4;
    state.economy.cash = 50000;
    state.economy.debt = 0;
    state.grid[0][0].crop = {
      cropId: 'almonds', plantedDay: 59, gddAccumulated: 0,
      waterStressDays: 0, growthStage: 'seedling', overripeDaysRemaining: -1,
      isPerennial: true, perennialAge: 0, perennialEstablished: false, isDormant: false,
      harvestedThisSeason: false, chillHoursAccumulated: 0,
    };

    const noPeren = getStorylet('advisor-perennial-opportunity').preconditions.find(c => c.type === 'no_perennial_planted');
    expect(evaluateCondition(noPeren!, state, rng)).toBe(false);
  });

  it('does NOT fire when player has debt', () => {
    state.calendar.year = 4;
    state.economy.cash = 50000;
    state.economy.debt = 5000;

    const noDebt = getStorylet('advisor-perennial-opportunity').preconditions.find(c => c.type === 'no_debt');
    expect(evaluateCondition(noDebt!, state, rng)).toBe(false);
  });
});

// ============================================================================
// Cooldown and maxOccurrences
// ============================================================================

describe('Advisor cooldown and maxOccurrences', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
  });

  it('advisor-soil-nitrogen respects cooldown of 365 days', () => {
    const storylet = getStorylet('advisor-soil-nitrogen');
    expect(storylet.cooldownDays).toBe(365);
  });

  it('advisor-chill-warning has maxOccurrences of 2', () => {
    const storylet = getStorylet('advisor-chill-warning');
    expect(storylet.maxOccurrences).toBe(2);
  });

  it('advisor-perennial-opportunity has maxOccurrences of 1', () => {
    const storylet = getStorylet('advisor-perennial-opportunity');
    expect(storylet.maxOccurrences).toBe(1);
  });

  it('advisor does not fire after maxOccurrences reached', () => {
    state.calendar.year = 3;
    for (const row of state.grid) {
      for (const cell of row) {
        cell.soil.nitrogen = 30;
      }
    }

    const storylet = getStorylet('advisor-soil-nitrogen');
    // Log enough occurrences to hit max (3 for soil-nitrogen)
    for (let i = 0; i < storylet.maxOccurrences!; i++) {
      state.eventLog.push({ storyletId: storylet.id, day: i * 400, choiceId: 'some-choice' });
    }

    const rng = new SeededRNG(42);
    const result = evaluateEvents(state, [storylet], rng);
    expect(result.fireEvent).toBeNull();
  });
});

// ============================================================================
// Integration: advisors fire through evaluateEvents
// ============================================================================

describe('Advisor integration with event selector', () => {
  it('advisor with priority 100 fires guaranteed when eligible', () => {
    const state = makeState();
    state.calendar.year = 3;
    for (const row of state.grid) {
      for (const cell of row) {
        cell.soil.nitrogen = 30;
      }
    }

    const soilAdvisor = getStorylet('advisor-soil-nitrogen');
    const rng = new SeededRNG(42);
    const result = evaluateEvents(state, [soilAdvisor], rng);
    expect(result.fireEvent).not.toBeNull();
    expect(result.fireEvent!.id).toBe('advisor-soil-nitrogen');
  });
});
