/**
 * Citrus Stability Bot — Plants citrus progressively as cash allows.
 *
 * Citrus doesn't require chill hours (unlike almonds/pistachios), so it's
 * immune to the declining-chill-hours mechanic. Tests whether the "safe
 * perennial" strategy is too easy or properly balanced.
 */

import type {
  GameState, Command, AutoPauseEvent, ClimateScenario,
} from '../../../../src/engine/types.ts';
import type { StrategyBot } from '../bot-runner.ts';

export function createCitrusStability(): StrategyBot {
  let initialPlantDone = false;

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
            // Pick first choice (cheapest protective option)
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
      // Citrus planting window: Feb-Apr
      if (state.calendar.month >= 2 && state.calendar.month <= 4) {
        const hasEmpties = state.grid.some(row => row.some(c => !c.crop));
        if (hasEmpties) {
          // Plant citrus in available rows. Cost is $720/cell.
          // Year 1: can afford ~69 cells = 8 rows = 64 cells at $46,080
          // (Starting $50k, 64 × $720 = $46,080 — just fits!)
          if (!initialPlantDone) {
            initialPlantDone = true;
            return [{ type: 'PLANT_BULK', scope: 'all', cropId: 'citrus-navels' }];
          }
          // Later years: fill any empty rows (e.g., after crop removal)
          for (let r = 0; r < 8; r++) {
            if (state.grid[r].every(c => !c.crop)) {
              return [{ type: 'PLANT_BULK', scope: 'row', index: r, cropId: 'citrus-navels' }];
            }
          }
        }
      }
      return [];
    },
  };
}
