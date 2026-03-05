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
// Assertions — SPEC §30 Targets
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

  // SPEC §30.1 — Strategy Archetype Targets
  describe('Almond Monoculture', () => {
    it('survives ≤40% of runs', () => {
      expect(overallSurvivalRate('almond-monoculture')).toBeLessThanOrEqual(0.40);
    });
    it('median final cash < $50,000', () => {
      expect(overallMedianCash('almond-monoculture')).toBeLessThan(50_000);
    });
  });

  describe('Corn Monoculture', () => {
    // Post-4c: OM yield penalty + water allocation + nitrogen tightening + irrigation cost increase
    it('median final cash < $200K', () => {
      expect(overallMedianCash('corn-monoculture')).toBeLessThan(200_000);
    });
    // Smoke uses ≤80% (relaxed from SPEC's ≤70%) to accommodate 15-run resolution.
    // Authoritative ≤70% check is in balance-full.test.ts (100 runs).
    it('survives ≤80% of runs (smoke tolerance for 15-run resolution)', () => {
      expect(overallSurvivalRate('corn-monoculture')).toBeLessThanOrEqual(0.80);
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

  // SPEC §30.2 — Multiple Viable Paths
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

  // SPEC §30.3 — Same-Seed Survival Dominance
  describe('Same-Seed Survival Dominance', () => {
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
