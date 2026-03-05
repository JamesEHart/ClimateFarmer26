/**
 * Phase 1 Harness Tests — Validate bot-runner correctness + performance benchmark.
 *
 * These tests verify the harness loop mirrors signals.ts auto-pause behavior,
 * handles bankruptcy/loans correctly, and establishes tick performance baseline.
 */

import { describe, it, expect } from 'vitest';
import { runBot, aggregateRuns } from './bot-runner.ts';
import { createAlmondMonoculture } from './bots/almond-monoculture.ts';
import { SLICE_1_SCENARIO } from '../../../src/data/scenario.ts';
import {
  createInitialState, processCommand, simulateTick,
  dismissAutoPause, resetYearlyTracking,
} from '../../../src/engine/game.ts';
import type { ClimateScenario } from '../../../src/engine/types.ts';

describe('Bot Harness', () => {
  it('almond-monoculture completes 30 years without crash', () => {
    const bot = createAlmondMonoculture();
    const result = runBot(bot, SLICE_1_SCENARIO, 42);

    // Should complete — either survived 30 years or went bankrupt
    expect(result.yearsCompleted).toBeGreaterThanOrEqual(1);
    expect(result.tickCount).toBeGreaterThan(0);
    expect(result.elapsedMs).toBeGreaterThan(0);
  }, 120_000);

  it('almond-monoculture plants almonds (budget-limited by partial offer)', () => {
    const bot = createAlmondMonoculture();
    const result = runBot(bot, SLICE_1_SCENARIO, 42);

    // Almonds cost $960/cell. Starting cash $50,000. Can afford 6 full rows (48 cells, $46,080).
    // The PLANT_BULK partial offer rounds down to complete rows.
    const year1 = result.yearSnapshots.find(s => s.year === 1);
    expect(year1).toBeDefined();
    if (year1) {
      // Should plant at least some almonds (budget allows 6 rows = 48)
      expect(year1.cropCounts['almonds']).toBeGreaterThanOrEqual(48);
    }
  }, 120_000);

  it('RunResult fields are populated correctly', () => {
    const bot = createAlmondMonoculture();
    const result = runBot(bot, SLICE_1_SCENARIO, 42);

    expect(result.botName).toBe('almond-monoculture');
    expect(result.scenarioId).toBe(SLICE_1_SCENARIO.id);
    expect(result.seed).toBe(42);
    expect(typeof result.survived).toBe('boolean');
    expect(result.yearsCompleted).toBeGreaterThanOrEqual(1);
    expect(result.finalCash).toBeDefined();
    expect(result.peakCash).toBeGreaterThanOrEqual(result.finalCash);
    expect(result.totalRevenue).toBeGreaterThanOrEqual(0);
    expect(result.totalExpenses).toBeGreaterThanOrEqual(0);
    expect(result.avgOrganicMatter).toBeGreaterThan(0);
    expect(result.avgNitrogen).toBeGreaterThanOrEqual(0);
    expect(result.yearSnapshots.length).toBeGreaterThanOrEqual(1);
    expect(result.tickCount).toBeGreaterThan(0);
    expect(result.elapsedMs).toBeGreaterThan(0);
  }, 120_000);

  it('same seed produces identical results (determinism)', () => {
    const bot1 = createAlmondMonoculture();
    const bot2 = createAlmondMonoculture();

    const result1 = runBot(bot1, SLICE_1_SCENARIO, 42);
    const result2 = runBot(bot2, SLICE_1_SCENARIO, 42);

    expect(result1.survived).toBe(result2.survived);
    expect(result1.yearsCompleted).toBe(result2.yearsCompleted);
    expect(result1.finalCash).toBe(result2.finalCash);
    expect(result1.totalRevenue).toBe(result2.totalRevenue);
    expect(result1.totalExpenses).toBe(result2.totalExpenses);
    expect(result1.tickCount).toBe(result2.tickCount);
  }, 120_000);

  it('different seeds use different RNG states', () => {
    // Note: Almond monoculture goes bankrupt quickly (year 2-3) before weather
    // variance has time to meaningfully diverge outcomes. Use the loan bot instead
    // for a longer-running test that actually shows seed divergence.
    const loanBot1 = {
      name: 'seed-test',
      handleAutoPause(state: any, pause: any) {
        if (pause.reason === 'loan_offer') return [{ type: 'TAKE_LOAN' as const }];
        if (pause.reason === 'harvest_ready') return [{ type: 'HARVEST_BULK' as const, scope: 'all' as const }];
        if (pause.reason === 'water_stress') return [{ type: 'WATER' as const, scope: 'all' as const }];
        if ((pause.reason === 'event' || pause.reason === 'advisor') && state.activeEvent) {
          return [{ type: 'RESPOND_EVENT' as const, eventId: state.activeEvent.storyletId, choiceId: state.activeEvent.choices[0].id }];
        }
        return [];
      },
      onTick(state: any) {
        if (state.calendar.month >= 3 && state.calendar.month <= 5) {
          const hasEmpties = state.grid.some((row: any[]) => row.some((c: any) => !c.crop));
          if (hasEmpties) return [{ type: 'PLANT_BULK' as const, scope: 'all' as const, cropId: 'silage-corn' }];
        }
        return [];
      },
    };
    const loanBot2 = { ...loanBot1 }; // Same behavior, different instance

    const result1 = runBot(loanBot1, SLICE_1_SCENARIO, 42);
    const result2 = runBot(loanBot2, SLICE_1_SCENARIO, 999);

    // With 30 years of weather variance, some metric must differ
    const sameAll =
      result1.finalCash === result2.finalCash &&
      result1.totalRevenue === result2.totalRevenue &&
      result1.peakCash === result2.peakCash;
    expect(sameAll).toBe(false);
  }, 120_000);

  it('harness handles bankruptcy correctly', () => {
    // Create a bot that never waters, never harvests, never takes loans — guaranteed bankruptcy
    const suicideBot = {
      name: 'suicide-bot',
      handleAutoPause() { return []; }, // decline everything
      onTick() { return []; }, // do nothing
    };

    const result = runBot(suicideBot, SLICE_1_SCENARIO, 42);

    // With annual overhead ($2K/year), cash drains even with no crops.
    // Suicide bot declines loans → bankrupts at first insolvency (~year 25).
    expect(result.survived).toBe(false);
    expect(result.yearsCompleted).toBeGreaterThanOrEqual(1);
    expect(result.tickCount).toBeGreaterThan(0);
  }, 120_000);

  it('harness handles loan_offer → TAKE_LOAN → game continues', () => {
    // Create a bot that plants expensive crops to burn cash, then takes the loan
    const loanBot = {
      name: 'loan-test-bot',
      handleAutoPause(state: any, pause: any) {
        if (pause.reason === 'loan_offer') {
          return [{ type: 'TAKE_LOAN' as const }];
        }
        if (pause.reason === 'harvest_ready') {
          return [{ type: 'HARVEST_BULK' as const, scope: 'all' as const }];
        }
        if (pause.reason === 'water_stress') {
          return [{ type: 'WATER' as const, scope: 'all' as const }];
        }
        if ((pause.reason === 'event' || pause.reason === 'advisor') && state.activeEvent) {
          return [{
            type: 'RESPOND_EVENT' as const,
            eventId: state.activeEvent.storyletId,
            choiceId: state.activeEvent.choices[0].id,
          }];
        }
        return [];
      },
      onTick(state: any) {
        // Plant tomatoes every spring (expensive, high water demand)
        if (state.calendar.month >= 3 && state.calendar.month <= 5) {
          const hasEmpties = state.grid.some((row: any[]) => row.some((c: any) => !c.crop));
          if (hasEmpties) {
            return [{ type: 'PLANT_BULK' as const, scope: 'all' as const, cropId: 'processing-tomatoes' }];
          }
        }
        return [];
      },
    };

    const result = runBot(loanBot, SLICE_1_SCENARIO, 42);

    // Should complete without crash. May or may not survive — the point is
    // the loan mechanism works through the harness.
    expect(result.yearsCompleted).toBeGreaterThanOrEqual(1);
    expect(result.tickCount).toBeGreaterThan(0);
  }, 120_000);

  it('year_end + stacked pause: resets only after queue fully drains', () => {
    // This regression test verifies that resetYearlyTracking is NOT called
    // when a year_end pause is dismissed but other pauses remain in the queue.
    // Mirrors the runtime behavior: signals.ts:475 checks queue.length === 0.
    const state = createInitialState('test-stacked', SLICE_1_SCENARIO);

    // Manually set up a stacked queue: year_end + loan_offer
    state.economy.yearlyRevenue = 5000;
    state.economy.yearlyExpenses = 3000;
    state.yearEndSummaryPending = true;
    state.autoPauseQueue.push(
      { reason: 'year_end', message: 'Year 1 complete.' },
      { reason: 'loan_offer', message: 'Loan available.', data: { loanAmount: 10000 } },
    );

    // Dismiss year_end (first in queue)
    dismissAutoPause(state);

    // year_end dismissed, but loan_offer still in queue
    expect(state.autoPauseQueue.length).toBe(1);
    expect(state.autoPauseQueue[0].reason).toBe('loan_offer');

    // yearEndSummaryPending should NOT be cleared yet — queue not empty
    // (This is the behavior: don't reset until queue drains)
    expect(state.yearEndSummaryPending).toBe(true);

    // Now verify: calling resetYearlyTracking here would be WRONG
    // In the correct harness, we check: yearEndSummaryPending && queue.length === 0
    const shouldReset = state.yearEndSummaryPending && state.autoPauseQueue.length === 0;
    expect(shouldReset).toBe(false);

    // Dismiss loan_offer (second in queue)
    dismissAutoPause(state);
    expect(state.autoPauseQueue.length).toBe(0);

    // NOW we should reset — queue is empty and yearEndSummaryPending is still true
    const shouldResetNow = state.yearEndSummaryPending && state.autoPauseQueue.length === 0;
    expect(shouldResetNow).toBe(true);

    resetYearlyTracking(state);
    expect(state.yearEndSummaryPending).toBe(false);
    expect(state.economy.yearlyRevenue).toBe(0);
    expect(state.economy.yearlyExpenses).toBe(0);
  });

  it('aggregateRuns computes correct metrics', () => {
    const bot = createAlmondMonoculture();
    const results = [
      runBot(bot, SLICE_1_SCENARIO, 42),
      runBot(createAlmondMonoculture(), SLICE_1_SCENARIO, 100),
      runBot(createAlmondMonoculture(), SLICE_1_SCENARIO, 200),
    ];

    const metrics = aggregateRuns(results);
    expect(metrics.botName).toBe('almond-monoculture');
    expect(metrics.scenarioId).toBe(SLICE_1_SCENARIO.id);
    expect(metrics.runs).toBe(3);
    expect(metrics.survivalRate).toBeGreaterThanOrEqual(0);
    expect(metrics.survivalRate).toBeLessThanOrEqual(1);
    expect(typeof metrics.medianFinalCash).toBe('number');
    expect(typeof metrics.p10FinalCash).toBe('number');
    expect(typeof metrics.p75FinalCash).toBe('number');
    expect(metrics.avgTickMs).toBeGreaterThan(0);
  }, 360_000);
});

describe('Performance Benchmark', () => {
  it('single 30-year run completes in < 60s', () => {
    const bot = createAlmondMonoculture();
    const result = runBot(bot, SLICE_1_SCENARIO, 42);

    const avgTickMs = result.elapsedMs / result.tickCount;
    console.log(`\n--- Performance Benchmark ---`);
    console.log(`Tick count: ${result.tickCount}`);
    console.log(`Elapsed: ${result.elapsedMs.toFixed(0)}ms`);
    console.log(`Avg tick: ${avgTickMs.toFixed(3)}ms`);
    console.log(`Years completed: ${result.yearsCompleted}`);
    console.log(`Survived: ${result.survived}`);
    console.log(`Final cash: $${Math.round(result.finalCash).toLocaleString()}`);
    console.log(`---\n`);

    expect(result.elapsedMs).toBeLessThan(60_000);

    // Warn if tick time exceeds targets
    if (avgTickMs > 4) {
      console.warn(`WARNING: Avg tick ${avgTickMs.toFixed(3)}ms exceeds 4ms hard limit!`);
    } else if (avgTickMs > 2) {
      console.warn(`NOTE: Avg tick ${avgTickMs.toFixed(3)}ms exceeds 2ms target, investigate optimization.`);
    }
  }, 120_000);
});
