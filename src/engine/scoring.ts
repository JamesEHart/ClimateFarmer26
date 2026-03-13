/**
 * Scoring Engine — Computes end-of-game score and completion code.
 *
 * Pure functions, zero UI deps, headless-testable.
 * Score is computed on-demand from GameState — no new state fields needed.
 *
 * SPEC §31: Weighted composite rewarding resilient, sustainable farming.
 */

import type { GameState } from './types.ts';
import { GRID_ROWS, GRID_COLS } from './types.ts';

// ============================================================================
// Types
// ============================================================================

export interface ScoreComponent {
  id: 'financial' | 'soil' | 'diversity' | 'adaptation' | 'consistency';
  label: string;
  raw: number;       // 0–100 before weighting
  weight: number;    // decimal (0.30, 0.20, etc.)
  weighted: number;  // raw × weight
  explanation: string;
}

export interface ScoreResult {
  total: number;     // 0–100 composite
  tier: 'Thriving' | 'Stable' | 'Struggling' | 'Failed';
  components: ScoreComponent[];
  completionCode: string;
  yearsSurvived: number;
}

// ============================================================================
// Scoring Weights (stable formula — SPEC §31)
// ============================================================================

const W_FINANCIAL = 0.30;
const W_SOIL = 0.20;
const W_DIVERSITY = 0.20;
const W_ADAPTATION = 0.20;
const W_CONSISTENCY = 0.10;

// ============================================================================
// Normalization Thresholds (tunable after observing student data)
// ============================================================================

/** Cash at which financial score caps at 100 */
export const FINANCIAL_CEILING = 400_000;

/** Starting OM% — maintaining = 60 raw */
export const SOIL_OM_BASELINE = 2.0;

/** OM% at which soil score caps at 100 */
export const SOIL_OM_EXCELLENT = 3.0;

/** Number of ungated base crops for richness normalization */
export const DIVERSITY_BASE_CROPS = 7;

/** Unique crops needed for +10 diversity bonus */
export const DIVERSITY_BONUS_THRESHOLD = 5;

/** Crop transitions for full adaptation credit */
export const ADAPTATION_TRANSITION_TARGET = 10;

/** Drought-tolerant types adopted for full credit */
export const ADAPTATION_DROUGHT_TARGET = 2;

/** Cover crop years for full adaptation credit */
export const ADAPTATION_COVERCROPS_TARGET = 5;

// ============================================================================
// Scenario Abbreviations (for completion code display)
// ============================================================================

const SCENARIO_ABBREV: Record<string, string> = {
  'gradual-warming': 'GW',
  'early-drought': 'ED',
  'whiplash': 'WH',
  'late-escalation': 'LE',
  'mild-baseline': 'MB',
};

// ============================================================================
// Component Scoring Functions
// ============================================================================

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Financial Stability (30%) — normalized final cash */
export function computeFinancialScore(state: GameState): number {
  const cash = state.economy.cash;
  if (cash <= 0) return 0;
  return clamp(cash / FINANCIAL_CEILING * 100, 0, 100);
}

/** Soil Health (20%) — average OM% with bonus for maintaining/improving */
export function computeSoilScore(state: GameState): number {
  let totalOM = 0;
  let cellCount = 0;
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      totalOM += state.grid[r][c].soil.organicMatter;
      cellCount++;
    }
  }
  const avgOM = cellCount > 0 ? totalOM / cellCount : 0;

  if (avgOM >= SOIL_OM_BASELINE) {
    // Maintaining starting OM = 60 raw. Improving above earns up to 100.
    const bonus = clamp(
      (avgOM - SOIL_OM_BASELINE) / (SOIL_OM_EXCELLENT - SOIL_OM_BASELINE) * 40,
      0, 40,
    );
    return 60 + bonus;
  }
  // Below baseline: proportional penalty
  return clamp(avgOM / SOIL_OM_BASELINE * 60, 0, 60);
}

/**
 * Crop Diversity (20%) — normalized crop richness.
 *
 * Uses planted_crop_* flags as the authoritative source for which crops were
 * ever planted (set at planting time, not year-end). This avoids undercounting
 * annuals harvested before the December snapshot.
 *
 * Metric: ln(uniqueCrops) / ln(maxCrops) — equivalent to Shannon entropy
 * at maximum evenness, but we only have binary "was it ever planted" data,
 * so this is properly labeled as normalized crop richness.
 */
export function computeDiversityScore(state: GameState): number {
  const uniqueCrops = countUniqueCropsPlanted(state);
  if (uniqueCrops <= 1) return 0;

  // Normalized crop richness: ln(unique) / ln(max)
  const raw = clamp(Math.log(uniqueCrops) / Math.log(DIVERSITY_BASE_CROPS) * 100, 0, 100);

  // Bonus for planting 5+ distinct crops
  const bonus = uniqueCrops >= DIVERSITY_BONUS_THRESHOLD ? 10 : 0;
  return Math.min(100, raw + bonus);
}

/**
 * Count unique crops ever planted using planted_crop_* flags (authoritative).
 * Falls back to yearSnapshots[].cropCounts + current grid for older saves.
 */
export function countUniqueCropsPlanted(state: GameState): number {
  const cropsGrown = new Set<string>();

  // Primary: planted_crop_* flags (set at planting time)
  const prefix = 'planted_crop_';
  for (const flag of Object.keys(state.flags)) {
    if (flag.startsWith(prefix) && state.flags[flag]) {
      cropsGrown.add(flag.slice(prefix.length));
    }
  }

  // Fallback: snapshots + grid for saves predating the flags
  for (const snap of state.tracking.yearSnapshots) {
    for (const cropId of Object.keys(snap.cropCounts)) {
      cropsGrown.add(cropId);
    }
  }
  for (const row of state.grid) {
    for (const cell of row) {
      if (cell.crop) cropsGrown.add(cell.crop.cropId);
    }
  }

  return cropsGrown.size;
}

/**
 * Climate Adaptation (20%) — three outcome-based sub-signals.
 * SPEC: no credit for advisor interaction itself.
 */
export function computeAdaptationScore(state: GameState): number {
  const { cropTransitions, droughtTolerantTypesAdopted } = state.tracking;

  // Sub-signal 1: crop transitions (changing strategies)
  const transitionScore = Math.min(cropTransitions / ADAPTATION_TRANSITION_TARGET, 1) * 40;

  // Sub-signal 2: drought-tolerant crop adoption
  const adoptionScore = Math.min(droughtTolerantTypesAdopted.length / ADAPTATION_DROUGHT_TARGET, 1) * 30;

  // Sub-signal 3: cover crop years (count from snapshots, not the narrow
  // tracking.coverCropYearsUsed which only counts when OM < 2.0%)
  const coverCropYears = state.tracking.yearSnapshots.filter(s => s.coverCropCount > 0).length;
  const coverCropScore = Math.min(coverCropYears / ADAPTATION_COVERCROPS_TARGET, 1) * 30;

  return transitionScore + adoptionScore + coverCropScore;
}

/** Consistency (10%) — inverse of revenue coefficient of variation */
export function computeConsistencyScore(state: GameState): number {
  const revenues = state.tracking.yearSnapshots.map(s => s.revenue);
  if (revenues.length < 3) return 50; // neutral — not enough data

  const mean = revenues.reduce((a, b) => a + b, 0) / revenues.length;
  if (mean === 0) return 0;

  const variance = revenues.reduce((sum, r) => sum + (r - mean) ** 2, 0) / revenues.length;
  const cv = Math.sqrt(variance) / mean; // coefficient of variation
  return clamp((1 - cv) * 100, 0, 100);
}

// ============================================================================
// Composite Score
// ============================================================================

/** Compute the full scoring breakdown from GameState. */
export function computeScore(state: GameState): ScoreResult {
  const financialRaw = computeFinancialScore(state);
  const soilRaw = computeSoilScore(state);
  const diversityRaw = computeDiversityScore(state);
  const adaptationRaw = computeAdaptationScore(state);
  const consistencyRaw = computeConsistencyScore(state);

  const components: ScoreComponent[] = [
    {
      id: 'financial',
      label: 'Financial Stability',
      raw: Math.round(financialRaw * 10) / 10,
      weight: W_FINANCIAL,
      weighted: Math.round(financialRaw * W_FINANCIAL * 10) / 10,
      explanation: financialRaw >= 75
        ? 'Strong financial position'
        : financialRaw >= 40
          ? 'Moderate financial health'
          : financialRaw > 0
            ? 'Financial struggles'
            : 'Bankrupt',
    },
    {
      id: 'soil',
      label: 'Soil Health',
      raw: Math.round(soilRaw * 10) / 10,
      weight: W_SOIL,
      weighted: Math.round(soilRaw * W_SOIL * 10) / 10,
      explanation: soilRaw >= 60
        ? 'Good soil stewardship'
        : soilRaw >= 30
          ? 'Some soil degradation'
          : 'Severe soil degradation',
    },
    {
      id: 'diversity',
      label: 'Crop Diversity',
      raw: Math.round(diversityRaw * 10) / 10,
      weight: W_DIVERSITY,
      weighted: Math.round(diversityRaw * W_DIVERSITY * 10) / 10,
      explanation: diversityRaw >= 80
        ? 'Excellent crop variety'
        : diversityRaw >= 40
          ? 'Some crop diversity'
          : 'Very limited diversity',
    },
    {
      id: 'adaptation',
      label: 'Climate Adaptation',
      raw: Math.round(adaptationRaw * 10) / 10,
      weight: W_ADAPTATION,
      weighted: Math.round(adaptationRaw * W_ADAPTATION * 10) / 10,
      explanation: adaptationRaw >= 70
        ? 'Strong climate response'
        : adaptationRaw >= 30
          ? 'Some adaptation efforts'
          : 'Limited adaptation',
    },
    {
      id: 'consistency',
      label: 'Consistency',
      raw: Math.round(consistencyRaw * 10) / 10,
      weight: W_CONSISTENCY,
      weighted: Math.round(consistencyRaw * W_CONSISTENCY * 10) / 10,
      explanation: consistencyRaw >= 70
        ? 'Steady, reliable income'
        : consistencyRaw >= 40
          ? 'Some revenue volatility'
          : 'Highly unstable income',
    },
  ];

  const total = Math.round(
    components.reduce((sum, c) => sum + c.raw * c.weight, 0) * 10,
  ) / 10;

  const tier: ScoreResult['tier'] =
    total >= 80 ? 'Thriving'
      : total >= 60 ? 'Stable'
        : total >= 40 ? 'Struggling'
          : 'Failed';

  const yearsSurvived = state.calendar.year;
  const completionCode = encodeCompletionCode(
    state.playerId, Math.round(total), yearsSurvived, state.scenarioId,
  );

  return { total, tier, components, completionCode, yearsSurvived };
}

// ============================================================================
// Completion Code
// ============================================================================

/**
 * Human-readable completion code for screenshots / local backup.
 * NOT a security mechanism — Google Sign-In + backend submission is the
 * authoritative proof of identity. This is just a display token.
 *
 * Format: {PREFIX}-{SCORE}-Y{YEARS}-{SCENARIO}
 * Example: NEAL-78-Y30-GW
 */

function sanitizePrefix(playerId: string): string {
  const alphanumeric = playerId.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return (alphanumeric + '0000').slice(0, 4);
}

export function encodeCompletionCode(
  playerId: string,
  score: number,
  yearsSurvived: number,
  scenarioId: string,
): string {
  const prefix = sanitizePrefix(playerId);
  const clampedScore = clamp(Math.round(score), 0, 100);
  const clampedYears = clamp(yearsSurvived, 1, 30);
  const scenario = SCENARIO_ABBREV[scenarioId] ?? 'XX';

  return `${prefix}-${clampedScore}-Y${clampedYears}-${scenario}`;
}
