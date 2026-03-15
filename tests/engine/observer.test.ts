/**
 * Observer Layer Tests — debug/test-only AI agent affordances.
 *
 * Tests for getBlockingState(), fastForwardUntilBlocked(), and
 * getNotifications()/dismissAllNotifications() debug methods.
 *
 * These are adapter-level functions exposed via window.__gameDebug.
 * Since we can't test window globals directly in vitest, we test the
 * underlying functions that power them.
 */

import { describe, it, expect } from 'vitest';
import { createInitialState, processCommand, simulateTick } from '../../src/engine/game.ts';
import { SLICE_1_SCENARIO } from '../../src/data/scenario.ts';
import { getCropDefinition } from '../../src/data/crops.ts';
import {
  getBlockingState,
  getActionState,
  fastForwardUntilBlocked,
  fastForwardDays,
  getNotificationsDebug,
  dismissAllNotificationsDebug,
} from '../../src/adapter/observer.ts';
import type { GameState, ClimateScenario } from '../../src/engine/types.ts';

// ============================================================================
// Test Helpers
// ============================================================================

function makeState(): GameState {
  return createInitialState('test-observer', SLICE_1_SCENARIO);
}

// ============================================================================
// getBlockingState()
// ============================================================================

describe('Observer — getBlockingState()', () => {
  it('returns blocked=false when no autopause queued', () => {
    const state = makeState();
    const result = getBlockingState(state);
    expect(result.blocked).toBe(false);
    expect(result.reason).toBeUndefined();
    expect(result.panelTestId).toBeUndefined();
    expect(result.speed).toBe(0); // starts paused
    expect(result.year).toBe(1);
    expect(result.season).toBe('spring');
  });

  it('returns blocked=true with harvest_ready reason and real labels', () => {
    const state = makeState();
    state.autoPauseQueue.push({ reason: 'harvest_ready', message: 'Crops are ready!' });
    const result = getBlockingState(state);
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('harvest_ready');
    expect(result.panelTestId).toBe('autopause-panel');
    expect(result.choices).toBeDefined();
    expect(result.choices!.length).toBeGreaterThan(0);
    expect(result.choices!.some(c => c.testid === 'autopause-action-primary' && c.label === 'Harvest Field')).toBe(true);
    expect(result.choices!.some(c => c.testid === 'autopause-dismiss' && c.label === 'Continue')).toBe(true);
  });

  it('returns blocked=true with loan_offer panel info and real labels', () => {
    const state = makeState();
    state.autoPauseQueue.push({ reason: 'loan_offer', message: 'Emergency loan available' });
    const result = getBlockingState(state);
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('loan_offer');
    expect(result.panelTestId).toBe('loan-panel');
    expect(result.choices!.some(c => c.testid === 'loan-accept' && c.label === 'Accept Loan')).toBe(true);
    expect(result.choices!.some(c => c.testid === 'autopause-dismiss' && c.label === 'Decline (Game Over)')).toBe(true);
  });

  it('returns blocked=true with event choices when activeEvent is set', () => {
    const state = makeState();
    state.autoPauseQueue.push({ reason: 'event', message: 'Heatwave!' });
    state.activeEvent = {
      storyletId: 'test-event',
      title: 'Test Event',
      description: 'A test event.',
      choices: [
        { id: 'accept', label: 'Accept', description: 'Accept the offer', effects: [] },
        { id: 'decline', label: 'Decline', description: 'Decline the offer', effects: [] },
      ],
      firedOnDay: 100,
    };
    const result = getBlockingState(state);
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('event');
    expect(result.panelTestId).toBe('event-panel');
    expect(result.eventId).toBe('test-event');
    expect(result.choices).toHaveLength(2);
    expect(result.choices![0].testid).toBe('event-choice-accept');
    expect(result.choices![0].label).toBe('Accept');
    expect(result.choices![1].testid).toBe('event-choice-decline');
  });

  it('returns advisor-prefixed testids for advisor events', () => {
    const state = makeState();
    state.autoPauseQueue.push({ reason: 'advisor', message: 'Santos advice' });
    state.activeEvent = {
      storyletId: 'advisor-test',
      title: 'Advisor Test',
      description: 'Advice from Santos.',
      choices: [
        { id: 'follow', label: 'Follow advice', description: 'Do it', effects: [] },
      ],
      firedOnDay: 100,
    };
    const result = getBlockingState(state);
    expect(result.panelTestId).toBe('advisor-panel');
    expect(result.choices![0].testid).toBe('advisor-choice-follow');
  });

  it('returns follow-up-panel when advisor choice was made but follow-up is pending', () => {
    const state = makeState();
    // After a choice, activeEvent is cleared but autopause reason is still 'advisor'
    state.autoPauseQueue.push({ reason: 'advisor', message: 'Santos advice' });
    state.activeEvent = null; // cleared by engine after choice
    // Pass hasPendingFollowUp=true (mirrors pendingFollowUp signal being set)
    const result = getBlockingState(state, true);
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('advisor');
    expect(result.panelTestId).toBe('follow-up-panel');
    expect(result.choices).toHaveLength(1);
    expect(result.choices![0].testid).toBe('follow-up-dismiss');
    expect(result.choices![0].label).toBe('OK');
  });

  it('follow-up detection does not apply when activeEvent still exists', () => {
    const state = makeState();
    state.autoPauseQueue.push({ reason: 'advisor', message: 'Santos advice' });
    state.activeEvent = {
      storyletId: 'advisor-test',
      title: 'Test',
      description: 'Test.',
      choices: [{ id: 'ok', label: 'OK', description: 'OK', effects: [] }],
      firedOnDay: 100,
    };
    // Even with hasPendingFollowUp=true, activeEvent takes priority
    const result = getBlockingState(state, true);
    expect(result.panelTestId).toBe('advisor-panel');
    expect(result.choices![0].testid).toBe('advisor-choice-ok');
  });

  it('without hasPendingFollowUp, advisor with no activeEvent falls through to standard panel', () => {
    const state = makeState();
    state.autoPauseQueue.push({ reason: 'advisor', message: 'Santos advice' });
    state.activeEvent = null;
    // hasPendingFollowUp defaults to false
    const result = getBlockingState(state);
    // Falls through to standard autopause (not follow-up)
    expect(result.panelTestId).toBe('advisor-panel');
    expect(result.choices!.some(c => c.testid === 'autopause-action-primary')).toBe(true);
  });

  it('returns organic-warning-panel when organic warning interstitial is showing', () => {
    const state = makeState();
    state.autoPauseQueue.push({ reason: 'event', message: 'Rootworm' });
    state.activeEvent = {
      storyletId: 'catastrophe-rootworm',
      title: 'Rootworm Infestation',
      description: 'Rootworm detected.',
      choices: [
        { id: 'emergency-treatment', label: 'Chemical treatment', description: 'Spray', effects: [] },
        { id: 'monitor', label: 'Monitor', description: 'Wait', effects: [] },
      ],
      firedOnDay: 200,
    };
    // hasPendingOrganicWarning=true (third param)
    const result = getBlockingState(state, false, true);
    expect(result.blocked).toBe(true);
    expect(result.panelTestId).toBe('organic-warning-panel');
    expect(result.choices).toHaveLength(2);
    expect(result.choices![0]).toEqual({ testid: 'organic-warning-proceed', label: 'Use anyway' });
    expect(result.choices![1]).toEqual({ testid: 'organic-warning-cancel', label: 'Cancel' });
  });

  it('organic warning takes priority over normal event choices when both activeEvent and warning exist', () => {
    const state = makeState();
    state.autoPauseQueue.push({ reason: 'advisor', message: 'Nitrogen' });
    state.activeEvent = {
      storyletId: 'advisor-soil-nitrogen',
      title: 'Nitrogen',
      description: 'Low N.',
      choices: [{ id: 'buy-fertilizer', label: 'Buy', description: 'Buy', effects: [] }],
      firedOnDay: 100,
    };
    // Without organic warning → normal event choices
    const normal = getBlockingState(state, false, false);
    expect(normal.panelTestId).toBe('advisor-panel');
    // With organic warning → warning panel
    const warning = getBlockingState(state, false, true);
    expect(warning.panelTestId).toBe('organic-warning-panel');
  });

  it('organic warning does not apply when no activeEvent (warning only on live event panels)', () => {
    const state = makeState();
    state.autoPauseQueue.push({ reason: 'event', message: 'Test' });
    state.activeEvent = null;
    // hasPendingOrganicWarning=true but no activeEvent → falls through
    const result = getBlockingState(state, false, true);
    // Should NOT be organic-warning-panel (no event to warn about)
    expect(result.panelTestId).not.toBe('organic-warning-panel');
  });

  it('returns year_end with dynamic year label', () => {
    const state = makeState();
    state.calendar.year = 3;
    state.autoPauseQueue.push({ reason: 'year_end', message: 'Year complete' });
    const result = getBlockingState(state);
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('year_end');
    expect(result.choices!.some(c => c.testid === 'autopause-action-primary' && c.label === 'Continue to Year 4')).toBe(true);
    expect(result.choices!.some(c => c.testid === 'autopause-dismiss' && c.label === 'Continue')).toBe(true);
  });

  it('returns water_stress with descriptive labels', () => {
    const state = makeState();
    state.autoPauseQueue.push({ reason: 'water_stress', message: 'Crops need water' });
    const result = getBlockingState(state);
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('water_stress');
    expect(result.choices!.some(c => c.testid === 'autopause-action-primary' && c.label === 'Water Field')).toBe(true);
    expect(result.choices!.some(c => c.testid === 'autopause-dismiss' && c.label === 'Continue without watering')).toBe(true);
  });

  it('returns gameover panel info for bankruptcy', () => {
    const state = makeState();
    state.autoPauseQueue.push({ reason: 'bankruptcy', message: 'Game over' });
    const result = getBlockingState(state);
    expect(result.panelTestId).toBe('gameover-panel');
    expect(result.choices!.some(c => c.testid === 'gameover-new-game')).toBe(true);
  });

  it('returns year30 panel info', () => {
    const state = makeState();
    state.autoPauseQueue.push({ reason: 'year_30', message: 'Congratulations!' });
    const result = getBlockingState(state);
    expect(result.panelTestId).toBe('year30-panel');
    expect(result.choices!.some(c => c.testid === 'year30-new-game')).toBe(true);
  });

  it('includes notification count', () => {
    const state = makeState();
    state.notifications.push(
      { message: 'test1', type: 'info', day: 59 },
      { message: 'test2', type: 'warning', day: 59 },
    );
    const result = getBlockingState(state);
    expect(result.notificationCount).toBe(2);
  });

  it('returns correct day from calendar', () => {
    const state = makeState();
    state.calendar.year = 5;
    state.calendar.totalDay = 4 * 365 + 180;
    const result = getBlockingState(state);
    expect(result.year).toBe(5);
    expect(result.day).toBe(state.calendar.totalDay);
  });
});

// ============================================================================
// fastForwardUntilBlocked()
// ============================================================================

describe('Observer — fastForwardUntilBlocked()', () => {
  it('stops at harvest_ready autopause', () => {
    const state = makeState();
    const scenario = SLICE_1_SCENARIO;
    // Plant corn and force to near-harvestable
    state.calendar.month = 3;
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, scenario);
    const cell = state.grid[0][0];
    const cropDef = getCropDefinition('silage-corn');
    cell.crop!.gddAccumulated = cropDef.gddToMaturity - 1;
    cell.crop!.growthStage = 'mature';
    state.speed = 4;

    // Fast forward — should stop when harvest autopause fires
    const result = fastForwardUntilBlocked(state, scenario, 1000);
    expect(result.stopped).toBe(true);
    expect(result.reason).toBeDefined();
    expect(result.ticksRun).toBeGreaterThan(0);
    expect(result.ticksRun).toBeLessThan(1000);
  });

  it('returns stopped=false when all ticks complete without blocking', () => {
    const state = makeState();
    state.speed = 4;
    // Run a few ticks with no crops — nothing should block
    const result = fastForwardUntilBlocked(state, SLICE_1_SCENARIO, 5);
    expect(result.stopped).toBe(false);
    expect(result.ticksRun).toBe(5);
  });

  it('stops at bankruptcy autopause when cash is negative', () => {
    const state = makeState();
    state.economy.cash = -1000;
    state.economy.totalLoansReceived = 1; // no more loans available
    state.speed = 4;
    const result = fastForwardUntilBlocked(state, SLICE_1_SCENARIO, 10000);
    expect(result.stopped).toBe(true);
    // Engine pushes bankruptcy autopause before setting gameOver
    expect(result.reason).toBe('bankruptcy');
  });

  it('does not auto-dismiss any autopause (unlike fastForward)', () => {
    const state = makeState();
    state.speed = 4;
    // Manually queue a water_stress autopause
    state.autoPauseQueue.push({ reason: 'water_stress', message: 'Crops need water' });
    // Should stop immediately — water_stress is NOT auto-dismissed
    const result = fastForwardUntilBlocked(state, SLICE_1_SCENARIO, 100);
    expect(result.stopped).toBe(true);
    expect(result.reason).toBe('water_stress');
    expect(result.ticksRun).toBe(0);
  });

  it('calls onTick callback after each simulateTick and stops if it queues an autopause', () => {
    const state = makeState();
    state.speed = 4;
    let tickCount = 0;
    const result = fastForwardUntilBlocked(state, SLICE_1_SCENARIO, 100, (s) => {
      tickCount++;
      if (tickCount === 5) {
        s.autoPauseQueue.push({ reason: 'planting_options', message: 'New crops available' });
      }
    });
    expect(result.stopped).toBe(true);
    expect(result.reason).toBe('planting_options');
    expect(result.ticksRun).toBe(5);
    expect(tickCount).toBe(5);
  });

  it('onTick callback is not called when already blocked', () => {
    const state = makeState();
    state.speed = 4;
    state.autoPauseQueue.push({ reason: 'water_stress', message: 'Needs water' });
    let called = false;
    const result = fastForwardUntilBlocked(state, SLICE_1_SCENARIO, 100, () => {
      called = true;
    });
    expect(result.stopped).toBe(true);
    expect(result.ticksRun).toBe(0);
    expect(called).toBe(false);
  });
});

// ============================================================================
// fastForwardDays()
// ============================================================================

describe('Observer — fastForwardDays()', () => {
  it('advances exactly N days when no autopause fires', () => {
    const state = makeState();
    const startDay = state.calendar.totalDay;
    const result = fastForwardDays(state, SLICE_1_SCENARIO, 30);
    expect(result.stopped).toBe(false);
    expect(result.ticksRun).toBe(30);
    expect(result.day).toBe(startDay + 30);
    expect(state.calendar.totalDay).toBe(startDay + 30);
  });

  it('stops early when autopause fires and includes final day', () => {
    const state = makeState();
    // Plant corn to trigger harvest autopause
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
    const cropDef = getCropDefinition('silage-corn');
    state.grid[0][0].crop!.gddAccumulated = cropDef.gddToMaturity - 1;
    state.grid[0][0].crop!.growthStage = 'mature';
    state.speed = 4;

    const result = fastForwardDays(state, SLICE_1_SCENARIO, 365);
    expect(result.stopped).toBe(true);
    expect(result.ticksRun).toBeLessThan(365);
    expect(result.day).toBe(state.calendar.totalDay);
  });

  it('respects onTick callback (planting window injection)', () => {
    const state = makeState();
    let tickCount = 0;
    const result = fastForwardDays(state, SLICE_1_SCENARIO, 100, (s) => {
      tickCount++;
      if (tickCount === 10) {
        s.autoPauseQueue.push({ reason: 'planting_options', message: 'Test' });
      }
    });
    expect(result.stopped).toBe(true);
    expect(result.reason).toBe('planting_options');
    expect(result.ticksRun).toBe(10);
    expect(result.day).toBeDefined();
  });
});

// ============================================================================
// Notification helpers
// ============================================================================

describe('Observer — notification helpers', () => {
  it('getNotificationsDebug returns all notifications', () => {
    const state = makeState();
    state.notifications.push(
      { message: 'First', type: 'info', day: 59 },
      { message: 'Second', type: 'warning', day: 60 },
      { message: 'Third', type: 'event_result', day: 61 },
    );
    const result = getNotificationsDebug(state);
    expect(result).toHaveLength(3);
    expect(result[0].message).toBe('First');
    expect(result[2].message).toBe('Third');
  });

  it('dismissAllNotificationsDebug clears all notifications', () => {
    const state = makeState();
    state.notifications.push(
      { message: 'First', type: 'info', day: 59 },
      { message: 'Second', type: 'warning', day: 60 },
    );
    expect(state.notifications.length).toBe(2);
    dismissAllNotificationsDebug(state);
    expect(state.notifications.length).toBe(0);
  });
});

// ============================================================================
// getActionState()
// ============================================================================

describe('Observer — getActionState()', () => {
  it('returns available crops for spring start (no selection)', () => {
    const state = makeState();
    // Game starts in March (spring) — corn, tomatoes, sorghum should be available
    const result = getActionState(state, null);
    expect(result.selectedCell).toBeNull();
    expect(result.availableCrops).toContain('silage-corn');
    expect(result.availableCrops).toContain('processing-tomatoes');
    expect(result.availableCrops).not.toContain('winter-wheat'); // fall only
    expect(result.coverCropsEligible).toBe(false); // not fall
    expect(result.harvestReadyCount).toBe(0);
    expect(result.hasCrops).toBe(false);
  });

  it('includes plant-all testids but no row/col testids without selection', () => {
    const state = makeState();
    const result = getActionState(state, null);
    expect(result.bulkActions).toContain('action-plant-all-silage-corn');
    expect(result.bulkActions).toContain('action-harvest-all');
    expect(result.bulkActions).toContain('action-water-all');
    // No row/col actions without selection
    expect(result.bulkActions.some(a => a.includes('-row-'))).toBe(false);
    expect(result.bulkActions.some(a => a.includes('-col-'))).toBe(false);
  });

  it('includes row/col testids when cell is selected', () => {
    const state = makeState();
    const result = getActionState(state, { row: 2, col: 3 });
    expect(result.selectedCell).toEqual({ row: 2, col: 3 });
    expect(result.bulkActions).toContain('action-plant-row-2-silage-corn');
    expect(result.bulkActions).toContain('action-plant-col-3-silage-corn');
    expect(result.bulkActions).toContain('action-harvest-row-2');
    expect(result.bulkActions).toContain('action-harvest-col-3');
    expect(result.bulkActions).toContain('action-water-row-2');
    expect(result.bulkActions).toContain('action-water-col-3');
  });

  it('reports harvestReadyCount when crops are harvestable', () => {
    const state = makeState();
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
    const cropDef = getCropDefinition('silage-corn');
    state.grid[0][0].crop!.gddAccumulated = cropDef.gddToMaturity;
    state.grid[0][0].crop!.growthStage = 'harvestable';

    const result = getActionState(state, null);
    expect(result.harvestReadyCount).toBe(1);
    expect(result.hasCrops).toBe(true);
  });

  it('reports coverCropsEligible in fall with empty cells', () => {
    const state = makeState();
    // Advance to fall (October)
    state.calendar.month = 10;
    state.calendar.season = 'fall';
    const result = getActionState(state, null);
    expect(result.coverCropsEligible).toBe(true);
    expect(result.bulkActions).toContain('action-plant-cover-crop-bulk');
    expect(result.availableCrops).toContain('winter-wheat');
    expect(result.availableCrops).not.toContain('silage-corn');
  });

  it('includes cover crop row/col testids when selected in fall', () => {
    const state = makeState();
    state.calendar.month = 10;
    state.calendar.season = 'fall';
    const result = getActionState(state, { row: 1, col: 4 });
    expect(result.bulkActions).toContain('action-cover-crop-row-1');
    expect(result.bulkActions).toContain('action-cover-crop-col-4');
  });

  it('excludes flag-gated crops the player has not unlocked', () => {
    const state = makeState();
    const result = getActionState(state, null);
    expect(result.availableCrops).not.toContain('agave');
    expect(result.availableCrops).not.toContain('heat-avocado');
  });
});
