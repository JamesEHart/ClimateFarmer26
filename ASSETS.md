# Asset Manifest — ClimateFarmer26

All visual assets for the game. This file is the single source of truth for what art is needed, where it goes, and its status.

## Naming Convention

`{asset-id}_{width}x{height}.jpeg`

Example: `extension-agent_128x128.jpeg`

This embeds the target pixel dimensions in the filename so artists know exactly what size to produce.

## Performance Budget

Target hardware is Chromebooks. Keep total asset payload under 2MB. Individual images should be optimized before committing.

## Advisor Portraits

Displayed in the EventPanel when advisor-type events fire. Mapped by `advisorId` in code via `ADVISOR_CHARACTERS` in `src/ui/components/EventPanel.tsx`.

| Asset ID | File Path | Dimensions | Used In | Status | Notes |
|----------|-----------|------------|---------|--------|-------|
| `extension-agent` | `public/assets/advisors/extension-agent_128x128.jpeg` | 128x128 | EventPanel (Dr. Maria Santos) | Complete | Agricultural extension agent. Warm, approachable. |
| `weather-service` | `public/assets/advisors/weather-service_128x128.jpeg` | 128x128 | EventPanel (NWS Fresno) | Complete | Weather forecaster. Professional. |
| `default` | `public/assets/advisors/default_128x128.jpeg` | 128x128 | EventPanel (fallback) | Complete | Generic advisor silhouette. Used when advisorId has no matching portrait. |

### Advisor Portrait Spec

- **Size:** 128x128 pixels (renders at 64x64 CSS pixels for retina sharpness)
- **Style:** Friendly, approachable — these are educational characters for high school students
- **Framing:** Head and shoulders, centered
- **Rendering:** Rendered as `<img>` with `data-testid="advisor-portrait"`, circular crop via CSS `border-radius: 50%`

## Crop Art

All crop stages rendered as images on farm grid cells — no emoji. Mapped via `CROP_ART` in `src/ui/components/FarmCell.tsx`. Each crop has 4 growth stages (seedling, vegetative, flowering, mature) + harvestable/overripe. Deciduous perennials (almonds, pistachios) also have a dormant stage. Citrus is evergreen — no dormant art needed.

### Harvest Art (existing — complete)

| Asset ID | File Path | Dimensions | Used In | Status | Notes |
|----------|-----------|------------|---------|--------|-------|
| `crop-tomatoes` | `public/assets/crops/crop-tomatoes_48x48.jpeg` | 48x48 | FarmCell (harvestable/overripe) | Complete | Processing tomatoes |
| `crop-corn` | `public/assets/crops/crop-corn_48x48.jpeg` | 48x48 | FarmCell (harvestable/overripe) | Complete | Silage corn |
| `crop-wheat` | `public/assets/crops/crop-wheat_48x48.jpeg` | 48x48 | FarmCell (harvestable/overripe) | Complete | Winter wheat |
| `crop-sorghum` | `public/assets/crops/crop-sorghum_48x48.jpeg` | 48x48 | FarmCell (harvestable/overripe) | Complete | Sorghum |
| `crop-almonds` | `public/assets/crops/crop-almonds_48x48.jpeg` | 48x48 | FarmCell (harvestable/overripe) | Complete | Almonds (tree) |
| `crop-pistachios` | `public/assets/crops/crop-pistachios_48x48.jpeg` | 48x48 | FarmCell (harvestable/overripe) | Complete | Pistachios (tree) |
| `crop-citrus` | `public/assets/crops/crop-citrus_48x48.jpeg` | 48x48 | FarmCell (harvestable/overripe) | Complete | Citrus navels (tree) |

### Growth Stage Art (28 images — complete)

| Asset ID | File Path | Dimensions | Used In | Status | Notes |
|----------|-----------|------------|---------|--------|-------|
| `crop-tomatoes-seedling` | `public/assets/crops/crop-tomatoes-seedling_48x48.jpeg` | 48x48 | FarmCell (seedling) | Complete | Tiny sprout emerging from soil |
| `crop-tomatoes-vegetative` | `public/assets/crops/crop-tomatoes-vegetative_48x48.jpeg` | 48x48 | FarmCell (vegetative) | Complete | Bushy green tomato plant, no fruit |
| `crop-tomatoes-flowering` | `public/assets/crops/crop-tomatoes-flowering_48x48.jpeg` | 48x48 | FarmCell (flowering) | Complete | Yellow flowers visible on plant |
| `crop-tomatoes-mature` | `public/assets/crops/crop-tomatoes-mature_48x48.jpeg` | 48x48 | FarmCell (mature) | Complete | Green tomatoes on vine, not yet ripe |
| `crop-corn-seedling` | `public/assets/crops/crop-corn-seedling_48x48.jpeg` | 48x48 | FarmCell (seedling) | Complete | Small corn sprout |
| `crop-corn-vegetative` | `public/assets/crops/crop-corn-vegetative_48x48.jpeg` | 48x48 | FarmCell (vegetative) | Complete | Leafy corn stalk, no tassels |
| `crop-corn-flowering` | `public/assets/crops/crop-corn-flowering_48x48.jpeg` | 48x48 | FarmCell (flowering) | Complete | Corn tassels visible |
| `crop-corn-mature` | `public/assets/crops/crop-corn-mature_48x48.jpeg` | 48x48 | FarmCell (mature) | Complete | Full ears with husks |
| `crop-wheat-seedling` | `public/assets/crops/crop-wheat-seedling_48x48.jpeg` | 48x48 | FarmCell (seedling) | Complete | Tiny wheat sprout |
| `crop-wheat-vegetative` | `public/assets/crops/crop-wheat-vegetative_48x48.jpeg` | 48x48 | FarmCell (vegetative) | Complete | Green wheat tillers |
| `crop-wheat-flowering` | `public/assets/crops/crop-wheat-flowering_48x48.jpeg` | 48x48 | FarmCell (flowering) | Complete | Wheat heads forming |
| `crop-wheat-mature` | `public/assets/crops/crop-wheat-mature_48x48.jpeg` | 48x48 | FarmCell (mature) | Complete | Golden wheat heads |
| `crop-sorghum-seedling` | `public/assets/crops/crop-sorghum-seedling_48x48.jpeg` | 48x48 | FarmCell (seedling) | Complete | Small sorghum sprout |
| `crop-sorghum-vegetative` | `public/assets/crops/crop-sorghum-vegetative_48x48.jpeg` | 48x48 | FarmCell (vegetative) | Complete | Leafy sorghum stalk |
| `crop-sorghum-flowering` | `public/assets/crops/crop-sorghum-flowering_48x48.jpeg` | 48x48 | FarmCell (flowering) | Complete | Sorghum heads forming |
| `crop-sorghum-mature` | `public/assets/crops/crop-sorghum-mature_48x48.jpeg` | 48x48 | FarmCell (mature) | Complete | Full sorghum grain head |
| `crop-almonds-seedling` | `public/assets/crops/crop-almonds-seedling_48x48.jpeg` | 48x48 | FarmCell (seedling) | Complete | Small almond sapling |
| `crop-almonds-vegetative` | `public/assets/crops/crop-almonds-vegetative_48x48.jpeg` | 48x48 | FarmCell (vegetative) | Complete | Young almond tree with leaf canopy |
| `crop-almonds-flowering` | `public/assets/crops/crop-almonds-flowering_48x48.jpeg` | 48x48 | FarmCell (flowering) | Complete | White/pink almond blossoms |
| `crop-almonds-mature` | `public/assets/crops/crop-almonds-mature_48x48.jpeg` | 48x48 | FarmCell (mature) | Complete | Green almonds among leaves |
| `crop-pistachios-seedling` | `public/assets/crops/crop-pistachios-seedling_48x48.jpeg` | 48x48 | FarmCell (seedling) | Complete | Small pistachio sapling |
| `crop-pistachios-vegetative` | `public/assets/crops/crop-pistachios-vegetative_48x48.jpeg` | 48x48 | FarmCell (vegetative) | Complete | Young pistachio tree with leaf canopy |
| `crop-pistachios-flowering` | `public/assets/crops/crop-pistachios-flowering_48x48.jpeg` | 48x48 | FarmCell (flowering) | Complete | Pistachio blossoms |
| `crop-pistachios-mature` | `public/assets/crops/crop-pistachios-mature_48x48.jpeg` | 48x48 | FarmCell (mature) | Complete | Green pistachio clusters among leaves |
| `crop-citrus-seedling` | `public/assets/crops/crop-citrus-seedling_48x48.jpeg` | 48x48 | FarmCell (seedling) | Complete | Small citrus sapling |
| `crop-citrus-vegetative` | `public/assets/crops/crop-citrus-vegetative_48x48.jpeg` | 48x48 | FarmCell (vegetative) | Complete | Young citrus tree with glossy leaves |
| `crop-citrus-flowering` | `public/assets/crops/crop-citrus-flowering_48x48.jpeg` | 48x48 | FarmCell (flowering) | Complete | White citrus blossoms |
| `crop-citrus-mature` | `public/assets/crops/crop-citrus-mature_48x48.jpeg` | 48x48 | FarmCell (mature) | Complete | Small green oranges among leaves |

### Dormant Art (2 images — deciduous perennials only)

| Asset ID | File Path | Dimensions | Used In | Status | Notes |
|----------|-----------|------------|---------|--------|-------|
| `crop-almonds-dormant` | `public/assets/crops/crop-almonds-dormant_48x48.jpeg` | 48x48 | FarmCell (dormant) | Complete | Bare almond tree branches, no leaves |
| `crop-pistachios-dormant` | `public/assets/crops/crop-pistachios-dormant_48x48.jpeg` | 48x48 | FarmCell (dormant) | Complete | Bare pistachio tree branches, no leaves |

### Growth Stage Art Direction (for prompting)

Each stage should be visually distinct from its neighbors. Crop art renders responsively to fill the farm cell (minus 4px padding).

- **Seedling:** Tiny green sprout emerging from brown soil. For trees: small sapling with 2-3 leaves. Predominantly soil-colored with a touch of green.
- **Vegetative:** Healthy leafy growth, no fruit/flowers visible. For trees: young tree with full leaf canopy. Predominantly green.
- **Flowering:** Crop-specific flowers visible. Tomatoes: yellow flowers. Corn: tassels. Wheat: heads forming. Trees: white/pink blossoms. Mix of green + flower color.
- **Mature:** Fruit/grain visible but not yet ripe. Tomatoes: green tomatoes on vine. Corn: full ears with husks. Wheat: golden heads. Trees: small green fruit among leaves. Transitioning toward harvest colors.
- **Dormant (deciduous trees only):** Bare branches, no leaves or fruit. Winter appearance. Brown/grey wood tones against soil. Distinct from seedling (no green).

### Crop Art Spec

- **Size:** 48x48 pixels (renders responsively to fill cell, CSS `width: calc(100% - 4px)`)
- **Style:** Stylized semi-realistic, painterly, approachable for high school students
- **Palette:** sun-baked earth (#A97142), wheat gold (#D8B45A), irrigation blue (#4A90B8), leaf green (#6FA35B), sky haze (#C9DCE8), orchard dark (#2F5D3A), accent orange (#E38B3A)
- **Background:** Soil/earth tones — crops sit on farm cells, so background should blend with the cell background. (The shared prompt says "transparent background" but all assets are JPEG — no transparency supported. Earth-toned backgrounds effectively achieve the same result.)
- **Constraints:** No text, no logos, no watermarks

### Agave Crop Art (Slice 5a — tech-gated crop, complete)

Agave is a perennial (no dormancy, evergreen like citrus). Wired in CROP_ART in FarmCell.tsx.

| Asset ID | File Path | Dimensions | Status | Notes |
|----------|-----------|------------|--------|-------|
| `crop-agave-seedling` | `public/assets/crops/crop-agave-seedling_48x48.jpeg` | 48x48 | Complete | Small agave rosette, low to ground, few thick leaves |
| `crop-agave-vegetative` | `public/assets/crops/crop-agave-vegetative_48x48.jpeg` | 48x48 | Complete | Growing rosette, thick succulent blue-green leaves |
| `crop-agave-flowering` | `public/assets/crops/crop-agave-flowering_48x48.jpeg` | 48x48 | Complete | Tall flower stalk (quiote) emerging from rosette |
| `crop-agave-mature` | `public/assets/crops/crop-agave-mature_48x48.jpeg` | 48x48 | Complete | Full mature rosette, large thick leaves, blue-grey |
| `crop-agave` | `public/assets/crops/crop-agave_48x48.jpeg` | 48x48 | Complete | Harvestable piña/heart visible, used for harvestable + overripe |

### Slice 5b Advisor Portraits (art ready, not yet wired in engine)

| Asset ID | File Path | Dimensions | Status | Notes |
|----------|-----------|------------|--------|-------|
| `farm-credit` | `public/assets/advisors/farm-credit_128x128.jpeg` | 128x128 | Art ready | Marcus Chen — Valley Farm Credit banker. Wire in 5b when advisorId added. |
| `growers-forum` | `public/assets/advisors/growers-forum_128x128.jpeg` | 128x128 | Art ready | Valley Growers Forum representative. Wire in 5b when advisorId added. |

## UI Icons (Future)

| Asset ID | File Path | Dimensions | Used In | Status | Notes |
|----------|-----------|------------|---------|--------|-------|
| (none yet) | | | | | |

## Source & License

| Asset | Source | License | Attribution Required |
|-------|--------|---------|---------------------|
| Advisor portraits | Neal Addicott using Nano Banana Pro | Project use | Yes |
| Crop icons | Neal Addicott using Nano Banana Pro | Project use | Yes |
| (student contributions) | Student artists | (TBD — get written consent) | Yes — credit in-game or README |

## Prompting information
  Sources used:

  - https://ai.google.dev/gemini-api/docs/image-generation
  - https://ai.google.dev/gemini-api/docs/imagen
  - https://firebase.google.com/docs/ai-logic/prompt-design
  - https://ai.google.dev/gemini-api/docs/prompting-strategies

  Prompt (shared element):
    Create a single game-ready 2D digital illustration asset for an educational farming strategy game set in California’s San Joaquin Valley.

  SHARED STYLE GUIDE:
  Stylized semi-realistic look with warmth and personality. Painterly forms, clean readable silhouette, subtle hand-crafted texture, approachable for high school
  students. Grounded and optimistic tone.
  Palette direction: sun-baked earth (#A97142), wheat gold (#D8B45A), irrigation blue (#4A90B8), leaf green (#6FA35B), sky haze (#C9DCE8), orchard dark (#2F5D3A),
  accent orange (#E38B3A).
  Lighting: soft daylight, gentle directional light, mild contrast, no harsh dramatic shadows.
  Composition: one clear centered subject, high readability at small size.
  Hard constraints: transparent background, no scene background, no text, no letters, no logos, no watermark, no frame, no UI elements.

  Example specific prompt:
    ASSET-SPECIFIC:
  Head-and-shoulders portrait of a friendly agricultural extension advisor (Latina woman, late 30s to early 40s), calm confident smile, practical field jacket over
  collared shirt, slight clipboard edge visible.
  Expression should feel approachable and trustworthy, professional but not corporate.
  Face should occupy about 65% of the canvas, centered.
  Output as square icon art intended for 128x128.

### Student Art Contributions

If students create art for the game:
- Get written consent (school policy) before including any student work
- Credit the artist by name (or initials if preferred) in README.md
- Ensure art meets the dimension specs above
