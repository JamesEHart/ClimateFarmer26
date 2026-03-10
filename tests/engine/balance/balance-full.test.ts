/**
 * Balance Full Calibration Tests — 5 bots × 5 scenarios × 20 seeds = 500 runs.
 *
 * Manual-only tier for validation gates. Includes all SPEC §30 metrics:
 * anti-luck variance (p25-p75 spread), soil pedagogy, full strategy targets.
 *
 * Run: npm run test:balance-full
 * Expected runtime: ~30 min to 3 hrs depending on hardware.
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

const FULL_SEEDS = Array.from({ length: 20 }, (_, i) => 42 + i * 53); // 20 distinct seeds

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
// Run Full Matrix
// ============================================================================

const allResults: RunResult[] = [];
const allMetrics: AggregateMetrics[] = [];

for (const botFactory of BOTS) {
  for (const scenarioId of SCENARIO_IDS) {
    const scenario = SCENARIOS[scenarioId];
    const results: RunResult[] = [];
    for (const seed of FULL_SEEDS) {
      const bot = botFactory.create();
      results.push(runBot(bot, scenario, seed));
    }
    allResults.push(...results);
    allMetrics.push(aggregateRuns(results));
  }
}

printSummaryTable(allMetrics);

// ============================================================================
// Helpers
// ============================================================================

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

function cashPercentile(botName: string, p: number): number {
  const sorted = allResults.filter(r => r.botName === botName).map(r => r.finalCash).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (1 - (idx - lo)) + sorted[hi] * (idx - lo);
}

// ============================================================================
// Assertions — Balance Quality Checks (5d revision)
//
// Philosophy: Bots are diagnostic instruments. Thresholds are regression checks
// derived from observed behavior, not sacred design targets. Qualitative ordering
// constraints are the hard gates.
//
// See KNOWN_ISSUES.md for SPEC §30 revision notes.
// ============================================================================

describe('Balance Full (500 runs)', () => {
  // --- Absolute Anchors ---

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

  // --- Relative Ordering ---

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
        for (const seed of FULL_SEEDS) {
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

  // --- Per-Family Regression Checks ---

  describe('Almond Monoculture', () => {
    it('survives ≤40% of runs', () => {
      expect(overallSurvivalRate('almond-monoculture')).toBeLessThanOrEqual(0.40);
    });
    it('median final cash < $50,000', () => {
      expect(overallMedianCash('almond-monoculture')).toBeLessThan(50_000);
    });
  });

  describe('Corn Monoculture', () => {
    // Post-5d streak penalty: corn-on-corn yields degrade (rootworm, allelopathy).
    // Still viable but clearly below diversified rotation.
    it('survives ≥80% of runs', () => {
      expect(overallSurvivalRate('corn-monoculture')).toBeGreaterThanOrEqual(0.80);
    });
    it('median final cash > $100K (regression floor)', () => {
      expect(overallMedianCash('corn-monoculture')).toBeGreaterThan(100_000);
    });
  });

  describe('Diversified Adaptive', () => {
    // Post-5d: rotation avoids streak penalty, corn/tomato mix is highly profitable.
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
    // Citrus-led with corn support rows (corn takes streak penalty until replaced by citrus).
    it('survives ≥60% of runs', () => {
      expect(overallSurvivalRate('citrus-stability')).toBeGreaterThanOrEqual(0.60);
    });
    it('median final cash > $50K (regression floor)', () => {
      expect(overallMedianCash('citrus-stability')).toBeGreaterThan(50_000);
    });
  });

  describe('Zero Irrigation', () => {
    it('survives ≤20% of runs', () => {
      expect(overallSurvivalRate('zero-irrigation')).toBeLessThanOrEqual(0.20);
    });
  });

  // --- Anti-Luck Variance ---

  describe('Anti-Luck Variance', () => {
    for (const botFactory of BOTS) {
      it(`${botFactory.name}: p25-p75 cash spread < 2×`, () => {
        const p25 = cashPercentile(botFactory.name, 0.25);
        const p75 = cashPercentile(botFactory.name, 0.75);
        // For bankrupt bots (negative cash), skip entirely
        if (p25 > 0 && p75 > 0) {
          if (p25 > 5_000) {
            // Well-capitalized bots: ratio check (p75/p25 < 2×)
            expect(p75 / p25).toBeLessThan(2);
          } else {
            // Thin-margin bots: absolute spread check instead of ratio
            // (ratios are meaningless when denominator is near zero)
            expect(p75 - p25).toBeLessThan(10_000);
          }
        }
      });
    }
  });

  // --- Soil Pedagogy ---

  describe('Soil Pedagogy', () => {
    it('cover crop users maintain OM ≥ 1.5%', () => {
      // Diversified bot uses cover crops — soil should stay healthy
      const divResults = allResults.filter(
        r => r.botName === 'diversified-adaptive' && r.survived,
      );
      for (const r of divResults) {
        expect(r.avgOrganicMatter).toBeGreaterThanOrEqual(1.5);
      }
    });

    it('non-cover-crop monoculture has lower OM than cover-crop users', () => {
      // Almond monoculture has no cover crops; corn now uses cover crops.
      // Almond OM should be lower than diversified OM.
      const almondOM = allResults
        .filter(r => r.botName === 'almond-monoculture')
        .map(r => r.avgOrganicMatter);
      const divOM = allResults
        .filter(r => r.botName === 'diversified-adaptive')
        .map(r => r.avgOrganicMatter);
      if (almondOM.length > 0 && divOM.length > 0) {
        const avgAlmond = almondOM.reduce((s, v) => s + v, 0) / almondOM.length;
        const avgDiv = divOM.reduce((s, v) => s + v, 0) / divOM.length;
        expect(avgAlmond).toBeLessThan(avgDiv);
      }
    });
  });
}, 3_600_000); // 1 hour timeout

// ============================================================================
// Dedicated Idle-Farm Suite (separate from main BOTS to avoid skewing aggregates)
// ============================================================================

const idleResults: RunResult[] = [];
for (const scenarioId of SCENARIO_IDS) {
  const scenario = SCENARIOS[scenarioId];
  for (const seed of FULL_SEEDS) {
    const bot = createIdleFarm();
    idleResults.push(runBot(bot, scenario, seed));
  }
}

describe('Idle Farm (dedicated suite, 100 runs)', () => {
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
    for (const r of idleResults) {
      expect(r.loansReceived).toBe(1);
      expect(r.yearsCompleted).toBeGreaterThanOrEqual(26);
    }
  });
}, 600_000);
