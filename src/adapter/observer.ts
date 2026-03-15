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
import { simulateTick, getAvailableCrops } from '../engine/game.ts';
import { getCropDefinition } from '../data/crops.ts';

// ============================================================================
// Types
// ============================================================================

export interface BlockingState {
  blocked: boolean;
  reason?: AutoPauseReason | 'gameover';
  panelTestId?: string;
  eventId?: string;
  choices?: Array<{
    testid: string;
    label: string;
    /** Whether this choice is currently clickable. False when player can't afford requiresCash. */
    enabled?: boolean;
    /** Cash cost shown on the button, if any. */
    cost?: number;
    /** Minimum cash required for this choice. If cash < this, enabled=false. */
    requiresCash?: number;
  }>;
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
  /** Day the simulation reached (totalDay). Present on fastForwardDays results. */
  day?: number;
}

export interface ActionState {
  selectedCell: { row: number; col: number } | null;
  availableCrops: string[];
  coverCropsEligible: boolean;
  harvestReadyCount: number;
  hasCrops: boolean;
  /** Currently valid bulk action testids, based on selected cell and game state. */
  bulkActions: string[];
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
 * @param hasPendingOrganicWarning — true when the organic-violation warning
 *   interstitial is showing (pendingOrganicWarning signal is set).
 */
export function getBlockingState(state: GameState, hasPendingFollowUp = false, hasPendingOrganicWarning = false): BlockingState {
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

  // Organic violation warning: interstitial over the event panel (activeEvent still exists)
  if ((reason === 'event' || reason === 'advisor') && state.activeEvent && hasPendingOrganicWarning) {
    return {
      ...base,
      blocked: true,
      reason,
      panelTestId: 'organic-warning-panel',
      choices: [
        { testid: 'organic-warning-proceed', label: 'Use anyway' },
        { testid: 'organic-warning-cancel', label: 'Cancel' },
      ],
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
      choices: state.activeEvent.choices.map(c => {
        const canAfford = c.requiresCash === undefined || state.economy.cash >= c.requiresCash;
        return {
          testid: `${prefix}-choice-${c.id}`,
          label: c.label,
          enabled: canAfford,
          cost: c.cost,
          requiresCash: c.requiresCash,
        };
      }),
    };
  }

  // For standard autopauses, return primary + dismiss buttons with real labels
  const primary = getPrimaryChoiceInfo(reason, state);
  const choices: Array<{ testid: string; label: string }> = [primary];

  // Most autopauses have a dismiss/secondary button.
  // planting_options only has a primary "Continue" button (no secondary in AutoPausePanel).
  if (reason !== 'bankruptcy' && reason !== 'year_30' && reason !== 'planting_options') {
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
// getActionState()
// ============================================================================

/**
 * Returns what actions are currently available, eliminating the need for
 * brittle DOM scraping. AI agents call this to know what they can do right now.
 *
 * @param sel — Currently selected cell (from adapter's selectedCell signal).
 *   Must be passed in since observer.ts is pure and has no signal access.
 */
export function getActionState(
  state: GameState,
  sel: { row: number; col: number } | null,
): ActionState {
  const crops = getAvailableCrops(state);
  const hasCrops = state.grid.some(row => row.some(c => c.crop !== null));
  const isFall = state.calendar.season === 'fall';

  // Count harvest-ready crops (same predicate as SidePanel)
  let harvestReadyCount = 0;
  for (const row of state.grid) {
    for (const c of row) {
      if (!c.crop) continue;
      const stage = c.crop.growthStage;
      if ((stage === 'harvestable' || stage === 'overripe') && !c.crop.harvestedThisSeason) {
        if (c.crop.isPerennial && c.crop.isDormant) continue;
        harvestReadyCount++;
      }
    }
  }

  // Cover crop eligibility (same predicate as SidePanel)
  const coverCropsEligible = isFall && state.grid.some(row => row.some(c => {
    if (c.coverCropId) return false;
    if (!c.crop) return true;
    if (!c.crop.isPerennial) return false;
    const def = getCropDefinition(c.crop.cropId);
    return (def.dormantSeasons?.length ?? 0) > 0 || (def.coverCropEffectiveness ?? 0) > 0;
  }));

  // Build list of currently valid bulk action testids
  const bulkActions: string[] = [];

  // Plant field — one per available crop
  for (const cropId of crops) {
    bulkActions.push(`action-plant-all-${cropId}`);
  }

  // Harvest/water field — always present (may be disabled)
  bulkActions.push('action-harvest-all');
  bulkActions.push('action-water-all');

  // Cover crop field
  if (coverCropsEligible) {
    bulkActions.push('action-plant-cover-crop-bulk');
  }

  // Row/col actions require a selected cell
  if (sel) {
    for (const cropId of crops) {
      bulkActions.push(`action-plant-row-${sel.row}-${cropId}`);
      bulkActions.push(`action-plant-col-${sel.col}-${cropId}`);
    }
    bulkActions.push(`action-harvest-row-${sel.row}`);
    bulkActions.push(`action-harvest-col-${sel.col}`);
    bulkActions.push(`action-water-row-${sel.row}`);
    bulkActions.push(`action-water-col-${sel.col}`);
    if (coverCropsEligible) {
      bulkActions.push(`action-cover-crop-row-${sel.row}`);
      bulkActions.push(`action-cover-crop-col-${sel.col}`);
    }
  }

  return {
    selectedCell: sel,
    availableCrops: crops,
    coverCropsEligible,
    harvestReadyCount,
    hasCrops,
    bulkActions,
  };
}

// ============================================================================
// fastForwardUntilBlocked()
// ============================================================================

/**
 * Run simulation ticks until ANY autopause fires or game ends.
 * Unlike fastForward(), this does NOT auto-dismiss any pauses.
 * Returns what stopped it and how many ticks ran.
 *
 * @param onTick — Optional callback invoked after each simulateTick, before
 *   the autopause check. The adapter wrapper uses this to inject planting-window
 *   autopause checks that live outside the pure engine layer.
 */
export function fastForwardUntilBlocked(
  state: GameState,
  scenario: ClimateScenario,
  maxTicks: number,
  onTick?: (state: GameState) => void,
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
    if (onTick) onTick(state);

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
// fastForwardDays()
// ============================================================================

/**
 * Run simulation forward by a specified number of calendar days.
 * Stops early if ANY autopause fires or game ends.
 * AI agents find this more intuitive than counting ticks.
 *
 * Each simulateTick advances exactly 1 day, so days maps directly to ticks.
 *
 * @param onTick — Same optional callback as fastForwardUntilBlocked.
 */
export function fastForwardDays(
  state: GameState,
  scenario: ClimateScenario,
  days: number,
  onTick?: (state: GameState) => void,
): FastForwardResult {
  const result = fastForwardUntilBlocked(state, scenario, days, onTick);
  return { ...result, day: state.calendar.totalDay };
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
