import type {
  GameState, Cell, SoilState, CropInstance, CropDefinition, Command, CommandResult,
  GameSpeed, DailyWeather, GrowthStage, Notification,
  ClimateScenario, YearSnapshot,
} from './types.ts';
import {
  GRID_ROWS, GRID_COLS, STARTING_CASH, ANNUAL_OVERHEAD, STARTING_NITROGEN,
  STARTING_ORGANIC_MATTER, STARTING_MOISTURE, BASE_MOISTURE_CAPACITY,
  OM_MOISTURE_BONUS_PER_PERCENT, OVERRIPE_GRACE_DAYS, DAYS_PER_YEAR,
  MAX_YEARS, WATER_STRESS_AUTOPAUSE_THRESHOLD, IRRIGATION_COST_PER_CELL,
  WATER_DOSE_INCHES, STARTING_DAY, AUTO_PAUSE_PRIORITY,
  EVENT_RNG_SEED_OFFSET, LOAN_INTEREST_RATE, LOAN_REPAYMENT_FRACTION,
  LOAN_DEBT_CAP, DORMANCY_DAYS,
  OM_FLOOR, OM_YIELD_THRESHOLD, OM_YIELD_FLOOR, NITROGEN_CUSHION_FACTOR,
  N_MINERALIZATION_RATE, OM_DECOMP_RATE,
  STARTING_POTASSIUM, K_MAX, K_MINERALIZATION_RATE, K_PRICE_FLOOR, K_SYMPTOM_THRESHOLD,
  AUTO_IRRIGATION_COST_MULTIPLIERS, REGIME_WATER_REDUCTION, REGIME_MARKET_CRASH_FACTOR,
  createEmptyTrackingState, createEmptyExpenseBreakdown,
} from './types.ts';
import { getTechLevel } from './tech-levels.ts';
import { evaluateEvents, drawSeasonalEvents, computeYearStressLevel } from './events/selector.ts';
import { applyEffects, expireActiveEffects, getYieldModifier, getPriceModifier, getIrrigationCostMultiplier } from './events/effects.ts';
import { STORYLETS } from '../data/events.ts';
import { totalDayToCalendar, isYearEnd, isSeasonChange, isInPlantingWindow, getSeasonName, getMonthName } from './calendar.ts';
import { generateDailyWeather, updateExtremeEvents } from './weather.ts';
import { getCropDefinition, getAllCropIds } from '../data/crops.ts';
import { getCoverCropDefinition } from '../data/cover-crops.ts';
import { SeededRNG } from './rng.ts';
import { logCommand, logEventFired, logEventChoice, logLoanOffer, logLoanTaken, logYearEnd, logGameOver, logHarvest } from './playtest-log.ts';

// ============================================================================
// Game State Creation
// ============================================================================

export function createInitialState(playerId: string, scenario: ClimateScenario): GameState {
  const grid: Cell[][] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    const rowCells: Cell[] = [];
    for (let col = 0; col < GRID_COLS; col++) {
      rowCells.push({
        row,
        col,
        crop: null,
        soil: createInitialSoil(),
        coverCropId: null,
        lastCropId: null,
        lastHarvestYieldRatio: null,
      });
    }
    grid.push(rowCells);
  }

  // Advance RNG through the skipped days (Jan-Feb) to maintain determinism.
  // Both generateDailyWeather AND updateExtremeEvents consume RNG values,
  // so we must call both — exactly as simulateTick does — to keep the
  // RNG sequence identical to what a from-day-0 simulation would produce.
  const rng = new SeededRNG(scenario.seed);
  const warmup = { activeHeatwaveDays: 0, activeFrostDays: 0 };
  for (let d = 0; d < STARTING_DAY; d++) {
    const w = generateDailyWeather(scenario, d, rng);
    updateExtremeEvents(warmup, w, scenario, d, rng);
  }

  // Initialize event RNG (separate stream, seeded from mainSeed + offset).
  // No warmup needed: event evaluation starts at STARTING_DAY, and the event
  // RNG is never consumed before then (unlike weather RNG which generates
  // Jan-Feb weather during warmup).
  const eventRng = new SeededRNG(scenario.seed + EVENT_RNG_SEED_OFFSET);

  return {
    calendar: totalDayToCalendar(STARTING_DAY),
    speed: 0,
    grid,
    economy: {
      cash: STARTING_CASH,
      yearlyRevenue: 0,
      yearlyExpenses: 0,
      debt: 0,
      totalLoansReceived: 0,
      interestPaidThisYear: 0,
    },
    notifications: [],
    autoPauseQueue: [],
    playerId,
    scenarioId: scenario.id,
    rngState: rng.getState(),
    waterStressPausedThisSeason: false,
    activeHeatwaveDays: warmup.activeHeatwaveDays,
    activeFrostDays: warmup.activeFrostDays,
    nextNotificationId: 1,
    gameOver: false,
    yearEndSummaryPending: false,
    // Slice 2a: Event system
    eventLog: [],
    activeEvent: null,
    pendingForeshadows: [],
    activeEffects: [],
    cropFailureStreak: 0,
    flags: {},
    wateringRestricted: false,
    wateringRestrictionEndsDay: 0,
    irrigationCostMultiplier: 1.0,
    eventRngState: eventRng.getState(),
    frostProtectionEndsDay: 0,
    // Slice 4a: Tracking
    tracking: createEmptyTrackingState(),
    eventsThisSeason: 0,
    actedSincePause: false,
    // Slice 4b.5: Seasonal event draw
    seasonalEventQueue: [],  // No draw in Spring Year 1 (onboarding)
    yearStressLevel: computeYearStressLevel(scenario, 1),
  };
}

function createInitialSoil(): SoilState {
  const om = STARTING_ORGANIC_MATTER;
  return {
    nitrogen: STARTING_NITROGEN,
    organicMatter: om,
    moisture: STARTING_MOISTURE,
    moistureCapacity: BASE_MOISTURE_CAPACITY + (om - 2.0) * OM_MOISTURE_BONUS_PER_PERCENT,
    potassium: STARTING_POTASSIUM,
  };
}

// ============================================================================
// Runtime Assertions
// ============================================================================

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid state: ${label} is ${value} (expected finite number)`);
  }
}

// ============================================================================
// Command Processing
// ============================================================================

export function processCommand(state: GameState, command: Command, scenario: ClimateScenario): CommandResult {
  const cashBefore = state.economy.cash;
  let result: CommandResult;

  switch (command.type) {
    case 'SET_SPEED':
      result = processSetSpeed(state, command.speed);
      break;
    case 'PLANT_CROP':
      result = processPlantCrop(state, command.cellRow, command.cellCol, command.cropId);
      break;
    case 'PLANT_BULK':
      result = processPlantBulk(state, command.scope, command.cropId, command.index);
      break;
    case 'HARVEST':
      result = processHarvest(state, command.cellRow, command.cellCol);
      break;
    case 'HARVEST_BULK':
      result = processHarvestBulk(state, command.scope, command.index);
      break;
    case 'WATER':
      result = processWater(state, command.scope, command.index, scenario);
      break;
    case 'RESPOND_EVENT':
      result = processRespondEvent(state, command.eventId, command.choiceId);
      break;
    case 'TAKE_LOAN':
      result = processTakeLoan(state);
      break;
    case 'REMOVE_CROP':
      result = processRemoveCrop(state, command.cellRow, command.cellCol);
      break;
    case 'SET_COVER_CROP':
      result = processSetCoverCrop(state, command.cellRow, command.cellCol, command.coverCropId);
      break;
    case 'SET_COVER_CROP_BULK':
      result = processSetCoverCropBulk(state, command.scope, command.coverCropId, command.index);
      break;
    default: {
      const _exhaustive: never = command;
      throw new Error(`Unhandled command type: ${(_exhaustive as Command).type}`);
    }
  }

  // Skip SET_SPEED to avoid noise
  if (command.type !== 'SET_SPEED') {
    logCommand(state, command, result.success, result.reason, cashBefore);
    // Track that the player has acted since the last pause (for play-prompt UX)
    if (state.speed === 0 && result.success) {
      state.actedSincePause = true;
    }
  }

  return result;
}

function processSetSpeed(state: GameState, speed: GameSpeed): CommandResult {
  // Reset actedSincePause when transitioning from paused to playing
  if (state.speed === 0 && speed > 0) {
    state.actedSincePause = false;
  }
  state.speed = speed;
  return { success: true };
}

function processPlantCrop(state: GameState, row: number, col: number, cropId: string): CommandResult {
  const cell = getCell(state, row, col);
  if (!cell) return { success: false, reason: 'Invalid cell position.' };
  if (cell.crop) return { success: false, reason: 'This plot already has a crop.' };

  const cropDef = getCropDefinition(cropId);

  // Slice 5a: Tech gating — crop requires a flag to unlock
  if (cropDef.requiredFlag && !state.flags[cropDef.requiredFlag]) {
    return { success: false, reason: `${cropDef.name} requires a technology unlock before planting.` };
  }

  const cal = state.calendar;
  if (!isInPlantingWindow(cal.month, cropDef.plantingWindow.startMonth, cropDef.plantingWindow.endMonth)) {
    return {
      success: false,
      reason: `${cropDef.name} can only be planted ${getMonthName(cropDef.plantingWindow.startMonth)}–${getMonthName(cropDef.plantingWindow.endMonth)}.`,
    };
  }

  const cost = cropDef.seedCostPerAcre;
  if (state.economy.cash < cost) {
    return { success: false, reason: `Not enough cash. Cost: $${cost}, Available: $${Math.floor(state.economy.cash)}.` };
  }

  state.economy.cash -= cost;
  state.economy.yearlyExpenses += cost;
  state.tracking.currentExpenses.planting += cost;
  cell.crop = createCropInstance(cropId, state.calendar.totalDay);

  // Adaptation tracking: crop transitions (trigger-conditioned on poor yield)
  if (cell.lastCropId !== null && cell.lastCropId !== cropId &&
      cell.lastHarvestYieldRatio !== null && cell.lastHarvestYieldRatio < 0.80) {
    state.tracking.cropTransitions++;
  }

  // Adaptation tracking: drought-tolerant adoption (per-type, after year 5)
  if (state.calendar.year >= 5 && ['sorghum', 'pistachios', 'citrus-navels'].includes(cropId) &&
      !state.tracking.droughtTolerantTypesAdopted.includes(cropId)) {
    state.tracking.droughtTolerantTypesAdopted.push(cropId);
  }

  // Set lastCropId for perennials at planting time
  if (cropDef.type === 'perennial') {
    cell.lastCropId = cropId;
  }

  // Reveal chill hours when first perennial is planted
  if (cropDef.type === 'perennial' && !state.flags['chillHoursRevealed']) {
    state.flags['chillHoursRevealed'] = true;
  }

  return { success: true, cost, cellsAffected: 1 };
}

function processPlantBulk(state: GameState, scope: 'all' | 'row' | 'col', cropId: string, index?: number): CommandResult {
  const cropDef = getCropDefinition(cropId);

  // Slice 5a: Tech gating — crop requires a flag to unlock
  if (cropDef.requiredFlag && !state.flags[cropDef.requiredFlag]) {
    return { success: false, reason: `${cropDef.name} requires a technology unlock before planting.` };
  }

  const cal = state.calendar;
  if (!isInPlantingWindow(cal.month, cropDef.plantingWindow.startMonth, cropDef.plantingWindow.endMonth)) {
    return {
      success: false,
      reason: `${cropDef.name} can only be planted ${getMonthName(cropDef.plantingWindow.startMonth)}–${getMonthName(cropDef.plantingWindow.endMonth)}.`,
    };
  }

  const emptyCells = getEmptyCells(state, scope, index);
  if (emptyCells.length === 0) {
    return { success: false, reason: 'No empty plots in the selected area.' };
  }

  const costPerCell = cropDef.seedCostPerAcre;

  if (scope === 'all') {
    // Plant Field: round down to complete rows
    const affordableCells = Math.floor(state.economy.cash / costPerCell);
    if (affordableCells <= 0) {
      return { success: false, reason: `Not enough cash. Cost per plot: $${costPerCell}.` };
    }

    // DD-1: Only consider fully empty rows (skip rows with any existing crops)
    const emptyByRow = groupByRow(emptyCells);
    const fullRows: Cell[][] = [];
    for (const [, cells] of emptyByRow) {
      if (cells.length === GRID_COLS) {
        fullRows.push(cells);
      }
    }

    const fullRowCells = fullRows.flat();
    const fullRowCost = fullRowCells.length * costPerCell;

    if (fullRowCells.length === 0) {
      return {
        success: false,
        reason: 'No fully empty rows available. Use "Plant Row" to fill specific rows.',
      };
    }

    if (state.economy.cash >= fullRowCost) {
      // Can afford all full rows — plant everything
      return executeBulkPlant(state, fullRowCells, cropId, costPerCell);
    }

    // Partial: figure out how many complete rows we can afford
    let rowsAffordable = 0;
    let plotsInRows = 0;
    let costForRows = 0;

    for (const rowCells of fullRows) {
      const rowCost = rowCells.length * costPerCell;
      if (costForRows + rowCost <= state.economy.cash) {
        rowsAffordable++;
        plotsInRows += rowCells.length;
        costForRows += rowCost;
      } else {
        break;
      }
    }

    if (rowsAffordable === 0) {
      return {
        success: false,
        reason: `Not enough cash to plant a full row. Cost per row: $${GRID_COLS * costPerCell}, Available: $${Math.floor(state.economy.cash)}.`,
      };
    }

    return {
      success: false,
      reason: 'partial',
      partialOffer: {
        affordableRows: rowsAffordable,
        affordablePlots: plotsInRows,
        totalCost: costForRows,
      },
    };

  } else {
    // Row/Column: all-or-nothing
    const totalCost = emptyCells.length * costPerCell;
    if (state.economy.cash < totalCost) {
      return { success: false, reason: `Not enough cash to plant this ${scope}. Cost: $${totalCost}, Available: $${Math.floor(state.economy.cash)}.` };
    }
    return executeBulkPlant(state, emptyCells, cropId, costPerCell);
  }
}

/**
 * Execute a confirmed bulk plant. Used after initial validation or after user confirms partial.
 */
export function executeBulkPlant(
  state: GameState,
  cells: Cell[],
  cropId: string,
  costPerCell: number,
): CommandResult {
  const totalCost = cells.length * costPerCell;
  state.economy.cash -= totalCost;
  state.economy.yearlyExpenses += totalCost;
  state.tracking.currentExpenses.planting += totalCost;

  const cropDef = getCropDefinition(cropId);
  const isPerennial = cropDef.type === 'perennial';

  for (const cell of cells) {
    // Adaptation tracking: crop transitions (trigger-conditioned on poor yield)
    if (cell.lastCropId !== null && cell.lastCropId !== cropId &&
        cell.lastHarvestYieldRatio !== null && cell.lastHarvestYieldRatio < 0.80) {
      state.tracking.cropTransitions++;
    }
    cell.crop = createCropInstance(cropId, state.calendar.totalDay);
    if (isPerennial) {
      cell.lastCropId = cropId;
    }
  }

  // Adaptation tracking: drought-tolerant adoption (per-type, after year 5)
  if (state.calendar.year >= 5 && ['sorghum', 'pistachios', 'citrus-navels'].includes(cropId) &&
      !state.tracking.droughtTolerantTypesAdopted.includes(cropId)) {
    state.tracking.droughtTolerantTypesAdopted.push(cropId);
  }

  // Reveal chill hours when first perennial is bulk-planted
  if (!state.flags['chillHoursRevealed'] && isPerennial) {
    state.flags['chillHoursRevealed'] = true;
  }

  return { success: true, cost: totalCost, cellsAffected: cells.length };
}

function processHarvest(state: GameState, row: number, col: number): CommandResult {
  const cell = getCell(state, row, col);
  if (!cell) return { success: false, reason: 'Invalid cell position.' };
  if (!cell.crop) return { success: false, reason: 'No crop to harvest.' };

  const stage = cell.crop.growthStage;
  if (stage !== 'harvestable' && stage !== 'overripe') {
    return { success: false, reason: `Crop is not ready to harvest (${stage}).` };
  }

  if (cell.crop.isPerennial && cell.crop.isDormant) {
    return { success: false, reason: 'Trees are dormant during winter and cannot be harvested.' };
  }

  if (cell.crop.isPerennial && cell.crop.harvestedThisSeason) {
    return { success: false, reason: 'Already harvested this season. Trees produce one crop per year.' };
  }

  const cropId = cell.crop.cropId;
  const revenue = harvestCell(state, cell);
  logHarvest(state, cropId, revenue, 1);
  return { success: true, revenue, cellsAffected: 1 };
}

function processHarvestBulk(state: GameState, scope: 'all' | 'row' | 'col', index?: number): CommandResult {
  const harvestable = getHarvestableCells(state, scope, index);
  if (harvestable.length === 0) {
    return { success: false, reason: 'No crops ready to harvest.' };
  }

  // #61: Batch harvest notifications by crop type
  const cropRevenue = new Map<string, { count: number; revenue: number }>();
  let totalRevenue = 0;
  for (const cell of harvestable) {
    const cropId = cell.crop!.cropId;
    const rev = harvestCell(state, cell, true); // silent: suppress per-cell notifications
    totalRevenue += rev;
    const entry = cropRevenue.get(cropId);
    if (entry) {
      entry.count++;
      entry.revenue += rev;
    } else {
      cropRevenue.set(cropId, { count: 1, revenue: rev });
    }
  }

  // Emit one notification per crop type
  for (const [cropId, data] of cropRevenue) {
    const cropDef = getCropDefinition(cropId);
    addNotification(state, 'harvest',
      `Harvested ${data.count} plots of ${cropDef.name} \u2014 $${Math.floor(data.revenue).toLocaleString()} revenue`);
  }

  logHarvest(state, `bulk_${scope}`, totalRevenue, harvestable.length);
  return { success: true, revenue: totalRevenue, cellsAffected: harvestable.length };
}

function processWater(state: GameState, scope: 'all' | 'row' | 'col', index?: number, scenario?: ClimateScenario): CommandResult {
  // Watering restriction check (from regulatory events)
  if (state.wateringRestricted) {
    return { success: false, reason: 'Watering is currently restricted by water allocation regulations.' };
  }

  const cells = getCellsInScope(state, scope, index).filter(c => c.crop !== null);
  if (cells.length === 0) {
    return { success: false, reason: 'No planted plots to water.' };
  }

  // Apply irrigation cost multiplier from active effects (e.g. water allocation cut)
  const costMultiplier = getIrrigationCostMultiplier(state);
  const effectiveCostPerCell = IRRIGATION_COST_PER_CELL * costMultiplier;
  const totalCost = cells.length * effectiveCostPerCell;

  if (scope === 'all') {
    // Water Field: round down to complete rows if can't afford all
    if (state.economy.cash < totalCost) {
      const affordableCells = Math.floor(state.economy.cash / effectiveCostPerCell);
      if (affordableCells <= 0) {
        return { success: false, reason: `Not enough cash to water. Cost per plot: $${effectiveCostPerCell}.` };
      }

      const plantedByRow = groupByRow(cells);
      let rowsAffordable = 0;
      let plotsInRows = 0;
      let costForRows = 0;

      for (const [, rowCells] of plantedByRow) {
        const rowCost = rowCells.length * effectiveCostPerCell;
        if (costForRows + rowCost <= state.economy.cash) {
          rowsAffordable++;
          plotsInRows += rowCells.length;
          costForRows += rowCost;
        } else {
          break;
        }
      }

      if (rowsAffordable === 0) {
        return { success: false, reason: `Not enough cash to water a full row.` };
      }

      return {
        success: false,
        reason: 'partial',
        partialOffer: {
          affordableRows: rowsAffordable,
          affordablePlots: plotsInRows,
          totalCost: costForRows,
        },
      };
    }
  } else {
    if (state.economy.cash < totalCost) {
      return { success: false, reason: `Not enough cash to water this ${scope}. Cost: $${totalCost}, Available: $${Math.floor(state.economy.cash)}.` };
    }
  }

  return executeWater(state, cells, scenario);
}

/**
 * Apply irrigation to cells. Dose is reduced by scenario water allocation.
 * @param scenario - Required in production (all call sites pass it). Optional only
 *   for unit test isolation — falls back to allocation=1.0 (full dose).
 */
export function executeWater(state: GameState, cells: Cell[], scenario?: ClimateScenario): CommandResult {
  const costMultiplier = getIrrigationCostMultiplier(state);
  const costPerCell = IRRIGATION_COST_PER_CELL * costMultiplier;
  const totalCost = cells.length * costPerCell;
  state.economy.cash -= totalCost;
  state.economy.yearlyExpenses += totalCost;
  state.tracking.currentExpenses.watering += totalCost;

  const allocation = scenario
    ? scenario.years[Math.min(state.calendar.year - 1, scenario.years.length - 1)].waterAllocation
    : 1.0;
  // Slice 5a: Permanent water reduction from regime shift
  const regimeModifier = state.flags['regime_water_reduced'] ? REGIME_WATER_REDUCTION : 1.0;
  const effectiveDose = WATER_DOSE_INCHES * allocation * regimeModifier;

  for (const cell of cells) {
    cell.soil.moisture = Math.min(cell.soil.moisture + effectiveDose, cell.soil.moistureCapacity);
  }

  return { success: true, cost: totalCost, cellsAffected: cells.length };
}

// ============================================================================
// Event Response
// ============================================================================

/**
 * Apply frost protection interaction for late-frost-warning "accept-risk" choice.
 * If weather-advisor frost protection is active, reduce penalty from 0.70 to 0.85
 * and consume the protection. Returns modified effects array.
 */
function applyFrostProtection(
  state: GameState,
  eventId: string,
  choiceId: string,
  effects: readonly import('./events/types.ts').Effect[],
): import('./events/types.ts').Effect[] {
  // Only applies to late-frost-warning + accept-risk
  if (eventId !== 'late-frost-warning' || choiceId !== 'accept-risk') {
    return [...effects];
  }

  const isProtected = state.calendar.totalDay < state.frostProtectionEndsDay;
  if (!isProtected) return [...effects];

  // Replace yield modifier 0.70 → 0.85, consume protection
  state.frostProtectionEndsDay = 0;
  addNotification(state, 'event_result', 'Your frost protection reduced crop losses.');

  return effects.map(e => {
    if (e.type === 'modify_yield_modifier' && e.multiplier === 0.70) {
      return { ...e, multiplier: 0.85 };
    }
    // Replace the "30% damage" notification with the protected version
    if (e.type === 'add_notification' && e.message.includes('30%')) {
      return { ...e, message: 'Frost damaged some crops, but your protection reduced losses. Yield reduced by 15% instead of 30%.' };
    }
    return e;
  });
}

function processRespondEvent(state: GameState, eventId: string, choiceId: string): CommandResult {
  if (!state.activeEvent) {
    return { success: false, reason: 'No active event to respond to.' };
  }
  if (state.activeEvent.storyletId !== eventId) {
    return { success: false, reason: 'Event ID mismatch.' };
  }

  const choice = state.activeEvent.choices.find(c => c.id === choiceId);
  if (!choice) {
    return { success: false, reason: `Invalid choice: ${choiceId}.` };
  }

  // Check if player can afford the choice
  if (choice.requiresCash !== undefined && state.economy.cash < choice.requiresCash) {
    return { success: false, reason: `Not enough cash. Requires $${choice.requiresCash}.` };
  }

  const cashBefore = state.economy.cash;

  // Apply frost protection interaction (may modify effects for late-frost-warning)
  const effectsToApply = applyFrostProtection(state, eventId, choiceId, choice.effects);

  // Apply effects
  applyEffects(state, effectsToApply, eventId);

  // Log the event
  state.eventLog.push({
    storyletId: eventId,
    day: state.calendar.totalDay,
    choiceId,
  });

  logEventChoice(state, eventId, choiceId, cashBefore);

  // Clear active event
  state.activeEvent = null;

  return { success: true };
}

// ============================================================================
// Loan System
// ============================================================================

/**
 * Compute the loan amount offered to the player.
 * Amount covers current deficit plus $5,000 buffer, rounded up to nearest $1,000.
 */
export function computeLoanAmount(cash: number): number {
  return Math.ceil((Math.abs(cash) + 5000) / 1000) * 1000;
}

function processTakeLoan(state: GameState): CommandResult {
  // TAKE_LOAN is only valid while a loan_offer auto-pause is active
  const hasLoanOffer = state.autoPauseQueue.some(e => e.reason === 'loan_offer');
  if (!hasLoanOffer) {
    return { success: false, reason: 'No loan offer is currently available.' };
  }

  if (state.economy.totalLoansReceived >= 1) {
    return { success: false, reason: 'You have already received an emergency loan.' };
  }

  const amount = computeLoanAmount(state.economy.cash);
  state.economy.cash += amount;
  state.economy.debt = amount;
  state.economy.totalLoansReceived = 1;

  addNotification(state, 'loan',
    `Emergency loan of $${amount.toLocaleString()} received. 10% annual interest. 20% of harvest revenue will go toward repayment.`);

  logLoanTaken(state, amount);

  // Clear the game over state (loan saves the farm)
  state.gameOver = false;
  state.gameOverReason = undefined;

  return { success: true };
}

function processRemoveCrop(state: GameState, row: number, col: number): CommandResult {
  const cell = getCell(state, row, col);
  if (!cell) return { success: false, reason: 'Invalid cell position.' };
  if (!cell.crop) return { success: false, reason: 'This plot has no crop to remove.' };
  if (!cell.crop.isPerennial) {
    return { success: false, reason: 'Use harvest to clear annual crops.' };
  }

  const cropDef = getCropDefinition(cell.crop.cropId);
  const cost = cropDef.removalCost ?? 0;

  if (state.economy.cash < cost) {
    return { success: false, reason: `Not enough cash. Removal cost: $${cost}, Available: $${Math.floor(state.economy.cash)}.` };
  }

  state.economy.cash -= cost;
  state.economy.yearlyExpenses += cost;
  state.tracking.currentExpenses.removal += cost;
  addNotification(state, 'info', `Removed ${cropDef.name} from row ${row + 1}, col ${col + 1}. Cost: $${cost}.`);
  cell.crop = null;

  return { success: true, cost };
}

// ============================================================================
// Cover Crop Commands
// ============================================================================

/** Check if a cell is eligible for cover crop planting (empty or deciduous perennial). */
function isCoverCropEligible(cell: Cell): boolean {
  if (!cell.crop) return true;
  if (!cell.crop.isPerennial) return false;
  const def = getCropDefinition(cell.crop.cropId);
  return (def.dormantSeasons?.length ?? 0) > 0;
}

/**
 * Execute bulk cover crop planting on pre-validated cells.
 * Called from adapter partial-offer confirm callback.
 */
export function executeBulkCoverCrop(
  state: GameState,
  cells: Cell[],
  coverCropId: string,
  costPerCell: number,
): CommandResult {
  const totalCost = cells.length * costPerCell;
  state.economy.cash -= totalCost;
  state.economy.yearlyExpenses += totalCost;
  state.tracking.currentExpenses.coverCrops += totalCost;

  for (const cell of cells) {
    cell.coverCropId = coverCropId;
  }

  return { success: true, cost: totalCost, cellsAffected: cells.length };
}

function processSetCoverCrop(state: GameState, row: number, col: number, coverCropId: string | null): CommandResult {
  const cell = getCell(state, row, col);
  if (!cell) return { success: false, reason: 'Invalid cell position.' };

  // Clearing cover crop is always allowed
  if (coverCropId === null) {
    cell.coverCropId = null;
    return { success: true };
  }

  // Planting rules
  if (state.calendar.season !== 'fall') {
    return { success: false, reason: 'Cover crops can only be planted in fall (September–November).' };
  }

  if (cell.coverCropId) {
    return { success: false, reason: 'This plot already has a cover crop.' };
  }

  // Eligible: empty cell OR perennial that will go dormant (deciduous orchard understory).
  // In fall, deciduous perennials are still technically "growing" but about to shed leaves.
  // Real agriculture: cover crops are sown under orchards in fall before leaf drop.
  if (cell.crop) {
    if (!cell.crop.isPerennial) {
      return { success: false, reason: 'Cannot plant cover crop on a cell with an annual crop.' };
    }
    const def = getCropDefinition(cell.crop.cropId);
    if (!def.dormantSeasons || def.dormantSeasons.length === 0) {
      return { success: false, reason: 'Cannot plant cover crop under an evergreen perennial.' };
    }
  }

  const def = getCoverCropDefinition(coverCropId);
  if (state.economy.cash < def.seedCostPerAcre) {
    return { success: false, reason: `Not enough cash. Cost: $${def.seedCostPerAcre}, Available: $${Math.floor(state.economy.cash)}.` };
  }

  state.economy.cash -= def.seedCostPerAcre;
  state.economy.yearlyExpenses += def.seedCostPerAcre;
  state.tracking.currentExpenses.coverCrops += def.seedCostPerAcre;
  cell.coverCropId = coverCropId;
  return { success: true, cost: def.seedCostPerAcre };
}

function processSetCoverCropBulk(
  state: GameState,
  scope: 'all' | 'row' | 'col',
  coverCropId: string | null,
  index?: number,
): CommandResult {
  // Clearing is always allowed
  if (coverCropId === null) {
    let cleared = 0;
    forEachCellInScope(state, scope, index, (cell) => {
      if (cell.coverCropId) {
        cell.coverCropId = null;
        cleared++;
      }
    });
    return { success: true, cellsAffected: cleared };
  }

  if (state.calendar.season !== 'fall') {
    return { success: false, reason: 'Cover crops can only be planted in fall (September–November).' };
  }

  const def = getCoverCropDefinition(coverCropId);

  // Count eligible cells: empty OR deciduous perennial (has dormantSeasons)
  const eligible: Cell[] = [];
  forEachCellInScope(state, scope, index, (cell) => {
    if (!cell.coverCropId && isCoverCropEligible(cell)) {
      eligible.push(cell);
    }
  });

  if (eligible.length === 0) {
    return { success: false, reason: 'No eligible plots for cover crops.' };
  }

  const totalCost = eligible.length * def.seedCostPerAcre;

  if (state.economy.cash < totalCost && scope === 'all') {
    // DD-1: partial offer with complete rows
    const affordablePlots = Math.floor(state.economy.cash / def.seedCostPerAcre);
    const affordableRows = Math.floor(affordablePlots / GRID_COLS);
    if (affordableRows === 0) {
      return { success: false, reason: `Not enough cash. Need $${totalCost}, have $${Math.floor(state.economy.cash)}.` };
    }
    return {
      success: false,
      reason: `Not enough cash for all plots.`,
      partialOffer: {
        affordableRows,
        affordablePlots: affordableRows * GRID_COLS,
        totalCost: affordableRows * GRID_COLS * def.seedCostPerAcre,
      },
    };
  }

  if (state.economy.cash < totalCost) {
    return { success: false, reason: `Not enough cash. Need $${totalCost}, have $${Math.floor(state.economy.cash)}.` };
  }

  // Plant on all eligible cells
  let planted = 0;
  for (const cell of eligible) {
    cell.coverCropId = coverCropId;
    state.economy.cash -= def.seedCostPerAcre;
    state.economy.yearlyExpenses += def.seedCostPerAcre;
    state.tracking.currentExpenses.coverCrops += def.seedCostPerAcre;
    planted++;
  }

  return { success: true, cellsAffected: planted, cost: planted * def.seedCostPerAcre };
}

/** Iterate over cells in the given scope. */
function forEachCellInScope(
  state: GameState,
  scope: 'all' | 'row' | 'col',
  index: number | undefined,
  fn: (cell: Cell) => void,
): void {
  if (scope === 'all') {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) fn(state.grid[r][c]);
    }
  } else if (scope === 'row' && index !== undefined) {
    for (let c = 0; c < GRID_COLS; c++) fn(state.grid[index][c]);
  } else if (scope === 'col' && index !== undefined) {
    for (let r = 0; r < GRID_ROWS; r++) fn(state.grid[r][index]);
  }
}

// ============================================================================
// Cover Crop Incorporation (winter→spring)
// ============================================================================

function incorporateCoverCrops(state: GameState): void {
  let incorporated = 0;

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const cell = state.grid[row][col];
      if (!cell.coverCropId) continue;

      const coverDef = getCoverCropDefinition(cell.coverCropId);

      // Apply nitrogen fixation (clamped to 200)
      cell.soil.nitrogen = Math.min(200, cell.soil.nitrogen + coverDef.nitrogenFixation);

      // Apply organic matter bonus
      cell.soil.organicMatter += coverDef.organicMatterBonus;

      // Apply moisture drawdown (tradeoff)
      cell.soil.moisture = Math.max(0, cell.soil.moisture - coverDef.moistureDrawdown);

      // Clear cover crop
      cell.coverCropId = null;
      incorporated++;
    }
  }

  if (incorporated > 0) {
    addNotification(state, 'info',
      `Cover crops incorporated on ${incorporated} plot${incorporated !== 1 ? 's' : ''}: +50 lbs/ac nitrogen, +0.10% organic matter, -0.5in moisture`);
  }
}

// ============================================================================
// Simulation Tick
// ============================================================================

export function simulateTick(state: GameState, scenario: ClimateScenario): DailyWeather | null {
  if (state.gameOver) return null;
  if (state.speed === 0) return null;
  if (state.autoPauseQueue.length > 0) return null;

  const prevTotalDay = state.calendar.totalDay;
  const newTotalDay = prevTotalDay + 1;

  // Check for game completion (Year 30)
  if (newTotalDay >= MAX_YEARS * DAYS_PER_YEAR) {
    state.autoPauseQueue.push({
      reason: 'year_30',
      message: `Congratulations! You completed 30 years of farming! Final cash: $${Math.floor(state.economy.cash).toLocaleString()}.`,
    });
    state.gameOver = true;
    state.speed = 0;
    logGameOver(state, 'year_30_complete');
    return null;
  }

  // Generate weather (base + extreme events)
  const rng = new SeededRNG(state.rngState);
  const weather = generateDailyWeather(scenario, newTotalDay, rng);
  updateExtremeEvents(state, weather, scenario, newTotalDay, rng);
  state.rngState = rng.getState();

  // Advance calendar
  state.calendar = totalDayToCalendar(newTotalDay);

  // Season change detection
  if (isSeasonChange(prevTotalDay, newTotalDay)) {
    state.waterStressPausedThisSeason = false; // Reset per-season auto-pause flag
    state.eventsThisSeason = 0; // Reset event clustering counter

    // #61: Age-based notification trim — remove notifications older than 180 days (2 seasons)
    const maxAge = 180;
    state.notifications = state.notifications.filter(n => (newTotalDay - n.day) <= maxAge);

    const seasonName = getSeasonName(state.calendar.season);
    addNotification(state, 'season_change', `${seasonName} — Year ${state.calendar.year}`);

    // Cover crop incorporation at winter→spring transition
    if (state.calendar.season === 'spring') {
      incorporateCoverCrops(state);
    }

    // Seasonal event draw (skip Year 1 Spring for onboarding)
    const skipDraw = state.calendar.year === 1 && state.calendar.season === 'spring';
    if (!skipDraw) {
      const eventRng = new SeededRNG(state.eventRngState);
      const seasonStart = newTotalDay;
      const seasonEnd = seasonStart + 89;
      state.seasonalEventQueue = drawSeasonalEvents(
        state, STORYLETS, eventRng, state.yearStressLevel, seasonStart, seasonEnd,
      );
      state.eventRngState = eventRng.getState();
    } else {
      state.seasonalEventQueue = [];
    }
  }

  // Expire active effects (remove where totalDay >= expiresDay)
  expireActiveEffects(state);

  // Simulate each cell
  let anyHarvestReady = false;
  let anyWaterStress = false;

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const cell = state.grid[row][col];

      // Soil simulation (runs even without crops)
      simulateSoil(cell, weather);

      // Crop simulation
      if (cell.crop) {
        simulateCrop(cell, weather, state, scenario);

        if (cell.crop && cell.crop.growthStage === 'harvestable' &&
            !(cell.crop.isPerennial && cell.crop.harvestedThisSeason)) {
          anyHarvestReady = true;
        }

        // Water stress check
        if (cell.crop && cell.soil.moisture < cell.soil.moistureCapacity * WATER_STRESS_AUTOPAUSE_THRESHOLD) {
          anyWaterStress = true;
        }
      }
    }
  }

  // Auto-pause: harvest ready (with count for affordance)
  if (anyHarvestReady) {
    let readyCount = 0;
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const cell = state.grid[row][col];
        if (cell.crop && cell.crop.growthStage === 'harvestable' &&
            !(cell.crop.isPerennial && cell.crop.harvestedThisSeason)) {
          readyCount++;
        }
      }
    }
    state.autoPauseQueue.push({
      reason: 'harvest_ready',
      message: readyCount === 1
        ? '1 plot is ready to harvest!'
        : `${readyCount} plots are ready to harvest!`,
    });
  }

  // Auto-pause: water stress
  // Slice 5a: With irrigation tech, auto-water on every qualifying tick.
  // Without tech, manual pause fires once per season only.
  if (anyWaterStress) {
    const waterLevel = getTechLevel(state.flags, 'water');
    if (waterLevel >= 1 && !state.wateringRestricted) {
      // Auto-irrigation: water stressed cells, deducting reduced cost
      // Apply both tech discount AND any event-based cost modifiers
      const techMultiplier = AUTO_IRRIGATION_COST_MULTIPLIERS[waterLevel] ?? 0.70;
      const eventMultiplier = getIrrigationCostMultiplier(state);
      const costPerCell = IRRIGATION_COST_PER_CELL * techMultiplier * eventMultiplier;
      // Count cells that need water
      const stressedCells: Cell[] = [];
      for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
          const cell = state.grid[row][col];
          if (cell.crop && cell.soil.moisture < cell.soil.moistureCapacity * WATER_STRESS_AUTOPAUSE_THRESHOLD) {
            stressedCells.push(cell);
          }
        }
      }
      const totalCost = stressedCells.length * costPerCell;
      if (state.economy.cash >= totalCost && stressedCells.length > 0) {
        // Apply auto-irrigation
        state.economy.cash -= totalCost;
        state.economy.yearlyExpenses += totalCost;
        state.tracking.currentExpenses.watering += totalCost;
        const allocation = scenario.years[Math.min(state.calendar.year - 1, scenario.years.length - 1)].waterAllocation;
        const regimeModifier = state.flags['regime_water_reduced'] ? REGIME_WATER_REDUCTION : 1.0;
        const effectiveDose = WATER_DOSE_INCHES * allocation * regimeModifier;
        for (const cell of stressedCells) {
          cell.soil.moisture = Math.min(cell.soil.moisture + effectiveDose, cell.soil.moistureCapacity);
        }
      } else if (!state.waterStressPausedThisSeason) {
        // Can't afford auto-irrigation — fall back to manual pause (once per season)
        state.waterStressPausedThisSeason = true;
        state.autoPauseQueue.push({
          reason: 'water_stress',
          message: 'Some of your crops need water!',
        });
      }
    } else if (!state.waterStressPausedThisSeason) {
      // No irrigation tech or watering restricted — manual pause (once per season)
      state.waterStressPausedThisSeason = true;
      state.autoPauseQueue.push({
        reason: 'water_stress',
        message: 'Some of your crops need water!',
      });
    }
  }

  // --- Seasonal event queue processing ---
  if (!state.activeEvent) {
    for (const scheduled of state.seasonalEventQueue) {
      if (scheduled.consumed) continue;
      const storylet = STORYLETS.find(s => s.id === scheduled.storyletId);
      if (!storylet) { scheduled.consumed = true; continue; }

      if (storylet.foreshadowing && newTotalDay >= scheduled.appearsOnDay && newTotalDay < scheduled.firesOnDay) {
        // Create foreshadow notification — PendingForeshadow system takes over
        state.pendingForeshadows.push({
          storyletId: storylet.id,
          signal: storylet.foreshadowing.signal,
          appearsOnDay: newTotalDay,
          eventFiresOnDay: scheduled.firesOnDay,
          isFalseAlarm: scheduled.isFalseAlarm,
          advisorSource: storylet.foreshadowing.advisorSource,
          dismissed: false,
        });
        addNotification(state, 'foreshadowing', storylet.foreshadowing.signal);
        scheduled.consumed = true;
      } else if (!storylet.foreshadowing && newTotalDay >= scheduled.firesOnDay) {
        // Fire non-foreshadowed event directly
        state.activeEvent = {
          storyletId: storylet.id,
          title: storylet.title,
          description: storylet.description,
          choices: storylet.choices,
          firedOnDay: newTotalDay,
        };
        // Guardrail HIGH 2: use correct auto-pause reason based on storylet type
        state.autoPauseQueue.push({
          reason: storylet.type === 'advisor' ? 'advisor' : 'event',
          message: storylet.title,
        });
        logEventFired(state, storylet.id, storylet.type, storylet.title, storylet.choices.map(c => c.id));
        scheduled.consumed = true;
        break; // Only one event at a time
      }
    }
  }

  // --- Condition-only advisor events (per-tick) + foreshadow maturation ---
  const eventRng = new SeededRNG(state.eventRngState);
  const eventResult = evaluateEvents(state, STORYLETS, eventRng, { conditionOnlyAdvisors: true });
  state.eventRngState = eventRng.getState();

  // Process foreshadowing from condition-only advisors
  for (const foreshadow of eventResult.newForeshadows) {
    state.pendingForeshadows.push(foreshadow);
    addNotification(state, 'foreshadowing', foreshadow.signal);
  }

  // Fire condition-only advisor event (or foreshadow-matured event from Phase 1)
  if (eventResult.fireEvent) {
    const storylet = eventResult.fireEvent;
    state.activeEvent = {
      storyletId: storylet.id,
      title: storylet.title,
      description: storylet.description,
      choices: storylet.choices,
      firedOnDay: newTotalDay,
    };
    state.autoPauseQueue.push({
      reason: storylet.type === 'advisor' ? 'advisor' : 'event',
      message: storylet.title,
    });
    logEventFired(state, storylet.id, storylet.type, storylet.title, storylet.choices.map(c => c.id));
  }

  // Loan interest accrual (daily simple interest)
  if (state.economy.debt > 0) {
    const dailyInterest = state.economy.debt * (LOAN_INTEREST_RATE / DAYS_PER_YEAR);
    state.economy.debt += dailyInterest;
    state.economy.interestPaidThisYear += dailyInterest;

    // Debt spiral safety cap
    if (state.economy.debt > LOAN_DEBT_CAP) {
      state.gameOver = true;
      state.gameOverReason = 'debt_spiral';
      state.speed = 0;
      state.autoPauseQueue.push({
        reason: 'bankruptcy',
        message: `Your debt has exceeded $${LOAN_DEBT_CAP.toLocaleString()}. The bank has foreclosed on your farm.`,
        data: { debt: state.economy.debt },
      });
    }
  }

  // Year end check
  if (isYearEnd(newTotalDay)) {
    // Perennial year-end: age increment, establishment check, maintenance cost
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const cell = state.grid[row][col];
        if (cell.crop && cell.crop.isPerennial) {
          cell.crop.perennialAge++;
          const def = getCropDefinition(cell.crop.cropId);
          if (!cell.crop.perennialEstablished && def.yearsToEstablish &&
              cell.crop.perennialAge >= def.yearsToEstablish) {
            cell.crop.perennialEstablished = true;
          }
          // Reset harvestedThisSeason for ALL perennials at year-end
          // (handles both dormant perennials and evergreen citrus)
          cell.crop.harvestedThisSeason = false;
          // Deduct annual maintenance
          if (def.annualMaintenanceCost) {
            state.economy.cash -= def.annualMaintenanceCost;
            state.economy.yearlyExpenses += def.annualMaintenanceCost;
            state.tracking.currentExpenses.maintenance += def.annualMaintenanceCost;
          }
        }
      }
    }

    // Annual farm overhead: property taxes, insurance, base upkeep
    state.economy.cash -= ANNUAL_OVERHEAD;
    state.economy.yearlyExpenses += ANNUAL_OVERHEAD;
    state.tracking.currentExpenses.annualOverhead += ANNUAL_OVERHEAD;

    // Year-end snapshot (Slice 4a): capture tracking data BEFORE resetting
    const yearSnapshot = createYearSnapshot(state);
    state.tracking.yearSnapshots.push(yearSnapshot);

    // Cover crop usage: count as adaptation only if OM was declining (< 2.0%)
    if (yearSnapshot.coverCropCount >= 10 && yearSnapshot.avgOrganicMatter < 2.0) {
      state.tracking.coverCropYearsUsed++;
    }

    // Freeze expense breakdown for UI display, THEN reset
    const frozenExpenses = { ...state.tracking.currentExpenses };

    state.yearEndSummaryPending = true;
    state.autoPauseQueue.push({
      reason: 'year_end',
      message: `Year ${state.calendar.year} is complete.`,
      data: {
        year: state.calendar.year,
        revenue: state.economy.yearlyRevenue,
        expenses: state.economy.yearlyExpenses,
        netProfit: state.economy.yearlyRevenue - state.economy.yearlyExpenses,
        cash: state.economy.cash,
        debt: state.economy.debt,
        interestPaid: state.economy.interestPaidThisYear,
        expenseBreakdown: frozenExpenses,
      },
    });

    // Reset expense tracking for next year
    state.tracking.currentExpenses = createEmptyExpenseBreakdown();

    // Recompute stress level for upcoming year
    if (state.calendar.year < MAX_YEARS) {
      state.yearStressLevel = computeYearStressLevel(scenario, state.calendar.year + 1);
    }

    logYearEnd(state);
  }

  // Bankruptcy check (modified for Slice 2: loan offer on first insolvency)
  if (state.economy.cash <= 0 && !state.gameOver) {
    if (state.economy.totalLoansReceived === 0) {
      // First insolvency: offer emergency loan
      const loanAmount = computeLoanAmount(state.economy.cash);
      state.autoPauseQueue.push({
        reason: 'loan_offer',
        message: `You've run out of money. The bank is offering an emergency loan of $${loanAmount.toLocaleString()}.`,
        data: {
          loanAmount,
          interestRate: LOAN_INTEREST_RATE,
          cash: state.economy.cash,
        },
      });
      logLoanOffer(state, loanAmount);
      // Temporarily set gameOver (TAKE_LOAN clears it; declining = permanent)
      state.gameOver = true;
      state.gameOverReason = 'bankruptcy';
      state.speed = 0;
    } else {
      // Second insolvency: hard game over
      state.gameOver = true;
      state.gameOverReason = 'bankruptcy';
      state.speed = 0;
      state.autoPauseQueue.push({
        reason: 'bankruptcy',
        message: "You've run out of money again. With an outstanding loan, the bank can no longer help.",
        data: {
          cash: state.economy.cash,
          debt: state.economy.debt,
          yearlyRevenue: state.economy.yearlyRevenue,
          yearlyExpenses: state.economy.yearlyExpenses,
        },
      });
      logGameOver(state, 'bankruptcy');
    }
  }

  // Sort auto-pause queue by priority (most urgent first per SPEC §3.6)
  if (state.autoPauseQueue.length > 1) {
    state.autoPauseQueue.sort(
      (a, b) => AUTO_PAUSE_PRIORITY[b.reason] - AUTO_PAUSE_PRIORITY[a.reason],
    );
  }

  // Auto-pause: stop simulation if there are pending events
  if (state.autoPauseQueue.length > 0) {
    state.speed = 0;
  }

  // Validate state (catch NaN/Infinity bugs)
  assertFinite(state.economy.cash, 'economy.cash');

  return weather;
}

// ============================================================================
// Soil Simulation
// ============================================================================

function simulateSoil(cell: Cell, weather: DailyWeather): void {
  const soil = cell.soil;

  // Evapotranspiration (water loss)
  // Cover crop ET rules:
  //   crop + cover → max(cropKc, coverET)
  //   crop + no cover → cropKc
  //   empty + cover → coverET (replaces bare soil 0.3)
  //   empty + no cover → 0.3 (bare soil)
  let etMultiplier: number;
  if (cell.crop) {
    const cropKc = getCropCoefficient(cell.crop);
    if (cell.coverCropId) {
      const coverDef = getCoverCropDefinition(cell.coverCropId);
      etMultiplier = Math.max(cropKc, coverDef.winterETMultiplier);
    } else {
      etMultiplier = cropKc;
    }
  } else if (cell.coverCropId) {
    const coverDef = getCoverCropDefinition(cell.coverCropId);
    etMultiplier = coverDef.winterETMultiplier;
  } else {
    etMultiplier = 0.3; // Bare soil
  }

  const etLoss = weather.et0 * etMultiplier;
  soil.moisture = Math.max(0, soil.moisture - etLoss);

  // Precipitation (water gain)
  soil.moisture = Math.min(soil.moisture + weather.precipitation, soil.moistureCapacity);

  // Organic matter decomposition (~5%/year compound-daily of current OM)
  // Cover crop roots protect soil — halt decomposition when cover crop is present
  if (!cell.coverCropId) {
    const omDecompRate = OM_DECOMP_RATE / DAYS_PER_YEAR;
    soil.organicMatter = Math.max(OM_FLOOR, soil.organicMatter - soil.organicMatter * omDecompRate);
  }

  // Update moisture capacity based on OM
  soil.moistureCapacity = BASE_MOISTURE_CAPACITY + (soil.organicMatter - 2.0) * OM_MOISTURE_BONUS_PER_PERCENT;

  // Nitrogen mineralization from OM (~25 lbs N/year per 1% OM at rate 25)
  // At 2% OM: 50 lbs/year = 0.137 lbs/day. As OM declines, mineralization drops → progressive N decline
  const nMineralization = soil.organicMatter * N_MINERALIZATION_RATE / DAYS_PER_YEAR;
  soil.nitrogen = Math.min(soil.nitrogen + nMineralization, 200); // Cap at 200

  // Slice 5a: Potassium mineralization (natural slow recovery)
  const kMineralization = K_MINERALIZATION_RATE / DAYS_PER_YEAR;
  soil.potassium = Math.min(soil.potassium + kMineralization, K_MAX);

  assertFinite(soil.moisture, 'soil.moisture');
  assertFinite(soil.nitrogen, 'soil.nitrogen');
  assertFinite(soil.organicMatter, 'soil.organicMatter');
  assertFinite(soil.potassium, 'soil.potassium');
}

// ============================================================================
// Crop Simulation
// ============================================================================

function simulateCrop(cell: Cell, weather: DailyWeather, state: GameState, scenario: ClimateScenario): void {
  const crop = cell.crop!;
  const cropDef = getCropDefinition(crop.cropId);

  // --- Perennial dormancy management ---
  if (crop.isPerennial && cropDef.dormantSeasons) {
    const shouldBeDormant = cropDef.dormantSeasons.includes(state.calendar.season);
    if (shouldBeDormant && !crop.isDormant) {
      // Enter dormancy: reset chill accumulation for this winter
      crop.isDormant = true;
      crop.chillHoursAccumulated = 0;
      // Reset harvestable/overripe state — dormant trees aren't harvestable
      if (crop.growthStage === 'harvestable' || crop.growthStage === 'overripe') {
        crop.growthStage = 'mature';
        crop.overripeDaysRemaining = -1;
      }
      // Fall through to dormant block below for first day's accumulation
    } else if (!shouldBeDormant && crop.isDormant) {
      // Spring awakening: exit dormancy, reset GDD for new growing season
      // Chill hours are PRESERVED — they represent last winter's total
      crop.isDormant = false;
      crop.gddAccumulated = 0;
      crop.waterStressDays = 0;
      crop.plantedDay = state.calendar.totalDay; // Fix #1: reset so water-stress denominator matches current season
      crop.harvestedThisSeason = false;           // Fix #2: allow one harvest per growing season
      crop.growthStage = 'seedling';
      crop.overripeDaysRemaining = -1;
    }
    if (crop.isDormant) {
      // Accumulate chill hours during dormancy (if crop requires chill)
      if (cropDef.chillHoursRequired !== undefined) {
        const yearIndex = Math.max(0, Math.min(state.calendar.year - 1, scenario.years.length - 1));
        const yearChillHours = scenario.years[yearIndex].chillHours;
        const dailyChill = yearChillHours / DORMANCY_DAYS;
        crop.chillHoursAccumulated += dailyChill;
      }
      // No GDD accumulation, no growth during dormancy. Reduced water use via kc.
      return;
    }
  }

  // Overripe countdown
  if (crop.growthStage === 'overripe') {
    crop.overripeDaysRemaining--;
    if (crop.overripeDaysRemaining <= 0) {
      if (crop.isPerennial) {
        // Perennial survives overripe — yield=0 that year, reset for next season
        crop.growthStage = 'mature';
        crop.overripeDaysRemaining = -1;
        crop.gddAccumulated = cropDef.gddToMaturity * 0.8; // reset to mature stage
        crop.harvestedThisSeason = true; // prevent regrowth to harvestable this season
        addNotification(state, 'info',
          `Your ${cropDef.name} in row ${cell.row + 1} missed the harvest window. No yield this season, but the trees survive.`);
        return;
      }
      // Annual crop rots — total loss
      addNotification(state, 'crop_rotted',
        `Your ${cropDef.name} in row ${cell.row + 1} rotted in the field. Total loss.`);
      cell.crop = null;
      return;
    }
    return; // No further growth for overripe
  }

  // Harvestable: start overripe countdown
  if (crop.growthStage === 'harvestable') {
    crop.growthStage = 'overripe';
    crop.overripeDaysRemaining = OVERRIPE_GRACE_DAYS;
    return;
  }

  // GDD accumulation
  const avgTemp = (weather.tempHigh + weather.tempLow) / 2;
  const gdd = Math.max(0, avgTemp - cropDef.gddBase);
  crop.gddAccumulated += gdd;

  // Water stress tracking
  if (cell.soil.moisture < cell.soil.moistureCapacity * 0.15) {
    crop.waterStressDays++;
  }

  // NOTE: Nitrogen is consumed at harvest (harvestCell), not during daily growth.
  // This allows soil.nitrogen to accumulate via mineralization between harvests,
  // creating progressive yield decline as OM drops → less mineralization → less N at harvest.

  // Growth stage transitions
  const progress = crop.gddAccumulated / cropDef.gddToMaturity;
  if (crop.isPerennial && !crop.perennialEstablished) {
    // During establishment: cap growth at vegetative (no fruit production)
    crop.growthStage = getGrowthStage(Math.min(progress, 0.49));
  } else if (crop.isPerennial && crop.harvestedThisSeason) {
    // Already harvested this season — cap at mature, don't re-enter harvestable
    crop.gddAccumulated = Math.min(crop.gddAccumulated, cropDef.gddToMaturity * 0.99);
    crop.growthStage = getGrowthStage(Math.min(progress, 0.99));
  } else {
    crop.growthStage = getGrowthStage(progress);
  }
}

function getGrowthStage(progress: number): GrowthStage {
  if (progress >= 1.0) return 'harvestable';
  if (progress >= 0.8) return 'mature';
  if (progress >= 0.5) return 'flowering';
  if (progress >= 0.2) return 'vegetative';
  return 'seedling';
}

function getCropCoefficient(crop: CropInstance): number {
  if (crop.isPerennial && crop.isDormant) return 0.2; // Reduced water use during dormancy
  const cropDef = getCropDefinition(crop.cropId);
  const entry = cropDef.cropCoefficients.find(c => c.stage === crop.growthStage);
  return entry ? entry.kc : 0.5;
}

// ============================================================================
// Perennial Yield Curve
// ============================================================================

/**
 * Piecewise-linear age factor for perennial yield.
 * Phase 1: Ramp (0.6→0.8→1.0 over rampUpYears)
 * Phase 2: Peak (1.0)
 * Phase 3: Decline (linear from 1.0 to declineFloor)
 * Phase 4: Floor (declineFloor, tree still alive)
 */
export function getPerennialAgeFactor(crop: CropInstance, cropDef: CropDefinition): number {
  if (!crop.isPerennial || !crop.perennialEstablished) return 1.0;
  if (!cropDef.yieldCurve) return 1.0;

  const yp = crop.perennialAge - (cropDef.yearsToEstablish ?? 0);
  const curve = cropDef.yieldCurve;

  if (yp < 0) return 0;

  // Ramp phase: 0.6 + 0.4 * (yp / (rampUpYears - 1))
  if (yp < curve.rampUpYears) {
    if (curve.rampUpYears <= 1) return 1.0;
    return 0.6 + 0.4 * (yp / (curve.rampUpYears - 1));
  }

  // Peak phase
  if (yp < curve.declineStartYear) return 1.0;

  // Past end of life → floor
  if (yp >= curve.endOfLifeYear) return curve.declineFloor;

  // Decline phase: linear from 1.0 to declineFloor
  const declineDuration = curve.endOfLifeYear - curve.declineStartYear;
  if (declineDuration === 0) return curve.declineFloor;
  const yearsInDecline = yp - curve.declineStartYear;
  return 1.0 - (1.0 - curve.declineFloor) * (yearsInDecline / declineDuration);
}

/** UI phase label for perennial crops. */
export function getPerennialPhase(crop: CropInstance, cropDef: CropDefinition): string {
  if (!crop.perennialEstablished) return 'Establishing';
  if (!cropDef.yieldCurve) return 'Peak Production';

  const yp = crop.perennialAge - (cropDef.yearsToEstablish ?? 0);
  const curve = cropDef.yieldCurve;

  if (yp < 0) return 'Establishing';
  if (yp < curve.rampUpYears) return 'Ramping Up';
  if (yp < curve.declineStartYear) return 'Peak Production';
  if (yp >= curve.endOfLifeYear) return 'Past Prime';
  return 'Declining';
}

// ============================================================================
// Organic Matter Yield Factor (Slice 4c)
// ============================================================================

/** Linear interpolation: 1.0 at OM_YIELD_THRESHOLD, OM_YIELD_FLOOR at OM_FLOOR. */
export function computeOMYieldFactor(organicMatter: number): number {
  if (organicMatter >= OM_YIELD_THRESHOLD) return 1.0;
  const range = OM_YIELD_THRESHOLD - OM_FLOOR;
  return Math.max(OM_YIELD_FLOOR,
    OM_YIELD_FLOOR + (1 - OM_YIELD_FLOOR) * (organicMatter - OM_FLOOR) / range);
}

// ============================================================================
// Harvest Calculation
// ============================================================================

export function harvestCell(state: GameState, cell: Cell, silent?: boolean): number {
  const crop = cell.crop!;
  const cropDef = getCropDefinition(crop.cropId);

  // Base yield — perennials yield 0 during establishment
  let yieldAmount = cropDef.yieldPotential;
  if (crop.isPerennial && !crop.perennialEstablished) {
    yieldAmount = 0;
  }

  // Water stress factor: 1 - ky * (stressDays / totalGrowingDays)
  const totalGrowingDays = Math.max(1, state.calendar.totalDay - crop.plantedDay);
  const waterStressFraction = crop.waterStressDays / totalGrowingDays;
  const waterFactor = Math.max(0, 1 - cropDef.ky * waterStressFraction);
  yieldAmount *= waterFactor;

  // Nitrogen factor: soil N accumulated since last harvest via mineralization
  // As OM declines, mineralization drops → less N available → progressive yield decline
  const nFactor = Math.min(1, (cell.soil.nitrogen + cropDef.nitrogenUptake * NITROGEN_CUSHION_FACTOR) / cropDef.nitrogenUptake);
  yieldAmount *= nFactor;

  // Consume nitrogen at harvest (crop uptake removes accumulated soil N)
  cell.soil.nitrogen = Math.max(0, cell.soil.nitrogen - cropDef.nitrogenUptake);

  // Organic matter yield factor (Slice 4c): soil depletion reduces yields
  const omFactor = computeOMYieldFactor(cell.soil.organicMatter);
  yieldAmount *= omFactor;

  // Overripe penalty (linear decay over 30-day grace period)
  if (crop.growthStage === 'overripe') {
    const overripeFactor = crop.overripeDaysRemaining / OVERRIPE_GRACE_DAYS;
    yieldAmount *= overripeFactor;
  }

  // Apply event yield modifier
  const yieldMod = getYieldModifier(state, crop.cropId);
  yieldAmount *= yieldMod;

  // Chill hour penalty for established perennials
  // Canonical formula: clamp(accumulated / required, 0, 1)
  // Skip if: chillHoursRequired is undefined (annuals), or not established (yield already 0)
  if (cropDef.chillHoursRequired !== undefined && crop.isPerennial && crop.perennialEstablished) {
    const chillFactor = cropDef.chillHoursRequired === 0
      ? 1.0
      : Math.min(1.0, Math.max(0, crop.chillHoursAccumulated / cropDef.chillHoursRequired));
    yieldAmount *= chillFactor;
    if (chillFactor < 1.0) {
      const deficit = cropDef.chillHoursRequired - crop.chillHoursAccumulated;
      const pctLoss = Math.round((1 - chillFactor) * 100);
      addNotification(state, 'info',
        `${cropDef.name}: insufficient chill hours (${Math.round(crop.chillHoursAccumulated)}/${cropDef.chillHoursRequired}). Yield reduced by ${pctLoss}% (deficit: ${Math.round(deficit)} hours).`);
    }
  }

  // Perennial age factor (ramp → peak → decline → floor)
  const ageFactor = getPerennialAgeFactor(crop, cropDef);
  yieldAmount *= ageFactor;

  // Slice 5a: Heat regime penalty for heat-sensitive crops
  if (state.flags['regime_heat_threshold'] && cropDef.heatSensitivity !== undefined) {
    yieldAmount *= cropDef.heatSensitivity;
  }

  yieldAmount = Math.max(0, yieldAmount);

  // Slice 5a: K-lite — potassium affects price quality, not yield
  const kFactor = Math.min(1.0, Math.max(K_PRICE_FLOOR,
    cell.soil.potassium / cropDef.potassiumUptake));

  // Apply event price modifier
  const priceMod = getPriceModifier(state, crop.cropId);

  // Slice 5a: Market crash regime reduces all prices
  const regimePriceMod = state.flags['regime_market_crash'] ? REGIME_MARKET_CRASH_FACTOR : 1.0;

  const actualPrice = cropDef.basePrice * priceMod * kFactor * regimePriceMod;

  const grossRevenue = yieldAmount * actualPrice;
  const laborCost = cropDef.laborCostPerAcre;

  // Step 1-2: Add gross revenue to cash and yearly tracking
  state.economy.cash += grossRevenue;
  state.economy.yearlyRevenue += grossRevenue;
  state.economy.yearlyExpenses += laborCost;
  state.economy.cash -= laborCost;
  state.tracking.currentExpenses.harvestLabor += laborCost;

  // Step 3: Loan repayment — 20% of GROSS harvest revenue
  let repayment = 0;
  if (state.economy.debt > 0) {
    repayment = Math.min(grossRevenue * LOAN_REPAYMENT_FRACTION, state.economy.debt);
    state.economy.cash -= repayment;
    state.economy.debt -= repayment;
    state.economy.yearlyExpenses += repayment;
    state.tracking.currentExpenses.loanRepayment += repayment;
  }

  const netRevenue = grossRevenue - laborCost - repayment;

  if (!silent) {
    if (repayment > 0) {
      addNotification(state, 'harvest',
        `Harvested ${cropDef.name}: ${yieldAmount.toFixed(1)} ${cropDef.yieldUnit} at $${actualPrice.toFixed(2)}/${cropDef.yieldUnit} = $${grossRevenue.toFixed(0)} (labor: $${laborCost}, loan repayment: $${repayment.toFixed(0)})`);
    } else {
      addNotification(state, 'harvest',
        `Harvested ${cropDef.name}: ${yieldAmount.toFixed(1)} ${cropDef.yieldUnit} at $${actualPrice.toFixed(2)}/${cropDef.yieldUnit} = $${grossRevenue.toFixed(0)} (labor: $${laborCost})`);
    }
  }

  // Slice 5a: K depletion at harvest
  cell.soil.potassium = Math.max(0, cell.soil.potassium - cropDef.potassiumUptake);

  // Slice 5a: K symptom cues — always notify when quality is affected, but
  // reveal "potassium" only if player has soil testing. Non-testers get symptom language.
  if (!silent && kFactor < K_SYMPTOM_THRESHOLD) {
    if (state.flags['tech_soil_testing']) {
      const pctLoss = Math.round((1 - kFactor) * 100);
      addNotification(state, 'info',
        `${cropDef.name}: low potassium reduced crop quality. Price reduced by ${pctLoss}%.`);
    } else {
      addNotification(state, 'info',
        `${cropDef.name}: crop quality is declining — nutrient deficiency suspected.`);
    }
  }

  // Track yield ratio for adaptation scoring (before price/economic multipliers)
  cell.lastHarvestYieldRatio = cropDef.yieldPotential > 0 ? yieldAmount / cropDef.yieldPotential : 0;

  if (crop.isPerennial) {
    // Perennial: reset for next season but keep the crop
    crop.growthStage = 'mature';
    crop.gddAccumulated = cropDef.gddToMaturity * 0.8; // back to mature stage
    crop.overripeDaysRemaining = -1;
    crop.waterStressDays = 0;
    crop.plantedDay = state.calendar.totalDay; // Fix #1: reset so next season's water-stress denominator is fresh
    crop.harvestedThisSeason = true;           // Fix #2: prevent multiple harvests per season
  } else {
    // Annual: set lastCropId at harvest time (perennials set at planting)
    cell.lastCropId = crop.cropId;
    cell.crop = null;
  }

  assertFinite(state.economy.cash, 'economy.cash after harvest');
  return netRevenue;
}

// ============================================================================
// Year-End Snapshot (Slice 4a)
// ============================================================================

function createYearSnapshot(state: GameState): YearSnapshot {
  let totalOM = 0;
  let totalN = 0;
  let coverCropCount = 0;
  const cropCounts: Record<string, number> = {};

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const cell = state.grid[r][c];
      totalOM += cell.soil.organicMatter;
      totalN += cell.soil.nitrogen;
      if (cell.coverCropId) coverCropCount++;
      if (cell.crop) {
        cropCounts[cell.crop.cropId] = (cropCounts[cell.crop.cropId] ?? 0) + 1;
      }
    }
  }

  const totalCells = GRID_ROWS * GRID_COLS;
  return {
    year: state.calendar.year,
    revenue: state.economy.yearlyRevenue,
    expenses: { ...state.tracking.currentExpenses },
    cashAtYearEnd: state.economy.cash,
    avgOrganicMatter: totalOM / totalCells,
    avgNitrogen: totalN / totalCells,
    cropCounts,
    coverCropCount,
    eventsReceived: state.eventLog.filter(
      e => e.day >= (state.calendar.year - 1) * DAYS_PER_YEAR && e.day <= state.calendar.totalDay
    ).length,
  };
}

// ============================================================================
// Year-End Reset
// ============================================================================

export function resetYearlyTracking(state: GameState): void {
  state.economy.yearlyRevenue = 0;
  state.economy.yearlyExpenses = 0;
  state.economy.interestPaidThisYear = 0;
  state.yearEndSummaryPending = false;
}

// ============================================================================
// Helpers
// ============================================================================

function createCropInstance(cropId: string, plantedDay: number): CropInstance {
  const def = getCropDefinition(cropId);
  return {
    cropId,
    plantedDay,
    gddAccumulated: 0,
    waterStressDays: 0,
    growthStage: 'seedling',
    overripeDaysRemaining: -1,
    isPerennial: def.type === 'perennial',
    perennialAge: 0,
    perennialEstablished: false,
    isDormant: false,
    harvestedThisSeason: false,
    chillHoursAccumulated: 0,
  };
}

function getCell(state: GameState, row: number, col: number): Cell | null {
  if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return null;
  return state.grid[row][col];
}

function getCellsInScope(state: GameState, scope: 'all' | 'row' | 'col', index?: number): Cell[] {
  const cells: Cell[] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (scope === 'all' || (scope === 'row' && r === index) || (scope === 'col' && c === index)) {
        cells.push(state.grid[r][c]);
      }
    }
  }
  return cells;
}

function getEmptyCells(state: GameState, scope: 'all' | 'row' | 'col', index?: number): Cell[] {
  return getCellsInScope(state, scope, index).filter(c => c.crop === null);
}

function getHarvestableCells(state: GameState, scope: 'all' | 'row' | 'col', index?: number): Cell[] {
  return getCellsInScope(state, scope, index).filter(
    c => c.crop !== null &&
      (c.crop.growthStage === 'harvestable' || c.crop.growthStage === 'overripe') &&
      !c.crop.isDormant &&
      !(c.crop.isPerennial && c.crop.harvestedThisSeason),
  );
}

function groupByRow(cells: Cell[]): Map<number, Cell[]> {
  const map = new Map<number, Cell[]>();
  // Sort by row to maintain top-to-bottom fill order
  const sorted = [...cells].sort((a, b) => a.row - b.row || a.col - b.col);
  for (const cell of sorted) {
    const existing = map.get(cell.row);
    if (existing) {
      existing.push(cell);
    } else {
      map.set(cell.row, [cell]);
    }
  }
  return map;
}

const MAX_NOTIFICATIONS = 30;

export function addNotification(state: GameState, type: Notification['type'], message: string): void {
  state.notifications.push({
    id: state.nextNotificationId++,
    type,
    message,
    day: state.calendar.totalDay,
  });
  // #61: Cap notifications — drop oldest when exceeding limit
  while (state.notifications.length > MAX_NOTIFICATIONS) {
    state.notifications.shift();
  }
}

export function dismissNotification(state: GameState, notificationId: number): void {
  state.notifications = state.notifications.filter(n => n.id !== notificationId);
}

export function dismissAutoPause(state: GameState): void {
  const dismissed = state.autoPauseQueue.shift();

  // If dismissing an event/advisor auto-pause without responding,
  // clear the activeEvent to prevent deadlock (evaluateEvents blocks
  // while activeEvent is set).
  if (dismissed && (dismissed.reason === 'event' || dismissed.reason === 'advisor')) {
    if (state.activeEvent) {
      // Log the event as dismissed (no choice made)
      state.eventLog.push({
        storyletId: state.activeEvent.storyletId,
        day: state.calendar.totalDay,
        choiceId: '__dismissed__',
      });
      state.activeEvent = null;
    }
  }
}

/** Get available crops for the current planting window */
export function getAvailableCrops(state: GameState): string[] {
  const { month } = state.calendar;
  return getAllCropIds().filter(id => {
    const def = getCropDefinition(id);
    // Slice 5a: Exclude crops gated by a flag the player hasn't unlocked
    if (def.requiredFlag && !state.flags[def.requiredFlag]) return false;
    return isInPlantingWindow(month, def.plantingWindow.startMonth, def.plantingWindow.endMonth);
  });
}

/**
 * Select a message from a variety pool using the provided RNG.
 * Used by message variety system to prevent players reading the same text twice.
 */
export function pickMessage(pool: readonly string[], rng: SeededRNG): string {
  const index = Math.floor(rng.next() * pool.length);
  return pool[index];
}

/** Calculate yield percentage for a crop (for display during overripe period) */
export function getYieldPercentage(crop: CropInstance): number {
  if (crop.growthStage === 'overripe') {
    return Math.max(0, (crop.overripeDaysRemaining / OVERRIPE_GRACE_DAYS) * 100);
  }
  if (crop.growthStage === 'harvestable') return 100;
  return 0; // Not harvestable yet
}

/** Get growth progress as a 0–1 fraction */
export function getGrowthProgress(crop: CropInstance): number {
  const cropDef = getCropDefinition(crop.cropId);
  return Math.min(1, crop.gddAccumulated / cropDef.gddToMaturity);
}
