/**
 * Slice 7c Tests — "Consequences" — Soil Crisis + Cover Crop Upgrade + Insurance Exit.
 *
 * §7c.0: modify_organic_matter_all effect type
 * §7c.1: avg_organic_matter_above condition type
 * §7c.2: Cover crop effectiveness upgrade + dynamic notification
 * §7c.3: soil-decline-warning storylet structural
 * §7c.4: soil-exhaustion-crisis storylet structural
 * §7c.5: regime-insurance-exit storylet structural
 * §7c.6: Mutual aid choices on overlapping catastrophes
 * §7c.7: advisor-soil-recovery-praise storylet
 * §7c.8: FLAG_LABELS entries
 * §7c.9: Foreshadow integration for condition-only events
 * §7c.10: Escalation ladder (trajectory → decline → crisis)
 *
 * TDD: these tests are written BEFORE the implementation.
 */

import { describe, it, expect } from 'vitest';
import { createInitialState, incorporateCoverCrops, buildReflectionData } from '../../src/engine/game.ts';
import { evaluateCondition, evaluateEvents } from '../../src/engine/events/selector.ts';
import { applyEffects } from '../../src/engine/events/effects.ts';
import { SLICE_1_SCENARIO } from '../../src/data/scenario.ts';
import { STORYLETS } from '../../src/data/events.ts';
import { SeededRNG } from '../../src/engine/rng.ts';
import { GRID_ROWS, GRID_COLS, OM_FLOOR } from '../../src/engine/types.ts';
import type { GameState } from '../../src/engine/types.ts';
import type { Condition, Effect, Storylet } from '../../src/engine/events/types.ts';

// ============================================================================
// Test Helpers
// ============================================================================

function makeState(): GameState {
  return createInitialState('test-7c', SLICE_1_SCENARIO);
}

function makeRng(seed = 42): SeededRNG {
  return new SeededRNG(seed);
}

function setAllOM(state: GameState, om: number): void {
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      state.grid[r][c].soil.organicMatter = om;
    }
  }
}

function setYear(state: GameState, year: number): void {
  state.calendar.year = year;
  state.calendar.totalDay = 59 + (year - 1) * 365;
}

function getStorylet(id: string): Storylet {
  const s = STORYLETS.find(s => s.id === id);
  if (!s) throw new Error(`Storylet '${id}' not found`);
  return s as Storylet;
}

function getChoice(storylet: Storylet, choiceId: string) {
  const c = storylet.choices.find(c => c.id === choiceId);
  if (!c) throw new Error(`Choice '${choiceId}' not found in '${storylet.id}'`);
  return c;
}

function hasCondition(storylet: Storylet, type: string): boolean {
  return storylet.preconditions.some(p => p.type === type);
}

function avgOM(state: GameState): number {
  let total = 0;
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      total += state.grid[r][c].soil.organicMatter;
    }
  }
  return total / (GRID_ROWS * GRID_COLS);
}

// ============================================================================
// §7c.0: modify_organic_matter_all effect type
// ============================================================================

describe('§7c.0: modify_organic_matter_all effect', () => {
  it('adds OM to all cells', () => {
    const state = makeState();
    setAllOM(state, 1.0);
    applyEffects(state, [
      { type: 'modify_organic_matter_all', amount: 0.15 } as Effect,
    ], 'test');
    expect(avgOM(state)).toBeCloseTo(1.15, 2);
  });

  it('clamps at OM_FLOOR from below', () => {
    const state = makeState();
    setAllOM(state, 0.7);
    applyEffects(state, [
      { type: 'modify_organic_matter_all', amount: -1.0 } as Effect,
    ], 'test');
    expect(avgOM(state)).toBeCloseTo(OM_FLOOR, 2);
  });

  it('handles large positive amounts', () => {
    const state = makeState();
    setAllOM(state, 2.0);
    applyEffects(state, [
      { type: 'modify_organic_matter_all', amount: 0.20 } as Effect,
    ], 'test');
    expect(avgOM(state)).toBeCloseTo(2.20, 2);
  });
});

// ============================================================================
// §7c.1: avg_organic_matter_above condition type
// ============================================================================

describe('§7c.1: avg_organic_matter_above condition', () => {
  it('returns true when avg OM >= threshold', () => {
    const state = makeState();
    setAllOM(state, 2.5);
    const result = evaluateCondition(
      { type: 'avg_organic_matter_above', level: 2.2 } as Condition,
      state,
      makeRng(),
    );
    expect(result).toBe(true);
  });

  it('returns false when avg OM < threshold', () => {
    const state = makeState();
    setAllOM(state, 1.8);
    const result = evaluateCondition(
      { type: 'avg_organic_matter_above', level: 2.2 } as Condition,
      state,
      makeRng(),
    );
    expect(result).toBe(false);
  });

  it('returns true at exact boundary (>=)', () => {
    const state = makeState();
    setAllOM(state, 2.2);
    const result = evaluateCondition(
      { type: 'avg_organic_matter_above', level: 2.2 } as Condition,
      state,
      makeRng(),
    );
    expect(result).toBe(true);
  });
});

// ============================================================================
// §7c.2: Cover crop effectiveness upgrade + dynamic notification
// ============================================================================

describe('§7c.2: Cover crop multiplier', () => {
  it('applies 1.5× OM bonus when tech_advanced_cover_crops flag is set', () => {
    const state = makeState();
    // Plant cover crops on cell [0][0]
    state.grid[0][0].coverCropId = 'legume-cover';
    state.grid[0][0].soil.organicMatter = 1.0;
    state.flags['tech_advanced_cover_crops'] = true;

    incorporateCoverCrops(state);

    // Base bonus = 0.10, eff = 1.0 (no perennial), multiplier = 1.5 → +0.15
    expect(state.grid[0][0].soil.organicMatter).toBeCloseTo(1.15, 2);
  });

  it('applies 1.0× OM bonus without the flag', () => {
    const state = makeState();
    state.grid[0][0].coverCropId = 'legume-cover';
    state.grid[0][0].soil.organicMatter = 1.0;

    incorporateCoverCrops(state);

    // Base bonus = 0.10, no multiplier → +0.10
    expect(state.grid[0][0].soil.organicMatter).toBeCloseTo(1.10, 2);
  });

  it('does NOT multiply nitrogen fixation', () => {
    const state = makeState();
    state.grid[0][0].coverCropId = 'legume-cover';
    state.grid[0][0].soil.nitrogen = 100;
    state.flags['tech_advanced_cover_crops'] = true;

    const beforeN = state.grid[0][0].soil.nitrogen;
    incorporateCoverCrops(state);

    // N fixation should be +50 regardless of flag (not 75)
    expect(state.grid[0][0].soil.nitrogen).toBeCloseTo(beforeN + 50, 0);
  });

  it('does NOT multiply moisture drawdown', () => {
    const state = makeState();
    state.grid[0][0].coverCropId = 'legume-cover';
    state.grid[0][0].soil.moisture = 5.0;
    state.flags['tech_advanced_cover_crops'] = true;

    const beforeM = state.grid[0][0].soil.moisture;
    incorporateCoverCrops(state);

    // Moisture drawdown should be -0.5 regardless of flag (not 0.75)
    expect(state.grid[0][0].soil.moisture).toBeCloseTo(beforeM - 0.5, 2);
  });

  it('notification shows actual OM value with upgrade (0.15%)', () => {
    const state = makeState();
    state.grid[0][0].coverCropId = 'legume-cover';
    state.flags['tech_advanced_cover_crops'] = true;

    incorporateCoverCrops(state);

    const note = state.notifications.find(n => n.message.includes('organic matter'));
    expect(note).toBeDefined();
    expect(note!.message).toContain('+0.15%');
    expect(note!.message).not.toContain('+0.10%');
  });

  it('notification shows base OM value without upgrade (0.10%)', () => {
    const state = makeState();
    state.grid[0][0].coverCropId = 'legume-cover';

    incorporateCoverCrops(state);

    const note = state.notifications.find(n => n.message.includes('organic matter'));
    expect(note).toBeDefined();
    expect(note!.message).toContain('+0.10%');
  });
});

// ============================================================================
// §7c.3: soil-decline-warning storylet structural
// ============================================================================

describe('§7c.3: soil-decline-warning', () => {
  const s = () => getStorylet('soil-decline-warning');

  it('exists in STORYLETS', () => {
    expect(STORYLETS.find(s => s.id === 'soil-decline-warning')).toBeDefined();
  });

  it('is type advisor with extension-agent', () => {
    expect(s().type).toBe('advisor');
    expect(s().advisorId).toBe('extension-agent');
  });

  it('is condition-only (no random precondition)', () => {
    expect(hasCondition(s(), 'random')).toBe(false);
  });

  it('requires avg_organic_matter_below 1.3 and min_year 10', () => {
    const omCond = s().preconditions.find(p => p.type === 'avg_organic_matter_below');
    expect(omCond).toBeDefined();
    expect((omCond as { level: number }).level).toBe(1.3);
    const yearCond = s().preconditions.find(p => p.type === 'min_year');
    expect(yearCond).toBeDefined();
    expect((yearCond as { year: number }).year).toBe(10);
  });

  it('has priority 95 and maxOccurrences 1', () => {
    expect(s().priority).toBe(95);
    expect(s().maxOccurrences).toBe(1);
  });

  it('has foreshadowing with 60 days and reliability 1.0', () => {
    expect(s().foreshadowing).toBeDefined();
    expect(s().foreshadowing!.daysBeforeEvent).toBe(60);
    expect(s().foreshadowing!.reliability).toBe(1.0);
  });

  it('has 3 choices', () => {
    expect(s().choices).toHaveLength(3);
  });

  it('invest-cover-upgrade costs $800 and sets tech_advanced_cover_crops', () => {
    const c = getChoice(s(), 'invest-cover-upgrade');
    expect(c.cost).toBe(800);
    expect(c.effects).toContainEqual({ type: 'modify_cash', amount: -800 });
    expect(c.effects).toContainEqual({ type: 'set_flag', flag: 'tech_advanced_cover_crops', value: true });
  });

  it('invest-cover-upgrade applies nitrogen boost', () => {
    const c = getChoice(s(), 'invest-cover-upgrade');
    expect(c.effects).toContainEqual({ type: 'modify_nitrogen_all', amount: 30 });
  });

  it('emergency-compost costs $1500 and applies modify_organic_matter_all', () => {
    const c = getChoice(s(), 'emergency-compost');
    expect(c.cost).toBe(1500);
    expect(c.effects).toContainEqual({ type: 'modify_cash', amount: -1500 });
    expect(c.effects).toContainEqual({ type: 'modify_organic_matter_all', amount: 0.15 });
  });

  it('manage-soil-decline is free with notification only', () => {
    const c = getChoice(s(), 'manage-soil-decline');
    expect(c.cost).toBeUndefined();
    const hasModifyCash = c.effects.some(e => e.type === 'modify_cash');
    expect(hasModifyCash).toBe(false);
  });

  it('has illustrationId', () => {
    expect(s().illustrationId).toBe('event-soil-exhaustion');
  });
});

// ============================================================================
// §7c.4: soil-exhaustion-crisis storylet structural
// ============================================================================

describe('§7c.4: soil-exhaustion-crisis', () => {
  const s = () => getStorylet('soil-exhaustion-crisis');

  it('exists in STORYLETS', () => {
    expect(STORYLETS.find(s => s.id === 'soil-exhaustion-crisis')).toBeDefined();
  });

  it('is type climate with no advisorId', () => {
    expect(s().type).toBe('climate');
    expect(s().advisorId).toBeUndefined();
  });

  it('is condition-only (no random precondition)', () => {
    expect(hasCondition(s(), 'random')).toBe(false);
  });

  it('requires avg_organic_matter_below 1.0 and min_year 15', () => {
    const omCond = s().preconditions.find(p => p.type === 'avg_organic_matter_below');
    expect(omCond).toBeDefined();
    expect((omCond as { level: number }).level).toBe(1.0);
    const yearCond = s().preconditions.find(p => p.type === 'min_year');
    expect(yearCond).toBeDefined();
    expect((yearCond as { year: number }).year).toBe(15);
  });

  it('has priority 100 and maxOccurrences 1', () => {
    expect(s().priority).toBe(100);
    expect(s().maxOccurrences).toBe(1);
  });

  it('has foreshadowing with 30 days and reliability 1.0', () => {
    expect(s().foreshadowing).toBeDefined();
    expect(s().foreshadowing!.daysBeforeEvent).toBe(30);
    expect(s().foreshadowing!.reliability).toBe(1.0);
  });

  it('has 2 choices', () => {
    expect(s().choices).toHaveLength(2);
  });

  it('intensive-remediation costs $2500 with 90-day yield penalty and OM boost', () => {
    const c = getChoice(s(), 'intensive-remediation');
    expect(c.cost).toBe(2500);
    expect(c.effects).toContainEqual({ type: 'modify_cash', amount: -2500 });
    const yieldMod = c.effects.find(e => e.type === 'modify_yield_modifier');
    expect(yieldMod).toBeDefined();
    expect((yieldMod as { cropId: string; multiplier: number; durationDays: number }).cropId).toBe('*');
    expect((yieldMod as { multiplier: number }).multiplier).toBe(0.60);
    expect((yieldMod as { durationDays: number }).durationDays).toBe(90);
    expect(c.effects).toContainEqual({ type: 'modify_organic_matter_all', amount: 0.20 });
  });

  it('accept-soil-exhaustion is free with 180-day yield penalty', () => {
    const c = getChoice(s(), 'accept-soil-exhaustion');
    expect(c.cost).toBeUndefined();
    const yieldMod = c.effects.find(e => e.type === 'modify_yield_modifier');
    expect(yieldMod).toBeDefined();
    expect((yieldMod as { cropId: string }).cropId).toBe('*');
    expect((yieldMod as { multiplier: number }).multiplier).toBe(0.60);
    expect((yieldMod as { durationDays: number }).durationDays).toBe(180);
  });

  it('has illustrationId', () => {
    expect(s().illustrationId).toBe('event-soil-exhaustion');
  });
});

// ============================================================================
// §7c.5: regime-insurance-exit storylet structural
// ============================================================================

describe('§7c.5: regime-insurance-exit', () => {
  const s = () => getStorylet('regime-insurance-exit');

  it('exists in STORYLETS', () => {
    expect(STORYLETS.find(s => s.id === 'regime-insurance-exit')).toBeDefined();
  });

  it('is type market with priority 100', () => {
    expect(s().type).toBe('market');
    expect(s().priority).toBe(100);
  });

  it('is condition-only (no random precondition)', () => {
    expect(hasCondition(s(), 'random')).toBe(false);
  });

  it('requires min_year 22, max_year 27, has insurance, not already exited', () => {
    expect(s().preconditions).toContainEqual({ type: 'min_year', year: 22 });
    expect(s().preconditions).toContainEqual({ type: 'max_year', year: 27 });
    expect(s().preconditions).toContainEqual({ type: 'has_flag', flag: 'has_crop_insurance' });
    expect(s().preconditions).toContainEqual({ type: 'not_has_flag', flag: 'regime_insurance_exit' });
  });

  it('has maxOccurrences 1', () => {
    expect(s().maxOccurrences).toBe(1);
  });

  it('has foreshadowing with 90 days and reliability 1.0', () => {
    expect(s().foreshadowing).toBeDefined();
    expect(s().foreshadowing!.daysBeforeEvent).toBe(90);
    expect(s().foreshadowing!.reliability).toBe(1.0);
  });

  it('has 3 choices', () => {
    expect(s().choices).toHaveLength(3);
  });

  it('all choices remove has_crop_insurance and set regime_insurance_exit', () => {
    for (const choice of s().choices) {
      expect(choice.effects).toContainEqual({ type: 'set_flag', flag: 'has_crop_insurance', value: false });
      expect(choice.effects).toContainEqual({ type: 'set_flag', flag: 'regime_insurance_exit', value: true });
    }
  });

  it('join-mutual-aid costs $800 and sets mutual_aid flag', () => {
    const c = getChoice(s(), 'join-mutual-aid');
    expect(c.cost).toBe(800);
    expect(c.effects).toContainEqual({ type: 'modify_cash', amount: -800 });
    expect(c.effects).toContainEqual({ type: 'set_flag', flag: 'mutual_aid', value: true });
  });

  it('self-insure-exit is free', () => {
    const c = getChoice(s(), 'self-insure-exit');
    const hasModifyCash = c.effects.some(e => e.type === 'modify_cash');
    expect(hasModifyCash).toBe(false);
  });

  it('accept-risk-exit is free', () => {
    const c = getChoice(s(), 'accept-risk-exit');
    const hasModifyCash = c.effects.some(e => e.type === 'modify_cash');
    expect(hasModifyCash).toBe(false);
  });
});

// ============================================================================
// §7c.6: Mutual aid choices on overlapping catastrophe events
// ============================================================================

describe('§7c.6: Mutual aid choices', () => {
  const OVERLAPPING_CATASTROPHES = [
    'catastrophe-pollination-failure',
    'catastrophe-orchard-disease',
  ];

  for (const id of OVERLAPPING_CATASTROPHES) {
    describe(id, () => {
      it('has a choice with requiresFlag mutual_aid', () => {
        const s = getStorylet(id);
        const mutualAidChoice = s.choices.find(c => c.requiresFlag === 'mutual_aid');
        expect(mutualAidChoice).toBeDefined();
      });

      it('mutual aid payout is less than insurance payout', () => {
        const s = getStorylet(id);
        const insuranceChoice = s.choices.find(c => c.requiresFlag === 'has_crop_insurance');
        const mutualAidChoice = s.choices.find(c => c.requiresFlag === 'mutual_aid');
        expect(insuranceChoice).toBeDefined();
        expect(mutualAidChoice).toBeDefined();

        const insurancePayout = insuranceChoice!.effects
          .filter(e => e.type === 'insurance_payout')
          .reduce((sum, e) => sum + (e as { amount: number }).amount, 0);
        const mutualAidPayout = mutualAidChoice!.effects
          .filter(e => e.type === 'insurance_payout')
          .reduce((sum, e) => sum + (e as { amount: number }).amount, 0);

        expect(mutualAidPayout).toBeLessThan(insurancePayout);
        expect(mutualAidPayout).toBeGreaterThan(0);
      });

      it('mutual aid choice has followUpText', () => {
        const s = getStorylet(id);
        const mutualAidChoice = s.choices.find(c => c.requiresFlag === 'mutual_aid');
        expect(mutualAidChoice!.followUpText).toBeDefined();
        expect(mutualAidChoice!.followUpText!.length).toBeGreaterThan(50);
      });
    });
  }

  it('non-overlapping catastrophes do NOT have mutual aid choices', () => {
    const NON_OVERLAPPING = ['catastrophe-rootworm', 'catastrophe-water-emergency'];
    for (const id of NON_OVERLAPPING) {
      const s = getStorylet(id);
      const mutualAidChoice = s.choices.find(c => c.requiresFlag === 'mutual_aid');
      expect(mutualAidChoice).toBeUndefined();
    }
  });
});

// ============================================================================
// §7c.7: advisor-soil-recovery-praise storylet
// ============================================================================

describe('§7c.7: advisor-soil-recovery-praise', () => {
  const s = () => getStorylet('advisor-soil-recovery-praise');

  it('exists in STORYLETS', () => {
    expect(STORYLETS.find(s => s.id === 'advisor-soil-recovery-praise')).toBeDefined();
  });

  it('is type advisor with extension-agent', () => {
    expect(s().type).toBe('advisor');
    expect(s().advisorId).toBe('extension-agent');
  });

  it('is condition-only (no random)', () => {
    expect(hasCondition(s(), 'random')).toBe(false);
  });

  it('requires min_year 12, avg_organic_matter_above 2.2, and tech flag', () => {
    const omCond = s().preconditions.find(p => p.type === 'avg_organic_matter_above');
    expect(omCond).toBeDefined();
    expect((omCond as { level: number }).level).toBe(2.2);
    expect(s().preconditions).toContainEqual({ type: 'min_year', year: 12 });
    expect(s().preconditions).toContainEqual({ type: 'has_flag', flag: 'tech_advanced_cover_crops' });
  });

  it('has maxOccurrences 1 and priority 75', () => {
    expect(s().maxOccurrences).toBe(1);
    expect(s().priority).toBe(75);
  });

  it('sets santos_praised_soil_recovery flag', () => {
    const allEffects = s().choices.flatMap(c => c.effects);
    const flagEffect = allEffects.find(e =>
      e.type === 'set_flag' && (e as { flag: string }).flag === 'santos_praised_soil_recovery',
    );
    expect(flagEffect).toBeDefined();
  });

  it('has illustrationId event-cover-crops', () => {
    expect(s().illustrationId).toBe('event-cover-crops');
  });
});

// ============================================================================
// §7c.8: FLAG_LABELS entries
// ============================================================================

describe('§7c.8: FLAG_LABELS', () => {
  // FLAG_LABELS is a private const, but buildReflectionData uses it.
  // We test indirectly by checking reflection data includes the flags.
  it('tech_advanced_cover_crops appears in reflection decisions', () => {
    const state = makeState();
    state.flags['tech_advanced_cover_crops'] = true;
    const reflection = buildReflectionData(state);
    expect(reflection.decisions.some((d: { flag: string }) => d.flag === 'tech_advanced_cover_crops')).toBe(true);
  });

  it('regime_insurance_exit appears in reflection decisions', () => {
    const state = makeState();
    state.flags['regime_insurance_exit'] = true;
    const reflection = buildReflectionData(state);
    expect(reflection.decisions.some((d: { flag: string }) => d.flag === 'regime_insurance_exit')).toBe(true);
  });

  it('mutual_aid appears in reflection decisions', () => {
    const state = makeState();
    state.flags['mutual_aid'] = true;
    const reflection = buildReflectionData(state);
    expect(reflection.decisions.some((d: { flag: string }) => d.flag === 'mutual_aid')).toBe(true);
  });
});

// ============================================================================
// §7c.9: Foreshadow integration for condition-only events
// ============================================================================

describe('§7c.9: Condition-only event with foreshadowing', () => {
  it('creates foreshadow first, then fires event after delay', () => {
    const state = makeState();
    setYear(state, 10);
    setAllOM(state, 1.2); // Below 1.3 threshold for soil-decline-warning
    state.calendar.season = 'summer';

    const rng = makeRng();

    // First evaluation: should create a foreshadow, NOT fire
    const result1 = evaluateEvents(state, STORYLETS as unknown as Storylet[], rng, { conditionOnlyAdvisors: true });

    // Check that a foreshadow was created for soil-decline-warning
    const foreshadow = result1.newForeshadows.find(f => f.storyletId === 'soil-decline-warning');
    expect(foreshadow).toBeDefined();
    expect(foreshadow!.isFalseAlarm).toBe(false); // reliability 1.0

    // The event should NOT fire on this tick (it goes through foreshadow first)
    if (result1.fireEvent) {
      expect(result1.fireEvent.id).not.toBe('soil-decline-warning');
    }
  });

  it('foreshadow matures after daysBeforeEvent ticks', () => {
    const state = makeState();
    setYear(state, 10);
    setAllOM(state, 1.2);
    state.calendar.season = 'summer';

    // Add a mature foreshadow (as if 60 days have passed)
    state.pendingForeshadows.push({
      storyletId: 'soil-decline-warning',
      signal: 'test signal',
      appearsOnDay: state.calendar.totalDay - 60,
      eventFiresOnDay: state.calendar.totalDay, // Fires NOW
      isFalseAlarm: false,
      advisorSource: 'extension-agent',
      dismissed: false,
    });

    const rng = makeRng();
    const result = evaluateEvents(state, STORYLETS as unknown as Storylet[], rng, { conditionOnlyAdvisors: true });

    // The foreshadowed event should fire now
    expect(result.fireEvent).toBeDefined();
    expect(result.fireEvent!.id).toBe('soil-decline-warning');
  });
});

// ============================================================================
// §7c.10: Escalation ladder
// ============================================================================

describe('§7c.10: Escalation ladder', () => {
  it('advisor-soil-trajectory fires at OM < 1.5 (from 7b)', () => {
    const s = getStorylet('advisor-soil-trajectory');
    const omCond = s.preconditions.find(p => p.type === 'avg_organic_matter_below');
    expect(omCond).toBeDefined();
    expect((omCond as { level: number }).level).toBe(1.5);
  });

  it('soil-decline-warning fires at OM < 1.3 (stricter threshold)', () => {
    const s = getStorylet('soil-decline-warning');
    const omCond = s.preconditions.find(p => p.type === 'avg_organic_matter_below');
    expect((omCond as { level: number }).level).toBe(1.3);
  });

  it('soil-exhaustion-crisis fires at OM < 1.0 (most severe)', () => {
    const s = getStorylet('soil-exhaustion-crisis');
    const omCond = s.preconditions.find(p => p.type === 'avg_organic_matter_below');
    expect((omCond as { level: number }).level).toBe(1.0);
  });

  it('all three have maxOccurrences 1 (each exhausts before escalation)', () => {
    expect(getStorylet('advisor-soil-trajectory').maxOccurrences).toBe(1);
    expect(getStorylet('soil-decline-warning').maxOccurrences).toBe(1);
    expect(getStorylet('soil-exhaustion-crisis').maxOccurrences).toBe(1);
  });

  it('crisis has higher priority than decline-warning (dominates when both conditions met)', () => {
    const crisis = getStorylet('soil-exhaustion-crisis');
    const warning = getStorylet('soil-decline-warning');
    expect(crisis.priority).toBeGreaterThan(warning.priority);
  });
});
