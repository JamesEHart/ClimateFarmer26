/**
 * Diversified Adaptive Bot — Crop rotation with perennial investment.
 *
 * Represents the "good student" strategy that should score well across
 * all metrics: financial stability, soil health, diversity, and adaptation.
 *
 * Key principle: ROTATE annuals to avoid monoculture yield penalty.
 * Real students who understand rotation would alternate crops on each row.
 *
 * Strategy phases:
 * - Years 1-4: Rotate corn/tomatoes on rows 0-4 (alternate by year).
 *              Sorghum on rows 5-7 (spring). Wheat on rows 6-7 (fall).
 * - Year 5+:   Plant pistachios in rows 5-6. Continue corn/tomato rotation rows 0-4.
 *              Cover crops on empties in fall.
 * - Year 10+:  Shift toward citrus if chill hours declining. Continue rotation.
 *
 * Does NOT read advisor text — purely outcome-based adaptation.
 */

import type {
  GameState, Command, AutoPauseEvent, ClimateScenario,
} from '../../../../src/engine/types.ts';
import type { StrategyBot } from '../bot-runner.ts';

/** Storylet-specific preferred choices — diversified bot buys insurance and files claims */
const PREFERRED_CHOICES: Record<string, string> = {
  'chen-insurance-offer': 'enroll-insurance',
  'santos-organic-offer': 'enroll-organic',
  'advisor-soil-nitrogen': 'acknowledge',           // organic-compatible (no synthetic fertilizer)
  'advisor-potassium-management': 'note-symptoms',  // organic-compatible (no synthetic potash)
  'catastrophe-rootworm': 'file-rootworm-claim',
  'catastrophe-pollination-failure': 'file-pollination-claim',
  'catastrophe-orchard-disease': 'file-disease-claim',
  'catastrophe-water-emergency': 'file-water-claim',
};

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
            const choices = state.activeEvent.choices;
            // Check for storylet-specific preferred choice
            const preferred = PREFERRED_CHOICES[state.activeEvent.storyletId];
            if (preferred) {
              // Insurance claim choices require the flag — fall back to last choice if unavailable
              const choice = choices.find(c => c.id === preferred);
              if (choice) {
                const req = (choice as { requiresFlag?: string }).requiresFlag;
                if (!req || state.flags[req]) {
                  return [{
                    type: 'RESPOND_EVENT',
                    eventId: state.activeEvent.storyletId,
                    choiceId: choice.id,
                  }];
                }
              }
            }
            // Default: pick the protective option (last choice)
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

      // --- Spring planting (March) ---
      if (month === 3) {
        // Corn/tomato rotation: alternate by year on each row to avoid monoculture penalty.
        // Even years: rows 0,2,4 = corn; rows 1,3 = tomatoes
        // Odd years:  rows 0,2,4 = tomatoes; rows 1,3 = corn
        const useTomatoes = year % 2 === 0;

        if (year <= 4) {
          // Phase 1: Rotation on rows 0-4, sorghum on 5-7
          plantRowIfEmpty(state, cmds, 0, useTomatoes ? 'processing-tomatoes' : 'silage-corn');
          plantRowIfEmpty(state, cmds, 1, useTomatoes ? 'silage-corn' : 'processing-tomatoes');
          plantRowIfEmpty(state, cmds, 2, useTomatoes ? 'processing-tomatoes' : 'silage-corn');
          plantRowIfEmpty(state, cmds, 3, useTomatoes ? 'silage-corn' : 'processing-tomatoes');
          plantRowIfEmpty(state, cmds, 4, useTomatoes ? 'processing-tomatoes' : 'silage-corn');
        } else {
          // Phase 2+: Pistachios on rows 5-6, rotation continues on rows 0-4
          if (!pistachiosPlanted) {
            plantRowIfEmpty(state, cmds, 5, 'pistachios');
            plantRowIfEmpty(state, cmds, 6, 'pistachios');
            pistachiosPlanted = true;
          }

          // Phase 3 (Y10+): Consider citrus if chill hours declining
          if (year >= 10 && !citrusStarted) {
            const yearClimate = scenario.years[Math.min(year - 1, 29)];
            if (yearClimate.chillHours < 650) {
              plantRowIfEmpty(state, cmds, 7, 'citrus-navels');
              citrusStarted = true;
            }
          }

          // Continue corn/tomato rotation on rows 0-4
          plantRowIfEmpty(state, cmds, 0, useTomatoes ? 'processing-tomatoes' : 'silage-corn');
          plantRowIfEmpty(state, cmds, 1, useTomatoes ? 'silage-corn' : 'processing-tomatoes');
          plantRowIfEmpty(state, cmds, 2, useTomatoes ? 'processing-tomatoes' : 'silage-corn');
          plantRowIfEmpty(state, cmds, 3, useTomatoes ? 'silage-corn' : 'processing-tomatoes');
          plantRowIfEmpty(state, cmds, 4, useTomatoes ? 'processing-tomatoes' : 'silage-corn');
        }
      }

      // Sorghum in April (planting window: Apr-Jun) — only in early years before pistachios
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

        // Cover crops on empty cells (Y2+ — same timing as corn bot)
        if (year >= 2) {
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
