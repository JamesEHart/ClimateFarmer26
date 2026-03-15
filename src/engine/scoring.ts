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
import { STORYLETS } from '../data/events.ts';
import { CROPS } from '../data/crops.ts';

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

// ============================================================================
// Epilogue & Endgame Functions (Slice 6e)
// ============================================================================

export interface EpilogueData {
  headline: string;
  narrative: string;
  bridge: string;
}

export interface CategoryHint {
  categoryId: string;
  label: string;
  text: string;
}

export interface AdvisorFarewell {
  advisorId: string;
  name: string;
  message: string;
  alignment: 'aligned' | 'contrasting';
}

// --- Epilogue ---

const TIER_HEADLINES: Record<ScoreResult['tier'], string> = {
  Thriving: 'A Farm That Thrived',
  Stable: 'A Farm That Endured',
  Struggling: 'A Farm Under Strain',
  Failed: 'A Hard Lesson',
};

const SCENARIO_FLAVOR: Record<string, string> = {
  'gradual-warming': 'temperatures climbed year after year, and every season demanded a little more',
  'early-drought': 'drought struck early and stayed long, testing every decision from the start',
  'whiplash': 'the weather whipped between extremes — floods one year, drought the next',
  'late-escalation': 'the first years felt gentle, but the climate shifted hard when it mattered most',
  'mild-baseline': 'conditions were relatively forgiving, leaving room for the choices that shaped your farm',
};

const TIER_NARRATIVES: Record<ScoreResult['tier'], (years: number, scenarioFlavor: string) => string> = {
  Thriving: (years, flavor) =>
    `Over ${years} years, ${flavor}. But your farm adapted, diversified, and grew stronger. The land is healthier now than when you started.`,
  Stable: (years, flavor) =>
    `Over ${years} years, ${flavor}. Your farm bent but didn't break. There were hard seasons, but you found a way through each one.`,
  Struggling: (years, flavor) =>
    `Over ${years} years, ${flavor}. It wasn't easy, and your farm felt the strain. Some years were better than others, but the pressure never fully let up.`,
  Failed: (years, flavor) =>
    `Over ${years} years, ${flavor}. Farming is hard, and the climate made it harder. Not every farm survives — but every attempt teaches something.`,
};

const TIER_BRIDGES: Record<ScoreResult['tier'], string> = {
  Thriving: 'Your score reflects a farm built to last — resilient, productive, and adapted to a changing climate.',
  Stable: 'Your score reflects a farm that weathered real challenges. There\'s room to grow, but the foundation is solid.',
  Struggling: 'Your score reflects the difficulty of farming through climate change. Small changes in strategy can make a big difference.',
  Failed: 'Your score reflects how unforgiving farming can be when conditions shift. The question isn\'t whether you failed — it\'s what you\'d try next time.',
};

export function generateEpilogue(score: ScoreResult, state: GameState): EpilogueData {
  const tier = score.tier;
  const years = score.yearsSurvived;
  const scenarioFlavor = SCENARIO_FLAVOR[state.scenarioId] ?? 'the climate brought challenges that tested every decision';

  let narrative = TIER_NARRATIVES[tier](years, scenarioFlavor);

  // Bankruptcy override — reflective, not punitive
  if (state.gameOverReason === 'bankruptcy') {
    narrative = `Your farm ran for ${years} years before the money ran out. ${scenarioFlavor.charAt(0).toUpperCase() + scenarioFlavor.slice(1)}. Not every farm makes it — but understanding why is the first step toward a different outcome.`;
  }

  return {
    headline: TIER_HEADLINES[tier],
    narrative,
    bridge: TIER_BRIDGES[tier],
  };
}

// --- Per-Category Hints ---

const HINT_TEMPLATES: Record<string, (state: GameState) => string> = {
  financial: (state) => {
    const cash = state.economy.cash;
    if (cash <= 0) {
      return 'Your farm went bankrupt. Balancing expenses with revenue is critical — consider lower-cost crops or reducing irrigation costs with drought-tolerant varieties.';
    }
    return 'Revenue didn\'t keep pace with expenses. Diversifying income sources and managing costs — especially irrigation and seed — can stabilize a farm\'s finances.';
  },
  soil: (state) => {
    let totalOM = 0;
    let cellCount = 0;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        totalOM += state.grid[r][c].soil.organicMatter;
        cellCount++;
      }
    }
    const avgOM = cellCount > 0 ? (totalOM / cellCount).toFixed(1) : '0.0';
    return `Your soil organic matter averaged ${avgOM}% — healthy soil starts at 2.0%. Cover crops and crop rotation help rebuild what intensive farming takes away.`;
  },
  diversity: () =>
    'Your farm relied on too few crops. When conditions change — drought, pests, market shifts — a diverse farm has fallback options that a monoculture doesn\'t.',
  adaptation: () =>
    'Your farm didn\'t adapt enough to changing conditions. Adopting drought-tolerant crops, cover crops, and new technologies helps a farm stay ahead of climate shifts.',
  consistency: () =>
    'Your income swung widely from year to year. Perennial crops, cover crops, and diversified planting can smooth out the boom-and-bust cycle.',
};

export function generateCategoryHints(score: ScoreResult, state: GameState): CategoryHint[] {
  const weak = score.components
    .filter(c => c.raw < 60)
    .sort((a, b) => a.raw - b.raw);

  return weak.slice(0, 2).map(c => ({
    categoryId: c.id,
    label: c.label,
    text: HINT_TEMPLATES[c.id](state),
  }));
}

// --- Advisor Farewells ---

const ADVISOR_SCORE_MAP: Record<string, ScoreComponent['id']> = {
  'extension-agent': 'soil',
  'farm-credit': 'financial',
  'weather-service': 'adaptation',
  'growers-forum': 'consistency',
};

const ADVISOR_NAMES: Record<string, string> = {
  'extension-agent': 'Santos',
  'farm-credit': 'Chen',
  'weather-service': 'NWS',
  'growers-forum': 'Growers Forum',
};

type TierGroup = 'success' | 'failure';

function tierGroup(tier: ScoreResult['tier']): TierGroup {
  return tier === 'Thriving' || tier === 'Stable' ? 'success' : 'failure';
}

const FAREWELL_MESSAGES: Record<string, Record<'aligned' | 'contrasting', Record<TierGroup, string>>> = {
  'extension-agent': {
    aligned: {
      success: 'You built something that will last. The soil on your farm is healthier than when you started — that\'s rare.',
      failure: 'You tried to do right by the land. That matters, even when the numbers didn\'t work out.',
    },
    contrasting: {
      success: 'I wish you\'d paid more attention to the soil. The results are good, but the land under your feet tells a different story.',
      failure: 'I wish you\'d listened more about rotation and soil health. The land remembers how it\'s treated.',
    },
  },
  'farm-credit': {
    aligned: {
      success: 'Smart financial management. You kept the books balanced while everyone else was scrambling.',
      failure: 'You made sound financial decisions when you could. Sometimes the market and the weather just won\'t cooperate.',
    },
    contrasting: {
      success: 'You left some money on the table, but I can\'t argue with the results. Your farm is worth more than its balance sheet.',
      failure: 'The finances were always a struggle. A tighter focus on costs and revenue planning might have made the difference.',
    },
  },
  'weather-service': {
    aligned: {
      success: 'You listened when the forecasts warned of change, and you adapted. That\'s exactly what resilient farming looks like.',
      failure: 'You tried to stay ahead of the weather. Climate change doesn\'t make it easy — even good preparation can\'t stop every storm.',
    },
    contrasting: {
      success: 'You didn\'t always follow the climate advisories, but you found your own way through. Lucky, maybe — or just stubborn enough.',
      failure: 'The climate warnings were there. Adapting sooner — drought-tolerant crops, water-saving tech — might have changed the outcome.',
    },
  },
  'growers-forum': {
    aligned: {
      success: 'Steady and reliable — that\'s what the other growers respect. Your farm didn\'t chase trends, and it paid off.',
      failure: 'You aimed for consistency, and that\'s not nothing. Farming is a marathon, and not every runner finishes.',
    },
    contrasting: {
      success: 'Your income was a rollercoaster, but you ended up in a good place. Not everyone can farm that way and survive.',
      failure: 'The wild swings in your income year-to-year made everything harder. A steadier approach — perennials, rotation — can take the edge off.',
    },
  },
};

export function generateAdvisorFarewells(score: ScoreResult, state: GameState): AdvisorFarewell[] {
  // Build storyletId → advisorId lookup
  const storyletAdvisor = new Map<string, string>();
  for (const s of STORYLETS) {
    if (s.advisorId) storyletAdvisor.set(s.id, s.advisorId);
  }

  // Count interactions per advisor
  const interactionCounts = new Map<string, number>();
  for (const entry of state.eventLog) {
    const advisorId = storyletAdvisor.get(entry.storyletId);
    if (advisorId) {
      interactionCounts.set(advisorId, (interactionCounts.get(advisorId) ?? 0) + 1);
    }
  }

  // Total interactions — skip section if < 2
  const totalInteractions = Array.from(interactionCounts.values()).reduce((a, b) => a + b, 0);
  if (totalInteractions < 2) return [];

  // Include all advisors the player actually met (>= 1 interaction)
  const metAdvisors = Array.from(interactionCounts.keys());

  if (metAdvisors.length === 0) return [];

  // Compute alignment scores from score components
  const componentMap = new Map(score.components.map(c => [c.id, c.raw]));
  const advisorScores = metAdvisors.map(advisorId => ({
    advisorId,
    alignmentScore: componentMap.get(ADVISOR_SCORE_MAP[advisorId]) ?? 50,
  }));

  advisorScores.sort((a, b) => b.alignmentScore - a.alignmentScore);

  const tg = tierGroup(score.tier);
  const result: AdvisorFarewell[] = [];

  // Most aligned (highest score)
  const aligned = advisorScores[0];
  result.push({
    advisorId: aligned.advisorId,
    name: ADVISOR_NAMES[aligned.advisorId] ?? aligned.advisorId,
    message: FAREWELL_MESSAGES[aligned.advisorId]?.aligned?.[tg] ?? '',
    alignment: 'aligned',
  });

  // Most contrasting (lowest score) — only if gap >= 20
  if (advisorScores.length >= 2) {
    const contrasting = advisorScores[advisorScores.length - 1];
    if (aligned.alignmentScore - contrasting.alignmentScore >= 20) {
      result.push({
        advisorId: contrasting.advisorId,
        name: ADVISOR_NAMES[contrasting.advisorId] ?? contrasting.advisorId,
        message: FAREWELL_MESSAGES[contrasting.advisorId]?.contrasting?.[tg] ?? '',
        alignment: 'contrasting',
      });
    }
  }

  return result;
}

// --- Human Food Servings Estimate ---

export function estimateHumanFoodServings(state: GameState): number {
  let total = 0;
  const snapshots = state.tracking.yearSnapshots;

  // Track which crops appear in snapshots (year-end grid presence)
  const cropSeenInSnapshots = new Set<string>();

  for (const snapshot of snapshots) {
    for (const [cropId, cellCount] of Object.entries(snapshot.cropCounts)) {
      const crop = CROPS[cropId];
      if (!crop || !crop.humanServingsPerUnit) continue;
      cropSeenInSnapshots.add(cropId);
      total += cellCount * crop.yieldPotential * crop.humanServingsPerUnit;
    }
  }

  // Annuals harvested before year-end won't appear in snapshots.
  // Use planted_crop_* flags to detect them, then add a conservative estimate:
  // assume 8 cells/year (one row) × years survived. Deliberately conservative.
  const yearsPlayed = snapshots.length || 1;
  const CONSERVATIVE_CELLS_PER_YEAR = 8;
  for (const [flag, value] of Object.entries(state.flags)) {
    if (!flag.startsWith('planted_crop_') || !value) continue;
    const cropId = flag.slice('planted_crop_'.length);
    if (cropSeenInSnapshots.has(cropId)) continue; // already counted from snapshots
    const crop = CROPS[cropId];
    if (!crop || !crop.humanServingsPerUnit || crop.type !== 'annual') continue;
    total += CONSERVATIVE_CELLS_PER_YEAR * yearsPlayed * crop.yieldPotential * crop.humanServingsPerUnit;
  }

  return Math.round(total);
}
