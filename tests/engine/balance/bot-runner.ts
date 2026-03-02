/**
 * Bot Runner — Headless strategy bot harness for balance testing.
 *
 * Runs StrategyBot implementations through the full game engine loop,
 * collecting metrics for balance analysis. The harness mirrors the
 * signals.ts handleDismissAutoPause() ordering exactly:
 *   1. Bot issues commands before dismiss
 *   2. dismissAutoPause() removes the pause from queue
 *   3. resetYearlyTracking() called only when yearEndSummaryPending
 *      AND queue is fully empty (not per-pause)
 */

import type {
  GameState, Command, CommandResult, AutoPauseEvent, ClimateScenario, YearSnapshot, Cell,
} from '../../../src/engine/types.ts';
import { GRID_ROWS, GRID_COLS } from '../../../src/engine/types.ts';
import {
  createInitialState, processCommand, simulateTick,
  dismissAutoPause, resetYearlyTracking, executeBulkPlant,
  executeWater, executeBulkCoverCrop,
} from '../../../src/engine/game.ts';
import { getCropDefinition } from '../../../src/data/crops.ts';

// ============================================================================
// Types
// ============================================================================

export interface StrategyBot {
  name: string;
  /** Called for actionable auto-pause reasons. Returns commands to execute before dismiss. */
  handleAutoPause(state: GameState, pause: AutoPauseEvent, scenario: ClimateScenario): Command[];
  /** Called every tick. Returns proactive commands (planting, etc). */
  onTick(state: GameState, scenario: ClimateScenario): Command[];
}

export interface RunResult {
  botName: string;
  scenarioId: string;
  seed: number;
  survived: boolean;
  yearsCompleted: number;
  finalCash: number;
  peakCash: number;
  totalRevenue: number;
  totalExpenses: number;
  avgOrganicMatter: number;
  avgNitrogen: number;
  yearSnapshots: YearSnapshot[];
  bankruptcyYear: number | null;
  tickCount: number;
  elapsedMs: number;
}

export interface AggregateMetrics {
  botName: string;
  scenarioId: string;
  runs: number;
  survivalRate: number;
  medianFinalCash: number;
  p10FinalCash: number;
  p75FinalCash: number;
  medianAvgOM: number;
  avgTickMs: number;
}

// ============================================================================
// Harness
// ============================================================================

/**
 * Execute a command, automatically accepting partial offers.
 *
 * When PLANT_BULK or WATER returns a partialOffer, this mirrors the UI
 * behavior of confirming the dialog — calls executeBulkPlant/executeWater
 * directly with the affordable subset. See signals.ts lines 275-296.
 */
function executeCommandWithPartialOffers(
  state: GameState, cmd: Command, scenario: ClimateScenario,
): CommandResult {
  const result = processCommand(state, cmd, scenario);

  // Handle partial offers for PLANT_BULK (mirrors signals.ts confirm dialog)
  if (result.partialOffer && cmd.type === 'PLANT_BULK' && cmd.scope === 'all') {
    const offer = result.partialOffer;
    const cropDef = getCropDefinition(cmd.cropId);
    const cells: Cell[] = [];
    let rowsCollected = 0;
    for (let r = 0; r < GRID_ROWS && rowsCollected < offer.affordableRows; r++) {
      const rowEmpty = state.grid[r].filter(c => c.crop === null);
      if (rowEmpty.length === GRID_COLS) {
        cells.push(...rowEmpty);
        rowsCollected++;
      }
    }
    if (cells.length > 0) {
      return executeBulkPlant(state, cells, cmd.cropId, cropDef.seedCostPerAcre);
    }
  }

  // Handle partial offers for WATER scope:all (mirrors signals.ts lines 349-364)
  if (result.partialOffer && cmd.type === 'WATER' && cmd.scope === 'all') {
    const offer = result.partialOffer;
    const cells: Cell[] = [];
    let rowsCollected = 0;
    for (let r = 0; r < GRID_ROWS && rowsCollected < offer.affordableRows; r++) {
      const rowPlanted = state.grid[r].filter(c => c.crop !== null);
      if (rowPlanted.length > 0) {
        cells.push(...rowPlanted);
        rowsCollected++;
      }
    }
    if (cells.length > 0) {
      return executeWater(state, cells);
    }
  }

  return result;
}

/**
 * Run a bot through a full 30-year game, collecting metrics.
 *
 * Auto-pause handling mirrors signals.ts:470-484 exactly:
 * - Commands issued BEFORE dismiss (for events, loans, harvests, watering)
 * - dismissAutoPause() called first
 * - resetYearlyTracking() only when yearEndSummaryPending AND queue empty
 */
export function runBot(bot: StrategyBot, scenario: ClimateScenario, seed: number): RunResult {
  const testScenario: ClimateScenario = { ...scenario, seed };
  const state = createInitialState('bot-' + bot.name, testScenario);

  let tickCount = 0;
  let peakCash = state.economy.cash;
  const startMs = performance.now();

  // Main loop: handle pauses, then tick. Must handle pauses even when gameOver
  // is true, because TAKE_LOAN clears gameOver (first insolvency → loan offer).
  // Runtime: simulateTick sets gameOver + pushes loan_offer pause. Game loop
  // breaks, UI shows pause panel, user takes loan → gameOver cleared, game resumes.
  // Harness: we must process the loan_offer pause before checking gameOver.
  for (;;) {
    // 1. Handle all auto-pauses (even if gameOver — loan_offer can clear it)
    while (state.autoPauseQueue.length > 0) {
      const pause = state.autoPauseQueue[0];

      // Bot issues commands for actionable pauses BEFORE dismiss
      if (pause.reason !== 'year_end' && pause.reason !== 'bankruptcy' && pause.reason !== 'year_30') {
        const cmds = bot.handleAutoPause(state, pause, testScenario);
        for (const cmd of cmds) {
          executeCommandWithPartialOffers(state, cmd, testScenario);
        }
      }

      // Dismiss first (mirrors signals.ts:473)
      dismissAutoPause(state);

      // Reset yearly tracking only when queue fully drains (mirrors signals.ts:475-477)
      if (state.yearEndSummaryPending && state.autoPauseQueue.length === 0) {
        resetYearlyTracking(state);
      }
    }

    // 2. Check game over AFTER all pauses are handled
    if (state.gameOver) break;

    // 3. Bot proactive actions (planting, etc.)
    const cmds = bot.onTick(state, testScenario);
    for (const cmd of cmds) {
      executeCommandWithPartialOffers(state, cmd, testScenario);
    }

    // 4. Track peak cash
    if (state.economy.cash > peakCash) {
      peakCash = state.economy.cash;
    }

    // 5. Advance one day
    state.speed = 1;
    simulateTick(state, testScenario);
    tickCount++;
  }

  const elapsedMs = performance.now() - startMs;
  return extractRunResult(state, bot.name, testScenario.id, seed, tickCount, elapsedMs, peakCash);
}

// ============================================================================
// Result Extraction
// ============================================================================

function extractRunResult(
  state: GameState,
  botName: string,
  scenarioId: string,
  seed: number,
  tickCount: number,
  elapsedMs: number,
  peakCash: number,
): RunResult {
  const snapshots = state.tracking.yearSnapshots;
  const lastSnapshot = snapshots[snapshots.length - 1];

  // Compute final soil averages from grid
  let totalOM = 0;
  let totalN = 0;
  let cellCount = 0;
  for (const row of state.grid) {
    for (const cell of row) {
      totalOM += cell.soil.organicMatter;
      totalN += cell.soil.nitrogen;
      cellCount++;
    }
  }

  const survived = !state.gameOverReason?.includes('bankrupt');

  return {
    botName,
    scenarioId,
    seed,
    survived,
    yearsCompleted: state.calendar.year,
    finalCash: state.economy.cash,
    peakCash,
    totalRevenue: snapshots.reduce((sum, s) => sum + s.revenue, 0),
    totalExpenses: snapshots.reduce((sum, s) => {
      const e = s.expenses;
      return sum + e.planting + e.watering + e.harvestLabor + e.maintenance +
        e.loanRepayment + e.removal + e.coverCrops + e.eventCosts;
    }, 0),
    avgOrganicMatter: cellCount > 0 ? totalOM / cellCount : 0,
    avgNitrogen: cellCount > 0 ? totalN / cellCount : 0,
    yearSnapshots: snapshots,
    bankruptcyYear: survived ? null : state.calendar.year,
    tickCount,
    elapsedMs,
  };
}

// ============================================================================
// Aggregation
// ============================================================================

export function aggregateRuns(results: RunResult[]): AggregateMetrics {
  if (results.length === 0) throw new Error('No results to aggregate');

  const sortedCash = results.map(r => r.finalCash).sort((a, b) => a - b);
  const sortedOM = results.map(r => r.avgOrganicMatter).sort((a, b) => a - b);
  const totalTicks = results.reduce((sum, r) => sum + r.tickCount, 0);
  const totalMs = results.reduce((sum, r) => sum + r.elapsedMs, 0);

  return {
    botName: results[0].botName,
    scenarioId: results[0].scenarioId,
    runs: results.length,
    survivalRate: results.filter(r => r.survived).length / results.length,
    medianFinalCash: percentile(sortedCash, 0.5),
    p10FinalCash: percentile(sortedCash, 0.1),
    p75FinalCash: percentile(sortedCash, 0.75),
    medianAvgOM: percentile(sortedOM, 0.5),
    avgTickMs: totalTicks > 0 ? totalMs / totalTicks : 0,
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const index = p * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function printSummaryTable(allMetrics: AggregateMetrics[]): void {
  console.log('\n' + '='.repeat(120));
  console.log('BALANCE TEST SUMMARY');
  console.log('='.repeat(120));
  console.log(
    padRight('Bot', 25) +
    padRight('Scenario', 20) +
    padRight('Runs', 6) +
    padRight('Surv%', 8) +
    padRight('Med$', 12) +
    padRight('p10$', 12) +
    padRight('p75$', 12) +
    padRight('MedOM%', 8) +
    padRight('Tick(ms)', 10)
  );
  console.log('-'.repeat(120));

  for (const m of allMetrics) {
    console.log(
      padRight(m.botName, 25) +
      padRight(m.scenarioId, 20) +
      padRight(String(m.runs), 6) +
      padRight((m.survivalRate * 100).toFixed(0) + '%', 8) +
      padRight('$' + Math.round(m.medianFinalCash).toLocaleString(), 12) +
      padRight('$' + Math.round(m.p10FinalCash).toLocaleString(), 12) +
      padRight('$' + Math.round(m.p75FinalCash).toLocaleString(), 12) +
      padRight(m.medianAvgOM.toFixed(2) + '%', 8) +
      padRight(m.avgTickMs.toFixed(3), 10)
    );
  }
  console.log('='.repeat(120) + '\n');
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str : str + ' '.repeat(len - str.length);
}
