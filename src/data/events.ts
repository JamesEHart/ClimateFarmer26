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
    maxOccurrences: 3,
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
    description: "Dr. Santos arrives with a stack of climate data and a grave expression. \"I've been tracking the temperature trends, and we've crossed a threshold. Average summer highs are now consistently above what most of our traditional crops can handle. This isn't a heatwave — this is the new baseline.\"\n\nShe shows yield projections: tomatoes down 25%, corn down 15%, almonds down 20%. Only sorghum, pistachios, and agave are unaffected.\n\n\"But there's an opportunity,\" she continues. \"UC Riverside has developed a heat-tolerant avocado variety specifically for inland valleys. It thrives in these temperatures and could become a high-value replacement for struggling crops.\"\n\nChen reviews the investment: \"$800 for the research license and starter rootstock. The avocados need 4 years to establish, but the long-term value is significant.\"\n\nThe Forum has been watching the thermometer too. \"My grandfather never saw summers like this. The valley is changing — we either change with it or we're done.\"",
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
        id: 'research-heat-crops',
        label: 'Research Heat-Adapted Varieties',
        description: 'Invest in heat-tolerant avocado rootstock and growing techniques. Unlocks avocados — high value, no heat penalty, but 4-year establishment. Costs $800.',
        cost: 800,
        requiresCash: 800,
        effects: [
          { type: 'modify_cash', amount: -800 },
          { type: 'set_flag', flag: 'regime_heat_threshold', value: true },
          { type: 'set_flag', flag: 'tech_crop_avocado', value: true },
          { type: 'add_notification', message: 'Heat threshold permanently crossed. Traditional crops will yield less, but you\'ve unlocked heat-tolerant avocado cultivation. Santos: "The future belongs to crops that thrive in heat, not just survive it."', notificationType: 'event_result' },
        ],
      },
      {
        id: 'accept-heat',
        label: 'Accept Yield Losses',
        description: 'No investment in new varieties. Heat-sensitive crops (tomatoes, corn, wheat, almonds, citrus) permanently yield less.',
        effects: [
          { type: 'set_flag', flag: 'regime_heat_threshold', value: true },
          { type: 'add_notification', message: 'Heat threshold permanently crossed. Tomatoes, corn, wheat, almonds, and citrus will all produce lower yields going forward. Santos: "Without adaptation, you\'re farming against the climate instead of with it."', notificationType: 'event_result' },
        ],
      },
    ],
    tags: ['regime-shift', 'advisor', 'heat', 'tech-unlock'],
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
        followUpText: "Potassium is one of the three primary nutrients plants need, along with nitrogen and phosphorus. Unlike nitrogen, which you can restore with cover crops and rotation, potassium is mainly replenished through mineral fertilizers or very slow rock weathering. Every harvest removes K from your soil — heavy feeders like tomatoes and corn deplete it fastest. The good news: this application should last several seasons. Keep an eye on crop quality at harvest for early warning signs.",
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
          { type: 'add_notification', message: 'Insurance claim filed. $1,500 payout received after $200 deductible. Lost 15% of corn.', notificationType: 'event_result' },
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
          { type: 'add_notification', message: 'Insurance claim filed. $1,000 payout received. Tree crop yields reduced by 20%.', notificationType: 'event_result' },
        ],
        followUpText: 'The adjuster documents the pollination failure across your orchard. "Colony collapse is getting worse every year," she says. The $1,000 payout helps, though yields still take a hit without adequate pollination.',
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
          { type: 'add_notification', message: 'Insurance claim filed. $1,200 payout received. Lost 15% of trees.', notificationType: 'event_result' },
        ],
        followUpText: 'The insurance company sends their own arborist. "We see this more and more," she says, marking infected trees for removal. The $1,200 payout partially covers your losses, though watching healthy-looking trees get cut down is hard. "Better to lose 15% now than 50% next year," the arborist explains.',
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
        label: 'Buy Priority Water Access ($1,500)',
        description: 'Pay for priority allocation. Shortest restriction period.',
        cost: 1500,
        requiresCash: 1500,
        effects: [
          { type: 'modify_cash', amount: -1500 },
          { type: 'restrict_watering', durationDays: 15 },
          { type: 'add_notification', message: 'You bought priority water access. Watering restricted for 15 days.', notificationType: 'event_result' },
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
          { type: 'add_notification', message: 'Insurance claim filed. $1,000 payout received. Watering restricted for 30 days.', notificationType: 'event_result' },
        ],
        followUpText: 'The insurance payout arrives quickly — water emergencies are well-documented claims. The $1,000 helps offset lost revenue during the 30-day restriction. Chen calls: "The curtailment is tough, but imagine eating the full 60-day restriction without any financial cushion."',
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
] as const;
