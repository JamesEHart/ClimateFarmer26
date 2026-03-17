/**
 * Slice 8a Tests — Engine-level speed command contract
 *
 * These tests verify SET_SPEED command behavior and the "always resume at 1x"
 * contract that togglePlayPause() relies on. The actual adapter function and
 * tick rate (BASE_TICKS_PER_SECOND) are tested via Playwright browser tests.
 */

import { describe, it, expect } from 'vitest';
import { createInitialState, processCommand } from '../../src/engine/game.ts';
import { SLICE_1_SCENARIO } from '../../src/data/scenario.ts';
import type { GameState } from '../../src/engine/types.ts';

function makeState(): GameState {
  return createInitialState('test-8a', SLICE_1_SCENARIO);
}

describe('Slice 8a — Speed Controls', () => {
  it('game starts paused (speed=0)', () => {
    const state = makeState();
    expect(state.speed).toBe(0);
  });

  it('SET_SPEED to 1 resumes at 1x', () => {
    const state = makeState();
    processCommand(state, { type: 'SET_SPEED', speed: 1 });
    expect(state.speed).toBe(1);
  });

  it('SET_SPEED to 2 sets 2x', () => {
    const state = makeState();
    processCommand(state, { type: 'SET_SPEED', speed: 2 });
    expect(state.speed).toBe(2);
  });

  it('SET_SPEED to 4 sets 4x', () => {
    const state = makeState();
    processCommand(state, { type: 'SET_SPEED', speed: 4 });
    expect(state.speed).toBe(4);
  });

  it('SET_SPEED to 0 pauses from any speed', () => {
    const state = makeState();
    processCommand(state, { type: 'SET_SPEED', speed: 4 });
    expect(state.speed).toBe(4);
    processCommand(state, { type: 'SET_SPEED', speed: 0 });
    expect(state.speed).toBe(0);
  });

  it('toggle contract: pause from 4x then resume goes to 1x (not 4x)', () => {
    // This tests the behavioral contract that togglePlayPause() implements:
    // pausing from any speed and resuming always gives speed=1
    const state = makeState();
    processCommand(state, { type: 'SET_SPEED', speed: 4 });
    expect(state.speed).toBe(4);
    // Simulate toggle pause
    processCommand(state, { type: 'SET_SPEED', speed: 0 });
    expect(state.speed).toBe(0);
    // Simulate toggle resume — always 1x, not remembered 4x
    processCommand(state, { type: 'SET_SPEED', speed: 1 });
    expect(state.speed).toBe(1);
  });

  it('toggle contract: pause from 2x then resume goes to 1x (not 2x)', () => {
    const state = makeState();
    processCommand(state, { type: 'SET_SPEED', speed: 2 });
    processCommand(state, { type: 'SET_SPEED', speed: 0 });
    processCommand(state, { type: 'SET_SPEED', speed: 1 });
    expect(state.speed).toBe(1);
  });
});
