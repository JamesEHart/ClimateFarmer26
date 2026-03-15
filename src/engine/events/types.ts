// ============================================================================
// Event/Storylet System Types — ClimateFarmer26 Slice 2a
// Storylets, conditions, choices, effects, foreshadowing.
// Pure types — no logic here.
// ============================================================================

import type { Season, NotificationType } from '../types.ts';
import type { TechTrack } from '../tech-levels.ts';

// --- Conditions (preconditions for storylet eligibility) ---

export type Condition =
  | { type: 'min_year'; year: number }
  | { type: 'max_year'; year: number }
  | { type: 'season'; season: Season }
  | { type: 'season_not'; season: Season }
  | { type: 'cash_below'; amount: number }
  | { type: 'cash_above'; amount: number }
  | { type: 'has_crop'; cropId?: string }
  | { type: 'avg_nitrogen_below'; level: number }
  | { type: 'any_perennial_planted' }
  | { type: 'consecutive_crop_failures'; count: number }
  | { type: 'no_debt' }
  | { type: 'no_perennial_planted' }
  | { type: 'has_flag'; flag: string }
  | { type: 'not_has_flag'; flag: string }
  | { type: 'has_declining_perennial' }
  | { type: 'tech_level_below'; track: TechTrack; level: number }
  | { type: 'tech_level_at_least'; track: TechTrack; level: number }
  | { type: 'random'; probability: number }
  | { type: 'avg_potassium_below'; level: number }
  | { type: 'avg_organic_matter_below'; level: number }
  | { type: 'avg_organic_matter_above'; level: number }
  | { type: 'has_any_crop_in'; cropIds: string[] };

// --- Effects (what happens when a choice is selected) ---

export type Effect =
  | { type: 'modify_cash'; amount: number }
  | { type: 'modify_moisture_all'; amount: number }
  | { type: 'modify_nitrogen_all'; amount: number }
  | { type: 'modify_yield_modifier'; cropId: string; multiplier: number; durationDays: number }
  | { type: 'modify_price_modifier'; cropId: string; multiplier: number; durationDays: number }
  | { type: 'modify_irrigation_cost'; multiplier: number; durationDays: number }
  | { type: 'add_notification'; message: string; notificationType: NotificationType }
  | { type: 'restrict_watering'; durationDays: number }
  | { type: 'set_flag'; flag: string; value: boolean }
  | { type: 'activate_frost_protection'; durationDays: number }
  | { type: 'modify_potassium_all'; amount: number }
  | { type: 'modify_organic_matter_all'; amount: number }
  | { type: 'damage_crops'; target: string; percentage: number }
  | { type: 'insurance_payout'; amount: number };

// --- Choices (player options within an event) ---

export interface Choice {
  id: string;
  label: string;
  description: string;
  cost?: number;
  effects: Effect[];
  requiresCash?: number;
  followUpText?: string;
  requiresFlag?: string;
}

// --- Foreshadowing (advance warnings) ---

export interface Foreshadowing {
  signal: string;
  daysBeforeEvent: number;
  reliability: number; // 0-1; <1 means sometimes a false alarm
  advisorSource?: string;
}

// --- Storylet (event template) ---

export interface Storylet {
  id: string;
  type: 'climate' | 'market' | 'advisor' | 'regulatory' | 'community';
  title: string;
  description: string;
  preconditions: Condition[];
  priority: number; // higher = more likely; >= 100 is guaranteed fire
  cooldownDays: number;
  maxOccurrences?: number;
  foreshadowing?: Foreshadowing;
  choices: Choice[];
  tags: string[];
  advisorId?: 'extension-agent' | 'weather-service' | 'farm-credit' | 'growers-forum'; // routes advisor character display
  illustrationId?: string; // maps to public/assets/events/{id}_480x240.jpeg
}

// --- Runtime state types ---

/** An event currently awaiting player response */
export interface ActiveEvent {
  storyletId: string;
  title: string;
  description: string;
  choices: Choice[];
  firedOnDay: number;
}

/** History entry for cooldown/maxOccurrence tracking */
export interface EventOccurrence {
  storyletId: string;
  day: number;
  choiceId: string;
}

/** Temporary modifier active until expiry */
export interface ActiveEffect {
  effectType: 'yield_modifier' | 'price_modifier' | 'irrigation_cost_modifier' | 'watering_restriction';
  cropId?: string; // '*' for all crops, or specific cropId
  multiplier?: number; // for modifiers
  expiresDay: number;
  sourceEventId: string;
}

/** A scheduled event from the seasonal draw, awaiting its fire day */
export interface ScheduledEvent {
  storyletId: string;
  appearsOnDay: number;   // foreshadow notification day (= firesOnDay if no foreshadowing)
  firesOnDay: number;     // actual event fire day
  isFalseAlarm: boolean;  // foreshadowing reliability roll
  consumed: boolean;      // has been fired or handed to PendingForeshadow system
}

/** A foreshadowing notification pending resolution */
export interface PendingForeshadow {
  storyletId: string;
  signal: string;
  appearsOnDay: number;
  eventFiresOnDay: number;
  isFalseAlarm: boolean;
  advisorSource?: string;
  dismissed: boolean;
}
