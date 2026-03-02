/**
 * Almond Monoculture Bot — Plants 64 almonds, waters/harvests reactively.
 *
 * Represents the "lazy perennial" strategy that should be punished by
 * the rebalanced economy. Almonds are planted in year 1 spring and never
 * changed. Bot always takes loans and picks the first (cheapest) event choice.
 */

import type {
  GameState, Command, AutoPauseEvent, ClimateScenario,
} from '../../../../src/engine/types.ts';
import type { StrategyBot } from '../bot-runner.ts';

function createAlmondMonoculture(): StrategyBot {
  let planted = false;

  return {
    name: 'almond-monoculture',

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
          // Pick first choice (cheapest / do-nothing)
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
      // Plant almonds once in year 1 spring (planting window: Jan-Mar)
      if (!planted && state.calendar.year === 1 && state.calendar.month >= 1 && state.calendar.month <= 3) {
        const hasEmpties = state.grid.some(row => row.some(c => !c.crop));
        if (hasEmpties) {
          planted = true;
          return [{ type: 'PLANT_BULK', scope: 'all', cropId: 'almonds' }];
        }
      }
      return [];
    },
  };
}

export { createAlmondMonoculture };
