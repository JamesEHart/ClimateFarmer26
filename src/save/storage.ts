import type { GameState, SaveGame } from '../engine/types.ts';
import { SAVE_VERSION, GRID_ROWS, GRID_COLS, EVENT_RNG_SEED_OFFSET, STARTING_POTASSIUM, createEmptyTrackingState } from '../engine/types.ts';
import { SLICE_1_SCENARIO } from '../data/scenario.ts';

// ============================================================================
// Storage Keys
// ============================================================================

export const AUTOSAVE_KEY = 'climateFarmer_autosave';
const MANUAL_SAVE_PREFIX = 'climateFarmer_save_';
const TUTORIAL_DISMISSED_KEY = 'climateFarmer_tutorialDismissed';

// ============================================================================
// Save Operations
// ============================================================================

export interface SaveResult {
  success: boolean;
  error?: string;
}

export function autoSave(state: GameState): SaveResult {
  return writeSave(AUTOSAVE_KEY, state);
}

export function saveGame(state: GameState, slotName: string): SaveResult {
  return writeSave(MANUAL_SAVE_PREFIX + slotName, state);
}

function writeSave(key: string, state: GameState): SaveResult {
  const saveData: SaveGame = {
    version: SAVE_VERSION,
    state,
    timestamp: Date.now(),
  };

  try {
    localStorage.setItem(key, JSON.stringify(saveData));
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// ============================================================================
// Load Operations
// ============================================================================

export function loadAutoSave(): GameState | null {
  return readSave(AUTOSAVE_KEY);
}

export function loadGame(slotName: string): GameState | null {
  return readSave(MANUAL_SAVE_PREFIX + slotName);
}

function readSave(key: string): GameState | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!validateSave(parsed)) {
      // Helper: apply V8→V9
      const finishV8 = (v8State: GameState | null): GameState | null => {
        if (!v8State) return null;
        const v8Save = { version: '8.0.0', state: v8State, timestamp: (parsed as SaveGame).timestamp ?? Date.now() } as unknown as SaveGame;
        return migrateV8ToV9(v8Save);
      };
      // Helper: apply V7→V8→V9
      const finishV7 = (v7State: GameState | null): GameState | null => {
        if (!v7State) return null;
        const v7Save = { version: '7.0.0', state: v7State, timestamp: (parsed as SaveGame).timestamp ?? Date.now() } as unknown as SaveGame;
        return finishV8(migrateV7ToV8(v7Save));
      };
      // Helper: apply V6→V7→V8→V9 chain
      const finishV6 = (v6State: GameState | null): GameState | null => {
        if (!v6State) return null;
        const v6Save = { version: '6.0.0', state: v6State, timestamp: (parsed as SaveGame).timestamp ?? Date.now() } as unknown as SaveGame;
        return finishV7(migrateV6ToV7(v6Save));
      };
      // Helper: apply V5→V6→V7→V8→V9 chain
      const finishV5 = (v5State: GameState | null): GameState | null => {
        if (!v5State) return null;
        const v5Save = { version: '5.0.0', state: v5State, timestamp: (parsed as SaveGame).timestamp ?? Date.now() } as unknown as SaveGame;
        return finishV6(migrateV5ToV6(v5Save));
      };

      // Try v8 → v9 migration
      if (isV8Save(parsed)) {
        return migrateV8ToV9(parsed);
      }
      // Try v7 → v8 → v9 migration
      if (isV7Save(parsed)) {
        return finishV7(migrateV7ToV8(parsed));
      }
      // Try v6 → v7 → v8 → v9 chain
      if (isV6Save(parsed)) {
        return finishV6(migrateV6ToV7(parsed));
      }
      // Try v5 → v6 → ... → v9 chain
      if (isV5Save(parsed)) {
        return finishV5(migrateV5ToV6(parsed));
      }
      // Try v4 → v5 → ... → v9 chain
      if (isV4Save(parsed)) {
        return finishV5(migrateV4ToV5(parsed));
      }
      // Try v3 → v4 → ... → v9 chain
      if (isV3Save(parsed)) {
        const v4State = migrateV3ToV4(parsed);
        if (v4State) {
          const v4Save = { version: '4.0.0', state: v4State, timestamp: (parsed as SaveGame).timestamp ?? Date.now() } as unknown as SaveGame;
          return finishV5(migrateV4ToV5(v4Save));
        }
      }
      // Try v2 → v3 → ... → v9 chain
      if (isV2Save(parsed)) {
        const v3State = migrateV2ToV3(parsed);
        if (v3State) {
          const v3Save = { version: '3.0.0', state: v3State, timestamp: (parsed as SaveGame).timestamp ?? Date.now() } as unknown as SaveGame;
          const v4State = migrateV3ToV4(v3Save);
          if (v4State) {
            const v4Save = { version: '4.0.0', state: v4State, timestamp: (parsed as SaveGame).timestamp ?? Date.now() } as unknown as SaveGame;
            return finishV5(migrateV4ToV5(v4Save));
          }
        }
      }
      // Try v1 → v2 → ... → v9 chain
      if (isV1Save(parsed)) {
        const v2State = migrateV1ToV2(parsed);
        if (v2State) {
          const v2Save = { version: '2.0.0', state: v2State, timestamp: Date.now() } as unknown as SaveGame;
          const v3State = migrateV2ToV3(v2Save);
          if (v3State) {
            const v3Save = { version: '3.0.0', state: v3State, timestamp: Date.now() } as unknown as SaveGame;
            const v4State = migrateV3ToV4(v3Save);
            if (v4State) {
              const v4Save = { version: '4.0.0', state: v4State, timestamp: Date.now() } as unknown as SaveGame;
              return finishV5(migrateV4ToV5(v4Save));
            }
          }
        }
      }
      return null;
    }

    return parsed.state;
  } catch {
    return null;
  }
}

// ============================================================================
// Save Management
// ============================================================================

/** Returns true only if a valid auto-save exists (powers the "Continue" button). */
export function hasSaveData(): boolean {
  return loadAutoSave() !== null;
}

/** Returns true if any named manual saves exist (powers the "Load Game" button). */
export function hasManualSaves(): boolean {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(MANUAL_SAVE_PREFIX)) return true;
  }
  return false;
}

export interface SaveSlotInfo {
  slotName: string;
  timestamp: number;
  playerId: string;
  day: number;
  year: number;
}

export function listManualSaves(): SaveSlotInfo[] {
  const saves: SaveSlotInfo[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(MANUAL_SAVE_PREFIX)) continue;

    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed: unknown = JSON.parse(raw);
      const savedTimestamp = (parsed && typeof parsed === 'object' && typeof (parsed as Record<string, unknown>).timestamp === 'number')
        ? (parsed as Record<string, unknown>).timestamp as number
        : Date.now();

      // Try current-version validation first, then migration chain for older saves.
      let state: GameState | null = null;

      // Helper: apply V8→V9
      const finishV8 = (v8State: GameState | null): GameState | null => {
        if (!v8State) return null;
        const v8Save = { version: '8.0.0', state: v8State, timestamp: savedTimestamp } as unknown as SaveGame;
        return migrateV8ToV9(v8Save);
      };
      // Helper: apply V7→V8→V9
      const finishV7 = (v7State: GameState | null): GameState | null => {
        if (!v7State) return null;
        const v7Save = { version: '7.0.0', state: v7State, timestamp: savedTimestamp } as unknown as SaveGame;
        return finishV8(migrateV7ToV8(v7Save));
      };
      // Helper: apply V6→V7→V8→V9
      const finishV6 = (v6State: GameState | null): GameState | null => {
        if (!v6State) return null;
        const v6Save = { version: '6.0.0', state: v6State, timestamp: savedTimestamp } as unknown as SaveGame;
        return finishV7(migrateV6ToV7(v6Save));
      };
      // Helper: apply V5→V6→V7→V8→V9
      const finishV5 = (v5State: GameState | null): GameState | null => {
        if (!v5State) return null;
        const v5Save = { version: '5.0.0', state: v5State, timestamp: savedTimestamp } as unknown as SaveGame;
        return finishV6(migrateV5ToV6(v5Save));
      };

      if (validateSave(parsed)) {
        state = parsed.state;
      } else if (isV8Save(parsed)) {
        state = migrateV8ToV9(parsed);
      } else if (isV7Save(parsed)) {
        state = finishV7(migrateV7ToV8(parsed));
      } else if (isV6Save(parsed)) {
        state = finishV6(migrateV6ToV7(parsed));
      } else if (isV5Save(parsed)) {
        state = finishV5(migrateV5ToV6(parsed));
      } else if (isV4Save(parsed)) {
        state = finishV5(migrateV4ToV5(parsed));
      } else if (isV3Save(parsed)) {
        const v4State = migrateV3ToV4(parsed);
        if (v4State) {
          const v4Save = { version: '4.0.0', state: v4State, timestamp: savedTimestamp } as unknown as SaveGame;
          state = finishV5(migrateV4ToV5(v4Save));
        }
      } else if (isV2Save(parsed)) {
        const v3State = migrateV2ToV3(parsed);
        if (v3State) {
          const v3Save = { version: '3.0.0', state: v3State, timestamp: savedTimestamp } as unknown as SaveGame;
          const v4State = migrateV3ToV4(v3Save);
          if (v4State) {
            const v4Save = { version: '4.0.0', state: v4State, timestamp: savedTimestamp } as unknown as SaveGame;
            state = finishV5(migrateV4ToV5(v4Save));
          }
        }
      } else if (isV1Save(parsed)) {
        const v2State = migrateV1ToV2(parsed);
        if (v2State) {
          const v2Save = { version: '2.0.0', state: v2State, timestamp: savedTimestamp } as unknown as SaveGame;
          const v3State = migrateV2ToV3(v2Save);
          if (v3State) {
            const v3Save = { version: '3.0.0', state: v3State, timestamp: savedTimestamp } as unknown as SaveGame;
            const v4State = migrateV3ToV4(v3Save);
            if (v4State) {
              const v4Save = { version: '4.0.0', state: v4State, timestamp: savedTimestamp } as unknown as SaveGame;
              state = finishV5(migrateV4ToV5(v4Save));
            }
          }
        }
      }

      if (!state) continue;

      saves.push({
        slotName: key.slice(MANUAL_SAVE_PREFIX.length),
        timestamp: savedTimestamp,
        playerId: state.playerId,
        day: state.calendar.totalDay,
        year: state.calendar.year,
      });
    } catch {
      // Skip corrupted saves
    }
  }

  return saves.sort((a, b) => b.timestamp - a.timestamp);
}

export function deleteSave(slotName: string): void {
  localStorage.removeItem(MANUAL_SAVE_PREFIX + slotName);
}

export function deleteAutoSave(): void {
  localStorage.removeItem(AUTOSAVE_KEY);
}

// ============================================================================
// Tutorial Preference
// ============================================================================

export function isTutorialDismissed(): boolean {
  return localStorage.getItem(TUTORIAL_DISMISSED_KEY) === 'true';
}

export function setTutorialDismissed(dismissed: boolean): void {
  if (dismissed) {
    localStorage.setItem(TUTORIAL_DISMISSED_KEY, 'true');
  } else {
    localStorage.removeItem(TUTORIAL_DISMISSED_KEY);
  }
}

// ============================================================================
// Validation
// ============================================================================

function validateSave(data: unknown): data is SaveGame {
  if (!data || typeof data !== 'object') return false;
  const save = data as Record<string, unknown>;

  // Version check
  if (save.version !== SAVE_VERSION) return false;

  // Timestamp check
  if (typeof save.timestamp !== 'number') return false;

  // State existence
  if (!save.state || typeof save.state !== 'object') return false;
  const state = save.state as Record<string, unknown>;

  // Required state fields
  if (!state.calendar || typeof state.calendar !== 'object') return false;
  if (!state.grid || !Array.isArray(state.grid)) return false;
  if (!state.economy || typeof state.economy !== 'object') return false;
  if (typeof state.playerId !== 'string') return false;
  if (typeof state.rngState !== 'number') return false;

  // Grid dimensions check
  const grid = state.grid as unknown[][];
  if (grid.length !== GRID_ROWS) return false;
  for (const row of grid) {
    if (!Array.isArray(row) || row.length !== GRID_COLS) return false;
    for (const rawCell of row) {
      if (!rawCell || typeof rawCell !== 'object') return false;
      const cell = rawCell as Record<string, unknown>;
      if (!cell.soil || typeof cell.soil !== 'object') return false;
      const soil = cell.soil as Record<string, unknown>;
      if (typeof soil.nitrogen !== 'number' || !Number.isFinite(soil.nitrogen)) return false;
      if (typeof soil.organicMatter !== 'number' || !Number.isFinite(soil.organicMatter)) return false;
      if (typeof soil.moisture !== 'number' || !Number.isFinite(soil.moisture)) return false;
    }
  }

  // Economy values must be finite numbers
  const economy = state.economy as Record<string, unknown>;
  if (typeof economy.cash !== 'number' || !Number.isFinite(economy.cash)) return false;

  return true;
}

// ============================================================================
// V2 → V3 Migration (adds chill hours to crop instances)
// ============================================================================

function isV2Save(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const save = data as Record<string, unknown>;
  return save.version === '2.0.0';
}

/**
 * Migrate a v2 save to v3 by adding chillHoursAccumulated to all crop instances.
 * Returns null if migration fails.
 */
function migrateV2ToV3(data: unknown): GameState | null {
  try {
    const save = data as SaveGame;
    const state = save.state as GameState & Record<string, unknown>;

    // Add chillHoursAccumulated to all crop instances
    for (const row of state.grid) {
      for (const cell of row) {
        if (cell.crop) {
          if ((cell.crop as unknown as Record<string, unknown>).chillHoursAccumulated === undefined) {
            cell.crop.chillHoursAccumulated = 0;
          }
        }
      }
    }

    return state as GameState;
  } catch {
    return null;
  }
}

// ============================================================================
// V1 → V2 Migration (best-effort, minimal)
// ============================================================================

function isV1Save(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const save = data as Record<string, unknown>;
  return save.version === '1.0.0';
}

/**
 * Migrate a v1 save to v2 by filling in Slice 2a defaults.
 * Returns null if migration fails (caller should show "start new game").
 */
function migrateV1ToV2(data: unknown): GameState | null {
  try {
    const save = data as SaveGame;
    const state = save.state as GameState & Record<string, unknown>;

    // Fill missing economy fields
    if (state.economy.debt === undefined) state.economy.debt = 0;
    if (state.economy.totalLoansReceived === undefined) state.economy.totalLoansReceived = 0;
    if (state.economy.interestPaidThisYear === undefined) state.economy.interestPaidThisYear = 0;

    // Fill missing event system fields
    if (!state.eventLog) state.eventLog = [];
    if (state.activeEvent === undefined) state.activeEvent = null;
    if (!state.pendingForeshadows) state.pendingForeshadows = [];
    if (!state.activeEffects) state.activeEffects = [];
    if (state.cropFailureStreak === undefined) state.cropFailureStreak = 0;
    if (!state.flags) state.flags = {};
    if (state.wateringRestricted === undefined) state.wateringRestricted = false;
    if (state.wateringRestrictionEndsDay === undefined) state.wateringRestrictionEndsDay = 0;
    // Derive event RNG seed from scenario seed, not a hardcoded value.
    // This is correct for the current scenario; future multi-scenario support
    // would need the scenario ID to look up the right seed.
    if (state.eventRngState === undefined) {
      state.eventRngState = SLICE_1_SCENARIO.seed + EVENT_RNG_SEED_OFFSET;
    }

    // Fill missing perennial fields on crop instances
    for (const row of state.grid) {
      for (const cell of row) {
        if (cell.crop) {
          if (cell.crop.isPerennial === undefined) cell.crop.isPerennial = false;
          if (cell.crop.perennialAge === undefined) cell.crop.perennialAge = 0;
          if (cell.crop.perennialEstablished === undefined) cell.crop.perennialEstablished = false;
          if (cell.crop.isDormant === undefined) cell.crop.isDormant = false;
          if (cell.crop.harvestedThisSeason === undefined) cell.crop.harvestedThisSeason = false;
        }
      }
    }

    return state as GameState;
  } catch {
    return null;
  }
}

// ============================================================================
// V3 → V4 Migration (adds coverCropId + frostProtectionEndsDay)
// ============================================================================

function isV3Save(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const save = data as Record<string, unknown>;
  return save.version === '3.0.0';
}

/**
 * Migrate a v3 save to v4 by adding:
 * - coverCropId: null on all cells (for 3b cover crops)
 * - frostProtectionEndsDay: 0 on GameState (for 3c weather advisor)
 * Returns state (not fully valid yet — caller chains to V4→V5).
 */
function migrateV3ToV4(data: unknown): GameState | null {
  try {
    const save = data as SaveGame;
    const state = save.state as GameState & Record<string, unknown>;

    // Add coverCropId to all cells
    for (const row of state.grid) {
      for (const cell of row) {
        if ((cell as unknown as Record<string, unknown>).coverCropId === undefined) {
          cell.coverCropId = null;
        }
      }
    }

    // Add frostProtectionEndsDay to GameState
    if (state.frostProtectionEndsDay === undefined) {
      state.frostProtectionEndsDay = 0;
    }

    return state as GameState;
  } catch {
    return null;
  }
}

// ============================================================================
// V4 → V5 Migration (adds tracking, cell fields, event clustering)
// ============================================================================

function isV4Save(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const save = data as Record<string, unknown>;
  return save.version === '4.0.0';
}

/**
 * Migrate a v4 save to v5 by adding:
 * - tracking: TrackingState (empty snapshots, zero counters)
 * - eventsThisSeason: 0
 * - actedSincePause: false
 * - lastCropId: null, lastHarvestYieldRatio: null on all cells
 */
function isV5Save(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const save = data as Record<string, unknown>;
  return save.version === '5.0.0';
}

/**
 * Migrate a v5 save to v6 by adding:
 * - seasonalEventQueue: [] (Guardrail HIGH 3: empty queue is acceptable;
 *   mid-season loads lose at most one season of scheduled events.
 *   V5 saves had no seasonal queue concept. Next season boundary triggers fresh draw.)
 * - yearStressLevel: 0.5 (neutral default)
 */
function migrateV5ToV6(data: unknown): GameState | null {
  try {
    const save = data as SaveGame;
    const state = save.state as GameState & Record<string, unknown>;

    if (!state.seasonalEventQueue) {
      state.seasonalEventQueue = [];
    }
    if (state.yearStressLevel === undefined) {
      state.yearStressLevel = 0.5;
    }

    return state as GameState;
  } catch {
    return null;
  }
}

// ============================================================================
// V6 → V7 Migration (adds annualOverhead to expense tracking)
// ============================================================================

function isV6Save(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const save = data as Record<string, unknown>;
  return save.version === '6.0.0';
}

/**
 * Migrate a v6 save to v7 by adding annualOverhead: 0 to:
 * - tracking.currentExpenses
 * - All yearSnapshots[].expenses
 */
function migrateV6ToV7(data: unknown): GameState | null {
  try {
    const save = data as SaveGame;
    const state = save.state as GameState & Record<string, unknown>;

    // Add annualOverhead to current expense tracking
    if (state.tracking?.currentExpenses) {
      const expenses = state.tracking.currentExpenses as unknown as Record<string, unknown>;
      if (expenses.annualOverhead === undefined) {
        expenses.annualOverhead = 0;
      }
    }

    // Add annualOverhead to all historical year snapshots
    if (state.tracking?.yearSnapshots) {
      for (const snapshot of state.tracking.yearSnapshots) {
        const expenses = snapshot.expenses as unknown as Record<string, unknown>;
        if (expenses.annualOverhead === undefined) {
          expenses.annualOverhead = 0;
        }
      }
    }

    return state as GameState;
  } catch {
    return null;
  }
}

// ============================================================================
// V7 → V8 Migration (adds potassium to soil state)
// ============================================================================

function isV7Save(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const save = data as Record<string, unknown>;
  return save.version === '7.0.0';
}

/**
 * Migrate a v7 save to v8 by adding potassium to all cells' soil state.
 * K-lite system: per-cell potassium affects harvest price.
 */
function migrateV7ToV8(data: unknown): GameState | null {
  try {
    const save = data as SaveGame;
    const state = save.state as GameState & Record<string, unknown>;

    // Add potassium to all cells' soil
    for (const row of state.grid) {
      for (const cell of row) {
        if ((cell.soil as unknown as Record<string, unknown>).potassium === undefined) {
          (cell.soil as unknown as Record<string, unknown>).potassium = STARTING_POTASSIUM;
        }
      }
    }

    return state as GameState;
  } catch {
    return null;
  }
}

// ============================================================================
// V8 → V9 Migration (adds insurance fields to ExpenseBreakdown)
// ============================================================================

function isV8Save(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const save = data as Record<string, unknown>;
  return save.version === '8.0.0';
}

/**
 * Migrate a v8 save to v9 by adding insurance/organicCertification to ExpenseBreakdown.
 */
function migrateV8ToV9(data: unknown): GameState | null {
  try {
    const save = data as SaveGame;
    const state = save.state as GameState & Record<string, unknown>;

    // Add organicCompliantYears (6d.2 compliance layer)
    if ((state as Record<string, unknown>).organicCompliantYears === undefined) {
      (state as Record<string, unknown>).organicCompliantYears = 0;
    }

    // Add new ExpenseBreakdown fields to currentExpenses
    const expenses = state.tracking.currentExpenses as unknown as Record<string, unknown>;
    if (expenses.insurance === undefined) expenses.insurance = 0;
    if (expenses.insurancePayouts === undefined) expenses.insurancePayouts = 0;
    if (expenses.organicCertification === undefined) expenses.organicCertification = 0;

    // Add to all year snapshots
    for (const snapshot of state.tracking.yearSnapshots) {
      const snapExpenses = snapshot.expenses as unknown as Record<string, unknown>;
      if (snapExpenses.insurance === undefined) snapExpenses.insurance = 0;
      if (snapExpenses.insurancePayouts === undefined) snapExpenses.insurancePayouts = 0;
      if (snapExpenses.organicCertification === undefined) snapExpenses.organicCertification = 0;
    }

    return state as GameState;
  } catch {
    return null;
  }
}

function migrateV4ToV5(data: unknown): GameState | null {
  try {
    const save = data as SaveGame;
    const state = save.state as GameState & Record<string, unknown>;

    // Add tracking state
    if (!state.tracking) {
      state.tracking = createEmptyTrackingState();
    }

    // Add event clustering counter
    if (state.eventsThisSeason === undefined) {
      state.eventsThisSeason = 0;
    }

    // Add acted-since-pause flag
    if (state.actedSincePause === undefined) {
      state.actedSincePause = false;
    }

    // Add new cell fields
    for (const row of state.grid) {
      for (const cell of row) {
        if ((cell as unknown as Record<string, unknown>).lastCropId === undefined) {
          cell.lastCropId = null;
        }
        if ((cell as unknown as Record<string, unknown>).lastHarvestYieldRatio === undefined) {
          cell.lastHarvestYieldRatio = null;
        }
      }
    }

    return state as GameState;
  } catch {
    return null;
  }
}
