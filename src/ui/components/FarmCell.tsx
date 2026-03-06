import { selectCell, selectedCell } from '../../adapter/signals.ts';
import { getGrowthProgress } from '../../engine/game.ts';
import { getCropDefinition } from '../../data/crops.ts';
import type { Cell } from '../../engine/types.ts';
import { WATER_VISUAL_WARNING_THRESHOLD, WATER_WILTING_THRESHOLD } from '../../engine/types.ts';
import styles from '../styles/FarmCell.module.css';

/** Unified crop art — all growth stages + dormant use images (no emoji) */
const base = import.meta.env.BASE_URL;
export const CROP_ART: Record<string, Record<string, string>> = {
  'processing-tomatoes': {
    seedling: `${base}assets/crops/crop-tomatoes-seedling_48x48.jpeg`,
    vegetative: `${base}assets/crops/crop-tomatoes-vegetative_48x48.jpeg`,
    flowering: `${base}assets/crops/crop-tomatoes-flowering_48x48.jpeg`,
    mature: `${base}assets/crops/crop-tomatoes-mature_48x48.jpeg`,
    harvestable: `${base}assets/crops/crop-tomatoes_48x48.jpeg`,
    overripe: `${base}assets/crops/crop-tomatoes_48x48.jpeg`,
  },
  'silage-corn': {
    seedling: `${base}assets/crops/crop-corn-seedling_48x48.jpeg`,
    vegetative: `${base}assets/crops/crop-corn-vegetative_48x48.jpeg`,
    flowering: `${base}assets/crops/crop-corn-flowering_48x48.jpeg`,
    mature: `${base}assets/crops/crop-corn-mature_48x48.jpeg`,
    harvestable: `${base}assets/crops/crop-corn_48x48.jpeg`,
    overripe: `${base}assets/crops/crop-corn_48x48.jpeg`,
  },
  'winter-wheat': {
    seedling: `${base}assets/crops/crop-wheat-seedling_48x48.jpeg`,
    vegetative: `${base}assets/crops/crop-wheat-vegetative_48x48.jpeg`,
    flowering: `${base}assets/crops/crop-wheat-flowering_48x48.jpeg`,
    mature: `${base}assets/crops/crop-wheat-mature_48x48.jpeg`,
    harvestable: `${base}assets/crops/crop-wheat_48x48.jpeg`,
    overripe: `${base}assets/crops/crop-wheat_48x48.jpeg`,
  },
  'sorghum': {
    seedling: `${base}assets/crops/crop-sorghum-seedling_48x48.jpeg`,
    vegetative: `${base}assets/crops/crop-sorghum-vegetative_48x48.jpeg`,
    flowering: `${base}assets/crops/crop-sorghum-flowering_48x48.jpeg`,
    mature: `${base}assets/crops/crop-sorghum-mature_48x48.jpeg`,
    harvestable: `${base}assets/crops/crop-sorghum_48x48.jpeg`,
    overripe: `${base}assets/crops/crop-sorghum_48x48.jpeg`,
  },
  'almonds': {
    seedling: `${base}assets/crops/crop-almonds-seedling_48x48.jpeg`,
    vegetative: `${base}assets/crops/crop-almonds-vegetative_48x48.jpeg`,
    flowering: `${base}assets/crops/crop-almonds-flowering_48x48.jpeg`,
    mature: `${base}assets/crops/crop-almonds-mature_48x48.jpeg`,
    harvestable: `${base}assets/crops/crop-almonds_48x48.jpeg`,
    overripe: `${base}assets/crops/crop-almonds_48x48.jpeg`,
    dormant: `${base}assets/crops/crop-almonds-dormant_48x48.jpeg`,
  },
  'pistachios': {
    seedling: `${base}assets/crops/crop-pistachios-seedling_48x48.jpeg`,
    vegetative: `${base}assets/crops/crop-pistachios-vegetative_48x48.jpeg`,
    flowering: `${base}assets/crops/crop-pistachios-flowering_48x48.jpeg`,
    mature: `${base}assets/crops/crop-pistachios-mature_48x48.jpeg`,
    harvestable: `${base}assets/crops/crop-pistachios_48x48.jpeg`,
    overripe: `${base}assets/crops/crop-pistachios_48x48.jpeg`,
    dormant: `${base}assets/crops/crop-pistachios-dormant_48x48.jpeg`,
  },
  'citrus-navels': {
    seedling: `${base}assets/crops/crop-citrus-seedling_48x48.jpeg`,
    vegetative: `${base}assets/crops/crop-citrus-vegetative_48x48.jpeg`,
    flowering: `${base}assets/crops/crop-citrus-flowering_48x48.jpeg`,
    mature: `${base}assets/crops/crop-citrus-mature_48x48.jpeg`,
    harvestable: `${base}assets/crops/crop-citrus_48x48.jpeg`,
    overripe: `${base}assets/crops/crop-citrus_48x48.jpeg`,
  },
};

interface FarmCellProps {
  cell: Cell;
}

export function FarmCell({ cell }: FarmCellProps) {
  const { row, col, crop, soil, coverCropId } = cell;
  const isSelected = selectedCell.value?.row === row && selectedCell.value?.col === col;

  // Determine visual classes
  const stageClass = crop ? styles[crop.growthStage] ?? '' : '';
  const moistureRatio = soil.moistureCapacity > 0 ? soil.moisture / soil.moistureCapacity : 0;
  const moistureClass =
    crop && moistureRatio < WATER_WILTING_THRESHOLD ? styles.moistureCritical :
    crop && moistureRatio < WATER_VISUAL_WARNING_THRESHOLD ? styles.moistureWarning :
    '';

  // Crop art — all stages (including dormant) use <img>, no emoji
  const artKey = crop?.isDormant ? 'dormant' : crop?.growthStage;
  const cropArtSrc = crop && artKey ? (CROP_ART[crop.cropId]?.[artKey] ?? null) : null;
  const dormantClass = crop?.isDormant ? styles.dormant : '';

  // Growth progress (0-1)
  const progress = crop ? getGrowthProgress(crop) : 0;

  // ARIA label for screen readers — SPEC §7.3
  const cropDef = crop ? getCropDefinition(crop.cropId) : null;
  const ariaLabel = crop
    ? `Row ${row + 1}, Column ${col + 1}: ${cropDef!.name}, ${crop.growthStage} stage, nitrogen ${Math.round(soil.nitrogen)}, moisture ${Math.round(soil.moisture * 10) / 10}`
    : `Row ${row + 1}, Column ${col + 1}: Empty plot, nitrogen ${Math.round(soil.nitrogen)}, moisture ${Math.round(soil.moisture * 10) / 10}`;

  function handleClick() {
    selectCell(row, col);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectCell(row, col);
    }
    // Arrow key navigation handled by grid container
  }

  return (
    <button
      data-testid={`farm-cell-${row}-${col}`}
      class={`${styles.cell} ${stageClass} ${moistureClass} ${dormantClass} ${isSelected ? styles.selected : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="gridcell"
      aria-label={ariaLabel}
      aria-selected={isSelected}
      tabIndex={row === 0 && col === 0 ? 0 : -1}
    >
      {cropArtSrc && (
        <img class={styles.cropArt} src={cropArtSrc} alt="" aria-hidden="true" />
      )}
      {crop && (crop.growthStage === 'harvestable' || crop.growthStage === 'overripe') && (
        <span class={styles.readyBadge} data-testid={`harvest-indicator-${row}-${col}`}>
          {crop.growthStage === 'overripe' ? 'Harvest!' : 'Ready!'}
        </span>
      )}
      {coverCropId && (
        <span
          data-testid={`farm-cell-cover-${row}-${col}`}
          class={styles.coverCropIcon}
          aria-hidden="true"
        >{'\u{2618}'}</span>
      )}
      {crop && !crop.isDormant && crop.growthStage !== 'harvestable' && crop.growthStage !== 'overripe' && (
        <div class={styles.progressBar} style={{ width: `${progress * 100}%` }} />
      )}
    </button>
  );
}
