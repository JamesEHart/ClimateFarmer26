/**
 * Slice 7a Tests — "See Why" transparency pass.
 *
 * 7a.1: Harvest yield-factor breakdown (#97, #100)
 * 7a.2: Advisor followUpText audit (#92 mop-up)
 * 7a.3: Scenario name de-spoilering
 *
 * TDD: these tests are written BEFORE the implementation.
 */

import { describe, it, expect } from 'vitest';
import { createInitialState, harvestCell, processCommand } from '../../src/engine/game.ts';
import { computeScore } from '../../src/engine/scoring.ts';
import { SLICE_1_SCENARIO } from '../../src/data/scenario.ts';
import { getCropDefinition } from '../../src/data/crops.ts';
import { STORYLETS } from '../../src/data/events.ts';
import { SCENARIOS } from '../../src/data/scenarios.ts';
import type { GameState, Cell } from '../../src/engine/types.ts';

// ============================================================================
// Test Helpers
// ============================================================================

function makeState(): GameState {
  return createInitialState('test-7a', SLICE_1_SCENARIO);
}

/** Set up a harvestable corn crop on a cell. */
function setupHarvestableCorn(cell: Cell): void {
  const cornDef = getCropDefinition('silage-corn');
  cell.crop = {
    cropId: 'silage-corn',
    plantedDay: 59,
    growthStage: 'harvestable',
    gddAccumulated: cornDef.gddToMaturity,
    waterStressDays: 0,
    overripeDaysRemaining: -1,
    isPerennial: false,
  };
}

/** Get the most recent harvest notification message from state. */
function lastHarvestNotification(state: GameState): string | undefined {
  const harvests = state.notifications.filter(n => n.type === 'harvest');
  return harvests.length > 0 ? harvests[harvests.length - 1].message : undefined;
}

// ============================================================================
// §7a.1: Harvest Yield-Factor Breakdown
// ============================================================================

describe('§7a.1: Harvest notification includes yield-factor explanations', () => {
  it('shows OM penalty when soil organic matter is low', () => {
    const state = makeState();
    const cell = state.grid[0][0];
    setupHarvestableCorn(cell);
    cell.soil.organicMatter = 1.0; // ~27% penalty
    cell.soil.nitrogen = 200;

    harvestCell(state, cell);

    const msg = lastHarvestNotification(state);
    expect(msg).toBeDefined();
    expect(msg).toContain('low soil organic matter');
  });

  it('shows monoculture penalty when streak is active', () => {
    const state = makeState();
    const cell = state.grid[0][0];
    setupHarvestableCorn(cell);
    cell.soil.nitrogen = 200;
    cell.soil.organicMatter = 2.0;
    cell.lastCropId = 'silage-corn';
    cell.consecutiveSameCropCount = 2; // 3rd consecutive → 0.70 factor

    harvestCell(state, cell);

    const msg = lastHarvestNotification(state);
    expect(msg).toBeDefined();
    expect(msg).toContain('monoculture penalty');
  });

  it('shows water stress when waterStressDays is high', () => {
    const state = makeState();
    const cell = state.grid[0][0];
    setupHarvestableCorn(cell);
    cell.soil.nitrogen = 200;
    cell.soil.organicMatter = 2.0;
    cell.crop!.waterStressDays = 40; // significant stress
    // totalGrowingDays = totalDay - plantedDay; set totalDay high enough
    state.calendar.totalDay = 200; // 141 growing days, 40 stress = ~28% for ky~1.0

    harvestCell(state, cell);

    const msg = lastHarvestNotification(state);
    expect(msg).toBeDefined();
    expect(msg).toContain('water stress');
  });

  it('shows at most 2 yield factors even when 3+ apply', () => {
    const state = makeState();
    const cell = state.grid[0][0];
    setupHarvestableCorn(cell);
    cell.soil.organicMatter = 1.0;  // OM penalty
    cell.soil.nitrogen = 20;        // N penalty
    cell.lastCropId = 'silage-corn';
    cell.consecutiveSameCropCount = 2; // monoculture penalty

    harvestCell(state, cell);

    const msg = lastHarvestNotification(state)!;
    // Count occurrences of percentage patterns like (-XX%)
    const factorMatches = msg.match(/\(-\d+%\)/g) || [];
    expect(factorMatches.length).toBeLessThanOrEqual(2);
  });

  it('does not show factor text for a healthy harvest', () => {
    const state = makeState();
    const cell = state.grid[0][0];
    setupHarvestableCorn(cell);
    cell.soil.nitrogen = 200;
    cell.soil.organicMatter = 2.0;

    harvestCell(state, cell);

    const msg = lastHarvestNotification(state)!;
    expect(msg).not.toContain('Yield reduced by');
  });

  it('shows net-loss warning when labor exceeds crop value', () => {
    const state = makeState();
    const cell = state.grid[0][0];
    setupHarvestableCorn(cell);
    cell.soil.organicMatter = 0.5; // floor → 0.40× yield
    cell.soil.nitrogen = 5;        // very low → tiny N factor
    cell.crop!.waterStressDays = 60;
    state.calendar.totalDay = 200;

    harvestCell(state, cell);

    const msg = lastHarvestNotification(state)!;
    // With stacked penalties, gross revenue should be near zero while labor remains constant
    // If grossRevenue < laborCost, we expect the warning
    const grossMatch = msg.match(/= \$(\d+)/);
    const laborCost = getCropDefinition('silage-corn').laborCostPerAcre;
    if (grossMatch && parseInt(grossMatch[1]) < laborCost) {
      expect(msg).toContain('costs');
      expect(msg).toContain('exceeded');
    }
  });

  it('does not include chill factor in the yield breakdown (has its own notification)', () => {
    const state = makeState();
    const cell = state.grid[0][0];
    // Set up almond with chill deficit
    const almondDef = getCropDefinition('almonds');
    cell.crop = {
      cropId: 'almonds',
      plantedDay: 59,
      growthStage: 'harvestable',
      gddAccumulated: almondDef.gddToMaturity,
      waterStressDays: 0,
      overripeDaysRemaining: -1,
      isPerennial: true,
      perennialEstablished: true,
      perennialAge: 5,
      chillHoursAccumulated: 200, // deficit — almonds need ~400
    };
    cell.soil.nitrogen = 200;
    cell.soil.organicMatter = 2.0;

    harvestCell(state, cell);

    const msg = lastHarvestNotification(state)!;
    // Chill deficit should NOT appear in the yield-factor breakdown
    // (it gets its own separate detailed notification)
    expect(msg).not.toContain('chill');
    // But the separate chill notification should exist
    const chillNotif = state.notifications.find(n => n.message.includes('chill hours'));
    expect(chillNotif).toBeDefined();
  });
});

// ============================================================================
// §7a.2: Advisor followUpText Audit
// ============================================================================

describe('§7a.2: Advisor "engage" choices have followUpText', () => {
  /**
   * Explicit allowlist of choice IDs that represent "tell me more" / "engage"
   * choices on advisor and community storylets. These are moments where a student
   * voluntarily asks for information — the response must appear center-screen
   * via the pendingFollowUp modal, not buried in a notification toast.
   *
   * Decline/dismiss choices (e.g., 'not-now', 'thanks-noted') are intentionally
   * excluded — they should stay lightweight.
   */
  const ENGAGE_CHOICE_IDS = [
    // Santos advisors
    'buy-fertilizer',       // advisor-soil-nitrogen
    'acknowledge',          // advisor-soil-nitrogen
    'diversify-advice',     // advisor-crop-failure
    'water-advice',         // advisor-crop-failure
    'review-chill-data',    // advisor-chill-warning
    'plan-adaptation',      // advisor-chill-warning
    'cost-cutting',         // advisor-drought-recovery
    'low-cost-crops',       // advisor-drought-recovery
    'learn-perennials',     // advisor-perennial-opportunity
    'apply-potash',         // advisor-potassium-management
    'note-symptoms',        // advisor-potassium-management
    // Chen advisors
    'welcome-review',       // advisor-chen-intro
    'enroll-insurance',     // chen-insurance-offer
    // Forum engage choices
    'attend-meeting',       // growers-forum-intro
    'ask-details',          // forum-rotation-tip
    'thats-concerning',     // forum-neighbor-corn-died
    'what-did-you-hear',    // forum-water-restriction-rumors
    'tell-me-more',         // forum-market-dominance
    'what-are-you-seeing',  // forum-climate-trends
    'insurance-smart',      // forum-insurance-debate
    'whats-involved',       // forum-organic-transition
    'diversification-helps', // forum-diversification-debate
  ];

  for (const choiceId of ENGAGE_CHOICE_IDS) {
    it(`choice "${choiceId}" has followUpText`, () => {
      let found = false;
      for (const storylet of STORYLETS) {
        const choice = storylet.choices.find(c => c.id === choiceId);
        if (choice) {
          expect(choice.followUpText, `Choice "${choiceId}" in storylet "${storylet.id}" is missing followUpText`).toBeTruthy();
          found = true;
          break;
        }
      }
      expect(found, `Choice "${choiceId}" not found in any storylet`).toBe(true);
    });
  }
});

// ============================================================================
// §7a.3: Scenario Name De-spoilering
// ============================================================================

describe('§7a.3: Scenario names do not spoil difficulty', () => {
  const allScenarios = Object.values(SCENARIOS);

  it('no scenario is named "Mild Conditions"', () => {
    for (const scenario of allScenarios) {
      expect(scenario.name).not.toBe('Mild Conditions');
    }
  });

  it('no scenario is named "Late Escalation"', () => {
    for (const scenario of allScenarios) {
      expect(scenario.name).not.toBe('Late Escalation');
    }
  });

  it('all scenarios have non-empty names', () => {
    for (const scenario of allScenarios) {
      expect(scenario.name.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// §7a.1b: Bulk harvest also shows yield-factor breakdown
// ============================================================================

describe('§7a.1b: Bulk harvest notifications include yield-factor explanations', () => {
  it('bulk harvest notification includes yield penalties when soil OM is low', () => {
    const state = makeState();
    // Plant corn on multiple cells with low OM
    for (let c = 0; c < 4; c++) {
      const cell = state.grid[0][c];
      setupHarvestableCorn(cell);
      cell.soil.organicMatter = 1.0; // ~27% penalty
      cell.soil.nitrogen = 200;
    }

    processCommand(state, { type: 'HARVEST_BULK', scope: 'row', index: 0 });

    const harvestNotifs = state.notifications.filter(n => n.type === 'harvest');
    expect(harvestNotifs.length).toBeGreaterThan(0);
    const msg = harvestNotifs[harvestNotifs.length - 1].message;
    expect(msg).toContain('low soil organic matter');
  });

  it('bulk harvest notification includes monoculture penalty', () => {
    const state = makeState();
    for (let c = 0; c < 4; c++) {
      const cell = state.grid[0][c];
      setupHarvestableCorn(cell);
      cell.soil.nitrogen = 200;
      cell.soil.organicMatter = 2.0;
      cell.lastCropId = 'silage-corn';
      cell.consecutiveSameCropCount = 2; // 3rd → 30% penalty
    }

    processCommand(state, { type: 'HARVEST_BULK', scope: 'row', index: 0 });

    const harvestNotifs = state.notifications.filter(n => n.type === 'harvest');
    const msg = harvestNotifs[harvestNotifs.length - 1].message;
    expect(msg).toContain('monoculture penalty');
  });

  it('bulk harvest does not show factor text when harvest is healthy', () => {
    const state = makeState();
    for (let c = 0; c < 4; c++) {
      const cell = state.grid[0][c];
      setupHarvestableCorn(cell);
      cell.soil.nitrogen = 200;
      cell.soil.organicMatter = 2.0;
    }

    processCommand(state, { type: 'HARVEST_BULK', scope: 'row', index: 0 });

    const harvestNotifs = state.notifications.filter(n => n.type === 'harvest');
    const msg = harvestNotifs[harvestNotifs.length - 1].message;
    expect(msg).not.toContain('Yield reduced by');
  });
});

// ============================================================================
// §7a.4: yearsSurvived off-by-one fix
// ============================================================================

describe('§7a.4: yearsSurvived is clamped to 30', () => {
  it('computeScore returns yearsSurvived=30 when calendar.year is 31 (year-30 endgame)', () => {
    const state = makeState();
    state.calendar.year = 31; // year-end tick increments past 30
    state.calendar.totalDay = 30 * 365 + 59;
    const score = computeScore(state);
    expect(score.yearsSurvived).toBe(30);
  });

  it('computeScore returns actual year for early bankruptcy', () => {
    const state = makeState();
    state.calendar.year = 15;
    state.calendar.totalDay = 14 * 365 + 59;
    const score = computeScore(state);
    expect(score.yearsSurvived).toBe(15);
  });
});
