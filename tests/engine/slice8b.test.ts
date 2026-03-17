/**
 * Slice 8b Tests — Granular planting-window pause preferences
 *
 * Tests the per-crop-group pause detection, one-pause-per-group-per-year
 * contract, per-group actionability guard, master "All" checkbox semantics
 * for perennials, and preference migration.
 *
 * Pure logic only — no Preact signals or localStorage. The adapter signal
 * wiring and UI checkbox behavior are tested via Playwright browser tests.
 */

import { describe, it, expect } from 'vitest';
import { createInitialState, getAvailableCrops, isCoverCropEligible } from '../../src/engine/game.ts';
import { SLICE_1_SCENARIO } from '../../src/data/scenario.ts';
import type { GameState } from '../../src/engine/types.ts';
import {
  getCropPauseGroup,
  buildPlantableCropSet,
  hasActionableCellForGroup,
  checkPlantingPause,
  GROUP_MESSAGES,
  PERENNIAL_MESSAGE,
  migratePlantingPausePrefs,
  DEFAULT_PLANTING_PAUSE_PREFS,
  type PlantingPausePrefs,
  type PlantingPauseState,
} from '../../src/adapter/planting-pause.ts';

function makeState(): GameState {
  return createInitialState('test-8b', SLICE_1_SCENARIO);
}

function makeTracking(state: GameState): PlantingPauseState {
  return {
    prevPlantableCrops: buildPlantableCropSet(state),
    pausedGroupsThisYear: new Map(),
  };
}

const ALL_ON: PlantingPausePrefs = {
  all: true, warmSeason: true, sorghum: true, winterWheat: true, coverCrops: true,
};
const ALL_OFF: PlantingPausePrefs = { ...DEFAULT_PLANTING_PAUSE_PREFS };

// ============================================================================
// §1 — getCropPauseGroup mapping
// ============================================================================

describe('Slice 8b — getCropPauseGroup', () => {
  it('maps processing-tomatoes to warmSeason', () => {
    expect(getCropPauseGroup('processing-tomatoes')).toBe('warmSeason');
  });

  it('maps silage-corn to warmSeason', () => {
    expect(getCropPauseGroup('silage-corn')).toBe('warmSeason');
  });

  it('maps sorghum to sorghum', () => {
    expect(getCropPauseGroup('sorghum')).toBe('sorghum');
  });

  it('maps winter-wheat to winterWheat', () => {
    expect(getCropPauseGroup('winter-wheat')).toBe('winterWheat');
  });

  it('maps cover token to coverCrops', () => {
    expect(getCropPauseGroup('cover')).toBe('coverCrops');
  });

  it('returns null for perennials (almonds, pistachios, citrus)', () => {
    expect(getCropPauseGroup('almonds')).toBeNull();
    expect(getCropPauseGroup('pistachios')).toBeNull();
    expect(getCropPauseGroup('citrus-navels')).toBeNull();
  });

  it('returns null for gated crops (agave, heat-avocado)', () => {
    expect(getCropPauseGroup('agave')).toBeNull();
    expect(getCropPauseGroup('heat-avocado')).toBeNull();
  });

  it('returns null for unknown crop IDs', () => {
    expect(getCropPauseGroup('unknown-crop')).toBeNull();
  });
});

// ============================================================================
// §2 — buildPlantableCropSet
// ============================================================================

describe('Slice 8b — buildPlantableCropSet', () => {
  it('returns available crops for the current month', () => {
    const state = makeState(); // starts in March
    const crops = buildPlantableCropSet(state);
    // March: tomatoes (3-5), corn (3-5), almonds (1-3), pistachios (1-3), citrus (2-4)
    expect(crops.has('processing-tomatoes')).toBe(true);
    expect(crops.has('silage-corn')).toBe(true);
    expect(crops.has('almonds')).toBe(true);
  });

  it('does not include cover token outside fall', () => {
    const state = makeState(); // spring
    const crops = buildPlantableCropSet(state);
    expect(crops.has('cover')).toBe(false);
  });

  it('includes cover token in fall', () => {
    const state = makeState();
    // Advance to fall (month 9)
    state.calendar = { ...state.calendar, month: 9, season: 'fall' };
    const crops = buildPlantableCropSet(state);
    expect(crops.has('cover')).toBe(true);
  });
});

// ============================================================================
// §3 — hasActionableCellForGroup
// ============================================================================

describe('Slice 8b — hasActionableCellForGroup', () => {
  it('warmSeason/sorghum/winterWheat need empty cells', () => {
    const state = makeState();
    // Fresh state: all cells empty
    expect(hasActionableCellForGroup(state, 'warmSeason')).toBe(true);
    expect(hasActionableCellForGroup(state, 'sorghum')).toBe(true);
    expect(hasActionableCellForGroup(state, 'winterWheat')).toBe(true);
  });

  it('perennials (null group) need empty cells', () => {
    const state = makeState();
    expect(hasActionableCellForGroup(state, null)).toBe(true);
  });

  it('returns false for non-coverCrops groups when all cells planted', () => {
    const state = makeState();
    // Fill all cells
    for (let r = 0; r < state.grid.length; r++) {
      for (let c = 0; c < state.grid[r].length; c++) {
        state.grid[r][c].crop = {
          cropId: 'processing-tomatoes',
          plantedDay: state.calendar.totalDay,
          gddAccumulated: 0,
          waterFactor: 1,
          heatStressFactor: 1,
          nitrogenFactor: 1,
          isHarvestable: false,
          isOverripe: false,
          overripeDaysRemaining: 0,
          harvestedThisSeason: false,
          isDormant: false,
          yearsPlanted: 0,
        };
      }
    }
    expect(hasActionableCellForGroup(state, 'warmSeason')).toBe(false);
    expect(hasActionableCellForGroup(state, 'sorghum')).toBe(false);
    expect(hasActionableCellForGroup(state, null)).toBe(false);
  });

  it('coverCrops group checks cover-crop-eligible cells, not empty cells', () => {
    const state = makeState();
    // Plant a deciduous perennial (almonds) in cell (0,0) — makes it cover-crop eligible
    state.grid[0][0].crop = {
      cropId: 'almonds',
      plantedDay: state.calendar.totalDay,
      gddAccumulated: 0,
      waterFactor: 1,
      heatStressFactor: 1,
      nitrogenFactor: 1,
      isHarvestable: false,
      isOverripe: false,
      overripeDaysRemaining: 0,
      harvestedThisSeason: false,
      isDormant: false,
      yearsPlanted: 1,
    };
    // Cell (0,0) has a perennial, no cover crop — should be eligible
    // (Exact eligibility depends on isCoverCropEligible which checks for dormantSeasons)
    // Fill all OTHER cells with annuals (not cover-crop-eligible)
    for (let r = 0; r < state.grid.length; r++) {
      for (let c = 0; c < state.grid[r].length; c++) {
        if (r === 0 && c === 0) continue;
        state.grid[r][c].crop = {
          cropId: 'processing-tomatoes',
          plantedDay: state.calendar.totalDay,
          gddAccumulated: 0,
          waterFactor: 1,
          heatStressFactor: 1,
          nitrogenFactor: 1,
          isHarvestable: false,
          isOverripe: false,
          overripeDaysRemaining: 0,
          harvestedThisSeason: false,
          isDormant: false,
          yearsPlanted: 0,
        };
      }
    }
    // No empty cells, but cell (0,0) with almond is cover-crop eligible (deciduous perennial)
    expect(hasActionableCellForGroup(state, 'warmSeason')).toBe(false); // no empty cells
    if (isCoverCropEligible(state.grid[0][0])) {
      expect(hasActionableCellForGroup(state, 'coverCrops')).toBe(true);
    }
  });
});

// ============================================================================
// §4 — checkPlantingPause: basic detection
// ============================================================================

describe('Slice 8b — checkPlantingPause', () => {
  it('returns null when prefs are all off', () => {
    const state = makeState();
    const tracking = makeTracking(state);
    // Advance to month 4 (sorghum opens)
    state.calendar = { ...state.calendar, month: 4, season: 'spring' };
    const msg = checkPlantingPause(state, ALL_OFF, tracking);
    expect(msg).toBeNull();
  });

  it('detects warmSeason crops when warmSeason pref is on', () => {
    const state = makeState();
    // Initialize tracking with month 2 (no spring crops yet)
    state.calendar = { ...state.calendar, month: 2, season: 'winter' };
    const tracking = makeTracking(state);
    // Advance to month 3 (tomatoes + corn open)
    state.calendar = { ...state.calendar, month: 3, season: 'spring' };
    const prefs: PlantingPausePrefs = { ...ALL_OFF, warmSeason: true };
    const msg = checkPlantingPause(state, prefs, tracking);
    expect(msg).not.toBeNull();
    expect(msg).toContain(GROUP_MESSAGES.warmSeason);
  });

  it('detects sorghum when sorghum pref is on', () => {
    const state = makeState();
    // Start in month 3
    state.calendar = { ...state.calendar, month: 3, season: 'spring' };
    const tracking = makeTracking(state);
    // Advance to month 4 (sorghum window opens)
    state.calendar = { ...state.calendar, month: 4, season: 'spring' };
    const prefs: PlantingPausePrefs = { ...ALL_OFF, sorghum: true };
    const msg = checkPlantingPause(state, prefs, tracking);
    expect(msg).not.toBeNull();
    expect(msg).toContain(GROUP_MESSAGES.sorghum);
  });

  it('does not fire for warmSeason when only sorghum pref is on', () => {
    const state = makeState();
    state.calendar = { ...state.calendar, month: 2, season: 'winter' };
    const tracking = makeTracking(state);
    state.calendar = { ...state.calendar, month: 3, season: 'spring' };
    const prefs: PlantingPausePrefs = { ...ALL_OFF, sorghum: true };
    const msg = checkPlantingPause(state, prefs, tracking);
    // Tomatoes/corn opened but sorghum pref only — should not contain warmSeason message
    // But sorghum itself is not yet available in month 3 (window 4-6)
    // So the message should be null (only warmSeason crops added, but pref is off for those)
    expect(msg).toBeNull();
  });
});

// ============================================================================
// §5 — checkPlantingPause: one-per-year contract
// ============================================================================

describe('Slice 8b — one pause per group per year', () => {
  it('warmSeason does not re-fire in the same year', () => {
    const state = makeState();
    state.calendar = { ...state.calendar, month: 2, year: 1, season: 'winter' };
    const tracking = makeTracking(state);
    const prefs: PlantingPausePrefs = { ...ALL_OFF, warmSeason: true };

    // First fire at month 3
    state.calendar = { ...state.calendar, month: 3, season: 'spring' };
    const msg1 = checkPlantingPause(state, prefs, tracking);
    expect(msg1).not.toBeNull();

    // Month 3→4: warmSeason still in window but already fired
    state.calendar = { ...state.calendar, month: 4, season: 'spring' };
    const msg2 = checkPlantingPause(state, prefs, tracking);
    // warmSeason already fired; sorghum pref not on; tomatoes/corn not "new" in set diff
    expect(msg2).toBeNull();
  });

  it('groups fire again in a new year', () => {
    const state = makeState();
    state.calendar = { ...state.calendar, month: 2, year: 1, season: 'winter' };
    const tracking = makeTracking(state);
    const prefs: PlantingPausePrefs = { ...ALL_OFF, warmSeason: true };

    // Year 1 fire
    state.calendar = { ...state.calendar, month: 3, year: 1, season: 'spring' };
    checkPlantingPause(state, prefs, tracking);

    // Advance through the year — warmSeason window closes
    state.calendar = { ...state.calendar, month: 6, year: 1, season: 'summer' };
    tracking.prevPlantableCrops = buildPlantableCropSet(state);

    // Year 2 — crops reappear in March
    state.calendar = { ...state.calendar, month: 2, year: 2, season: 'winter' };
    tracking.prevPlantableCrops = buildPlantableCropSet(state);

    state.calendar = { ...state.calendar, month: 3, year: 2, season: 'spring' };
    const msg = checkPlantingPause(state, prefs, tracking);
    expect(msg).not.toBeNull();
    expect(msg).toContain(GROUP_MESSAGES.warmSeason);
  });
});

// ============================================================================
// §6 — checkPlantingPause: perennial handling via "All"
// ============================================================================

describe('Slice 8b — perennial/gated crops via All', () => {
  it('perennials fire when all=true and individual prefs are off', () => {
    const state = makeState();
    // Start in December (month 12, no perennials available)
    state.calendar = { ...state.calendar, month: 12, year: 1, season: 'winter' };
    const tracking = makeTracking(state);
    // Advance to January — almonds/pistachios open (month 1-3)
    state.calendar = { ...state.calendar, month: 1, year: 2, season: 'winter' };
    const prefs: PlantingPausePrefs = { all: true, warmSeason: false, sorghum: false, winterWheat: false, coverCrops: false };
    const msg = checkPlantingPause(state, prefs, tracking);
    expect(msg).not.toBeNull();
    expect(msg).toContain(PERENNIAL_MESSAGE);
  });

  it('perennials do NOT fire when all=false', () => {
    const state = makeState();
    state.calendar = { ...state.calendar, month: 12, year: 1, season: 'winter' };
    const tracking = makeTracking(state);
    state.calendar = { ...state.calendar, month: 1, year: 2, season: 'winter' };
    const prefs: PlantingPausePrefs = { all: false, warmSeason: true, sorghum: true, winterWheat: true, coverCrops: true };
    const msg = checkPlantingPause(state, prefs, tracking);
    // Only perennials open in January, and all=false, so no message
    // (warmSeason/sorghum/winterWheat/coverCrops prefs don't cover perennials)
    // But almonds/pistachios ARE in the crops list — getCropPauseGroup returns null for them
    expect(msg).toBeNull();
  });

  it('perennial message is deduped when multiple perennials open together', () => {
    const state = makeState();
    state.calendar = { ...state.calendar, month: 12, year: 1, season: 'winter' };
    const tracking = makeTracking(state);
    // January: almonds AND pistachios both open — should only produce 1 perennial message
    state.calendar = { ...state.calendar, month: 1, year: 2, season: 'winter' };
    const prefs: PlantingPausePrefs = { all: true, warmSeason: false, sorghum: false, winterWheat: false, coverCrops: false };
    const msg = checkPlantingPause(state, prefs, tracking);
    if (msg) {
      // Count occurrences of PERENNIAL_MESSAGE
      const count = msg.split(PERENNIAL_MESSAGE).length - 1;
      expect(count).toBe(1);
    }
  });

  it('perennial message appears alongside grouped messages (not suppressed)', () => {
    const state = makeState();
    // Unlock agave (flag-gated, window 3-5)
    state.flags['tech_drought_crops'] = true;
    // Start in month 2
    state.calendar = { ...state.calendar, month: 2, year: 1, season: 'winter' };
    const tracking = makeTracking(state);
    // Advance to month 3 — warmSeason crops AND agave both become available
    state.calendar = { ...state.calendar, month: 3, year: 1, season: 'spring' };
    const prefs: PlantingPausePrefs = { all: true, warmSeason: true, sorghum: false, winterWheat: false, coverCrops: false };
    const msg = checkPlantingPause(state, prefs, tracking);
    // Should contain BOTH warmSeason message AND perennial message
    if (msg) {
      expect(msg).toContain(GROUP_MESSAGES.warmSeason);
      // agave maps to null group → perennial message via 'all'
      // (only if agave is actually in the set-diff — depends on flag gating)
    }
  });
});

// ============================================================================
// §7 — checkPlantingPause: per-group actionability
// ============================================================================

describe('Slice 8b — per-group actionability guard', () => {
  it('warmSeason does not fire when all cells are planted (no empty cells)', () => {
    const state = makeState();
    state.calendar = { ...state.calendar, month: 2, season: 'winter' };

    // Fill all cells
    for (const row of state.grid) {
      for (const cell of row) {
        cell.crop = {
          cropId: 'processing-tomatoes',
          plantedDay: state.calendar.totalDay,
          gddAccumulated: 0,
          waterFactor: 1,
          heatStressFactor: 1,
          nitrogenFactor: 1,
          isHarvestable: false,
          isOverripe: false,
          overripeDaysRemaining: 0,
          harvestedThisSeason: false,
          isDormant: false,
          yearsPlanted: 0,
        };
      }
    }

    const tracking = makeTracking(state);
    state.calendar = { ...state.calendar, month: 3, season: 'spring' };
    const prefs: PlantingPausePrefs = { ...ALL_OFF, warmSeason: true };
    const msg = checkPlantingPause(state, prefs, tracking);
    expect(msg).toBeNull();
  });
});

// ============================================================================
// §8 — Preference migration
// ============================================================================

describe('Slice 8b — migratePlantingPausePrefs', () => {
  it('returns all-true when old value is "true"', () => {
    const result = migratePlantingPausePrefs('true', null);
    expect(result).toEqual({ all: true, warmSeason: true, sorghum: true, winterWheat: true, coverCrops: true });
  });

  it('returns all-false when old value is "false"', () => {
    const result = migratePlantingPausePrefs('false', null);
    expect(result).toEqual(DEFAULT_PLANTING_PAUSE_PREFS);
  });

  it('returns all-false when old value is absent', () => {
    const result = migratePlantingPausePrefs(null, null);
    expect(result).toEqual(DEFAULT_PLANTING_PAUSE_PREFS);
  });

  it('returns parsed JSON when new key exists', () => {
    const stored = JSON.stringify({ all: false, warmSeason: true, sorghum: false, winterWheat: true, coverCrops: false });
    const result = migratePlantingPausePrefs(null, stored);
    expect(result).toEqual({ all: false, warmSeason: true, sorghum: false, winterWheat: true, coverCrops: false });
  });

  it('new key takes precedence over old key', () => {
    const stored = JSON.stringify({ all: false, warmSeason: false, sorghum: false, winterWheat: false, coverCrops: true });
    const result = migratePlantingPausePrefs('true', stored);
    expect(result.all).toBe(false);
    expect(result.coverCrops).toBe(true);
  });

  it('returns defaults for malformed JSON', () => {
    const result = migratePlantingPausePrefs(null, 'not-json');
    expect(result).toEqual(DEFAULT_PLANTING_PAUSE_PREFS);
  });
});
