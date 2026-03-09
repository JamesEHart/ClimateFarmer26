import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateCondition, evaluateEvents } from '../../src/engine/events/selector.ts';
import { createInitialState, simulateTick, processCommand } from '../../src/engine/game.ts';
import { applyEffects } from '../../src/engine/events/effects.ts';
import { SLICE_1_SCENARIO } from '../../src/data/scenario.ts';
import { STORYLETS } from '../../src/data/events.ts';
import { getTechLevel } from '../../src/engine/tech-levels.ts';
import { SeededRNG } from '../../src/engine/rng.ts';
import type { GameState } from '../../src/engine/types.ts';
import { IRRIGATION_COST_PER_CELL, AUTO_IRRIGATION_COST_MULTIPLIERS } from '../../src/engine/types.ts';
import type { Storylet } from '../../src/engine/events/types.ts';

// ============================================================================
// Test Helpers
// ============================================================================

function makeState(): GameState {
  return createInitialState('test-5b', SLICE_1_SCENARIO);
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

// ============================================================================
// §1: Chen Introduction Event
// ============================================================================

describe('Slice 5b: advisor-chen-intro', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
  });

  it('exists with correct metadata', () => {
    const storylet = getStorylet('advisor-chen-intro');
    expect(storylet.type).toBe('advisor');
    expect(storylet.advisorId).toBe('farm-credit');
    expect(storylet.maxOccurrences).toBe(1);
    expect(storylet.priority).toBe(95);
  });

  it('fires when year >= 2 and met_chen not set', () => {
    state.calendar.year = 2;
    expect(evaluateNonRandomConditions(getStorylet('advisor-chen-intro'), state)).toBe(true);
  });

  it('does NOT fire in year 1', () => {
    state.calendar.year = 1;
    expect(evaluateNonRandomConditions(getStorylet('advisor-chen-intro'), state)).toBe(false);
  });

  it('does NOT fire if met_chen is already set', () => {
    state.calendar.year = 2;
    state.flags['met_chen'] = true;
    expect(evaluateNonRandomConditions(getStorylet('advisor-chen-intro'), state)).toBe(false);
  });

  it('does NOT require has_crop (fires with empty grid)', () => {
    state.calendar.year = 2;
    // Default state has no crops planted — should still pass
    expect(evaluateNonRandomConditions(getStorylet('advisor-chen-intro'), state)).toBe(true);
  });

  it('both choices set met_chen flag', () => {
    const storylet = getStorylet('advisor-chen-intro');
    for (const choice of storylet.choices) {
      const testState = makeState();
      applyEffects(testState, choice.effects);
      expect(testState.flags['met_chen']).toBe(true);
    }
  });

  it('is condition-only (no random precondition)', () => {
    const storylet = getStorylet('advisor-chen-intro');
    const hasRandom = storylet.preconditions.some(c => c.type === 'random');
    expect(hasRandom).toBe(false);
  });
});

// ============================================================================
// §2: Forum Introduction Event
// ============================================================================

describe('Slice 5b: advisor-forum-intro', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
  });

  it('exists with correct metadata', () => {
    const storylet = getStorylet('advisor-forum-intro');
    expect(storylet.type).toBe('advisor');
    expect(storylet.advisorId).toBe('growers-forum');
    expect(storylet.maxOccurrences).toBe(1);
    expect(storylet.priority).toBe(90);
  });

  it('fires when year >= 2 and met_forum not set', () => {
    state.calendar.year = 2;
    expect(evaluateNonRandomConditions(getStorylet('advisor-forum-intro'), state)).toBe(true);
  });

  it('does NOT fire in year 1', () => {
    state.calendar.year = 1;
    expect(evaluateNonRandomConditions(getStorylet('advisor-forum-intro'), state)).toBe(false);
  });

  it('does NOT fire if met_forum is already set', () => {
    state.calendar.year = 2;
    state.flags['met_forum'] = true;
    expect(evaluateNonRandomConditions(getStorylet('advisor-forum-intro'), state)).toBe(false);
  });

  it('does NOT require has_crop (fires with empty grid)', () => {
    state.calendar.year = 2;
    expect(evaluateNonRandomConditions(getStorylet('advisor-forum-intro'), state)).toBe(true);
  });

  it('both choices set met_forum flag', () => {
    const storylet = getStorylet('advisor-forum-intro');
    for (const choice of storylet.choices) {
      const testState = makeState();
      applyEffects(testState, choice.effects);
      expect(testState.flags['met_forum']).toBe(true);
    }
  });

  it('lower priority than Chen intro', () => {
    const chen = getStorylet('advisor-chen-intro');
    const forum = getStorylet('advisor-forum-intro');
    expect(chen.priority).toBeGreaterThan(forum.priority);
  });

  it('is condition-only (no random precondition)', () => {
    const storylet = getStorylet('advisor-forum-intro');
    const hasRandom = storylet.preconditions.some(c => c.type === 'random');
    expect(hasRandom).toBe(false);
  });
});

// ============================================================================
// §3: Water Irrigation Tech Unlock Event
// ============================================================================

describe('Slice 5b: tech-water-irrigation', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
    // Set up default conditions: year 3, has crop, met both advisors
    state.calendar.year = 3;
    state.flags['met_chen'] = true;
    state.flags['met_forum'] = true;
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
  });

  it('exists with correct metadata', () => {
    const storylet = getStorylet('tech-water-irrigation');
    expect(storylet.type).toBe('advisor');
    expect(storylet.advisorId).toBe('extension-agent');
    expect(storylet.maxOccurrences).toBe(3);
    expect(storylet.priority).toBe(100);
    expect(storylet.cooldownDays).toBe(365);
  });

  it('fires when all conditions met (year 3, has_crop, water level 0, met both)', () => {
    expect(evaluateNonRandomConditions(getStorylet('tech-water-irrigation'), state)).toBe(true);
  });

  it('does NOT fire without met_chen flag', () => {
    state.flags['met_chen'] = false;
    expect(evaluateNonRandomConditions(getStorylet('tech-water-irrigation'), state)).toBe(false);
  });

  it('does NOT fire without met_forum flag', () => {
    state.flags['met_forum'] = false;
    expect(evaluateNonRandomConditions(getStorylet('tech-water-irrigation'), state)).toBe(false);
  });

  it('does NOT fire when water tech level >= 1', () => {
    state.flags['tech_drip_irrigation'] = true;
    expect(evaluateNonRandomConditions(getStorylet('tech-water-irrigation'), state)).toBe(false);
  });

  it('does NOT fire in year 2', () => {
    state.calendar.year = 2;
    expect(evaluateNonRandomConditions(getStorylet('tech-water-irrigation'), state)).toBe(false);
  });

  it('install choice sets tech_drip_irrigation flag and costs $800', () => {
    const storylet = getStorylet('tech-water-irrigation');
    const installChoice = storylet.choices.find(c => c.id === 'install-irrigation');
    expect(installChoice).toBeDefined();
    expect(installChoice!.cost).toBe(800);
    expect(installChoice!.requiresCash).toBe(800);

    const testState = makeState();
    const cashBefore = testState.economy.cash;
    applyEffects(testState, installChoice!.effects);

    expect(testState.flags['tech_drip_irrigation']).toBe(true);
    expect(testState.economy.cash).toBe(cashBefore - 800);
  });

  it('not-now choice does NOT set any tech flag', () => {
    const storylet = getStorylet('tech-water-irrigation');
    const notNowChoice = storylet.choices.find(c => c.id === 'not-now');
    expect(notNowChoice).toBeDefined();

    const testState = makeState();
    applyEffects(testState, notNowChoice!.effects);

    expect(testState.flags['tech_drip_irrigation']).toBeUndefined();
    expect(testState.flags['tech_smart_irrigation']).toBeUndefined();
    expect(testState.flags['tech_deficit_irrigation']).toBeUndefined();
    expect(getTechLevel(testState.flags, 'water')).toBe(0);
  });

  it('after install, getTechLevel returns 1 (reconvergence)', () => {
    const storylet = getStorylet('tech-water-irrigation');
    const installChoice = storylet.choices.find(c => c.id === 'install-irrigation')!;

    const testState = makeState();
    applyEffects(testState, installChoice.effects);

    expect(getTechLevel(testState.flags, 'water')).toBe(1);
  });

  it('reoffer: event is still eligible after not-now + cooldown', () => {
    const storylet = getStorylet('tech-water-irrigation');

    // Simulate "not-now" by logging event occurrence
    state.eventLog.push({
      storyletId: 'tech-water-irrigation',
      day: state.calendar.totalDay,
      choiceId: 'not-now',
    });

    // Still within cooldown — should not fire
    const rng1 = new SeededRNG(42);
    const result1 = evaluateEvents(state, [storylet], rng1);
    expect(result1.fireEvent).toBeNull();

    // Advance past cooldown (365 days)
    state.calendar.totalDay += 366;
    state.calendar.year = 4;

    // Should be eligible again
    expect(evaluateNonRandomConditions(storylet, state)).toBe(true);
  });

  it('is condition-only (no random precondition)', () => {
    const storylet = getStorylet('tech-water-irrigation');
    const hasRandom = storylet.preconditions.some(c => c.type === 'random');
    expect(hasRandom).toBe(false);
  });

  it('has tech-unlock tag', () => {
    const storylet = getStorylet('tech-water-irrigation');
    expect(storylet.tags).toContain('tech-unlock');
  });
});

// ============================================================================
// §4: Auto-Irrigation Notification
// ============================================================================

describe('Slice 5b: Auto-irrigation notification', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
    state.speed = 1;
    state.flags['tech_drip_irrigation'] = true;
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
  });

  it('produces a notification when auto-irrigation fires', () => {
    state.grid[0][0].soil.moisture = 0;
    const notifCountBefore = state.notifications.length;

    simulateTick(state, SLICE_1_SCENARIO);

    // Should have added at least one notification
    const newNotifs = state.notifications.slice(notifCountBefore);
    const hasAutoIrrigationNotif = newNotifs.some(n =>
      n.message.toLowerCase().includes('auto-irrigat') ||
      n.message.toLowerCase().includes('irrigation system') ||
      n.message.toLowerCase().includes('auto-water'),
    );
    expect(hasAutoIrrigationNotif).toBe(true);
  });

  it('notification includes cost info', () => {
    state.grid[0][0].soil.moisture = 0;
    const notifCountBefore = state.notifications.length;

    simulateTick(state, SLICE_1_SCENARIO);

    const newNotifs = state.notifications.slice(notifCountBefore);
    const autoNotif = newNotifs.find(n =>
      n.message.toLowerCase().includes('auto-irrigat') ||
      n.message.toLowerCase().includes('irrigation system') ||
      n.message.toLowerCase().includes('auto-water'),
    );
    expect(autoNotif).toBeDefined();
    // Should contain a dollar amount
    expect(autoNotif!.message).toMatch(/\$/);
  });

  it('two consecutive auto-irrigation fires produce different notification text', () => {
    // First fire
    state.grid[0][0].soil.moisture = 0;
    const notifCountBefore1 = state.notifications.length;
    simulateTick(state, SLICE_1_SCENARIO);
    const firstNotifs = state.notifications.slice(notifCountBefore1);
    const firstMsg = firstNotifs.find(n =>
      n.message.toLowerCase().includes('auto-irrigat') ||
      n.message.toLowerCase().includes('irrigation system') ||
      n.message.toLowerCase().includes('auto-water'),
    )?.message;

    // Drain moisture again for second fire
    state.grid[0][0].soil.moisture = 0;
    const notifCountBefore2 = state.notifications.length;
    simulateTick(state, SLICE_1_SCENARIO);
    const secondNotifs = state.notifications.slice(notifCountBefore2);
    const secondMsg = secondNotifs.find(n =>
      n.message.toLowerCase().includes('auto-irrigat') ||
      n.message.toLowerCase().includes('irrigation system') ||
      n.message.toLowerCase().includes('auto-water'),
    )?.message;

    expect(firstMsg).toBeDefined();
    expect(secondMsg).toBeDefined();
    // Must not be the same message twice in a row
    expect(firstMsg).not.toBe(secondMsg);
  });

  it('autoIrrigationMsgIdx advances with each fire', () => {
    // First fire
    state.grid[0][0].soil.moisture = 0;
    simulateTick(state, SLICE_1_SCENARIO);
    const idx1 = state.autoIrrigationMsgIdx;

    // Second fire
    state.grid[0][0].soil.moisture = 0;
    simulateTick(state, SLICE_1_SCENARIO);
    const idx2 = state.autoIrrigationMsgIdx;

    expect(idx1).toBeDefined();
    expect(idx2).toBeDefined();
    expect(idx1).not.toBe(idx2);
  });
});

// ============================================================================
// §5: Auto-Irrigation End-to-End Integration
// ============================================================================

describe('Slice 5b: Auto-irrigation end-to-end', () => {
  it('tech flag → water stress → auto-irrigation → cost deducted', () => {
    const state = makeState();
    state.speed = 1;
    state.flags['tech_drip_irrigation'] = true;

    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
    state.grid[0][0].soil.moisture = 0;
    const cashBefore = state.economy.cash;

    simulateTick(state, SLICE_1_SCENARIO);

    // Cost should be IRRIGATION_COST_PER_CELL * level 1 multiplier (0.70)
    const expectedCost = IRRIGATION_COST_PER_CELL * (AUTO_IRRIGATION_COST_MULTIPLIERS[1] ?? 0.70);
    expect(cashBefore - state.economy.cash).toBeCloseTo(expectedCost, 1);
  });

  it('wateringRestricted blocks auto-irrigation even with tech', () => {
    const state = makeState();
    state.speed = 1;
    state.flags['tech_drip_irrigation'] = true;
    state.wateringRestricted = true;

    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
    state.grid[0][0].soil.moisture = 0;
    state.waterStressPausedThisSeason = false;
    const cashBefore = state.economy.cash;

    simulateTick(state, SLICE_1_SCENARIO);

    // Cash should be unchanged — auto-irrigation blocked
    expect(state.economy.cash).toBe(cashBefore);
  });
});

// ============================================================================
// §6: Event Ordering and Priority
// ============================================================================

describe('Slice 5b: Event ordering', () => {
  it('all 3 new storylets are condition-only (no random precondition)', () => {
    const ids = ['advisor-chen-intro', 'advisor-forum-intro', 'tech-water-irrigation'];
    for (const id of ids) {
      const storylet = getStorylet(id);
      const hasRandom = storylet.preconditions.some(c => c.type === 'random');
      expect(hasRandom).toBe(false);
    }
  });

  it('new storylets are at end of STORYLETS array (no RNG disruption)', () => {
    const ids = ['advisor-chen-intro', 'advisor-forum-intro', 'tech-water-irrigation'];
    const firstNewIdx = STORYLETS.findIndex(s => ids.includes(s.id));
    const lastOldIdx = STORYLETS.findIndex(s => s.id === 'advisor-perennial-opportunity');

    // All new events should come AFTER existing events
    expect(firstNewIdx).toBeGreaterThan(lastOldIdx);
  });

  it('Chen has higher priority than Forum (weighted selection favors Chen)', () => {
    const chen = getStorylet('advisor-chen-intro');
    const forum = getStorylet('advisor-forum-intro');
    expect(chen.priority).toBeGreaterThan(forum.priority);

    // Both should be eligible in year 2
    const state = makeState();
    state.calendar.year = 2;
    expect(evaluateNonRandomConditions(chen, state)).toBe(true);
    expect(evaluateNonRandomConditions(forum, state)).toBe(true);
  });
});

// ============================================================================
// §7: Data Integrity
// ============================================================================

describe('Slice 5b: Data integrity', () => {
  it('all storylet IDs are unique in full STORYLETS array', () => {
    const ids = STORYLETS.map(s => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('all choice IDs are unique within each new storylet', () => {
    const ids = ['advisor-chen-intro', 'advisor-forum-intro', 'tech-water-irrigation'];
    for (const id of ids) {
      const storylet = getStorylet(id);
      const choiceIds = storylet.choices.map(c => c.id);
      const unique = new Set(choiceIds);
      expect(unique.size).toBe(choiceIds.length);
    }
  });

  it('all new storylets have valid structure', () => {
    const ids = ['advisor-chen-intro', 'advisor-forum-intro', 'tech-water-irrigation'];
    for (const id of ids) {
      const storylet = getStorylet(id);
      expect(storylet.title).toBeTruthy();
      expect(storylet.description).toBeTruthy();
      expect(storylet.preconditions.length).toBeGreaterThan(0);
      expect(storylet.choices.length).toBeGreaterThanOrEqual(1);
      expect(storylet.tags.length).toBeGreaterThan(0);
    }
  });
});
