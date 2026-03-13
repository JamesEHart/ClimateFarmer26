/**
 * Corn Monoculture Bot — Plants corn every spring, with basic soil care.
 *
 * Represents the "slightly less lazy monoculture" strategy: plants one crop,
 * waters reactively, but at least uses cover crops in fall and reduces
 * planting when cash is tight. Should be risky but not instant death.
 *
 * Strategy:
 * - Spring: Plant corn on all empty rows (skip if cash < $10K)
 * - Fall: Cover crops on empty rows (free soil care)
 * - Events: Pick choices that directly benefit corn (auto-irrigation, water recycling)
 * - Otherwise: Picks cheapest option (choice 0)
 */

import type {
  GameState, Command, AutoPauseEvent, ClimateScenario,
} from '../../../../src/engine/types.ts';
import type { StrategyBot } from '../bot-runner.ts';

/** Storylet-specific preferred choices that directly benefit a corn strategy */
const PREFERRED_CHOICES: Record<string, string> = {
  'tech-water-irrigation': 'install-irrigation',
  'regime-water-restriction': 'invest-water-recycling',
  'chen-insurance-offer': 'decline-insurance',
  'santos-organic-offer': 'decline-organic',
  'catastrophe-rootworm': 'accept-rootworm-losses',
  'catastrophe-water-emergency': 'accept-water-restriction',
};

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
            // Check for storylet-specific preferred choice
            const preferred = PREFERRED_CHOICES[state.activeEvent.storyletId];
            if (preferred) {
              const choice = state.activeEvent.choices.find(c => c.id === preferred);
              if (choice) {
                return [{
                  type: 'RESPOND_EVENT',
                  eventId: state.activeEvent.storyletId,
                  choiceId: choice.id,
                }];
              }
            }
            // Default: pick first (cheapest) choice
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
      const { month, year } = state.calendar;
      const cmds: Command[] = [];

      // Plant corn every spring on empty cells (corn window: Mar-May)
      // Skip if cash is critically low — don't spend last dollar on seed
      if (month >= 3 && month <= 5) {
        if (state.economy.cash >= 10000) {
          const hasEmpties = state.grid.some(row => row.some(c => !c.crop));
          if (hasEmpties) {
            cmds.push({ type: 'PLANT_BULK', scope: 'all', cropId: 'silage-corn' });
          }
        } else if (state.economy.cash >= 3000) {
          // Cash-stressed: plant fewer rows (top 4 only)
          for (let r = 0; r < 4; r++) {
            if (state.grid[r].some(c => !c.crop)) {
              cmds.push({ type: 'PLANT_BULK', scope: 'row', index: r, cropId: 'silage-corn' });
            }
          }
        }
      }

      // Fall: cover crops on empty rows (Y2+) — basic soil care
      if (month === 10 && year >= 2) {
        for (let r = 0; r < 8; r++) {
          if (state.grid[r].some(c => !c.crop && c.coverCropId === null)) {
            cmds.push({ type: 'SET_COVER_CROP_BULK', scope: 'row', index: r, coverCropId: 'legume-cover' });
          }
        }
      }

      return cmds;
    },
  };
}
