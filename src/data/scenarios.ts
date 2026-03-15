/**
 * Scenario Factory — Generates 5 climate scenarios for balance testing + gameplay.
 *
 * Each scenario defines a 30-year climate trajectory for the San Joaquin Valley
 * with different difficulty profiles. The factory parameterizes:
 * - Warming rate, drought years, water allocation trajectory
 * - Chill hour decline, heatwave/frost probability
 *
 * The `gradual-warming` scenario produces IDENTICAL year data to the original
 * SLICE_1_SCENARIO (verified by frozen fixture test).
 */

import type { ClimateScenario, YearClimate, SeasonParams } from '../engine/types.ts';

// ============================================================================
// Scenario Config
// ============================================================================

export interface ScenarioConfig {
  id: string;
  name: string;
  description: string;
  baseSeed: number;
  warmingRate: number;
  droughtYears: number[];
  waterAllocationBase: number;
  waterAllocationFloor: number;
  waterAllocationDeclineRate: number;
  chillHoursByEra: [number, number, number, number]; // years 1-5, 6-15, 16-25, 26-30
  baseHeatwaveProb: number;
  baseFrostProb: number;        // spring frost, early years
  lateFrostProb: number;        // spring frost, later years
  winterFrostProb: number;      // winter frost, early years
  lateWinterFrostProb: number;  // winter frost, later years
  summerET0Base: number;
  droughtET0: number;           // ET0 during drought years
  droughtPrecipProb: number;    // summer precip during drought
  droughtHeatwaveProb: number;  // heatwave prob during drought
  extraHeatStartYear: number;   // year when extra heatwave prob kicks in
  extraHeatAmount: number;      // additional heatwave prob
  // Slice 5c: Market crash targeting
  marketCrashTargetCropId: string;   // which crop's price crashes permanently
  marketCrashFactor: number;         // price multiplier (e.g., 0.70 = 30% drop)
}

// ============================================================================
// Base SJV Climate Constants (shared by all scenarios)
// ============================================================================

function makeSeasonParams(overrides: Partial<SeasonParams> = {}): SeasonParams {
  return {
    avgTempHigh: 75,
    avgTempLow: 50,
    tempVariance: 8,
    precipProbability: 0.05,
    precipIntensity: 0.3,
    avgET0: 0.2,
    heatwaveProbability: 0,
    frostProbability: 0,
    ...overrides,
  };
}

// ============================================================================
// Factory
// ============================================================================

function generateScenario(config: ScenarioConfig): ClimateScenario {
  const years: YearClimate[] = [];

  for (let y = 1; y <= 30; y++) {
    const warmingOffset = (y - 1) * config.warmingRate;
    const waterAllocation = Math.max(
      config.waterAllocationFloor,
      config.waterAllocationBase - (y - 1) * config.waterAllocationDeclineRate,
    );

    const isDrought = config.droughtYears.includes(y);
    const extraHeat = y >= config.extraHeatStartYear ? config.extraHeatAmount : 0;

    const chillHours =
      y <= 5  ? config.chillHoursByEra[0] :
      y <= 15 ? config.chillHoursByEra[1] :
      y <= 25 ? config.chillHoursByEra[2] :
                config.chillHoursByEra[3];

    years.push({
      year: y,
      chillHours,
      seasons: {
        spring: makeSeasonParams({
          avgTempHigh: 75 + warmingOffset,
          avgTempLow: 48 + warmingOffset,
          tempVariance: 10,
          precipProbability: 0.12,
          precipIntensity: 0.4,
          avgET0: 0.18,
          frostProbability: y <= 5 ? config.baseFrostProb : config.lateFrostProb,
        }),
        summer: makeSeasonParams({
          avgTempHigh: (isDrought ? 102 : 97) + warmingOffset,
          avgTempLow: 63 + warmingOffset,
          tempVariance: 6,
          precipProbability: isDrought ? config.droughtPrecipProb : 0.03,
          precipIntensity: 0.2,
          avgET0: isDrought ? config.droughtET0 : config.summerET0Base,
          heatwaveProbability: isDrought ? config.droughtHeatwaveProb : config.baseHeatwaveProb + extraHeat,
        }),
        fall: makeSeasonParams({
          avgTempHigh: 78 + warmingOffset,
          avgTempLow: 50 + warmingOffset,
          tempVariance: 12,
          precipProbability: 0.08,
          precipIntensity: 0.5,
          avgET0: 0.15,
        }),
        winter: makeSeasonParams({
          avgTempHigh: 57 + warmingOffset,
          avgTempLow: 38 + warmingOffset,
          tempVariance: 8,
          precipProbability: 0.20,
          precipIntensity: 0.6,
          avgET0: 0.08,
          frostProbability: y <= 15 ? config.winterFrostProb : config.lateWinterFrostProb,
        }),
      },
      waterAllocation,
    });
  }

  return {
    id: config.id,
    name: config.name,
    description: config.description,
    seed: config.baseSeed,
    years,
    marketCrashTargetCropId: config.marketCrashTargetCropId,
    marketCrashFactor: config.marketCrashFactor,
  };
}

// ============================================================================
// Scenario Configs
// ============================================================================

/**
 * Gradual Warming — matches the original SLICE_1_SCENARIO data exactly.
 * Mild-to-moderate difficulty. Year 3 dry summer. Good for learning basics.
 */
const GRADUAL_WARMING_CONFIG: ScenarioConfig = {
  id: 'gradual-warming',
  name: 'Gradual Warming',
  description: 'A manageable 30-year track with gradual warming and one dry summer early on. Good for learning the basics.',
  baseSeed: 42,
  warmingRate: 0.1,
  droughtYears: [3],
  waterAllocationBase: 1.0,
  waterAllocationFloor: 0.7,
  waterAllocationDeclineRate: 0.008,
  chillHoursByEra: [800, 700, 630, 570],
  baseHeatwaveProb: 0.1,
  baseFrostProb: 0.05,
  lateFrostProb: 0.02,
  winterFrostProb: 0.15,
  lateWinterFrostProb: 0.08,
  summerET0Base: 0.30,
  droughtET0: 0.35,
  droughtPrecipProb: 0.01,
  droughtHeatwaveProb: 0.4,
  extraHeatStartYear: 10,
  extraHeatAmount: 0.02,
  marketCrashTargetCropId: 'almonds',
  marketCrashFactor: 0.70,
};

/**
 * Early Drought — Years 2-5 severe. Tests early adaptation.
 * Higher warming, lower water allocation, more frequent heatwaves.
 */
const EARLY_DROUGHT_CONFIG: ScenarioConfig = {
  id: 'early-drought',
  name: 'Early Drought',
  description: 'Severe drought hits years 2-5. Water is scarce early. Adaptation must begin immediately.',
  baseSeed: 137,
  warmingRate: 0.12,
  droughtYears: [2, 3, 4, 5],
  waterAllocationBase: 0.8,
  waterAllocationFloor: 0.55,
  waterAllocationDeclineRate: 0.009,
  chillHoursByEra: [780, 680, 600, 550],
  baseHeatwaveProb: 0.15,
  baseFrostProb: 0.04,
  lateFrostProb: 0.02,
  winterFrostProb: 0.12,
  lateWinterFrostProb: 0.06,
  summerET0Base: 0.32,
  droughtET0: 0.38,
  droughtPrecipProb: 0.005,
  droughtHeatwaveProb: 0.5,
  extraHeatStartYear: 8,
  extraHeatAmount: 0.03,
  marketCrashTargetCropId: 'almonds',
  marketCrashFactor: 0.70,
};

/**
 * Whiplash — Alternating drought/wet every 3-4 years.
 * High variance makes planning difficult but multiple strategies can work.
 */
const WHIPLASH_CONFIG: ScenarioConfig = {
  id: 'whiplash',
  name: 'Whiplash Weather',
  description: 'Alternating drought and wet cycles every few years. Unpredictable conditions demand flexible strategies.',
  baseSeed: 256,
  warmingRate: 0.08,
  droughtYears: [2, 3, 7, 8, 12, 13, 17, 18, 22, 23, 27, 28],
  waterAllocationBase: 1.0,
  waterAllocationFloor: 0.60,
  waterAllocationDeclineRate: 0.010,
  chillHoursByEra: [800, 720, 650, 600],
  baseHeatwaveProb: 0.08,
  baseFrostProb: 0.06,
  lateFrostProb: 0.04,
  winterFrostProb: 0.18,
  lateWinterFrostProb: 0.10,
  summerET0Base: 0.28,
  droughtET0: 0.36,
  droughtPrecipProb: 0.01,
  droughtHeatwaveProb: 0.45,
  extraHeatStartYear: 12,
  extraHeatAmount: 0.02,
  marketCrashTargetCropId: 'almonds',
  marketCrashFactor: 0.70,
};

/**
 * Late Escalation — Easy first 15 years, severe 15-30.
 * Lulls students into complacency, then punishes inaction.
 */
const LATE_ESCALATION_CONFIG: ScenarioConfig = {
  id: 'late-escalation',
  name: 'Delayed Shift',
  description: 'The first 15 years are mild. Then rapid warming, water cuts, and frequent heatwaves test your resilience.',
  baseSeed: 389,
  warmingRate: 0.15,
  droughtYears: [16, 17, 18, 20, 22, 24, 25, 27, 28, 29, 30],
  waterAllocationBase: 1.0,
  waterAllocationFloor: 0.50,
  waterAllocationDeclineRate: 0.006,  // slow early, but low floor
  chillHoursByEra: [800, 720, 580, 500],
  baseHeatwaveProb: 0.05,
  baseFrostProb: 0.04,
  lateFrostProb: 0.01,
  winterFrostProb: 0.15,
  lateWinterFrostProb: 0.05,
  summerET0Base: 0.28,
  droughtET0: 0.38,
  droughtPrecipProb: 0.008,
  droughtHeatwaveProb: 0.5,
  extraHeatStartYear: 15,
  extraHeatAmount: 0.04,
  marketCrashTargetCropId: 'almonds',
  marketCrashFactor: 0.70,
};

/**
 * Mild Baseline — Low severity control scenario.
 * Most strategies should survive. Some students will succeed easily.
 */
const MILD_BASELINE_CONFIG: ScenarioConfig = {
  id: 'mild-baseline',
  name: 'Baseline Pattern',
  description: 'Relatively forgiving climate with slow warming and adequate water. A good scenario for first-time players.',
  baseSeed: 501,
  warmingRate: 0.05,
  droughtYears: [8],  // Single mild drought year
  waterAllocationBase: 1.0,
  waterAllocationFloor: 0.85,
  waterAllocationDeclineRate: 0.005,
  chillHoursByEra: [820, 750, 680, 650],
  baseHeatwaveProb: 0.06,
  baseFrostProb: 0.04,
  lateFrostProb: 0.02,
  winterFrostProb: 0.12,
  lateWinterFrostProb: 0.08,
  summerET0Base: 0.28,
  droughtET0: 0.33,
  droughtPrecipProb: 0.015,
  droughtHeatwaveProb: 0.3,
  extraHeatStartYear: 20,
  extraHeatAmount: 0.01,
  marketCrashTargetCropId: 'almonds',
  marketCrashFactor: 0.70,
};

// ============================================================================
// Registry
// ============================================================================

export const SCENARIOS: Record<string, ClimateScenario> = {
  'gradual-warming': generateScenario(GRADUAL_WARMING_CONFIG),
  'early-drought': generateScenario(EARLY_DROUGHT_CONFIG),
  'whiplash': generateScenario(WHIPLASH_CONFIG),
  'late-escalation': generateScenario(LATE_ESCALATION_CONFIG),
  'mild-baseline': generateScenario(MILD_BASELINE_CONFIG),
};

/** All scenario IDs for iteration */
export const SCENARIO_IDS = Object.keys(SCENARIOS);

/** Backward-compatible export — same data as gradual-warming */
export const SLICE_1_SCENARIO = SCENARIOS['gradual-warming'];

/** Get a scenario config for introspection (used by diversified-adaptive bot) */
export const SCENARIO_CONFIGS: Record<string, ScenarioConfig> = {
  'gradual-warming': GRADUAL_WARMING_CONFIG,
  'early-drought': EARLY_DROUGHT_CONFIG,
  'whiplash': WHIPLASH_CONFIG,
  'late-escalation': LATE_ESCALATION_CONFIG,
  'mild-baseline': MILD_BASELINE_CONFIG,
};

// ============================================================================
// Scenario Resolution (used by adapter layer for save/load)
// ============================================================================

/** Aliases for pre-Slice 4 scenario IDs */
const SCENARIO_ALIASES: Record<string, string> = {
  'slice-1-baseline': 'gradual-warming',
};

/**
 * Resolve a scenario ID to a ClimateScenario, with alias and fallback support.
 * Returns the scenario and whether a fallback was used.
 */
export function resolveScenarioId(scenarioId: string): { scenario: ClimateScenario; fallback: boolean } {
  if (SCENARIOS[scenarioId]) return { scenario: SCENARIOS[scenarioId], fallback: false };
  const alias = SCENARIO_ALIASES[scenarioId];
  if (alias && SCENARIOS[alias]) return { scenario: SCENARIOS[alias], fallback: false };
  console.warn(`Unknown scenario "${scenarioId}", falling back to gradual-warming`);
  return { scenario: SCENARIOS['gradual-warming'], fallback: true };
}
