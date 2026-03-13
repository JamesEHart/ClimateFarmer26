/**
 * Observer Layer — debug/test-only affordances for AI test agents.
 *
 * Provides machine-readable state queries that collapse multiple DOM reads
 * and JS calls into single structured responses. All functions operate on
 * GameState directly (no side effects, no engine mutations).
 *
 * Exposed via window.__gameDebug in signals.ts. Not used by production UI.
 */

import type { GameState, AutoPauseReason, ClimateScenario } from '../engine/types.ts';
import { simulateTick } from '../engine/game.ts';

// ============================================================================
// Types
// ============================================================================

export interface BlockingState {
  blocked: boolean;
  reason?: AutoPauseReason | 'gameover';
  panelTestId?: string;
  eventId?: string;
  choices?: Array<{ testid: string; label: string }>;
  speed: number;
  notificationCount: number;
  year: number;
  season: string;
  day: number;
}

export interface FastForwardResult {
  stopped: boolean;
  reason?: string;
  ticksRun: number;
}

// ============================================================================
// Panel testid mapping (mirrors AutoPausePanel.tsx logic)
// ============================================================================

function getPanelTestId(reason: AutoPauseReason): string {
  switch (reason) {
    case 'bankruptcy': return 'gameover-panel';
    case 'year_30': return 'year30-panel';
    case 'loan_offer': return 'loan-panel';
    case 'event': return 'event-panel';
    case 'advisor': return 'advisor-panel';
    default: return 'autopause-panel';
  }
}

function getPrimaryChoiceInfo(reason: AutoPauseReason, state: GameState): { testid: string; label: string } {
  switch (reason) {
    case 'bankruptcy': return { testid: 'gameover-new-game', label: 'Start New Game' };
    case 'year_30': return { testid: 'year30-new-game', label: 'Start New Game' };
    case 'loan_offer': return { testid: 'loan-accept', label: 'Accept Loan' };
    case 'harvest_ready': return { testid: 'autopause-action-primary', label: 'Harvest Field' };
    case 'water_stress': return { testid: 'autopause-action-primary', label: 'Water Field' };
    case 'year_end': return { testid: 'autopause-action-primary', label: `Continue to Year ${state.calendar.year + 1}` };
    default: return { testid: 'autopause-action-primary', label: 'Continue' };
  }
}

function getDismissLabel(reason: AutoPauseReason): string {
  switch (reason) {
    case 'water_stress': return 'Continue without watering';
    case 'loan_offer': return 'Decline (Game Over)';
    default: return 'Continue';
  }
}

function getSeasonName(month: number): string {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'fall';
  return 'winter';
}

// ============================================================================
// getBlockingState()
// ============================================================================

/**
 * Returns a structured snapshot of the game's blocking state.
 * AI agents call this to determine: am I blocked? Why? What should I click?
 *
 * @param hasPendingFollowUp — true when an advisor/event follow-up panel is
 *   showing (pendingFollowUp signal is set). This lives in the adapter layer,
 *   not GameState, so it must be passed in from the callsite.
 */
export function getBlockingState(state: GameState, hasPendingFollowUp = false): BlockingState {
  const base: BlockingState = {
    blocked: false,
    speed: state.speed,
    notificationCount: state.notifications.length,
    year: state.calendar.year,
    season: getSeasonName(state.calendar.month),
    day: state.calendar.totalDay,
  };

  if (state.gameOver) {
    return {
      ...base,
      blocked: true,
      reason: 'gameover',
      panelTestId: 'gameover-panel',
      choices: [{ testid: 'gameover-new-game', label: 'Start New Game' }],
    };
  }

  if (state.autoPauseQueue.length === 0) {
    return base;
  }

  const pause = state.autoPauseQueue[0];
  const reason = pause.reason;
  const panelTestId = getPanelTestId(reason);

  // Follow-up panel: activeEvent is cleared but follow-up text is showing
  if ((reason === 'event' || reason === 'advisor') && !state.activeEvent && hasPendingFollowUp) {
    return {
      ...base,
      blocked: true,
      reason,
      panelTestId: 'follow-up-panel',
      choices: [{ testid: 'follow-up-dismiss', label: 'OK' }],
    };
  }

  // For event/advisor pauses with activeEvent, return the event's choices
  if ((reason === 'event' || reason === 'advisor') && state.activeEvent) {
    const prefix = reason === 'advisor' ? 'advisor' : 'event';
    return {
      ...base,
      blocked: true,
      reason,
      panelTestId,
      eventId: state.activeEvent.storyletId,
      choices: state.activeEvent.choices.map(c => ({
        testid: `${prefix}-choice-${c.id}`,
        label: c.label,
      })),
    };
  }

  // For standard autopauses, return primary + dismiss buttons with real labels
  const primary = getPrimaryChoiceInfo(reason, state);
  const choices: Array<{ testid: string; label: string }> = [primary];

  // Most autopauses have a dismiss/secondary button
  if (reason !== 'bankruptcy' && reason !== 'year_30') {
    choices.push({ testid: 'autopause-dismiss', label: getDismissLabel(reason) });
  }

  return {
    ...base,
    blocked: true,
    reason,
    panelTestId,
    choices,
  };
}

// ============================================================================
// fastForwardUntilBlocked()
// ============================================================================

/**
 * Run simulation ticks until ANY autopause fires or game ends.
 * Unlike fastForward(), this does NOT auto-dismiss any pauses.
 * Returns what stopped it and how many ticks ran.
 */
export function fastForwardUntilBlocked(
  state: GameState,
  scenario: ClimateScenario,
  maxTicks: number,
): FastForwardResult {
  // If already blocked, return immediately
  if (state.autoPauseQueue.length > 0) {
    return { stopped: true, reason: state.autoPauseQueue[0].reason, ticksRun: 0 };
  }
  if (state.gameOver) {
    return { stopped: true, reason: 'gameover', ticksRun: 0 };
  }

  for (let i = 0; i < maxTicks; i++) {
    state.speed = 4; // ensure running
    simulateTick(state, scenario);

    if (state.autoPauseQueue.length > 0) {
      return { stopped: true, reason: state.autoPauseQueue[0].reason, ticksRun: i + 1 };
    }
    if (state.gameOver) {
      return { stopped: true, reason: 'gameover', ticksRun: i + 1 };
    }
  }

  return { stopped: false, ticksRun: maxTicks };
}

// ============================================================================
// Notification helpers
// ============================================================================

/** Return all notifications (AI agents can only see the newest one in the DOM). */
export function getNotificationsDebug(state: GameState): Array<{ message: string; type: string; day: number }> {
  return state.notifications.map(n => ({
    message: n.message,
    type: n.type,
    day: n.day,
  }));
}

/** Clear all notifications. Prevents backlog from slowing ticks or confusing AI agents. */
export function dismissAllNotificationsDebug(state: GameState): void {
  state.notifications.length = 0;
}
