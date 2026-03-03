// ============================================================================
// Event Selector — ClimateFarmer26 Slice 2a
// Evaluates storylet preconditions, selects events, manages foreshadowing.
// ============================================================================

import type { GameState, ClimateScenario } from '../types.ts';
import type { Storylet, Condition, PendingForeshadow, ScheduledEvent } from './types.ts';
import { SeededRNG } from '../rng.ts';
import { GRID_ROWS, GRID_COLS } from '../types.ts';
import { getCropDefinition } from '../../data/crops.ts';

export interface EvaluateEventsResult {
  fireEvent: Storylet | null;
  newForeshadows: PendingForeshadow[];
}

/**
 * Evaluate a single condition against the current game state.
 * For `random` conditions, consumes one value from the event RNG.
 */
export function evaluateCondition(
  condition: Condition,
  state: GameState,
  rng: SeededRNG,
): boolean {
  switch (condition.type) {
    case 'min_year':
      return state.calendar.year >= condition.year;
    case 'max_year':
      return state.calendar.year <= condition.year;
    case 'season':
      return state.calendar.season === condition.season;
    case 'season_not':
      return state.calendar.season !== condition.season;
    case 'cash_below':
      return state.economy.cash < condition.amount;
    case 'cash_above':
      return state.economy.cash > condition.amount;
    case 'has_crop': {
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const crop = state.grid[r][c].crop;
          if (crop) {
            if (!condition.cropId || crop.cropId === condition.cropId) return true;
          }
        }
      }
      return false;
    }
    case 'avg_nitrogen_below': {
      let totalN = 0;
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          totalN += state.grid[r][c].soil.nitrogen;
        }
      }
      return (totalN / (GRID_ROWS * GRID_COLS)) < condition.level;
    }
    case 'any_perennial_planted': {
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const crop = state.grid[r][c].crop;
          if (crop && crop.isPerennial) return true;
        }
      }
      return false;
    }
    case 'no_perennial_planted': {
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const crop = state.grid[r][c].crop;
          if (crop && crop.isPerennial) return false;
        }
      }
      return true;
    }
    case 'consecutive_crop_failures':
      return state.cropFailureStreak >= condition.count;
    case 'no_debt':
      return state.economy.debt === 0;
    case 'has_flag':
      return state.flags[condition.flag] === true;
    case 'has_declining_perennial': {
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const crop = state.grid[r][c].crop;
          if (crop && crop.isPerennial && crop.perennialEstablished) {
            const def = getCropDefinition(crop.cropId);
            if (def.yieldCurve) {
              const yp = crop.perennialAge - (def.yearsToEstablish ?? 0);
              if (yp >= def.yieldCurve.declineStartYear) return true;
            }
          }
        }
      }
      return false;
    }
    case 'random':
      return rng.next() < condition.probability;
    default: {
      const _exhaustive: never = condition;
      throw new Error(`Unhandled condition type: ${(_exhaustive as Condition).type}`);
    }
  }
}

/**
 * Check if a storylet is on cooldown based on event history.
 */
function isOnCooldown(storylet: Storylet, state: GameState): boolean {
  if (storylet.cooldownDays <= 0) return false;
  const lastOccurrence = state.eventLog
    .filter(e => e.storyletId === storylet.id)
    .sort((a, b) => b.day - a.day)[0];
  if (!lastOccurrence) return false;
  return (state.calendar.totalDay - lastOccurrence.day) < storylet.cooldownDays;
}

/**
 * Check if a storylet has exceeded its max occurrences.
 */
function hasExceededMaxOccurrences(storylet: Storylet, state: GameState): boolean {
  if (storylet.maxOccurrences === undefined) return false;
  const count = state.eventLog.filter(e => e.storyletId === storylet.id).length;
  return count >= storylet.maxOccurrences;
}

/**
 * Evaluate all preconditions for a storylet.
 * Non-random conditions are evaluated first (short-circuit on first false).
 * The `random` condition is evaluated ONLY if all non-random conditions pass.
 * This ensures deterministic RNG consumption: exactly one RNG call per storylet
 * whose non-random preconditions pass.
 */
function evaluateAllConditions(
  storylet: Storylet,
  state: GameState,
  rng: SeededRNG,
): boolean {
  const nonRandom = storylet.preconditions.filter(c => c.type !== 'random');
  const randomConds = storylet.preconditions.filter(c => c.type === 'random');

  // Evaluate non-random conditions first (short-circuit)
  for (const cond of nonRandom) {
    if (!evaluateCondition(cond, state, rng)) return false;
  }

  // Only evaluate random conditions if all non-random passed
  for (const cond of randomConds) {
    if (!evaluateCondition(cond, state, rng)) return false;
  }

  return true;
}

/**
 * Main event evaluation. Called once per tick from simulateTick.
 *
 * Determinism guarantees:
 * - Storylets are evaluated in array index order (always)
 * - Non-random conditions short-circuit before consuming RNG
 * - Random conditions consume exactly one RNG call per eligible storylet
 * - Ties broken by array index (stable sort)
 *
 * Foreshadowing lifecycle:
 * - When a storylet's conditions pass and it has foreshadowing with no pending
 *   foreshadow: create the foreshadow but DON'T fire the event yet.
 * - On subsequent ticks, if a pending foreshadow exists and totalDay >= eventFiresOnDay:
 *   the storylet becomes eligible to fire (if not a false alarm).
 * - False alarm foreshadows expire silently at eventFiresOnDay (marked dismissed).
 * - Storylets without foreshadowing fire immediately when conditions pass.
 */
export function evaluateEvents(
  state: GameState,
  allStorylets: readonly Storylet[],
  rng: SeededRNG,
  options?: { conditionOnlyAdvisors?: boolean },
): EvaluateEventsResult {
  // Don't fire new events while one is pending
  if (state.activeEvent) {
    return { fireEvent: null, newForeshadows: [] };
  }

  const newForeshadows: PendingForeshadow[] = [];

  // Phase 1: Resolve mature foreshadows (totalDay >= eventFiresOnDay).
  // Foreshadowed events fire with guaranteed priority — the player was warned,
  // so the event must follow through. Only one fires per tick; others stay pending.
  // False alarms are dismissed silently.
  let foreshadowedFire: Storylet | null = null;

  for (const foreshadow of state.pendingForeshadows) {
    if (foreshadow.dismissed) continue;
    if (state.calendar.totalDay < foreshadow.eventFiresOnDay) continue;

    if (foreshadow.isFalseAlarm) {
      // False alarm: dismiss silently, event doesn't fire
      foreshadow.dismissed = true;
      continue;
    }

    // Real mature foreshadow — fire if we haven't already selected one
    if (!foreshadowedFire) {
      const storylet = allStorylets.find(s => s.id === foreshadow.storyletId);
      if (storylet && !isOnCooldown(storylet, state) && !hasExceededMaxOccurrences(storylet, state)) {
        foreshadowedFire = storylet;
        foreshadow.dismissed = true; // Only dismiss the one we're firing
      } else {
        // Storylet blocked by cooldown/maxOccurrences — dismiss the stale foreshadow
        foreshadow.dismissed = true;
      }
    }
    // If foreshadowedFire is already set, leave other mature foreshadows
    // undismissed — they'll fire on subsequent ticks
  }

  // If a foreshadowed event matured, it fires immediately (guaranteed).
  // Still run Phase 2 for new foreshadow creation, but skip event selection.
  if (foreshadowedFire) {
    // Phase 2 (foreshadow creation only): check for new foreshadows
    for (const storylet of allStorylets) {
      if (storylet.id === foreshadowedFire.id) continue;
      if (!storylet.foreshadowing) continue;
      // Guardrail HIGH 1: skip random-gated storylets when filtering to advisors only
      if (options?.conditionOnlyAdvisors && hasRandomCondition(storylet)) continue;
      if (isOnCooldown(storylet, state)) continue;
      if (hasExceededMaxOccurrences(storylet, state)) continue;

      const hasForeshadow = state.pendingForeshadows.some(
        f => f.storyletId === storylet.id &&
          (!f.dismissed || f.eventFiresOnDay === state.calendar.totalDay),
      );
      if (hasForeshadow) continue;

      if (evaluateAllConditions(storylet, state, rng)) {
        const isReliable = rng.next() < storylet.foreshadowing.reliability;
        newForeshadows.push({
          storyletId: storylet.id,
          signal: storylet.foreshadowing.signal,
          appearsOnDay: state.calendar.totalDay,
          eventFiresOnDay: state.calendar.totalDay + storylet.foreshadowing.daysBeforeEvent,
          isFalseAlarm: !isReliable,
          advisorSource: storylet.foreshadowing.advisorSource,
          dismissed: false,
        });
      }
    }

    return { fireEvent: foreshadowedFire, newForeshadows };
  }

  // Phase 2: Evaluate storylets without active foreshadows.
  const eligible: Storylet[] = [];

  for (const storylet of allStorylets) {
    // Guardrail HIGH 1: skip random-gated storylets when filtering to advisors only
    if (options?.conditionOnlyAdvisors && hasRandomCondition(storylet)) continue;
    if (isOnCooldown(storylet, state)) continue;
    if (hasExceededMaxOccurrences(storylet, state)) continue;

    // Skip if there's an active (undismissed) foreshadow for this storylet — it's pending.
    // Also skip if a foreshadow was dismissed THIS tick (prevents false-alarm churn:
    // a false alarm dismissed in Phase 1 would otherwise be re-created immediately).
    const hasForeshadow = state.pendingForeshadows.some(
      f => f.storyletId === storylet.id &&
        (!f.dismissed || f.eventFiresOnDay === state.calendar.totalDay),
    );
    if (hasForeshadow) continue;

    // Evaluate preconditions (RNG consumed deterministically)
    if (evaluateAllConditions(storylet, state, rng)) {
      if (storylet.foreshadowing) {
        // Storylet has foreshadowing: create foreshadow, don't fire yet
        const isReliable = rng.next() < storylet.foreshadowing.reliability;
        newForeshadows.push({
          storyletId: storylet.id,
          signal: storylet.foreshadowing.signal,
          appearsOnDay: state.calendar.totalDay,
          eventFiresOnDay: state.calendar.totalDay + storylet.foreshadowing.daysBeforeEvent,
          isFalseAlarm: !isReliable,
          advisorSource: storylet.foreshadowing.advisorSource,
          dismissed: false,
        });
      } else {
        // No foreshadowing: eligible to fire immediately
        eligible.push(storylet);
      }
    }
  }

  if (eligible.length === 0) {
    return { fireEvent: null, newForeshadows };
  }

  // Select event: priority >= 100 is guaranteed (first one wins by array order)
  const guaranteed = eligible.find(s => s.priority >= 100);
  if (guaranteed) {
    return { fireEvent: guaranteed, newForeshadows };
  }

  // Weighted random by priority
  const totalWeight = eligible.reduce((sum, s) => sum + s.priority, 0);
  if (totalWeight <= 0) {
    return { fireEvent: null, newForeshadows };
  }

  let roll = rng.next() * totalWeight;
  for (const storylet of eligible) {
    roll -= storylet.priority;
    if (roll <= 0) {
      return { fireEvent: storylet, newForeshadows };
    }
  }

  // Fallback (should not happen, but deterministic)
  return { fireEvent: eligible[eligible.length - 1], newForeshadows };
}

// ============================================================================
// Seasonal Event Draw (Slice 4b.5)
// ============================================================================

/**
 * Returns true if the storylet has a `random` precondition.
 * Storylets with `random` → seasonal draw. Without → per-tick.
 */
export function hasRandomCondition(storylet: Storylet): boolean {
  return storylet.preconditions.some(c => c.type === 'random');
}

/**
 * Compute a yearly stress level (0-1) from scenario climate data.
 * Higher stress → higher event probability via modulation.
 */
export function computeYearStressLevel(scenario: ClimateScenario, year: number): number {
  const yd = scenario.years[year - 1];
  if (!yd) return 0.5; // fallback

  const summer = yd.seasons.summer;
  const spring = yd.seasons.spring;

  const waterStress = 1 - yd.waterAllocation;                    // 0-0.5ish range
  const heatStress = Math.min(1, summer.heatwaveProbability / 0.5);
  const etStress = Math.min(1, (summer.avgET0 - 0.25) / 0.15);
  const frostStress = Math.min(1, spring.frostProbability / 0.06);

  const raw = waterStress * 0.35 + heatStress * 0.35 + etStress * 0.15 + frostStress * 0.15;
  return Math.max(0, Math.min(1, raw));
}

/**
 * Draw which random-gated events fire this season.
 * Called once at each season boundary (starting Summer Year 1).
 *
 * Algorithm:
 * 1. Filter to storylets with `random` precondition
 * 2. Evaluate non-random conditions; roll adjusted probability
 * 3. Apply per-family caps (max 1 per type per season)
 * 4. Schedule fire days within the season
 * 5. Sort by appearsOnDay
 */
export function drawSeasonalEvents(
  state: GameState,
  allStorylets: readonly Storylet[],
  rng: SeededRNG,
  stressLevel: number,
  seasonStartDay: number,
  seasonEndDay: number,
): ScheduledEvent[] {
  // Step 1: Filter to random-gated storylets
  const randomStorylets = allStorylets.filter(hasRandomCondition);

  // Step 2: Evaluate eligibility and roll probability
  interface Candidate {
    storylet: Storylet;
    family: string;
  }
  const candidates: Candidate[] = [];

  for (const storylet of randomStorylets) {
    // Cooldown and maxOccurrences
    if (isOnCooldown(storylet, state)) continue;
    if (hasExceededMaxOccurrences(storylet, state)) continue;

    // Evaluate non-random preconditions only (no RNG consumption)
    const nonRandom = storylet.preconditions.filter(c => c.type !== 'random');
    let nonRandomPass = true;
    for (const cond of nonRandom) {
      if (!evaluateCondition(cond, state, rng)) {
        nonRandomPass = false;
        break;
      }
    }
    if (!nonRandomPass) continue;

    // Roll against adjusted probability
    const randomCond = storylet.preconditions.find(c => c.type === 'random');
    if (!randomCond || randomCond.type !== 'random') continue;
    const baseProbability = randomCond.probability;
    const adjustedProbability = Math.min(0.95, baseProbability * (0.5 + stressLevel));

    const roll = rng.next();
    if (roll >= adjustedProbability) continue;

    candidates.push({ storylet, family: storylet.type });
  }

  // Step 3: Apply family caps (max 1 per type per season)
  // Array order = priority tiebreaker (first eligible wins)
  const familySeen = new Set<string>();
  const accepted: Storylet[] = [];
  for (const { storylet, family } of candidates) {
    if (familySeen.has(family)) continue;
    familySeen.add(family);
    accepted.push(storylet);
  }

  // Step 4: Schedule fire days
  const scheduled: ScheduledEvent[] = [];
  for (const storylet of accepted) {
    // fireDay: seasonStart + 5 to seasonEnd - 15 (leave margin at edges)
    const minDay = seasonStartDay + 5;
    const maxDay = Math.max(minDay, seasonEndDay - 15);
    const fireDayRoll = rng.next();
    const firesOnDay = Math.floor(minDay + fireDayRoll * (maxDay - minDay + 1));

    let appearsOnDay = firesOnDay;
    let isFalseAlarm = false;

    if (storylet.foreshadowing) {
      appearsOnDay = firesOnDay - storylet.foreshadowing.daysBeforeEvent;
      // Clamp: don't foreshadow before season starts + 2
      appearsOnDay = Math.max(seasonStartDay + 2, appearsOnDay);
      // Reliability roll
      const reliabilityRoll = rng.next();
      isFalseAlarm = reliabilityRoll >= storylet.foreshadowing.reliability;
    }

    scheduled.push({
      storyletId: storylet.id,
      appearsOnDay,
      firesOnDay,
      isFalseAlarm,
      consumed: false,
    });
  }

  // Step 5: Sort by appearsOnDay
  scheduled.sort((a, b) => a.appearsOnDay - b.appearsOnDay);

  return scheduled;
}
