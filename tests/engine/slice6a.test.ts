import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateCondition } from '../../src/engine/events/selector.ts';
import { applyEffects } from '../../src/engine/events/effects.ts';
import { createInitialState, processCommand, harvestCell, getAvailableCrops } from '../../src/engine/game.ts';
import { SLICE_1_SCENARIO } from '../../src/data/scenario.ts';
import { STORYLETS } from '../../src/data/events.ts';
import { getCropDefinition } from '../../src/data/crops.ts';
import { SeededRNG } from '../../src/engine/rng.ts';
import type { GameState, Cell } from '../../src/engine/types.ts';
import { GRID_ROWS, GRID_COLS, K_SYMPTOM_THRESHOLD } from '../../src/engine/types.ts';
import type { Condition, Effect, Storylet } from '../../src/engine/events/types.ts';

// ============================================================================
// Test Helpers
// ============================================================================

function makeState(): GameState {
  return createInitialState('test-6a', SLICE_1_SCENARIO);
}

function plantAndMature(state: GameState, row: number, col: number, cropId: string): void {
  const cropDef = getCropDefinition(cropId);
  processCommand(state, { type: 'PLANT_CROP', cellRow: row, cellCol: col, cropId }, SLICE_1_SCENARIO);
  const crop = state.grid[row][col].crop!;
  crop.gddAccumulated = cropDef.gddToMaturity;
  crop.growthStage = 'harvestable';
  crop.waterStressDays = 0;
  if (crop.isPerennial) {
    crop.perennialEstablished = true;
  }
}

function setAllPotassium(state: GameState, value: number): void {
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      state.grid[r][c].soil.potassium = value;
    }
  }
}

function avgPotassium(state: GameState): number {
  let total = 0;
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      total += state.grid[r][c].soil.potassium;
    }
  }
  return total / (GRID_ROWS * GRID_COLS);
}

// ============================================================================
// §1: modify_potassium_all effect
// ============================================================================

describe('Slice 6a: modify_potassium_all effect', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
  });

  it('raises potassium across all cells', () => {
    setAllPotassium(state, 80);
    const effects: Effect[] = [{ type: 'modify_potassium_all', amount: 50 }];
    applyEffects(state, effects, 'test');
    expect(avgPotassium(state)).toBe(130);
  });

  it('caps potassium at 200', () => {
    setAllPotassium(state, 180);
    const effects: Effect[] = [{ type: 'modify_potassium_all', amount: 50 }];
    applyEffects(state, effects, 'test');
    expect(state.grid[0][0].soil.potassium).toBe(200);
  });

  it('floors potassium at 0', () => {
    setAllPotassium(state, 20);
    const effects: Effect[] = [{ type: 'modify_potassium_all', amount: -50 }];
    applyEffects(state, effects, 'test');
    expect(state.grid[0][0].soil.potassium).toBe(0);
  });
});

// ============================================================================
// §2: avg_potassium_below condition
// ============================================================================

describe('Slice 6a: avg_potassium_below condition', () => {
  let state: GameState;
  let rng: SeededRNG;

  beforeEach(() => {
    state = makeState();
    rng = new SeededRNG(42);
  });

  it('returns true when average K is below threshold', () => {
    setAllPotassium(state, 80);
    const cond: Condition = { type: 'avg_potassium_below', level: 100 };
    expect(evaluateCondition(cond, state, rng)).toBe(true);
  });

  it('returns false when average K is at or above threshold', () => {
    setAllPotassium(state, 120);
    const cond: Condition = { type: 'avg_potassium_below', level: 100 };
    expect(evaluateCondition(cond, state, rng)).toBe(false);
  });

  it('returns false when average K exactly equals threshold', () => {
    setAllPotassium(state, 100);
    const cond: Condition = { type: 'avg_potassium_below', level: 100 };
    expect(evaluateCondition(cond, state, rng)).toBe(false);
  });
});

// ============================================================================
// §3: K fertilizer advisor storylet data validation
// ============================================================================

describe('Slice 6a: K fertilizer advisor storylet', () => {
  it('exists in STORYLETS with correct id', () => {
    const storylet = STORYLETS.find(s => s.id === 'advisor-potassium-management');
    expect(storylet).toBeDefined();
  });

  it('has avg_potassium_below precondition', () => {
    const storylet = STORYLETS.find(s => s.id === 'advisor-potassium-management')!;
    const kCond = storylet.preconditions.find(c => c.type === 'avg_potassium_below');
    expect(kCond).toBeDefined();
  });

  it('has min_year precondition', () => {
    const storylet = STORYLETS.find(s => s.id === 'advisor-potassium-management')!;
    const yearCond = storylet.preconditions.find(c => c.type === 'min_year');
    expect(yearCond).toBeDefined();
  });

  it('fires when avg K < 100 and Y5+', () => {
    const state = makeState();
    const rng = new SeededRNG(42);
    setAllPotassium(state, 80);
    state.calendar = { ...state.calendar, year: 5 };

    const storylet = STORYLETS.find(s => s.id === 'advisor-potassium-management')!;
    const allPass = storylet.preconditions.every(c => evaluateCondition(c, state, rng));
    expect(allPass).toBe(true);
  });

  it('does not fire when avg K >= 100', () => {
    const state = makeState();
    const rng = new SeededRNG(42);
    setAllPotassium(state, 120);
    state.calendar = { ...state.calendar, year: 5 };

    const storylet = STORYLETS.find(s => s.id === 'advisor-potassium-management')!;
    const allPass = storylet.preconditions.every(c => evaluateCondition(c, state, rng));
    expect(allPass).toBe(false);
  });

  it('has apply-potash choice with modify_potassium_all effect', () => {
    const storylet = STORYLETS.find(s => s.id === 'advisor-potassium-management')!;
    const choice = storylet.choices.find(c => c.id === 'apply-potash');
    expect(choice).toBeDefined();
    const kEffect = choice!.effects.find(e => e.type === 'modify_potassium_all');
    expect(kEffect).toBeDefined();
  });

  it('has followUpText on choices', () => {
    const storylet = STORYLETS.find(s => s.id === 'advisor-potassium-management')!;
    for (const choice of storylet.choices) {
      expect(choice.followUpText).toBeDefined();
      expect(choice.followUpText!.length).toBeGreaterThan(10);
    }
  });
});

// ============================================================================
// §4: Enhanced K harvest notification — mild range (0.85–0.99)
// ============================================================================

describe('Slice 6a: K harvest notification enhancement', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
    // Plant corn, which has potassiumUptake: 100
    plantAndMature(state, 0, 0, 'silage-corn');
  });

  it('shows mild K notification when kFactor is 0.85-0.99', () => {
    const cell = state.grid[0][0];
    const cropDef = getCropDefinition('silage-corn');
    // Set K so kFactor = 90/100 = 0.90 (in 0.85-0.99 range)
    cell.soil.potassium = cropDef.potassiumUptake * 0.90;

    const prevCount = state.notifications.length;
    harvestCell(state, cell);

    // Should have harvest notification + mild K notification
    const kNotifs = state.notifications.filter(n =>
      n.day >= state.calendar.totalDay - 1 && n.message.toLowerCase().includes('price reduced')
    );
    expect(kNotifs.length).toBeGreaterThan(0);
  });

  it('still shows severe K warning when kFactor < 0.85', () => {
    const cell = state.grid[0][0];
    // Set K very low so kFactor < 0.85
    cell.soil.potassium = 50;

    harvestCell(state, cell);

    // Should have the existing warning (unchanged behavior)
    const kNotifs = state.notifications.filter(n =>
      n.message.toLowerCase().includes('quality') || n.message.toLowerCase().includes('potassium') || n.message.toLowerCase().includes('nutrient')
    );
    expect(kNotifs.length).toBeGreaterThan(0);
  });

  it('does not show K notification when kFactor = 1.0', () => {
    const cell = state.grid[0][0];
    const cropDef = getCropDefinition('silage-corn');
    // Set K high so kFactor = 1.0
    cell.soil.potassium = cropDef.potassiumUptake * 2;

    const prevNotifCount = state.notifications.length;
    harvestCell(state, cell);

    // Only the harvest notification, no K notification
    const kNotifs = state.notifications.filter(n =>
      n.day >= state.calendar.totalDay - 1 &&
      (n.message.toLowerCase().includes('price reduced') || n.message.toLowerCase().includes('nutrient deficiency'))
    );
    expect(kNotifs.length).toBe(0);
  });
});

// ============================================================================
// §5: processRespondEvent with followUpText (engine doesn't care — UI-only)
// ============================================================================

describe('Slice 6a: processRespondEvent with followUpText', () => {
  it('succeeds with choice that has followUpText (engine ignores it)', () => {
    const state = makeState();

    // Set up an active event with a choice that has followUpText
    state.activeEvent = {
      storyletId: 'advisor-potassium-management',
      title: 'Test',
      description: 'Test',
      choices: [
        {
          id: 'apply-potash',
          label: 'Apply Potash',
          description: 'Apply it',
          cost: 500,
          requiresCash: 500,
          followUpText: 'This is educational follow-up text',
          effects: [
            { type: 'modify_cash', amount: -500 },
            { type: 'modify_potassium_all', amount: 80 },
          ],
        },
      ],
      firedOnDay: state.calendar.totalDay,
    };

    const result = processCommand(state, {
      type: 'RESPOND_EVENT',
      eventId: 'advisor-potassium-management',
      choiceId: 'apply-potash',
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(true);
    expect(state.activeEvent).toBeNull();
  });
});

// ============================================================================
// §6: requiresFlag enforcement in processRespondEvent
// ============================================================================

describe('Slice 6a: requiresFlag enforcement', () => {
  it('rejects choice when required flag is missing', () => {
    const state = makeState();

    state.activeEvent = {
      storyletId: 'test-requiresFlag',
      title: 'Test',
      description: 'Test',
      choices: [
        {
          id: 'flag-gated',
          label: 'Needs Flag',
          description: 'Requires a specific flag',
          requiresFlag: 'has_crop_insurance',
          effects: [
            { type: 'modify_cash', amount: -200 },
          ],
        },
      ],
      firedOnDay: state.calendar.totalDay,
    };

    // Flag not set — should be rejected
    const result = processCommand(state, {
      type: 'RESPOND_EVENT',
      eventId: 'test-requiresFlag',
      choiceId: 'flag-gated',
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(false);
    expect(result.reason).toContain('required');
  });

  it('allows choice when required flag is present', () => {
    const state = makeState();
    state.flags['has_crop_insurance'] = true;

    state.activeEvent = {
      storyletId: 'test-requiresFlag',
      title: 'Test',
      description: 'Test',
      choices: [
        {
          id: 'flag-gated',
          label: 'Needs Flag',
          description: 'Requires a specific flag',
          requiresFlag: 'has_crop_insurance',
          effects: [
            { type: 'modify_cash', amount: -200 },
          ],
        },
      ],
      firedOnDay: state.calendar.totalDay,
    };

    const result = processCommand(state, {
      type: 'RESPOND_EVENT',
      eventId: 'test-requiresFlag',
      choiceId: 'flag-gated',
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(true);
  });

  it('allows choice without requiresFlag regardless of flags', () => {
    const state = makeState();

    state.activeEvent = {
      storyletId: 'test-no-flag',
      title: 'Test',
      description: 'Test',
      choices: [
        {
          id: 'normal-choice',
          label: 'Normal',
          description: 'No flag needed',
          effects: [],
        },
      ],
      firedOnDay: state.calendar.totalDay,
    };

    const result = processCommand(state, {
      type: 'RESPOND_EVENT',
      eventId: 'test-no-flag',
      choiceId: 'normal-choice',
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(true);
  });
});

// ============================================================================
// §7: K fertilizer choice applies potash
// ============================================================================

describe('Slice 6a: K fertilizer choice effects', () => {
  it('apply-potash choice raises potassium across all cells', () => {
    const state = makeState();
    setAllPotassium(state, 70);

    const storylet = STORYLETS.find(s => s.id === 'advisor-potassium-management')!;
    const choice = storylet.choices.find(c => c.id === 'apply-potash')!;

    applyEffects(state, choice.effects, 'advisor-potassium-management');

    // Should have raised K (exact amount depends on content, but should be significantly higher)
    expect(avgPotassium(state)).toBeGreaterThan(70);
  });
});

// ============================================================================
// §8: followUpText on existing advisors
// ============================================================================

describe('Slice 6a: followUpText on existing advisors', () => {
  const advisorsWithFollowUp = [
    { id: 'advisor-soil-nitrogen', choiceIds: ['buy-fertilizer', 'acknowledge'] },
    { id: 'advisor-crop-failure', choiceIds: ['diversify-advice'] },
    { id: 'advisor-chill-warning', choiceIds: ['review-chill-data'] },
    { id: 'advisor-drought-recovery', choiceIds: ['cost-cutting'] },
    { id: 'advisor-perennial-opportunity', choiceIds: ['learn-perennials'] },
  ];

  for (const { id, choiceIds } of advisorsWithFollowUp) {
    for (const choiceId of choiceIds) {
      it(`${id} > ${choiceId} has followUpText`, () => {
        const storylet = STORYLETS.find(s => s.id === id);
        expect(storylet).toBeDefined();
        const choice = storylet!.choices.find(c => c.id === choiceId);
        expect(choice).toBeDefined();
        expect(choice!.followUpText).toBeDefined();
        expect(choice!.followUpText!.length).toBeGreaterThan(20);
      });
    }
  }
});

// ============================================================================
// §9: Empty field guidance fires on harvest when nothing is plantable
// ============================================================================

describe('Slice 6a: Empty field guidance', () => {
  it('fires after annual harvest when no crops are plantable', () => {
    const state = makeState();
    // Plant corn while in planting window (default state is spring/March)
    plantAndMature(state, 0, 0, 'silage-corn');
    // Advance to summer (month 7) — no crops have planting windows open
    state.calendar = { ...state.calendar, month: 7, season: 'summer' };

    harvestCell(state, state.grid[0][0]);

    expect(state.flags['empty_field_guidance_shown']).toBe(true);
    const guidance = state.notifications.find(n =>
      n.message.includes('Nothing is in season for planting')
    );
    expect(guidance).toBeDefined();
  });

  it('does not fire when flag already set', () => {
    const state = makeState();
    plantAndMature(state, 0, 0, 'silage-corn');
    state.calendar = { ...state.calendar, month: 7, season: 'summer' };
    state.flags['empty_field_guidance_shown'] = true;

    harvestCell(state, state.grid[0][0]);

    const guidance = state.notifications.filter(n =>
      n.message.includes('Nothing is in season for planting')
    );
    expect(guidance.length).toBe(0);
  });

  it('does not fire when crops are still plantable', () => {
    const state = makeState();
    // March (month 3) — corn, tomatoes, sorghum are plantable
    plantAndMature(state, 0, 0, 'silage-corn');

    harvestCell(state, state.grid[0][0]);

    expect(state.flags['empty_field_guidance_shown']).not.toBe(true);
  });

  it('does not fire on silent harvest (bot/balance runs)', () => {
    const state = makeState();
    plantAndMature(state, 0, 0, 'silage-corn');
    state.calendar = { ...state.calendar, month: 7, season: 'summer' };

    harvestCell(state, state.grid[0][0], true); // silent = true

    expect(state.flags['empty_field_guidance_shown']).not.toBe(true);
  });

  it('fires after bulk harvest when no crops are plantable', () => {
    const state = makeState();
    // Plant corn in two cells
    plantAndMature(state, 0, 0, 'silage-corn');
    plantAndMature(state, 0, 1, 'silage-corn');
    // Advance to summer — nothing plantable
    state.calendar = { ...state.calendar, month: 7, season: 'summer' };

    processCommand(state, { type: 'HARVEST_BULK', scope: 'all' }, SLICE_1_SCENARIO);

    expect(state.flags['empty_field_guidance_shown']).toBe(true);
    const guidance = state.notifications.find(n =>
      n.message.includes('Nothing is in season for planting')
    );
    expect(guidance).toBeDefined();
  });

  it('does not fire after bulk harvest when crops are still plantable', () => {
    const state = makeState();
    // March — corn, tomatoes, sorghum are plantable
    plantAndMature(state, 0, 0, 'silage-corn');

    processCommand(state, { type: 'HARVEST_BULK', scope: 'all' }, SLICE_1_SCENARIO);

    expect(state.flags['empty_field_guidance_shown']).not.toBe(true);
  });
});

// ============================================================================
// §10: Advisor intro choices use followUpText for "tell me more" paths
// ============================================================================

describe('Slice 6a: Advisor intro follow-up text', () => {
  it('chen-intro welcome-review has followUpText', () => {
    const chen = STORYLETS.find(s => s.id === 'advisor-chen-intro')!;
    const welcomeReview = chen.choices.find(c => c.id === 'welcome-review')!;
    expect(welcomeReview.followUpText).toBeDefined();
    expect(welcomeReview.followUpText!.length).toBeGreaterThan(0);
  });

  it('chen-intro polite-decline has no followUpText', () => {
    const chen = STORYLETS.find(s => s.id === 'advisor-chen-intro')!;
    const decline = chen.choices.find(c => c.id === 'polite-decline')!;
    expect(decline.followUpText).toBeUndefined();
  });

  it('forum-intro attend-meeting has followUpText', () => {
    const forum = STORYLETS.find(s => s.id === 'advisor-forum-intro')!;
    const attend = forum.choices.find(c => c.id === 'attend-meeting')!;
    expect(attend.followUpText).toBeDefined();
    expect(attend.followUpText!.length).toBeGreaterThan(0);
  });

  it('forum-intro just-listen has no followUpText', () => {
    const forum = STORYLETS.find(s => s.id === 'advisor-forum-intro')!;
    const listen = forum.choices.find(c => c.id === 'just-listen')!;
    expect(listen.followUpText).toBeUndefined();
  });
});

// §11: pendingFollowUp lifecycle cleanup — tested in browser tests
// (adapter signals require localStorage/DOM environment)
