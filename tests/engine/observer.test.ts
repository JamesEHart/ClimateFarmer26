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
  fastForwardUntilBlocked,
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
