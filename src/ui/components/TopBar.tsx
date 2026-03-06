import { useRef, useEffect } from 'preact/hooks';
import { gameState, currentWeather, dispatch, handleSave, returnToTitle, getActiveScenarioName, confirmDialog, needsPlayPrompt } from '../../adapter/signals.ts';
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

  const speedButtons: { speed: GameSpeed; label: string; testId: string; ariaLabel: string }[] = [
    { speed: 0, label: '\u23F8', testId: 'speed-pause', ariaLabel: `Pause \u2014 currently ${speed === 0 ? 'paused' : `playing at ${speed}x speed`}` },
    { speed: 1, label: '\u25B6', testId: 'speed-play', ariaLabel: `Play 1x \u2014 currently ${speed === 0 ? 'paused' : `playing at ${speed}x speed`}` },
    { speed: 2, label: '\u25B6\u25B6', testId: 'speed-fast', ariaLabel: `Fast 2x \u2014 currently ${speed === 0 ? 'paused' : `playing at ${speed}x speed`}` },
    { speed: 4, label: '\u25B6\u25B6\u25B6', testId: 'speed-fastest', ariaLabel: `Fastest 4x \u2014 currently ${speed === 0 ? 'paused' : `playing at ${speed}x speed`}` },
  ];

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
          <span data-testid="topbar-date" aria-label={`${getMonthName(calendar.month)} Year ${calendar.year}, ${getSeasonName(calendar.season)}`}>
            {getSeasonName(calendar.season)} &mdash; {getMonthName(calendar.month)}, Year {calendar.year}
          </span>
          <span class={styles.scenarioName} data-testid="scenario-name" aria-label={`Scenario: ${getActiveScenarioName()}`}>
            {getActiveScenarioName()}
          </span>
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
          {speedButtons.map(btn => (
            <button
              key={btn.testId}
              data-testid={btn.testId}
              class={`${styles.speedBtn} ${speed === btn.speed ? styles.speedBtnActive : ''}`}
              onClick={() => setSpeed(btn.speed)}
              aria-label={btn.ariaLabel}
              aria-pressed={speed === btn.speed}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {needsPlayPrompt.value && speed === 0 && (
          <span data-testid="play-prompt" class={styles.playPrompt}>
            Press Play to continue
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
