/**
 * Planting-window pause detection — pure logic, no signals or browser deps.
 *
 * Slice 8b: Granular per-crop-group pause preferences with one-pause-per-
 * group-per-year contract. Used by the adapter game loop AND debug fast-forward.
 *
 * Scope: calendar-window pauses detected at month boundaries only. "All"
 * covers perennial/gated crops when they become visible at a checked detection
 * point, but 8b does NOT add reliable mid-window unlock detection.
 */

import type { GameState } from '../engine/types.ts';
import { getAvailableCrops, isCoverCropEligible } from '../engine/game.ts';

// ============================================================================
// Types
// ============================================================================

export interface PlantingPausePrefs {
  all: boolean;          // master — superset including perennials + future content
  warmSeason: boolean;   // tomatoes + corn
  sorghum: boolean;
  winterWheat: boolean;
  coverCrops: boolean;
}

export interface PlantingPauseState {
  prevPlantableCrops: Set<string>;
  pausedGroupsThisYear: Map<string, number>;  // group-or-crop key → year it fired
}

export const DEFAULT_PLANTING_PAUSE_PREFS: PlantingPausePrefs = {
  all: false, warmSeason: false, sorghum: false, winterWheat: false, coverCrops: false,
};

// ============================================================================
// Group definitions and messages
// ============================================================================

export type PlantingGroup = 'warmSeason' | 'sorghum' | 'winterWheat' | 'coverCrops';

export function getCropPauseGroup(cropOrToken: string): PlantingGroup | null {
  switch (cropOrToken) {
    case 'processing-tomatoes':
    case 'silage-corn':       return 'warmSeason';
    case 'sorghum':           return 'sorghum';
    case 'winter-wheat':      return 'winterWheat';
    case 'cover':             return 'coverCrops';
    default:                  return null;  // perennials — only 'all' catches
  }
}

export const GROUP_MESSAGES: Record<PlantingGroup, string> = {
  warmSeason:  'Tomatoes and corn are in season \u2014 time to plant your spring fields.',
  sorghum:     'Sorghum is now plantable \u2014 a heat-tolerant option for late spring.',
  winterWheat: 'Winter wheat is ready for fall planting.',
  coverCrops:  'Cover crops can now be planted to protect your soil over winter.',
};

export const PERENNIAL_MESSAGE = 'New crop options are available \u2014 check your field for choices.';

// ============================================================================
// Helpers
// ============================================================================

/** Build the set of currently plantable crop IDs + cover token. */
export function buildPlantableCropSet(state: GameState): Set<string> {
  const crops = new Set(getAvailableCrops(state));
  if (state.calendar.season === 'fall') crops.add('cover');
  return crops;
}

/**
 * Per-group actionability guard.
 * - coverCrops: needs cells with deciduous perennials that don't already have cover crops
 * - All other groups (warmSeason, sorghum, winterWheat, perennials): need empty cells
 */
export function hasActionableCellForGroup(state: GameState, group: PlantingGroup | null): boolean {
  if (group === 'coverCrops') {
    return state.grid.some(row => row.some(cell =>
      !cell.coverCropId && isCoverCropEligible(cell)
    ));
  }
  return state.grid.some(row => row.some(cell => cell.crop === null));
}

// ============================================================================
// Core detection: set-diff + per-group + one-per-year
// ============================================================================

/**
 * Check if any planting group should fire a pause.
 * Returns the pause message string, or null if no pause should fire.
 *
 * Mutates `tracking` to update prevPlantableCrops and pausedGroupsThisYear.
 * Caller is responsible for month-boundary gating (only call when month changed).
 */
export function checkPlantingPause(
  state: GameState,
  prefs: PlantingPausePrefs,
  tracking: PlantingPauseState,
): string | null {
  // Set-diff: find newly available crops
  const currentCrops = buildPlantableCropSet(state);
  const addedCrops = [...currentCrops].filter(c => !tracking.prevPlantableCrops.has(c));
  tracking.prevPlantableCrops = currentCrops;

  if (addedCrops.length === 0) return null;

  // Per-group preference check + actionability + one-per-year tracking
  const year = state.calendar.year;
  const messages: string[] = [];

  for (const crop of addedCrops) {
    const group = getCropPauseGroup(crop);
    if (group !== null) {
      if (!prefs[group]) continue;
      if (tracking.pausedGroupsThisYear.get(group) === year) continue;
      if (!hasActionableCellForGroup(state, group)) continue;
      tracking.pausedGroupsThisYear.set(group, year);
      if (!messages.includes(GROUP_MESSAGES[group])) messages.push(GROUP_MESSAGES[group]);
    } else if (prefs.all) {
      if (tracking.pausedGroupsThisYear.get(crop) === year) continue;
      if (!hasActionableCellForGroup(state, null)) continue;
      tracking.pausedGroupsThisYear.set(crop, year);
      if (!messages.includes(PERENNIAL_MESSAGE)) messages.push(PERENNIAL_MESSAGE);
    }
  }

  return messages.length > 0 ? messages.join('\n') : null;
}

// ============================================================================
// Preference migration (pure — caller handles localStorage I/O)
// ============================================================================

/**
 * Determine PlantingPausePrefs from localStorage values.
 * @param oldValue - value of old key `climateFarmer_pref_autoPausePlanting` (or null)
 * @param newValue - value of new key `climateFarmer_pref_plantingPause` (or null)
 */
export function migratePlantingPausePrefs(
  oldValue: string | null,
  newValue: string | null,
): PlantingPausePrefs {
  // New key takes precedence
  if (newValue) {
    try {
      const parsed = JSON.parse(newValue);
      if (parsed && typeof parsed === 'object' && typeof parsed.all === 'boolean') {
        return {
          all: !!parsed.all,
          warmSeason: !!parsed.warmSeason,
          sorghum: !!parsed.sorghum,
          winterWheat: !!parsed.winterWheat,
          coverCrops: !!parsed.coverCrops,
        };
      }
    } catch { /* malformed JSON — fall through to defaults */ }
  }

  // Migrate from old boolean key
  if (oldValue === 'true') {
    return { all: true, warmSeason: true, sorghum: true, winterWheat: true, coverCrops: true };
  }

  return { ...DEFAULT_PLANTING_PAUSE_PREFS };
}

/** Returns true if any planting pause preference is enabled. */
export function isAnyPlantingPauseEnabled(prefs: PlantingPausePrefs): boolean {
  return prefs.all || prefs.warmSeason || prefs.sorghum || prefs.winterWheat || prefs.coverCrops;
}
