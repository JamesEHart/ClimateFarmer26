/**
 * Citrus Stability Bot — Citrus-led strategy with annual cash support.
 *
 * Starts half the farm as citrus from Y1, keeping 4 rows of annuals for
 * cash flow during the 3-year citrus establishment period. Expands citrus
 * as cash allows. This tests whether a citrus-centric strategy is viable
 * when played realistically (not "plant $46K of perennials day 1").
 *
 * Strategy phases:
 * - Y1: Citrus rows 0-3 (half farm), corn rows 4-7 (cash flow)
 * - Y2-3: Keep planting corn on annual rows. Citrus establishing.
 * - Y4+: Expand citrus to row 4 if cash > $15K, then row 5, etc.
 * - Fall Y3+: Cover crops on empty annual rows.
 */

import type {
  GameState, Command, AutoPauseEvent, ClimateScenario,
} from '../../../../src/engine/types.ts';
import type { StrategyBot } from '../bot-runner.ts';

export function createCitrusStability(): StrategyBot {
  let citrusPlantedRows = 0;  // Track how many rows are citrus

  return {
    name: 'citrus-stability',

    handleAutoPause(state: GameState, pause: AutoPauseEvent, _scenario: ClimateScenario): Command[] {
      switch (pause.reason) {
        case 'harvest_ready':
          return [{ type: 'HARVEST_BULK', scope: 'all' }];
        case 'water_stress':
          return [{ type: 'WATER', scope: 'all' }];
        case 'loan_offer':
          return [{ type: 'TAKE_LOAN' }];
        case 'event':
        case 'advisor':
          if (state.activeEvent && state.activeEvent.choices.length > 0) {
            return [{
              type: 'RESPOND_EVENT',
              eventId: state.activeEvent.storyletId,
              choiceId: state.activeEvent.choices[0].id,
            }];
          }
          return [];
        default:
          return [];
      }
    },

    onTick(state: GameState, _scenario: ClimateScenario): Command[] {
      const { year, month } = state.calendar;
      const cmds: Command[] = [];

      // --- Spring planting (citrus window: Feb-Apr, corn window: Mar-May) ---
      if (month === 3) {
        if (year === 1) {
          // Y1: Half farm citrus (rows 0-3), half corn (rows 4-7)
          for (let r = 0; r < 4; r++) {
            if (state.grid[r].every(c => !c.crop)) {
              cmds.push({ type: 'PLANT_BULK', scope: 'row', index: r, cropId: 'citrus-navels' });
            }
          }
          citrusPlantedRows = 4;
          for (let r = 4; r < 8; r++) {
            if (state.grid[r].some(c => !c.crop)) {
              cmds.push({ type: 'PLANT_BULK', scope: 'row', index: r, cropId: 'silage-corn' });
            }
          }
        } else if (year <= 3) {
          // Y2-3: Keep planting corn on annual rows (4-7)
          for (let r = 4; r < 8; r++) {
            if (state.grid[r].some(c => !c.crop)) {
              cmds.push({ type: 'PLANT_BULK', scope: 'row', index: r, cropId: 'silage-corn' });
            }
          }
        } else {
          // Y4+: Expand citrus if cash allows, fill remaining with corn
          if (citrusPlantedRows < 7 && state.economy.cash > 15000) {
            const nextRow = citrusPlantedRows;
            if (nextRow < 8 && state.grid[nextRow].every(c => !c.crop)) {
              cmds.push({ type: 'PLANT_BULK', scope: 'row', index: nextRow, cropId: 'citrus-navels' });
              citrusPlantedRows++;
            }
          }
          // Fill remaining annual rows with corn
          for (let r = citrusPlantedRows; r < 8; r++) {
            if (state.grid[r].some(c => !c.crop)) {
              cmds.push({ type: 'PLANT_BULK', scope: 'row', index: r, cropId: 'silage-corn' });
            }
          }
        }
      }

      // --- Fall: Cover crops on empty annual rows (Y3+) ---
      if (month === 10 && year >= 3) {
        for (let r = citrusPlantedRows; r < 8; r++) {
          if (state.grid[r].some(c => !c.crop && c.coverCropId === null)) {
            cmds.push({ type: 'SET_COVER_CROP_BULK', scope: 'row', index: r, coverCropId: 'legume-cover' });
          }
        }
      }

      return cmds;
    },
  };
}
