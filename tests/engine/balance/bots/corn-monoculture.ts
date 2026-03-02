/**
 * Corn Monoculture Bot — Plants 64 corn every spring, waters/harvests reactively.
 *
 * Represents the "reliable annual" strategy. Corn is cheap ($100/cell) and
 * produces consistent revenue. This bot should survive longer than almonds
 * but suffer from soil degradation without cover crops.
 */

import type {
  GameState, Command, AutoPauseEvent, ClimateScenario,
} from '../../../../src/engine/types.ts';
import type { StrategyBot } from '../bot-runner.ts';

export function createCornMonoculture(): StrategyBot {
  return {
    name: 'corn-monoculture',

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
      // Plant corn every spring on empty cells (corn window: Mar-May)
      if (state.calendar.month >= 3 && state.calendar.month <= 5) {
        const hasEmpties = state.grid.some(row => row.some(c => !c.crop));
        if (hasEmpties) {
          return [{ type: 'PLANT_BULK', scope: 'all', cropId: 'silage-corn' }];
        }
      }
      return [];
    },
  };
}
