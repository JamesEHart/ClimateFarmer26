/**
 * Zero Irrigation Bot — Plants corn + sorghum mix, never waters.
 *
 * Tests water stress impact. Sorghum (ky=0.50) is drought-tolerant and
 * should perform better than corn (ky=0.90) under water stress.
 * The mix teaches that not all crops respond equally to drought.
 */

import type {
  GameState, Command, AutoPauseEvent, ClimateScenario,
} from '../../../../src/engine/types.ts';
import type { StrategyBot } from '../bot-runner.ts';

export function createZeroIrrigation(): StrategyBot {
  return {
    name: 'zero-irrigation',

    handleAutoPause(state: GameState, pause: AutoPauseEvent, _scenario: ClimateScenario): Command[] {
      switch (pause.reason) {
        case 'harvest_ready':
          return [{ type: 'HARVEST_BULK', scope: 'all' }];
        case 'water_stress':
          // Never water — the whole point of this bot
          return [];
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
      // Plant corn (rows 0-3) and sorghum (rows 4-7) every spring
      // Corn: Mar-May, Sorghum: Apr-Jun
      const cmds: Command[] = [];

      if (state.calendar.month >= 4 && state.calendar.month <= 5) {
        // Both crops plantable in April-May
        for (let r = 0; r < 4; r++) {
          if (state.grid[r].some(c => !c.crop)) {
            cmds.push({ type: 'PLANT_BULK', scope: 'row', index: r, cropId: 'silage-corn' });
          }
        }
        for (let r = 4; r < 8; r++) {
          if (state.grid[r].some(c => !c.crop)) {
            cmds.push({ type: 'PLANT_BULK', scope: 'row', index: r, cropId: 'sorghum' });
          }
        }
      }

      return cmds;
    },
  };
}
