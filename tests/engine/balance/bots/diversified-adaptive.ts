/**
 * Diversified Adaptive Bot — Mixed rotation with outcome-based adaptation.
 *
 * This represents the "good student" strategy that should score well across
 * all metrics: financial stability, soil health, diversity, and adaptation.
 *
 * Strategy phases:
 * - Years 1-4: Corn (rows 0-2), tomatoes (rows 3-4), sorghum (rows 5-6), wheat in fall (rows 6-7)
 * - Year 5+: Plant pistachios in rows 5-6. Cover crops on empties in fall.
 * - Year 10+: Shift toward citrus if chill hours declining. Rotate annuals.
 * - Year 15+: Continue cover crops. React to revenue declines.
 *
 * Does NOT read advisor text — purely outcome-based adaptation.
 */

import type {
  GameState, Command, AutoPauseEvent, ClimateScenario,
} from '../../../../src/engine/types.ts';
import type { StrategyBot } from '../bot-runner.ts';

export function createDiversifiedAdaptive(): StrategyBot {
  let pistachiosPlanted = false;
  let citrusStarted = false;

  return {
    name: 'diversified-adaptive',

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
            // Pick the protective option (usually the last choice, which costs more but protects)
            // Simple heuristic: pick the LAST choice (often the "invest in protection" option)
            const choices = state.activeEvent.choices;
            return [{
              type: 'RESPOND_EVENT',
              eventId: state.activeEvent.storyletId,
              choiceId: choices[choices.length - 1].id,
            }];
          }
          return [];
        default:
          return [];
      }
    },

    onTick(state: GameState, scenario: ClimateScenario): Command[] {
      const { year, month } = state.calendar;
      const cmds: Command[] = [];

      // --- Spring planting (Mar-May for most, Apr-Jun for sorghum) ---
      if (month === 3) {
        // Only plant once per spring (month 3 = first opportunity for most crops)
        if (year <= 4) {
          // Phase 1: Diverse annuals
          plantRowIfEmpty(state, cmds, 0, 'silage-corn');
          plantRowIfEmpty(state, cmds, 1, 'silage-corn');
          plantRowIfEmpty(state, cmds, 2, 'silage-corn');
          plantRowIfEmpty(state, cmds, 3, 'processing-tomatoes');
          plantRowIfEmpty(state, cmds, 4, 'processing-tomatoes');
          // Rows 5-7: sorghum planted in April (see month 4 block)
        } else if (year <= 9) {
          // Phase 2: Start perennials, keep some annuals
          if (!pistachiosPlanted) {
            plantRowIfEmpty(state, cmds, 5, 'pistachios');
            plantRowIfEmpty(state, cmds, 6, 'pistachios');
            pistachiosPlanted = true;
          }
          plantRowIfEmpty(state, cmds, 0, 'silage-corn');
          plantRowIfEmpty(state, cmds, 1, 'processing-tomatoes');
          plantRowIfEmpty(state, cmds, 2, 'silage-corn');
          plantRowIfEmpty(state, cmds, 3, 'processing-tomatoes');
          plantRowIfEmpty(state, cmds, 4, 'silage-corn');
        } else {
          // Phase 3: Rotate annuals, consider citrus
          // Check if chill hours are declining — scenario data
          const yearClimate = scenario.years[Math.min(year - 1, 29)];
          if (!citrusStarted && yearClimate.chillHours < 650) {
            // Replace row 7 with citrus (no chill requirement)
            plantRowIfEmpty(state, cmds, 7, 'citrus-navels');
            citrusStarted = true;
          }

          // Alternate corn and tomatoes for diversity
          const useTomatoes = year % 2 === 0;
          plantRowIfEmpty(state, cmds, 0, useTomatoes ? 'processing-tomatoes' : 'silage-corn');
          plantRowIfEmpty(state, cmds, 1, useTomatoes ? 'silage-corn' : 'processing-tomatoes');
          plantRowIfEmpty(state, cmds, 2, useTomatoes ? 'processing-tomatoes' : 'silage-corn');
          plantRowIfEmpty(state, cmds, 3, useTomatoes ? 'silage-corn' : 'processing-tomatoes');
          plantRowIfEmpty(state, cmds, 4, useTomatoes ? 'processing-tomatoes' : 'silage-corn');
        }
      }

      // Sorghum in April (planting window: Apr-Jun)
      if (month === 4 && year <= 4) {
        plantRowIfEmpty(state, cmds, 5, 'sorghum');
        plantRowIfEmpty(state, cmds, 6, 'sorghum');
        plantRowIfEmpty(state, cmds, 7, 'sorghum');
      }

      // --- Fall: Cover crops + wheat ---
      if (month === 10) {
        if (year <= 4) {
          // Wheat on rows 6-7 (fall planting window: Oct-Nov)
          plantRowIfEmpty(state, cmds, 6, 'winter-wheat');
          plantRowIfEmpty(state, cmds, 7, 'winter-wheat');
        }

        // Cover crops on empty cells (year 5+)
        if (year >= 5) {
          for (let r = 0; r < 8; r++) {
            if (state.grid[r].some(c => !c.crop && c.coverCropId === null)) {
              cmds.push({ type: 'SET_COVER_CROP_BULK', scope: 'row', index: r, coverCropId: 'legume-cover' });
            }
          }
        }
      }

      return cmds;
    },
  };
}

/** Helper: plant a crop in a row if any cells are empty */
function plantRowIfEmpty(state: GameState, cmds: Command[], row: number, cropId: string): void {
  if (state.grid[row].some(c => !c.crop)) {
    cmds.push({ type: 'PLANT_BULK', scope: 'row', index: row, cropId });
  }
}
