/**
 * Scenario Factory Tests — Verify scenario parity, registry, and resolution.
 */

import { describe, it, expect } from 'vitest';
import { SCENARIOS, SCENARIO_IDS, SLICE_1_SCENARIO, resolveScenarioId } from '../../../src/data/scenarios.ts';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Scenario Factory', () => {
  it('produces 5 scenarios', () => {
    expect(SCENARIO_IDS.length).toBe(5);
    expect(Object.keys(SCENARIOS).length).toBe(5);
  });

  it('all scenarios have required fields', () => {
    for (const id of SCENARIO_IDS) {
      const s = SCENARIOS[id];
      expect(s.id).toBe(id);
      expect(s.name).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(s.seed).toBeGreaterThan(0);
      expect(s.years.length).toBe(30);
    }
  });

  it('all scenarios have distinct seeds', () => {
    const seeds = SCENARIO_IDS.map(id => SCENARIOS[id].seed);
    const uniqueSeeds = new Set(seeds);
    expect(uniqueSeeds.size).toBe(5);
  });

  it('all scenarios have valid year data', () => {
    for (const id of SCENARIO_IDS) {
      const s = SCENARIOS[id];
      for (let y = 0; y < 30; y++) {
        const year = s.years[y];
        expect(year.year).toBe(y + 1);
        expect(year.chillHours).toBeGreaterThan(0);
        expect(year.waterAllocation).toBeGreaterThan(0);
        expect(year.waterAllocation).toBeLessThanOrEqual(1);

        for (const season of ['spring', 'summer', 'fall', 'winter'] as const) {
          const p = year.seasons[season];
          expect(p.avgTempHigh).toBeGreaterThan(0);
          expect(p.avgTempLow).toBeGreaterThan(0);
          expect(p.avgET0).toBeGreaterThan(0);
          expect(p.precipProbability).toBeGreaterThanOrEqual(0);
          expect(p.precipProbability).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('gradual-warming has expected scenario IDs', () => {
    expect(SCENARIO_IDS).toContain('gradual-warming');
    expect(SCENARIO_IDS).toContain('early-drought');
    expect(SCENARIO_IDS).toContain('whiplash');
    expect(SCENARIO_IDS).toContain('late-escalation');
    expect(SCENARIO_IDS).toContain('mild-baseline');
  });
});

describe('Gradual Warming Parity', () => {
  it('gradual-warming year data matches frozen fixture', () => {
    const fixturePath = resolve(__dirname, 'fixtures/gradual-warming-snapshot.json');
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8'));
    const generated = SCENARIOS['gradual-warming'];

    // Seed must match
    expect(generated.seed).toBe(fixture.seed);

    // All 30 years must match
    expect(generated.years.length).toBe(fixture.years.length);
    for (let y = 0; y < 30; y++) {
      const f = fixture.years[y];
      const g = generated.years[y];

      expect(g.year).toBe(f.year);
      expect(g.chillHours).toBe(f.chillHours);
      expect(g.waterAllocation).toBeCloseTo(f.waterAllocation, 6);

      for (const season of ['spring', 'summer', 'fall', 'winter'] as const) {
        const fs = f.seasons[season];
        const gs = g.seasons[season];
        for (const key of Object.keys(fs)) {
          expect(gs[key as keyof typeof gs]).toBeCloseTo(fs[key], 6);
        }
      }
    }
  });

  it('SLICE_1_SCENARIO re-export has same seed as gradual-warming', () => {
    expect(SLICE_1_SCENARIO.seed).toBe(SCENARIOS['gradual-warming'].seed);
  });
});

describe('Scenario Differentiation', () => {
  it('early-drought has lower water allocation than gradual-warming', () => {
    const gw = SCENARIOS['gradual-warming'];
    const ed = SCENARIOS['early-drought'];
    expect(ed.years[4].waterAllocation).toBeLessThan(gw.years[4].waterAllocation);
  });

  it('late-escalation has easy early years and hard late years', () => {
    const le = SCENARIOS['late-escalation'];
    // Year 5 should have low heatwave probability
    expect(le.years[4].seasons.summer.heatwaveProbability).toBeLessThan(0.10);
    // Year 20 should have drought conditions (high heatwave prob)
    expect(le.years[19].seasons.summer.heatwaveProbability).toBeGreaterThan(0.30);
  });

  it('mild-baseline has the highest water allocation floor', () => {
    const mb = SCENARIOS['mild-baseline'];
    for (const id of SCENARIO_IDS) {
      if (id === 'mild-baseline') continue;
      expect(mb.years[29].waterAllocation).toBeGreaterThanOrEqual(
        SCENARIOS[id].years[29].waterAllocation,
      );
    }
  });

  it('whiplash has alternating drought/non-drought years', () => {
    const wh = SCENARIOS['whiplash'];
    // Year 2 (drought) vs year 4 (non-drought)
    expect(wh.years[1].seasons.summer.avgET0).toBeGreaterThan(
      wh.years[3].seasons.summer.avgET0,
    );
  });
});

describe('Scenario Resolution', () => {
  it('resolves known scenario IDs directly', () => {
    for (const id of SCENARIO_IDS) {
      const { scenario, fallback } = resolveScenarioId(id);
      expect(scenario.id).toBe(id);
      expect(fallback).toBe(false);
    }
  });

  it('resolves slice-1-baseline alias to gradual-warming', () => {
    const { scenario, fallback } = resolveScenarioId('slice-1-baseline');
    expect(scenario.id).toBe('gradual-warming');
    expect(fallback).toBe(false);
  });

  it('falls back to gradual-warming for unknown scenario ID', () => {
    const { scenario, fallback } = resolveScenarioId('nonexistent-scenario');
    expect(scenario.id).toBe('gradual-warming');
    expect(fallback).toBe(true);
  });

  it('falls back for empty string', () => {
    const { scenario, fallback } = resolveScenarioId('');
    expect(scenario.id).toBe('gradual-warming');
    expect(fallback).toBe(true);
  });
});
