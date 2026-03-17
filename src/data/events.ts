// ============================================================================
// Event Definitions — ClimateFarmer26 Slice 2a
// Concrete storylet data for 3 climate events.
// Evaluation order = array index order (deterministic).
// ============================================================================

import type { Storylet } from '../engine/events/types.ts';

/**
 * All storylets, evaluated in array index order.
 * This array is the single source of truth for event evaluation order.
 * Priority >= 100 means guaranteed fire when eligible.
 */
export const STORYLETS: readonly Storylet[] = [
  // --- 2a Events ---

  {
    id: 'heatwave-advisory',
    type: 'climate',
    illustrationId: 'event-heatwave',
    title: 'Heatwave Advisory',
    description: 'The National Weather Service has issued a heatwave advisory for the San Joaquin Valley. Temperatures are expected to exceed 110°F for the next several days. Your crops are at risk.',
    preconditions: [
      { type: 'min_year', year: 2 },
      { type: 'season', season: 'summer' },
      { type: 'has_crop' },
      { type: 'random', probability: 0.30 },
    ],
    priority: 50,
    cooldownDays: 180,
    foreshadowing: {
      signal: 'Weather models show an extreme heat dome building over the Central Valley.',
      daysBeforeEvent: 7,
      reliability: 0.75,
    },
    choices: [
      {
        id: 'emergency-irrigation',
        label: 'Emergency Irrigation',
        description: 'Run irrigation continuously to cool crops and soil. Costs $500 but protects yield.',
        cost: 500,
        requiresCash: 500,
        effects: [
          { type: 'modify_cash', amount: -500 },
          { type: 'modify_moisture_all', amount: 2.0 },
          { type: 'add_notification', message: 'Emergency irrigation applied. Your crops survived the heat.', notificationType: 'event_result' },
        ],
      },
      {
        id: 'wait-it-out',
        label: 'Wait It Out',
        description: 'Hope for the best. Crops may suffer yield loss.',
        effects: [
          { type: 'modify_yield_modifier', cropId: '*', multiplier: 0.85, durationDays: 14 },
          { type: 'add_notification', message: 'The heatwave damaged some crops. Yield reduced by 15%.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['climate', 'heat'],
  },

  {
    id: 'water-allocation-cut',
    type: 'regulatory',
    title: 'Water Allocation Cut',
    description: 'The State Water Resources Control Board has reduced irrigation allocations for your district due to drought conditions. You must decide how to manage with less water.',
    preconditions: [
      { type: 'min_year', year: 3 },
      { type: 'season', season: 'summer' },
      { type: 'random', probability: 0.20 },
    ],
    priority: 60,
    cooldownDays: 365,
    foreshadowing: {
      signal: 'State officials are reviewing water allocation policies. Cuts may be coming.',
      daysBeforeEvent: 14,
      reliability: 0.80,
    },
    choices: [
      {
        id: 'accept-higher-costs',
        label: 'Buy Supplemental Water',
        description: 'Purchase water from the spot market at higher prices. Irrigation costs increase by 50% for 90 days.',
        effects: [
          { type: 'modify_irrigation_cost', multiplier: 1.5, durationDays: 90 },
          { type: 'add_notification', message: 'You secured supplemental water rights. Irrigation costs increased for 90 days.', notificationType: 'event_result' },
        ],
      },
      {
        id: 'cut-irrigation',
        label: 'Accept Reduced Irrigation',
        description: 'Follow the restriction. No watering for 45 days.',
        effects: [
          { type: 'restrict_watering', durationDays: 45 },
          { type: 'add_notification', message: 'Water restriction in effect. No irrigation for 45 days.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['regulatory', 'water'],
  },

  {
    id: 'late-frost-warning',
    type: 'climate',
    title: 'Late Frost Warning',
    description: 'An unexpected cold front is moving through the valley. Overnight temperatures may drop below freezing, threatening young crops.',
    preconditions: [
      { type: 'season', season: 'spring' },
      { type: 'has_crop' },
      { type: 'random', probability: 0.15 },
    ],
    priority: 55,
    cooldownDays: 365,
    foreshadowing: {
      signal: 'Unusual cold air mass detected moving south through the valley.',
      daysBeforeEvent: 3,
      reliability: 0.90,
    },
    choices: [
      {
        id: 'frost-protection',
        label: 'Frost Protection',
        description: 'Deploy frost blankets and wind machines. Costs $300 but saves your crops.',
        cost: 300,
        requiresCash: 300,
        effects: [
          { type: 'modify_cash', amount: -300 },
          { type: 'add_notification', message: 'Frost protection deployed. Your crops survived the cold snap.', notificationType: 'event_result' },
        ],
      },
      {
        id: 'accept-risk',
        label: 'Accept the Risk',
        description: 'Frost damage is possible. Yield may be reduced.',
        effects: [
          { type: 'modify_yield_modifier', cropId: '*', multiplier: 0.70, durationDays: 7 },
          { type: 'add_notification', message: 'Frost damaged some crops. Yield reduced by 30%.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['climate', 'frost'],
  },

  // --- Slice 3a1: Stretch Events ---

  {
    id: 'tomato-market-surge',
    type: 'market',
    title: 'Tomato Market Surge',
    description: 'Processing tomato prices have spiked due to supply shortages in other growing regions. If you have tomatoes in the field, this could be a windfall.',
    preconditions: [
      { type: 'season_not', season: 'winter' },
      { type: 'min_year', year: 2 },
      { type: 'has_crop', cropId: 'processing-tomatoes' },
      { type: 'random', probability: 0.10 },
    ],
    priority: 45,
    cooldownDays: 365,
    choices: [
      {
        id: 'acknowledge-surge',
        label: 'Good to Know',
        description: 'Tomato prices will be 40% higher for the next 60 days.',
        effects: [
          { type: 'modify_price_modifier', cropId: 'processing-tomatoes', multiplier: 1.4, durationDays: 60 },
          { type: 'add_notification', message: 'Tomato prices surged! Processing tomato revenue increased by 40% for 60 days.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['market', 'tomatoes'],
  },

  {
    id: 'groundwater-pumping-ban',
    type: 'regulatory',
    illustrationId: 'event-water-restriction',
    title: 'Groundwater Pumping Ban',
    description: 'The state has imposed an emergency ban on groundwater pumping in your district due to critically low aquifer levels. You must decide how to handle the next 30 days without well water.',
    preconditions: [
      { type: 'season', season: 'summer' },
      { type: 'min_year', year: 5 },
      { type: 'random', probability: 0.12 },
    ],
    priority: 55,
    cooldownDays: 730,
    choices: [
      {
        id: 'comply',
        label: 'Comply with the Ban',
        description: 'No irrigation for 30 days. Your crops will rely on whatever moisture is in the soil.',
        effects: [
          { type: 'restrict_watering', durationDays: 30 },
          { type: 'add_notification', message: 'Groundwater pumping banned for 30 days. No irrigation available.', notificationType: 'event_result' },
        ],
      },
      {
        id: 'buy-rights',
        label: 'Buy Surface Water Rights',
        description: 'Purchase surface water rights from the state. Costs $1,000 but keeps your irrigation running.',
        cost: 1000,
        requiresCash: 1000,
        effects: [
          { type: 'modify_cash', amount: -1000 },
          { type: 'add_notification', message: 'You purchased surface water rights for $1,000. Irrigation continues normally.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['regulatory', 'water', 'groundwater'],
  },

  // --- Slice 3a2: Orchard Decline Advisor ---

  {
    id: 'advisor-orchard-decline',
    type: 'advisor',
    title: 'Aging Orchard Assessment',
    description: "I've been looking at your older trees, and some of them are past their prime. Yields are declining and will continue to drop. It might be time to think about replanting — either with younger trees of the same variety, or something new entirely.",
    preconditions: [
      { type: 'has_declining_perennial' },
    ],
    priority: 90,
    cooldownDays: 730,
    maxOccurrences: 2,
    advisorId: 'extension-agent',
    choices: [
      {
        id: 'plan-replacement',
        label: 'Plan Replacement',
        description: 'Get advice on timing and costs for replanting aging orchards.',
        effects: [
          { type: 'add_notification', message: "Dr. Santos: \"Removing old trees costs $400-500 per plot. Plan your replanting during the dormant season to minimize lost production.\"", notificationType: 'event_result' },
        ],
      },
      {
        id: 'keep-producing',
        label: 'Keep Them Going',
        description: 'Continue harvesting at reduced yields rather than investing in new trees.',
        effects: [
          { type: 'add_notification', message: "Dr. Santos: \"That's reasonable — even old trees produce some income. Just know that yields will keep dropping.\"", notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['advisor', 'perennials', 'decline'],
  },

  // --- Slice 3c: Weather Service Advisor ---

  {
    id: 'weather-heat-forecast',
    type: 'advisor',
    title: 'Heat Wave Forecast',
    description: 'High confidence: Our models show elevated heat risk for the coming weeks. Extreme temperatures could stress your crops and increase water demand.',
    preconditions: [
      { type: 'season', season: 'summer' },
      { type: 'min_year', year: 2 },
      { type: 'has_crop' },
      { type: 'random', probability: 0.25 },
    ],
    priority: 85,
    cooldownDays: 180,
    maxOccurrences: 4,
    advisorId: 'weather-service',
    choices: [
      {
        id: 'pre-irrigate',
        label: 'Pre-irrigate Fields',
        description: 'Run irrigation early to build soil moisture reserves before the heat arrives. Costs $200.',
        cost: 200,
        requiresCash: 200,
        effects: [
          { type: 'modify_cash', amount: -200 },
          { type: 'modify_moisture_all', amount: 1.5 },
          { type: 'add_notification', message: 'Pre-irrigation applied. Soil moisture reserves boosted across all fields.', notificationType: 'event_result' },
        ],
      },
      {
        id: 'monitor',
        label: 'Monitor Conditions',
        description: 'Keep an eye on the forecast and react if temperatures spike.',
        effects: [
          { type: 'add_notification', message: 'You decided to monitor conditions. Watch for heatwave advisories in the coming days.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['advisor', 'weather', 'heat'],
  },

  {
    id: 'weather-frost-alert',
    type: 'advisor',
    title: 'Spring Frost Alert',
    description: 'Moderate confidence: Cold air mass tracking south through the valley. There\'s a reasonable chance of overnight frost in the next week.',
    preconditions: [
      { type: 'season', season: 'spring' },
      { type: 'has_crop' },
      { type: 'random', probability: 0.20 },
    ],
    priority: 85,
    cooldownDays: 365,
    maxOccurrences: 3,
    advisorId: 'weather-service',
    choices: [
      {
        id: 'deploy-protection',
        label: 'Deploy Frost Protection',
        description: 'Set up wind machines and heaters for the next 14 days. Costs $150.',
        cost: 150,
        requiresCash: 150,
        effects: [
          { type: 'modify_cash', amount: -150 },
          { type: 'activate_frost_protection', durationDays: 14 },
          { type: 'add_notification', message: 'Frost protection deployed for 14 days. If frost comes, crop damage will be reduced.', notificationType: 'event_result' },
        ],
      },
      {
        id: 'wait-and-see',
        label: 'Wait and See',
        description: 'The forecast is uncertain. Save your money and hope for the best.',
        effects: [
          { type: 'add_notification', message: 'You decided to wait. If a frost event occurs, your crops will be unprotected.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['advisor', 'weather', 'frost'],
  },

  {
    id: 'weather-drought-outlook',
    type: 'advisor',
    title: 'Long-Range Drought Outlook',
    description: 'Low confidence: Multi-year precipitation indicators suggest drought conditions may worsen. Water allocations could be reduced in coming years.',
    preconditions: [
      { type: 'min_year', year: 5 },
      { type: 'season', season: 'spring' },
      { type: 'random', probability: 0.15 },
    ],
    priority: 80,
    cooldownDays: 730,
    maxOccurrences: 2,
    advisorId: 'weather-service',
    choices: [
      {
        id: 'plan-for-drought',
        label: 'Plan for Drought',
        description: 'Start thinking about drought-tolerant crops and water conservation strategies.',
        effects: [
          { type: 'add_notification', message: 'Consider drought-tolerant crops like sorghum, which needs less water and survives dry spells better than corn or tomatoes.', notificationType: 'event_result' },
        ],
      },
      {
        id: 'too-uncertain',
        label: 'Too Uncertain to Act',
        description: 'Long-range forecasts are unreliable. Continue with your current plan.',
        effects: [
          { type: 'add_notification', message: 'Long-range forecasts are often wrong. But keep an eye on water allocation announcements.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['advisor', 'weather', 'drought'],
  },

  // --- 2c Advisor Events ---

  {
    id: 'advisor-soil-nitrogen',
    type: 'advisor',
    title: 'Soil Health Check',
    description: "I've been watching your crops closely, and the growth patterns tell me your soil nitrogen is getting low. Depleted soils mean weaker crops and lower yields. You have some options to restore fertility.",
    preconditions: [
      { type: 'min_year', year: 2 },
      { type: 'avg_nitrogen_below', level: 50 },
    ],
    priority: 100,
    cooldownDays: 365,
    maxOccurrences: 2,
    advisorId: 'extension-agent',
    choices: [
      {
        id: 'buy-fertilizer',
        label: 'Apply Nitrogen Fertilizer',
        description: 'Purchase and apply commercial fertilizer to restore soil nitrogen. Quick results but costs money.',
        cost: 400,
        requiresCash: 400,
        effects: [
          { type: 'modify_cash', amount: -400 },
          { type: 'modify_nitrogen_all', amount: 60 },
          { type: 'set_flag', flag: 'organic_violation_this_year', value: true },
          { type: 'add_notification', message: 'Dr. Santos helped you apply nitrogen fertilizer. Soil fertility improved.', notificationType: 'event_result' },
        ],
        followUpText: "Nitrogen is the engine of plant growth — it's the main ingredient in chlorophyll, which powers photosynthesis. When N runs low, leaves turn pale, growth slows, and yields drop. Commercial fertilizer gives you an immediate boost, but it's a band-aid: your soil's organic matter is the long-term nitrogen bank. As organic matter breaks down, microbes release nitrogen slowly over the season. That's why farms with healthy soil need less purchased fertilizer. Every crop you harvest takes nitrogen with it — heavy feeders like corn and tomatoes pull 150-200 lbs/acre.",
      },
      {
        id: 'acknowledge',
        label: 'Thanks for the Heads Up',
        description: 'Take note and plan to rotate crops next season to rebuild soil health naturally.',
        effects: [
          { type: 'add_notification', message: 'Dr. Santos recommends planting winter wheat in the fall to restore nitrogen naturally. Cover crops also help rebuild soil fertility.', notificationType: 'event_result' },
        ],
        followUpText: "Here's how the nitrogen cycle works on your farm: plants pull N from the soil, harvest removes it, and then you need to put it back. There are two paths. The fast path is buying fertilizer — effective but expensive and it doesn't build soil health. The slow path is biological: legume cover crops host bacteria that pull nitrogen from the air and fix it into the soil. Winter wheat isn't a legume, but its deep roots improve soil structure and prevent N from washing away. The ideal rotation alternates heavy feeders (corn, tomatoes) with lighter feeders (wheat) and cover crops in between.",
      },
    ],
    tags: ['advisor', 'soil'],
  },

  {
    id: 'advisor-crop-failure',
    type: 'advisor',
    title: 'Crop Loss Review',
    description: "I noticed you've had some recent crop losses. That's tough, but it's a learning opportunity. Let's look at what happened and how to reduce risk going forward.",
    preconditions: [
      { type: 'consecutive_crop_failures', count: 1 },
    ],
    priority: 100,
    cooldownDays: 180,
    maxOccurrences: 5,
    advisorId: 'extension-agent',
    choices: [
      {
        id: 'diversify-advice',
        label: 'Learn About Diversification',
        description: 'Dr. Santos explains how planting different crops reduces risk from weather and market swings.',
        effects: [
          { type: 'add_notification', message: "Dr. Santos: \"Don't put all your eggs in one basket. Mix crop types and planting times to spread risk.\"", notificationType: 'event_result' },
        ],
        followUpText: "Diversification isn't just an abstract principle — it's how real California farmers survive. A heatwave that destroys your tomatoes won't touch your winter wheat. A market crash in almonds doesn't affect corn prices. By mixing annuals (which give you flexibility to change each year) with perennials (which provide steady long-term income), you create a portfolio that can absorb shocks. The same logic applies to planting timing: spring-planted crops and fall-planted crops face different weather risks. Even having 3-4 different crops dramatically reduces your chance of a catastrophic year.",
      },
      {
        id: 'water-advice',
        label: 'Get Irrigation Tips',
        description: 'Review your watering strategy to prevent moisture stress from contributing to future losses.',
        effects: [
          { type: 'add_notification', message: 'Dr. Santos reviewed your irrigation records and suggested watering more frequently during heat events.', notificationType: 'event_result' },
        ],
        followUpText: "Water stress is cumulative — every day a plant doesn't get enough moisture, it loses a little growth potential it can never recover. The soil acts like a sponge: organic matter holds water between irrigations, so healthy soil needs less frequent watering. When you irrigate, the water soaks in and crops draw on it over the next few days. During heat events, evaporation increases and crops drink more — that's when water stress hits hardest. The auto-pause on water stress warnings is your best early warning system. When you see it, irrigate immediately rather than waiting for the next scheduled watering.",
      },
    ],
    tags: ['advisor', 'education'],
  },

  {
    id: 'advisor-chill-warning',
    type: 'advisor',
    title: 'Winter Chill Hour Concerns',
    description: "I've been tracking the chill hour data for our region, and the numbers are trending down. Your almond and pistachio trees need cold winter nights to produce well. If winters keep warming, you may see yield losses — especially for almonds, which need more chill hours than pistachios.",
    preconditions: [
      { type: 'any_perennial_planted' },
      { type: 'min_year', year: 8 },
    ],
    priority: 100,
    cooldownDays: 730,
    maxOccurrences: 2,
    advisorId: 'extension-agent',
    choices: [
      {
        id: 'review-chill-data',
        label: 'Show Me the Data',
        description: 'Review the chill hour trends and what they mean for your orchard.',
        effects: [
          { type: 'set_flag', flag: 'chillHoursRevealed', value: true },
          { type: 'add_notification', message: 'Dr. Santos shared chill hour data for your region. You can now see chill hour tracking for your perennial crops.', notificationType: 'event_result' },
        ],
        followUpText: "Chill hours are the number of hours below 45\u00B0F that trees accumulate during winter dormancy. They're essential for triggering proper bud break in spring — without enough cold, trees bloom irregularly, set less fruit, and yields plummet. Almonds need about 400 chill hours, pistachios around 800-1000. The problem is that winters in the San Joaquin Valley are warming: we're losing about 5-10 chill hours per decade. You can now see the chill hour tracker on your orchard plots. If accumulated hours fall short of what your trees need, expect proportional yield losses. Pistachios actually need MORE chill hours but are more flexible about warm interruptions during dormancy.",
      },
      {
        id: 'plan-adaptation',
        label: 'Help Me Plan Ahead',
        description: 'Get advice on which tree crops are more resilient to declining chill hours.',
        effects: [
          { type: 'set_flag', flag: 'chillHoursRevealed', value: true },
          { type: 'add_notification', message: "Dr. Santos: \"Pistachios need fewer chill hours than almonds. As winters warm, consider shifting toward more climate-resilient varieties.\"", notificationType: 'event_result' },
        ],
        followUpText: "Not all tree crops are equally vulnerable. Almonds need roughly 400 chill hours and are sensitive to warm interruptions during dormancy. Pistachios need more total hours but handle warm spells better — they're more flexible about when those cold hours arrive. Citrus doesn't need chill hours at all, but it's sensitive to frost. The strategic play is portfolio thinking: mix trees with different climate vulnerabilities so a bad winter for almonds isn't a bad winter for everything. If you see chill hours consistently falling short, that's a signal to start transitioning toward heat-adapted varieties rather than doubling down on what worked in the past.",
      },
    ],
    tags: ['advisor', 'chill', 'climate'],
  },

  {
    id: 'advisor-drought-recovery',
    type: 'advisor',
    title: 'Financial Recovery Planning',
    description: "Times are tough, but I've seen farms recover from worse. Let's look at some strategies to rebuild your finances. The key is cutting costs where you can while keeping your most profitable acres producing.",
    preconditions: [
      { type: 'cash_below', amount: 25000 },
      { type: 'min_year', year: 4 },
    ],
    priority: 90,
    cooldownDays: 730,
    maxOccurrences: 2,
    advisorId: 'extension-agent',
    choices: [
      {
        id: 'cost-cutting',
        label: 'Review Cost-Cutting Options',
        description: 'Focus on your most profitable crops and reduce planted acreage to match your budget.',
        effects: [
          { type: 'add_notification', message: "Dr. Santos: \"Focus on fewer, higher-value crops. It's better to farm 4 rows well than 8 rows poorly.\"", notificationType: 'event_result' },
        ],
        followUpText: "Let's look at the ROI math. Processing tomatoes bring $80/ton at 45 tons/acre — that's $3,600 gross per plot, but seed costs $150 and labor runs $200. Net: about $3,250 per plot. Corn is $50/ton at 35 tons — $1,750 gross, $250 in costs, net $1,500. Winter wheat: $7/bushel at 80 bushels — $560 gross, just $100 in costs. When cash is tight, every dollar of seed money needs to earn its keep. Plant your highest-margin crop first, leave low-margin plots fallow if you can't afford to water them all. An unplanted field costs nothing; a poorly-watered field costs seed money AND yields nothing.",
      },
      {
        id: 'low-cost-crops',
        label: 'What Are the Cheapest Crops?',
        description: 'Learn which crops have the lowest input costs to help rebuild cash reserves.',
        effects: [
          { type: 'add_notification', message: "Dr. Santos: \"Winter wheat has the lowest seed and labor costs. It won't make you rich, but it keeps the farm running.\"", notificationType: 'event_result' },
        ],
        followUpText: "When you're cash-strapped, the goal isn't profit — it's survival. Winter wheat costs just $100 to plant and $100 in labor. It won't generate huge revenue, but it almost always turns a small profit and keeps the land in production. The hidden benefit: wheat is a light nitrogen feeder, so it doesn't drain your soil the way corn or tomatoes do. That means the field recovers while still earning. Sorghum is another good option — drought-tolerant, moderate costs. The trap to avoid: planting an expensive crop you can't afford to water. Seed money spent on unirrigated tomatoes is seed money wasted.",
      },
    ],
    tags: ['advisor', 'finance'],
  },

  {
    id: 'advisor-perennial-opportunity',
    type: 'advisor',
    title: 'Long-Term Investment Opportunity',
    description: "Your farm is doing well financially, and you don't have any debt — that puts you in a great position. Have you considered planting tree crops? Almonds and pistachios require patience (3-4 years before they produce), but the long-term returns can be excellent.",
    preconditions: [
      { type: 'cash_above', amount: 40000 },
      { type: 'no_debt' },
      { type: 'no_perennial_planted' },
      { type: 'min_year', year: 3 },
    ],
    priority: 90,
    cooldownDays: 365,
    maxOccurrences: 1,
    advisorId: 'extension-agent',
    choices: [
      {
        id: 'learn-perennials',
        label: 'Tell Me More',
        description: 'Learn about the costs, timeline, and potential returns of perennial tree crops.',
        effects: [
          { type: 'add_notification', message: "Dr. Santos: \"Almonds and pistachios cost $900-960 to plant and need 3-4 years to establish. But once producing, they generate strong annual income for 20+ years.\"", notificationType: 'event_result' },
        ],
        followUpText: "Think of perennial tree crops like buying a rental property. High upfront cost, years before it pays for itself, but then decades of steady income. Almonds cost about $960 to plant and need 3 years to establish — that's 3 years of maintenance costs with zero harvest. But once producing, a mature almond orchard generates strong annual revenue for 15-20 years. Pistachios are similar: $900 to plant, 4 years to establish, but they're more drought-tolerant and need fewer chill hours than almonds. The catch? You can't rotate a tree. If the market shifts or the climate changes, you're committed. That's why most successful farms mix annuals (flexibility) with perennials (stability).",
      },
      {
        id: 'not-now',
        label: 'Not Right Now',
        description: "You're happy with your current crop plan.",
        effects: [
          { type: 'add_notification', message: "Dr. Santos: \"No rush. The option will be there when you're ready. Just remember — the best time to plant a tree was yesterday.\"", notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['advisor', 'perennials'],
  },

  // --- Slice 5b: New Advisor Introductions + Water Tech Unlock ---

  {
    id: 'advisor-chen-intro',
    type: 'advisor',
    title: 'A Visit from Valley Farm Credit',
    description: "A sharp-dressed man stops by your farm gate. \"Marcus Chen, Valley Farm Credit. I've been reviewing agricultural operations in the district and your numbers caught my eye. Mind if I take a look around?\" He pulls out a tablet and starts calculating. \"I see potential here — let me show you where your dollars are working hardest and where they're leaking.\"",
    preconditions: [
      { type: 'min_year', year: 2 },
      { type: 'not_has_flag', flag: 'met_chen' },
    ],
    priority: 95,
    cooldownDays: 0,
    maxOccurrences: 1,
    advisorId: 'farm-credit',
    choices: [
      {
        id: 'welcome-review',
        label: 'Welcome the Review',
        description: "Hear what Marcus has to say about your farm's financials.",
        effects: [
          { type: 'set_flag', flag: 'met_chen', value: true },
          { type: 'add_notification', message: "Marcus Chen from Valley Farm Credit reviewed your operation.", notificationType: 'event_result' },
        ],
        followUpText: "Marcus walks your fields with his tablet, tapping numbers as he goes. \"Here's what I see: you're spending money in places that aren't paying you back. Every dollar you put into the ground should come back with friends.\" He pulls up a comparison chart. \"Focus on your highest-revenue crops and track every dollar. Know your cost per plot, your revenue per harvest, your margin per season. Farming is a business — treat it like one, and it'll treat you right.\"",
      },
      {
        id: 'polite-decline',
        label: "I'm Doing Fine",
        description: "You appreciate the offer but aren't looking for financial advice right now.",
        effects: [
          { type: 'set_flag', flag: 'met_chen', value: true },
          { type: 'add_notification', message: 'Marcus Chen left his card. "Call me when you want to talk about growing your operation," he said.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['advisor', 'finance', 'introduction'],
  },

  {
    id: 'advisor-forum-intro',
    type: 'advisor',
    title: 'Valley Growers Forum Meetup',
    description: "There's a flyer on the bulletin board at the feed store: \"Valley Growers Forum — Monthly Meetup. Share what's working, learn from your neighbors.\" You hear it's mostly old-timers and a few younger growers swapping stories over coffee. The advice isn't always scientific, but people who've farmed this valley for decades know things that don't show up in textbooks.",
    preconditions: [
      { type: 'min_year', year: 2 },
      { type: 'not_has_flag', flag: 'met_forum' },
    ],
    priority: 90,
    cooldownDays: 0,
    maxOccurrences: 1,
    advisorId: 'growers-forum',
    choices: [
      {
        id: 'attend-meeting',
        label: 'Start Attending Meetings',
        description: 'The local farmers have decades of experience to share.',
        effects: [
          { type: 'set_flag', flag: 'met_forum', value: true },
          { type: 'add_notification', message: 'You joined the Valley Growers Forum.', notificationType: 'event_result' },
        ],
        followUpText: "The meeting is in a back room at the feed store — folding chairs, a coffee pot that's seen better days, and a dozen farmers who've been working this valley longer than you've been alive. The conversation jumps around: water prices, what the neighbor planted, a rumor about new regulations. \"Stick around,\" one old-timer says, leaning back. \"You'll hear things Dr. Santos won't tell you.\" It's not scientific, but these people know the valley. Sometimes experience beats a textbook.",
      },
      {
        id: 'just-listen',
        label: 'Just Listen for Now',
        description: "You're curious but not ready to commit to regular meetings.",
        effects: [
          { type: 'set_flag', flag: 'met_forum', value: true },
          { type: 'add_notification', message: 'You stopped by the Growers Forum meeting. Mixed bag — some solid tips about local conditions, some dubious claims about miracle fertilizers. Worth keeping an ear open.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['advisor', 'community', 'introduction'],
  },

  {
    id: 'tech-water-irrigation',
    type: 'advisor',
    title: 'Irrigation Technology Decision',
    description: "Dr. Santos called a meeting to discuss your irrigation situation. \"You've been fighting water stress every season, and it's costing you time and yields. There's a better way.\" Marcus Chen is here too — he pulls up cost projections on his tablet. \"The numbers are clear. Drip irrigation pays for itself within two seasons.\" At the Growers Forum last week, someone mentioned their neighbor installed drip lines and hasn't worried about watering since. All three voices agree: it's time to automate your irrigation.",
    preconditions: [
      { type: 'min_year', year: 3 },
      { type: 'has_crop' },
      { type: 'tech_level_below', track: 'water', level: 1 },
      // met_chen/met_forum gates removed: dismissing an intro at the auto-pause overlay
      // consumes its maxOccurrences without setting the flag, permanently soft-locking tech.
      // Advisors still host this panel via advisorId; intros are flavor, not gates.
    ],
    priority: 100,
    cooldownDays: 365,
    maxOccurrences: 3,
    advisorId: 'extension-agent',
    choices: [
      {
        id: 'install-irrigation',
        label: 'Install Drip Irrigation',
        description: 'Proven technology. Delivers water directly to roots with minimal waste. Your fields will be watered automatically when crops get stressed. Costs $800.',
        cost: 800,
        requiresCash: 800,
        effects: [
          { type: 'modify_cash', amount: -800 },
          { type: 'set_flag', flag: 'tech_drip_irrigation', value: true },
          { type: 'add_notification', message: 'Drip irrigation installed! Your fields will now be watered automatically when crops get stressed. Santos: "Simple, reliable, effective." Chen: "Smart investment — watch your water costs drop."', notificationType: 'event_result' },
        ],
      },
      {
        id: 'not-now',
        label: 'Not Right Now',
        description: "You'll think about it. Manual watering works, even if it's tedious.",
        effects: [
          { type: 'add_notification', message: "You decided to hold off on irrigation technology. Santos: \"The offer stands — your crops will keep getting stressed without it.\" Chen: \"Every season you wait is money left on the table.\"", notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['tech-unlock', 'advisor', 'water'],
  },

  // --- Slice 5c: Soil Fork, Agave, Regime Shifts ---

  {
    id: 'tech-soil-management',
    type: 'advisor',
    title: 'Soil Management Decision',
    description: "Dr. Santos spreads out a soil map at her office. \"Your fields have been producing well, but I'm seeing early signs of nutrient depletion. We should get ahead of this before it becomes a problem.\" She recommends commissioning a professional soil test — lab analysis of nitrogen, potassium, organic matter, the works.\n\nMarcus Chen walks in with a different suggestion. \"UC Extension publishes regional soil reports every quarter — free or nearly free. You'd get general guidance without the lab costs.\"\n\nAt the Growers Forum, old-timer Jake Mendoza shrugs. \"I've been farming forty years without a soil test. You learn to read the plants.\"",
    preconditions: [
      { type: 'min_year', year: 6 },
      { type: 'has_crop' },
      { type: 'tech_level_below', track: 'soil', level: 1 },
      // met_chen/met_forum gates removed (same reason as tech-water-irrigation)
    ],
    priority: 100,
    cooldownDays: 365,
    maxOccurrences: 3,
    advisorId: 'extension-agent',
    choices: [
      {
        id: 'soil-testing',
        label: 'Commission Soil Testing',
        description: 'Professional lab analysis of your soil. You\'ll see exact potassium levels and get specific nutrient recommendations. Costs $600.',
        cost: 600,
        requiresCash: 600,
        effects: [
          { type: 'modify_cash', amount: -600 },
          { type: 'set_flag', flag: 'tech_soil_testing', value: true },
          { type: 'add_notification', message: 'Soil testing commissioned! Click any plot to see the new Potassium reading in your soil details. Low potassium reduces crop quality and market price. Santos: "Now you can see exactly what your soil needs — and manage it."', notificationType: 'event_result' },
        ],
      },
      {
        id: 'extension-reports',
        label: 'Subscribe to Extension Reports',
        description: 'Regional soil health bulletins from UC Extension. General guidance at low cost, but you won\'t get field-specific data. Costs $200.',
        cost: 200,
        requiresCash: 200,
        effects: [
          { type: 'modify_cash', amount: -200 },
          { type: 'set_flag', flag: 'tech_extension_reports', value: true },
          { type: 'add_notification', message: 'Subscribed to UC Extension soil reports. You\'ll receive quarterly bulletins on regional soil health trends. Chen: "Smart — professional guidance without breaking the bank."', notificationType: 'event_result' },
        ],
      },
      {
        id: 'not-now',
        label: 'Not Right Now',
        description: 'Your soil seems fine for now. You\'ll revisit this later.',
        effects: [
          { type: 'add_notification', message: 'You decided to hold off on soil management upgrades. Santos: "Your soil won\'t wait forever — nutrient depletion is invisible until it isn\'t." Forum: "Jake\'s been saying that for forty years and he\'s still farming."', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['tech-unlock', 'advisor', 'soil'],
  },

  {
    id: 'tech-crop-agave',
    type: 'advisor',
    title: 'Novel Crop Research: Agave',
    description: "Dr. Santos brings a research paper to your attention. \"A team at UC Davis has been trialing agave cultivation in the San Joaquin Valley. It's a CAM plant — uses almost no water, thrives in heat, minimal soil demands.\"\n\nChen looks at the numbers: \"The margins aren't huge, but the costs are almost nothing. In a drought year, it's income when everything else is dying.\"\n\nThe Forum is skeptical but curious. \"Never grown it myself, but I've seen the Davis plots. Things look like they belong in a desert — because they do.\"",
    preconditions: [
      { type: 'min_year', year: 9 },
      { type: 'has_crop' },
      { type: 'not_has_flag', flag: 'tech_crop_agave' },
    ],
    priority: 95,
    cooldownDays: 365,
    maxOccurrences: 2,
    advisorId: 'extension-agent',
    choices: [
      {
        id: 'adopt-agave',
        label: 'Research Agave Cultivation',
        description: 'Invest in learning agave growing techniques. Unlocks agave as a plantable crop — extremely drought-tolerant but 5-year establishment. Costs $400.',
        cost: 400,
        requiresCash: 400,
        effects: [
          { type: 'modify_cash', amount: -400 },
          { type: 'set_flag', flag: 'tech_crop_agave', value: true },
          { type: 'add_notification', message: 'Agave cultivation research complete! You can now plant agave — a desert-adapted perennial with minimal water needs. Santos: "This could be your drought insurance."', notificationType: 'event_result' },
        ],
      },
      {
        id: 'not-now',
        label: 'Not Right Now',
        description: 'Agave is interesting but you have other priorities.',
        effects: [
          { type: 'add_notification', message: 'You passed on agave research for now. Santos: "The option remains open — agave isn\'t going anywhere." Chen: "When water gets scarce enough, you might reconsider."', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['tech-unlock', 'advisor', 'crop'],
  },

  // --- Slice 7d: Early avocado research (proactive adaptation) ---

  {
    id: 'advisor-avocado-research',
    type: 'advisor',
    title: 'Santos: Heat-Tolerant Crop Research',
    description: "Dr. Santos stops by with a research paper and a look of quiet excitement. \"I just got back from a UC Riverside field day. They've been breeding avocado varieties specifically for inland heat — not the coastal Hass you see in grocery stores, but rootstock that actually thrives above 100°F. The trial plots in Bakersfield are producing real yields.\"\n\nShe spreads out temperature charts from the last decade. \"Look at the trend. Our average summer highs have been climbing steadily. I can't tell you exactly when it'll matter for your current crops, but the direction is clear. Getting ahead of it with heat-adapted varieties could be very smart.\"\n\nChen looks over the economics. \"Avocados are high-value — $1.20 per pound at current prices. Establishment is expensive and takes 4 years, but once they're producing, the returns are strong. $600 for the research license and starter rootstock.\"\n\nThe Forum has been hearing things too. \"Guy in Bakersfield says his test trees are loving this heat. First time I've heard someone say that about a crop.\"",
    preconditions: [
      { type: 'min_year', year: 10 },
      { type: 'max_year', year: 14 },
      { type: 'not_has_flag', flag: 'tech_crop_avocado' },
      { type: 'has_crop' },
    ],
    priority: 95,
    cooldownDays: 365,
    maxOccurrences: 2,
    advisorId: 'extension-agent',
    choices: [
      {
        id: 'research-avocado-early',
        label: 'Research Heat-Tolerant Avocado',
        description: 'Invest in heat-adapted avocado rootstock and growing techniques. Unlocks avocados — high value, no heat penalty, but 4-year establishment. Costs $600.',
        cost: 600,
        requiresCash: 600,
        effects: [
          { type: 'modify_cash', amount: -600 },
          { type: 'set_flag', flag: 'tech_crop_avocado', value: true },
          { type: 'add_notification', message: 'Avocado research complete! You can now plant heat-tolerant avocados — high value, no heat penalty, but they need 4 years to establish. Santos: "Getting ahead of the curve is the smartest move in farming."', notificationType: 'event_result' },
        ],
        followUpText: "Santos walks you through the research package.\n\n\"These aren't your grandmother's avocados. The UC Riverside program spent 15 years selecting rootstock that handles sustained heat above 100°F without dropping fruit. Standard Hass avocados abort their crop when it gets too hot — these varieties actually photosynthesize more efficiently at higher temperatures.\n\nThe establishment period is real — 4 years before your first harvest. That's a long time to carry maintenance costs without income. But once they're producing, avocados are one of the highest-value crops per acre in California.\n\nAnd here's the strategic angle: if summer temperatures keep climbing — and the data says they will — heat-sensitive crops like tomatoes, almonds, and citrus are going to struggle. Avocados won't just survive that future. They'll thrive in it.\n\nYou're not reacting to a crisis. You're positioning for one that hasn't hit yet. That's the difference between adaptation and scrambling.\"",
      },
      {
        id: 'defer-avocado',
        label: 'Not Right Now',
        description: 'The research is interesting but you have other priorities.',
        effects: [
          { type: 'add_notification', message: 'You passed on avocado research for now. Santos: "The option stays open — the breeding program isn\'t going anywhere."', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['tech-unlock', 'advisor', 'crop'],
  },

  {
    id: 'regime-water-restriction',
    type: 'regulatory',
    title: 'SGMA Water Conservation Mandate',
    description: "Dr. Santos arrives with grim news. \"The Sustainable Groundwater Management Act has hit our basin. State regulators are enforcing a 20% reduction in agricultural water allocation — effective immediately and permanently.\"\n\nShe spreads out a diagram of a water recycling system. \"There's an investment option: install on-farm water recycling. It won't restore your full allocation, but it will make every drop count more — your automatic irrigation would operate at half its current cost.\"\n\nChen pulls up the financials. \"$1,200 for the recycling system. Not cheap, but the ongoing savings on irrigation costs could pay for itself within a few seasons.\"\n\nThe Forum's reaction is mixed. \"SGMA was always coming. Some of us saw the writing on the wall years ago.\"",
    preconditions: [
      { type: 'min_year', year: 10 },
      { type: 'max_year', year: 12 },
      { type: 'not_has_flag', flag: 'regime_water_reduced' },
      { type: 'has_crop' },
    ],
    priority: 100,
    cooldownDays: 0,
    maxOccurrences: 1,
    advisorId: 'extension-agent',
    choices: [
      {
        id: 'invest-water-recycling',
        label: 'Install Water Recycling',
        description: 'On-farm water recycling system. Water allocation still drops 20%, but your auto-irrigation costs are cut in half. Costs $1,200.',
        cost: 1200,
        requiresCash: 1200,
        effects: [
          { type: 'modify_cash', amount: -1200 },
          { type: 'set_flag', flag: 'regime_water_reduced', value: true },
          { type: 'set_flag', flag: 'tech_water_recycling', value: true },
          { type: 'add_notification', message: 'Water recycling system installed. Water allocation has been permanently reduced by 20%, but your irrigation system now operates at half cost. Santos: "Smart adaptation — you\'re making every drop count."', notificationType: 'event_result' },
        ],
      },
      {
        id: 'accept-restrictions',
        label: 'Accept Reduced Allocation',
        description: 'Comply with the new water restrictions without additional investment. Your water allocation drops 20% permanently.',
        effects: [
          { type: 'set_flag', flag: 'regime_water_reduced', value: true },
          { type: 'add_notification', message: 'Water allocation has been permanently reduced by 20% under SGMA. Every irrigation delivers less water. Santos: "This is the new normal. Drought-tolerant crops and careful water management are more important than ever."', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['regime-shift', 'advisor', 'water'],
  },

  {
    id: 'regime-market-crash',
    type: 'market',
    title: 'Almond Market Collapse',
    description: "Marcus Chen calls an emergency meeting. \"I need you to sit down for this. Global almond prices have crashed — oversupply from new Australian orchards, plus a trade dispute with the EU. Almond prices are down 30%, and analysts say this is permanent.\"\n\nHe pulls out a contract form. \"I've been working with a regional buyer who'll lock in a forward contract at a slight premium — it won't fully offset the crash, but it buys you a year to adjust your crop mix.\"\n\nSantos is already thinking ahead: \"If you're heavily invested in almonds, this is the moment to diversify. Pistachios and citrus aren't affected.\"\n\nThe Forum is rattled. \"Three of my neighbors are talking about pulling their almond orchards. Twenty years of investment, gone.\"",
    preconditions: [
      { type: 'min_year', year: 15 },
      { type: 'max_year', year: 18 },
      { type: 'not_has_flag', flag: 'regime_market_crash' },
      { type: 'has_crop' },
    ],
    priority: 100,
    cooldownDays: 0,
    maxOccurrences: 1,
    advisorId: 'farm-credit',
    choices: [
      {
        id: 'negotiate-forward',
        label: 'Negotiate Forward Contract',
        description: 'Lock in a 15% premium on almond sales for the next year. Partially offsets the crash while you adjust your strategy. Costs $300.',
        cost: 300,
        requiresCash: 300,
        effects: [
          { type: 'modify_cash', amount: -300 },
          { type: 'set_flag', flag: 'regime_market_crash', value: true },
          // Source-of-truth coupling: cropId must match scenario.marketCrashTargetCropId (all scenarios = 'almonds' in 5c)
          { type: 'modify_price_modifier', cropId: 'almonds', multiplier: 1.15, durationDays: 365 },
          { type: 'add_notification', message: 'Forward contract negotiated. Almond prices have permanently dropped 30%, but your contract provides a 15% premium for the next year. Chen: "Use this breathing room wisely — diversify before the contract expires."', notificationType: 'event_result' },
        ],
      },
      {
        id: 'accept-crash',
        label: 'Accept Market Conditions',
        description: 'No forward contract. Almond prices drop 30% permanently. Consider diversifying your crop portfolio.',
        effects: [
          { type: 'set_flag', flag: 'regime_market_crash', value: true },
          { type: 'add_notification', message: 'Almond prices have permanently dropped 30%. Chen: "The market doesn\'t care about your investment timeline. Diversify or absorb the loss." Santos: "Pistachios and citrus are unaffected — consider shifting your orchard mix."', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['regime-shift', 'advisor', 'market'],
  },

  {
    id: 'regime-heat-threshold',
    type: 'climate',
    title: 'Permanent Heat Threshold Crossed',
    description: "Dr. Santos arrives with a stack of climate data and a grave expression. \"I've been tracking the temperature trends, and we've crossed a threshold. Average summer highs are now consistently above what most of our traditional crops can handle. This isn't a heatwave — this is the new baseline.\"\n\nShe shows yield projections: tomatoes down 25%, corn down 15%, almonds down 20%, citrus down 15%. Only sorghum, pistachios, and agave are unaffected.\n\n\"Every heat-sensitive crop on your farm will produce less from now on,\" she says. \"The valley has always been hot, but this is a different kind of hot. Sustained, consistent, year after year. The crops that were bred for the old climate aren't adapted to this one.\"\n\nThe Forum has been watching the thermometer too. \"My grandfather never saw summers like this. The valley is changing — we either change with it or we're done.\"",
    preconditions: [
      { type: 'min_year', year: 15 },
      { type: 'max_year', year: 20 },
      { type: 'not_has_flag', flag: 'regime_heat_threshold' },
      { type: 'has_crop' },
    ],
    priority: 100,
    cooldownDays: 0,
    maxOccurrences: 1,
    advisorId: 'extension-agent',
    choices: [
      {
        id: 'acknowledge-heat-regime',
        label: 'The Climate Has Changed',
        description: 'Heat-sensitive crops (tomatoes, corn, wheat, almonds, citrus) will permanently yield less. Sorghum, pistachios, and agave are unaffected.',
        effects: [
          { type: 'set_flag', flag: 'regime_heat_threshold', value: true },
          { type: 'add_notification', message: 'Heat threshold permanently crossed. Tomatoes (-25%), corn (-15%), almonds (-20%), wheat (-10%), and citrus (-15%) will all produce lower yields going forward. Santos: "The valley has crossed a line. The crops that thrive here are changing."', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['regime-shift', 'advisor', 'heat'],
  },

  // --- Slice 7d: Late avocado catchup (reactive fallback) ---

  {
    id: 'advisor-avocado-catchup',
    type: 'advisor',
    title: 'Santos: Avocado Research — Playing Catch-Up',
    description: "Dr. Santos finds you reviewing your latest yield reports. \"I can see the heat regime is hitting your bottom line. Tomatoes, corn, almonds — they're all producing less than they used to, and that's not going to reverse.\"\n\nShe pauses. \"I should have pushed harder on this earlier, but UC Riverside's heat-tolerant avocado program is still open to new growers. The varieties they've developed actually thrive in these temperatures — no heat penalty at all. It's a 4-year establishment period and $800 for the research license, but given what you're losing on heat-sensitive crops, the math works.\"\n\nChen is cautious. \"You're starting late. Four years of establishment means your first harvest isn't until — well, you do the math on how many years you have left. It's not ideal timing.\"\n\nSantos nods. \"Late is still better than never. But I won't pretend this is the same opportunity it was five years ago.\"",
    preconditions: [
      { type: 'has_flag', flag: 'regime_heat_threshold' },
      { type: 'not_has_flag', flag: 'tech_crop_avocado' },
      { type: 'max_year', year: 25 },
      { type: 'has_crop' },
    ],
    priority: 90,
    cooldownDays: 365,
    maxOccurrences: 2,
    advisorId: 'extension-agent',
    foreshadowing: {
      daysBeforeEvent: 90,
      reliability: 1.0,
      signal: 'Santos mentions she\'s been reviewing UC Riverside\'s heat-adapted avocado research — says she might have something worth discussing soon.',
      advisorSource: 'extension-agent',
    },
    choices: [
      {
        id: 'research-avocado-late',
        label: 'Research Heat-Tolerant Avocado',
        description: 'Invest in heat-adapted avocado rootstock. Same crop, higher price — you\'re playing catch-up. Costs $800.',
        cost: 800,
        requiresCash: 800,
        effects: [
          { type: 'modify_cash', amount: -800 },
          { type: 'set_flag', flag: 'tech_crop_avocado', value: true },
          { type: 'add_notification', message: 'Avocado research complete! You can now plant heat-tolerant avocados. Santos: "Better late than never — but you\'ll have less runway than if you\'d started earlier."', notificationType: 'event_result' },
        ],
        followUpText: "Santos helps you set up the starter rootstock.\n\n\"I'll be honest with you — if you'd done this a few years ago, you'd be harvesting by now instead of waiting through another establishment period. The economics are still good, but the window is shorter.\n\nHere's what you're getting: avocado varieties bred specifically for inland heat. No yield penalty when temperatures spike — they actually produce better in sustained heat. $1.20 per pound at current prices, and the trees are productive for decades once established.\n\nThe catch is the 4-year wait. That's 4 years of maintenance costs with no income from these trees. You need to make sure your other crops can carry the farm through that period.\n\nBut the alternative is watching your heat-sensitive crops lose another 15-25% every year with no way to recover that yield. At least avocados give you a path forward.\"\n\nShe looks at the temperature forecast on her tablet. \"The heat isn't going back to what it was. Neither should your crop plan.\"",
      },
      {
        id: 'defer-avocado-late',
        label: 'Not Right Now',
        description: 'You have other priorities despite the heat losses.',
        effects: [
          { type: 'add_notification', message: 'Santos nods slowly. "The offer stands, but the clock is ticking. Every year you wait is a year less of production."', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['tech-unlock', 'advisor', 'crop'],
  },

  // --- Slice 6a: K fertilizer advisor ---

  {
    id: 'advisor-potassium-management',
    type: 'advisor',
    title: 'Soil Nutrient Alert: Potassium',
    description: "I've been analyzing the soil health across your fields, and potassium levels are getting low. Potassium is critical for crop quality — it affects fruit size, sugar content, and disease resistance. When K drops, your harvest sells for less even if yields look normal.",
    preconditions: [
      { type: 'min_year', year: 5 },
      { type: 'avg_potassium_below', level: 100 },
    ],
    priority: 95,
    cooldownDays: 730,
    maxOccurrences: 2,
    advisorId: 'extension-agent',
    choices: [
      {
        id: 'apply-potash',
        label: 'Apply Potash Fertilizer',
        description: 'Purchase and apply potassium fertilizer across all fields. Quick restoration but costs money.',
        cost: 500,
        requiresCash: 500,
        effects: [
          { type: 'modify_cash', amount: -500 },
          { type: 'modify_potassium_all', amount: 80 },
          { type: 'set_flag', flag: 'organic_violation_this_year', value: true },
          { type: 'add_notification', message: 'Potash fertilizer applied across all fields. Soil potassium levels restored.', notificationType: 'event_result' },
        ],
        followUpText: "Potassium is one of the three primary nutrients plants need, along with nitrogen and phosphorus. Unlike nitrogen, which you can restore with cover crops and rotation, potassium is mainly replenished through mineral fertilizers or very slow rock weathering. Every harvest removes K from your soil — heavy feeders like tomatoes and corn deplete it fastest. How long it lasts depends on what you're growing — heavy feeders like tomatoes and corn will burn through it in a single harvest, while wheat and cover crops are much lighter on K. Keep an eye on crop quality at harvest for early warning signs.",
      },
      {
        id: 'note-symptoms',
        label: 'What Should I Watch For?',
        description: 'Learn to recognize potassium deficiency symptoms and manage it through crop rotation.',
        effects: [
          { type: 'add_notification', message: 'Dr. Santos pointed out potassium deficiency signs to watch for in your crops.', notificationType: 'event_result' },
        ],
        followUpText: "Watch for yellowing leaf edges, especially on older leaves — that's the classic K deficiency sign. At harvest, you'll notice lower sale prices because fruit quality suffers: smaller size, less sugar, thinner skins. The practical lever you have is crop rotation. Different crops pull K at very different rates — tomatoes are the heaviest feeders at 250 lbs/acre, while wheat takes only 50. Alternating heavy and light feeders gives the soil time to recover. Perennial orchards are the hardest to manage since you can't rotate them.",
      },
    ],
    tags: ['advisor', 'soil', 'nutrients'],
  },

  // ==========================================================================
  // Slice 6b: Valley Growers Forum community storylets
  // All require met_forum flag, type: 'community' (own seasonal cap slot)
  // ==========================================================================

  {
    id: 'forum-rotation-tip',
    type: 'community',
    title: 'Forum Post: Rotation Advice',
    description: "CornDawg_82 posted in the Valley Growers Forum:\n\n\"OK so my extension agent keeps telling me to rotate my crops and I finally listened. Went corn → wheat → tomatoes → corn and honestly? My corn came back way better the second round. Used to get these thin sad ears after year 3 and thought it was just bad luck. Turns out planting the same thing over and over wears out the soil or something. Anyway just sharing in case anyone else is stubborn like me 😅\"",
    preconditions: [
      { type: 'has_flag', flag: 'met_forum' },
      { type: 'min_year', year: 3 },
      { type: 'max_year', year: 6 },
      { type: 'random', probability: 0.40 },
    ],
    priority: 50,
    cooldownDays: 0,
    maxOccurrences: 1,
    advisorId: 'growers-forum',
    choices: [
      {
        id: 'ask-details',
        label: 'Ask for Details',
        description: 'You want to understand the science behind rotation.',
        effects: [
          { type: 'add_notification', message: 'The Forum discussed crop rotation strategies — several members shared their own experiences.', notificationType: 'event_result' },
        ],
        followUpText: "The thread turned into a lively discussion. A few key points emerged: planting the same annual crop repeatedly depletes specific nutrients and lets crop-specific pests build up in the soil. Each crop family pulls different nutrients at different rates and attracts different insects. By switching crops each season, you break pest cycles and let the soil recover. Several members confirmed yield drops after 2-3 consecutive seasons of the same crop — and rebounds when they finally rotated.",
      },
      {
        id: 'thanks-noted',
        label: 'Thanks, Noted',
        description: 'Good to keep in mind.',
        effects: [
          { type: 'add_notification', message: 'CornDawg_82\'s rotation tip filed away for reference.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['community', 'forum', 'rotation'],
  },

  {
    id: 'forum-neighbor-corn-died',
    type: 'community',
    title: 'Forum Post: Neighbor\'s Corn Failed',
    description: "ValleyVet_Jake posted in the Valley Growers Forum:\n\n\"Bad news from down the road. My neighbor Dave planted corn for 6 straight years — same fields, same hybrid, never rotated. This summer his whole section went brown practically overnight. Extension says it was corn rootworm — the larvae had been building up in the soil for years. By the time he saw the damage it was too late. Lost about 40% of his crop. Just a heads up for anyone running corn heavy.\"",
    preconditions: [
      { type: 'has_flag', flag: 'met_forum' },
      { type: 'min_year', year: 5 },
      { type: 'max_year', year: 8 },
      { type: 'has_crop', cropId: 'silage-corn' },
      { type: 'random', probability: 0.35 },
    ],
    priority: 50,
    cooldownDays: 0,
    maxOccurrences: 1,
    advisorId: 'growers-forum',
    choices: [
      {
        id: 'thats-concerning',
        label: 'That\'s Concerning',
        description: 'You want to understand the pest threat better.',
        effects: [
          { type: 'add_notification', message: 'The Forum discussed rootworm risk and monoculture vulnerability.', notificationType: 'event_result' },
        ],
        followUpText: "The thread got serious fast. Several members chimed in with similar stories — persistent corn planting creates perfect conditions for corn rootworm populations to explode. The larvae feed on corn roots specifically, and each generation gets bigger when there\'s a guaranteed food source every year. Chemical treatments work but they\'re expensive and temporary. The best defense is breaking the cycle: rotate to a non-host crop for even one season and the rootworm population crashes because the larvae starve.",
      },
      {
        id: 'wont-happen',
        label: 'Won\'t Happen to Me',
        description: 'Your operation is different.',
        effects: [
          { type: 'add_notification', message: 'You noted Jake\'s warning but figure your situation is different.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['community', 'forum', 'pest', 'foreshadow'],
  },

  {
    id: 'forum-water-board-gossip',
    type: 'community',
    title: 'Forum Post: Water Board Rumors',
    description: "Drip_Queen_Linda posted in the Valley Growers Forum:\n\n\"Hey all — my brother-in-law works for the county and he says the water board has been having closed-door meetings about pumping restrictions. Something about the aquifer levels dropping faster than their models predicted. Nothing official yet but when has the government ever given us a heads up before cutting our water? Just saying — might want to think about efficiency upgrades sooner rather than later.\"",
    preconditions: [
      { type: 'has_flag', flag: 'met_forum' },
      { type: 'min_year', year: 7 },
      { type: 'max_year', year: 9 },
      { type: 'random', probability: 0.50 },
    ],
    priority: 50,
    cooldownDays: 0,
    maxOccurrences: 1,
    advisorId: 'growers-forum',
    choices: [
      {
        id: 'what-did-you-hear',
        label: 'What Did You Hear?',
        description: 'Dig deeper into the rumors.',
        effects: [
          { type: 'add_notification', message: 'The Forum debated the likelihood and impact of water restrictions.', notificationType: 'event_result' },
        ],
        followUpText: "The discussion got heated. Linda shared more details: the San Joaquin Valley\'s groundwater has been declining for decades, and the Sustainable Groundwater Management Act (SGMA) is forcing local agencies to develop plans that actually reduce pumping. Several members confirmed hearing similar rumors. OldTimerPete pointed out that his well depth has dropped 30 feet in 10 years. The consensus: restrictions aren't a matter of if, but when. Farms with efficient irrigation systems will have a major advantage when allocations get cut.",
      },
      {
        id: 'probably-rumors',
        label: 'Probably Just Rumors',
        description: 'People always talk about water restrictions.',
        effects: [
          { type: 'add_notification', message: 'You\'ve heard water restriction rumors before — most don\'t pan out.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['community', 'forum', 'water', 'foreshadow'],
  },

  {
    id: 'forum-market-whisper',
    type: 'community',
    title: 'Forum Post: Import Competition Fears',
    description: "AlmondBaron_Ray posted in the Valley Growers Forum:\n\n\"Anyone else watching the Australian almond numbers? Their new orchards are coming online fast and their harvest season is opposite ours, meaning they fill the gaps we used to own. Add in cheap pistachios from Iran and Turkey... I'm not saying the sky is falling but I moved 20% of my acreage to diversified annuals last year. The premium prices we've been getting won't last forever. Just my two cents.\"",
    preconditions: [
      { type: 'has_flag', flag: 'met_forum' },
      { type: 'min_year', year: 12 },
      { type: 'max_year', year: 14 },
      { type: 'random', probability: 0.45 },
    ],
    priority: 50,
    cooldownDays: 0,
    maxOccurrences: 1,
    advisorId: 'growers-forum',
    choices: [
      {
        id: 'tell-me-more',
        label: 'Tell Me More',
        description: 'You want to understand the market dynamics.',
        effects: [
          { type: 'add_notification', message: 'The Forum discussed global competition in tree crop markets.', notificationType: 'event_result' },
        ],
        followUpText: "Ray knows his numbers. California produces 80% of the world\'s almonds, but that dominance is eroding as Australia, Spain, and Morocco expand production. Global supply increasing means prices drop — basic economics. The same pattern is starting with pistachios. Several members pointed out that annual crops are more adaptable to market shifts because you can switch what you plant each season, while orchard crops lock you in for 20+ years. Diversification isn\'t just about soil health — it\'s about market risk management.",
      },
      {
        id: 'markets-recover',
        label: 'Markets Always Recover',
        description: 'California quality commands premium prices.',
        effects: [
          { type: 'add_notification', message: 'You\'re confident California\'s quality advantage will hold. Ray seems less sure.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['community', 'forum', 'market', 'foreshadow'],
  },

  {
    id: 'forum-heat-worry',
    type: 'community',
    title: 'Forum Post: Summers Getting Worse',
    description: "OldTimerPete posted in the Valley Growers Forum:\n\n\"Been farming this valley 45 years. When I started, 100°F was a hot day. Now it's a normal Tuesday in July. My dad kept weather logs — I dug them out. Average summer highs are up almost 4 degrees since the 80s. My almonds are struggling, my tomatoes sunburn every August, and the irrigation bills keep climbing. I don't care what anyone says about politics — the thermometer doesn't lie. Something is changing and it ain't going back.\"",
    preconditions: [
      { type: 'has_flag', flag: 'met_forum' },
      { type: 'min_year', year: 14 },
      { type: 'max_year', year: 17 },
      { type: 'random', probability: 0.40 },
    ],
    priority: 50,
    cooldownDays: 0,
    maxOccurrences: 1,
    advisorId: 'growers-forum',
    choices: [
      {
        id: 'what-are-you-seeing',
        label: 'What Are You Seeing?',
        description: 'Pete\'s observations match what you\'ve noticed.',
        effects: [
          { type: 'add_notification', message: 'The Forum shared observations about long-term temperature trends.', notificationType: 'event_result' },
        ],
        followUpText: "Pete\'s weather logs started a wave of similar stories. Several members pulled out their own records. The data is consistent: summer highs in the Central Valley have risen steadily, extreme heat events are more frequent, and growing seasons are shifting. The practical impact is real — heat stress reduces yields for many traditional crops, increases water demand, and shortens the window for heat-sensitive operations like pollination. Members who\'ve started planting heat-adapted varieties say they\'re seeing better results. The consensus: plan for hotter, not hope for cooler.",
      },
      {
        id: 'just-weather',
        label: 'It\'s Just Weather',
        description: 'Hot summers are nothing new in the Valley.',
        effects: [
          { type: 'add_notification', message: 'You figure the Valley has always been hot. Pete just isn\'t used to it anymore.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['community', 'forum', 'heat', 'foreshadow'],
  },

  {
    id: 'forum-insurance-debate',
    type: 'community',
    title: 'Forum Post: Crop Insurance — Worth It?',
    description: "CropInsGuy_Mike posted in the Valley Growers Forum:\n\n\"PSA: crop insurance saved my operation last year. Lost 30% of my almonds to that late frost and the payout covered my loan payments. $500/year is nothing compared to one bad season.\"\n\nFreedomFarmer_Dave replied: \"$500/year for 30 years is $15,000 you'll never see again if nothing goes wrong. I'd rather keep the cash and self-insure. Government programs just make you dependent.\"\n\nMike: \"Dave your corn died in the drought of '18 and you almost lost the farm.\"\nDave: \"...that was different.\"",
    preconditions: [
      { type: 'has_flag', flag: 'met_forum' },
      { type: 'min_year', year: 6 },
      { type: 'max_year', year: 10 },
      { type: 'random', probability: 0.35 },
    ],
    priority: 50,
    cooldownDays: 0,
    maxOccurrences: 1,
    advisorId: 'growers-forum',
    choices: [
      {
        id: 'insurance-smart',
        label: 'Insurance Sounds Smart',
        description: 'Mike makes a good case for risk management.',
        effects: [
          { type: 'add_notification', message: 'The insurance debate gave you a lot to think about.', notificationType: 'event_result' },
        ],
        followUpText: "The thread went on for pages. The core argument: farming is inherently risky — weather, pests, markets can all wipe out a season. Insurance is a tool for managing that risk, not eliminating it. The annual premium is a known, predictable cost. A catastrophic loss without insurance is unpredictable and potentially fatal to the operation. Most successful large farms carry some form of crop insurance. The key is understanding what's covered and what isn't — and it doesn't help if you can't afford the deductible.",
      },
      {
        id: 'take-chances',
        label: 'I\'ll Take My Chances',
        description: 'Dave\'s self-reliance approach appeals to you.',
        effects: [
          { type: 'add_notification', message: 'You figure you can handle whatever comes without paying insurance premiums.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['community', 'forum', 'insurance', 'foreshadow'],
  },

  {
    id: 'forum-organic-buzz',
    type: 'community',
    title: 'Forum Post: Organic Premium Worth It?',
    description: "GreenThumb_Sara posted in the Valley Growers Forum:\n\n\"So I've been looking into organic certification. The premium prices are real — 20% or more above conventional for the same crops. But it's a 3-year transition where you can't use any synthetic fertilizers or pesticides AND you don't get the premium yet. That's rough. Anyone here gone through it? Is the payoff real or just marketing hype?\"",
    preconditions: [
      { type: 'has_flag', flag: 'met_forum' },
      { type: 'min_year', year: 5 },
      { type: 'max_year', year: 9 },
      { type: 'random', probability: 0.30 },
    ],
    priority: 50,
    cooldownDays: 0,
    maxOccurrences: 1,
    advisorId: 'growers-forum',
    choices: [
      {
        id: 'whats-involved',
        label: 'What\'s Involved?',
        description: 'The premium pricing is interesting.',
        effects: [
          { type: 'add_notification', message: 'The Forum shared experiences about organic certification.', notificationType: 'event_result' },
        ],
        followUpText: "A few members had gone through organic transition. The process: you commit to no synthetic chemicals for 3 years while applying for USDA organic certification. During transition, you pay certification fees but don\'t get premium prices — it\'s a real investment. After certification, you get roughly 20% higher prices on everything you sell. The catch: you can\'t use synthetic fertilizers (including conventional potash) or chemical pesticides. One bad pest outbreak and your only options are expensive organic treatments or accepting losses. It rewards patient, diversified farming but punishes monoculture and reactive management.",
      },
      {
        id: 'too-much-hassle',
        label: 'Too Much Hassle',
        description: 'Three years of restrictions isn\'t for you.',
        effects: [
          { type: 'add_notification', message: 'Organic certification sounds like more trouble than it\'s worth for now.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['community', 'forum', 'organic', 'foreshadow'],
  },

  // --- Organic Certification Offer (6d.2) ---
  // Condition-only advisor: Santos offers organic transition after foreshadow window.
  // Three choices: enroll (commit to transition), later (allows re-offer), decline (permanent).
  {
    id: 'santos-organic-offer',
    type: 'regulatory',
    title: 'Organic Certification Opportunity',
    description: "I've been watching your farm, and I think you might be a good candidate for USDA organic certification. The premium prices — about 20% above conventional — are real, but it's a serious commitment. There's a 3-year transition period where you pay $400/year in certification fees without getting the premium yet. During that time and after, you cannot use synthetic fertilizers, chemical pesticides, or potash — any violation resets your transition clock or revokes certification. You'll also need cover crops on at least 16 fields each winter — plant them in fall and they'll be checked at year-end. It rewards the kind of sustainable management I've seen you working toward.",
    preconditions: [
      { type: 'min_year', year: 7 },
      { type: 'not_has_flag', flag: 'organic_enrolled' },
      { type: 'not_has_flag', flag: 'organic_declined' },
      { type: 'has_crop' },
    ],
    priority: 80,
    cooldownDays: 365,
    maxOccurrences: 3,
    advisorId: 'extension-agent',
    choices: [
      {
        id: 'enroll-organic',
        label: 'Begin Organic Transition',
        description: 'Commit to a 3-year transition period. $400/year certification fee charged at year-end.',
        effects: [
          { type: 'set_flag', flag: 'organic_enrolled', value: true },
          { type: 'add_notification', message: 'You\'ve enrolled in organic certification! The 3-year transition begins now. No synthetic fertilizers, chemical pesticides, or potash allowed. Maintain cover crops on at least 16 fields for the 20% price premium.', notificationType: 'event_result' },
        ],
        followUpText: "Great decision. Here's what happens next: for the next 3 years, you'll pay $400 annually in certification fees while transitioning your farm. You won't get the premium prices yet — that's the hard part. During transition and after certification, you cannot use synthetic fertilizers, chemical pesticides, or potash — any violation resets your transition clock. After 3 clean years with cover crops on at least 16 fields, you'll earn USDA organic certification and a 20% premium on all your harvest revenue. It's an investment in your farm's future.",
      },
      {
        id: 'organic-later',
        label: 'Not Right Now',
        description: 'Maybe next year. Santos will check back.',
        effects: [
          { type: 'add_notification', message: 'You decided to wait on organic certification. Dr. Santos will check in again next year.', notificationType: 'event_result' },
        ],
      },
      {
        id: 'decline-organic',
        label: 'Not Interested',
        description: 'Organic certification isn\'t for your farm.',
        effects: [
          { type: 'set_flag', flag: 'organic_declined', value: true },
          { type: 'add_notification', message: 'You declined organic certification. Dr. Santos respects your decision.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['advisor', 'organic', 'regulatory'],
  },

  {
    id: 'forum-bad-advice',
    type: 'community',
    title: 'Forum Post: Expert Farming Advice™',
    description: "MyUncleKnows_Tommy posted in the Valley Growers Forum:\n\n\"Look I know the extension agents push all this rotation and diversification stuff but my uncle farmed 500 acres of nothing but corn for 20 years and made bank. Sorghum is worthless — terrible prices, nobody buys it. Corn is king. The big operations plant corn because it WORKS. All this cover crop, rotation, soil health stuff is just what they teach at universities to justify their salaries. Plant corn. Water it. Cash the checks. Simple.\"",
    preconditions: [
      { type: 'has_flag', flag: 'met_forum' },
      { type: 'min_year', year: 4 },
      { type: 'max_year', year: 8 },
      { type: 'random', probability: 0.30 },
    ],
    priority: 50,
    cooldownDays: 0,
    maxOccurrences: 1,
    advisorId: 'growers-forum',
    choices: [
      {
        id: 'diversification-helps',
        label: 'Actually, Diversification Helps...',
        description: 'You push back on Tommy\'s oversimplified advice.',
        effects: [
          { type: 'add_notification', message: 'The Forum had a spirited debate about monoculture vs. diversification.', notificationType: 'event_result' },
        ],
        followUpText: "The thread blows up.\n\nValleyDirt_Dan: \"Tommy my guy, your uncle also had $12/acre-foot water and no SGMA. Ask him what he'd do NOW.\"\n\nCitrusGal_Visalia: \"Corn-only worked when the aquifer was bottomless. My neighbor went all-in on corn, had one bad water year, lost everything. But sure, plant corn.\"\n\nMyUncleKnows_Tommy: \"OK but he still made more money than any of your little hobby farms\"\n\nOldTimer_Reedley: \"Kid, I've been here 40 years. The guys who survived are the ones who had more than one thing to sell when the price dropped. Your uncle got lucky with timing. Luck isn't a strategy.\"\n\nSorghumDave: \"Also sorghum prices aren't great but my sorghum is still alive in August when Tommy's uncle's corn would be toast. There's a reason it's called a survival crop.\"\n\nThe conversation goes in circles after that. Nobody changes anybody's mind, but you notice the older farmers — the ones still farming — mostly aren't corn-only.",
      },
      {
        id: 'good-to-know',
        label: 'Good to Know',
        description: 'Tommy seems confident.',
        effects: [
          { type: 'add_notification', message: 'Tommy\'s advice sounds simple and straightforward. Uncle knows best, right?', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['community', 'forum', 'bad-advice'],
  },

  // ============================================================================
  // Slice 6c: Catastrophe + Risk Management
  // ============================================================================

  // --- Chen Insurance Offer (condition-only advisor) ---

  {
    id: 'chen-insurance-offer',
    type: 'advisor' as const,
    title: 'Crop Insurance Opportunity',
    description: 'Chen from Farm Credit calls with an offer. "I\'ve been looking at your operation, and I think it\'s time we talked about crop insurance. It\'s $500 a year — not cheap, I know — but if something catastrophic happens, you\'ll be glad you had it. Rootworm outbreak, disease, water emergency... insurance covers a portion of your losses with a small deductible. Without it, you\'re absorbing the full hit."',
    preconditions: [
      { type: 'min_year', year: 8 },
      { type: 'not_has_flag', flag: 'has_crop_insurance' },
      { type: 'not_has_flag', flag: 'chen_insurance_declined' },
      { type: 'cash_above', amount: 5000 },
    ],
    priority: 100,
    cooldownDays: 0,
    maxOccurrences: 1,
    advisorId: 'farm-credit',
    choices: [
      {
        id: 'enroll-insurance',
        label: 'Enroll in Crop Insurance ($500/year)',
        description: 'Sign up for Chen\'s crop insurance program.',
        effects: [
          { type: 'set_flag', flag: 'has_crop_insurance', value: true },
          { type: 'add_notification', message: 'You enrolled in crop insurance. $500 will be deducted annually at year-end.', notificationType: 'event_result' },
        ],
        followUpText: 'Chen files the paperwork on the spot. "Smart move. The premium — $500 a year — comes out at year-end with your other expenses. If you ever face a catastrophe — rootworm, disease, water emergency — you\'ll have the option to file a claim. There\'s a $200 deductible, but the payout covers a significant portion of your losses. Think of it as buying peace of mind for the back half of your farming career."',
      },
      {
        id: 'decline-insurance',
        label: 'Decline — I\'ll Self-Insure',
        description: 'Save the premium and hope for the best.',
        effects: [
          { type: 'set_flag', flag: 'chen_insurance_declined', value: true },
          { type: 'add_notification', message: 'You declined crop insurance. Chen won\'t offer again.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['advisor', 'insurance'],
  },

  // --- Catastrophe: Corn Rootworm (foreshadowed by forum-neighbor-corn-died) ---

  {
    id: 'catastrophe-rootworm',
    type: 'climate' as const,
    illustrationId: 'event-rootworm',
    title: 'Rootworm Outbreak',
    description: 'Western corn rootworm has been detected in your fields. The larvae are feeding on corn roots, and without intervention, you\'ll lose a significant portion of your crop. The longer you wait, the worse the damage.',
    preconditions: [
      { type: 'min_year', year: 8 },
      { type: 'max_year', year: 15 },
      { type: 'has_crop', cropId: 'silage-corn' },
      { type: 'season', season: 'summer' },
      { type: 'random', probability: 0.25 },
    ],
    priority: 60,
    cooldownDays: 1095,
    maxOccurrences: 2,
    foreshadowing: {
      signal: 'County ag inspectors found rootworm egg masses in fields near yours. Treatment decisions may be needed soon.',
      daysBeforeEvent: 10,
      reliability: 0.85,
    },
    choices: [
      {
        id: 'emergency-treatment',
        label: 'Emergency Treatment ($800)',
        description: 'Apply targeted pesticide to limit damage. Expensive but effective.',
        cost: 800,
        requiresCash: 800,
        effects: [
          { type: 'modify_cash', amount: -800 },
          { type: 'damage_crops', target: 'silage-corn', percentage: 0.20 },
          { type: 'set_flag', flag: 'organic_violation_this_year', value: true },
          { type: 'add_notification', message: 'Emergency rootworm treatment applied. You lost 20% of your corn but saved the rest.', notificationType: 'event_result' },
        ],
      },
      {
        id: 'file-rootworm-claim',
        label: 'File Insurance Claim ($200 deductible)',
        description: 'Your crop insurance covers rootworm damage with a $200 deductible.',
        cost: 200,
        requiresCash: 200,
        requiresFlag: 'has_crop_insurance',
        effects: [
          { type: 'modify_cash', amount: -200 },
          { type: 'damage_crops', target: 'silage-corn', percentage: 0.15 },
          { type: 'insurance_payout', amount: 1500 },
          { type: 'add_notification', message: 'Insurance claim filed. $1,500 payout minus $200 deductible = $1,300 net. Lost 15% of corn (vs. 20% without insurance).', notificationType: 'event_result' },
        ],
        followUpText: 'The insurance adjuster arrives within days. "Clear case of rootworm damage," she confirms. The $1,500 payout helps offset your losses, and the professional treatment they arrange limits crop damage to 15%. Chen calls to check in: "This is exactly why I recommended the policy. One claim already covers three years of premiums."',
      },
      {
        id: 'accept-rootworm-losses',
        label: 'Accept the Losses',
        description: 'Let nature take its course. The damage will be severe.',
        effects: [
          { type: 'damage_crops', target: 'silage-corn', percentage: 0.40 },
          { type: 'add_notification', message: 'Rootworm devastated your corn. 40% of your crop is gone.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['climate', 'catastrophe', 'corn'],
  },

  // --- Catastrophe: Pollination Failure ---

  {
    id: 'catastrophe-pollination-failure',
    type: 'climate' as const,
    title: 'Pollination Crisis',
    description: 'Managed honeybee colonies across the Valley have collapsed this spring. Commercial pollination services are scrambling, and your tree crops are at risk of severely reduced fruit set. Without adequate pollination, yields will plummet.',
    preconditions: [
      { type: 'min_year', year: 12 },
      { type: 'max_year', year: 22 },
      { type: 'has_any_crop_in', cropIds: ['almonds', 'pistachios', 'citrus', 'heat-avocado'] },
      { type: 'season', season: 'spring' },
      { type: 'random', probability: 0.20 },
    ],
    priority: 60,
    cooldownDays: 1460,
    maxOccurrences: 1,
    foreshadowing: {
      signal: 'Beekeepers are reporting unusual colony losses this winter. Spring pollination contracts may be affected.',
      daysBeforeEvent: 14,
      reliability: 0.80,
    },
    choices: [
      {
        id: 'hire-premium-bees',
        label: 'Hire Premium Pollinators ($1,200)',
        description: 'Pay a premium for the few remaining healthy colonies.',
        cost: 1200,
        requiresCash: 1200,
        effects: [
          { type: 'modify_cash', amount: -1200 },
          { type: 'modify_yield_modifier', cropId: 'almonds', multiplier: 0.85, durationDays: 90 },
          { type: 'modify_yield_modifier', cropId: 'pistachios', multiplier: 0.85, durationDays: 90 },
          { type: 'modify_yield_modifier', cropId: 'citrus', multiplier: 0.85, durationDays: 90 },
          { type: 'modify_yield_modifier', cropId: 'heat-avocado', multiplier: 0.85, durationDays: 90 },
          { type: 'add_notification', message: 'Premium pollinators secured. Tree crop yields reduced by 15% this season.', notificationType: 'event_result' },
        ],
      },
      {
        id: 'file-pollination-claim',
        label: 'File Insurance Claim ($200 deductible)',
        description: 'Your insurance covers pollination failure losses.',
        cost: 200,
        requiresCash: 200,
        requiresFlag: 'has_crop_insurance',
        effects: [
          { type: 'modify_cash', amount: -200 },
          { type: 'modify_yield_modifier', cropId: 'almonds', multiplier: 0.80, durationDays: 90 },
          { type: 'modify_yield_modifier', cropId: 'pistachios', multiplier: 0.80, durationDays: 90 },
          { type: 'modify_yield_modifier', cropId: 'citrus', multiplier: 0.80, durationDays: 90 },
          { type: 'modify_yield_modifier', cropId: 'heat-avocado', multiplier: 0.80, durationDays: 90 },
          { type: 'insurance_payout', amount: 1000 },
          { type: 'add_notification', message: 'Insurance claim filed. $1,000 payout minus $200 deductible = $800 net. Tree crop yields reduced by 20% (vs. 45% without insurance).', notificationType: 'event_result' },
        ],
        followUpText: 'The adjuster documents the pollination failure across your orchard. "Colony collapse is getting worse every year," she says. The $800 net payout helps offset revenue losses, and the hired pollinators limit yield damage to 20% instead of the 45% you\'d face without coverage.',
      },
      {
        id: 'mutual-aid-pollination',
        label: 'Cooperative Mutual Aid ($100 share)',
        description: 'Your mutual aid cooperative covers some pollination losses, though payouts are smaller than commercial insurance.',
        cost: 100,
        requiresCash: 100,
        requiresFlag: 'mutual_aid',
        effects: [
          { type: 'modify_cash', amount: -100 },
          { type: 'modify_yield_modifier', cropId: 'almonds', multiplier: 0.80, durationDays: 90 },
          { type: 'modify_yield_modifier', cropId: 'pistachios', multiplier: 0.80, durationDays: 90 },
          { type: 'modify_yield_modifier', cropId: 'citrus', multiplier: 0.80, durationDays: 90 },
          { type: 'modify_yield_modifier', cropId: 'heat-avocado', multiplier: 0.80, durationDays: 90 },
          { type: 'insurance_payout', amount: 500 },
          { type: 'add_notification', message: 'Mutual aid claim filed. $500 cooperative payout minus $100 cost share = $400 net. Tree crop yields reduced by 20%.', notificationType: 'event_result' },
        ],
        followUpText: 'The cooperative coordinator calls the next day. "We pooled resources from twelve farms in the network. It\'s not as much as a commercial policy would pay — we\'re running lean — but $400 net keeps you in the game." She pauses. "The real benefit of the co-op isn\'t the money. It\'s that twelve farmers all noticed the colony collapse at the same time and shared pollinator contacts. Three of us found replacement hives through the network that weren\'t available on the open market."',
      },
      {
        id: 'accept-pollination-loss',
        label: 'Accept Reduced Harvest',
        description: 'Without pollinators, fruit set will be dramatically reduced.',
        effects: [
          { type: 'modify_yield_modifier', cropId: 'almonds', multiplier: 0.55, durationDays: 90 },
          { type: 'modify_yield_modifier', cropId: 'pistachios', multiplier: 0.55, durationDays: 90 },
          { type: 'modify_yield_modifier', cropId: 'citrus', multiplier: 0.55, durationDays: 90 },
          { type: 'modify_yield_modifier', cropId: 'heat-avocado', multiplier: 0.55, durationDays: 90 },
          { type: 'add_notification', message: 'Pollination failure devastated your tree crops. Yields cut by 45%.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['climate', 'catastrophe', 'perennial'],
  },

  // --- Catastrophe: Orchard Disease ---

  {
    id: 'catastrophe-orchard-disease',
    type: 'climate' as const,
    illustrationId: 'event-orchard-disease',
    title: 'Orchard Disease Outbreak',
    description: 'A bacterial pathogen has been confirmed in orchards near yours. Several of your trees are showing symptoms — leaf scorch, branch dieback, and fruit drop. Without aggressive management, you could lose entire blocks of trees.',
    preconditions: [
      { type: 'min_year', year: 15 },
      { type: 'max_year', year: 25 },
      { type: 'has_any_crop_in', cropIds: ['almonds', 'pistachios', 'citrus', 'heat-avocado'] },
      { type: 'season', season: 'fall' },
      { type: 'random', probability: 0.20 },
    ],
    priority: 60,
    cooldownDays: 1825,
    maxOccurrences: 1,
    foreshadowing: {
      signal: 'State agricultural inspectors have been spotted in nearby orchards. Something may be spreading.',
      daysBeforeEvent: 14,
      reliability: 0.75,
    },
    choices: [
      {
        id: 'aggressive-management',
        label: 'Aggressive Treatment ($1,000)',
        description: 'Remove infected trees immediately and treat surrounding blocks.',
        cost: 1000,
        requiresCash: 1000,
        effects: [
          { type: 'modify_cash', amount: -1000 },
          { type: 'damage_crops', target: 'almonds', percentage: 0.10 },
          { type: 'damage_crops', target: 'pistachios', percentage: 0.10 },
          { type: 'damage_crops', target: 'citrus', percentage: 0.10 },
          { type: 'damage_crops', target: 'heat-avocado', percentage: 0.10 },
          { type: 'set_flag', flag: 'organic_violation_this_year', value: true },
          { type: 'modify_yield_modifier', cropId: 'almonds', multiplier: 0.90, durationDays: 180 },
          { type: 'modify_yield_modifier', cropId: 'pistachios', multiplier: 0.90, durationDays: 180 },
          { type: 'modify_yield_modifier', cropId: 'citrus', multiplier: 0.90, durationDays: 180 },
          { type: 'modify_yield_modifier', cropId: 'heat-avocado', multiplier: 0.90, durationDays: 180 },
          { type: 'add_notification', message: 'Aggressive disease management saved most of your orchard. Lost 10% of trees; survivors yield 90%.', notificationType: 'event_result' },
        ],
      },
      {
        id: 'file-disease-claim',
        label: 'File Insurance Claim ($200 deductible)',
        description: 'Insurance covers disease damage with professional remediation.',
        cost: 200,
        requiresCash: 200,
        requiresFlag: 'has_crop_insurance',
        effects: [
          { type: 'modify_cash', amount: -200 },
          { type: 'damage_crops', target: 'almonds', percentage: 0.15 },
          { type: 'damage_crops', target: 'pistachios', percentage: 0.15 },
          { type: 'damage_crops', target: 'citrus', percentage: 0.15 },
          { type: 'damage_crops', target: 'heat-avocado', percentage: 0.15 },
          { type: 'insurance_payout', amount: 1200 },
          { type: 'add_notification', message: 'Insurance claim filed. $1,200 payout minus $200 deductible = $1,000 net. Lost 15% of trees (vs. 25% without treatment).', notificationType: 'event_result' },
        ],
        followUpText: 'The insurance company sends their own arborist. "We see this more and more," she says, marking infected trees for removal. The $1,000 net payout partially covers your losses. Without insurance, you\'d face 25% tree loss and no financial cushion. "Better to lose 15% now than 50% next year," the arborist explains.',
      },
      {
        id: 'mutual-aid-disease',
        label: 'Cooperative Mutual Aid ($100 share)',
        description: 'Your cooperative helps cover disease remediation costs with a shared cost model.',
        cost: 100,
        requiresCash: 100,
        requiresFlag: 'mutual_aid',
        effects: [
          { type: 'modify_cash', amount: -100 },
          { type: 'damage_crops', target: 'almonds', percentage: 0.15 },
          { type: 'damage_crops', target: 'pistachios', percentage: 0.15 },
          { type: 'damage_crops', target: 'citrus', percentage: 0.15 },
          { type: 'damage_crops', target: 'heat-avocado', percentage: 0.15 },
          { type: 'insurance_payout', amount: 600 },
          { type: 'add_notification', message: 'Mutual aid claim filed. $600 cooperative payout minus $100 cost share = $500 net. Lost 15% of trees.', notificationType: 'event_result' },
        ],
        followUpText: 'The cooperative\'s agricultural advisor arrives the same week — a retired extension agent who volunteers with the network. "Commercial insurance sends an adjuster," she says, pulling on gloves. "We send someone who actually knows trees." She marks the infected sections with practiced efficiency, coordinating removal with two other co-op members who have chainsaws and a chipper. The $500 net is less than a commercial payout, but the labor coordination saved you at least that much again. "This is what the cooperative is for," she says. "Nobody has to face this alone."',
      },
      {
        id: 'accept-disease-loss',
        label: 'Hope It Doesn\'t Spread',
        description: 'Avoid the cost and hope the disease burns itself out.',
        effects: [
          { type: 'damage_crops', target: 'almonds', percentage: 0.25 },
          { type: 'damage_crops', target: 'pistachios', percentage: 0.25 },
          { type: 'damage_crops', target: 'citrus', percentage: 0.25 },
          { type: 'damage_crops', target: 'heat-avocado', percentage: 0.25 },
          { type: 'modify_yield_modifier', cropId: 'almonds', multiplier: 0.80, durationDays: 180 },
          { type: 'modify_yield_modifier', cropId: 'pistachios', multiplier: 0.80, durationDays: 180 },
          { type: 'modify_yield_modifier', cropId: 'citrus', multiplier: 0.80, durationDays: 180 },
          { type: 'modify_yield_modifier', cropId: 'heat-avocado', multiplier: 0.80, durationDays: 180 },
          { type: 'add_notification', message: 'Disease spread unchecked. You lost 25% of your trees and surviving yields dropped 20%.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['climate', 'catastrophe', 'perennial'],
  },

  // --- Catastrophe: Water Emergency (foreshadowed by forum-water-board-gossip) ---

  {
    id: 'catastrophe-water-emergency',
    type: 'regulatory' as const,
    title: 'Emergency Water Curtailment',
    description: 'The State Water Resources Control Board has declared a water emergency for the San Joaquin Valley. Groundwater levels have dropped to critical thresholds. All agricultural users face mandatory curtailment — the question is how severe.',
    preconditions: [
      { type: 'min_year', year: 10 },
      { type: 'max_year', year: 20 },
      { type: 'has_crop' },
      { type: 'season', season: 'summer' },
      { type: 'random', probability: 0.20 },
    ],
    priority: 65,
    cooldownDays: 1460,
    maxOccurrences: 1,
    foreshadowing: {
      signal: 'County water board is scheduling emergency meetings. Mandatory curtailment may be coming.',
      daysBeforeEvent: 10,
      reliability: 0.90,
    },
    choices: [
      {
        id: 'buy-emergency-water',
        label: 'Pay for Reduced Curtailment ($1,500)',
        description: 'Pay for priority allocation — restriction reduced to 15 days instead of 60.',
        cost: 1500,
        requiresCash: 1500,
        effects: [
          { type: 'modify_cash', amount: -1500 },
          { type: 'restrict_watering', durationDays: 15 },
          { type: 'add_notification', message: 'Priority allocation secured. Irrigation restricted for 15 days (instead of 60).', notificationType: 'event_result' },
        ],
      },
      {
        id: 'file-water-claim',
        label: 'File Insurance Claim ($200 deductible)',
        description: 'Insurance covers some of the financial impact of water curtailment.',
        cost: 200,
        requiresCash: 200,
        requiresFlag: 'has_crop_insurance',
        effects: [
          { type: 'modify_cash', amount: -200 },
          { type: 'restrict_watering', durationDays: 30 },
          { type: 'insurance_payout', amount: 1000 },
          { type: 'add_notification', message: 'Insurance claim filed. $1,000 payout minus $200 deductible = $800 net. Watering restricted 30 days (vs. 60 without insurance).', notificationType: 'event_result' },
        ],
        followUpText: 'The insurance payout arrives quickly — water emergencies are well-documented claims. The $800 net helps offset lost revenue during the 30-day restriction. Without insurance, you\'d face the full 60-day curtailment with no financial cushion.',
      },
      {
        id: 'accept-water-restriction',
        label: 'Accept Full Curtailment',
        description: 'Comply with the full mandatory restriction. No cost, but longest ban.',
        effects: [
          { type: 'restrict_watering', durationDays: 60 },
          { type: 'add_notification', message: 'Full water curtailment in effect. No irrigation for 60 days. Crops will suffer.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['regulatory', 'catastrophe', 'water'],
  },

  // --- False Alarm: Pest Scare ---

  {
    id: 'forum-pest-scare',
    type: 'community' as const,
    title: 'Growers Forum: "HUGE HORNWORMS EVERYWHERE"',
    description: 'PanicPete is at it again: "Just found tomato hornworms the size of my THUMB on my plants!!! They\'re destroying everything!!! Has anyone else seen these??? I think there\'s an INFESTATION spreading through the Valley!!!" Several farmers respond telling Pete to calm down — hornworms are normal and mostly affect home garden tomatoes, not commercial crops.',
    preconditions: [
      { type: 'min_year', year: 6 },
      { type: 'max_year', year: 12 },
      { type: 'has_flag', flag: 'met_forum' },
      { type: 'season_not', season: 'winter' },
      { type: 'random', probability: 0.25 },
    ],
    priority: 30,
    cooldownDays: 0,
    maxOccurrences: 1,
    advisorId: 'growers-forum',
    choices: [
      {
        id: 'reassure-pete',
        label: '"Pete, those are normal..."',
        description: 'Gently explain that hornworms aren\'t a Valley-wide crisis.',
        effects: [
          { type: 'add_notification', message: 'PanicPete thanked you but seemed unconvinced. The hornworm "epidemic" was just his backyard.', notificationType: 'event_result' },
        ],
      },
      {
        id: 'ignore-pete',
        label: 'Scroll Past',
        description: 'Pete\'s posts are always dramatic. Best to just keep scrolling.',
        effects: [
          { type: 'add_notification', message: 'You scrolled past PanicPete\'s latest emergency. Some things never change.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['community', 'forum', 'false-alarm'],
  },

  // --- False Alarm: Frost Panic ---

  {
    id: 'forum-frost-panic',
    type: 'community' as const,
    title: 'Growers Forum: "Woolly Caterpillars Say HARD FREEZE Coming"',
    description: 'OldTimer_Earl is back with his annual prediction: "Found a woolly bear caterpillar with an ALL BLACK coat this morning. My grandfather always said that means a brutal winter. Mark my words — we\'re in for the worst freeze in 30 years. I\'m covering everything I own." Several farmers point out that woolly caterpillar coloring has been scientifically debunked as a weather predictor. Earl is undeterred.',
    preconditions: [
      { type: 'min_year', year: 9 },
      { type: 'max_year', year: 18 },
      { type: 'has_flag', flag: 'met_forum' },
      { type: 'season', season: 'fall' },
      { type: 'random', probability: 0.25 },
    ],
    priority: 30,
    cooldownDays: 0,
    maxOccurrences: 1,
    advisorId: 'growers-forum',
    choices: [
      {
        id: 'trust-science',
        label: '"Earl, that\'s been debunked..."',
        description: 'Point Earl to the actual weather forecast.',
        effects: [
          { type: 'add_notification', message: 'Earl grumbled about "so-called experts" but the winter turned out perfectly normal.', notificationType: 'event_result' },
        ],
      },
      {
        id: 'let-earl-be-earl',
        label: 'Let Earl Be Earl',
        description: 'Some traditions die hard. No harm in letting him predict.',
        effects: [
          { type: 'add_notification', message: 'Earl\'s frost prediction was wrong again. The caterpillars remain unreliable meteorologists.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['community', 'forum', 'false-alarm'],
  },

  // ============================================================================
  // Slice 7b: "No Two Games Alike" — Forum Content + Santos Advisors
  // ============================================================================

  // --- New Forum Storylets (10) — filling the Y15-29 gap ---

  {
    id: 'forum-soil-health-thread',
    type: 'community',
    illustrationId: 'event-soil-exhaustion',
    title: 'Forum Post: "My Yields Are Shrinking"',
    description: "ValleyDirt_Dan posted in the Valley Growers Forum:\n\n\"OK so I need to vent. My corn used to come in at 95% of potential easy. Same fields, same seed, same water schedule — this year I'm barely hitting 70%. I finally got a soil test done and my organic matter is down to 1.2%. Extension agent looked at me like I'd confessed to a crime. Apparently I've been 'mining my soil' for a decade. Anyone else seeing this or is it just me?\"",
    preconditions: [
      { type: 'has_flag', flag: 'met_forum' },
      { type: 'min_year', year: 12 },
      { type: 'max_year', year: 18 },
      { type: 'avg_organic_matter_below', level: 1.5 },
      { type: 'random', probability: 0.40 },
    ],
    priority: 50,
    cooldownDays: 0,
    maxOccurrences: 1,
    advisorId: 'growers-forum',
    choices: [
      {
        id: 'learn-more-soil',
        label: 'What Changed?',
        description: 'Dan\'s numbers sound a lot like yours.',
        effects: [
          { type: 'add_notification', message: 'The Forum had a long discussion about declining soil organic matter and its effect on yields.', notificationType: 'event_result' },
        ],
        followUpText: "The thread took off. Turns out Dan isn't alone.\n\nOldTimerPete: \"Same story here. Used to get 2 tons/acre of tomatoes without trying. Now I fight for 1.5. My dad's soil was dark and crumbly — mine looks like parking lot fill.\"\n\nGreenThumb_Sara: \"It's not a mystery. Organic matter is what feeds the microbes that release nitrogen to your crops. When OM drops, you're essentially running out of your soil's savings account. You can buy fertilizer to patch over it, but you're treating the symptom.\"\n\nDrip_Queen_Linda: \"My extension agent says every 0.1% of OM you lose is like losing free nitrogen production. Below 1.5% and your soil basically stops feeding itself.\"\n\nValleyDirt_Dan: \"So what do I DO about it?\"\n\nGreenThumb_Sara: \"Cover crops. Every fall. It's slow — we're talking years, not seasons — but it's the only thing that actually rebuilds OM. You're putting organic material back into the soil instead of just taking it out.\"\n\nThe thread goes on, but the message is clear: soil organic matter isn't just a number on a test — it's the engine that drives everything else.",
      },
      {
        id: 'soil-fine',
        label: 'My Soil\'s Fine',
        description: 'You haven\'t noticed any problems.',
        effects: [
          { type: 'add_notification', message: 'Dan\'s soil concerns don\'t seem relevant to your operation.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['community', 'forum', 'soil', 'ecology'],
  },

  {
    id: 'forum-aquifer-discussion',
    type: 'community',
    illustrationId: 'event-aquifer',
    title: 'Forum Post: "The Wells Are Going Deeper"',
    description: "Drip_Queen_Linda posted in the Valley Growers Forum:\n\n\"Remember a few years back when I mentioned my brother-in-law hearing about water board meetings? Well. The monitoring wells they drilled near Tulare show the water table has dropped 60 feet since we were all arguing about it. Sixty. My neighbor just spent $40,000 deepening his well because the old one went dry. The state says SGMA enforcement is coming whether we like it or not. This isn't rumors anymore, folks.\"",
    preconditions: [
      { type: 'has_flag', flag: 'met_forum' },
      { type: 'min_year', year: 15 },
      { type: 'max_year', year: 22 },
      { type: 'random', probability: 0.35 },
    ],
    priority: 50,
    cooldownDays: 0,
    maxOccurrences: 1,
    advisorId: 'growers-forum',
    choices: [
      {
        id: 'aquifer-details',
        label: 'How Bad Is It?',
        description: 'Linda was right about the water board. What else does she know?',
        effects: [
          { type: 'add_notification', message: 'The Forum shared alarming data about San Joaquin Valley groundwater decline.', notificationType: 'event_result' },
        ],
        followUpText: "Linda came with receipts this time.\n\nDrip_Queen_Linda: \"I pulled the actual DWR data. The Central Valley has lost more than 30 million acre-feet of groundwater since the 1960s. That's not a drought blip — that's structural depletion.\"\n\nOldTimer_Reedley: \"My grandfather's well was 80 feet. My dad's was 150. Mine is 300. At some point you're not farming anymore — you're mining water.\"\n\nAlmondBaron_Ray: \"The Sustainable Groundwater Management Act gives local agencies until 2040 to bring basins into balance. 'Balance' means pumping no more than recharges naturally. For us that means... a lot less water than we're using.\"\n\nFreedomFarmer_Dave: \"So what happens to the farms that can't operate on less water?\"\n\nOldTimer_Reedley: \"What happened to the farms in Arizona and the Colorado River basin. They dry up.\"\n\nThe thread goes quiet after that.",
      },
      {
        id: 'heard-it-before',
        label: 'We\'ve Heard This Before',
        description: 'Water restriction talk is as old as the Valley.',
        effects: [
          { type: 'add_notification', message: 'You\'ve been hearing about water crises for years. The wells are still pumping.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['community', 'forum', 'water', 'ecology'],
  },

  {
    id: 'forum-biodiversity-observation',
    type: 'community',
    illustrationId: 'event-forum-gathering',
    title: 'Forum Post: "Something Weird About Pest Pressure"',
    description: "GreenThumb_Sara posted in the Valley Growers Forum:\n\n\"OK science nerds, I've been tracking pest counts on my fields for 3 years now. The plots where I rotate crops and keep cover crops over winter? Barely any aphid damage. The plots where I ran corn twice in a row? Crawling with them. My extension agent says the diverse plots have more predator insects — ladybugs, lacewings, parasitic wasps. The corn-only plots are basically an all-you-can-eat buffet with no bouncers. Is anyone else seeing this?\"",
    preconditions: [
      { type: 'has_flag', flag: 'met_forum' },
      { type: 'min_year', year: 10 },
      { type: 'max_year', year: 16 },
      { type: 'has_flag', flag: 'monoculture_penalty_shown' },
      { type: 'random', probability: 0.35 },
    ],
    priority: 50,
    cooldownDays: 0,
    maxOccurrences: 1,
    advisorId: 'growers-forum',
    choices: [
      {
        id: 'tell-me-more-bio',
        label: 'That\'s Interesting',
        description: 'Sara\'s observations match some patterns you\'ve noticed.',
        effects: [
          { type: 'add_notification', message: 'The Forum discussed how crop diversity supports natural pest control.', notificationType: 'event_result' },
        ],
        followUpText: "The thread turned into a genuinely useful discussion.\n\nValleyVet_Jake: \"I've seen the same thing. My vet school biology is rusty, but the concept is 'enemy of my enemy.' A monoculture gives one pest species unlimited food and nowhere for predators to live between meals. Diverse plantings support a food web — predator insects need pollen, nectar, and alternative prey to survive year-round.\"\n\nGreenThumb_Sara: \"The extension literature calls it 'ecological pest suppression.' Basically, biodiversity is free pest control.\"\n\nCornDawg_82: \"OK but I can't exactly plant flowers between my corn rows.\"\n\nGreenThumb_Sara: \"You don't have to. Just rotating crops and keeping cover crops over winter creates enough habitat diversity. The soil microbiome changes too — different crops support different soil fungi, and some of those fungi are actually toxic to pest larvae.\"\n\nOldTimerPete: \"Used to be every farm had hedgerows and field margins with native plants. Somewhere along the way we ripped them all out for efficiency. Maybe that wasn't so efficient after all.\"",
      },
      {
        id: 'sounds-anecdotal',
        label: 'Sounds Anecdotal',
        description: 'A few data points don\'t prove anything.',
        effects: [
          { type: 'add_notification', message: 'Sara\'s pest observations are interesting, but you\'d want more data before changing your approach.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['community', 'forum', 'ecology', 'biodiversity'],
  },

  {
    id: 'forum-cover-crop-success',
    type: 'community',
    illustrationId: 'event-cover-crops',
    title: 'Forum Post: "Year 3 of Cover Crops — Results Are Real"',
    description: "GreenThumb_Sara posted in the Valley Growers Forum:\n\n\"Update for anyone following my cover crop experiment. Year 3 results: my soil is darker, softer, holds water longer between irrigations. Extension agent confirmed my organic matter went from 1.8% to 2.1%. Not dramatic, but the direction is right. The big surprise? My spring nitrogen levels are higher than they've ever been and I didn't buy a single bag of fertilizer. The crimson clover is pulling nitrogen out of the air and putting it in my soil for free. I'm a convert.\"",
    preconditions: [
      { type: 'has_flag', flag: 'met_forum' },
      { type: 'min_year', year: 8 },
      { type: 'max_year', year: 14 },
      { type: 'random', probability: 0.30 },
    ],
    priority: 50,
    cooldownDays: 0,
    maxOccurrences: 1,
    advisorId: 'growers-forum',
    choices: [
      {
        id: 'how-does-it-work',
        label: 'How Does That Work?',
        description: 'Free nitrogen sounds too good to be true.',
        effects: [
          { type: 'add_notification', message: 'The Forum discussed nitrogen fixation and organic matter building through cover crops.', notificationType: 'event_result' },
        ],
        followUpText: "Sara clearly did her homework.\n\nGreenThumb_Sara: \"So legume cover crops — clover, vetch, field peas — have these root nodules full of bacteria called rhizobia. Those bacteria pull nitrogen gas straight out of the atmosphere and convert it into a form plants can use. When you incorporate the cover crop in spring, all that nitrogen gets released into the soil. It's literally free fertilizer, subsidized by evolution.\"\n\nValleyDirt_Dan: \"What about the organic matter side?\"\n\nGreenThumb_Sara: \"Every plant puts carbon into the soil through its roots. When the cover crop dies and decomposes, that carbon becomes organic matter. OM holds water, feeds soil microbes, and creates structure that roots can grow through. It's a slow process — you won't see dramatic jumps — but the trend line matters more than any single season.\"\n\nSorghumDave: \"The math is what got me. I was spending $300/year on synthetic nitrogen. Cover crop seed costs me $60. The nitrogen isn't quite as instant, but over 3 years my soil is healthier AND my input costs dropped.\"\n\nOldTimerPete: \"My grandfather called it 'green manure.' We thought we got smarter than that. Turns out the old-timers had it figured out.\"",
      },
      {
        id: 'noted-thanks',
        label: 'Noted, Thanks',
        description: 'Good information to file away.',
        effects: [
          { type: 'add_notification', message: 'Sara\'s cover crop results noted for future reference.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['community', 'forum', 'cover-crops', 'ecology'],
  },

  {
    id: 'forum-insurance-anxiety',
    type: 'community',
    illustrationId: 'event-forum-gathering',
    title: 'Forum Post: "My Insurance Premium Just Doubled"',
    description: "CropInsGuy_Mike posted in the Valley Growers Forum:\n\n\"Well folks, remember when I told everyone to get crop insurance? Still good advice. But I just got my renewal notice and I'm... not great. Premium doubled. The agent says the actuarial models got updated — apparently the Valley's risk profile has 'materially changed.' Translation: too many claims, too many extreme events. They're not dropping me yet, but a few guys I know in Kings County got non-renewed outright. The safety net is fraying.\"",
    preconditions: [
      { type: 'has_flag', flag: 'met_forum' },
      { type: 'min_year', year: 18 },
      { type: 'max_year', year: 25 },
      { type: 'has_flag', flag: 'has_crop_insurance' },
      { type: 'random', probability: 0.30 },
    ],
    priority: 50,
    cooldownDays: 0,
    maxOccurrences: 1,
    advisorId: 'growers-forum',
    choices: [
      {
        id: 'insurance-limits',
        label: 'What Are You Hearing?',
        description: 'If Mike is worried, you should be paying attention.',
        effects: [
          { type: 'add_notification', message: 'The Forum discussed rising insurance costs and the limits of crop insurance in a changing climate.', notificationType: 'event_result' },
        ],
        followUpText: "Mike's thread became the longest in Forum history.\n\nCropInsGuy_Mike: \"Here's what my agent told me off the record. Insurance companies build their models on historical data. When the actual loss frequency exceeds the model — like it has for the last 5 years — they have three choices: raise premiums, restrict coverage, or leave the market. We're seeing all three.\"\n\nFreedomFarmer_Dave: \"So when do they just pull out entirely?\"\n\nCropInsGuy_Mike: \"Some already have. Florida citrus insurers left after two bad hurricane seasons. The National Flood Insurance Program has been insolvent for years. Crop insurance works when bad years are occasional. When they become the norm... the math breaks.\"\n\nAlmondBaron_Ray: \"This is the part nobody talks about. We all plan like insurance will always be there. What's your plan B?\"\n\nOldTimer_Reedley: \"Cash reserves. Diversification. Not putting everything in one crop that one bad week can destroy. The stuff that's always been true, just harder to ignore now.\"",
      },
      {
        id: 'still-worth-it',
        label: 'Still Worth It',
        description: 'Even expensive insurance beats losing everything.',
        effects: [
          { type: 'add_notification', message: 'Insurance premiums are up, but you figure it\'s still the smart bet.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['community', 'forum', 'insurance', 'climate-risk'],
  },

  {
    id: 'forum-neighbor-bankruptcy',
    type: 'community',
    illustrationId: 'event-neighbor-bankruptcy',
    title: 'Forum Post: "Jerry Hendricks Sold His Farm"',
    description: "OldTimer_Reedley posted in the Valley Growers Forum:\n\n\"Sad news. Jerry Hendricks over on Route 99 finally sold. Thirty years of nothing but corn, no rotation, no cover crops. His soil was dead — I mean literally dead, wouldn't grow a weed if you paid it. When the water got tight and corn prices dropped, he had no margin left. Bank called in the note. Land went for half what it was worth because the buyer has to spend years rebuilding the soil before anything will grow right on it.\"",
    preconditions: [
      { type: 'has_flag', flag: 'met_forum' },
      { type: 'min_year', year: 15 },
      { type: 'max_year', year: 22 },
      { type: 'random', probability: 0.30 },
    ],
    priority: 50,
    cooldownDays: 0,
    maxOccurrences: 1,
    advisorId: 'growers-forum',
    choices: [
      {
        id: 'what-happened',
        label: 'What Went Wrong?',
        description: 'Thirty years is a long time to farm and end up with nothing.',
        effects: [
          { type: 'add_notification', message: 'The Forum reflected on Jerry Hendricks\' failure and what it means for soil-dependent farming.', notificationType: 'event_result' },
        ],
        followUpText: "The thread turned into a wake for a way of farming.\n\nOldTimer_Reedley: \"Jerry wasn't stupid. He was stubborn. Corn paid well for 20 years. He didn't see why he should fix what wasn't broken. But every year he was withdrawing from his soil and never depositing. By year 20 his organic matter was below 1%. Nitrogen wouldn't stick. Water ran right through. He was spending more on fertilizer than he was making on corn.\"\n\nValleyDirt_Dan: \"My extension agent calls it 'soil capital depletion.' You can farm on depleted soil — you just have to spend more and more to get less and less.\"\n\nGreenThumb_Sara: \"The worst part is recovery takes 5-10 years of active rebuilding. That's why the land sold at half price. The new buyer is looking at half a decade of cover crops and compost before they'll see real yields.\"\n\nCornDawg_82: \"...I might need to rethink some things.\"\n\nOldTimerPete: \"You think? We've been telling you for years, kid.\"\n\nThe thread settles into a long silence. Everyone's doing the same mental math about their own soil.",
      },
      {
        id: 'not-my-problem',
        label: 'Sad, But Not My Situation',
        description: 'Your operation is different from Jerry\'s.',
        effects: [
          { type: 'add_notification', message: 'Jerry Hendricks\' situation is unfortunate, but your farm is on a different path.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['community', 'forum', 'soil', 'monoculture', 'ecology'],
  },

  {
    id: 'forum-food-system',
    type: 'community',
    illustrationId: 'event-food-system',
    title: 'Forum Post: "Where Does Our Food Actually Go?"',
    description: "CitrusGal_Visalia posted in the Valley Growers Forum:\n\n\"My daughter is doing a school project on food systems and she asked me to explain where our oranges go after we sell them. I started drawing a map and honestly? I scared myself. Our valley produces about 25% of America's food and nuts on less than 1% of the country's land. We're feeding 80 million people from a strip of ground that depends on shrinking groundwater and a climate that's changing under our feet. When did farming become this high-stakes?\"",
    preconditions: [
      { type: 'has_flag', flag: 'met_forum' },
      { type: 'min_year', year: 20 },
      { type: 'max_year', year: 26 },
      { type: 'random', probability: 0.35 },
    ],
    priority: 50,
    cooldownDays: 0,
    maxOccurrences: 1,
    advisorId: 'growers-forum',
    choices: [
      {
        id: 'bigger-picture',
        label: 'Makes You Think',
        description: 'You\'ve been so focused on your fields you forgot the bigger picture.',
        effects: [
          { type: 'add_notification', message: 'The Forum reflected on the Central Valley\'s outsized role in the national food system.', notificationType: 'event_result' },
        ],
        followUpText: "The thread took on an unusually thoughtful tone.\n\nAlmondBaron_Ray: \"I did the math once. A single acre of almonds in our valley feeds about 1,400 people. A single acre of corn feeds about 250, mostly through livestock. The decisions we make on 40 or 400 acres ripple out to millions of dinner tables.\"\n\nOldTimerPete: \"When I started farming, the Central Valley was one of dozens of major agricultural regions in the country. Now we're one of about four that really matter. The others dried up, got paved over, or stopped being viable. We're still here, but for how long?\"\n\nCitrusGal_Visalia: \"My daughter's project conclusion was basically: 'The food system works until it doesn't, and when it doesn't, everyone finds out at the same time.' She's twelve and she gets it better than most adults.\"\n\nDrip_Queen_Linda: \"That's the thing about farming at this scale. Your 40 acres feel small. But multiply your decisions by every farmer in the Valley and suddenly you're talking about national food security. No pressure.\"\n\nThe conversation tapers off. Nobody quite has a solution. But the scale of what you're part of feels a little more real.",
      },
      {
        id: 'just-a-farmer',
        label: 'I\'m Just a Farmer',
        description: 'The big picture is above your pay grade.',
        effects: [
          { type: 'add_notification', message: 'Food system scale is interesting, but your job is keeping 40 acres alive.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['community', 'forum', 'food-system', 'ecology'],
  },

  {
    id: 'forum-climate-skeptic-response',
    type: 'community',
    illustrationId: 'event-climate-data',
    title: 'Forum Post: "I Was Wrong"',
    description: "FreedomFarmer_Dave posted in the Valley Growers Forum:\n\n\"Alright. I owe some of you an apology. Five years ago I was in here telling everyone that climate talk was overblown. Pete posted his temperature records and I said it was just cycles. Ray worried about markets and I said California quality would win out. I was wrong.\n\nI pulled up my own records last night. 20 years of planting dates, yields, water bills, and weather. It's all right there in my own handwriting. Summer highs up 6 degrees. Water costs tripled. My best corn yields are behind me by a decade.\n\nI don't know what to call it and I don't care about the politics. But something is different and pretending it isn't is costing me real money. So. Now what?\"",
    preconditions: [
      { type: 'has_flag', flag: 'met_forum' },
      { type: 'min_year', year: 22 },
      { type: 'max_year', year: 28 },
      { type: 'has_flag', flag: 'regime_heat_threshold' },
      { type: 'random', probability: 0.35 },
    ],
    priority: 50,
    cooldownDays: 0,
    maxOccurrences: 1,
    advisorId: 'growers-forum',
    choices: [
      {
        id: 'respect-honesty',
        label: 'Respect for Saying That',
        description: 'Changing your mind based on evidence takes guts.',
        effects: [
          { type: 'add_notification', message: 'Dave\'s post sparked a rare moment of honesty on the Forum about long-term climate trends.', notificationType: 'event_result' },
        ],
        followUpText: "For once, nobody argued with Dave.\n\nOldTimerPete: \"Takes a big man to say that, Dave. For what it's worth, I wasn't trying to scare anyone with my weather logs. I just wanted people to look at the data instead of the talking heads.\"\n\nGreenThumb_Sara: \"The thing about data is it doesn't care what you believe. Your yields are your yields. Your water bills are your water bills. At some point the numbers stop being debatable.\"\n\nCitrusGal_Visalia: \"Dave, the 'now what' is: you adapt. That's what we've all been doing, even the ones who didn't call it that. Different crops, better water management, cover crops. It's not about predicting the future — it's about building a farm that can handle whatever comes.\"\n\nFreedomFarmer_Dave: \"Yeah. I'm starting to figure that out. Little late, but I guess late beats never.\"\n\nAlmondBaron_Ray: \"Dave, you've still got years of farming ahead of you. That's enough time to make real changes if you start now.\"\n\nThe thread ended with something the Forum rarely has: consensus.",
      },
      {
        id: 'about-time',
        label: 'About Time, Dave',
        description: 'He could\'ve figured this out years ago.',
        effects: [
          { type: 'add_notification', message: 'Better late than never, Dave.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['community', 'forum', 'climate', 'ecology'],
  },

  {
    id: 'forum-regenerative-buzz',
    type: 'community',
    illustrationId: 'event-cover-crops',
    title: 'Forum Post: "Anyone Heard of Regenerative Agriculture?"',
    description: "ValleyDirt_Dan posted in the Valley Growers Forum:\n\n\"Watched a documentary last night about these farms in the Midwest that basically rebuilt dead soil in 10 years. They call it 'regenerative agriculture.' Cover crops, diverse rotations, minimizing soil disturbance, integrating livestock. Their organic matter went from 1% to 4%. Four percent! The soil was so healthy they stopped buying fertilizer entirely. I know a documentary isn't peer-reviewed science, but these guys are producing real yields on soil that was written off. Is this real or am I getting sold something?\"",
    preconditions: [
      { type: 'has_flag', flag: 'met_forum' },
      { type: 'min_year', year: 15 },
      { type: 'max_year', year: 22 },
      { type: 'random', probability: 0.30 },
    ],
    priority: 50,
    cooldownDays: 0,
    maxOccurrences: 1,
    advisorId: 'growers-forum',
    choices: [
      {
        id: 'whats-regenerative',
        label: 'Tell Me More',
        description: 'Rebuilding dead soil sounds almost too good to be true.',
        effects: [
          { type: 'add_notification', message: 'The Forum debated whether regenerative agriculture practices could work in the San Joaquin Valley.', notificationType: 'event_result' },
        ],
        followUpText: "The Forum had opinions.\n\nGreenThumb_Sara: \"It's real, Dan. The science checks out — there are peer-reviewed studies from USDA-ARS and land-grant universities showing 0.1-0.3% OM gains per year with full regenerative systems. The documentary exaggerates the speed a bit, but the direction is right.\"\n\nOldTimerPete: \"My problem with the 'regenerative' crowd is they act like they invented something new. Cover crops, rotation, composting — my grandfather did all of this. We just gave it a marketing name.\"\n\nGreenThumb_Sara: \"Fair. But Pete, your grandfather also had more rain and cheaper water. The difference now is we need these practices to survive, not just to feel virtuous.\"\n\nAlmondBaron_Ray: \"Can it work at our scale though? Those Midwest guys are on flat land with rain. We're irrigating in a semi-arid valley with expensive water.\"\n\nSorghumDave: \"The principles translate. Cover crops work here. Rotation works here. We just can't copy the Midwest playbook exactly — we need a Valley version.\"\n\nValleyDirt_Dan: \"So it's not magic. It's just... doing the basics consistently.\"\n\nGreenThumb_Sara: \"Basically, yes. Boring, consistent soil building. The exciting part is what happens after year 5.\"",
      },
      {
        id: 'sounds-trendy',
        label: 'Sounds Trendy',
        description: 'Another farming fad with a good marketing budget.',
        effects: [
          { type: 'add_notification', message: 'Regenerative agriculture sounds interesting but you\'re skeptical of the hype.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['community', 'forum', 'soil', 'cover-crops', 'ecology'],
  },

  {
    id: 'forum-late-game-reflection',
    type: 'community',
    illustrationId: 'event-forum-gathering',
    title: 'Forum Post: "To My Grandson"',
    description: "OldTimerPete posted in the Valley Growers Forum:\n\n\"My grandson told me he wants to farm. I sat with that for a week before I answered him.\n\nThirty years ago we had more water, cooler summers, cheaper fuel, and soil that still had life in it. We thought those things were permanent. They weren't. The valley will still feed people. I believe that. But it won't be the same valley, and the farmers who survive the next thirty years won't farm the way we did.\n\nI told him: listen to the soil. Watch the water. Diversify before you have to. And don't plant what your grandfather planted just because your grandfather planted it.\n\nHe asked if farming would still be worth it. I told him the truth: I don't know. But there's no better way to learn what matters.\"",
    preconditions: [
      { type: 'has_flag', flag: 'met_forum' },
      { type: 'min_year', year: 26 },
      { type: 'max_year', year: 29 },
      { type: 'random', probability: 0.40 },
    ],
    priority: 50,
    cooldownDays: 0,
    maxOccurrences: 1,
    advisorId: 'growers-forum',
    choices: [
      {
        id: 'well-said-pete',
        label: 'Well Said, Pete',
        description: 'Pete earned the right to say that.',
        effects: [
          { type: 'add_notification', message: 'Pete\'s reflection resonated across the Forum.', notificationType: 'event_result' },
        ],
        followUpText: "The thread filled up slowly. No arguments this time.\n\nGreenThumb_Sara: \"Pete, this is the best thing you've ever posted. I'm printing it out for my office.\"\n\nDrip_Queen_Linda: \"My daughter wants to farm too. Same conversation, same fears. I told her the skills that matter aren't the ones you think — it's not about knowing which seed to buy. It's about watching, adapting, being willing to change your plan when the land tells you to.\"\n\nValleyDirt_Dan: \"I look back at my early years and cringe. All the soil I burned through, all the 'it'll be fine' decisions. If I could go back, I'd start with cover crops from year one.\"\n\nFreedomFarmer_Dave: \"I'd buy insurance earlier and argue about it less.\"\n\nCornDawg_82: \"I'd... rotate my crops.\" [17 laugh reacts]\n\nOldTimerPete: \"Point is, we all learned. Most of the important things I know about farming, I learned by getting something wrong first. That's the job. Good luck to all of you, and tell your kids the valley is worth fighting for.\"\n\nThe thread stays pinned at the top of the Forum for the rest of the season.",
      },
      {
        id: 'getting-sentimental',
        label: 'Getting Sentimental, Pete?',
        description: 'It\'s not like him to get philosophical.',
        effects: [
          { type: 'add_notification', message: 'Pete\'s post was surprisingly moving. Getting old does that to people.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['community', 'forum', 'reflection', 'ecology'],
  },

  // --- New Santos Advisor Storylets (2) ---

  {
    id: 'advisor-soil-trajectory',
    type: 'advisor',
    illustrationId: 'event-soil-exhaustion',
    title: 'Santos: Soil Health Declining',
    description: 'Dr. Santos stops by with a clipboard and a concerned expression. "I\'ve been tracking your soil test data, and I need to be direct. Your organic matter is declining — significantly. At current levels, your soil is losing its ability to hold water, cycle nutrients, and support healthy root systems. Think of organic matter as your soil\'s savings account. Right now, you\'re spending it faster than you\'re replenishing it. We can address the immediate nitrogen deficit with a fertilizer application, but long-term recovery requires putting organic material back into the ground. Cover crops are your best tool for that."',
    preconditions: [
      { type: 'min_year', year: 10 },
      { type: 'avg_organic_matter_below', level: 1.5 },
    ],
    priority: 85,
    cooldownDays: 0,
    maxOccurrences: 1,
    advisorId: 'extension-agent',
    choices: [
      {
        id: 'buy-fertilizer-emergency',
        label: 'Emergency Nitrogen Boost ($600)',
        description: 'A short-term fertility fix — not a soil solution.',
        cost: 600,
        requiresCash: 600,
        effects: [
          { type: 'modify_cash', amount: -600 },
          { type: 'modify_nitrogen_all', amount: 30 },
          { type: 'add_notification', message: 'Emergency nitrogen applied across your fields. Fertility boosted short-term, but the underlying organic matter decline continues.', notificationType: 'event_result' },
        ],
        followUpText: 'Santos nods as the fertilizer is applied. "This will help your crops right now — the nitrogen boost should be noticeable within a few weeks. But I want to be clear: this is treating the symptom, not the disease. Your soil organic matter is what produces nitrogen naturally through microbial activity. Every tenth of a percent you lose reduces your soil\'s ability to feed your crops on its own. Eventually, you\'d be buying all your nitrogen instead of growing it.\n\nThe way out is cover crops. Plant them every fall — legumes like crimson clover fix atmospheric nitrogen into your soil for free, and all cover crops add organic matter when they decompose in spring. It\'s slow — we\'re talking years, not weeks — but it\'s the only way to rebuild what your soil has lost. The fertilizer buys you time. Cover crops buy you a future."',
      },
      {
        id: 'noted-trajectory',
        label: 'I\'ll Keep an Eye on It',
        description: 'You\'ll monitor the situation.',
        effects: [
          { type: 'add_notification', message: 'Santos urges you to consider cover crops for long-term soil health.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['advisor', 'soil', 'ecology'],
  },

  {
    id: 'advisor-cover-crop-education',
    type: 'advisor',
    illustrationId: 'event-cover-crops',
    title: 'Santos: The Case for Cover Crops',
    description: 'Dr. Santos catches you between seasons. "Do you have a minute? I wanted to talk to you about cover crops. I know they\'re not a revenue crop — nobody\'s getting rich selling crimson clover. But they do something your cash crops can\'t: they build soil. When you plant a legume cover crop in the fall, bacteria in its root nodules take nitrogen gas out of the atmosphere and convert it into a form your soil can use. When the plant decomposes in spring, that nitrogen transfers to your next crop. It\'s essentially free fertilizer from thin air. And all cover crops — legumes or not — add organic matter to the soil as they break down. Better water retention, better nutrient cycling, healthier root zones. I really think it\'s worth your time."',
    preconditions: [
      { type: 'min_year', year: 5 },
      { type: 'not_has_flag', flag: 'santos_cover_crop_explained' },
    ],
    priority: 80,
    cooldownDays: 0,
    maxOccurrences: 1,
    advisorId: 'extension-agent',
    choices: [
      {
        id: 'explain-more-cover',
        label: 'How Does Nitrogen Fixation Work?',
        description: 'The free fertilizer claim is interesting.',
        effects: [
          { type: 'set_flag', flag: 'santos_cover_crop_explained', value: true },
          { type: 'add_notification', message: 'Santos explained how cover crops build soil fertility through nitrogen fixation and organic matter addition.', notificationType: 'event_result' },
        ],
        followUpText: "Santos pulls out a diagram he clearly prepared in advance.\n\n\"OK, here's the biology. Legume roots form a partnership with Rhizobium bacteria — you can actually see the nodules if you dig up a clover plant. Those bacteria contain an enzyme called nitrogenase that breaks the triple bond in atmospheric nitrogen gas. That's a bond so strong it takes an industrial fertilizer plant temperatures of 400\u00B0C and extreme pressure to break it. These bacteria do it at soil temperature, powered by sugar from the plant's photosynthesis.\n\nThe plant gets nitrogen, the bacteria get carbon. When you incorporate the cover crop in spring, all that fixed nitrogen becomes available to your next cash crop as the plant material decomposes.\n\nBut nitrogen fixation is only half the story. All plants — legumes and grasses alike — pump carbon into the soil through their roots. About 30% of a plant's photosynthetic output goes directly underground. When cover crops die and decompose, that carbon becomes soil organic matter. More OM means better water holding capacity, better nutrient cycling, and a more active soil food web.\n\nIt's not flashy and it's not fast. But it's the foundation everything else depends on.\"",
      },
      {
        id: 'maybe-later-cover',
        label: 'Maybe Next Season',
        description: 'You have more pressing concerns right now.',
        effects: [
          { type: 'add_notification', message: 'Santos will bring up cover crops again when the time is right.', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['advisor', 'cover-crops', 'ecology'],
  },

  // --- Slice 7c: Soil Degradation Events ---

  {
    id: 'soil-decline-warning',
    type: 'advisor',
    illustrationId: 'event-soil-exhaustion',
    title: 'Santos: Urgent Soil Health Intervention',
    description: "Dr. Santos arrives unannounced, which she never does. She sets a folder of lab results on your tailgate and lets you look before she speaks.\n\n\"Your organic matter is at levels I haven't seen outside of construction sites. We're below 1.3% across your fields — that's not 'low,' that's structural failure in slow motion. Your soil is losing its ability to hold water, cycle nutrients, and support root systems. Every season you farm on degraded soil, the next season gets harder.\"\n\nShe pulls out two options she's already costed.\n\n\"Option one: I can get you an advanced cover crop seed mix — multi-species blend with deep-rooted legumes, brassicas, and grasses. It's not the basic clover you've been using. This mix builds organic matter faster and fixes more nitrogen. Same planting window, same button — just a better toolkit. Eight hundred dollars.\n\nOption two: emergency compost application. Fifteen hundred, and it gives you an immediate boost to both organic matter and nitrogen. But it's a one-time fix — like getting a blood transfusion when what you need is to stop the bleeding.\n\nOr you can keep doing what you're doing and watch the numbers drop.\"",
    preconditions: [
      { type: 'min_year', year: 12 }, // 2-year gap after advisor-soil-trajectory (Y10+) to avoid double-warning feel
      { type: 'avg_organic_matter_below', level: 1.3 },
      { type: 'avg_organic_matter_above', level: 1.0 }, // Band guard: skip warning if OM already in crisis range
    ],
    priority: 95,
    cooldownDays: 0,
    maxOccurrences: 1,
    advisorId: 'extension-agent',
    foreshadowing: {
      signal: 'Dr. Santos has requested your latest soil test results. She mentioned wanting to "discuss the trajectory" — which, from Santos, is never casual.',
      daysBeforeEvent: 60,
      reliability: 1.0,
      advisorSource: 'extension-agent',
    },
    choices: [
      {
        id: 'invest-cover-upgrade',
        label: 'Advanced Cover Crop Mix ($800)',
        description: 'Multi-species blend that builds organic matter 50% faster than basic clover. Same planting process — better results.',
        cost: 800,
        requiresCash: 800,
        effects: [
          { type: 'modify_cash', amount: -800 },
          { type: 'set_flag', flag: 'tech_advanced_cover_crops', value: true },
          { type: 'modify_nitrogen_all', amount: 30 },
          { type: 'add_notification', message: 'Advanced cover crop mix purchased. Your cover crops will now build organic matter 50% faster. Santos: "This is the single best investment you can make in your soil right now."', notificationType: 'event_result' },
        ],
        followUpText: "Santos watches you sign the purchase order with visible relief.\n\n\"OK. Here's what you're getting. This isn't just clover — it's a multi-species blend designed for California valley soils. Crimson clover and hairy vetch for nitrogen fixation, tillage radish for breaking compaction layers, and cereal rye for carbon biomass. The roots on the radish go down eighteen inches — that's mechanical soil improvement that no amount of compost can replicate.\n\nThe key difference from your basic legume mix is the carbon-to-nitrogen ratio of the decomposing biomass. More grass species means more lignin, which breaks down slower and contributes more stable organic matter. You'll see about 50% more OM gain per incorporation cycle.\n\nPlant it the same way — fall season, same button. But the results compound. Each year, the soil gets a little better at holding water, cycling nutrients, supporting biology. After three or four seasons, you should see your organic matter trending upward instead of down.\n\nThe nitrogen boost I applied today buys you a bridge to get there. Cover crops are the destination.\"",
      },
      {
        id: 'emergency-compost',
        label: 'Emergency Compost Application ($1,500)',
        description: 'Immediate organic matter and nitrogen boost across all fields. One-time fix.',
        cost: 1500,
        requiresCash: 1500,
        effects: [
          { type: 'modify_cash', amount: -1500 },
          { type: 'modify_organic_matter_all', amount: 0.15 },
          { type: 'modify_nitrogen_all', amount: 40 },
          { type: 'add_notification', message: 'Emergency compost applied. Organic matter boosted +0.15% and nitrogen +40 lbs/ac across all fields. Santos: "This helps now, but you need a long-term soil building strategy."', notificationType: 'event_result' },
        ],
        followUpText: "The compost trucks arrive the next morning — Santos had them on standby, which tells you how worried she was.\n\n\"This is good material,\" she says, watching the spreaders work. \"Dairy manure compost, fully cured. You'll see an immediate bump in both organic matter and nitrogen availability. Your crops will respond within weeks.\"\n\nShe hesitates, then says what she clearly came to say.\n\n\"But I have to be honest with you. This is a band-aid on a structural problem. Fifteen hundred dollars buys you a 0.15% OM increase — and at current decomposition rates, you'll burn through that in about two years. The math doesn't close unless you're also putting carbon back into the soil every season through cover crops.\n\nCompost gives you a floor. Cover crops give you a trajectory. Without both, you're running on a treadmill — spending money to stay in the same place while the soil underneath you gets a little worse every year.\"",
      },
      {
        id: 'manage-soil-decline',
        label: "I'll Manage",
        description: "You'll monitor the situation and adjust as needed.",
        effects: [
          { type: 'add_notification', message: "Santos nods slowly. \"It's your land. But the soil doesn't negotiate — it just gets thinner. I'll be here when you're ready.\"", notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['advisor', 'soil', 'ecology', 'tech-unlock'],
  },

  {
    id: 'soil-exhaustion-crisis',
    type: 'climate',
    illustrationId: 'event-soil-exhaustion',
    title: 'Soil Structure Failure',
    description: "You notice it first in the irrigation rows. Water pools on the surface instead of soaking in — sitting in muddy puddles that take hours to drain. Then you see the cracks. Not the normal summer drying cracks, but deep fissures that run between the crop rows like the land itself is pulling apart.\n\nWhen you dig a test hole, the soil comes up in hard, pale chunks instead of the dark crumbly aggregates you remember from your early years. There are no earthworms. The root zone smells flat — none of the rich, earthy smell of healthy soil biology.\n\nDr. Santos confirms what you already know. \"Your organic matter is below 1%. The soil has lost its structure — the aggregates that hold water and air have broken down. Without intervention, every crop you plant will yield 40% less until the soil rebuilds. That could take years.\"\n\nThe question is whether to pay for intensive remediation now or accept reduced production while the land slowly recovers.",
    preconditions: [
      { type: 'min_year', year: 15 },
      { type: 'avg_organic_matter_below', level: 1.0 },
    ],
    priority: 100,
    cooldownDays: 0,
    maxOccurrences: 1,
    foreshadowing: {
      signal: 'Your fields are showing signs of soil compaction — water is pooling in irrigation rows instead of soaking in. The soil surface looks pale and crusty.',
      daysBeforeEvent: 30,
      reliability: 1.0,
    },
    choices: [
      {
        id: 'intensive-remediation',
        label: 'Intensive Remediation ($2,500)',
        description: 'Emergency soil rebuilding: deep compost injection, gypsum application, and biological inoculant. Yields still reduced 40% but recovery takes 90 days instead of 180.',
        cost: 2500,
        requiresCash: 2500,
        effects: [
          { type: 'modify_cash', amount: -2500 },
          { type: 'modify_yield_modifier', cropId: '*', multiplier: 0.60, durationDays: 90 },
          { type: 'modify_organic_matter_all', amount: 0.20 },
          { type: 'add_notification', message: 'Intensive soil remediation underway. All crop yields reduced by 40% for 90 days while soil recovers. Organic matter boosted +0.20%.', notificationType: 'event_result' },
        ],
        followUpText: "The remediation crew works for three days straight. Deep injection rigs pump composted material directly into the root zone — not surface-applied like normal compost, but forced into the compacted layers where the soil structure has collapsed.\n\nSantos supervises the biological inoculant application. \"We're reintroducing mycorrhizal fungi, beneficial bacteria, and nematodes. Think of it as a soil transplant — we're not just adding nutrients, we're rebuilding the living community that makes soil work.\"\n\nThe gypsum breaks up the hardpan. The compost feeds the biology. The inoculant jumpstarts the microbial community. But none of it is instant.\n\n\"Ninety days,\" Santos says. \"That's how long before you'll see the soil start responding. Your yields will be down 40% during that window — the roots can't access nutrients efficiently in degraded soil. After that, the biology starts working and things improve. But this is a reset, not a cure. If you don't maintain organic matter inputs going forward — cover crops, every season — you'll be back here in five years.\"\n\nShe's right, and you both know it. The $2,500 bought you time. What you do with it is up to you.",
      },
      {
        id: 'accept-soil-exhaustion',
        label: 'Accept Reduced Production',
        description: 'No remediation investment. All crop yields reduced by 40% for 180 days as soil slowly rebuilds on its own.',
        effects: [
          { type: 'modify_yield_modifier', cropId: '*', multiplier: 0.60, durationDays: 180 },
          { type: 'add_notification', message: 'Soil structure failure. All crop yields reduced by 40% for 180 days. Cover crops are your best path to recovery.', notificationType: 'event_result' },
        ],
        followUpText: "Santos doesn't argue. She's seen enough farms make this choice — and enough that didn't have the choice at all.\n\n\"The soil will rebuild on its own. It always does — that's what soil does, given time and organic inputs. But 'on its own' means 180 days of reduced yields. Every crop you harvest during that window will produce about 60% of what healthy soil would give you.\"\n\nShe pauses at the gate.\n\n\"Cover crops. Every fall, without exception. That's the single thing you can do that costs the least and helps the most. Each incorporation cycle adds organic matter, and organic matter is what rebuilds soil structure. It's slow — but it's the only path that doesn't cost $2,500 every time you hit this wall.\"\n\nThe 180 days will be lean. But the soil doesn't care about your timeline — it heals at its own pace.",
      },
    ],
    tags: ['climate', 'soil', 'ecology', 'catastrophe'],
  },

  // --- Slice 7c: Insurance Regime Exit ---

  {
    id: 'regime-insurance-exit',
    type: 'market',
    title: 'Crop Insurance Market Exit',
    description: "The letter arrives on a Tuesday — form letter, corporate letterhead, no personal touches.\n\n\"Dear Policyholder: Due to escalating systemic risk in the Central Valley agricultural corridor, Valley Agricultural Insurance Group has made the difficult decision to exit the crop insurance market for this region effective immediately. Your current policy will not be renewed.\"\n\nMarcus Chen calls before you finish reading it. \"I heard. Three other insurers pulled out of the Valley this month — it's an industry-wide retreat. The actuarial models can't price the risk anymore. Between water curtailments, heat events, disease pressure, and pollination failures, the loss ratios are unsustainable.\"\n\nHe's already found an alternative. \"There's a farmer cooperative mutual aid network operating in the region. It's not insurance — the payouts are smaller and it's member-funded — but it's something. The buy-in is $800. Or you can self-insure and rely on your cash reserves.\"\n\nThe Forum is buzzing. This affects everyone.",
    preconditions: [
      { type: 'min_year', year: 22 },
      { type: 'max_year', year: 27 },
      { type: 'has_flag', flag: 'has_crop_insurance' },
      { type: 'not_has_flag', flag: 'regime_insurance_exit' },
    ],
    priority: 100,
    cooldownDays: 0,
    maxOccurrences: 1,
    foreshadowing: {
      signal: 'News reports indicate agricultural insurers are reassessing their Central Valley risk models. Several smaller carriers have already withdrawn from neighboring counties.',
      daysBeforeEvent: 90,
      reliability: 1.0,
    },
    choices: [
      {
        id: 'join-mutual-aid',
        label: 'Join Cooperative Mutual Aid ($800)',
        description: 'Member-funded safety net. Smaller payouts than commercial insurance, but better than nothing.',
        cost: 800,
        requiresCash: 800,
        effects: [
          { type: 'modify_cash', amount: -800 },
          { type: 'set_flag', flag: 'mutual_aid', value: true },
          { type: 'set_flag', flag: 'has_crop_insurance', value: false },
          { type: 'set_flag', flag: 'regime_insurance_exit', value: true },
          { type: 'add_notification', message: 'Joined the Valley Farmers Cooperative Mutual Aid network. Insurance premiums stop. Mutual aid provides reduced coverage on future catastrophes.', notificationType: 'event_result' },
        ],
        followUpText: "The cooperative coordinator — a retired almond grower named Margaret — walks you through the model.\n\n\"This isn't insurance. Let me be clear about that up front. There's no actuarial table, no adjusters, no corporate claims department. What we have is 47 farms pooling resources. When one of us gets hit, the rest chip in. The payouts are smaller than what Valley Ag was offering — roughly half — but they're real and they're fast.\n\nThe $800 buy-in goes into the shared fund. No annual premiums after that — the fund replenishes from member contributions after each payout event. If the fund runs low, we do a voluntary call for additional contributions.\n\nThe real value isn't the money, honestly. It's the network. When rootworm hits your neighbor, you hear about it the same day — not two weeks later from an extension bulletin. When disease shows up in someone's orchard, we've got people with chainsaws and experience on-site within 48 hours.\n\nIt's not perfect. But it's ours.\"",
      },
      {
        id: 'go-without-coverage',
        label: 'Go Without Coverage',
        description: 'Rely on your cash reserves. No coverage, but no ongoing costs either.',
        effects: [
          { type: 'set_flag', flag: 'has_crop_insurance', value: false },
          { type: 'set_flag', flag: 'regime_insurance_exit', value: true },
          { type: 'add_notification', message: 'No replacement coverage. Insurance premiums stop, but you\'re on your own for any future catastrophes. Chen: "I hope your cash reserves are deep enough."', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['regime-shift', 'market', 'insurance'],
  },

  // --- Slice 7c: Positive Reinforcement ---

  {
    id: 'advisor-soil-recovery-praise',
    type: 'advisor',
    illustrationId: 'event-cover-crops',
    title: 'Santos: Your Soil Is Recovering',
    description: "Dr. Santos is smiling when she arrives, which catches you off guard — you've mostly seen her concerned expression over the past few years.\n\n\"I just got your latest soil test results back. Sit down — this is the good news kind of sit down.\"\n\nShe spreads the data on your tailgate, next to where she delivered the bad news last time.\n\n\"Your organic matter is above 2.2% and climbing. That advanced cover crop mix is doing exactly what we hoped — the multi-species root systems are building soil aggregates, the decomposing biomass is feeding the microbial community, and the whole system is starting to work again. Water infiltration is up. Nitrogen mineralization is up. Your soil is becoming self-sustaining again.\"\n\nShe taps the trend line on the chart.\n\n\"This is what regeneration looks like. Not a magic bullet — years of consistent cover cropping, compounding season after season. You stuck with it when a lot of farmers wouldn't have. The hard part is done.\"",
    preconditions: [
      { type: 'min_year', year: 12 },
      { type: 'avg_organic_matter_above', level: 2.2 },
      { type: 'has_flag', flag: 'tech_advanced_cover_crops' },
    ],
    priority: 75,
    cooldownDays: 0,
    maxOccurrences: 1,
    advisorId: 'extension-agent',
    choices: [
      {
        id: 'acknowledge-recovery',
        label: 'Thanks, Santos',
        description: "It's been a long road.",
        effects: [
          { type: 'set_flag', flag: 'santos_praised_soil_recovery', value: true },
          { type: 'add_notification', message: 'Santos confirmed your soil health is recovering. Organic matter above 2.2% and trending upward.', notificationType: 'event_result' },
        ],
        followUpText: "Santos leans against the truck, looking out over your fields with an expression you haven't seen from her before — something close to pride.\n\n\"You know what most of my farmers ask me? 'How do I fix my soil fast?' And I always have to tell them the same thing — you can't. You can't rush biology. You can spend money on compost and fertilizer and amendments, and those help, but the real fix is time plus consistent inputs.\n\nWhat you did — investing in the advanced mix, planting cover crops every single fall, incorporating them every spring — that's the only path that actually works. And it took years. Most people give up after two seasons because they can't see the change on the surface.\n\nBut look at this data. Your water holding capacity is up 15%. Your nitrogen mineralization rate has doubled since the low point. You're spending less on irrigation because the soil holds moisture longer. Less on fertilizer because the biology is cycling nutrients for you.\n\nYou didn't just fix your soil. You built a system that sustains itself. That's the difference between treating symptoms and solving the problem.\"\n\nShe folds up the charts and heads back to her truck.\n\n\"Keep planting those cover crops. The soil will keep rewarding you for it.\"",
      },
      {
        id: 'dismiss-praise',
        label: 'Just Doing My Job',
        description: 'Farming is farming.',
        effects: [
          { type: 'add_notification', message: 'Santos smiles. "That\'s exactly what a good farmer says."', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['advisor', 'soil', 'ecology', 'positive'],
  },

  // --- 8c Events: Labor/Automation Narrative ---

  {
    id: 'forum-labor-shortage',
    type: 'community',
    illustrationId: 'event-labor-shortage',
    advisorId: 'growers-forum',
    title: 'Harvest Hands Getting Scarce',
    description: "The Forum's summer thread is running hot this year.\n\n\"Can anyone find harvest crews? I have 50 acres of almonds coming in and my contractor just called — he's 30 workers short. Heat pushed everyone's harvest into the same three-week window and he's getting outbid on labor rates.\" — DeltaOrchards\n\n\"Same here with pistachios. I've been scrambling all week. Starting to wonder if the old model is sustainable.\" — ValleyOrchards_Fresno\n\n\"H-2A guest worker program. Expensive and paperwork-heavy, but at least your crew shows up. Moved to it three years ago.\" — Ruiz_Orchards\n\nThe thread goes on. You close the browser and look out at your fields.",
    preconditions: [
      { type: 'min_year', year: 9 },
      { type: 'max_year', year: 16 },
      { type: 'total_planted_gte', cellCount: 30 },
      { type: 'has_any_crop_in', cropIds: ['almonds', 'citrus-navels', 'pistachios', 'heat-avocado'] },
      { type: 'season', season: 'summer' },
    ],
    priority: 90,
    cooldownDays: 730,
    maxOccurrences: 1,
    choices: [
      {
        id: 'labor-learn-more',
        label: 'What are others doing about it?',
        description: 'Dig into what options exist — H-2A, mechanization, and what other growers are actually doing.',
        effects: [
          { type: 'set_flag', flag: 'labor_pressure_aware', value: true },
          { type: 'add_notification', message: 'You dug into the labor shortage problem. The pressure is real — and growing.', notificationType: 'event_result' },
        ],
        followUpText: "The picture that emerges from your reading isn't reassuring.\n\nCalifornia has lost a significant share of its agricultural workforce over the past decade — aging farmworker populations, competing opportunities in other sectors, and regulatory changes affecting seasonal labor supply. The crops hit hardest are orchard and tree fruit operations: hand-sorted citrus, tree-shaken almonds and pistachios, avocados that require selective hand-picking at different maturities. These crops command premium prices partly because they require skilled, careful human labor — and that's exactly the labor pool that's shrinking.\n\nThe H-2A temporary worker program lets farms sponsor foreign workers on agricultural visas. The paperwork burden is real — housing requirements, minimum wage floors, transportation obligations — but it provides predictable crew supply. Operations that use it report the upfront investment pays back within one to two seasons.\n\nMechanization is advancing, but more slowly for tree fruits than for field crops. Mechanical almond shakers are standard at large operations; the bottleneck is sorting and hulling capacity. Citrus and avocado mechanization is still emerging — fruit quality is sensitive to mechanical handling, and premium markets often require hand grades.\n\nNone of this is quick. The growers who aren't worried right now are the ones who started adapting several years ago.",
      },
      {
        id: 'labor-get-by',
        label: "We'll get by this year",
        description: "It's been tight before. You'll manage.",
        effects: [
          { type: 'add_notification', message: "You put the labor thread out of your mind. The harvest comes together — barely.", notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['community', 'labor', 'automation'],
  },

  {
    id: 'advisor-automation-question',
    type: 'advisor',
    advisorId: 'extension-agent',
    title: 'Santos: The Automation Question',
    description: "Dr. Santos called ahead this time — unusual for her. 'I've been following the labor discussions you've been reading,' she said. 'I want to talk through some of what I'm seeing across the Valley, if you have an hour.'\n\nShe arrives the next morning and walks your fields before she says anything. She doesn't pull out her tablet right away, just looks at your operation.\n\n'Farms like yours — large enough that labor costs are real, growing crops that still depend on skilled hands at harvest — that's where the pressure is building fastest.' She turns to face you. 'I want to make sure you're thinking about what comes next, not just this year.'",
    preconditions: [
      { type: 'min_year', year: 10 },
      { type: 'max_year', year: 16 },
      { type: 'has_flag', flag: 'labor_pressure_aware' },
      { type: 'total_planted_gte', cellCount: 30 },
      { type: 'has_any_crop_in', cropIds: ['almonds', 'citrus-navels', 'pistachios', 'heat-avocado'] },
    ],
    priority: 90,
    cooldownDays: 365,
    maxOccurrences: 1,
    choices: [
      {
        id: 'automation-efficiency-first',
        label: 'Efficiency has to come first',
        description: "A farm that loses money can't employ anyone. You have to stay viable.",
        effects: [
          { type: 'set_flag', flag: 'automation_discussed', value: true },
          { type: 'add_notification', message: 'You and Santos worked through the automation tradeoffs. She heard your argument.', notificationType: 'event_result' },
        ],
        followUpText: "Santos doesn't disagree with you — not exactly.\n\n\"You're right that a failing farm employs no one. That's the real constraint, and anyone who ignores it is being dishonest about how agriculture works.\" She pulls up data on her tablet. \"Here's what the efficiency gains look like at your scale: for almonds and pistachios, once you own the shaking and pickup equipment, you cut harvest cost per acre significantly compared to contracted labor at current rates. The math is getting clearer every year.\n\nThe crops where mechanization is harder are citrus and avocados — fruit quality is sensitive to mechanical handling, and the premium markets that make those crops profitable often require hand grades. Those operations have a longer runway before the economics force the question.\n\nWhat I'd push back on,\" she says carefully, \"is the framing of efficiency as something that happens to other people. When you automate, you're making a decision about who bears the cost of that efficiency. Usually it's workers. Sometimes it's whole communities. The question isn't whether — it's how you make that transition, and whether you're doing it with any accountability to the people affected.\"\n\nShe closes her tablet. \"That's all I'm asking you to think about.\"",
      },
      {
        id: 'automation-more-at-stake',
        label: "There's more at stake than efficiency",
        description: 'The farming community matters. So do the families who harvest your crops.',
        effects: [
          { type: 'set_flag', flag: 'automation_discussed', value: true },
          { type: 'add_notification', message: 'Santos appreciated that you were thinking beyond the balance sheet.', notificationType: 'event_result' },
        ],
        followUpText: "Santos nods, and something in her expression relaxes slightly.\n\n\"That's the right instinct. Let me give you some substance to go with it.\"\n\nShe explains what the research shows. Agricultural mechanization doesn't just shift labor — it shifts communities. The San Joaquin Valley towns built around seasonal farmwork have been changing for decades: smaller populations, fewer families, fewer local businesses. Some of that is inevitable structural change. Some of it is the accumulated result of individual farm decisions that treated labor as a pure cost line.\n\n\"The farms I've seen navigate this well do a few things. They communicate early — workers who know a change is coming have time to adapt. They look for automation that handles the dangerous and physically punishing work first. And some of them partner with workforce development programs — not as charity, but because a trained local workforce is more reliable than the contractor market.\n\n\"There are also crop choices that matter. High-value hand-harvested crops — premium citrus, specialty varieties — command prices that justify skilled human labor. You don't have to choose between being viable and being part of a community. But you do have to choose consciously.\"\n\nShe pauses at the edge of your field.\n\n\"The fact that you're asking the question puts you ahead of most.\"",
      },
    ],
    tags: ['advisor', 'labor', 'automation', 'community'],
  },

  {
    id: 'forum-staffing-crunch',
    type: 'community',
    illustrationId: 'event-staffing-crunch',
    advisorId: 'growers-forum',
    title: 'Staffing Crunch at Harvest',
    description: "Your harvest contractor called this morning with news you'd half-expected.\n\n\"I can get you maybe 60% of what we contracted — 65% if I push hard. The heat pushed three other operations into the same two-week window and I'm getting outbid. I can pull more workers if you're willing to go above-market on rate. Or we work with what I have and accept that some acreage goes unharvested.\"\n\nYou hang up and look at the calendar. The window is tight. Almonds past hull split are exposed to rain and mold. Citrus held too long loses grade. The Forum is already full of the same conversation. \"Year two of this,\" someone posted this morning. \"If you're still fully dependent on hired crews for hand-harvested crops, you need a plan B.\"",
    preconditions: [
      { type: 'min_year', year: 11 },
      { type: 'max_year', year: 16 },
      { type: 'total_planted_gte', cellCount: 40 },
      { type: 'has_any_crop_in', cropIds: ['almonds', 'citrus-navels', 'pistachios', 'heat-avocado'] },
      { type: 'season', season: 'summer' },
    ],
    priority: 90,
    cooldownDays: 730,
    maxOccurrences: 2,
    choices: [
      {
        id: 'staffing-pay-premium',
        label: 'Pay premium for emergency labor ($300)',
        description: 'Go above-market rate to pull the workers you need. Expensive, but the harvest comes in.',
        cost: 300,
        requiresCash: 300,
        effects: [
          { type: 'modify_cash', amount: -300 },
          { type: 'add_notification', message: "You paid above-market rates to secure enough crews. The harvest came in — mostly. A costly workaround that won't get easier.", notificationType: 'event_result' },
        ],
        followUpText: "The crews show up — enough of them, anyway. You lose maybe 8-10% of your acreage to timing gaps where the window closes before workers cycle through, but the bulk of the crop is in.\n\nThe $300 doesn't capture the full cost: the hours on the phone, the deals negotiated at disadvantageous rates, the contractor relationships you'll need to rebuild next year. The Forum thread is still open on your phone.\n\n\"Anyone else feel like they're paying more every year for less certainty? At what point do we just accept that this model is broken?\"\n\nYou close the tab. Something has to change.",
      },
      {
        id: 'staffing-delay-harvest',
        label: 'Delay harvest and hope',
        description: "Work with what you have and try to manage the timing. Some crops will overripen.",
        effects: [
          { type: 'modify_yield_modifier', cropId: 'almonds', multiplier: 0.85, durationDays: 45 },
          { type: 'modify_yield_modifier', cropId: 'citrus-navels', multiplier: 0.85, durationDays: 45 },
          { type: 'modify_yield_modifier', cropId: 'pistachios', multiplier: 0.85, durationDays: 45 },
          { type: 'modify_yield_modifier', cropId: 'heat-avocado', multiplier: 0.85, durationDays: 45 },
          { type: 'add_notification', message: "Some crops overripened waiting for crews. Yield down ~15% on your labor-intensive fields this harvest.", notificationType: 'event_result' },
        ],
        followUpText: "You stretch the harvest across a longer window than you should, cycling the limited crew through your highest-priority acreage first. It's triage.\n\nThe losses are real but contained. A section of almonds picked up hull stain from an overnight drizzle. Citrus held too long dropped a grade. Total yield impact on your hand-harvested crops: roughly 15%.\n\nYour contractor calls that evening. \"I'm sorry about this year. I want to be straight with you: I'm seeing this get worse, not better. The farms I'm not worried about are the ones that have been diversifying away from pure hand-harvest dependency. I know that's a big change. But I'd think about it.\"\n\nYou note it down. Next season needs a different plan.",
      },
    ],
    tags: ['community', 'labor', 'consequence'],
  },
] as const;
