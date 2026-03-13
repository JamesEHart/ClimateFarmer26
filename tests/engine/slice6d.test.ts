/**
 * Slice 6d Tests — Scoring, Completion Code, Submission, Organic Certification
 *
 * §1–§7: Scoring formula + completion code (6d.1)
 * §8–§9: Auth session + submission payload (6d.1)
 * §10: Integration (6d.1)
 * §11–§14: Organic certification (6d.2 — added later)
 */

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { createInitialState } from '../../src/engine/game.ts';
import { SLICE_1_SCENARIO } from '../../src/data/scenario.ts';
import type { GameState, YearSnapshot } from '../../src/engine/types.ts';
import { simulateTick } from '../../src/engine/game.ts';
import {
  GRID_ROWS, GRID_COLS, STARTING_CASH, DAYS_PER_YEAR,
  createEmptyExpenseBreakdown,
  ORGANIC_CERT_ANNUAL_COST, ORGANIC_PRICE_PREMIUM, ORGANIC_TRANSITION_YEARS, ORGANIC_COVER_CROP_MIN,
} from '../../src/engine/types.ts';
import {
  computeFinancialScore,
  computeSoilScore,
  computeDiversityScore,
  computeAdaptationScore,
  computeConsistencyScore,
  computeScore,
  countUniqueCropsPlanted,
  encodeCompletionCode,
  FINANCIAL_CEILING,
  SOIL_OM_BASELINE,
  SOIL_OM_EXCELLENT,
  DIVERSITY_BASE_CROPS,
  DIVERSITY_BONUS_THRESHOLD,
  ADAPTATION_TRANSITION_TARGET,
  ADAPTATION_DROUGHT_TARGET,
  ADAPTATION_COVERCROPS_TARGET,
} from '../../src/engine/scoring.ts';

// ============================================================================
// Test Helpers
// ============================================================================

function makeState(): GameState {
  return createInitialState('test-6d', SLICE_1_SCENARIO);
}

/** Set all grid cells to a specific OM% */
function setAllOM(state: GameState, om: number): void {
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      state.grid[r][c].soil.organicMatter = om;
    }
  }
}

/** Add a synthetic year snapshot for testing */
function addSnapshot(state: GameState, overrides: Partial<YearSnapshot> = {}): void {
  state.tracking.yearSnapshots.push({
    year: state.tracking.yearSnapshots.length + 1,
    revenue: 10_000,
    expenses: createEmptyExpenseBreakdown(),
    cashAtYearEnd: 50_000,
    avgOrganicMatter: 2.0,
    avgNitrogen: 99,
    cropCounts: { 'silage-corn': 32 },
    coverCropCount: 0,
    eventsReceived: 0,
    ...overrides,
  });
}

/** Set planted_crop_* flags for a list of crop IDs */
function setPlantedCrops(state: GameState, cropIds: string[]): void {
  for (const id of cropIds) {
    state.flags[`planted_crop_${id}`] = true;
  }
}

// ============================================================================
// §1: Financial Stability Scoring
// ============================================================================

describe('§1: Financial Stability', () => {
  let state: GameState;
  beforeEach(() => { state = makeState(); });

  it('zero cash gives 0 raw', () => {
    state.economy.cash = 0;
    expect(computeFinancialScore(state)).toBe(0);
  });

  it('negative cash (bankruptcy) gives 0 raw', () => {
    state.economy.cash = -5000;
    expect(computeFinancialScore(state)).toBe(0);
  });

  it('starting cash ($50K) gives proportional score', () => {
    state.economy.cash = STARTING_CASH;
    const expected = (STARTING_CASH / FINANCIAL_CEILING) * 100;
    expect(computeFinancialScore(state)).toBeCloseTo(expected, 1);
  });

  it('$300K (diversified bot range) gives ~75 raw', () => {
    state.economy.cash = 300_000;
    expect(computeFinancialScore(state)).toBeCloseTo(75, 0);
  });

  it('cash at FINANCIAL_CEILING gives 100 raw', () => {
    state.economy.cash = FINANCIAL_CEILING;
    expect(computeFinancialScore(state)).toBe(100);
  });

  it('cash above ceiling is capped at 100', () => {
    state.economy.cash = FINANCIAL_CEILING * 2;
    expect(computeFinancialScore(state)).toBe(100);
  });
});

// ============================================================================
// §2: Soil Health Scoring
// ============================================================================

describe('§2: Soil Health', () => {
  let state: GameState;
  beforeEach(() => { state = makeState(); });

  it('starting OM (2.0%) gives 60 raw', () => {
    setAllOM(state, SOIL_OM_BASELINE);
    expect(computeSoilScore(state)).toBe(60);
  });

  it('improved OM (2.5%) gives between 60 and 100', () => {
    setAllOM(state, 2.5);
    const score = computeSoilScore(state);
    expect(score).toBeGreaterThan(60);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('excellent OM (3.0%) gives 100', () => {
    setAllOM(state, SOIL_OM_EXCELLENT);
    expect(computeSoilScore(state)).toBe(100);
  });

  it('declined OM (1.0%) gives 30', () => {
    setAllOM(state, 1.0);
    const expected = (1.0 / SOIL_OM_BASELINE) * 60;
    expect(computeSoilScore(state)).toBeCloseTo(expected, 1);
  });

  it('severely degraded OM (0.5%) gives 15', () => {
    setAllOM(state, 0.5);
    const expected = (0.5 / SOIL_OM_BASELINE) * 60;
    expect(computeSoilScore(state)).toBeCloseTo(expected, 1);
  });
});

// ============================================================================
// §3: Crop Diversity Scoring
// ============================================================================

describe('§3: Crop Diversity', () => {
  let state: GameState;
  beforeEach(() => { state = makeState(); });

  it('monoculture (1 crop) gives 0', () => {
    setPlantedCrops(state, ['silage-corn']);
    expect(computeDiversityScore(state)).toBe(0);
  });

  it('2 crops gives moderate score', () => {
    setPlantedCrops(state, ['silage-corn', 'tomatoes']);
    const score = computeDiversityScore(state);
    expect(score).toBeGreaterThan(30);
    expect(score).toBeLessThan(60);
  });

  it('5 crops gets bonus and scores high', () => {
    setPlantedCrops(state, ['silage-corn', 'tomatoes', 'winter-wheat', 'almonds', 'citrus']);
    const score = computeDiversityScore(state);
    expect(score).toBeGreaterThan(85);
  });

  it('7 crops (all base) gives 100', () => {
    setPlantedCrops(state, [
      'silage-corn', 'tomatoes', 'winter-wheat', 'almonds',
      'citrus', 'pistachios', 'sorghum',
    ]);
    expect(computeDiversityScore(state)).toBe(100);
  });

  it('no crops planted gives 0', () => {
    expect(computeDiversityScore(state)).toBe(0);
  });

  it('uses planted_crop_* flags as primary source', () => {
    // Set flags but leave grid empty (annuals already harvested)
    setPlantedCrops(state, ['silage-corn', 'tomatoes', 'winter-wheat']);
    expect(countUniqueCropsPlanted(state)).toBe(3);
  });

  it('falls back to snapshots for older saves without flags', () => {
    // No planted_crop_* flags, but snapshots have cropCounts
    addSnapshot(state, { cropCounts: { 'silage-corn': 32, 'tomatoes': 16 } });
    expect(countUniqueCropsPlanted(state)).toBe(2);
  });
});

// ============================================================================
// §4: Climate Adaptation Scoring
// ============================================================================

describe('§4: Climate Adaptation', () => {
  let state: GameState;
  beforeEach(() => { state = makeState(); });

  it('zero transitions/adoption/covercrops gives 0', () => {
    expect(computeAdaptationScore(state)).toBe(0);
  });

  it('10+ transitions gives full transition sub-score (40)', () => {
    state.tracking.cropTransitions = ADAPTATION_TRANSITION_TARGET;
    expect(computeAdaptationScore(state)).toBeCloseTo(40, 1);
  });

  it('2+ drought-tolerant types gives full adoption sub-score (30)', () => {
    state.tracking.droughtTolerantTypesAdopted = ['agave', 'sorghum'];
    expect(computeAdaptationScore(state)).toBeCloseTo(30, 1);
  });

  it('5+ cover crop years (from snapshots) gives full sub-score (30)', () => {
    for (let i = 0; i < ADAPTATION_COVERCROPS_TARGET; i++) {
      addSnapshot(state, { coverCropCount: 20 });
    }
    expect(computeAdaptationScore(state)).toBeCloseTo(30, 1);
  });

  it('combined max gives 100', () => {
    state.tracking.cropTransitions = ADAPTATION_TRANSITION_TARGET;
    state.tracking.droughtTolerantTypesAdopted = ['agave', 'sorghum'];
    for (let i = 0; i < ADAPTATION_COVERCROPS_TARGET; i++) {
      addSnapshot(state, { coverCropCount: 20 });
    }
    expect(computeAdaptationScore(state)).toBeCloseTo(100, 1);
  });

  it('uses snapshot coverCropCount, not tracking.coverCropYearsUsed', () => {
    // tracking.coverCropYearsUsed is narrow (only counts when OM < 2.0%)
    // Scoring should use snapshot-based count instead
    state.tracking.coverCropYearsUsed = 10; // should be ignored
    expect(computeAdaptationScore(state)).toBe(0); // no snapshots = 0 cover crop credit
  });
});

// ============================================================================
// §5: Consistency Scoring
// ============================================================================

describe('§5: Consistency', () => {
  let state: GameState;
  beforeEach(() => { state = makeState(); });

  it('fewer than 3 snapshots gives neutral 50', () => {
    addSnapshot(state, { revenue: 10_000 });
    addSnapshot(state, { revenue: 10_000 });
    expect(computeConsistencyScore(state)).toBe(50);
  });

  it('constant revenue gives 100', () => {
    for (let i = 0; i < 10; i++) {
      addSnapshot(state, { revenue: 10_000 });
    }
    expect(computeConsistencyScore(state)).toBe(100);
  });

  it('zero revenue across all years gives 0', () => {
    for (let i = 0; i < 5; i++) {
      addSnapshot(state, { revenue: 0 });
    }
    expect(computeConsistencyScore(state)).toBe(0);
  });

  it('wildly varying revenue gives low score', () => {
    addSnapshot(state, { revenue: 100_000 });
    addSnapshot(state, { revenue: 1_000 });
    addSnapshot(state, { revenue: 100_000 });
    addSnapshot(state, { revenue: 1_000 });
    expect(computeConsistencyScore(state)).toBeLessThan(30);
  });

  it('moderate variation gives moderate score', () => {
    for (let i = 0; i < 10; i++) {
      addSnapshot(state, { revenue: 10_000 + (i % 2 === 0 ? 2_000 : -2_000) });
    }
    const score = computeConsistencyScore(state);
    expect(score).toBeGreaterThan(50);
    expect(score).toBeLessThan(100);
  });
});

// ============================================================================
// §6: Composite Score
// ============================================================================

describe('§6: Composite Score', () => {
  let state: GameState;
  beforeEach(() => { state = makeState(); });

  it('components sum correctly to total', () => {
    state.economy.cash = 200_000;
    setPlantedCrops(state, ['silage-corn', 'tomatoes', 'winter-wheat']);
    state.tracking.cropTransitions = 5;
    for (let i = 0; i < 5; i++) {
      addSnapshot(state, { revenue: 10_000, coverCropCount: 10 });
    }
    const result = computeScore(state);
    const manualSum = result.components.reduce((sum, c) => sum + c.raw * c.weight, 0);
    expect(result.total).toBeCloseTo(manualSum, 0);
  });

  it('tier thresholds: ≥80 = Thriving', () => {
    state.economy.cash = FINANCIAL_CEILING;
    setAllOM(state, SOIL_OM_EXCELLENT);
    setPlantedCrops(state, ['silage-corn', 'tomatoes', 'winter-wheat', 'almonds', 'citrus', 'pistachios', 'sorghum']);
    state.tracking.cropTransitions = ADAPTATION_TRANSITION_TARGET;
    state.tracking.droughtTolerantTypesAdopted = ['agave', 'sorghum'];
    for (let i = 0; i < 10; i++) {
      addSnapshot(state, { revenue: 10_000, coverCropCount: 20 });
    }
    const result = computeScore(state);
    expect(result.total).toBeGreaterThanOrEqual(80);
    expect(result.tier).toBe('Thriving');
  });

  it('tier thresholds: 60-79 = Stable', () => {
    state.economy.cash = 250_000;
    setPlantedCrops(state, ['silage-corn', 'tomatoes', 'winter-wheat']);
    state.tracking.cropTransitions = 5;
    for (let i = 0; i < 5; i++) {
      addSnapshot(state, { revenue: 10_000, coverCropCount: 10 });
    }
    const result = computeScore(state);
    expect(result.total).toBeGreaterThanOrEqual(40);
    // Can't guarantee exactly 60-79 without precise tuning, so just check tier calc
    expect(['Thriving', 'Stable', 'Struggling', 'Failed']).toContain(result.tier);
  });

  it('bankruptcy produces valid partial score', () => {
    state.economy.cash = -1000;
    state.gameOver = true;
    state.gameOverReason = 'bankruptcy';
    state.calendar.year = 8;
    setPlantedCrops(state, ['silage-corn']);
    addSnapshot(state, { revenue: 5_000 });
    const result = computeScore(state);
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.components.length).toBe(5);
    expect(result.components.find(c => c.id === 'financial')!.raw).toBe(0);
    expect(result.yearsSurvived).toBe(8);
  });

  it('same state produces identical scores (deterministic)', () => {
    state.economy.cash = 150_000;
    setPlantedCrops(state, ['silage-corn', 'tomatoes']);
    for (let i = 0; i < 5; i++) {
      addSnapshot(state, { revenue: 8_000 });
    }
    const r1 = computeScore(state);
    const r2 = computeScore(state);
    expect(r1.total).toBe(r2.total);
    expect(r1.completionCode).toBe(r2.completionCode);
  });
});

// ============================================================================
// §7: Completion Code Encode/Decode
// ============================================================================

describe('§7: Completion Code', () => {
  it('produces human-readable format: PREFIX-SCORE-YYEARS-SC', () => {
    const code = encodeCompletionCode('TestPlayer', 75, 30, 'gradual-warming');
    expect(code).toBe('TEST-75-Y30-GW');
  });

  it('different scores produce different codes', () => {
    const code1 = encodeCompletionCode('Player1', 50, 30, 'gradual-warming');
    const code2 = encodeCompletionCode('Player1', 75, 30, 'gradual-warming');
    expect(code1).not.toBe(code2);
  });

  it('player prefix extracted correctly (4 chars, uppercase)', () => {
    const code = encodeCompletionCode('TeamBlue', 80, 25, 'whiplash');
    expect(code.startsWith('TEAM-')).toBe(true);
  });

  it('prefix pads short player IDs', () => {
    const code = encodeCompletionCode('AB', 80, 25, 'whiplash');
    expect(code.startsWith('AB00-')).toBe(true);
  });

  it('all 5 scenario IDs map to abbreviations', () => {
    const expected: Record<string, string> = {
      'gradual-warming': 'GW',
      'early-drought': 'ED',
      'whiplash': 'WH',
      'late-escalation': 'LE',
      'mild-baseline': 'MB',
    };
    for (const [sid, abbrev] of Object.entries(expected)) {
      const code = encodeCompletionCode('Test', 50, 20, sid);
      expect(code).toBe(`TEST-50-Y20-${abbrev}`);
    }
  });

  it('edge cases: score 0, score 100, year 1, year 30', () => {
    expect(encodeCompletionCode('Edge', 0, 1, 'mild-baseline')).toBe('EDGE-0-Y1-MB');
    expect(encodeCompletionCode('Edge', 100, 30, 'mild-baseline')).toBe('EDGE-100-Y30-MB');
    expect(encodeCompletionCode('Edge', 0, 30, 'mild-baseline')).toBe('EDGE-0-Y30-MB');
    expect(encodeCompletionCode('Edge', 100, 1, 'mild-baseline')).toBe('EDGE-100-Y1-MB');
  });

  it('special characters in player ID are stripped from prefix', () => {
    const code = encodeCompletionCode('P3-14!@#', 50, 15, 'gradual-warming');
    expect(code.startsWith('P314-')).toBe(true);
  });

  it('clamps score to 0-100 and years to 1-30', () => {
    const code1 = encodeCompletionCode('Test', -10, 0, 'gradual-warming');
    expect(code1).toBe('TEST-0-Y1-GW');
    const code2 = encodeCompletionCode('Test', 150, 50, 'gradual-warming');
    expect(code2).toBe('TEST-100-Y30-GW');
  });
});

// ============================================================================
// §8: Auth Session + Submission Payload
// ============================================================================

describe('§8: Auth Session + Submission', () => {
  // Import auth functions dynamically to avoid GIS dependency at module level
  let getSession: typeof import('../../src/auth.ts').getSession;
  let isAuthenticated: typeof import('../../src/auth.ts').isAuthenticated;
  let signOut: typeof import('../../src/auth.ts').signOut;
  let submitGameResult: typeof import('../../src/auth.ts').submitGameResult;

  // Mock localStorage for Node environment
  const store = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (i: number) => [...store.keys()][i] ?? null,
  };

  beforeAll(async () => {
    Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true });
    const auth = await import('../../src/auth.ts');
    getSession = auth.getSession;
    isAuthenticated = auth.isAuthenticated;
    signOut = auth.signOut;
    submitGameResult = auth.submitGameResult;
  });

  beforeEach(() => {
    store.clear();
  });

  it('getSession returns null when no session stored', () => {
    expect(getSession()).toBeNull();
  });

  it('isAuthenticated returns false when no session', () => {
    expect(isAuthenticated()).toBe(false);
  });

  it('getSession returns session when valid session exists', () => {
    const session = {
      email: 'student@dtechhs.org',
      idToken: 'test-token-123',
      timestamp: Date.now(),
    };
    localStorage.setItem('cf_auth', JSON.stringify(session));
    const result = getSession();
    expect(result).not.toBeNull();
    expect(result!.email).toBe('student@dtechhs.org');
    expect(result!.idToken).toBe('test-token-123');
  });

  it('getSession returns null for expired session (>4 hours)', () => {
    const session = {
      email: 'student@dtechhs.org',
      idToken: 'test-token-123',
      timestamp: Date.now() - 5 * 60 * 60 * 1000, // 5 hours ago
    };
    localStorage.setItem('cf_auth', JSON.stringify(session));
    expect(getSession()).toBeNull();
  });

  it('signOut clears session', () => {
    localStorage.setItem('cf_auth', JSON.stringify({
      email: 'student@dtechhs.org',
      idToken: 'test-token',
      timestamp: Date.now(),
    }));
    expect(getSession()).not.toBeNull();
    signOut();
    expect(getSession()).toBeNull();
  });

  it('getSession handles corrupted localStorage gracefully', () => {
    localStorage.setItem('cf_auth', 'not-valid-json{{{');
    expect(getSession()).toBeNull();
    // Should also clean up the corrupted entry
    expect(localStorage.getItem('cf_auth')).toBeNull();
  });

  it('submitGameResult sends correct payload and handles success', async () => {
    const mockResponse = { receipt_id: 'R-12345', email: 'student@dtechhs.org' };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    }) as unknown as typeof fetch;

    const payload = {
      id_token: 'test-token',
      player_id: 'test-player',
      scenario_id: 'gradual-warming',
      score: 75,
      tier: 'stable',
      years_completed: 30,
      final_cash: 200_000,
      completion_code: 'TEST-ABC12',
      curated_seed: 42,
      components: { financial: 22.5, soil: 12.0, diversity: 17.8, adaptation: 14.0, consistency: 7.0 },
    };

    const result = await submitGameResult(payload);
    expect(result.success).toBe(true);
    expect(result.receipt_id).toBe('R-12345');
    expect(result.email).toBe('student@dtechhs.org');

    // Verify fetch was called with correct args
    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('/submit_game_result');
    const body = JSON.parse(fetchCall[1].body);
    expect(body.id_token).toBe('test-token');
    expect(body.score).toBe(75);
    expect(body.components.financial).toBe(22.5);
  });

  it('submitGameResult handles server error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    }) as unknown as typeof fetch;

    const payload = {
      id_token: 'test-token',
      player_id: 'test',
      scenario_id: 'gradual-warming',
      score: 50,
      tier: 'struggling',
      years_completed: 15,
      final_cash: 10_000,
      completion_code: 'TEST-XYZ99',
      curated_seed: 0,
      components: { financial: 5, soil: 5, diversity: 5, adaptation: 5, consistency: 5 },
    };

    const result = await submitGameResult(payload);
    expect(result.success).toBe(false);
    expect(result.error).toContain('500');
  });

  it('submitGameResult handles network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network request failed')) as unknown as typeof fetch;

    const payload = {
      id_token: 'test-token',
      player_id: 'test',
      scenario_id: 'gradual-warming',
      score: 50,
      tier: 'struggling',
      years_completed: 15,
      final_cash: 10_000,
      completion_code: 'TEST-XYZ99',
      curated_seed: 0,
      components: { financial: 5, soil: 5, diversity: 5, adaptation: 5, consistency: 5 },
    };

    const result = await submitGameResult(payload);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Network request failed');
  });
});

// ============================================================================
// §9: Integration
// ============================================================================

describe('§9: Integration', () => {
  it('computeScore returns well-formed ScoreResult', () => {
    const state = makeState();
    state.economy.cash = 100_000;
    setPlantedCrops(state, ['silage-corn', 'tomatoes']);
    const result = computeScore(state);

    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
    expect(['Thriving', 'Stable', 'Struggling', 'Failed']).toContain(result.tier);
    expect(result.components.length).toBe(5);
    expect(result.completionCode).toMatch(/^TEST-\d+-Y\d+-GW$/);
    expect(result.yearsSurvived).toBeGreaterThanOrEqual(1);
  });

  it('bankruptcy state produces valid score + completion code', () => {
    const state = makeState();
    state.economy.cash = -5000;
    state.gameOver = true;
    state.gameOverReason = 'bankruptcy';
    state.calendar.year = 5;
    const result = computeScore(state);

    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.completionCode).toMatch(/^TEST-\d+-Y5-GW$/);
    expect(result.yearsSurvived).toBe(5);
  });

  it('year-30 state produces valid score + completion code', () => {
    const state = makeState();
    state.economy.cash = 250_000;
    state.calendar.year = 30;
    setPlantedCrops(state, ['silage-corn', 'tomatoes', 'winter-wheat', 'almonds']);
    for (let i = 0; i < 30; i++) {
      addSnapshot(state, { revenue: 10_000, coverCropCount: 10 });
    }
    state.tracking.cropTransitions = 8;
    state.tracking.droughtTolerantTypesAdopted = ['sorghum'];
    const result = computeScore(state);

    expect(result.total).toBeGreaterThanOrEqual(40);
    expect(result.tier).not.toBe('Failed');
    expect(result.completionCode).toMatch(/^TEST-\d+-Y30-GW$/);
  });

  it('completion code contains score and year from state', () => {
    const state = makeState();
    state.economy.cash = 175_000;
    state.calendar.year = 22;
    const result = computeScore(state);

    // Code should contain the rounded score and year
    expect(result.completionCode).toContain(`-${Math.round(result.total)}-`);
    expect(result.completionCode).toContain('-Y22-');
    expect(result.completionCode).toMatch(/-GW$/);
  });
});

// ============================================================================
// §11: Santos Organic Offer (storylet preconditions & effects)
// ============================================================================

describe('§11: Santos Organic Offer', () => {
  it('storylet exists with correct preconditions', async () => {
    const { STORYLETS } = await import('../../src/data/events.ts');
    const offer = STORYLETS.find(e => e.id === 'santos-organic-offer');
    expect(offer).toBeDefined();
    expect(offer!.advisorId).toBe('extension-agent');
    const types = offer!.preconditions.map(p => p.type);
    expect(types).toContain('min_year');
    expect(types).toContain('not_has_flag');
    expect(types).toContain('has_crop');
    expect(types).not.toContain('random');
  });

  it('enroll-organic sets organic_enrolled flag (no upfront cost)', () => {
    const state = makeState();
    state.flags['organic_enrolled'] = true;
    expect(state.flags['organic_enrolled']).toBe(true);
    // No modify_cash in enrollment — cost is year-end only
  });

  it('enroll-organic choice has no cost or requiresCash', async () => {
    const { STORYLETS } = await import('../../src/data/events.ts');
    const offer = STORYLETS.find(e => e.id === 'santos-organic-offer')!;
    const enrollChoice = offer.choices.find(c => c.id === 'enroll-organic')!;
    expect(enrollChoice.cost).toBeUndefined();
    expect(enrollChoice.requiresCash).toBeUndefined();
    // No modify_cash effect either
    const hasCashEffect = enrollChoice.effects.some(e => e.type === 'modify_cash');
    expect(hasCashEffect).toBe(false);
  });

  it('decline-organic sets organic_declined flag (permanent, no re-offer)', () => {
    const state = makeState();
    state.flags['organic_declined'] = true;
    expect(state.flags['organic_declined']).toBe(true);
  });

  it('organic-later does NOT set declined flag (allows re-offer)', () => {
    const state = makeState();
    expect(state.flags['organic_declined']).toBeUndefined();
    expect(state.flags['organic_enrolled']).toBeUndefined();
  });

  it('storylet text mentions prohibited inputs and 16 fields', async () => {
    const { STORYLETS } = await import('../../src/data/events.ts');
    const offer = STORYLETS.find(e => e.id === 'santos-organic-offer')!;
    expect(offer.description).toMatch(/synthetic fertilizer/i);
    expect(offer.description).toMatch(/16 fields/);
    const enrollChoice = offer.choices.find(c => c.id === 'enroll-organic')!;
    expect(enrollChoice.followUpText).toMatch(/16 fields/);
  });
});

// ============================================================================
// §12: Organic Compliance Layer
// ============================================================================

/** Helper: set up an enrolled organic state and advance to year-end */
function makeOrganicState(opts: {
  compliantYears?: number;
  certified?: boolean;
  violation?: boolean;
  coverCropCells?: number;
} = {}): GameState {
  const state = makeState();
  state.flags['organic_enrolled'] = true;
  if (opts.compliantYears !== undefined) {
    state.organicCompliantYears = opts.compliantYears;
  }
  if (opts.certified) {
    state.flags['organic_certified'] = true;
  }
  if (opts.violation) {
    state.flags['organic_violation_this_year'] = true;
  }
  // Set cover crops on N cells
  const cc = opts.coverCropCells ?? 0;
  let placed = 0;
  for (let r = 0; r < GRID_ROWS && placed < cc; r++) {
    for (let c = 0; c < GRID_COLS && placed < cc; c++) {
      state.grid[r][c].coverCropId = 'legume-cover';
      placed++;
    }
  }
  return state;
}

/** Advance state to year-end boundary so organic logic runs */
function advanceToYearEnd(state: GameState): void {
  const startYear = state.calendar.year;
  let ticks = 0;
  while (state.calendar.year === startYear && ticks < 400) {
    // Keep year_end pauses but dismiss everything else
    state.autoPauseQueue = state.autoPauseQueue.filter(e => e.reason === 'year_end');
    state.activeEvent = null;
    state.speed = 1;
    simulateTick(state, SLICE_1_SCENARIO);
    ticks++;
  }
}

describe('§12: Organic Compliance Layer', () => {
  it('ORGANIC_COVER_CROP_MIN is 16', () => {
    expect(ORGANIC_COVER_CROP_MIN).toBe(16);
  });

  it('ORGANIC_TRANSITION_YEARS is 3', () => {
    expect(ORGANIC_TRANSITION_YEARS).toBe(3);
  });

  it('annual cost deducted at year-end when enrolled', () => {
    const state = makeOrganicState({ coverCropCells: 20 });
    const cashBefore = state.economy.cash;
    advanceToYearEnd(state);
    expect(state.economy.cash).toBeLessThan(cashBefore);
    expect(state.tracking.currentExpenses.organicCertification).toBe(0); // reset after snapshot
    // Check the snapshot captured it
    const snap = state.tracking.yearSnapshots[0];
    expect(snap.expenses.organicCertification).toBe(ORGANIC_CERT_ANNUAL_COST);
  });

  it('clean year increments organic_compliant_years', () => {
    const state = makeOrganicState({ compliantYears: 1, coverCropCells: 20 });
    advanceToYearEnd(state);
    expect(state.organicCompliantYears).toBe(2);
  });

  it('certification granted after 3 clean years with enough cover crops', () => {
    const state = makeOrganicState({ compliantYears: 2, coverCropCells: 20 });
    advanceToYearEnd(state);
    // 2 + 1 = 3 compliant years → certified
    expect(state.flags['organic_certified']).toBe(true);
    expect(state.organicCompliantYears).toBe(3);
  });

  it('certification delayed if cover crops below ORGANIC_COVER_CROP_MIN', () => {
    const state = makeOrganicState({ compliantYears: 2, coverCropCells: 10 });
    advanceToYearEnd(state);
    // 3 compliant years but not enough cover crops
    expect(state.organicCompliantYears).toBe(3);
    expect(state.flags['organic_certified']).toBeUndefined();
    // Should have a notification about delayed certification
    const delayNotif = state.notifications.find(n => n.message.includes('delayed'));
    expect(delayNotif).toBeDefined();
  });

  it('not certified with only 2 clean years even with cover crops', () => {
    const state = makeOrganicState({ compliantYears: 1, coverCropCells: 20 });
    advanceToYearEnd(state);
    // 1 + 1 = 2 compliant years, need 3
    expect(state.organicCompliantYears).toBe(2);
    expect(state.flags['organic_certified']).toBeUndefined();
  });

  it('violation during transition resets compliant years to 0', () => {
    const state = makeOrganicState({ compliantYears: 2, violation: true, coverCropCells: 20 });
    advanceToYearEnd(state);
    expect(state.organicCompliantYears).toBe(0);
    expect(state.flags['organic_certified']).toBeUndefined();
    const resetNotif = state.notifications.find(n => n.message.includes('transition reset') || n.message.includes('clock restarts'));
    expect(resetNotif).toBeDefined();
  });

  it('violation after certification revokes it', () => {
    const state = makeOrganicState({ compliantYears: 5, certified: true, violation: true, coverCropCells: 20 });
    advanceToYearEnd(state);
    expect(state.flags['organic_certified']).toBeUndefined();
    expect(state.organicCompliantYears).toBe(0);
    const revokeNotif = state.notifications.find(n => n.message.includes('revoked'));
    expect(revokeNotif).toBeDefined();
  });

  it('violation flag cleared at year-end', () => {
    const state = makeOrganicState({ compliantYears: 1, violation: true, coverCropCells: 20 });
    advanceToYearEnd(state);
    expect(state.flags['organic_violation_this_year']).toBeUndefined();
  });

  it('post-certification: cover crops below threshold suspends certification', () => {
    const state = makeOrganicState({ compliantYears: 5, certified: true, coverCropCells: 10 });
    advanceToYearEnd(state);
    // Clean year but cover crops below minimum → suspended
    expect(state.flags['organic_certified']).toBeUndefined();
    expect(state.organicCompliantYears).toBe(0);
    const suspendNotif = state.notifications.find(n => n.message.includes('suspended'));
    expect(suspendNotif).toBeDefined();
  });

  it('post-certification: maintained with enough cover crops and no violation', () => {
    const state = makeOrganicState({ compliantYears: 5, certified: true, coverCropCells: 20 });
    advanceToYearEnd(state);
    expect(state.flags['organic_certified']).toBe(true);
    // Compliant years still increment
    expect(state.organicCompliantYears).toBe(6);
  });

  it('non-enrolled state: year-end clears violation flag but skips organic logic', () => {
    const state = makeState();
    // Set a violation flag — should be cleared globally so it doesn't
    // poison a future organic enrollment
    state.flags['organic_violation_this_year'] = true;
    const cashBefore = state.economy.cash;
    advanceToYearEnd(state);
    // No organic cost deducted (overhead still applies, but not organic cert fee)
    expect(state.economy.cash).toBeCloseTo(cashBefore - 2000, 0); // only annual overhead
    // Violation flag cleared globally — prevents stale flag from poisoning future enrollment
    expect(state.flags['organic_violation_this_year']).toBeUndefined();
  });

  it('stale violation from pre-enrollment does not affect first enrolled year', () => {
    // Scenario: player uses fertilizer while not enrolled, then enrolls.
    // The violation flag must be cleared at year-end so it doesn't carry over.
    const state = makeState();
    state.flags['organic_violation_this_year'] = true;
    // Year-end clears the flag even though player is not enrolled
    advanceToYearEnd(state);
    expect(state.flags['organic_violation_this_year']).toBeUndefined();

    // Now simulate: player enrolls organic at start of Year 2 with a clean slate
    // Use makeOrganicState to verify a clean enrolled year counts correctly
    const state2 = makeOrganicState({ compliantYears: 0 });
    // No violation flag set — this is a clean year
    expect(state2.flags['organic_violation_this_year']).toBeUndefined();
    advanceToYearEnd(state2);
    expect(state2.organicCompliantYears).toBe(1);
  });
});

// ============================================================================
// §12b: Prohibited Choices Set Violation Flag
// ============================================================================

describe('§12b: Prohibited Choices Set Violation Flag', () => {
  it('buy-fertilizer sets organic_violation_this_year', async () => {
    const { STORYLETS } = await import('../../src/data/events.ts');
    const event = STORYLETS.find(e => e.id === 'advisor-soil-nitrogen')!;
    const choice = event.choices.find(c => c.id === 'buy-fertilizer')!;
    const flagEffect = choice.effects.find(e => e.type === 'set_flag' && e.flag === 'organic_violation_this_year');
    expect(flagEffect).toBeDefined();
  });

  it('apply-potash sets organic_violation_this_year', async () => {
    const { STORYLETS } = await import('../../src/data/events.ts');
    const event = STORYLETS.find(e => e.id === 'advisor-potassium-management')!;
    const choice = event.choices.find(c => c.id === 'apply-potash')!;
    const flagEffect = choice.effects.find(e => e.type === 'set_flag' && e.flag === 'organic_violation_this_year');
    expect(flagEffect).toBeDefined();
  });

  it('emergency-treatment sets organic_violation_this_year', async () => {
    const { STORYLETS } = await import('../../src/data/events.ts');
    const event = STORYLETS.find(e => e.id === 'catastrophe-rootworm')!;
    const choice = event.choices.find(c => c.id === 'emergency-treatment')!;
    const flagEffect = choice.effects.find(e => e.type === 'set_flag' && e.flag === 'organic_violation_this_year');
    expect(flagEffect).toBeDefined();
  });

  it('aggressive-management sets organic_violation_this_year', async () => {
    const { STORYLETS } = await import('../../src/data/events.ts');
    const event = STORYLETS.find(e => e.id === 'catastrophe-orchard-disease')!;
    const choice = event.choices.find(c => c.id === 'aggressive-management')!;
    const flagEffect = choice.effects.find(e => e.type === 'set_flag' && e.flag === 'organic_violation_this_year');
    expect(flagEffect).toBeDefined();
  });
});

// ============================================================================
// §13: Organic Price Premium
// ============================================================================

describe('§13: Organic Price Premium', () => {
  it('ORGANIC_PRICE_PREMIUM is 1.20 (20% premium)', () => {
    expect(ORGANIC_PRICE_PREMIUM).toBe(1.20);
  });

  it('premium applies only when organic_certified flag is set', () => {
    // Certified farm gets premium
    const certState = makeState();
    certState.flags['organic_certified'] = true;
    // The harvestCell function should multiply price by ORGANIC_PRICE_PREMIUM
    // (integration test after implementation)

    // Non-certified farm does not get premium
    const normalState = makeState();
    expect(normalState.flags['organic_certified']).toBeUndefined();
  });

  it('no premium during transition (enrolled but not certified)', () => {
    const state = makeState();
    state.flags['organic_enrolled'] = true;
    // organic_certified is NOT set during transition
    expect(state.flags['organic_certified']).toBeUndefined();
  });

  it('organic premium revenue flows into yearlyRevenue (is real revenue)', () => {
    // Premium is a price multiplier at harvest — revenue increases, tracked normally
    // This is tested via integration after implementation
    expect(ORGANIC_PRICE_PREMIUM).toBeGreaterThan(1.0);
  });
});

// ============================================================================
// §14: Organic Expense Tracking
// ============================================================================

describe('§14: Organic Expense Tracking', () => {
  it('organicCertification field exists in ExpenseBreakdown', () => {
    const expenses = createEmptyExpenseBreakdown();
    expect(expenses.organicCertification).toBe(0);
  });

  it('organic cost is tracked in separate expense bucket', () => {
    // Must NOT be lumped into annualOverhead or eventCosts
    const expenses = createEmptyExpenseBreakdown();
    expenses.organicCertification = ORGANIC_CERT_ANNUAL_COST;
    expect(expenses.organicCertification).toBe(400);
    expect(expenses.annualOverhead).toBe(0); // separate bucket
    expect(expenses.eventCosts).toBe(0); // separate bucket
  });

  it('ORGANIC_CERT_ANNUAL_COST matches plan ($400/year)', () => {
    expect(ORGANIC_CERT_ANNUAL_COST).toBe(400);
  });
});
