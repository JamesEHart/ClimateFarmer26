/**
 * Balance Smoke Tests — 5 bots × 5 scenarios × 3 seeds = 75 runs.
 *
 * CI-safe tier. Each test case batches 3 seeds for one strategy×scenario pair.
 * Tests are expected to FAIL with the current (untuned) economy — that's the
 * baseline signal for Sub-Slice 4c tuning.
 *
 * Run: npm run test:balance
 */

import { describe, it, expect } from 'vitest';
import { runBot, aggregateRuns, printSummaryTable, type RunResult, type AggregateMetrics } from './bot-runner.ts';
import { createAlmondMonoculture } from './bots/almond-monoculture.ts';
import { createCornMonoculture } from './bots/corn-monoculture.ts';
import { createZeroIrrigation } from './bots/zero-irrigation.ts';
import { createDiversifiedAdaptive } from './bots/diversified-adaptive.ts';
import { createCitrusStability } from './bots/citrus-stability.ts';
import { createIdleFarm } from './bots/idle-farm.ts';
import { SCENARIOS, SCENARIO_IDS } from '../../../src/data/scenarios.ts';

// ============================================================================
// Test Configuration
// ============================================================================

const SMOKE_SEEDS = [42, 137, 501];

interface BotFactory {
  name: string;
  create: () => ReturnType<typeof createAlmondMonoculture>;
}

const BOTS: BotFactory[] = [
  { name: 'almond-monoculture', create: createAlmondMonoculture },
  { name: 'corn-monoculture', create: createCornMonoculture },
  { name: 'zero-irrigation', create: createZeroIrrigation },
  { name: 'diversified-adaptive', create: createDiversifiedAdaptive },
  { name: 'citrus-stability', create: createCitrusStability },
];

// ============================================================================
// Run Full Matrix + Collect Metrics
// ============================================================================

const allResults: RunResult[] = [];
const allMetrics: AggregateMetrics[] = [];

// Pre-compute all results before running assertions
for (const botFactory of BOTS) {
  for (const scenarioId of SCENARIO_IDS) {
    const scenario = SCENARIOS[scenarioId];
    const results: RunResult[] = [];
    for (const seed of SMOKE_SEEDS) {
      const bot = botFactory.create();
      results.push(runBot(bot, scenario, seed));
    }
    allResults.push(...results);
    allMetrics.push(aggregateRuns(results));
  }
}

// Print summary table after all runs
printSummaryTable(allMetrics);

// ============================================================================
// Helper to look up metrics
// ============================================================================

function getMetrics(botName: string, scenarioId: string): AggregateMetrics {
  return allMetrics.find(m => m.botName === botName && m.scenarioId === scenarioId)!;
}

function getAllForBot(botName: string): AggregateMetrics[] {
  return allMetrics.filter(m => m.botName === botName);
}

function overallSurvivalRate(botName: string): number {
  const botResults = allResults.filter(r => r.botName === botName);
  return botResults.filter(r => r.survived).length / botResults.length;
}

function overallMedianCash(botName: string): number {
  const botCash = allResults.filter(r => r.botName === botName).map(r => r.finalCash).sort((a, b) => a - b);
  if (botCash.length === 0) return 0;
  const mid = Math.floor(botCash.length / 2);
  return botCash.length % 2 === 0 ? (botCash[mid - 1] + botCash[mid]) / 2 : botCash[mid];
}

// ============================================================================
// Assertions — Balance Quality Checks (5d revision)
//
// Philosophy: Bots are diagnostic instruments. Thresholds are regression checks
// derived from observed behavior (seeds [42, 137, 501]), not sacred design targets.
// Qualitative ordering constraints are the hard gates.
//
// See KNOWN_ISSUES.md for SPEC §30 revision notes.
// ============================================================================

describe('Balance Smoke (75 runs)', () => {
  // All bots should complete without crashing
  describe('No Crashes', () => {
    for (const botFactory of BOTS) {
      for (const scenarioId of SCENARIO_IDS) {
        it(`${botFactory.name} × ${scenarioId} completes without crash`, () => {
          const results = allResults.filter(
            r => r.botName === botFactory.name && r.scenarioId === scenarioId,
          );
          expect(results.length).toBe(SMOKE_SEEDS.length);
          for (const r of results) {
            expect(r.yearsCompleted).toBeGreaterThanOrEqual(1);
          }
        });
      }
    }
  });

  // --- Absolute Anchors (floor checks to prevent "all strategies are miserable") ---

  describe('Absolute Anchors', () => {
    it('diversified-adaptive survives ≥80% overall', () => {
      expect(overallSurvivalRate('diversified-adaptive')).toBeGreaterThanOrEqual(0.80);
    });

    it('diversified-adaptive survives 100% of mild-baseline runs', () => {
      const mildResults = allResults.filter(
        r => r.botName === 'diversified-adaptive' && r.scenarioId === 'mild-baseline',
      );
      expect(mildResults.length).toBeGreaterThan(0);
      expect(mildResults.every(r => r.survived)).toBe(true);
    });

    it('at least one non-diversified family has >0% survival', () => {
      const nonDiv = BOTS.filter(b => b.name !== 'diversified-adaptive');
      const anyViable = nonDiv.some(b => overallSurvivalRate(b.name) > 0);
      expect(anyViable).toBe(true);
    });

    it('≥3 strategy families survive ≥60% of runs (multiple viable paths)', () => {
      let viableFamilies = 0;
      for (const botFactory of BOTS) {
        if (overallSurvivalRate(botFactory.name) >= 0.60) {
          viableFamilies++;
        }
      }
      expect(viableFamilies).toBeGreaterThanOrEqual(3);
    });
  });

  // --- Relative Ordering (qualitative constraints) ---

  describe('Strategy Ordering', () => {
    it('diversified survival ≥ corn survival', () => {
      expect(overallSurvivalRate('diversified-adaptive')).toBeGreaterThanOrEqual(
        overallSurvivalRate('corn-monoculture'),
      );
    });

    it('corn survival > almond survival', () => {
      expect(overallSurvivalRate('corn-monoculture')).toBeGreaterThan(
        overallSurvivalRate('almond-monoculture'),
      );
    });

    it('diversified survival ≥ citrus survival', () => {
      expect(overallSurvivalRate('diversified-adaptive')).toBeGreaterThanOrEqual(
        overallSurvivalRate('citrus-stability'),
      );
    });

    it('diversified survives every seed where any monoculture survives', () => {
      for (const scenarioId of SCENARIO_IDS) {
        for (const seed of SMOKE_SEEDS) {
          const monoSurvived = allResults.some(
            r => (r.botName === 'almond-monoculture' || r.botName === 'corn-monoculture') &&
              r.scenarioId === scenarioId && r.seed === seed && r.survived,
          );
          if (monoSurvived) {
            const divResult = allResults.find(
              r => r.botName === 'diversified-adaptive' &&
                r.scenarioId === scenarioId && r.seed === seed,
            );
            expect(divResult?.survived).toBe(true);
          }
        }
      }
    });
  });

  // --- Per-Family Regression Checks (thresholds from observed data with margin) ---

  describe('Almond Monoculture', () => {
    // Observed: 0% survival, median -$7,352. Almonds bankrupt early (establishment cost).
    it('survives ≤40% of runs', () => {
      expect(overallSurvivalRate('almond-monoculture')).toBeLessThanOrEqual(0.40);
    });
    it('median final cash < $50,000', () => {
      expect(overallMedianCash('almond-monoculture')).toBeLessThan(50_000);
    });
  });

  describe('Corn Monoculture', () => {
    // Post-5d streak penalty: corn-on-corn yields degrade over time (rootworm, allelopathy).
    // Observed: 100% survival, median ~$193K. Still viable but clearly below diversified.
    it('survives ≥80% of runs', () => {
      expect(overallSurvivalRate('corn-monoculture')).toBeGreaterThanOrEqual(0.80);
    });
    it('median final cash > $100K (regression floor)', () => {
      expect(overallMedianCash('corn-monoculture')).toBeGreaterThan(100_000);
    });
  });

  describe('Diversified Adaptive', () => {
    // Post-5d: rotation avoids streak penalty, corn/tomato mix is highly profitable.
    // Observed: 100% survival, median ~$301K.
    it('0% bankruptcy rate', () => {
      const bankruptcies = allResults.filter(
        r => r.botName === 'diversified-adaptive' && !r.survived,
      );
      expect(bankruptcies.length).toBe(0);
    });
    it('median final cash > $200K (regression floor)', () => {
      expect(overallMedianCash('diversified-adaptive')).toBeGreaterThan(200_000);
    });
  });

  describe('Citrus Stability', () => {
    // Post-5d: citrus-led strategy viable. Corn support rows take streak penalty
    // until gradually replaced by citrus expansion. Observed: 100% survival, median ~$86K.
    it('survives ≥60% of runs', () => {
      expect(overallSurvivalRate('citrus-stability')).toBeGreaterThanOrEqual(0.60);
    });
    it('median final cash > $50K (regression floor)', () => {
      expect(overallMedianCash('citrus-stability')).toBeGreaterThan(50_000);
    });
  });

  describe('Zero Irrigation', () => {
    // Observed: 0% survival. Obviously bad strategy should fail.
    it('survives ≤20% of runs', () => {
      expect(overallSurvivalRate('zero-irrigation')).toBeLessThanOrEqual(0.20);
    });
  });

  // Determinism sanity check
  describe('Determinism', () => {
    it('same bot + scenario + seed produces identical results', () => {
      // Pick one combo and run it twice
      const bot1 = createCornMonoculture();
      const bot2 = createCornMonoculture();
      const scenario = SCENARIOS['gradual-warming'];
      const r1 = runBot(bot1, scenario, 42);
      const r2 = runBot(bot2, scenario, 42);
      expect(r1.finalCash).toBe(r2.finalCash);
      expect(r1.yearsCompleted).toBe(r2.yearsCompleted);
      expect(r1.survived).toBe(r2.survived);
    });
  });
}, 600_000); // 10 minute timeout for entire suite

// ============================================================================
// Dedicated Idle-Farm Suite (separate from main BOTS to avoid skewing aggregates)
// ============================================================================

const idleResults: RunResult[] = [];
for (const scenarioId of SCENARIO_IDS) {
  const scenario = SCENARIOS[scenarioId];
  for (const seed of SMOKE_SEEDS) {
    const bot = createIdleFarm();
    idleResults.push(runBot(bot, scenario, seed));
  }
}

describe('Idle Farm (dedicated suite)', () => {
  it('0% survival rate (overhead kills idle farms)', () => {
    const survived = idleResults.filter(r => r.survived).length;
    expect(survived).toBe(0);
  });

  it('median final cash < $0', () => {
    const sorted = idleResults.map(r => r.finalCash).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    expect(median).toBeLessThan(0);
  });

  it('goes bankrupt between year 26 and year 29', () => {
    for (const r of idleResults) {
      expect(r.bankruptcyYear).not.toBeNull();
      expect(r.bankruptcyYear!).toBeGreaterThanOrEqual(26);
      expect(r.bankruptcyYear!).toBeLessThanOrEqual(29);
    }
  });

  it('takes one emergency loan before final bankruptcy', () => {
    // First insolvency → loan offered → bot takes it. Second insolvency → game over.
    for (const r of idleResults) {
      expect(r.loansReceived).toBe(1);
      expect(r.yearsCompleted).toBeGreaterThanOrEqual(26);
    }
  });
}, 120_000);
