import {
  selectedCell, selectedCellData, gameState,
  openCropMenu, dispatch, harvestBulk, waterBulk,
  plantBulk, coverCropBulk, cropMenuOpen, availableCrops, confirmDialog,
} from '../../adapter/signals.ts';
import { getCropDefinition } from '../../data/crops.ts';
import { getGrowthProgress, getYieldPercentage, getPerennialPhase, getPerennialAgeFactor } from '../../engine/game.ts';
import {
  GRID_ROWS, GRID_COLS, NITROGEN_HIGH_THRESHOLD,
  NITROGEN_MODERATE_THRESHOLD,
  IRRIGATION_COST_PER_CELL,
} from '../../engine/types.ts';
import { CropMenu } from './CropMenu.tsx';
import { CROP_ART } from './FarmCell.tsx';
import styles from '../styles/SidePanel.module.css';

export function SidePanel() {
  const state = gameState.value;
  if (!state) return null;

  const sel = selectedCell.value;
  const cellData = selectedCellData.value;

  return (
    <aside class={styles.panel} role="complementary" aria-label="Farm details">
      {cellData ? (
        <CellDetail cell={cellData} row={sel!.row} col={sel!.col} />
      ) : (
        <FieldSummary />
      )}
      <BulkActions />
    </aside>
  );
}

function CellDetail({ cell, row, col }: { cell: import('../../engine/types.ts').Cell; row: number; col: number }) {
  const { crop, soil, coverCropId } = cell;
  const cropDef = crop ? getCropDefinition(crop.cropId) : null;
  const isMenuOpen = cropMenuOpen.value;
  const cropsAvailable = availableCrops.value;
  const state = gameState.value;

  const canPlant = !crop && cropsAvailable.length > 0;
  const canHarvest = crop && (crop.growthStage === 'harvestable' || crop.growthStage === 'overripe') && !crop.isDormant && !crop.harvestedThisSeason;
  const canRemove = crop?.isPerennial === true;
  const isFall = state?.calendar.season === 'fall';
  const isDeciduousPerennial = crop?.isPerennial && cropDef?.dormantSeasons && cropDef.dormantSeasons.length > 0;
  const hasUnderstoryCoverCrop = crop?.isPerennial && cropDef?.coverCropEffectiveness && cropDef.coverCropEffectiveness > 0;
  const canPlantCover = isFall && !coverCropId && (!crop || isDeciduousPerennial || hasUnderstoryCoverCrop);
  const progress = crop ? getGrowthProgress(crop) : 0;
  const yieldPct = crop ? getYieldPercentage(crop) : 0;

  // Growth stage display text
  let growthText = '';
  if (crop) {
    const pctDone = Math.round(progress * 100);
    if (crop.isDormant) {
      growthText = 'Dormant \u2014 waiting for spring';
    } else if (crop.harvestedThisSeason) {
      growthText = 'Already harvested this season';
    } else if (crop.growthStage === 'harvestable') {
      growthText = 'Ready to harvest!';
    } else if (crop.growthStage === 'overripe') {
      const lossText = crop.isPerennial ? 'yield lost this year' : 'crop loss';
      growthText = `Overripe \u2014 yield declining. ${crop.overripeDaysRemaining} days until ${lossText}.`;
    } else {
      growthText = `${crop.growthStage.charAt(0).toUpperCase() + crop.growthStage.slice(1)} \u2014 ${pctDone}% grown`;
    }
  }

  // Harvest tooltip for non-ready crops
  let harvestTooltip = '';
  if (crop && !canHarvest) {
    if (crop.isDormant) {
      harvestTooltip = `Trees are dormant during winter.`;
    } else if (crop.harvestedThisSeason) {
      harvestTooltip = `Already harvested this season.`;
    } else {
      harvestTooltip = `Not ready yet \u2014 ${cropDef?.name}, ${Math.round(progress * 100)}% grown.`;
    }
  }

  function handlePlantClick() {
    openCropMenu();
  }

  function handleHarvest() {
    dispatch({ type: 'HARVEST', cellRow: row, cellCol: col });
  }

  function handleRemove() {
    const cost = cropDef?.removalCost ?? 0;
    confirmDialog.value = {
      message: `Remove ${cropDef?.name}? This will permanently clear this plot. Cost: $${cost}.`,
      onConfirm: () => {
        dispatch({ type: 'REMOVE_CROP', cellRow: row, cellCol: col });
        confirmDialog.value = null;
      },
      onCancel: () => { confirmDialog.value = null; },
      actionId: 'remove-crop',
      origin: 'manual',
    };
  }

  return (
    <div data-testid="sidebar-cell-detail">
      <div class={styles.section}>
        <div class={styles.sectionTitle}>Plot (Row {row + 1}, Col {col + 1})</div>
        <div class={styles.cellDetail}>
          <span data-testid="sidebar-crop-name" class={styles.cropName}>
            {cropDef ? cropDef.name : (coverCropId ? 'Fallow (Cover Crop)' : 'Empty')}
          </span>
          {crop && cropDef && (() => {
            const artKey = crop.isDormant ? 'dormant' : crop.growthStage;
            const artSrc = CROP_ART[crop.cropId]?.[artKey];
            const stageLabel = crop.isDormant ? 'Dormant'
              : crop.growthStage === 'harvestable' ? 'Ready to Harvest!'
              : crop.growthStage === 'overripe' ? 'Overripe'
              : crop.growthStage.charAt(0).toUpperCase() + crop.growthStage.slice(1);
            return artSrc ? (
              <div class={styles.cropPreview}>
                <img
                  src={artSrc}
                  alt={`${cropDef.name} — ${stageLabel}`}
                  class={styles.cropPreviewImg}
                  data-testid="sidebar-crop-preview"
                />
                <span class={styles.cropPreviewLabel} data-testid="sidebar-crop-stage-label">
                  {cropDef.name} — {stageLabel}
                </span>
              </div>
            ) : null;
          })()}
          {crop && (
            <>
              <span class={styles.cropStage}>{growthText}</span>
              {crop.growthStage === 'overripe' && (
                <span class={styles.overripeWarning}>
                  Yield: {Math.round(yieldPct)}% of maximum. Harvest now or lose it in {crop.overripeDaysRemaining} days.
                </span>
              )}
              {!crop.isDormant && (
                <div data-testid="sidebar-crop-growth" class={styles.growthBar}>
                  <div class={styles.growthLabel}>Growth Progress</div>
                  <div class={styles.growthBarContainer}>
                    <div
                      class={styles.growthBarFill}
                      style={{ width: `${Math.min(100, progress * 100)}%` }}
                    />
                  </div>
                </div>
              )}
              {crop.isPerennial && cropDef && (
                <div data-testid="sidebar-perennial-status" class={styles.perennialInfo}>
                  {crop.perennialEstablished ? (
                    <>
                      <span data-testid="sidebar-perennial-age" class={styles.perennialLabel}>
                        {crop.isDormant ? 'Dormant' : 'Producing'} — Year {crop.perennialAge} of {cropDef.productiveLifespan ?? '?'}
                      </span>
                      <span data-testid="sidebar-perennial-phase" class={styles.perennialPhase}>
                        {getPerennialPhase(crop, cropDef)}
                        {cropDef.yieldCurve && (() => {
                          const factor = getPerennialAgeFactor(crop, cropDef);
                          if (factor < 1.0) return ` (${Math.round(factor * 100)}%)`;
                          return null;
                        })()}
                      </span>
                      {cropDef.yieldCurve && (() => {
                        const yp = crop.perennialAge - (cropDef.yearsToEstablish ?? 0);
                        const phase = getPerennialPhase(crop, cropDef);
                        if (phase === 'Peak Production' && cropDef.yieldCurve.declineStartYear > yp) {
                          const yearsUntilDecline = cropDef.yieldCurve.declineStartYear - yp;
                          return (
                            <span data-testid="sidebar-perennial-decline-info" class={styles.perennialDeclineInfo}>
                              {yearsUntilDecline} year{yearsUntilDecline !== 1 ? 's' : ''} until decline
                            </span>
                          );
                        }
                        if (phase === 'Declining' || phase === 'Past Prime') {
                          return (
                            <span data-testid="sidebar-perennial-decline-info" class={styles.perennialDeclineInfo}>
                              Replacement recommended
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </>
                  ) : (
                    <>
                      <span data-testid="sidebar-perennial-age" class={styles.perennialLabel}>
                        {crop.isDormant ? 'Dormant' : 'Establishing'} — Year {crop.perennialAge}/{cropDef.yearsToEstablish ?? '?'}
                      </span>
                      <span data-testid="sidebar-perennial-phase" class={styles.perennialPhase}>
                        {getPerennialPhase(crop, cropDef)}
                      </span>
                    </>
                  )}
                  {!crop.perennialEstablished && cropDef.yearsToEstablish && !crop.isDormant && (
                    <span class={styles.perennialEstablishing}>
                      {cropDef.yearsToEstablish - crop.perennialAge} year{cropDef.yearsToEstablish - crop.perennialAge !== 1 ? 's' : ''} until first harvest
                    </span>
                  )}
                  {gameState.value?.flags['chillHoursRevealed'] && cropDef.chillHoursRequired !== undefined && cropDef.chillHoursRequired > 0 && (
                    <ChillHourBar
                      accumulated={crop.chillHoursAccumulated}
                      required={cropDef.chillHoursRequired}
                    />
                  )}
                </div>
              )}
              {cropDef && (
                <span class={styles.cropDescription}>{cropDef.shortDescription}</span>
              )}
            </>
          )}
        </div>
      </div>

      <div class={styles.section}>
        <div class={styles.sectionTitle}>Soil</div>
        <SoilBar
          label="Nitrogen"
          testId="sidebar-soil-n"
          value={soil.nitrogen}
          max={200}
          unit="lbs/acre"
          color={
            soil.nitrogen >= NITROGEN_HIGH_THRESHOLD ? 'var(--nitrogen-high)' :
            soil.nitrogen >= NITROGEN_MODERATE_THRESHOLD ? 'var(--nitrogen-medium)' :
            'var(--nitrogen-low)'
          }
        />
        <SoilBar
          label="Moisture"
          testId="sidebar-soil-moisture"
          value={soil.moisture}
          max={soil.moistureCapacity}
          unit="in"
          color={
            soil.moistureCapacity > 0 && soil.moisture / soil.moistureCapacity > 0.5 ? 'var(--moisture-high)' :
            soil.moistureCapacity > 0 && soil.moisture / soil.moistureCapacity > 0.25 ? 'var(--moisture-medium)' :
            'var(--moisture-critical)'
          }
        />
        <SoilBar
          label="Organic M."
          testId="sidebar-soil-om"
          value={soil.organicMatter}
          max={5}
          unit="%"
          color="var(--color-primary)"
        />
        {state?.flags['tech_soil_testing'] ? (
          <SoilBar
            label="Potassium"
            testId="sidebar-soil-k"
            value={soil.potassium}
            max={200}
            unit="lbs/acre"
            color="var(--color-primary)"
          />
        ) : (
          <div data-testid="sidebar-soil-k-hidden" class={styles.soilRow}>
            <span class={styles.soilLabel}>Potassium</span>
            <span class={styles.soilValue}>???</span>
          </div>
        )}
      </div>

      <div class={styles.section}>
        <div class={styles.sectionTitle}>Actions</div>
        <div class={styles.actions}>
          {canPlant && !isMenuOpen && (
            <button
              data-testid="action-plant"
              class={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
              onClick={handlePlantClick}
            >
              Plant...
            </button>
          )}
          {!canPlant && !crop && cropsAvailable.length === 0 && (
            <div class={styles.tooltip}>No crops available this season.</div>
          )}
          {crop && !canPlant && (
            <div class={styles.tooltip}>This plot already has a crop.</div>
          )}

          {isMenuOpen && <CropMenu row={row} col={col} />}

          <button
            data-testid="action-harvest"
            class={`${styles.actionBtn} ${canHarvest ? styles.actionBtnHarvest : ''}`}
            onClick={handleHarvest}
            disabled={!canHarvest}
            aria-label={canHarvest ? 'Harvest this plot' : harvestTooltip}
            title={canHarvest ? undefined : harvestTooltip}
          >
            Harvest
          </button>
          {crop?.harvestedThisSeason && (
            <span data-testid="harvested-this-season" class={styles.harvestedLabel}>
              Harvested this season
            </span>
          )}

          {canRemove && (
            <button
              data-testid="action-remove-crop"
              class={`${styles.actionBtn} ${styles.actionBtnRemove}`}
              onClick={handleRemove}
            >
              Remove {cropDef?.name} (${cropDef?.removalCost ?? 0})
            </button>
          )}

          {canPlantCover && (
            <button
              data-testid="action-plant-cover-crop"
              class={`${styles.actionBtn} ${styles.actionBtnCover}`}
              onClick={() => dispatch({ type: 'SET_COVER_CROP', cellRow: row, cellCol: col, coverCropId: 'legume-cover' })}
            >
              Plant Cover Crop ($30)
            </button>
          )}

          {coverCropId && (
            <div data-testid="sidebar-cover-crop-status" class={styles.coverCropStatus}>
              Cover Crop: Clover/Vetch Mix
              <button
                data-testid="action-remove-cover-crop"
                class={`${styles.actionBtn} ${styles.actionBtnRemove}`}
                onClick={() => dispatch({ type: 'SET_COVER_CROP', cellRow: row, cellCol: col, coverCropId: null })}
              >
                Remove Cover Crop
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SoilBar({ label, testId, value, max, unit, color }: {
  label: string;
  testId: string;
  value: number;
  max: number;
  unit: string;
  color: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const display = unit === '%' ? `${value.toFixed(1)}${unit}` : `${Math.round(value)} ${unit}`;

  return (
    <div class={styles.soilRow} data-testid={testId}>
      <span class={styles.soilLabel}>{label}</span>
      <div
        class={styles.barContainer}
        role="meter"
        aria-label={`${label}: ${display}`}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div class={styles.barFill} style={{ width: `${pct}%`, background: color }} />
      </div>
      <span class={styles.soilValue}>{display}</span>
    </div>
  );
}

function ChillHourBar({ accumulated, required }: { accumulated: number; required: number }) {
  const pct = required > 0 ? Math.min(100, (accumulated / required) * 100) : 100;
  const deficit = required - accumulated;
  const hasDeficit = deficit > 0;

  return (
    <div data-testid="sidebar-perennial-chill" class={styles.chillInfo}>
      <span class={styles.chillLabel}>Chill Hours</span>
      <div class={styles.chillBarContainer}>
        <div
          class={styles.chillBarFill}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span class={styles.chillValue}>
        {Math.round(accumulated)}/{required}
      </span>
      {hasDeficit && (
        <span class={styles.chillWarning} data-testid="sidebar-chill-deficit">
          Deficit: {Math.round(deficit)} hrs
        </span>
      )}
    </div>
  );
}

function FieldSummary() {
  const state = gameState.value;
  if (!state) return null;

  let planted = 0;
  let harvestableCount = 0;
  let totalN = 0;
  let totalMoisture = 0;

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const cell = state.grid[r][c];
      if (cell.crop) {
        planted++;
        // Correct predicate: exclude dormant and already-harvested perennials
        if ((cell.crop.growthStage === 'harvestable' || cell.crop.growthStage === 'overripe') &&
            !cell.crop.isDormant &&
            !(cell.crop.isPerennial && cell.crop.harvestedThisSeason)) {
          harvestableCount++;
        }
      }
      totalN += cell.soil.nitrogen;
      totalMoisture += cell.soil.moisture;
    }
  }

  const avgN = totalN / (GRID_ROWS * GRID_COLS);
  const avgMoisture = totalMoisture / (GRID_ROWS * GRID_COLS);
  const empty = GRID_ROWS * GRID_COLS - planted;

  return (
    <div class={styles.section}>
      <div class={styles.sectionTitle}>Field Summary</div>
      <div class={styles.fieldSummary}>
        <div class={styles.summaryRow}>
          <span>Planted plots</span>
          <span>{planted} / {GRID_ROWS * GRID_COLS}</span>
        </div>
        <div class={styles.summaryRow}>
          <span>Empty plots</span>
          <span>{empty}</span>
        </div>
        <div class={styles.summaryRow}>
          <span>Ready to harvest</span>
          <span>{harvestableCount}</span>
        </div>
        <div class={styles.summaryRow}>
          <span>Avg. nitrogen</span>
          <span>{Math.round(avgN)} lbs/acre</span>
        </div>
        <div class={styles.summaryRow}>
          <span>Avg. moisture</span>
          <span>{avgMoisture.toFixed(1)} in</span>
        </div>
        <div class={styles.summaryRow}>
          <span>Revenue (this year)</span>
          <span>${Math.floor(state.economy.yearlyRevenue).toLocaleString()}</span>
        </div>
        <div class={styles.summaryRow}>
          <span>Expenses (this year)</span>
          <span>${Math.floor(state.economy.yearlyExpenses).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

function BulkActions() {
  const state = gameState.value;
  if (!state) return null;

  const sel = selectedCell.value;
  const cropsAvailable = availableCrops.value;
  const hasCrops = state.grid.some(row => row.some(c => c.crop !== null));
  // Correct harvest-ready predicate: exclude dormant and already-harvested perennials
  let harvestReadyCount = 0;
  for (const row of state.grid) {
    for (const c of row) {
      if (c.crop &&
          (c.crop.growthStage === 'harvestable' || c.crop.growthStage === 'overripe') &&
          !c.crop.isDormant &&
          !(c.crop.isPerennial && c.crop.harvestedThisSeason)) {
        harvestReadyCount++;
      }
    }
  }
  const hasHarvestable = harvestReadyCount > 0;
  const isFall = state.calendar.season === 'fall';
  const hasEligibleForCover = isFall && state.grid.some(row => row.some(c => {
    if (c.coverCropId) return false;
    if (!c.crop) return true;
    if (!c.crop.isPerennial) return false;
    const def = getCropDefinition(c.crop.cropId);
    return (def.dormantSeasons?.length ?? 0) > 0 || (def.coverCropEffectiveness ?? 0) > 0;
  }));

  return (
    <div class={styles.section}>
      <div class={styles.sectionTitle}>Bulk Actions</div>
      <div class={styles.actions}>
        {cropsAvailable.length > 0 && cropsAvailable.map(cropId => {
          const def = getCropDefinition(cropId);
          return (
            <button
              key={cropId}
              data-testid={`action-plant-all-${cropId}`}
              class={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
              onClick={() => plantBulk('all', cropId)}
            >
              Plant Field: {def.name} (${def.seedCostPerAcre}/plot)
            </button>
          );
        })}

        {sel && cropsAvailable.length > 0 && cropsAvailable.map(cropId => {
          const def = getCropDefinition(cropId);
          return (
            <button
              key={`row-${cropId}`}
              data-testid={`action-plant-row-${sel.row}-${cropId}`}
              class={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
              onClick={() => plantBulk('row', cropId, sel.row)}
            >
              Plant Row {sel.row + 1}: {def.name} (${def.seedCostPerAcre}/plot)
            </button>
          );
        })}

        {sel && cropsAvailable.length > 0 && cropsAvailable.map(cropId => {
          const def = getCropDefinition(cropId);
          return (
            <button
              key={`col-${cropId}`}
              data-testid={`action-plant-col-${sel.col}-${cropId}`}
              class={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
              onClick={() => plantBulk('col', cropId, sel.col)}
            >
              Plant Col {sel.col + 1}: {def.name} (${def.seedCostPerAcre}/plot)
            </button>
          );
        })}

        <button
          data-testid="action-harvest-all"
          class={`${styles.actionBtn} ${hasHarvestable ? styles.actionBtnHarvest : ''}`}
          onClick={() => harvestBulk('all')}
          disabled={!hasHarvestable}
        >
          Harvest Field{hasHarvestable ? ` (${harvestReadyCount} ready)` : ''}
        </button>

        {sel && (
          <button
            data-testid={`action-harvest-row-${sel.row}`}
            class={`${styles.actionBtn} ${hasHarvestable ? styles.actionBtnHarvest : ''}`}
            onClick={() => harvestBulk('row', sel.row)}
            disabled={!hasHarvestable}
          >
            Harvest Row {sel.row + 1}
          </button>
        )}

        {sel && (
          <button
            data-testid={`action-harvest-col-${sel.col}`}
            class={`${styles.actionBtn} ${hasHarvestable ? styles.actionBtnHarvest : ''}`}
            onClick={() => harvestBulk('col', sel.col)}
            disabled={!hasHarvestable}
          >
            Harvest Col {sel.col + 1}
          </button>
        )}

        <button
          data-testid="action-water-all"
          class={`${styles.actionBtn} ${hasCrops ? styles.actionBtnWater : ''}`}
          onClick={() => waterBulk('all')}
          disabled={!hasCrops}
        >
          Water Field (${IRRIGATION_COST_PER_CELL}/plot)
        </button>

        {sel && (
          <button
            data-testid={`action-water-row-${sel.row}`}
            class={`${styles.actionBtn} ${styles.actionBtnWater}`}
            onClick={() => waterBulk('row', sel.row)}
            disabled={!hasCrops}
          >
            Water Row {sel.row + 1}
          </button>
        )}

        {sel && (
          <button
            data-testid={`action-water-col-${sel.col}`}
            class={`${styles.actionBtn} ${styles.actionBtnWater}`}
            onClick={() => waterBulk('col', sel.col)}
            disabled={!hasCrops}
          >
            Water Col {sel.col + 1}
          </button>
        )}

        {hasEligibleForCover && (
          <button
            data-testid="action-plant-cover-crop-bulk"
            class={`${styles.actionBtn} ${styles.actionBtnCover}`}
            onClick={() => coverCropBulk('all', 'legume-cover')}
          >
            Cover Crop — Field ($30/plot)
          </button>
        )}

        {sel && hasEligibleForCover && (
          <button
            data-testid={`action-cover-crop-row-${sel.row}`}
            class={`${styles.actionBtn} ${styles.actionBtnCover}`}
            onClick={() => coverCropBulk('row', 'legume-cover', sel.row)}
          >
            Cover Crop — Row {sel.row + 1}
          </button>
        )}

        {sel && hasEligibleForCover && (
          <button
            data-testid={`action-cover-crop-col-${sel.col}`}
            class={`${styles.actionBtn} ${styles.actionBtnCover}`}
            onClick={() => coverCropBulk('col', 'legume-cover', sel.col)}
          >
            Cover Crop — Col {sel.col + 1}
          </button>
        )}
      </div>
    </div>
  );
}
