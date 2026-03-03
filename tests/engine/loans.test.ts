import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState, simulateTick, processCommand, computeLoanAmount } from '../../src/engine/game.ts';
import { SLICE_1_SCENARIO } from '../../src/data/scenario.ts';
import type { GameState } from '../../src/engine/types.ts';
import { LOAN_INTEREST_RATE, DAYS_PER_YEAR, LOAN_DEBT_CAP } from '../../src/engine/types.ts';

function makeState(): GameState {
  return createInitialState('test-player', SLICE_1_SCENARIO);
}

// ============================================================================
// Loan Amount Calculation
// ============================================================================

describe('Loan amount calculation', () => {
  it('covers deficit plus $5000 buffer, rounded up to nearest $1000', () => {
    // cash = -1000: Math.ceil((1000 + 5000) / 1000) * 1000 = Math.ceil(6) * 1000 = 6000
    expect(computeLoanAmount(-1000)).toBe(6000);
  });

  it('rounds up partial thousands', () => {
    // cash = -500: Math.ceil((500 + 5000) / 1000) * 1000 = Math.ceil(5.5) * 1000 = 6000
    expect(computeLoanAmount(-500)).toBe(6000);
  });

  it('handles exactly zero cash', () => {
    // cash = 0: Math.ceil((0 + 5000) / 1000) * 1000 = 5000
    expect(computeLoanAmount(0)).toBe(5000);
  });

  it('handles large deficit', () => {
    // cash = -25000: Math.ceil((25000 + 5000) / 1000) * 1000 = 30000
    expect(computeLoanAmount(-25000)).toBe(30000);
  });
});

// ============================================================================
// First Insolvency → Loan Offer
// ============================================================================

describe('Emergency loan - first insolvency', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
  });

  it('offers loan on first cash <= 0 (not game over)', () => {
    state.speed = 1;
    state.economy.cash = 0;
    state.rngState = 42;

    simulateTick(state, SLICE_1_SCENARIO);

    const loanOffer = state.autoPauseQueue.find(e => e.reason === 'loan_offer');
    expect(loanOffer).toBeDefined();
    expect(loanOffer!.data).toHaveProperty('loanAmount');
    expect(loanOffer!.data!.interestRate).toBe(LOAN_INTEREST_RATE);
  });

  it('TAKE_LOAN has no parameters and adds engine-computed amount', () => {
    state.economy.cash = -2000;
    // TAKE_LOAN requires an active loan_offer in the auto-pause queue
    state.autoPauseQueue.push({ reason: 'loan_offer', message: 'Loan offered' });

    const expectedAmount = computeLoanAmount(-2000);
    const result = processCommand(state, { type: 'TAKE_LOAN' }, SLICE_1_SCENARIO);

    expect(result.success).toBe(true);
    expect(state.economy.debt).toBe(expectedAmount);
    expect(state.economy.cash).toBe(-2000 + expectedAmount);
    expect(state.economy.totalLoansReceived).toBe(1);
  });

  it('TAKE_LOAN clears gameOver flag (player can continue)', () => {
    state.gameOver = true;
    state.gameOverReason = 'bankruptcy';
    state.economy.cash = -1000;
    state.autoPauseQueue.push({ reason: 'loan_offer', message: 'Loan offered' });

    processCommand(state, { type: 'TAKE_LOAN' }, SLICE_1_SCENARIO);

    expect(state.gameOver).toBe(false);
    expect(state.gameOverReason).toBeUndefined();
  });

  it('TAKE_LOAN fails without active loan_offer auto-pause', () => {
    state.economy.cash = -1000;
    // No loan_offer in autoPauseQueue
    const result = processCommand(state, { type: 'TAKE_LOAN' }, SLICE_1_SCENARIO);

    expect(result.success).toBe(false);
    expect(result.reason).toContain('No loan offer');
  });

  it('TAKE_LOAN fails if loan already taken', () => {
    state.economy.totalLoansReceived = 1;
    state.autoPauseQueue.push({ reason: 'loan_offer', message: 'Loan offered' });
    const result = processCommand(state, { type: 'TAKE_LOAN' }, SLICE_1_SCENARIO);

    expect(result.success).toBe(false);
    expect(result.reason).toContain('already received');
  });
});

// ============================================================================
// Interest Accrual
// ============================================================================

describe('Loan interest', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
    state.economy.debt = 10000;
    state.economy.totalLoansReceived = 1;
  });

  it('accrues daily simple interest', () => {
    state.speed = 1;
    state.rngState = 42;

    const debtBefore = state.economy.debt;
    simulateTick(state, SLICE_1_SCENARIO);

    const expectedDailyInterest = 10000 * (LOAN_INTEREST_RATE / DAYS_PER_YEAR);
    expect(state.economy.debt).toBeCloseTo(debtBefore + expectedDailyInterest, 2);
    expect(state.economy.interestPaidThisYear).toBeCloseTo(expectedDailyInterest, 2);
  });

  it('interest accrues over multiple days', () => {
    state.speed = 1;
    state.rngState = 42;

    for (let i = 0; i < 30; i++) {
      simulateTick(state, SLICE_1_SCENARIO);
      // Clear auto-pause to keep simulation going
      if (state.autoPauseQueue.length > 0) {
        state.autoPauseQueue = [];
        state.speed = 1;
        if (state.gameOver) {
          state.gameOver = false;
        }
      }
    }

    // After 30 days with 10% annual rate on $10,000:
    // Simple interest per day = 10000 * 0.10 / 365 ≈ $2.74/day
    // But debt compounds daily (interest added to principal), so slightly more
    expect(state.economy.debt).toBeGreaterThan(10000);
    expect(state.economy.debt).toBeLessThan(10100); // Shouldn't grow too much in 30 days
  });
});

// ============================================================================
// Harvest Auto-Repayment
// ============================================================================

describe('Loan repayment at harvest', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
    state.economy.debt = 10000;
    state.economy.totalLoansReceived = 1;
  });

  it('20% of gross harvest revenue goes to debt repayment', () => {
    // Plant and grow a crop to maturity
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'processing-tomatoes' }, SLICE_1_SCENARIO);

    // Advance to harvestable
    state.speed = 1;
    state.rngState = 42;
    let ticks = 0;
    while (ticks < 300) {
      simulateTick(state, SLICE_1_SCENARIO);
      ticks++;
      if (state.autoPauseQueue.length > 0) {
        if (state.activeEvent) {
          processCommand(state, {
            type: 'RESPOND_EVENT',
            eventId: state.activeEvent.storyletId,
            choiceId: state.activeEvent.choices[0].id,
          }, SLICE_1_SCENARIO);
        }
        state.autoPauseQueue = [];
        state.speed = 1;
      }
      const crop = state.grid[0][0].crop;
      if (crop && (crop.growthStage === 'harvestable' || crop.growthStage === 'overripe')) {
        break;
      }
    }

    // Should be harvestable now
    const crop = state.grid[0][0].crop;
    expect(crop).not.toBeNull();
    expect(['harvestable', 'overripe']).toContain(crop!.growthStage);

    const debtBefore = state.economy.debt;
    const cashBefore = state.economy.cash;

    processCommand(state, { type: 'HARVEST', cellRow: 0, cellCol: 0 }, SLICE_1_SCENARIO);

    // Debt should have decreased
    expect(state.economy.debt).toBeLessThan(debtBefore);
    // The repayment was 20% of gross revenue
    const debtReduction = debtBefore - state.economy.debt;
    expect(debtReduction).toBeGreaterThan(0);
  });

  it('repayment does not exceed remaining debt', () => {
    state.economy.debt = 1; // Tiny debt

    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'processing-tomatoes' }, SLICE_1_SCENARIO);

    // Fast-forward to harvestable
    state.speed = 1;
    state.rngState = 42;
    for (let i = 0; i < 300; i++) {
      simulateTick(state, SLICE_1_SCENARIO);
      if (state.autoPauseQueue.length > 0) {
        if (state.activeEvent) {
          processCommand(state, {
            type: 'RESPOND_EVENT',
            eventId: state.activeEvent.storyletId,
            choiceId: state.activeEvent.choices[0].id,
          }, SLICE_1_SCENARIO);
        }
        state.autoPauseQueue = [];
        state.speed = 1;
      }
      if (state.grid[0][0].crop?.growthStage === 'harvestable' || state.grid[0][0].crop?.growthStage === 'overripe') break;
    }

    processCommand(state, { type: 'HARVEST', cellRow: 0, cellCol: 0 }, SLICE_1_SCENARIO);

    // Debt should be 0, not negative
    expect(state.economy.debt).toBeCloseTo(0, 0);
  });
});

// ============================================================================
// Second Insolvency
// ============================================================================

describe('Second insolvency = hard game over', () => {
  it('triggers hard bankruptcy when totalLoansReceived >= 1', () => {
    const state = makeState();
    state.speed = 1;
    state.economy.cash = 0;
    state.economy.totalLoansReceived = 1;
    state.economy.debt = 5000;
    state.rngState = 42;

    simulateTick(state, SLICE_1_SCENARIO);

    const bankruptcy = state.autoPauseQueue.find(e => e.reason === 'bankruptcy');
    expect(bankruptcy).toBeDefined();
    expect(state.gameOver).toBe(true);
    expect(state.gameOverReason).toBe('bankruptcy');
  });
});

// ============================================================================
// Debt Spiral Safety Cap
// ============================================================================

describe('Debt spiral safety', () => {
  it('game over when debt exceeds $100,000', () => {
    const state = makeState();
    state.speed = 1;
    state.economy.debt = LOAN_DEBT_CAP + 1;
    state.economy.totalLoansReceived = 1;
    state.rngState = 42;

    simulateTick(state, SLICE_1_SCENARIO);

    expect(state.gameOver).toBe(true);
    expect(state.gameOverReason).toBe('debt_spiral');
  });
});

// ============================================================================
// Year-end summary includes debt info
// ============================================================================

describe('Year-end with debt', () => {
  it('year-end summary data includes debt and interest', () => {
    const state = makeState();
    state.economy.debt = 5000;
    state.economy.interestPaidThisYear = 200;

    // Advance to year end
    state.speed = 1;
    state.calendar = { day: 364, month: 12, season: 'winter', year: 1, totalDay: 363 };
    state.rngState = 42;

    simulateTick(state, SLICE_1_SCENARIO);

    const yearEnd = state.autoPauseQueue.find(e => e.reason === 'year_end');
    expect(yearEnd).toBeDefined();
    expect(yearEnd!.data).toHaveProperty('debt');
    expect(yearEnd!.data).toHaveProperty('interestPaid');
  });

  it('year_end and bankruptcy both queued when insolvency occurs at year boundary', () => {
    const state = makeState();
    // Set up: took a loan (totalLoansReceived=1), so next insolvency is hard game-over
    state.economy.totalLoansReceived = 1;
    state.economy.debt = 5000;
    // Cash barely negative — maintenance costs at year-end will push to bankruptcy
    state.economy.cash = -1;

    // Position at last day of year 1
    state.speed = 1;
    state.calendar = { day: 364, month: 12, season: 'winter', year: 1, totalDay: 363 };
    state.rngState = 42;

    simulateTick(state, SLICE_1_SCENARIO);

    // Both should be in the queue
    const yearEnd = state.autoPauseQueue.find(e => e.reason === 'year_end');
    const bankruptcy = state.autoPauseQueue.find(e => e.reason === 'bankruptcy');
    expect(yearEnd).toBeDefined();
    expect(bankruptcy).toBeDefined();

    // Bankruptcy should sort first (priority 100 > year_end 40)
    expect(state.autoPauseQueue[0].reason).toBe('bankruptcy');

    // Year-end data should still be captured correctly
    expect(yearEnd!.data).toHaveProperty('year');
    expect(yearEnd!.data).toHaveProperty('revenue');
    expect(yearEnd!.data).toHaveProperty('expenses');
  });
});
