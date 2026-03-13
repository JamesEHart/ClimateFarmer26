import { signal, computed, batch } from '@preact/signals';
import type { GameState, Command, CommandResult, Cell, DailyWeather } from '../engine/types.ts';
import { GRID_ROWS, GRID_COLS, IRRIGATION_COST_PER_CELL } from '../engine/types.ts';
import { getIrrigationCostMultiplier } from '../engine/events/effects.ts';
import { createInitialState, processCommand, simulateTick, dismissAutoPause, resetYearlyTracking, addNotification, dismissNotification, getAvailableCrops, executeBulkPlant, executeWater, executeBulkCoverCrop } from '../engine/game.ts';
import { getCoverCropDefinition } from '../data/cover-crops.ts';
import { logSessionStart } from '../engine/playtest-log.ts';
import { getCropDefinition } from '../data/crops.ts';
import { SCENARIOS, SCENARIO_IDS, resolveScenarioId } from '../data/scenarios.ts';
import { CURATED_SEEDS } from '../data/curated-seeds.ts';
import type { ClimateScenario } from '../engine/types.ts';
import { autoSave, loadAutoSave, hasSaveData, hasManualSaves, saveGame, loadGame, listManualSaves, deleteSave, isTutorialDismissed, setTutorialDismissed } from '../save/storage.ts';
import type { SaveSlotInfo } from '../save/storage.ts';
import { isSeasonChange, getSeasonName, totalDayToCalendar } from '../engine/calendar.ts';
import { STORYLETS } from '../data/events.ts';
import { getBlockingState, fastForwardUntilBlocked, getNotificationsDebug, dismissAllNotificationsDebug } from './observer.ts';

// ============================================================================
// Scenario Resolution
// ============================================================================

/** Resolve a scenarioId and set fallback flag on state if needed. */
function resolveScenario(scenarioId: string, state?: GameState): ClimateScenario {
  const { scenario, fallback } = resolveScenarioId(scenarioId);
  if (fallback && state) state.flags['unknown_scenario_fallback'] = true;
  return scenario;
}

/** The currently active scenario. Set on new game or load. */
let _activeScenario: ClimateScenario = SCENARIOS['gradual-warming'];

const RECENT_SCENARIOS_KEY = 'cf26-recentScenarios';
const RECENT_POOL_SIZE = 3;

/**
 * Pick a scenario from the recently-unplayed pool.
 * Tracks recent selections in localStorage to avoid repeats.
 */
function pickScenario(): ClimateScenario {
  let recent: string[] = [];
  try {
    const stored = localStorage.getItem(RECENT_SCENARIOS_KEY);
    if (stored) recent = JSON.parse(stored);
  } catch { /* ignore parse errors */ }

  // Available = all scenarios not in recent list
  let pool = SCENARIO_IDS.filter(id => !recent.includes(id));
  if (pool.length === 0) pool = [...SCENARIO_IDS]; // all played, reset

  // Pick random from pool
  const pick = pool[Math.floor(Math.random() * pool.length)];

  // Update recent list (keep last N)
  recent.push(pick);
  if (recent.length > RECENT_POOL_SIZE) recent = recent.slice(-RECENT_POOL_SIZE);
  try {
    localStorage.setItem(RECENT_SCENARIOS_KEY, JSON.stringify(recent));
  } catch { /* ignore storage errors */ }

  return SCENARIOS[pick];
}

/** Get the name of the currently active scenario (for UI display). */
export function getActiveScenarioName(): string {
  return _activeScenario.name;
}

/** Get the ID of the currently active scenario (for testing). */
export function getActiveScenarioId(): string {
  return _activeScenario.id;
}

// ============================================================================
// Core State Signals
// ============================================================================

/**
 * The authoritative mutable game state. Engine functions mutate this directly.
 * The gameState signal holds a snapshot for UI reactivity.
 */
let _liveState: GameState | null = null;

/** Snapshot of game state for reactive UI. Updated via publishState(). */
export const gameState = signal<GameState | null>(null);

/** Current screen */
export const screen = signal<'new-game' | 'playing' | 'game-over'>('new-game');

/** Currently selected cell coordinates */
export const selectedCell = signal<{ row: number; col: number } | null>(null);

/** Whether the crop menu is open */
export const cropMenuOpen = signal(false);

/** Pending confirmation dialog */
export const confirmDialog = signal<ConfirmDialogState | null>(null);

/** Tutorial step: -1 = dismissed, 0-2 = active steps */
export const tutorialStep = signal<number>(isTutorialDismissed() ? -1 : 0);

/** Current weather for display */
export const currentWeather = signal<DailyWeather | null>(null);

/** Save error message */
export const saveError = signal<string | null>(null);

/** Show "Press Play to continue" prompt when paused after action */
export const needsPlayPrompt = signal(false);

/** Pending follow-up beat from an advisor choice with followUpText (Slice 6a).
 *  Set by EventPanel after choice dispatch; cleared on "OK" dismiss. */
export const pendingFollowUp = signal<{
  advisorId: string;
  title: string;
  text: string;
} | null>(null);

// ============================================================================
// Player Preferences (localStorage-backed, not game state)
// ============================================================================

const PREF_AUTO_PAUSE_PLANTING = 'climateFarmer_pref_autoPausePlanting';

/** Auto-pause when planting options change (new crops become plantable at season boundary). */
export const autoPausePlanting = signal<boolean>(
  typeof localStorage !== 'undefined' && localStorage.getItem(PREF_AUTO_PAUSE_PLANTING) === 'true',
);

export function setAutoPausePlanting(value: boolean): void {
  autoPausePlanting.value = value;
  try {
    if (value) {
      localStorage.setItem(PREF_AUTO_PAUSE_PLANTING, 'true');
    } else {
      localStorage.removeItem(PREF_AUTO_PAUSE_PLANTING);
    }
  } catch { /* quota exceeded — ignore */ }
}

/** Track previous planting options for change detection. */
let _prevPlantableKey = '';
let _prevMonth = -1;

/** Build a comparable key from current planting options. */
function getPlantableKey(state: GameState): string {
  const crops = getAvailableCrops(state);
  const isFall = state.calendar.season === 'fall';
  return crops.join(',') + (isFall ? ',cover' : '');
}

// ============================================================================
// State Publishing
// ============================================================================

/** Publish live state to the reactive signal (creates a deep clone for reactivity). */
function publishState(): void {
  if (_liveState) {
    gameState.value = structuredClone(_liveState);
  } else {
    gameState.value = null;
  }
}

// ============================================================================
// Computed Signals
// ============================================================================

export const currentDay = computed(() => gameState.value?.calendar.totalDay ?? 0);
export const currentCash = computed(() => gameState.value?.economy.cash ?? 0);
export const currentSpeed = computed(() => gameState.value?.speed ?? 0);
export const isPaused = computed(() => (gameState.value?.speed ?? 0) === 0);
export const isGameOver = computed(() => gameState.value?.gameOver ?? false);
export const autoPauseQueue = computed(() => gameState.value?.autoPauseQueue ?? []);
export const hasAutoPause = computed(() => (gameState.value?.autoPauseQueue.length ?? 0) > 0);
export const notifications = computed(() => gameState.value?.notifications ?? []);
export const yearEndSummaryPending = computed(() => gameState.value?.yearEndSummaryPending ?? false);

export const selectedCellData = computed<Cell | null>(() => {
  const state = gameState.value;
  const sel = selectedCell.value;
  if (!state || !sel) return null;
  return state.grid[sel.row]?.[sel.col] ?? null;
});

export const availableCrops = computed(() => {
  const state = gameState.value;
  if (!state) return [] as string[];
  return getAvailableCrops(state);
});

export const grid = computed(() => gameState.value?.grid ?? []);

// ============================================================================
// Types
// ============================================================================

export type ConfirmActionId =
  | 'plant-single'
  | 'plant-all'
  | 'plant-partial'
  | 'water-all'
  | 'water-partial'
  | 'cover-crop-all'
  | 'cover-crop-partial'
  | 'remove-crop'
  | 'return-to-title';

export type ConfirmOrigin = 'manual' | 'autopause';

export interface ConfirmDialogState {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  actionId: ConfirmActionId;
  origin: ConfirmOrigin;
}

// ============================================================================
// Game Lifecycle
// ============================================================================

export function startNewGame(playerId: string, scenarioId?: string): void {
  const trimmed = playerId.trim().slice(0, 30);
  if (!trimmed) return;

  // Set active scenario (default: random from recently-unplayed pool)
  if (scenarioId && SCENARIOS[scenarioId]) {
    _activeScenario = SCENARIOS[scenarioId];
  } else {
    _activeScenario = pickScenario();
  }

  // Pick from curated seed pool for a validated event experience
  const pool = CURATED_SEEDS[_activeScenario.id];
  if (pool && pool.length > 0) {
    const seed = pool[Math.floor(Math.random() * pool.length)];
    _activeScenario = { ..._activeScenario, seed };
  }

  _liveState = createInitialState(trimmed, _activeScenario);
  logSessionStart(_liveState);
  _prevPlantableKey = getPlantableKey(_liveState);
  _prevMonth = _liveState.calendar.month;
  batch(() => {
    publishState();
    screen.value = 'playing';
    selectedCell.value = null;
    cropMenuOpen.value = false;
    confirmDialog.value = null;
    currentWeather.value = null;
    saveError.value = null;
    needsPlayPrompt.value = false;
    pendingFollowUp.value = null;
    tutorialStep.value = isTutorialDismissed() ? -1 : 0;
  });
}

export function resumeGame(): void {
  const state = loadAutoSave();
  if (!state) return;

  _activeScenario = resolveScenario(state.scenarioId, state);
  _liveState = state;
  logSessionStart(_liveState);
  _prevPlantableKey = getPlantableKey(_liveState);
  _prevMonth = _liveState.calendar.month;
  batch(() => {
    publishState();
    screen.value = 'playing';
    selectedCell.value = null;
    cropMenuOpen.value = false;
    confirmDialog.value = null;
    saveError.value = null;
    needsPlayPrompt.value = false;
    pendingFollowUp.value = null;
    tutorialStep.value = -1;
  });
}

export function canResume(): boolean {
  return hasSaveData();
}

export function canLoadSaves(): boolean {
  return hasManualSaves();
}

export function returnToTitle(): void {
  stopGameLoop();
  _liveState = null;
  batch(() => {
    publishState();
    screen.value = 'new-game';
    selectedCell.value = null;
    cropMenuOpen.value = false;
    confirmDialog.value = null;
    currentWeather.value = null;
    needsPlayPrompt.value = false;
    pendingFollowUp.value = null;
  });
}

// ============================================================================
// Command Dispatch
// ============================================================================

export function dispatch(command: Command): CommandResult {
  if (!_liveState) return { success: false, reason: 'No active game.' };

  const result = processCommand(_liveState, command, _activeScenario);
  // #50: Clear play prompt when speed increases; show it when paused and taking actions
  if (command.type === 'SET_SPEED' && command.speed > 0) {
    needsPlayPrompt.value = false;
  } else if (command.type !== 'SET_SPEED') {
    maybeShowPlayPrompt();
  }
  publishState();
  return result;
}

/** #50: Show play prompt if game is paused and player just took an action */
function maybeShowPlayPrompt(): void {
  if (_liveState && _liveState.speed === 0 && _liveState.autoPauseQueue.length === 0) {
    needsPlayPrompt.value = true;
  }
}

// ============================================================================
// Cell Selection
// ============================================================================

export function selectCell(row: number, col: number): void {
  const current = selectedCell.value;
  if (current && current.row === row && current.col === col) {
    batch(() => {
      selectedCell.value = null;
      cropMenuOpen.value = false;
    });
  } else {
    batch(() => {
      selectedCell.value = { row, col };
      cropMenuOpen.value = false;
    });
  }
}

export function deselectCell(): void {
  batch(() => {
    selectedCell.value = null;
    cropMenuOpen.value = false;
  });
}

// ============================================================================
// Crop Menu
// ============================================================================

export function openCropMenu(): void {
  cropMenuOpen.value = true;
}

export function closeCropMenu(): void {
  cropMenuOpen.value = false;
}

export function plantCrop(cropId: string): void {
  const sel = selectedCell.value;
  if (!sel || !_liveState) return;

  const cropDef = getCropDefinition(cropId);

  // #71: First perennial warning
  if (cropDef.type === 'perennial' && !_liveState.flags['perennialWarningShown']) {
    const yrs = cropDef.yearsToEstablish ?? 3;
    confirmDialog.value = {
      message: `Plant ${cropDef.name}? These trees take ${yrs} years to produce their first harvest. You won't see revenue from them until Year ${_liveState.calendar.year + yrs}. Cost: $${cropDef.seedCostPerAcre}.`,
      onConfirm: () => {
        if (!_liveState) return;
        _liveState.flags['perennialWarningShown'] = true;
        const result = dispatch({ type: 'PLANT_CROP', cellRow: sel.row, cellCol: sel.col, cropId });
        confirmDialog.value = null;
        if (result.success) cropMenuOpen.value = false;
      },
      onCancel: () => { confirmDialog.value = null; },
      actionId: 'plant-single',
      origin: 'manual',
    };
    return;
  }

  const result = dispatch({ type: 'PLANT_CROP', cellRow: sel.row, cellCol: sel.col, cropId });
  if (result.success) {
    cropMenuOpen.value = false;
  }
}

// ============================================================================
// Bulk Operations
// ============================================================================

export function plantBulk(scope: 'all' | 'row' | 'col', cropId: string, index?: number): void {
  if (!_liveState) return;

  if (scope === 'all') {
    // SPEC §2.3: Always show confirmation for field-scope plant
    const cropDef = getCropDefinition(cropId);
    const emptyCells = _liveState.grid.flat().filter(c => c.crop === null);
    if (emptyCells.length === 0) {
      addNotification(_liveState, 'info', 'All plots are already planted.');
      publishState();
      return;
    }

    // Check how many fully-empty rows exist (DD-1)
    const fullRowCells: Cell[] = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      const rowEmpty = _liveState.grid[r].filter(c => c.crop === null);
      if (rowEmpty.length === GRID_COLS) {
        fullRowCells.push(...rowEmpty);
      }
    }

    if (fullRowCells.length === 0) {
      // No fully empty rows — route through engine for proper error feedback
      const result = processCommand(_liveState, { type: 'PLANT_BULK', scope: 'all', cropId }, _activeScenario);
      if (!result.success) {
        addNotification(_liveState, 'info', result.reason ?? 'No fully empty rows available. Use "Plant Row" to fill specific rows.');
        publishState();
      }
      return;
    }

    const costPerCell = cropDef.seedCostPerAcre;
    const totalCost = fullRowCells.length * costPerCell;

    if (_liveState.economy.cash >= totalCost) {
      // Can afford all full rows — confirm, then route through processCommand
      // so all engine validation (planting window, cash, etc.) applies at execution time
      // #71: Enhance message for first perennial plant
      const isPerennialFirst = cropDef.type === 'perennial' && !_liveState.flags['perennialWarningShown'];
      const perennialNote = isPerennialFirst
        ? ` These trees take ${cropDef.yearsToEstablish ?? 3} years to produce their first harvest. You won't see revenue from them until Year ${_liveState.calendar.year + (cropDef.yearsToEstablish ?? 3)}.`
        : '';
      confirmDialog.value = {
        message: `Plant ${fullRowCells.length} plots (fully empty rows only) with ${cropDef.name} for $${totalCost.toLocaleString()}?${perennialNote}`,
        onConfirm: () => {
          if (!_liveState) return;
          if (isPerennialFirst) _liveState.flags['perennialWarningShown'] = true;
          processCommand(_liveState, { type: 'PLANT_BULK', scope: 'all', cropId }, _activeScenario);
          confirmDialog.value = null;
          publishState();
          maybeShowPlayPrompt();
        },
        onCancel: () => { confirmDialog.value = null; },
        actionId: 'plant-all',
        origin: 'manual',
      };
      return;
    }

    // Cannot afford all — delegate to engine for partial offer
    const result = processCommand(_liveState, { type: 'PLANT_BULK', scope, cropId }, _activeScenario);

    if (result.partialOffer) {
      const offer = result.partialOffer;
      const isPerennialFirstPartial = cropDef.type === 'perennial' && !_liveState.flags['perennialWarningShown'];
      const perennialNotePartial = isPerennialFirstPartial
        ? ` These trees take ${cropDef.yearsToEstablish ?? 3} years to produce their first harvest.`
        : '';
      confirmDialog.value = {
        message: `You can afford to plant ${offer.affordableRows} full row${offer.affordableRows > 1 ? 's' : ''} (${offer.affordablePlots} plots) for $${offer.totalCost.toLocaleString()}. Plant ${offer.affordableRows} row${offer.affordableRows > 1 ? 's' : ''}?${perennialNotePartial}`,
        onConfirm: () => {
          if (!_liveState) return;
          if (isPerennialFirstPartial) _liveState.flags['perennialWarningShown'] = true;
          const cells: Cell[] = [];
          let rowsCollected = 0;
          for (let r = 0; r < GRID_ROWS && rowsCollected < offer.affordableRows; r++) {
            const rowEmpty = _liveState.grid[r].filter(c => c.crop === null);
            if (rowEmpty.length === GRID_COLS) {
              cells.push(...rowEmpty);
              rowsCollected++;
            }
          }
          executeBulkPlant(_liveState, cells, cropId, costPerCell);
          confirmDialog.value = null;
          publishState();
          maybeShowPlayPrompt();
        },
        onCancel: () => { confirmDialog.value = null; },
        actionId: 'plant-partial',
        origin: 'manual',
      };
      return;
    }

    publishState();
    return;
  }

  // Row/Column scope: no confirmation needed (all-or-nothing per DD-1)
  // But #71: still show perennial warning on first perennial plant
  const rowColCropDef = getCropDefinition(cropId);
  const isPerennialFirstRowCol = rowColCropDef.type === 'perennial' && !_liveState.flags['perennialWarningShown'];
  if (isPerennialFirstRowCol) {
    const yrs = rowColCropDef.yearsToEstablish ?? 3;
    confirmDialog.value = {
      message: `Plant ${rowColCropDef.name}? These trees take ${yrs} years to produce their first harvest. You won't see revenue from them until Year ${_liveState.calendar.year + yrs}.`,
      onConfirm: () => {
        if (!_liveState) return;
        _liveState.flags['perennialWarningShown'] = true;
        processCommand(_liveState, { type: 'PLANT_BULK', scope, cropId, index }, _activeScenario);
        confirmDialog.value = null;
        publishState();
        maybeShowPlayPrompt();
      },
      onCancel: () => { confirmDialog.value = null; },
      actionId: 'plant-all',
      origin: 'manual',
    };
    return;
  }

  const result = processCommand(_liveState, { type: 'PLANT_BULK', scope, cropId, index }, _activeScenario);
  if (result.success) {
    publishState();
    maybeShowPlayPrompt();
  } else if (result.reason && result.reason !== 'partial') {
    addNotification(_liveState, 'info', result.reason);
    publishState();
  }
}

export function harvestBulk(scope: 'all' | 'row' | 'col', index?: number): void {
  dispatch({ type: 'HARVEST_BULK', scope, index });
}

export type WaterBulkResult = 'applied_full' | 'applied_partial' | 'failed';

export function waterBulk(scope: 'all' | 'row' | 'col', index?: number, opts?: { skipConfirm?: boolean }): WaterBulkResult | void {
  if (!_liveState) return;

  if (scope === 'all') {
    const plantedCells = _liveState.grid.flat().filter(c => c.crop !== null);
    if (plantedCells.length === 0) {
      processCommand(_liveState, { type: 'WATER', scope }, _activeScenario);
      publishState();
      return opts?.skipConfirm ? 'failed' : undefined;
    }

    const costMultiplier = getIrrigationCostMultiplier(_liveState);
    const effectiveCostPerCell = IRRIGATION_COST_PER_CELL * costMultiplier;
    const totalCost = plantedCells.length * effectiveCostPerCell;

    // #52: Skip confirm when called from auto-pause (single-action water)
    if (opts?.skipConfirm) {
      if (_liveState.economy.cash >= totalCost) {
        // Can afford all
        processCommand(_liveState, { type: 'WATER', scope: 'all' }, _activeScenario);
        publishState();
        return 'applied_full';
      }
      // Try partial — route through engine for partial offer
      const result = processCommand(_liveState, { type: 'WATER', scope }, _activeScenario);
      if (result.partialOffer) {
        const offer = result.partialOffer;
        const cells: Cell[] = [];
        let rowsCollected = 0;
        for (let r = 0; r < GRID_ROWS && rowsCollected < offer.affordableRows; r++) {
          const rowPlanted = _liveState.grid[r].filter(c => c.crop !== null);
          if (rowPlanted.length > 0) {
            cells.push(...rowPlanted);
            rowsCollected++;
          }
        }
        executeWater(_liveState, cells, _activeScenario);
        addNotification(_liveState, 'info', `Watered ${cells.length} of ${plantedCells.length} plots. Insufficient funds for remaining.`);
        publishState();
        return 'applied_partial';
      }
      // Can't afford any
      addNotification(_liveState, 'info', `Cannot afford irrigation ($${effectiveCostPerCell} per plot).`);
      publishState();
      return 'failed';
    }

    // SPEC §2.6: Manual path — always show confirmation for field-scope water
    if (_liveState.economy.cash >= totalCost) {
      // Can afford all — confirm, then route through processCommand
      confirmDialog.value = {
        message: `Water all ${plantedCells.length} planted plots for $${totalCost.toLocaleString()}?`,
        onConfirm: () => {
          if (!_liveState) return;
          processCommand(_liveState, { type: 'WATER', scope: 'all' }, _activeScenario);
          confirmDialog.value = null;
          publishState();
          maybeShowPlayPrompt();
        },
        onCancel: () => { confirmDialog.value = null; },
        actionId: 'water-all',
        origin: 'manual',
      };
      return;
    }

    // Cannot afford all — delegate to engine for partial offer
    const result = processCommand(_liveState, { type: 'WATER', scope }, _activeScenario);

    if (result.partialOffer) {
      const offer = result.partialOffer;
      confirmDialog.value = {
        message: `You can afford to water ${offer.affordableRows} row${offer.affordableRows > 1 ? 's' : ''} (${offer.affordablePlots} plots) for $${offer.totalCost.toLocaleString()}. Water ${offer.affordableRows} row${offer.affordableRows > 1 ? 's' : ''}?`,
        onConfirm: () => {
          if (!_liveState) return;
          const cells: Cell[] = [];
          let rowsCollected = 0;
          for (let r = 0; r < GRID_ROWS && rowsCollected < offer.affordableRows; r++) {
            const rowPlanted = _liveState.grid[r].filter(c => c.crop !== null);
            if (rowPlanted.length > 0) {
              cells.push(...rowPlanted);
              rowsCollected++;
            }
          }
          executeWater(_liveState, cells, _activeScenario);
          confirmDialog.value = null;
          publishState();
          maybeShowPlayPrompt();
        },
        onCancel: () => { confirmDialog.value = null; },
        actionId: 'water-partial',
        origin: 'manual',
      };
      return;
    }

    publishState();
    return;
  }

  // Row/Column scope
  const result = processCommand(_liveState, { type: 'WATER', scope, index }, _activeScenario);
  if (result.success) {
    publishState();
    maybeShowPlayPrompt();
  }
}

export function coverCropBulk(scope: 'all' | 'row' | 'col', coverCropId: string, index?: number): void {
  if (!_liveState) return;

  if (scope === 'all') {
    const def = getCoverCropDefinition(coverCropId);
    // Count eligible cells for cost estimate
    const eligible: Cell[] = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const cell = _liveState.grid[r][c];
        if (!cell.coverCropId && isCoverCropEligibleUI(cell)) {
          eligible.push(cell);
        }
      }
    }
    if (eligible.length === 0) return;

    const totalCost = eligible.length * def.seedCostPerAcre;

    if (_liveState.economy.cash >= totalCost) {
      confirmDialog.value = {
        message: `Plant cover crops on all ${eligible.length} eligible plots for $${totalCost.toLocaleString()}?`,
        onConfirm: () => {
          if (!_liveState) return;
          processCommand(_liveState, { type: 'SET_COVER_CROP_BULK', scope: 'all', coverCropId }, _activeScenario);
          confirmDialog.value = null;
          publishState();
          maybeShowPlayPrompt();
        },
        onCancel: () => { confirmDialog.value = null; },
        actionId: 'cover-crop-all',
        origin: 'manual',
      };
      return;
    }

    // Cannot afford all — delegate to engine for partial offer
    const result = processCommand(_liveState, { type: 'SET_COVER_CROP_BULK', scope, coverCropId }, _activeScenario);

    if (result.partialOffer) {
      const offer = result.partialOffer;
      const costPerCell = def.seedCostPerAcre;
      confirmDialog.value = {
        message: `You can afford to cover ${offer.affordableRows} row${offer.affordableRows > 1 ? 's' : ''} (${offer.affordablePlots} plots) for $${offer.totalCost.toLocaleString()}. Plant cover crops on ${offer.affordableRows} row${offer.affordableRows > 1 ? 's' : ''}?`,
        onConfirm: () => {
          if (!_liveState) return;
          const cells: Cell[] = [];
          let rowsCollected = 0;
          for (let r = 0; r < GRID_ROWS && rowsCollected < offer.affordableRows; r++) {
            const rowEligible = _liveState.grid[r].filter(c =>
              !c.coverCropId && isCoverCropEligibleUI(c),
            );
            if (rowEligible.length > 0) {
              cells.push(...rowEligible);
              rowsCollected++;
            }
          }
          executeBulkCoverCrop(_liveState, cells, coverCropId, costPerCell);
          confirmDialog.value = null;
          publishState();
          maybeShowPlayPrompt();
        },
        onCancel: () => { confirmDialog.value = null; },
        actionId: 'cover-crop-partial',
        origin: 'manual',
      };
      return;
    }

    publishState();
    return;
  }

  // Row/Column scope: no confirmation needed
  const result = processCommand(_liveState, { type: 'SET_COVER_CROP_BULK', scope, coverCropId, index }, _activeScenario);
  if (result.success) {
    publishState();
    maybeShowPlayPrompt();
  }
}

/** UI-side eligibility check for cover crops (mirrors engine's isCoverCropEligible). */
function isCoverCropEligibleUI(cell: Cell): boolean {
  if (!cell.crop) return true;
  if (!cell.crop.isPerennial) return false;
  const def = getCropDefinition(cell.crop.cropId);
  return (def.dormantSeasons?.length ?? 0) > 0;
}

// ============================================================================
// Auto-Pause
// ============================================================================

export function handleDismissAutoPause(): void {
  if (!_liveState) return;

  dismissAutoPause(_liveState);

  if (_liveState.yearEndSummaryPending && _liveState.autoPauseQueue.length === 0) {
    resetYearlyTracking(_liveState);
    // #54: Advance display calendar to next day (Year N+1) without changing totalDay.
    // simulateTick reads totalDay as prevTotalDay and recomputes the full calendar,
    // so these display fields are overwritten on the next tick. No day skip.
    const nextCal = totalDayToCalendar(_liveState.calendar.totalDay + 1);
    _liveState.calendar.year = nextCal.year;
    _liveState.calendar.month = nextCal.month;
    _liveState.calendar.day = nextCal.day;
    _liveState.calendar.season = nextCal.season;
  }

  if (_liveState.gameOver && _liveState.autoPauseQueue.length === 0) {
    screen.value = 'game-over';
  }

  // #50: Show play prompt if paused after dismissing
  if (_liveState.speed === 0 && _liveState.autoPauseQueue.length === 0) {
    needsPlayPrompt.value = true;
  }

  publishState();
}

/**
 * Decline the emergency loan — pushes a bankruptcy auto-pause so the
 * reflection/game-over panel shows before returning to title. (#88)
 */
export function declineLoan(): void {
  if (!_liveState) return;
  _liveState.gameOverReason = 'bankruptcy';
  _liveState.autoPauseQueue.push({
    reason: 'bankruptcy',
    message: 'You declined the emergency loan. Without funding, the farm cannot continue.',
    data: {
      cash: _liveState.economy.cash,
      debt: _liveState.economy.debt,
      yearlyRevenue: _liveState.economy.yearlyRevenue,
      yearlyExpenses: _liveState.economy.yearlyExpenses,
    },
  });
  dismissAutoPause(_liveState);
  publishState();
}

// ============================================================================
// Notifications
// ============================================================================

export function handleDismissNotification(id: number): void {
  if (!_liveState) return;
  dismissNotification(_liveState, id);
  publishState();
}

// ============================================================================
// Tutorial
// ============================================================================

export function advanceTutorial(): void {
  const step = tutorialStep.value;
  if (step >= 2) {
    tutorialStep.value = -1;
  } else {
    tutorialStep.value = step + 1;
  }
}

export function skipTutorial(): void {
  tutorialStep.value = -1;
}

export function dismissTutorialPermanently(dismiss: boolean): void {
  setTutorialDismissed(dismiss);
  if (dismiss) {
    tutorialStep.value = -1;
  }
}

// ============================================================================
// Save
// ============================================================================

export function handleSave(): void {
  if (!_liveState) return;

  // Auto-save (for Continue button)
  autoSave(_liveState);

  // Manual save with deterministic name (SPEC §6.2).
  // Uses Year+Season as key so saves within the same season overwrite,
  // preventing unbounded slot accumulation (max ~120 across 30 years).
  const cal = _liveState.calendar;
  const seasonName = getSeasonName(cal.season);
  const slotName = `Year ${cal.year} ${seasonName}`;
  const result = saveGame(_liveState, slotName);

  if (!result.success) {
    saveError.value = result.error ?? 'Failed to save game.';
  } else {
    saveError.value = null;
    addNotification(_liveState, 'info', 'Game saved.');
    publishState();
  }
}

export function loadSavedGame(slotName: string): void {
  const state = loadGame(slotName);
  if (!state) return;

  _activeScenario = resolveScenario(state.scenarioId, state);
  _liveState = state;
  logSessionStart(_liveState);
  _prevPlantableKey = getPlantableKey(_liveState);
  _prevMonth = _liveState.calendar.month;
  autoSave(_liveState); // #68: sync autosave to loaded manual save
  batch(() => {
    publishState();
    screen.value = 'playing';
    selectedCell.value = null;
    cropMenuOpen.value = false;
    confirmDialog.value = null;
    saveError.value = null;
    tutorialStep.value = -1;
  });
}

export function handleDeleteSave(slotName: string): void {
  deleteSave(slotName);
}

export function getManualSaves(): SaveSlotInfo[] {
  return listManualSaves();
}

// ============================================================================
// Game Loop
// ============================================================================

let loopHandle: number | null = null;
let lastFrameTime = 0;
let tickAccumulator = 0;
let lastSeasonAutoSaveDay = -1;

const BASE_TICKS_PER_SECOND = 12;

export function startGameLoop(): void {
  if (loopHandle !== null) return;
  lastFrameTime = performance.now();
  tickAccumulator = 0;
  loopHandle = requestAnimationFrame(gameLoop);
}

export function stopGameLoop(): void {
  if (loopHandle !== null) {
    cancelAnimationFrame(loopHandle);
    loopHandle = null;
  }
}

function gameLoop(now: number): void {
  if (!_liveState || screen.value !== 'playing') {
    loopHandle = requestAnimationFrame(gameLoop);
    return;
  }

  const speed = _liveState.speed;

  if (speed > 0 && _liveState.autoPauseQueue.length === 0 && !_liveState.gameOver) {
    const dt = Math.min(now - lastFrameTime, 100);
    const ticksPerSecond = BASE_TICKS_PER_SECOND * speed;
    tickAccumulator += (dt / 1000) * ticksPerSecond;

    const maxTicksPerFrame = Math.ceil(ticksPerSecond / 30);
    let ticksThisFrame = 0;
    let lastWeather: DailyWeather | null = null;

    while (tickAccumulator >= 1 && ticksThisFrame < maxTicksPerFrame) {
      const prevDay = _liveState.calendar.totalDay;

      const weather = simulateTick(_liveState, _activeScenario);
      if (weather) lastWeather = weather;
      ticksThisFrame++;
      tickAccumulator--;

      // Auto-save on season change
      if (isSeasonChange(prevDay, _liveState.calendar.totalDay) && _liveState.calendar.totalDay !== lastSeasonAutoSaveDay) {
        lastSeasonAutoSaveDay = _liveState.calendar.totalDay;
        autoSave(_liveState);
      }

      // Auto-pause at calendar planting windows (6d.3 QoL) — check at every month boundary
      if (autoPausePlanting.value && _liveState.calendar.month !== _prevMonth && _prevMonth !== -1) {
        const plantableKey = getPlantableKey(_liveState);
        if (_prevPlantableKey && plantableKey !== _prevPlantableKey) {
          const season = _liveState.calendar.season;
          _liveState.autoPauseQueue.push({
            reason: 'planting_options',
            message: season === 'fall'
              ? 'Planting window: fall crops and cover crops are now available.'
              : `Planting window: ${season.charAt(0).toUpperCase() + season.slice(1)} crop options have changed.`,
          });
        }
        _prevPlantableKey = plantableKey;
      }
      _prevMonth = _liveState.calendar.month;

      if (_liveState.autoPauseQueue.length > 0 || _liveState.gameOver) {
        tickAccumulator = 0;
        break;
      }
    }

    if (ticksThisFrame > 0) {
      if (lastWeather) currentWeather.value = lastWeather;
      publishState();
    }
  }

  lastFrameTime = now;
  loopHandle = requestAnimationFrame(gameLoop);
}

// ============================================================================
// Debug Hook — Playwright tests and classroom debugging.
// Negligible size; no runtime cost unless called.
// ============================================================================
(window as unknown as Record<string, unknown>).__gameDebug = {
  setCash(amount: number) {
    if (!_liveState) return;
    _liveState.economy.cash = amount;
    publishState();
  },
  /**
   * Set the calendar to a specific total day. Test setup only — does not
   * resync RNG, resimulate weather/crops, or trigger auto-saves.
   */
  setDay(totalDay: number) {
    if (!_liveState) return;
    _liveState.calendar = totalDayToCalendar(totalDay);
    publishState();
  },
  setDebt(amount: number) {
    if (!_liveState) return;
    _liveState.economy.debt = amount;
    publishState();
  },
  setTotalLoansReceived(count: number) {
    if (!_liveState) return;
    _liveState.economy.totalLoansReceived = count;
    publishState();
  },
  setFlag(flag: string, value: boolean) {
    if (!_liveState) return;
    _liveState.flags[flag] = value;
    publishState();
  },
  /** Inject an event directly — bypasses RNG/conditions. For testing. */
  triggerEvent(storyletId: string) {
    if (!_liveState) return false;
    const storylet = STORYLETS.find(s => s.id === storyletId);
    if (!storylet) return false;
    _liveState.activeEvent = {
      storyletId: storylet.id,
      title: storylet.title,
      description: storylet.description,
      choices: storylet.choices,
      firedOnDay: _liveState.calendar.totalDay,
    };
    _liveState.speed = 0;
    _liveState.autoPauseQueue.push({
      reason: storylet.advisorId ? 'advisor' : 'event',
      message: storylet.title,
    });
    publishState();
    return true;
  },
  getState() {
    return _liveState;
  },
  /** Force a state publish after direct _liveState mutations. Test utility. */
  publish() {
    publishState();
  },
  /** Get the active scenario ID. */
  getScenarioId() {
    return _activeScenario.id;
  },
  /** Switch the active scenario by ID. Test utility. */
  setScenario(scenarioId: string) {
    if (SCENARIOS[scenarioId]) {
      _activeScenario = SCENARIOS[scenarioId];
      return true;
    }
    return false;
  },
  /**
   * Run N simulation ticks synchronously, bypassing requestAnimationFrame.
   * Auto-dismisses non-event auto-pauses (year-end, water stress, harvest).
   * Stops early if an event/advisor auto-pause fires and returns 'event'.
   * Returns 'done' if all ticks completed, 'gameover' if game ended.
   */
  fastForward(ticks: number): 'done' | 'event' | 'gameover' {
    if (!_liveState) return 'done';
    for (let i = 0; i < ticks; i++) {
      _liveState.speed = 4; // ensure running
      simulateTick(_liveState, _activeScenario);
      // Check for event auto-pause — stop and let the test handle it.
      // Advisors are auto-dismissed (condition-only, no foreshadowing).
      const eventPause = _liveState.autoPauseQueue.find(e => e.reason === 'event');
      if (eventPause) {
        publishState();
        return 'event';
      }
      // Check game over
      if (_liveState.gameOver) {
        publishState();
        return 'gameover';
      }
      // Auto-dismiss other pauses (year-end, water stress, harvest, loan, advisor)
      while (_liveState.autoPauseQueue.length > 0) {
        const pause = _liveState.autoPauseQueue[0];
        if (pause.reason === 'loan_offer') {
          processCommand(_liveState, { type: 'TAKE_LOAN' }, _activeScenario);
        }
        dismissAutoPause(_liveState);
      }
      // Handle year-end reset (mirrors handleDismissAutoPause in adapter)
      if (_liveState.yearEndSummaryPending && _liveState.autoPauseQueue.length === 0) {
        resetYearlyTracking(_liveState);
      }
      _liveState.speed = 4; // re-enable after auto-pause
    }
    publishState();
    return 'done';
  },
  // --- Observer Layer (AI test agent affordances) ---
  /**
   * Returns structured blocking state for AI agents.
   * Single call answers: am I blocked? Why? What testids dismiss it?
   */
  getBlockingState() {
    if (!_liveState) return { blocked: false, speed: 0, notificationCount: 0, year: 0, season: 'spring', day: 0 };
    return getBlockingState(_liveState);
  },
  /**
   * Run ticks until ANY autopause fires or game ends. Unlike fastForward(),
   * does NOT auto-dismiss any pauses — stops and returns what blocked it.
   */
  fastForwardUntilBlocked(maxTicks: number) {
    if (!_liveState) return { stopped: false, ticksRun: 0 };
    const result = fastForwardUntilBlocked(_liveState, _activeScenario, maxTicks);
    publishState();
    return result;
  },
  /** Return all notifications (AI agents normally only see the newest). */
  getNotifications() {
    if (!_liveState) return [];
    return getNotificationsDebug(_liveState);
  },
  /** Clear all notifications. Prevents backlog confusion in AI test sessions. */
  dismissAllNotifications() {
    if (!_liveState) return;
    dismissAllNotificationsDebug(_liveState);
    publishState();
  },
};
