import { useEffect, useRef } from 'preact/hooks';
import { closeCropMenu, plantCrop, gameState } from '../../adapter/signals.ts';
import { getCropDefinition, getAllCropIds } from '../../data/crops.ts';
import { isInPlantingWindow, getMonthName } from '../../engine/calendar.ts';
import styles from '../styles/CropMenu.module.css';

interface CropMenuProps {
  row: number;
  col: number;
}

export function CropMenu(_props: CropMenuProps) {
  const state = gameState.value;
  const menuRef = useRef<HTMLDivElement>(null);

  // Escape to close — SPEC §7.1
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        closeCropMenu();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus first available crop on mount
  useEffect(() => {
    const first = menuRef.current?.querySelector('button:not(:disabled)') as HTMLElement;
    first?.focus();
  }, []);

  if (!state) return null;

  // Filter out crops gated by requiredFlag (tech-locked crops are invisible until unlocked)
  const allCropIds = getAllCropIds().filter(id => {
    const def = getCropDefinition(id);
    return !def.requiredFlag || state.flags[def.requiredFlag];
  });
  const currentMonth = state.calendar.month;
  const cash = state.economy.cash;

  return (
    <div class={styles.menu} ref={menuRef} role="listbox" aria-label="Select a crop to plant">
      {allCropIds.map(cropId => {
        const def = getCropDefinition(cropId);
        const inWindow = isInPlantingWindow(currentMonth, def.plantingWindow.startMonth, def.plantingWindow.endMonth);
        const canAfford = cash >= def.seedCostPerAcre;
        const disabled = !inWindow || !canAfford;

        let disabledReason = '';
        if (!inWindow) {
          disabledReason = `Planting window: ${getMonthName(def.plantingWindow.startMonth)}\u2013${getMonthName(def.plantingWindow.endMonth)}`;
        } else if (!canAfford) {
          disabledReason = `Cost: $${def.seedCostPerAcre}. Available: $${Math.floor(cash)}.`;
        }

        const isPerennial = def.type === 'perennial';

        return (
          <div key={cropId}>
            <button
              data-testid={`menu-crop-${cropId}`}
              class={styles.cropOption}
              onClick={() => plantCrop(cropId)}
              disabled={disabled}
              role="option"
              aria-label={disabled
                ? `${def.name} \u2014 $${def.seedCostPerAcre}/plot \u2014 ${disabledReason}`
                : `${def.name} \u2014 $${def.seedCostPerAcre}/plot`
              }
              title={disabled ? disabledReason : def.shortDescription}
            >
              <span class={styles.cropName}>
                {def.name}
                {def.requiredFlag && state.flags[def.requiredFlag] && !state.flags['planted_crop_' + cropId] && (
                  <span data-testid={`crop-new-badge-${cropId}`} class={styles.newBadge}> NEW</span>
                )}
              </span>
              <span class={styles.cropCost}>${def.seedCostPerAcre}/plot</span>
            </button>
            {disabled && (
              <div class={styles.disabledReason}>{disabledReason}</div>
            )}
            {!disabled && isPerennial && def.yearsToEstablish && (
              <div class={styles.perennialWarning}>
                Takes {def.yearsToEstablish} years before first harvest
              </div>
            )}
          </div>
        );
      })}
      <button
        data-testid="menu-cancel"
        class={styles.cancelBtn}
        onClick={() => closeCropMenu()}
      >
        Cancel
      </button>
    </div>
  );
}
