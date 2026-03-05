/**
 * Idle Farm Bot — Does NOTHING. Never plants, waters, or harvests.
 * Takes emergency loans when offered. Responds to events with first choice.
 *
 * Tests the annual overhead mechanic: an idle farm should go bankrupt,
 * not survive indefinitely on starting cash.
 */

import type {
  GameState, Command, AutoPauseEvent, ClimateScenario,
} from '../../../../src/engine/types.ts';
import type { StrategyBot } from '../bot-runner.ts';

export function createIdleFarm(): StrategyBot {
  return {
    name: 'idle-farm',

    handleAutoPause(state: GameState, pause: AutoPauseEvent, _scenario: ClimateScenario): Command[] {
      switch (pause.reason) {
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

    onTick(_state: GameState, _scenario: ClimateScenario): Command[] {
      return []; // Do absolutely nothing
    },
  };
}
