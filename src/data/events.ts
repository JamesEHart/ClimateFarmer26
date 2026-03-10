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
          { type: 'add_notification', message: 'Dr. Santos helped you apply nitrogen fertilizer. Soil fertility improved.', notificationType: 'event_result' },
        ],
      },
      {
        id: 'acknowledge',
        label: 'Thanks for the Heads Up',
        description: 'Take note and plan to rotate crops next season to rebuild soil health naturally.',
        effects: [
          { type: 'add_notification', message: 'Dr. Santos recommends planting winter wheat in the fall to restore nitrogen naturally. Cover crops also help rebuild soil fertility.', notificationType: 'event_result' },
        ],
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
          { type: 'add_notification', message: "Marcus Chen from Valley Farm Credit reviewed your operation. His advice: \"Focus on your highest-revenue crops and track every dollar. Farming is a business — treat it like one.\"", notificationType: 'event_result' },
        ],
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
          { type: 'add_notification', message: 'You joined the Valley Growers Forum. The meetings are informal — lots of coffee, strong opinions, and the occasional gem of wisdom. "Stick around," one farmer said. "You\'ll hear things Dr. Santos won\'t tell you."', notificationType: 'event_result' },
        ],
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
      { type: 'min_year', year: 20 },
      { type: 'max_year', year: 25 },
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
] as const;
