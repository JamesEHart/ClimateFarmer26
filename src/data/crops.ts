import type { CropDefinition } from '../engine/types.ts';

/**
 * Slice 1 crops: 3 annuals for the San Joaquin Valley.
 *
 * Data grounded in real California agriculture:
 * - Processing Tomatoes: High-value, heavy nitrogen feeder, warm-season
 * - Silage Corn: Reliable, moderate water/N needs, warm-season
 * - Winter Wheat: Cool-season, lower water use, gives students a rotation option
 *
 * Yield and price values are simplified for gameplay but proportionally realistic.
 */
export const CROPS: Record<string, CropDefinition> = {
  'processing-tomatoes': {
    id: 'processing-tomatoes',
    name: 'Processing Tomatoes',
    type: 'annual',

    gddBase: 50,           // °F base temp
    gddToMaturity: 2500,   // ~120 days in SJV summer
    plantingWindow: { startMonth: 3, endMonth: 5 }, // March–May

    waterUsePerDay: 0.25,  // inches/day at peak
    cropCoefficients: [
      { stage: 'seedling', kc: 0.3 },
      { stage: 'vegetative', kc: 0.7 },
      { stage: 'flowering', kc: 1.1 },
      { stage: 'mature', kc: 0.9 },
      { stage: 'harvestable', kc: 0.5 },
      { stage: 'overripe', kc: 0.3 },
    ],
    ky: 1.05,              // sensitive to water stress

    nitrogenUptake: 200,   // lbs/acre — heavy feeder
    potassiumUptake: 250,  // lbs/acre — very heavy K feeder

    yieldPotential: 45,    // tons/acre
    yieldUnit: 'tons',
    basePrice: 80,         // $/ton
    seedCostPerAcre: 150,
    laborCostPerAcre: 200,

    heatSensitivity: 0.75, // 25% yield loss under heat regime (fruit set damage)

    shortDescription: 'High-value warm-season crop. Heavy nitrogen feeder — depletes soil fast without rotation.',
  },

  'silage-corn': {
    id: 'silage-corn',
    name: 'Silage Corn',
    type: 'annual',

    gddBase: 50,
    gddToMaturity: 2700,   // ~130 days
    plantingWindow: { startMonth: 3, endMonth: 5 },

    waterUsePerDay: 0.22,
    cropCoefficients: [
      { stage: 'seedling', kc: 0.3 },
      { stage: 'vegetative', kc: 0.8 },
      { stage: 'flowering', kc: 1.15 },
      { stage: 'mature', kc: 0.85 },
      { stage: 'harvestable', kc: 0.4 },
      { stage: 'overripe', kc: 0.2 },
    ],
    ky: 0.9,               // moderate water sensitivity

    nitrogenUptake: 150,   // lbs/acre — moderate feeder
    potassiumUptake: 150,  // lbs/acre — moderate K feeder

    yieldPotential: 30,    // tons/acre
    yieldUnit: 'tons',
    basePrice: 55,         // $/ton
    seedCostPerAcre: 100,
    laborCostPerAcre: 80,

    heatSensitivity: 0.85, // 15% yield loss under heat regime (pollination stress)

    shortDescription: 'Reliable feed crop. Moderate water and nitrogen needs. Good rotation partner for tomatoes.',
  },

  'winter-wheat': {
    id: 'winter-wheat',
    name: 'Winter Wheat',
    type: 'annual',

    gddBase: 40,           // lower base temp — grows in cool weather
    gddToMaturity: 2000,   // ~180 days (slow, cool-season growth)
    plantingWindow: { startMonth: 10, endMonth: 11 }, // October–November

    waterUsePerDay: 0.15,  // lower water needs
    cropCoefficients: [
      { stage: 'seedling', kc: 0.3 },
      { stage: 'vegetative', kc: 0.6 },
      { stage: 'flowering', kc: 1.0 },
      { stage: 'mature', kc: 0.7 },
      { stage: 'harvestable', kc: 0.3 },
      { stage: 'overripe', kc: 0.15 },
    ],
    ky: 0.65,              // drought-tolerant

    nitrogenUptake: 80,    // lbs/acre — light feeder
    potassiumUptake: 80,   // lbs/acre — light K feeder

    yieldPotential: 80,    // bushels/acre
    yieldUnit: 'bu',
    basePrice: 7,          // $/bushel
    seedCostPerAcre: 50,
    laborCostPerAcre: 40,

    heatSensitivity: 0.90, // 10% yield loss under heat regime (mild impact)

    shortDescription: 'Cool-season grain. Low water needs, light on soil. Plant in fall, harvest in spring.',
  },

  // --- Slice 3a1: Sorghum ---

  'sorghum': {
    id: 'sorghum',
    name: 'Sorghum',
    type: 'annual',

    gddBase: 50,
    gddToMaturity: 2200,   // ~100 days in SJV summer
    plantingWindow: { startMonth: 4, endMonth: 6 }, // April–June

    waterUsePerDay: 0.15,  // lowest of warm-season crops
    cropCoefficients: [
      { stage: 'seedling', kc: 0.3 },
      { stage: 'vegetative', kc: 0.6 },
      { stage: 'flowering', kc: 0.9 },
      { stage: 'mature', kc: 0.7 },
      { stage: 'harvestable', kc: 0.35 },
      { stage: 'overripe', kc: 0.2 },
    ],
    ky: 0.50,              // very drought-tolerant — half of tomatoes

    nitrogenUptake: 80,    // lbs/acre — light feeder
    potassiumUptake: 60,   // lbs/acre — light K feeder

    yieldPotential: 110,   // bushels/acre
    yieldUnit: 'bu',
    basePrice: 6,          // $/bushel → $660/acre
    seedCostPerAcre: 35,
    laborCostPerAcre: 45,

    // No heatSensitivity — sorghum is heat-tolerant (C4 photosynthesis)

    shortDescription: 'Drought-tolerant warm-season grain. Low profit but survives conditions that kill corn and tomatoes.',
  },

  // --- Slice 2b Perennials ---

  'almonds': {
    id: 'almonds',
    name: 'Almonds',
    type: 'perennial',

    gddBase: 50,
    gddToMaturity: 3000,   // GDD for annual fruit production cycle
    plantingWindow: { startMonth: 1, endMonth: 3 }, // January–March

    waterUsePerDay: 0.30,
    cropCoefficients: [
      { stage: 'seedling', kc: 0.4 },
      { stage: 'vegetative', kc: 0.7 },
      { stage: 'flowering', kc: 1.0 },
      { stage: 'mature', kc: 0.9 },
      { stage: 'harvestable', kc: 0.5 },
      { stage: 'overripe', kc: 0.3 },
    ],
    ky: 0.9,

    nitrogenUptake: 120,
    potassiumUptake: 100,  // lbs/acre — moderate K feeder

    yieldPotential: 2500,  // lbs/acre
    yieldUnit: 'lbs',
    basePrice: 2.50,       // $/lb
    seedCostPerAcre: 960,  // establishment cost (high)
    laborCostPerAcre: 300,

    yearsToEstablish: 3,
    removalCost: 500,
    annualMaintenanceCost: 200,
    dormantSeasons: ['winter'],
    productiveLifespan: 22,
    chillHoursRequired: 700,
    yieldCurve: { rampUpYears: 3, declineStartYear: 15, endOfLifeYear: 22, declineFloor: 0.2 },

    heatSensitivity: 0.80, // 20% yield loss under heat regime (hull rot, kernel shrinkage)

    shortDescription: 'Perennial tree crop. High establishment cost, no revenue for 3 years, then strong annual income. Goes dormant in winter.',
  },

  'pistachios': {
    id: 'pistachios',
    name: 'Pistachios',
    type: 'perennial',

    gddBase: 50,
    gddToMaturity: 2800,
    plantingWindow: { startMonth: 1, endMonth: 3 },

    waterUsePerDay: 0.28,
    cropCoefficients: [
      { stage: 'seedling', kc: 0.35 },
      { stage: 'vegetative', kc: 0.65 },
      { stage: 'flowering', kc: 0.95 },
      { stage: 'mature', kc: 0.85 },
      { stage: 'harvestable', kc: 0.45 },
      { stage: 'overripe', kc: 0.25 },
    ],
    ky: 0.7,              // more drought-tolerant than almonds

    nitrogenUptake: 100,
    potassiumUptake: 90,   // lbs/acre — moderate K feeder

    yieldPotential: 2200,  // lbs/acre
    yieldUnit: 'lbs',
    basePrice: 2.80,       // $/lb
    seedCostPerAcre: 900,
    laborCostPerAcre: 280,

    yearsToEstablish: 4,
    removalCost: 450,
    annualMaintenanceCost: 180,
    dormantSeasons: ['winter'],
    productiveLifespan: 25,
    chillHoursRequired: 600,
    yieldCurve: { rampUpYears: 3, declineStartYear: 17, endOfLifeYear: 25, declineFloor: 0.2 },

    // No heatSensitivity — pistachios are heat-adapted (desert origin)

    shortDescription: 'Perennial tree crop. 4-year establishment, very drought-tolerant. Alternate bearing — reliable long-term investment.',
  },

  // --- Slice 3a1: Citrus Navels ---

  'citrus-navels': {
    id: 'citrus-navels',
    name: 'Citrus Navels',
    type: 'perennial',

    gddBase: 55,
    gddToMaturity: 2800,
    plantingWindow: { startMonth: 2, endMonth: 4 }, // February–April

    waterUsePerDay: 0.20,  // needs year-round irrigation — evergreen
    cropCoefficients: [
      { stage: 'seedling', kc: 0.4 },
      { stage: 'vegetative', kc: 0.65 },
      { stage: 'flowering', kc: 0.85 },
      { stage: 'mature', kc: 0.75 },
      { stage: 'harvestable', kc: 0.5 },
      { stage: 'overripe', kc: 0.3 },
    ],
    ky: 0.80,              // moderate water sensitivity

    nitrogenUptake: 100,
    potassiumUptake: 120,  // lbs/acre — moderate-high K feeder (fruit quality)

    yieldPotential: 350,   // boxes/acre
    yieldUnit: 'boxes',
    basePrice: 14,         // $/box → $4,900/acre
    seedCostPerAcre: 800,  // establishment cost
    laborCostPerAcre: 250,

    yearsToEstablish: 3,
    removalCost: 400,
    annualMaintenanceCost: 150,
    // Evergreen: no dormancy, no chill hours
    // dormantSeasons: undefined
    // chillHoursRequired: undefined
    productiveLifespan: 35,
    yieldCurve: { rampUpYears: 3, declineStartYear: 28, endOfLifeYear: 35, declineFloor: 0.3 },

    heatSensitivity: 0.85, // 15% yield loss under heat regime (sunburn, fruit drop)

    shortDescription: 'Evergreen perennial. Stable income, no chill-hour risk, never declines — but less profitable than almonds at peak.',
  },

  // --- Slice 5a: Agave (gated by tech unlock) ---

  'agave': {
    id: 'agave',
    name: 'Agave',
    type: 'perennial',

    gddBase: 55,
    gddToMaturity: 2000,
    plantingWindow: { startMonth: 3, endMonth: 5 }, // March–May

    waterUsePerDay: 0.05,  // CAM photosynthesis — extremely low water
    cropCoefficients: [
      { stage: 'seedling', kc: 0.15 },
      { stage: 'vegetative', kc: 0.25 },
      { stage: 'flowering', kc: 0.35 },
      { stage: 'mature', kc: 0.30 },
      { stage: 'harvestable', kc: 0.20 },
      { stage: 'overripe', kc: 0.10 },
    ],
    ky: 0.30,              // extremely drought-tolerant

    nitrogenUptake: 40,    // lbs/acre — minimal feeder
    potassiumUptake: 30,   // lbs/acre — minimal K needs

    yieldPotential: 20,    // tons/acre (hearts/piñas)
    yieldUnit: 'tons',
    basePrice: 120,        // $/ton → $2,400/acre
    seedCostPerAcre: 600,  // establishment (pups/offsets)
    laborCostPerAcre: 350, // harvest labor-intensive

    yearsToEstablish: 5,
    removalCost: 200,
    annualMaintenanceCost: 50,
    // No dormancy, no chill hours — desert-adapted
    productiveLifespan: 25,
    yieldCurve: { rampUpYears: 2, declineStartYear: 20, endOfLifeYear: 25, declineFloor: 0.3 },

    // No heatSensitivity — thrives in heat

    requiredFlag: 'tech_crop_agave',

    shortDescription: 'Desert-adapted perennial. Minimal water needs, thrives in heat. Long establishment but very low maintenance.',
  },
  // --- Slice 5c: Heat-Tolerant Avocado (gated by tech unlock) ---

  'heat-avocado': {
    id: 'heat-avocado',
    name: 'Heat-Tolerant Avocado',
    type: 'perennial',

    gddBase: 55,
    gddToMaturity: 2600,
    plantingWindow: { startMonth: 2, endMonth: 4 }, // February–April

    waterUsePerDay: 0.25,        // needs consistent water even in heat
    cropCoefficients: [
      { stage: 'seedling', kc: 0.35 },
      { stage: 'vegetative', kc: 0.60 },
      { stage: 'flowering', kc: 0.85 },
      { stage: 'mature', kc: 0.75 },
      { stage: 'harvestable', kc: 0.45 },
      { stage: 'overripe', kc: 0.25 },
    ],
    ky: 0.85,                     // moderate water sensitivity

    nitrogenUptake: 80,
    potassiumUptake: 70,

    yieldPotential: 8000,         // lbs/acre
    yieldUnit: 'lbs',
    basePrice: 1.20,              // $/lb → ~$9,600/acre potential
    seedCostPerAcre: 1200,        // high establishment
    laborCostPerAcre: 400,

    yearsToEstablish: 4,
    removalCost: 600,
    annualMaintenanceCost: 250,
    // No dormancy, no chill hours — subtropical
    productiveLifespan: 30,
    yieldCurve: { rampUpYears: 4, declineStartYear: 22, endOfLifeYear: 30, declineFloor: 0.3 },

    // No heatSensitivity — thrives in heat (the whole point of this crop)

    requiredFlag: 'tech_crop_avocado',

    shortDescription: 'Heat-adapted perennial. High value, needs consistent water. No heat yield penalty — thrives when other crops struggle.',
  },
};

export function getCropDefinition(cropId: string): CropDefinition {
  const crop = CROPS[cropId];
  if (!crop) {
    throw new Error(`Unknown crop ID: "${cropId}". Valid IDs: ${Object.keys(CROPS).join(', ')}`);
  }
  return crop;
}

export function getAllCropIds(): string[] {
  return Object.keys(CROPS);
}
