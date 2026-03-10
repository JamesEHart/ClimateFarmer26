// ============================================================================
// Core Engine Types — ClimateFarmer26
// All game state types. Pure data, no logic. Serializable for save/load.
// ============================================================================

import type {
  ActiveEvent, EventOccurrence, ActiveEffect, PendingForeshadow, ScheduledEvent,
} from './events/types.ts';

// --- Calendar ---

export type Season = 'spring' | 'summer' | 'fall' | 'winter';

export interface CalendarDate {
  day: number;        // 1-365 within the year
  month: number;      // 1-12
  season: Season;
  year: number;       // 1-30
  totalDay: number;   // absolute day since game start (0-indexed, used by engine)
}

// --- Commands ---

export type Command =
  | { type: 'PLANT_CROP'; cellRow: number; cellCol: number; cropId: string }
  | { type: 'PLANT_BULK'; scope: 'all' | 'row' | 'col'; index?: number; cropId: string }
  | { type: 'HARVEST'; cellRow: number; cellCol: number }
  | { type: 'HARVEST_BULK'; scope: 'all' | 'row' | 'col'; index?: number }
  | { type: 'WATER'; scope: 'all' | 'row' | 'col'; index?: number }
  | { type: 'SET_SPEED'; speed: GameSpeed }
  // Slice 2a: Event system + loans
  | { type: 'RESPOND_EVENT'; eventId: string; choiceId: string }
  | { type: 'TAKE_LOAN' }  // parameterless — amount is engine-computed
  // Slice 2b: Perennial removal
  | { type: 'REMOVE_CROP'; cellRow: number; cellCol: number }
  // Slice 3b: Cover crops
  | { type: 'SET_COVER_CROP'; cellRow: number; cellCol: number; coverCropId: string | null }
  | { type: 'SET_COVER_CROP_BULK'; scope: 'all' | 'row' | 'col'; index?: number; coverCropId: string | null };

export type GameSpeed = 0 | 1 | 2 | 4;

export interface CommandResult {
  success: boolean;
  reason?: string;
  /** For bulk ops: how many cells were affected */
  cellsAffected?: number;
  /** For harvest: total revenue earned */
  revenue?: number;
  /** For plant/water: total cost */
  cost?: number;
  /** For partial bulk ops: dialog info */
  partialOffer?: {
    affordableRows: number;
    affordablePlots: number;
    totalCost: number;
  };
}

// --- Climate Scenario ---

export interface SeasonParams {
  avgTempHigh: number;        // °F
  avgTempLow: number;         // °F
  tempVariance: number;       // daily deviation range in °F
  precipProbability: number;  // 0-1 chance of rain per day
  precipIntensity: number;    // inches when it rains
  avgET0: number;             // reference evapotranspiration (inches/day)
  heatwaveProbability: number;// 0-1 chance of multi-day heat event per season
  frostProbability: number;   // 0-1 chance of frost event per season
}

export interface YearClimate {
  year: number;
  seasons: {
    spring: SeasonParams;
    summer: SeasonParams;
    fall: SeasonParams;
    winter: SeasonParams;
  };
  waterAllocation: number;    // 0-1 fraction of normal allocation (future: caps irrigation availability)
  chillHours: number;          // total chill hours available this winter (declines over 30 years)
}

export interface ClimateScenario {
  id: string;
  name: string;
  description: string;
  seed: number;
  years: YearClimate[];       // 30 entries
  // Slice 5c: Scenario-specific market crash targeting
  marketCrashTargetCropId?: string;  // which crop's price crashes (e.g., 'almonds')
  marketCrashFactor?: number;        // price multiplier (e.g., 0.70 = 30% drop)
}

// --- Daily Weather (generated from scenario params) ---

export interface DailyWeather {
  tempHigh: number;           // °F
  tempLow: number;            // °F
  precipitation: number;      // inches
  et0: number;                // reference evapotranspiration
  isHeatwave: boolean;
  isFrost: boolean;
}

// --- Crop Definitions ---

export interface CropDefinition {
  id: string;
  name: string;
  type: 'annual' | 'perennial';

  // Growth
  gddBase: number;            // base temperature °F for GDD calculation
  gddToMaturity: number;      // cumulative GDD needed to reach harvestable
  plantingWindow: { startMonth: number; endMonth: number };

  // Water
  waterUsePerDay: number;     // inches/day at peak Kc
  cropCoefficients: { stage: GrowthStage; kc: number }[];
  ky: number;                 // yield response to water stress

  // Nutrients
  nitrogenUptake: number;     // lbs/acre removed at full yield
  potassiumUptake: number;    // lbs/acre removed at full yield (Slice 5a: K-lite)

  // Economics
  yieldPotential: number;     // units/acre at maximum
  yieldUnit: string;          // e.g., "tons", "bu"
  basePrice: number;          // $/unit
  seedCostPerAcre: number;
  laborCostPerAcre: number;

  // Perennial-only fields (undefined for annuals)
  yearsToEstablish?: number;          // almonds: 3, pistachios: 4
  removalCost?: number;               // cost to clear a perennial from a cell
  annualMaintenanceCost?: number;     // deducted at year-end per perennial cell
  dormantSeasons?: Season[];          // seasons where crop goes dormant (typically ['winter'])
  productiveLifespan?: number;        // almonds: 22, pistachios: 25, citrus: 35
  chillHoursRequired?: number;        // chill hours needed for full yield
  yieldCurve?: {                      // Piecewise-linear yield curve for perennials
    rampUpYears: number;              // years post-establishment to reach peak (3)
    declineStartYear: number;         // years post-establishment when decline begins
    endOfLifeYear: number;            // years post-establishment when floor is reached
    declineFloor: number;             // minimum yield fraction (0.2-0.3)
  };

  // Slice 5a: Tech gating + heat sensitivity
  requiredFlag?: string;               // flag that must be true to plant this crop
  heatSensitivity?: number;            // yield multiplier under regime_heat_threshold (e.g. 0.75 = 25% loss)

  // Display
  shortDescription: string;
}

export type GrowthStage = 'seedling' | 'vegetative' | 'flowering' | 'mature' | 'harvestable' | 'overripe';

// --- Farm Grid ---

export interface CropInstance {
  cropId: string;
  plantedDay: number;         // totalDay when planted
  gddAccumulated: number;
  waterStressDays: number;
  growthStage: GrowthStage;
  overripeDaysRemaining: number; // 30 → 0, then crop rots. -1 means not overripe.
  // Slice 2b: Perennial tracking (defaults to false/0 for annuals)
  isPerennial: boolean;
  perennialAge: number;
  perennialEstablished: boolean;
  isDormant: boolean;
  harvestedThisSeason: boolean;
  chillHoursAccumulated: number;
}

export interface SoilState {
  nitrogen: number;           // lbs/acre
  organicMatter: number;      // percentage (e.g., 2.0)
  moisture: number;           // inches
  moistureCapacity: number;   // max inches (function of OM)
  potassium: number;          // lbs/acre (Slice 5a: K-lite)
}

export interface Cell {
  row: number;
  col: number;
  crop: CropInstance | null;
  soil: SoilState;
  coverCropId: string | null;
  // Slice 4a: Tracking for adaptation scoring
  lastCropId: string | null;
  lastHarvestYieldRatio: number | null;
  // Slice 5d: Monoculture streak counter (optional for save compat, default 0)
  consecutiveSameCropCount?: number;
}

// --- Tracking (Slice 4a) ---

export interface ExpenseBreakdown {
  planting: number;
  watering: number;
  harvestLabor: number;
  maintenance: number;
  loanRepayment: number;
  removal: number;
  coverCrops: number;
  eventCosts: number;
  annualOverhead: number;
}

export interface YearSnapshot {
  year: number;
  revenue: number;
  expenses: ExpenseBreakdown;
  cashAtYearEnd: number;
  avgOrganicMatter: number;
  avgNitrogen: number;
  cropCounts: Record<string, number>;
  coverCropCount: number;
  eventsReceived: number;
}

export interface TrackingState {
  yearSnapshots: YearSnapshot[];
  currentExpenses: ExpenseBreakdown;
  cropTransitions: number;
  droughtTolerantTypesAdopted: string[];
  coverCropYearsUsed: number;
}

// --- Economy ---

export interface EconomyState {
  cash: number;
  yearlyRevenue: number;
  yearlyExpenses: number;
  // Slice 2a: Loan system
  debt: number;
  totalLoansReceived: number; // 0 or 1 (max 1 in Slice 2)
  interestPaidThisYear: number;
}

// --- Notifications ---

export type NotificationType =
  | 'info'
  | 'harvest'
  | 'season_change'
  | 'year_end'
  | 'water_warning'
  | 'nitrogen_warning'
  | 'crop_rotted'
  | 'bankruptcy'
  // Slice 2a
  | 'foreshadowing'
  | 'event_result'
  | 'loan';

export interface Notification {
  id: number;
  type: NotificationType;
  message: string;
  day: number;                // totalDay when generated
}

// --- Auto-Pause ---

export type AutoPauseReason =
  | 'harvest_ready'
  | 'water_stress'
  | 'bankruptcy'
  | 'year_end'
  | 'year_30'
  // Slice 2a
  | 'loan_offer'
  | 'event'
  | 'advisor';

export interface AutoPauseEvent {
  reason: AutoPauseReason;
  message: string;
  data?: Record<string, unknown>;
}

/** Priority for auto-pause events. Higher = more urgent = shown first. */
export const AUTO_PAUSE_PRIORITY: Record<AutoPauseReason, number> = {
  bankruptcy: 100,
  year_30: 100,
  loan_offer: 95,
  event: 85,
  advisor: 82,
  harvest_ready: 80,
  water_stress: 60,
  year_end: 40,
};

// --- Full Game State ---

export interface GameState {
  calendar: CalendarDate;
  speed: GameSpeed;
  grid: Cell[][];             // 8x8 — grid[row][col]
  economy: EconomyState;
  notifications: Notification[];
  autoPauseQueue: AutoPauseEvent[];
  playerId: string;
  scenarioId: string;
  rngState: number;           // for save/resume determinism
  waterStressPausedThisSeason: boolean; // DD-5: only auto-pause once per season
  activeHeatwaveDays: number; // remaining days of current heatwave event (0 = none)
  activeFrostDays: number;    // remaining days of current frost event (0 = none)
  nextNotificationId: number;
  gameOver: boolean;
  gameOverReason?: string;
  yearEndSummaryPending: boolean;
  // Slice 2a: Event system
  eventLog: EventOccurrence[];
  activeEvent: ActiveEvent | null;
  pendingForeshadows: PendingForeshadow[];
  activeEffects: ActiveEffect[];
  cropFailureStreak: number;
  flags: Record<string, boolean>;
  wateringRestricted: boolean;
  wateringRestrictionEndsDay: number;
  eventRngState: number;      // separate RNG for events (seeded from mainSeed + 10000)
  // Slice 3c: Weather advisor frost protection
  frostProtectionEndsDay: number; // 0 = inactive; active when totalDay < this value
  // Slice 4a: Tracking, event clustering, UX
  tracking: TrackingState;
  eventsThisSeason: number;
  actedSincePause: boolean;
  // Slice 4b.5: Seasonal event draw
  seasonalEventQueue: ScheduledEvent[];
  yearStressLevel: number;
  // Slice 5b: Auto-irrigation message rotation (no-repeat guarantee)
  autoIrrigationMsgIdx?: number;
  // Slice 5c: Message variety rotation indices
  waterStressMsgIdx?: number;
  seasonChangeMsgIdx?: number;
}

// --- Save/Load ---

export interface SaveGame {
  version: string;
  state: GameState;
  timestamp: number;
}

// --- Constants ---

export const GRID_ROWS = 8;
export const GRID_COLS = 8;
export const MAX_YEARS = 30;
export const DAYS_PER_YEAR = 365;
export const OVERRIPE_GRACE_DAYS = 30;
export const STARTING_CASH = 50_000;
export const ANNUAL_OVERHEAD = 2_000; // property taxes, insurance, base farm upkeep (deducted at year-end)
export const STARTING_NITROGEN = 99;
export const STARTING_ORGANIC_MATTER = 2.0;
export const STARTING_MOISTURE = 4.0;
export const BASE_MOISTURE_CAPACITY = 6.0;
export const OM_MOISTURE_BONUS_PER_PERCENT = 0.8; // inches per 1% OM
export const WATER_STRESS_AUTOPAUSE_THRESHOLD = 0.25; // 25% of capacity
export const WATER_VISUAL_WARNING_THRESHOLD = 0.30;
export const WATER_WILTING_THRESHOLD = 0.15;
export const NITROGEN_HIGH_THRESHOLD = 80;
export const NITROGEN_MODERATE_THRESHOLD = 40;
export const IRRIGATION_COST_PER_CELL = 8; // $ per cell per watering (4c: raised from 5; reduced from 24 after overhead)
export const WATER_DOSE_INCHES = 3.0; // inches per watering action (~14 days worth at typical ET)
export const STARTING_DAY = 59; // March 1 (0-indexed totalDay) — Spring start per SPEC
export const SAVE_VERSION = '8.0.0';

// Slice 5a: K-lite constants
export const STARTING_POTASSIUM = 150;      // lbs/acre — initial K for all cells
export const K_MAX = 200;                    // lbs/acre — mineralization cap
export const K_MINERALIZATION_RATE = 15;     // lbs/acre/year from natural cycling
export const K_PRICE_FLOOR = 0.70;           // minimum K factor on harvest price
export const K_SYMPTOM_THRESHOLD = 0.85;     // K factor below which symptoms appear

// Slice 5a: Auto-irrigation cost multipliers by water tech level
export const AUTO_IRRIGATION_COST_MULTIPLIERS: Record<number, number> = {
  1: 0.70,  // basic drip/smart — 70% of manual cost
  2: 0.50,  // recycling/advanced — 50%
  3: 0.35,  // AI — 35%
};

// Slice 5a: Regime shift modifiers
export const REGIME_WATER_REDUCTION = 0.80;  // 20% less effective watering
export const REGIME_MARKET_CRASH_FACTOR = 0.70; // 30% price reduction


export function createEmptyExpenseBreakdown(): ExpenseBreakdown {
  return { planting: 0, watering: 0, harvestLabor: 0, maintenance: 0, loanRepayment: 0, removal: 0, coverCrops: 0, eventCosts: 0, annualOverhead: 0 };
}

export function createEmptyTrackingState(): TrackingState {
  return {
    yearSnapshots: [],
    currentExpenses: createEmptyExpenseBreakdown(),
    cropTransitions: 0,
    droughtTolerantTypesAdopted: [],
    coverCropYearsUsed: 0,
  };
}

/** Number of days in the dormant season (Dec + Jan + Feb = 90). Tied to SEASON_MAP. */
export const DORMANCY_DAYS = 90;

// Organic matter yield penalty constants (Slice 4c)
export const OM_FLOOR = 0.5;             // Minimum OM% — single source of truth for decomposition floor + yield calc
export const OM_YIELD_THRESHOLD = 2.0;   // No yield penalty at or above this OM%
export const OM_YIELD_FLOOR = 0.40;      // Minimum omFactor (yield multiplier at OM_FLOOR)

// Nitrogen yield constants
export const NITROGEN_CUSHION_FACTOR = 0.10; // nFactor floor at 0 soil nitrogen (tuned for balance)
export const N_MINERALIZATION_RATE = 10;     // lbs N per year per 1% OM (tuned: realistic ~20-30, reduced for game balance)

// Organic matter decomposition rate (annual, applied compound-daily)
// 6%/year under monoculture without cover crops — visible decline within 30-year game
export const OM_DECOMP_RATE = 0.06;

// Cover crop OM protection: cover crops reduce OM decomposition rate, not halt it entirely
export const COVER_CROP_OM_PROTECTION = 0.50; // 50% decomposition reduction (effective rate = 3%/year)

// Monoculture streak penalty: escalating yield loss for consecutive same annual crop in same cell
// Real-world: pest/disease buildup compounds over years (rootworm adaptation, allelopathy, nutrient cycling)
// Sources: NIFA/Illinois rotation project, SDSU rootworm management data
export const MONOCULTURE_PENALTY_PER_YEAR = 0.15; // 15% additional penalty per consecutive year
export const MONOCULTURE_PENALTY_FLOOR = 0.50;     // maximum penalty: 50% yield loss at 5th+ consecutive year
// Streak: 1st=1.0, 2nd=0.85, 3rd=0.70, 4th=0.55, 5th+=0.50

// Corn drought quality penalty: DEFERRED TO SLICE 6
// Needs proper heat stress tracking (separate from waterStressDays to avoid double-counting with waterFactor)
// Real-world: heat + drought during pollination reduce grain quality (mycotoxin/aflatoxin contamination)
// Sources: UMN Extension, Nebraska CropWatch, USDA ARS aflatoxin research

// Loan constants
export const LOAN_INTEREST_RATE = 0.10; // 10% annual
export const LOAN_REPAYMENT_FRACTION = 0.20; // 20% of gross harvest revenue
export const LOAN_DEBT_CAP = 100_000; // debt > this = game over
export const EVENT_RNG_SEED_OFFSET = 10_000; // event RNG = mainSeed + this
