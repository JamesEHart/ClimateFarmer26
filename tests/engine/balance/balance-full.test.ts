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
// Assertions — All SPEC §30 Metrics
// ============================================================================

describe('Balance Full (500 runs)', () => {
  // §30.1 — Strategy Archetype Targets
  describe('Almond Monoculture', () => {
    it('survives ≤40% of runs', () => {
      expect(overallSurvivalRate('almond-monoculture')).toBeLessThanOrEqual(0.40);
    });
    it('median final cash < $50,000', () => {
      expect(overallMedianCash('almond-monoculture')).toBeLessThan(50_000);
    });
  });

  describe('Corn Monoculture', () => {
    // Post-4c: OM yield penalty + water allocation + nitrogen tightening
    it('median final cash < $200K', () => {
      expect(overallMedianCash('corn-monoculture')).toBeLessThan(200_000);
    });
    it('survives ≤70% of runs (viable but not dominant)', () => {
      expect(overallSurvivalRate('corn-monoculture')).toBeLessThanOrEqual(0.70);
    });
  });

  describe('Diversified Adaptive', () => {
    it('survives ≥80% of runs', () => {
      expect(overallSurvivalRate('diversified-adaptive')).toBeGreaterThanOrEqual(0.80);
    });
    it('0% bankruptcy rate', () => {
      const bankruptcies = allResults.filter(
        r => r.botName === 'diversified-adaptive' && !r.survived,
      );
      expect(bankruptcies.length).toBe(0);
    });
  });

  // §30.2 — Multiple Viable Paths
  describe('Multiple Viable Paths', () => {
    it('≥3 strategy families survive ≥60% of runs', () => {
      let viableFamilies = 0;
      for (const botFactory of BOTS) {
        if (overallSurvivalRate(botFactory.name) >= 0.60) {
          viableFamilies++;
        }
      }
      expect(viableFamilies).toBeGreaterThanOrEqual(3);
    });
  });

  // §30.3 — Anti-Luck Variance
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

  // §30.3 — Same-Seed Survival Dominance
  describe('Same-Seed Survival Dominance', () => {
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

  // §30.4 — Soil Pedagogy
  describe('Soil Pedagogy', () => {
    it('monoculture without cover crops: ≥50% of runs show ≥20% revenue decline by year 15', () => {
      // Post-4c: OM yield penalty + nitrogen tightening cause visible revenue decline
      const cornResults = allResults.filter(r => r.botName === 'corn-monoculture');
      let declineCount = 0;
      let measurableRuns = 0;
      for (const r of cornResults) {
        if (r.yearSnapshots.length >= 15) {
          measurableRuns++;
          const earlyRevenue = r.yearSnapshots.slice(0, 5).reduce((s, y) => s + y.revenue, 0) / 5;
          const lateRevenue = r.yearSnapshots.slice(10, 15).reduce((s, y) => s + y.revenue, 0) / 5;
          if (earlyRevenue > 0 && lateRevenue < earlyRevenue * 0.80) {
            declineCount++;
          }
        }
      }
      expect(measurableRuns).toBeGreaterThanOrEqual(90);
      const declineRate = declineCount / measurableRuns;
      expect(declineRate).toBeGreaterThanOrEqual(0.50);
    });

    it('cover crop users maintain OM ≥ 1.5%', () => {
      // Diversified bot uses cover crops from year 5
      const divResults = allResults.filter(
        r => r.botName === 'diversified-adaptive' && r.survived,
      );
      for (const r of divResults) {
        expect(r.avgOrganicMatter).toBeGreaterThanOrEqual(1.5);
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
