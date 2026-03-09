import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState, processCommand, simulateTick } from '../../src/engine/game.ts';
import { evaluateCondition, evaluateEvents } from '../../src/engine/events/selector.ts';
import { applyEffects } from '../../src/engine/events/effects.ts';
import { SLICE_1_SCENARIO } from '../../src/data/scenario.ts';
import { STORYLETS } from '../../src/data/events.ts';
import { SeededRNG } from '../../src/engine/rng.ts';
import type { GameState } from '../../src/engine/types.ts';
import type { Storylet, Condition, Effect } from '../../src/engine/events/types.ts';

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

function plantCrop(state: GameState, row: number, col: number, cropId: string): void {
  const result = processCommand(state, {
    type: 'PLANT_CROP', cellRow: row, cellCol: col, cropId,
  }, SLICE_1_SCENARIO);
  if (!result.success) throw new Error(`Plant failed: ${result.reason}`);
}

// ============================================================================
// Storylet Definition Tests
// ============================================================================

describe('Weather Heat Forecast storylet', () => {
  it('exists in STORYLETS with correct properties', () => {
    const heat = STORYLETS.find(s => s.id === 'weather-heat-forecast');
    expect(heat).toBeDefined();
    expect(heat!.type).toBe('advisor');
    expect(heat!.priority).toBe(85);
    expect(heat!.cooldownDays).toBe(180);
    expect(heat!.maxOccurrences).toBe(4);
  });

  it('has correct preconditions', () => {
    const heat = STORYLETS.find(s => s.id === 'weather-heat-forecast')!;
    expect(heat.preconditions).toContainEqual({ type: 'season', season: 'summer' });
    expect(heat.preconditions).toContainEqual({ type: 'min_year', year: 2 });
    expect(heat.preconditions).toContainEqual({ type: 'has_crop' });
    expect(heat.preconditions).toContainEqual({ type: 'random', probability: 0.25 });
  });

  it('has advisorId weather-service', () => {
    const heat = STORYLETS.find(s => s.id === 'weather-heat-forecast')!;
    expect(heat.advisorId).toBe('weather-service');
  });

  it('has two choices: pre-irrigate ($200, +1.5 moisture) and monitor', () => {
    const heat = STORYLETS.find(s => s.id === 'weather-heat-forecast')!;
    expect(heat.choices).toHaveLength(2);

    const irrigate = heat.choices.find(c => c.id === 'pre-irrigate');
    expect(irrigate).toBeDefined();
    expect(irrigate!.effects).toContainEqual({ type: 'modify_cash', amount: -200 });
    expect(irrigate!.effects).toContainEqual({ type: 'modify_moisture_all', amount: 1.5 });

    const monitor = heat.choices.find(c => c.id === 'monitor');
    expect(monitor).toBeDefined();
  });

  it('has no foreshadowing', () => {
    const heat = STORYLETS.find(s => s.id === 'weather-heat-forecast')!;
    expect(heat.foreshadowing).toBeUndefined();
  });

  it('description mentions confidence level', () => {
    const heat = STORYLETS.find(s => s.id === 'weather-heat-forecast')!;
    expect(heat.description).toContain('High confidence');
  });
});

describe('Weather Frost Alert storylet', () => {
  it('exists in STORYLETS with correct properties', () => {
    const frost = STORYLETS.find(s => s.id === 'weather-frost-alert');
    expect(frost).toBeDefined();
    expect(frost!.type).toBe('advisor');
    expect(frost!.priority).toBe(85);
    expect(frost!.cooldownDays).toBe(365);
    expect(frost!.maxOccurrences).toBe(3);
  });

  it('has correct preconditions', () => {
    const frost = STORYLETS.find(s => s.id === 'weather-frost-alert')!;
    expect(frost.preconditions).toContainEqual({ type: 'season', season: 'spring' });
    expect(frost.preconditions).toContainEqual({ type: 'has_crop' });
    expect(frost.preconditions).toContainEqual({ type: 'random', probability: 0.20 });
  });

  it('has advisorId weather-service', () => {
    const frost = STORYLETS.find(s => s.id === 'weather-frost-alert')!;
    expect(frost.advisorId).toBe('weather-service');
  });

  it('has two choices: deploy ($150, frost protection 14 days) and wait', () => {
    const frost = STORYLETS.find(s => s.id === 'weather-frost-alert')!;
    expect(frost.choices).toHaveLength(2);

    const deploy = frost.choices.find(c => c.id === 'deploy-protection');
    expect(deploy).toBeDefined();
    expect(deploy!.effects).toContainEqual({ type: 'modify_cash', amount: -150 });
    const frostEffect = deploy!.effects.find(e => e.type === 'activate_frost_protection');
    expect(frostEffect).toBeDefined();
    if (frostEffect && frostEffect.type === 'activate_frost_protection') {
      expect(frostEffect.durationDays).toBe(14);
    }

    const wait = frost.choices.find(c => c.id === 'wait-and-see');
    expect(wait).toBeDefined();
  });

  it('has no foreshadowing', () => {
    const frost = STORYLETS.find(s => s.id === 'weather-frost-alert')!;
    expect(frost.foreshadowing).toBeUndefined();
  });

  it('description mentions confidence level', () => {
    const frost = STORYLETS.find(s => s.id === 'weather-frost-alert')!;
    expect(frost.description).toContain('Moderate confidence');
  });
});

describe('Weather Drought Outlook storylet', () => {
  it('exists in STORYLETS with correct properties', () => {
    const drought = STORYLETS.find(s => s.id === 'weather-drought-outlook');
    expect(drought).toBeDefined();
    expect(drought!.type).toBe('advisor');
    expect(drought!.priority).toBe(80);
    expect(drought!.cooldownDays).toBe(730);
    expect(drought!.maxOccurrences).toBe(2);
  });

  it('has correct preconditions', () => {
    const drought = STORYLETS.find(s => s.id === 'weather-drought-outlook')!;
    expect(drought.preconditions).toContainEqual({ type: 'min_year', year: 5 });
    expect(drought.preconditions).toContainEqual({ type: 'season', season: 'spring' });
    expect(drought.preconditions).toContainEqual({ type: 'random', probability: 0.15 });
  });

  it('has advisorId weather-service', () => {
    const drought = STORYLETS.find(s => s.id === 'weather-drought-outlook')!;
    expect(drought.advisorId).toBe('weather-service');
  });

  it('has two informational choices', () => {
    const drought = STORYLETS.find(s => s.id === 'weather-drought-outlook')!;
    expect(drought.choices).toHaveLength(2);

    const plan = drought.choices.find(c => c.id === 'plan-for-drought');
    expect(plan).toBeDefined();

    const uncertain = drought.choices.find(c => c.id === 'too-uncertain');
    expect(uncertain).toBeDefined();
  });

  it('description mentions confidence level', () => {
    const drought = STORYLETS.find(s => s.id === 'weather-drought-outlook')!;
    expect(drought.description).toContain('Low confidence');
  });
});

// ============================================================================
// Frost Protection Effect Type
// ============================================================================

describe('activate_frost_protection effect', () => {
  it('sets frostProtectionEndsDay correctly', () => {
    const state = makeState();
    expect(state.frostProtectionEndsDay).toBe(0);

    applyEffects(state, [
      { type: 'activate_frost_protection', durationDays: 14 },
    ], 'weather-frost-alert');

    expect(state.frostProtectionEndsDay).toBe(state.calendar.totalDay + 14);
  });

  it('overlapping activations use max', () => {
    const state = makeState();
    // First activation: 14 days
    applyEffects(state, [
      { type: 'activate_frost_protection', durationDays: 14 },
    ], 'weather-frost-alert');
    const first = state.frostProtectionEndsDay;

    // Second activation shorter (already covered): should keep first
    applyEffects(state, [
      { type: 'activate_frost_protection', durationDays: 5 },
    ], 'weather-frost-alert');
    expect(state.frostProtectionEndsDay).toBe(first);

    // Third activation longer: should extend
    applyEffects(state, [
      { type: 'activate_frost_protection', durationDays: 30 },
    ], 'weather-frost-alert');
    expect(state.frostProtectionEndsDay).toBe(state.calendar.totalDay + 30);
  });
});

// ============================================================================
// Frost Protection Interaction with Late Frost Warning
// ============================================================================

describe('Frost protection interaction with late-frost-warning', () => {
  it('accept-risk WITH active protection: yield multiplier 0.85 (not 0.70), protection consumed', () => {
    const state = makeState();
    // Plant something so the event is valid
    plantCrop(state, 0, 0, 'silage-corn');
    // Activate frost protection
    state.frostProtectionEndsDay = state.calendar.totalDay + 14;

    // Set up the late-frost-warning as active event
    const frostWarning = STORYLETS.find(s => s.id === 'late-frost-warning')!;
    state.activeEvent = {
      storyletId: 'late-frost-warning',
      title: frostWarning.title,
      description: frostWarning.description,
      choices: frostWarning.choices,
      firedOnDay: state.calendar.totalDay,
    };

    const result = processCommand(state, {
      type: 'RESPOND_EVENT',
      eventId: 'late-frost-warning',
      choiceId: 'accept-risk',
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(true);
    // Protection consumed
    expect(state.frostProtectionEndsDay).toBe(0);
    // Should have yield modifier with 0.85 multiplier (not 0.70)
    const yieldEffect = state.activeEffects.find(
      e => e.effectType === 'yield_modifier' && e.sourceEventId === 'late-frost-warning',
    );
    expect(yieldEffect).toBeDefined();
    expect(yieldEffect!.multiplier).toBe(0.85);
    // Notification should mention "15% instead of 30%", not "30%"
    const notifications = state.notifications.map(n => n.message);
    expect(notifications.some(m => m.includes('15%'))).toBe(true);
    expect(notifications.some(m => m === 'Frost damaged some crops. Yield reduced by 30%.')).toBe(false);
  });

  it('accept-risk WITHOUT protection: yield multiplier 0.70, protection unchanged', () => {
    const state = makeState();
    plantCrop(state, 0, 0, 'silage-corn');
    // No frost protection active
    expect(state.frostProtectionEndsDay).toBe(0);

    const frostWarning = STORYLETS.find(s => s.id === 'late-frost-warning')!;
    state.activeEvent = {
      storyletId: 'late-frost-warning',
      title: frostWarning.title,
      description: frostWarning.description,
      choices: frostWarning.choices,
      firedOnDay: state.calendar.totalDay,
    };

    processCommand(state, {
      type: 'RESPOND_EVENT',
      eventId: 'late-frost-warning',
      choiceId: 'accept-risk',
    }, SLICE_1_SCENARIO);

    expect(state.frostProtectionEndsDay).toBe(0);
    const yieldEffect = state.activeEffects.find(
      e => e.effectType === 'yield_modifier' && e.sourceEventId === 'late-frost-warning',
    );
    expect(yieldEffect).toBeDefined();
    expect(yieldEffect!.multiplier).toBe(0.70);
  });

  it('frost-protection choice ($300) with weather protection active: protection NOT consumed', () => {
    const state = makeState();
    plantCrop(state, 0, 0, 'silage-corn');
    const protectionEnd = state.calendar.totalDay + 14;
    state.frostProtectionEndsDay = protectionEnd;

    const frostWarning = STORYLETS.find(s => s.id === 'late-frost-warning')!;
    state.activeEvent = {
      storyletId: 'late-frost-warning',
      title: frostWarning.title,
      description: frostWarning.description,
      choices: frostWarning.choices,
      firedOnDay: state.calendar.totalDay,
    };

    processCommand(state, {
      type: 'RESPOND_EVENT',
      eventId: 'late-frost-warning',
      choiceId: 'frost-protection',
    }, SLICE_1_SCENARIO);

    // Weather protection remains active (student paid $300 for full protection separately)
    expect(state.frostProtectionEndsDay).toBe(protectionEnd);
    // No yield modifier (full protection applied)
    const yieldEffect = state.activeEffects.find(
      e => e.effectType === 'yield_modifier' && e.sourceEventId === 'late-frost-warning',
    );
    expect(yieldEffect).toBeUndefined();
  });

  it('frost protection expires naturally after duration', () => {
    const state = makeState();
    // Activate 14-day protection
    state.frostProtectionEndsDay = state.calendar.totalDay + 14;

    // Advance 15 ticks (past expiry)
    advanceTicks(state, 15);

    // Protection is inactive (totalDay >= frostProtectionEndsDay)
    expect(state.calendar.totalDay >= state.frostProtectionEndsDay).toBe(true);
  });

  it('non-frost event does not consume frost protection', () => {
    const state = makeState();
    plantCrop(state, 0, 0, 'silage-corn');
    const protectionEnd = state.calendar.totalDay + 14;
    state.frostProtectionEndsDay = protectionEnd;

    // Respond to heatwave (not frost)
    const heatwave = STORYLETS.find(s => s.id === 'heatwave-advisory')!;
    state.activeEvent = {
      storyletId: 'heatwave-advisory',
      title: heatwave.title,
      description: heatwave.description,
      choices: heatwave.choices,
      firedOnDay: state.calendar.totalDay,
    };

    processCommand(state, {
      type: 'RESPOND_EVENT',
      eventId: 'heatwave-advisory',
      choiceId: 'wait-it-out',
    }, SLICE_1_SCENARIO);

    // Protection untouched
    expect(state.frostProtectionEndsDay).toBe(protectionEnd);
  });
});

// ============================================================================
// Pre-irrigate effect (weather-heat-forecast)
// ============================================================================

describe('Weather heat forecast pre-irrigate effect', () => {
  it('pre-irrigate adds $200 cost and +1.5 moisture to all cells', () => {
    const state = makeState();
    plantCrop(state, 0, 0, 'silage-corn');
    const cashBefore = state.economy.cash;
    const moistureBefore = state.grid[3][3].soil.moisture;

    const heat = STORYLETS.find(s => s.id === 'weather-heat-forecast')!;
    state.activeEvent = {
      storyletId: 'weather-heat-forecast',
      title: heat.title,
      description: heat.description,
      choices: heat.choices,
      firedOnDay: state.calendar.totalDay,
    };

    processCommand(state, {
      type: 'RESPOND_EVENT',
      eventId: 'weather-heat-forecast',
      choiceId: 'pre-irrigate',
    }, SLICE_1_SCENARIO);

    expect(state.economy.cash).toBe(cashBefore - 200);
    expect(state.grid[3][3].soil.moisture).toBeCloseTo(moistureBefore + 1.5);
  });
});

// ============================================================================
// Advisor character routing
// ============================================================================

describe('Advisor character routing via advisorId', () => {
  it('Dr. Santos advisors have advisorId extension-agent', () => {
    const santosIds = [
      'advisor-orchard-decline', 'advisor-soil-nitrogen', 'advisor-crop-failure',
      'advisor-chill-warning', 'advisor-drought-recovery', 'advisor-perennial-opportunity',
    ];
    for (const id of santosIds) {
      const s = STORYLETS.find(st => st.id === id)!;
      expect(s.advisorId).toBe('extension-agent');
    }
  });

  it('Marcus Chen advisor has advisorId farm-credit', () => {
    const chen = STORYLETS.find(s => s.id === 'advisor-chen-intro')!;
    expect(chen.advisorId).toBe('farm-credit');
  });

  it('Growers Forum advisor has advisorId growers-forum', () => {
    const forum = STORYLETS.find(s => s.id === 'advisor-forum-intro')!;
    expect(forum.advisorId).toBe('growers-forum');
  });

  it('Weather Service advisors have advisorId weather-service', () => {
    const weather = STORYLETS.filter(s => s.id.startsWith('weather-'));
    expect(weather.length).toBe(3);
    for (const s of weather) {
      expect(s.advisorId).toBe('weather-service');
    }
  });
});

// ============================================================================
// Determinism regression
// ============================================================================

describe('Slice 3c determinism', () => {
  it('same seed + same commands = identical state after 100 ticks with frost protection', () => {
    const state1 = makeState();
    const state2 = makeState();

    // Plant corn on both
    plantCrop(state1, 0, 0, 'silage-corn');
    plantCrop(state2, 0, 0, 'silage-corn');

    // Activate frost protection on both
    state1.frostProtectionEndsDay = state1.calendar.totalDay + 14;
    state2.frostProtectionEndsDay = state2.calendar.totalDay + 14;

    advanceTicks(state1, 100);
    advanceTicks(state2, 100);

    expect(state1.calendar.totalDay).toBe(state2.calendar.totalDay);
    expect(state1.economy.cash).toBe(state2.economy.cash);
    expect(state1.rngState).toBe(state2.rngState);
    expect(state1.eventRngState).toBe(state2.eventRngState);
    expect(state1.frostProtectionEndsDay).toBe(state2.frostProtectionEndsDay);
  });
});

// ============================================================================
// Behavior-level tests (selector integration, cooldown, maxOccurrences)
// ============================================================================

describe('Weather advisor selector behavior', () => {
  it('weather-heat-forecast fires under correct conditions via evaluateEvents', () => {
    const state = makeState();
    plantCrop(state, 0, 0, 'silage-corn');
    // Set to summer, year 2
    state.calendar.season = 'summer';
    state.calendar.year = 2;

    // Run evaluateEvents many times — eventually it should fire (random 0.25)
    const rng = new SeededRNG(42);
    let fired = false;
    for (let i = 0; i < 50; i++) {
      const result = evaluateEvents(state, STORYLETS, rng);
      if (result.fireEvent?.id === 'weather-heat-forecast') {
        fired = true;
        break;
      }
    }
    expect(fired).toBe(true);
  });

  it('weather-heat-forecast respects cooldown (180 days)', () => {
    const state = makeState();
    plantCrop(state, 0, 0, 'silage-corn');
    state.calendar.season = 'summer';
    state.calendar.year = 2;
    // Log a recent occurrence
    state.eventLog.push({
      storyletId: 'weather-heat-forecast',
      day: state.calendar.totalDay - 10, // 10 days ago (within 180-day cooldown)
      choiceId: 'pre-irrigate',
    });

    const rng = new SeededRNG(42);
    let fired = false;
    for (let i = 0; i < 50; i++) {
      const result = evaluateEvents(state, STORYLETS, rng);
      if (result.fireEvent?.id === 'weather-heat-forecast') {
        fired = true;
        break;
      }
    }
    expect(fired).toBe(false);
  });

  it('weather-heat-forecast respects maxOccurrences (4)', () => {
    const state = makeState();
    plantCrop(state, 0, 0, 'silage-corn');
    state.calendar.season = 'summer';
    state.calendar.year = 2;
    // Log 4 past occurrences (all outside cooldown)
    for (let i = 0; i < 4; i++) {
      state.eventLog.push({
        storyletId: 'weather-heat-forecast',
        day: state.calendar.totalDay - 1000 - (i * 200),
        choiceId: 'pre-irrigate',
      });
    }

    const rng = new SeededRNG(42);
    let fired = false;
    for (let i = 0; i < 50; i++) {
      const result = evaluateEvents(state, STORYLETS, rng);
      if (result.fireEvent?.id === 'weather-heat-forecast') {
        fired = true;
        break;
      }
    }
    expect(fired).toBe(false);
  });

  it('weather-frost-alert does NOT fire in summer', () => {
    const state = makeState();
    plantCrop(state, 0, 0, 'silage-corn');
    state.calendar.season = 'summer';
    state.calendar.year = 2;

    const rng = new SeededRNG(42);
    let fired = false;
    for (let i = 0; i < 50; i++) {
      const result = evaluateEvents(state, STORYLETS, rng);
      if (result.fireEvent?.id === 'weather-frost-alert') {
        fired = true;
        break;
      }
    }
    expect(fired).toBe(false);
  });

  it('weather-drought-outlook does NOT fire before year 5', () => {
    const state = makeState();
    state.calendar.season = 'spring';
    state.calendar.year = 3;

    const rng = new SeededRNG(42);
    let fired = false;
    for (let i = 0; i < 50; i++) {
      const result = evaluateEvents(state, STORYLETS, rng);
      if (result.fireEvent?.id === 'weather-drought-outlook') {
        fired = true;
        break;
      }
    }
    expect(fired).toBe(false);
  });

  it('frost protection status: active when totalDay < frostProtectionEndsDay', () => {
    const state = makeState();
    state.frostProtectionEndsDay = state.calendar.totalDay + 10;
    expect(state.calendar.totalDay < state.frostProtectionEndsDay).toBe(true);

    // Advance past expiry
    advanceTicks(state, 11);
    expect(state.calendar.totalDay < state.frostProtectionEndsDay).toBe(false);
  });
});
