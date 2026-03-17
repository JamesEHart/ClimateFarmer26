import { useRef, useEffect, useState } from 'preact/hooks';
import { gameState, currentWeather, dispatch, handleSave, returnToTitle, confirmDialog, needsPlayPrompt, plantingPausePrefs, setPlantingPausePrefs, togglePlayPause } from '../../adapter/signals.ts';
import { getSeasonName, getMonthName } from '../../engine/calendar.ts';
import type { GameSpeed, DailyWeather } from '../../engine/types.ts';
import styles from '../styles/TopBar.module.css';

const SEASON_ICONS: Record<string, string> = {
  spring: '\u{1F331}',  // seedling
  summer: '\u{2600}\u{FE0F}',    // sun
  fall: '\u{1F342}',    // fallen leaf
  winter: '\u{2744}\u{FE0F}',    // snowflake
};

function getWeatherDisplay(weather: DailyWeather | null): { icon: string; text: string } {
  if (!weather) return { icon: '', text: '' };

  if (weather.isHeatwave) return { icon: '\u{1F525}', text: `${Math.round(weather.tempHigh)}\u00B0F Heat!` };
  if (weather.isFrost) return { icon: '\u{1F9CA}', text: `${Math.round(weather.tempLow)}\u00B0F Frost` };
  if (weather.precipitation > 0) return { icon: '\u{1F327}\u{FE0F}', text: `${Math.round(weather.tempHigh)}\u00B0F Rain` };
  if (weather.tempHigh > 100) return { icon: '\u{1F321}\u{FE0F}', text: `${Math.round(weather.tempHigh)}\u00B0F Hot` };
  return { icon: '\u{26C5}', text: `${Math.round(weather.tempHigh)}\u00B0F` };
}

export function TopBar() {
  const state = gameState.value;
  if (!state) return null;

  const { calendar, speed, economy } = state;
  const weather = currentWeather.value;
  const weatherDisplay = getWeatherDisplay(weather);
  const prevCashRef = useRef(economy.cash);
  const cashRef = useRef<HTMLSpanElement>(null);

  // Cash flash animation
  useEffect(() => {
    const prev = prevCashRef.current;
    if (prev !== economy.cash && cashRef.current) {
      const cls = economy.cash > prev ? styles.cashUp : styles.cashDown;
      cashRef.current.classList.add(cls);
      const timer = setTimeout(() => cashRef.current?.classList.remove(cls), 600);
      prevCashRef.current = economy.cash;
      return () => clearTimeout(timer);
    }
  }, [economy.cash]);

  function setSpeed(s: GameSpeed) {
    dispatch({ type: 'SET_SPEED', speed: s });
  }

  const isPaused = speed === 0;
  const statusText = isPaused ? 'paused' : `playing at ${speed}x speed`;

  return (
    <header class={styles.topbar} role="banner">
      <div class={styles.leftGroup}>
        <div class={styles.dateSection}>
          <span
            class={styles.seasonIcon}
            data-testid="topbar-season-icon"
            aria-hidden="true"
          >
            {SEASON_ICONS[calendar.season] ?? ''}
          </span>
          <span class={styles.dateText} data-testid="topbar-date" aria-label={`${getMonthName(calendar.month)} Year ${calendar.year}, ${getSeasonName(calendar.season)}`}>
            {getSeasonName(calendar.season)} &mdash; {getMonthName(calendar.month)}, Year {calendar.year}
          </span>
          {/* Scenario name hidden during gameplay — shown in endgame panel for post-mortem discussion */}
        </div>

        {weather && (
          <div class={styles.weatherSection} aria-label={`Weather: ${weatherDisplay.text}`}>
            <span class={styles.weatherIcon} aria-hidden="true">{weatherDisplay.icon}</span>
            <span>{weatherDisplay.text}</span>
          </div>
        )}
      </div>

      <div class={styles.centerGroup}>
        <div class={styles.speedControls} role="group" aria-label="Simulation speed controls">
          <button
            data-testid="speed-toggle"
            class={`${styles.speedBtn} ${styles.speedBtnToggle} ${isPaused ? '' : styles.speedBtnActive}`}
            onClick={togglePlayPause}
            aria-label={isPaused ? `Play \u2014 currently ${statusText}` : `Pause \u2014 currently ${statusText}`}
            aria-pressed={!isPaused}
          >
            {isPaused ? '\u25B6' : '\u23F8'}
          </button>
          <button
            data-testid="speed-fast"
            class={`${styles.speedBtn} ${speed === 2 ? styles.speedBtnActive : ''}`}
            onClick={() => setSpeed(2)}
            aria-label={`Fast 2x \u2014 currently ${statusText}`}
            aria-pressed={speed === 2}
          >
            {'\u25B6\u25B6'}
          </button>
          <button
            data-testid="speed-fastest"
            class={`${styles.speedBtn} ${speed === 4 ? styles.speedBtnActive : ''}`}
            onClick={() => setSpeed(4)}
            aria-label={`Fastest 4x \u2014 currently ${statusText}`}
            aria-pressed={speed === 4}
          >
            {'\u25B6\u25B6\u25B6'}
          </button>
        </div>

        {needsPlayPrompt.value && speed === 0 && state.autoPauseQueue.length === 0 && (
          <span data-testid="play-prompt" class={styles.playPrompt}>
            Game paused. Press Play to continue.
          </span>
        )}
      </div>

      <div class={styles.rightGroup}>
        <span
          ref={cashRef}
          class={styles.cashSection}
          data-testid="topbar-cash"
          aria-label={`Cash: $${Math.floor(economy.cash).toLocaleString()}`}
        >
          ${Math.floor(economy.cash).toLocaleString()}
        </span>

        {(() => {
          const net = economy.yearlyRevenue - economy.yearlyExpenses;
          return (
            <span
              data-testid="topbar-year-net"
              class={net >= 0 ? styles.netPositive : styles.netNegative}
              aria-label={`Year net: ${net >= 0 ? '+' : ''}$${Math.floor(net).toLocaleString()}`}
            >
              Year net: {net >= 0 ? '+' : '-'}${Math.floor(Math.abs(net)).toLocaleString()}
            </span>
          );
        })()}

        {state.frostProtectionEndsDay > state.calendar.totalDay && (
          <span
            class={styles.frostStatus}
            data-testid="frost-protection-status"
            aria-label={`Frost protection active: ${state.frostProtectionEndsDay - state.calendar.totalDay} days remaining`}
          >
            {'\u{1F9CA}'} Frost Protection ({state.frostProtectionEndsDay - state.calendar.totalDay}d)
          </span>
        )}

        {economy.debt > 0 && (
          <span
            class={styles.debtSection}
            data-testid="topbar-debt"
            aria-label={`Debt: $${Math.floor(economy.debt).toLocaleString()}`}
          >
            Debt: ${Math.floor(economy.debt).toLocaleString()}
          </span>
        )}

        <SettingsGear />

        <button
          data-testid="save-button"
          class={styles.saveBtn}
          onClick={() => handleSave()}
          aria-label="Save game"
        >
          Save
        </button>

        <button
          data-testid="save-new-game"
          class={styles.newGameBtn}
          onClick={() => {
            confirmDialog.value = {
              message: 'Return to title screen? Your game is auto-saved at each season boundary.',
              onConfirm: () => { confirmDialog.value = null; returnToTitle(); },
              onCancel: () => { confirmDialog.value = null; },
              actionId: 'return-to-title',
              origin: 'manual',
            };
          }}
          aria-label="Return to title screen"
        >
          New Game
        </button>
      </div>
    </header>
  );
}

function SettingsGear() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} class={styles.settingsWrapper}>
      <button
        data-testid="settings-gear"
        class={styles.settingsBtn}
        onClick={() => setOpen(!open)}
        aria-label="Game settings"
        aria-expanded={open}
      >
        {'\u2699\uFE0F'}
      </button>
      {open && (
        <div class={styles.settingsDropdown} data-testid="settings-dropdown">
          <div class={styles.settingsGroup}>
            <label class={styles.settingsOption}>
              <input
                type="checkbox"
                data-testid="setting-pause-all"
                checked={plantingPausePrefs.value.all}
                onChange={(e) => {
                  const checked = (e.target as HTMLInputElement).checked;
                  if (checked) {
                    setPlantingPausePrefs({ all: true, warmSeason: true, sorghum: true, winterWheat: true, coverCrops: true });
                  } else {
                    setPlantingPausePrefs({ ...plantingPausePrefs.value, all: false });
                  }
                }}
              />
              All planting windows
            </label>
            <label class={`${styles.settingsOption} ${styles.settingsIndent}`}>
              <input
                type="checkbox"
                data-testid="setting-pause-warm-season"
                checked={plantingPausePrefs.value.warmSeason}
                onChange={(e) => setPlantingPausePrefs({ ...plantingPausePrefs.value, warmSeason: (e.target as HTMLInputElement).checked, all: false })}
              />
              Pause for tomato/corn planting
            </label>
            <label class={`${styles.settingsOption} ${styles.settingsIndent}`}>
              <input
                type="checkbox"
                data-testid="setting-pause-sorghum"
                checked={plantingPausePrefs.value.sorghum}
                onChange={(e) => setPlantingPausePrefs({ ...plantingPausePrefs.value, sorghum: (e.target as HTMLInputElement).checked, all: false })}
              />
              Pause for sorghum planting
            </label>
            <label class={`${styles.settingsOption} ${styles.settingsIndent}`}>
              <input
                type="checkbox"
                data-testid="setting-pause-winter-wheat"
                checked={plantingPausePrefs.value.winterWheat}
                onChange={(e) => setPlantingPausePrefs({ ...plantingPausePrefs.value, winterWheat: (e.target as HTMLInputElement).checked, all: false })}
              />
              Pause for winter wheat planting
            </label>
            <label class={`${styles.settingsOption} ${styles.settingsIndent}`}>
              <input
                type="checkbox"
                data-testid="setting-pause-cover-crops"
                checked={plantingPausePrefs.value.coverCrops}
                onChange={(e) => setPlantingPausePrefs({ ...plantingPausePrefs.value, coverCrops: (e.target as HTMLInputElement).checked, all: false })}
              />
              Pause for cover crop planting
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
