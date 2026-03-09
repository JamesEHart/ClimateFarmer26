import { describe, it, expect, beforeEach, vi } from 'vitest';
import { evaluateCondition, drawSeasonalEvents, evaluateEvents, hasRandomCondition } from '../../src/engine/events/selector.ts';
import { createInitialState, simulateTick, processCommand, harvestCell, getAvailableCrops } from '../../src/engine/game.ts';
import { SLICE_1_SCENARIO } from '../../src/data/scenario.ts';
import { SCENARIOS } from '../../src/data/scenarios.ts';
import { STORYLETS } from '../../src/data/events.ts';
import { getCropDefinition, getAllCropIds } from '../../src/data/crops.ts';
import { SeededRNG } from '../../src/engine/rng.ts';
import {
  autoSave, loadAutoSave, AUTOSAVE_KEY,
} from '../../src/save/storage.ts';
import type { GameState, CropDefinition, Cell } from '../../src/engine/types.ts';
import {
  SAVE_VERSION, GRID_ROWS, GRID_COLS, STARTING_DAY,
} from '../../src/engine/types.ts';
import type { Storylet, Condition } from '../../src/engine/events/types.ts';

// ============================================================================
// Test Helpers
// ============================================================================

function makeState(): GameState {
  return createInitialState('test-5a', SLICE_1_SCENARIO);
}

function makeSimpleStorylet(overrides?: Partial<Storylet>): Storylet {
  return {
    id: 'test-event',
    type: 'climate',
    title: 'Test Event',
    description: 'A test event.',
    preconditions: [],
    priority: 50,
    cooldownDays: 0,
    choices: [
      {
        id: 'choice-a',
        label: 'Choice A',
        description: 'Pick A.',
        effects: [],
      },
    ],
    tags: ['test'],
    ...overrides,
  };
}

/** Plant a crop in a cell and fast-forward it to harvestable stage */
function plantAndMature(state: GameState, row: number, col: number, cropId: string): void {
  const cropDef = getCropDefinition(cropId);
  processCommand(state, { type: 'PLANT_CROP', cellRow: row, cellCol: col, cropId }, SLICE_1_SCENARIO);
  // Force to harvestable
  const crop = state.grid[row][col].crop!;
  crop.gddAccumulated = cropDef.gddToMaturity;
  crop.growthStage = 'harvestable';
  crop.waterStressDays = 0;
}

// ============================================================================
// §1: New Condition Types — not_has_flag, tech_level_below, tech_level_at_least
// ============================================================================

describe('Slice 5a: New condition types', () => {
  let state: GameState;
  let rng: SeededRNG;

  beforeEach(() => {
    state = makeState();
    rng = new SeededRNG(42);
  });

  describe('not_has_flag', () => {
    it('returns true when flag is not set', () => {
      expect(evaluateCondition(
        { type: 'not_has_flag', flag: 'tech_drip_irrigation' } as Condition,
        state, rng,
      )).toBe(true);
    });

    it('returns true when flag is explicitly false', () => {
      state.flags['tech_drip_irrigation'] = false;
      expect(evaluateCondition(
        { type: 'not_has_flag', flag: 'tech_drip_irrigation' } as Condition,
        state, rng,
      )).toBe(true);
    });

    it('returns false when flag is true', () => {
      state.flags['tech_drip_irrigation'] = true;
      expect(evaluateCondition(
        { type: 'not_has_flag', flag: 'tech_drip_irrigation' } as Condition,
        state, rng,
      )).toBe(false);
    });
  });

  describe('tech_level_below', () => {
    it('returns true when no tech flags are set (level 0 < 1)', () => {
      expect(evaluateCondition(
        { type: 'tech_level_below', track: 'water', level: 1 } as Condition,
        state, rng,
      )).toBe(true);
    });

    it('returns false when tech level equals threshold', () => {
      state.flags['tech_drip_irrigation'] = true; // water level 1
      expect(evaluateCondition(
        { type: 'tech_level_below', track: 'water', level: 1 } as Condition,
        state, rng,
      )).toBe(false);
    });

    it('returns false when tech level exceeds threshold', () => {
      state.flags['tech_water_recycling'] = true; // water level 2
      expect(evaluateCondition(
        { type: 'tech_level_below', track: 'water', level: 1 } as Condition,
        state, rng,
      )).toBe(false);
    });
  });

  describe('tech_level_at_least', () => {
    it('returns false when no tech flags are set (level 0)', () => {
      expect(evaluateCondition(
        { type: 'tech_level_at_least', track: 'water', level: 1 } as Condition,
        state, rng,
      )).toBe(false);
    });

    it('returns true when tech level equals threshold', () => {
      state.flags['tech_drip_irrigation'] = true; // water level 1
      expect(evaluateCondition(
        { type: 'tech_level_at_least', track: 'water', level: 1 } as Condition,
        state, rng,
      )).toBe(true);
    });

    it('returns true when tech level exceeds threshold', () => {
      state.flags['tech_ai_irrigation'] = true; // water level 3
      expect(evaluateCondition(
        { type: 'tech_level_at_least', track: 'water', level: 2 } as Condition,
        state, rng,
      )).toBe(true);
    });
  });
});

// ============================================================================
// §2: getTechLevel — Reconvergence via tech levels
// ============================================================================

describe('Slice 5a: getTechLevel reconvergence', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
  });

  describe('water track', () => {
    it('level 0 with no flags', () => {
      expect(getTechLevel(state.flags, 'water')).toBe(0);
    });

    it('level 1 via drip irrigation', () => {
      state.flags['tech_drip_irrigation'] = true;
      expect(getTechLevel(state.flags, 'water')).toBe(1);
    });

    it('level 1 via smart irrigation (different flag, same level)', () => {
      state.flags['tech_smart_irrigation'] = true;
      expect(getTechLevel(state.flags, 'water')).toBe(1);
    });

    it('level 1 via deficit irrigation (third alternative, same level)', () => {
      state.flags['tech_deficit_irrigation'] = true;
      expect(getTechLevel(state.flags, 'water')).toBe(1);
    });

    it('reconvergence: drip and smart both give level 1 — same eligibility', () => {
      // Two players who chose different level-1 techs should have the same level
      const flagsA: Record<string, boolean> = { tech_drip_irrigation: true };
      const flagsB: Record<string, boolean> = { tech_smart_irrigation: true };
      expect(getTechLevel(flagsA, 'water')).toBe(getTechLevel(flagsB, 'water'));
    });

    it('level 2 via water recycling', () => {
      state.flags['tech_water_recycling'] = true;
      expect(getTechLevel(state.flags, 'water')).toBe(2);
    });

    it('level 2 via advanced irrigation', () => {
      state.flags['tech_advanced_irrigation'] = true;
      expect(getTechLevel(state.flags, 'water')).toBe(2);
    });

    it('reconvergence at level 2: water_recycling and advanced_irrigation give same level', () => {
      const flagsA: Record<string, boolean> = { tech_water_recycling: true };
      const flagsB: Record<string, boolean> = { tech_advanced_irrigation: true };
      expect(getTechLevel(flagsA, 'water')).toBe(getTechLevel(flagsB, 'water'));
    });

    it('level 3 via AI irrigation', () => {
      state.flags['tech_ai_irrigation'] = true;
      expect(getTechLevel(state.flags, 'water')).toBe(3);
    });

    it('highest level wins when multiple flags set', () => {
      state.flags['tech_drip_irrigation'] = true;
      state.flags['tech_ai_irrigation'] = true;
      expect(getTechLevel(state.flags, 'water')).toBe(3);
    });
  });

  describe('soil track', () => {
    it('level 0 with no flags', () => {
      expect(getTechLevel(state.flags, 'soil')).toBe(0);
    });

    it('level 1 via soil testing', () => {
      state.flags['tech_soil_testing'] = true;
      expect(getTechLevel(state.flags, 'soil')).toBe(1);
    });

    it('level 1 via extension reports (alternative)', () => {
      state.flags['tech_extension_reports'] = true;
      expect(getTechLevel(state.flags, 'soil')).toBe(1);
    });

    it('reconvergence: soil_testing and extension_reports give same level', () => {
      const flagsA: Record<string, boolean> = { tech_soil_testing: true };
      const flagsB: Record<string, boolean> = { tech_extension_reports: true };
      expect(getTechLevel(flagsA, 'soil')).toBe(getTechLevel(flagsB, 'soil'));
    });

    it('level 2 via VRA', () => {
      state.flags['tech_vra'] = true;
      expect(getTechLevel(state.flags, 'soil')).toBe(2);
    });

    it('level 2 via drone mapping', () => {
      state.flags['tech_drone_mapping'] = true;
      expect(getTechLevel(state.flags, 'soil')).toBe(2);
    });

    it('level 3 via precision nutrients', () => {
      state.flags['tech_precision_nutrients'] = true;
      expect(getTechLevel(state.flags, 'soil')).toBe(3);
    });

    it('level 3 via organic cert', () => {
      state.flags['tech_organic_cert'] = true;
      expect(getTechLevel(state.flags, 'soil')).toBe(3);
    });
  });

  describe('crop track', () => {
    it('level 0 with no flags', () => {
      expect(getTechLevel(state.flags, 'crop')).toBe(0);
    });

    it('level 1 with one crop unlock', () => {
      state.flags['tech_crop_agave'] = true;
      expect(getTechLevel(state.flags, 'crop')).toBe(1);
    });

    it('level 2 with two crop unlocks', () => {
      state.flags['tech_crop_agave'] = true;
      state.flags['tech_crop_avocado'] = true;
      expect(getTechLevel(state.flags, 'crop')).toBe(2);
    });

    it('capped at level 2 even with all three crops', () => {
      state.flags['tech_crop_agave'] = true;
      state.flags['tech_crop_avocado'] = true;
      state.flags['tech_crop_grapes'] = true;
      expect(getTechLevel(state.flags, 'crop')).toBe(2);
    });
  });

  describe('cross-track independence', () => {
    it('water flags do not affect soil level', () => {
      state.flags['tech_ai_irrigation'] = true;
      expect(getTechLevel(state.flags, 'soil')).toBe(0);
    });

    it('soil flags do not affect water level', () => {
      state.flags['tech_precision_nutrients'] = true;
      expect(getTechLevel(state.flags, 'water')).toBe(0);
    });
  });
});

// ============================================================================
// §3: K-lite Potassium System
// ============================================================================

describe('Slice 5a: K-lite potassium', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
  });

  describe('initial state', () => {
    it('all cells start with potassium = 150', () => {
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          expect(state.grid[r][c].soil.potassium).toBe(150);
        }
      }
    });
  });

  describe('K depletion at harvest', () => {
    it('harvesting a crop reduces soil potassium by crop potassiumUptake', () => {
      const cell = state.grid[0][0];
      plantAndMature(state, 0, 0, 'silage-corn');
      const kBefore = cell.soil.potassium;
      const cropDef = getCropDefinition('silage-corn');
      harvestCell(state, cell);
      expect(cell.soil.potassium).toBe(Math.max(0, kBefore - cropDef.potassiumUptake));
    });

    it('potassium cannot go below 0', () => {
      const cell = state.grid[0][0];
      cell.soil.potassium = 5; // very low
      plantAndMature(state, 0, 0, 'silage-corn');
      harvestCell(state, cell);
      expect(cell.soil.potassium).toBe(0);
    });
  });

  describe('K price impact factor', () => {
    it('full K gives factor 1.0 (no penalty)', () => {
      const cell = state.grid[0][0];
      cell.soil.potassium = 150;
      plantAndMature(state, 0, 0, 'silage-corn');
      const cropDef = getCropDefinition('silage-corn');
      // K factor = clamp(potassium / potassiumUptake, 0.70, 1.0)
      const expectedFactor = Math.min(1.0, Math.max(0.70, cell.soil.potassium / cropDef.potassiumUptake));
      expect(expectedFactor).toBe(1.0);
    });

    it('low K reduces harvest price (floor 0.70)', () => {
      const cell = state.grid[0][0];
      cell.soil.potassium = 10; // very low
      plantAndMature(state, 0, 0, 'silage-corn');
      const cropDef = getCropDefinition('silage-corn');
      // With K=10 and typical potassiumUptake, factor should be < 1.0
      const expectedFactor = Math.min(1.0, Math.max(0.70, 10 / cropDef.potassiumUptake));
      expect(expectedFactor).toBeLessThan(1.0);
      expect(expectedFactor).toBeGreaterThanOrEqual(0.70);
    });

    it('K penalty affects harvest revenue', () => {
      // Harvest with full K
      const stateA = makeState();
      plantAndMature(stateA, 0, 0, 'silage-corn');
      stateA.grid[0][0].soil.potassium = 150;
      const revenueFullK = harvestCell(stateA, stateA.grid[0][0]);

      // Harvest with depleted K
      const stateB = makeState();
      plantAndMature(stateB, 0, 0, 'silage-corn');
      stateB.grid[0][0].soil.potassium = 10;
      const revenueLowK = harvestCell(stateB, stateB.grid[0][0]);

      expect(revenueLowK).toBeLessThan(revenueFullK);
    });

    it('K penalty applies equally with and without soil-testing flag (guardrail #2)', () => {
      // Player WITHOUT soil testing
      const stateA = makeState();
      plantAndMature(stateA, 0, 0, 'silage-corn');
      stateA.grid[0][0].soil.potassium = 30;
      const revenueNoTest = harvestCell(stateA, stateA.grid[0][0]);

      // Player WITH soil testing — penalty should be identical
      const stateB = makeState();
      stateB.flags['tech_soil_testing'] = true;
      plantAndMature(stateB, 0, 0, 'silage-corn');
      stateB.grid[0][0].soil.potassium = 30;
      const revenueWithTest = harvestCell(stateB, stateB.grid[0][0]);

      expect(revenueNoTest).toBe(revenueWithTest);
    });
  });

  describe('K mineralization', () => {
    it('potassium slowly recovers via daily mineralization', () => {
      const cell = state.grid[0][0];
      cell.soil.potassium = 50;
      state.speed = 1;

      // Simulate several ticks
      for (let i = 0; i < 30; i++) {
        simulateTick(state, SLICE_1_SCENARIO);
      }

      // K should have increased slightly from mineralization
      expect(state.grid[0][0].soil.potassium).toBeGreaterThan(50);
    });

    it('potassium is capped at a maximum value', () => {
      const cell = state.grid[0][0];
      cell.soil.potassium = 300; // above cap
      state.speed = 1;

      // Even after a tick, shouldn't exceed cap
      simulateTick(state, SLICE_1_SCENARIO);
      expect(state.grid[0][0].soil.potassium).toBeLessThanOrEqual(200);
    });
  });

  describe('K symptom cues for non-testing players (guardrail #3)', () => {
    it('low-K harvest notification appears for all players, not just soil-testers', () => {
      // Player WITHOUT soil testing flag — should still get symptom notification
      const cell = state.grid[0][0];
      cell.soil.potassium = 15; // critically low
      plantAndMature(state, 0, 0, 'silage-corn');
      const notifCountBefore = state.notifications.length;
      harvestCell(state, cell);

      // Should have a notification mentioning quality/price reduction
      const newNotifs = state.notifications.slice(notifCountBefore);
      const hasKHint = newNotifs.some(n =>
        n.message.toLowerCase().includes('quality') ||
        n.message.toLowerCase().includes('potassium') ||
        n.message.toLowerCase().includes('nutrient'),
      );
      expect(hasKHint).toBe(true);
    });

    it('with soil testing, notification names potassium specifically', () => {
      state.flags['tech_soil_testing'] = true;
      const cell = state.grid[0][0];
      cell.soil.potassium = 15;
      plantAndMature(state, 0, 0, 'silage-corn');
      const notifCountBefore = state.notifications.length;
      harvestCell(state, cell);

      const newNotifs = state.notifications.slice(notifCountBefore);
      const hasExplicitK = newNotifs.some(n =>
        n.message.toLowerCase().includes('potassium'),
      );
      expect(hasExplicitK).toBe(true);
    });

    it('without soil testing, notification uses symptom language (not "potassium")', () => {
      // No soil testing flag
      const cell = state.grid[0][0];
      cell.soil.potassium = 15;
      plantAndMature(state, 0, 0, 'silage-corn');
      const notifCountBefore = state.notifications.length;
      harvestCell(state, cell);

      const newNotifs = state.notifications.slice(notifCountBefore);
      // Should not reveal "potassium" — use vague symptom language
      const hasExplicitK = newNotifs.some(n =>
        n.message.toLowerCase().includes('potassium'),
      );
      expect(hasExplicitK).toBe(false);
    });
  });
});

// ============================================================================
// §4: Crop Gating via requiredFlag
// ============================================================================

describe('Slice 5a: Crop gating (requiredFlag)', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
  });

  it('at least one crop with requiredFlag exists in data', () => {
    // Guard: ensures the gating tests below are not vacuous
    const allIds = getAllCropIds();
    const gatedCrops = allIds.filter(id => getCropDefinition(id).requiredFlag !== undefined);
    expect(gatedCrops.length).toBeGreaterThan(0);
  });

  it('crops without requiredFlag are always available', () => {
    const available = getAvailableCrops(state);
    expect(available.length).toBeGreaterThan(0);
    expect(available).toContain('silage-corn');
  });

  it('crop with requiredFlag is excluded when flag is missing', () => {
    const allIds = getAllCropIds();
    const gatedCrops = allIds.filter(id => getCropDefinition(id).requiredFlag !== undefined);

    // getAvailableCrops should filter out ALL gated crops when flags unset
    const available = getAvailableCrops(state);
    for (const cropId of gatedCrops) {
      expect(available).not.toContain(cropId);
    }
  });

  it('crop with requiredFlag becomes available when flag is set', () => {
    const allIds = getAllCropIds();
    const gatedCrops = allIds.filter(id => getCropDefinition(id).requiredFlag !== undefined);

    for (const cropId of gatedCrops) {
      const def = getCropDefinition(cropId);
      state.flags[def.requiredFlag!] = true;
    }
    // Force into a month that works for planted crops
    state.calendar.month = 3;
    const available = getAvailableCrops(state);
    for (const cropId of gatedCrops) {
      const def = getCropDefinition(cropId);
      if (def.plantingWindow.startMonth <= 3 && def.plantingWindow.endMonth >= 3) {
        expect(available).toContain(cropId);
      }
    }
  });

  it('planting a gated crop without flag returns failure', () => {
    const allIds = getAllCropIds();
    const gatedCrop = allIds.find(id => getCropDefinition(id).requiredFlag !== undefined)!;

    const result = processCommand(state,
      { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: gatedCrop },
      SLICE_1_SCENARIO,
    );
    expect(result.success).toBe(false);
    expect(result.reason).toContain('unlock');
  });
});

// ============================================================================
// §5: Permanent Modifiers (Regime Shift Flags)
// ============================================================================

describe('Slice 5a: Permanent modifiers (regime flags)', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
  });

  describe('regime_water_reduced', () => {
    it('reduced water regime results in lower soil moisture after watering', () => {
      // Water without regime — plant a crop so watering works
      const stateA = makeState();
      processCommand(stateA, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
      stateA.grid[0][0].soil.moisture = 0;
      processCommand(stateA, { type: 'WATER', scope: 'row', index: 0 }, SLICE_1_SCENARIO);
      const moistureWithout = stateA.grid[0][0].soil.moisture;

      // Water with regime
      const stateB = makeState();
      stateB.flags['regime_water_reduced'] = true;
      processCommand(stateB, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
      stateB.grid[0][0].soil.moisture = 0;
      processCommand(stateB, { type: 'WATER', scope: 'row', index: 0 }, SLICE_1_SCENARIO);
      const moistureWith = stateB.grid[0][0].soil.moisture;

      expect(moistureWith).toBeLessThan(moistureWithout);
    });
  });

  describe('regime_market_crash', () => {
    it('market crash regime reduces harvest revenue', () => {
      // Harvest without crash
      const stateA = makeState();
      plantAndMature(stateA, 0, 0, 'silage-corn');
      const revenueNormal = harvestCell(stateA, stateA.grid[0][0]);

      // Harvest with crash
      const stateB = makeState();
      stateB.flags['regime_market_crash'] = true;
      plantAndMature(stateB, 0, 0, 'silage-corn');
      const revenueCrash = harvestCell(stateB, stateB.grid[0][0]);

      expect(revenueCrash).toBeLessThan(revenueNormal);
    });
  });

  describe('regime_heat_threshold', () => {
    it('processing-tomatoes has heatSensitivity defined', () => {
      // Guard: if this fails, the regime test below has no teeth
      const tomatoDef = getCropDefinition('processing-tomatoes');
      expect(tomatoDef.heatSensitivity).toBeDefined();
      expect(tomatoDef.heatSensitivity).toBeGreaterThan(0);
    });

    it('heat threshold regime penalizes heat-sensitive crops', () => {
      const stateA = makeState();
      plantAndMature(stateA, 0, 0, 'processing-tomatoes');
      const revenueNormal = harvestCell(stateA, stateA.grid[0][0]);

      const stateB = makeState();
      stateB.flags['regime_heat_threshold'] = true;
      plantAndMature(stateB, 0, 0, 'processing-tomatoes');
      const revenueHeat = harvestCell(stateB, stateB.grid[0][0]);

      // Unconditional: regime MUST reduce revenue for heat-sensitive crops
      expect(revenueHeat).toBeLessThan(revenueNormal);
    });

    it('heat threshold regime does NOT penalize heat-tolerant crops', () => {
      // Sorghum is heat-tolerant — should be unaffected by heat regime
      // Sorghum planting window is April-June; advance calendar to April
      const stateA = makeState();
      stateA.calendar.month = 4;
      plantAndMature(stateA, 0, 0, 'sorghum');
      const revenueNormal = harvestCell(stateA, stateA.grid[0][0]);

      const stateB = makeState();
      stateB.calendar.month = 4;
      stateB.flags['regime_heat_threshold'] = true;
      plantAndMature(stateB, 0, 0, 'sorghum');
      const revenueHeat = harvestCell(stateB, stateB.grid[0][0]);

      expect(revenueHeat).toBe(revenueNormal);
    });
  });
});

// ============================================================================
// §6: Event Clustering Cap — Separate Pools (guardrail #6)
// ============================================================================

describe('Slice 5a: Event clustering cap (separate pools)', () => {
  let state: GameState;
  let rng: SeededRNG;

  beforeEach(() => {
    state = makeState();
    rng = new SeededRNG(42);
  });

  it('max 1 tech-unlock event per season even when same family type', () => {
    // CRITICAL: Both tech storylets use type: 'climate' (same family).
    // Under the OLD family-cap logic, the second would already be blocked by family.
    // This test uses DIFFERENT family types to prove it's the tech-unlock TAG
    // that caps them, not the family cap.
    const techStorylets: Storylet[] = [
      makeSimpleStorylet({
        id: 'tech-offer-1',
        type: 'climate',   // family = climate
        tags: ['tech-unlock'],
        preconditions: [{ type: 'random', probability: 1.0 }],
      }),
      makeSimpleStorylet({
        id: 'tech-offer-2',
        type: 'advisor',   // family = advisor (different!)
        tags: ['tech-unlock'],
        preconditions: [{ type: 'random', probability: 1.0 }],
      }),
    ];

    const scheduled = drawSeasonalEvents(state, techStorylets, rng, 1.0, 100, 189);

    // Without tech-pool cap, both would pass (different families).
    // With tech-pool cap = 1, only 1 tech event should be scheduled.
    const techEvents = scheduled.filter(s =>
      techStorylets.find(t => t.id === s.storyletId)?.tags?.includes('tech-unlock'),
    );
    expect(techEvents.length).toBe(1);
  });

  it('max 1 non-tech event per season from each family', () => {
    // This verifies existing family cap still works for non-tech events
    const climateStorylets: Storylet[] = [
      makeSimpleStorylet({
        id: 'climate-event-1',
        type: 'climate',
        preconditions: [{ type: 'random', probability: 1.0 }],
      }),
      makeSimpleStorylet({
        id: 'climate-event-2',
        type: 'climate',
        preconditions: [{ type: 'random', probability: 1.0 }],
      }),
    ];

    const scheduled = drawSeasonalEvents(state, climateStorylets, rng, 1.0, 100, 189);
    const climateEvents = scheduled.filter(s =>
      climateStorylets.find(t => t.id === s.storyletId),
    );
    // Family cap: max 1 climate event per season
    expect(climateEvents.length).toBe(1);
  });

  it('tech and non-tech events coexist in same season (separate pools)', () => {
    // Tech event in advisor family + non-tech climate event.
    // Under old logic, both pass (different families) — that's correct but doesn't prove pools.
    // So we also add a SECOND non-tech climate — proving non-tech pool still caps at 1/family
    // while the tech event goes through independently.
    const mixedStorylets: Storylet[] = [
      makeSimpleStorylet({
        id: 'tech-offer',
        type: 'climate',   // Same family as the non-tech event below
        tags: ['tech-unlock'],
        preconditions: [{ type: 'random', probability: 1.0 }],
      }),
      makeSimpleStorylet({
        id: 'climate-event-1',
        type: 'climate',
        preconditions: [{ type: 'random', probability: 1.0 }],
      }),
    ];

    const scheduled = drawSeasonalEvents(state, mixedStorylets, rng, 1.0, 100, 189);

    // Both should fire: tech-offer goes through tech pool, climate-event-1 through non-tech pool.
    // Under OLD logic (family cap only), these share family 'climate' → only 1 would fire.
    // Under NEW logic (separate pools), both fire.
    expect(scheduled.length).toBe(2);
  });

  it('condition-only advisors are not capped by event clustering', () => {
    // Condition-only advisors (no random precondition) should bypass cap entirely
    const advisorStorylets: Storylet[] = [
      makeSimpleStorylet({
        id: 'condition-advisor-1',
        type: 'advisor',
        preconditions: [{ type: 'cash_below', amount: 99999 }],
      }),
      makeSimpleStorylet({
        id: 'condition-advisor-2',
        type: 'advisor',
        preconditions: [{ type: 'cash_below', amount: 99999 }],
      }),
    ];

    // These aren't in seasonal draw at all (no random precondition)
    for (const s of advisorStorylets) {
      expect(hasRandomCondition(s)).toBe(false);
    }

    // They go through evaluateEvents with conditionOnlyAdvisors: true
    const result = evaluateEvents(state, advisorStorylets, rng, { conditionOnlyAdvisors: true });
    // At least one should fire (highest priority)
    expect(result.fireEvent).toBeTruthy();
  });
});

// ============================================================================
// §7: Determinism (guardrail #7)
// ============================================================================

describe('Slice 5a: Determinism after new condition logic', () => {
  it('same seed + same commands = same event/offer sequence', () => {
    // Run two identical games and verify they produce identical state
    const stateA = createInitialState('test-determinism', SLICE_1_SCENARIO);
    const stateB = createInitialState('test-determinism', SLICE_1_SCENARIO);

    stateA.speed = 1;
    stateB.speed = 1;

    // Plant same crops
    processCommand(stateA, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
    processCommand(stateB, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);

    // Simulate 90 days (one season)
    for (let i = 0; i < 90; i++) {
      simulateTick(stateA, SLICE_1_SCENARIO);
      simulateTick(stateB, SLICE_1_SCENARIO);
    }

    // Verify identical state
    expect(stateA.calendar.totalDay).toBe(stateB.calendar.totalDay);
    expect(stateA.economy.cash).toBe(stateB.economy.cash);
    expect(stateA.rngState).toBe(stateB.rngState);
    expect(stateA.eventRngState).toBe(stateB.eventRngState);

    // Check all cells including potassium
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        expect(stateA.grid[r][c].soil.moisture).toBe(stateB.grid[r][c].soil.moisture);
        expect(stateA.grid[r][c].soil.nitrogen).toBe(stateB.grid[r][c].soil.nitrogen);
        expect(stateA.grid[r][c].soil.organicMatter).toBe(stateB.grid[r][c].soil.organicMatter);
        expect(stateA.grid[r][c].soil.potassium).toBe(stateB.grid[r][c].soil.potassium);
      }
    }

    // Event history should match
    expect(stateA.eventLog.length).toBe(stateB.eventLog.length);
    expect(stateA.seasonalEventQueue.length).toBe(stateB.seasonalEventQueue.length);
  });

  it('determinism holds after save/load with new K field', () => {
    let mockStorage: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, value: string) => { mockStorage[key] = value; },
      removeItem: (key: string) => { delete mockStorage[key]; },
      get length() { return Object.keys(mockStorage).length; },
      key: (index: number) => Object.keys(mockStorage)[index] ?? null,
      clear: () => { mockStorage = {}; },
    });

    // Run game A continuously for 60 days
    const stateA = createInitialState('test-determinism', SLICE_1_SCENARIO);
    stateA.speed = 1;
    for (let i = 0; i < 60; i++) {
      simulateTick(stateA, SLICE_1_SCENARIO);
    }

    // Run game B for 30 days, save, load, run 30 more
    const stateB = createInitialState('test-determinism', SLICE_1_SCENARIO);
    stateB.speed = 1;
    for (let i = 0; i < 30; i++) {
      simulateTick(stateB, SLICE_1_SCENARIO);
    }
    autoSave(stateB);
    const stateB2 = loadAutoSave()!;
    expect(stateB2).not.toBeNull();
    stateB2.speed = 1;
    for (let i = 0; i < 30; i++) {
      simulateTick(stateB2, SLICE_1_SCENARIO);
    }

    // Both should be identical — including K
    expect(stateB2.calendar.totalDay).toBe(stateA.calendar.totalDay);
    expect(stateB2.economy.cash).toBe(stateA.economy.cash);
    expect(stateB2.rngState).toBe(stateA.rngState);

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        expect(stateB2.grid[r][c].soil.potassium).toBe(stateA.grid[r][c].soil.potassium);
      }
    }
  });
});

// ============================================================================
// §8: Save Migration V7 → V8 (guardrail #8)
// ============================================================================

describe('Slice 5a: Save migration V7 → V8', () => {
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    mockStorage = {};
    const storage = {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, value: string) => { mockStorage[key] = value; },
      removeItem: (key: string) => { delete mockStorage[key]; },
      get length() { return Object.keys(mockStorage).length; },
      key: (index: number) => Object.keys(mockStorage)[index] ?? null,
      clear: () => { mockStorage = {}; },
    };
    vi.stubGlobal('localStorage', storage);
  });

  it('SAVE_VERSION is 8.0.0', () => {
    expect(SAVE_VERSION).toBe('8.0.0');
  });

  it('migrates V7 save by adding potassium: 150 to all cells', () => {
    // Create a V7-shaped save (missing potassium in soil)
    const state = createInitialState('test-player', SLICE_1_SCENARIO);
    const v7Save = {
      version: '7.0.0',
      state: JSON.parse(JSON.stringify(state)),
      timestamp: Date.now(),
    };

    // Strip potassium from all cells to simulate V7
    for (const row of v7Save.state.grid) {
      for (const cell of row) {
        delete (cell.soil as Record<string, unknown>).potassium;
      }
    }

    mockStorage[AUTOSAVE_KEY] = JSON.stringify(v7Save);
    const loaded = loadAutoSave()!;
    expect(loaded).not.toBeNull();

    // Every cell should now have potassium = 150
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        expect(loaded.grid[r][c].soil.potassium).toBe(150);
      }
    }
  });

  it('V6 → V7 → V8 full migration chain works', () => {
    const state = createInitialState('test-player', SLICE_1_SCENARIO);
    const v6Save = {
      version: '6.0.0',
      state: JSON.parse(JSON.stringify(state)),
      timestamp: Date.now(),
    };

    // Strip V7 and V8 fields
    delete (v6Save.state as Record<string, unknown>).scenarioId;
    for (const row of v6Save.state.grid) {
      for (const cell of row) {
        delete (cell.soil as Record<string, unknown>).potassium;
      }
    }
    // Also strip V7 tracking additions
    if (v6Save.state.tracking?.currentExpenses) {
      delete (v6Save.state.tracking.currentExpenses as Record<string, unknown>).annualOverhead;
    }

    mockStorage[AUTOSAVE_KEY] = JSON.stringify(v6Save);
    const loaded = loadAutoSave()!;
    expect(loaded).not.toBeNull();
    expect(loaded.grid[0][0].soil.potassium).toBe(150);
  });

  it('V1 → ... → V8 full migration chain works', () => {
    // Start from a minimal V1 save structure
    const state = createInitialState('test-player', SLICE_1_SCENARIO);
    const v1Save = {
      version: '1.0.0',
      state: JSON.parse(JSON.stringify(state)),
      timestamp: Date.now(),
    };

    // Strip everything added in V2+
    const s = v1Save.state as Record<string, unknown>;
    delete s.eventLog;
    delete s.activeEvent;
    delete s.pendingForeshadows;
    delete s.activeEffects;
    delete s.cropFailureStreak;
    delete s.flags;
    delete s.wateringRestricted;
    delete s.wateringRestrictionEndsDay;

    delete s.eventRngState;
    delete s.frostProtectionEndsDay;
    delete s.tracking;
    delete s.eventsThisSeason;
    delete s.actedSincePause;
    delete s.seasonalEventQueue;
    delete s.yearStressLevel;
    delete s.scenarioId;
    // Strip cell fields from V3+
    for (const row of v1Save.state.grid) {
      for (const cell of row) {
        delete (cell as Record<string, unknown>).chillHoursAccumulated;
        delete (cell.soil as Record<string, unknown>).potassium;
        delete (cell as Record<string, unknown>).lastCropId;
        delete (cell as Record<string, unknown>).lastHarvestYieldRatio;
        delete (cell as Record<string, unknown>).coverCropId;
        delete (cell as Record<string, unknown>).frostProtectionEndsDay;
        if (cell.crop) {
          delete (cell.crop as Record<string, unknown>).chillHoursAccumulated;
        }
      }
    }

    mockStorage[AUTOSAVE_KEY] = JSON.stringify(v1Save);
    const loaded = loadAutoSave();
    // Full chain MUST succeed — null means migration is broken
    expect(loaded).not.toBeNull();
    expect(loaded!.grid[0][0].soil.potassium).toBe(150);
  });

  it('current-version save roundtrips correctly with potassium', () => {
    const state = createInitialState('test-player', SLICE_1_SCENARIO);
    // Modify K in some cells
    state.grid[0][0].soil.potassium = 75;
    state.grid[3][3].soil.potassium = 200;

    autoSave(state);
    const loaded = loadAutoSave()!;
    expect(loaded).not.toBeNull();
    expect(loaded.grid[0][0].soil.potassium).toBe(75);
    expect(loaded.grid[3][3].soil.potassium).toBe(200);
  });
});

// ============================================================================
// §9: Auto-irrigation hook
// ============================================================================

describe('Slice 5a: Auto-irrigation', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
    state.speed = 1;
  });

  it('without irrigation tech, water_stress auto-pause still fires', () => {
    // Plant crops and drain moisture to trigger stress
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
    state.grid[0][0].soil.moisture = 0; // force water stress

    simulateTick(state, SLICE_1_SCENARIO);

    const hasWaterPause = state.autoPauseQueue.some(p => p.reason === 'water_stress');
    expect(hasWaterPause).toBe(true);
  });

  it('with water tech level >= 1, auto-irrigation waters crops instead of pausing', () => {
    state.flags['tech_drip_irrigation'] = true; // water level 1

    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);

    // Drain moisture to trigger stress threshold
    state.grid[0][0].soil.moisture = 0;
    state.waterStressPausedThisSeason = false;

    const cashBefore = state.economy.cash;
    simulateTick(state, SLICE_1_SCENARIO);

    // Should NOT get water_stress auto-pause
    const hasWaterPause = state.autoPauseQueue.some(p => p.reason === 'water_stress');
    expect(hasWaterPause).toBe(false);

    // Should have spent some cash on auto-irrigation
    expect(state.economy.cash).toBeLessThan(cashBefore);
  });

  it('auto-irrigation costs less at higher tech levels', () => {
    // Level 1 irrigation cost
    const stateL1 = makeState();
    stateL1.flags['tech_drip_irrigation'] = true;
    stateL1.speed = 1;
    processCommand(stateL1, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
    stateL1.grid[0][0].soil.moisture = 0;
    const cashBeforeL1 = stateL1.economy.cash;
    simulateTick(stateL1, SLICE_1_SCENARIO);
    const costL1 = cashBeforeL1 - stateL1.economy.cash;

    // Level 2 irrigation cost
    const stateL2 = makeState();
    stateL2.flags['tech_water_recycling'] = true;
    stateL2.speed = 1;
    processCommand(stateL2, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
    stateL2.grid[0][0].soil.moisture = 0;
    const cashBeforeL2 = stateL2.economy.cash;
    simulateTick(stateL2, SLICE_1_SCENARIO);
    const costL2 = cashBeforeL2 - stateL2.economy.cash;

    // Both must have fired auto-irrigation
    expect(costL1).toBeGreaterThan(0);
    expect(costL2).toBeGreaterThan(0);
    // Level 2 should cost less than level 1
    expect(costL2).toBeLessThan(costL1);
  });

  it('auto-irrigation skips when player has no cash', () => {
    state.flags['tech_drip_irrigation'] = true;

    // Plant first (costs seed money), then zero out cash
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
    state.economy.cash = 0;
    state.grid[0][0].soil.moisture = 0;
    state.waterStressPausedThisSeason = false;

    simulateTick(state, SLICE_1_SCENARIO);

    // With no cash, should fall back to water_stress pause
    const hasWaterPause = state.autoPauseQueue.some(p => p.reason === 'water_stress');
    expect(hasWaterPause).toBe(true);
  });
});

// ============================================================================
// §10: Harvest Affordance (ready count)
// ============================================================================

describe('Slice 5a: Harvest affordance count', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
  });

  it('harvest_ready auto-pause message includes count of ready plots', () => {
    // Plant 3 crops and set them to just below harvestable threshold
    // so that one tick of GDD accumulation pushes them to harvestable
    const cropDef = getCropDefinition('silage-corn');
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 1, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 2, cropId: 'silage-corn' }, SLICE_1_SCENARIO);

    // Force all 3 to harvestable stage (but avoid simulateCrop transitioning to overripe
    // by setting gddAccumulated just below threshold — simulateCrop accumulates GDD first,
    // then checks growth stage, so they'll become harvestable on THIS tick)
    for (let c = 0; c < 3; c++) {
      const crop = state.grid[0][c].crop!;
      crop.gddAccumulated = cropDef.gddToMaturity - 1; // just below threshold
      crop.growthStage = 'flowering'; // stage before harvestable
    }

    state.speed = 1;
    simulateTick(state, SLICE_1_SCENARIO);

    // After the tick, check for harvest_ready auto-pause with count
    const harvestPause = state.autoPauseQueue.find(p => p.reason === 'harvest_ready');
    expect(harvestPause).toBeTruthy();
    expect(harvestPause!.message).toMatch(/3/); // Should mention "3 plots" or similar
  });
});

// ============================================================================
// §11: CropDefinition.potassiumUptake exists for all crops
// ============================================================================

describe('Slice 5a: CropDefinition potassiumUptake', () => {
  it('all crop definitions have potassiumUptake defined', () => {
    const allIds = getAllCropIds();
    for (const id of allIds) {
      const def = getCropDefinition(id);
      expect(def.potassiumUptake).toBeDefined();
      expect(def.potassiumUptake).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// §12: Reoffer Infrastructure (condition-level proof)
// ============================================================================

describe('Slice 5a: Reoffer infrastructure', () => {
  let state: GameState;
  let rng: SeededRNG;

  beforeEach(() => {
    state = makeState();
    rng = new SeededRNG(42);
  });

  it('reoffer storylet uses not_has_flag + tech_level_below to gate on skipped tech', () => {
    // Simulate: player skipped drip irrigation (no water tech).
    // A reoffer storylet checks not_has_flag (didn't take original) + tech_level_below (hasn't progressed).
    const reofferConditions: Condition[] = [
      { type: 'not_has_flag', flag: 'tech_drip_irrigation' } as Condition,
      { type: 'tech_level_below', track: 'water', level: 1 } as Condition,
      { type: 'min_year', year: 5 },
    ];

    // Year 1, no tech → meets first two conditions, fails year check
    state.calendar.year = 1;
    const allPass = reofferConditions.every(c => evaluateCondition(c, state, rng));
    expect(allPass).toBe(false); // year check blocks

    // Year 5, no tech → all conditions pass
    state.calendar.year = 5;
    const allPassY5 = reofferConditions.every(c => evaluateCondition(c, state, rng));
    expect(allPassY5).toBe(true);

    // Year 5, already has drip → not_has_flag blocks
    state.flags['tech_drip_irrigation'] = true;
    const allPassWithTech = reofferConditions.every(c => evaluateCondition(c, state, rng));
    expect(allPassWithTech).toBe(false);
  });

  it('reoffer gates on economic context via cash/debt conditions (no new state)', () => {
    // Reoffer should be shaped by cash and debt — NOT a new "credit history" field (guardrail #5)
    const cheapReofferConditions: Condition[] = [
      { type: 'cash_below', amount: 20000 },
      { type: 'not_has_flag', flag: 'tech_smart_irrigation' } as Condition,
    ];

    state.economy.cash = 15000; // low cash → qualifies for cheap reoffer
    const qualifies = cheapReofferConditions.every(c => evaluateCondition(c, state, rng));
    expect(qualifies).toBe(true);

    state.economy.cash = 40000; // flush → doesn't qualify for the cheap version
    const noQualify = cheapReofferConditions.every(c => evaluateCondition(c, state, rng));
    expect(noQualify).toBe(false);
  });
});

// ============================================================================
// §13: Message Variety Pool
// ============================================================================

describe('Slice 5a: Message variety pool', () => {
  it('pickMessage returns a string from the pool', () => {
    // pickMessage(pool, rng) should select one message from an array
    const pool = [
      'Your crops are thirsty!',
      'The soil is dry — consider irrigating.',
      'Water levels are critically low.',
    ];
    const rng = new SeededRNG(42);
    const message = pickMessage(pool, rng);
    expect(pool).toContain(message);
  });

  it('pickMessage with different seeds produces different selections over many calls', () => {
    const pool = [
      'Message A',
      'Message B',
      'Message C',
      'Message D',
    ];
    const seen = new Set<string>();
    // Run with 20 different seeds — should see at least 2 different messages
    for (let seed = 0; seed < 20; seed++) {
      const rng = new SeededRNG(seed);
      seen.add(pickMessage(pool, rng));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('pickMessage with single-entry pool always returns that entry', () => {
    const pool = ['Only option'];
    const rng = new SeededRNG(42);
    expect(pickMessage(pool, rng)).toBe('Only option');
  });
});

// ============================================================================
// getTechLevel + pickMessage — imported from production code.
// Tests MUST use the production function, not a local stub.
// ============================================================================
import { getTechLevel } from '../../src/engine/tech-levels.ts';
import { pickMessage } from '../../src/engine/game.ts';

// ============================================================================
// §14: Regression — Auto-irrigation handles repeated stress (SR review #1)
// ============================================================================

describe('Slice 5a: Auto-irrigation repeated stress', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
    state.flags['tech_drip_irrigation'] = true; // water level 1
    state.speed = 1;
  });

  it('auto-irrigation fires on second water stress in same season', () => {
    // Plant corn, trigger first stress
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
    state.grid[0][0].soil.moisture = 0;
    const cashBefore1 = state.economy.cash;
    simulateTick(state, SLICE_1_SCENARIO);
    const cost1 = cashBefore1 - state.economy.cash;
    expect(cost1).toBeGreaterThan(0); // auto-watered

    // Drain moisture again — second stress same season
    state.grid[0][0].soil.moisture = 0;
    const cashBefore2 = state.economy.cash;
    simulateTick(state, SLICE_1_SCENARIO);
    const cost2 = cashBefore2 - state.economy.cash;

    // Second stress must ALSO be handled (not silently ignored)
    expect(cost2).toBeGreaterThan(0);
  });
});

// ============================================================================
// §15: Regression — Auto-irrigation respects event restrictions (SR review #2)
// ============================================================================

describe('Slice 5a: Auto-irrigation event restrictions', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
    state.flags['tech_drip_irrigation'] = true;
    state.speed = 1;
  });

  it('auto-irrigation does not fire when wateringRestricted is true', () => {
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
    state.grid[0][0].soil.moisture = 0;
    state.wateringRestricted = true;

    const cashBefore = state.economy.cash;
    simulateTick(state, SLICE_1_SCENARIO);

    // Should NOT have spent cash on auto-irrigation
    expect(state.economy.cash).toBe(cashBefore);
    // Should have fallen through to manual pause
    const hasWaterPause = state.autoPauseQueue.some(p => p.reason === 'water_stress');
    expect(hasWaterPause).toBe(true);
  });

  it('auto-irrigation applies event cost modifiers on top of tech discount', () => {
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);

    // First: measure cost WITHOUT event modifier
    state.grid[0][0].soil.moisture = 0;
    const cashBefore1 = state.economy.cash;
    simulateTick(state, SLICE_1_SCENARIO);
    const costNoEvent = cashBefore1 - state.economy.cash;

    // Now add a 2x irrigation cost modifier (simulating water-allocation-cut)
    state.activeEffects.push({
      effectType: 'irrigation_cost_modifier',
      multiplier: 2.0,
      expiresDay: state.calendar.totalDay + 100,
      sourceEventId: 'test-surcharge',
    });

    state.grid[0][0].soil.moisture = 0;
    const cashBefore2 = state.economy.cash;
    simulateTick(state, SLICE_1_SCENARIO);
    const costWithEvent = cashBefore2 - state.economy.cash;

    // Event modifier should increase cost
    expect(costWithEvent).toBeGreaterThan(costNoEvent);
  });
});

// ============================================================================
// §16: Regression — Crop gating in bulk planting (SR review #3)
// ============================================================================

describe('Slice 5a: Crop gating bulk planting', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
    state.calendar.month = 4; // April — within agave planting window (3-5)
  });

  it('PLANT_BULK rejects gated crops without required flag', () => {
    const result = processCommand(state, {
      type: 'PLANT_BULK',
      scope: 'row',
      cropId: 'agave',
      index: 0,
    }, SLICE_1_SCENARIO);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('technology unlock');
  });

  it('PLANT_BULK allows gated crops when flag is set', () => {
    state.flags['tech_crop_agave'] = true;
    const result = processCommand(state, {
      type: 'PLANT_BULK',
      scope: 'row',
      cropId: 'agave',
      index: 0,
    }, SLICE_1_SCENARIO);
    expect(result.success).toBe(true);
  });
});
