import { useEffect, useRef } from 'preact/hooks';
import {
  autoPauseQueue, handleDismissAutoPause,
  harvestBulk, waterBulk, returnToTitle,
  gameState, dispatch,
} from '../../adapter/signals.ts';
import type { AutoPauseEvent } from '../../engine/types.ts';
import { STARTING_CASH } from '../../engine/types.ts';
import { buildReflectionData } from '../../engine/game.ts';
import { getCropDefinition } from '../../data/crops.ts';
import { EventPanel } from './EventPanel.tsx';
import styles from '../styles/Overlay.module.css';

export function AutoPausePanel() {
  const queue = autoPauseQueue.value;
  if (queue.length === 0) return null;

  const event = queue[0];

  // Event/advisor auto-pause: render the EventPanel with choices
  if (event.reason === 'event' || event.reason === 'advisor') {
    const state = gameState.value;
    if (state?.activeEvent) {
      return <EventPanel event={state.activeEvent} isAdvisor={event.reason === 'advisor'} />;
    }
    // Fallback: activeEvent already cleared (shouldn't happen, but safe)
    return <AutoPauseOverlay event={event} />;
  }

  return <AutoPauseOverlay event={event} />;
}

function AutoPauseOverlay({ event }: { event: AutoPauseEvent }) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Trap focus in overlay
  useEffect(() => {
    const first = panelRef.current?.querySelector('button') as HTMLElement;
    first?.focus();
  }, [event.reason]);

  const state = gameState.value;

  function handlePrimary() {
    switch (event.reason) {
      case 'harvest_ready':
        harvestBulk('all');
        handleDismissAutoPause();
        break;
      case 'water_stress': {
        const waterResult = waterBulk('all', undefined, { skipConfirm: true });
        if (waterResult !== 'failed') {
          handleDismissAutoPause();
        }
        break;
      }
      case 'year_end':
        handleDismissAutoPause();
        break;
      case 'bankruptcy':
        returnToTitle();
        break;
      case 'year_30':
        returnToTitle();
        break;
      case 'loan_offer':
        dispatch({ type: 'TAKE_LOAN' });
        handleDismissAutoPause();
        break;
      case 'event':
      case 'advisor':
        // Should not reach here — EventPanel handles these reasons.
        // Fallback: dismiss the auto-pause (clears activeEvent via engine).
        handleDismissAutoPause();
        break;
    }
  }

  function handleSecondary() {
    if (event.reason === 'loan_offer') {
      // Declining the loan = game over stays true
      handleDismissAutoPause();
      return;
    }
    handleDismissAutoPause();
  }

  const config = getEventConfig(event, state);

  // Conditional data-testids per SPEC §11 + §14
  const panelTestId =
    event.reason === 'bankruptcy' ? 'gameover-panel' :
    event.reason === 'year_30' ? 'year30-panel' :
    event.reason === 'loan_offer' ? 'loan-panel' :
    event.reason === 'event' ? 'event-panel' :
    event.reason === 'advisor' ? 'advisor-panel' :
    'autopause-panel';

  const primaryTestId =
    event.reason === 'bankruptcy' ? 'gameover-new-game' :
    event.reason === 'year_30' ? 'year30-new-game' :
    event.reason === 'loan_offer' ? 'loan-accept' :
    'autopause-action-primary';

  return (
    <div class={styles.overlay} data-testid={panelTestId} role="alertdialog" aria-label={config.title}>
      <div class={`${styles.panel} ${config.wide ? styles.panelWide : ''}`} ref={panelRef}>
        <h2 class={styles.title}>{config.title}</h2>
        <div class={styles.message}>{event.message}</div>

        {config.summaryData && <YearEndTable data={config.summaryData} />}

        {config.report && (
          <div data-testid="gameover-report" class={styles.report}>{config.report}</div>
        )}
        {config.suggestion && (
          <div class={styles.suggestion}>{config.suggestion}</div>
        )}

        <div class={styles.buttonRow}>
          {config.secondaryLabel && (
            <button
              data-testid="autopause-dismiss"
              class={styles.secondaryBtn}
              onClick={handleSecondary}
            >
              {config.secondaryLabel}
            </button>
          )}
          <button
            data-testid={primaryTestId}
            class={event.reason === 'bankruptcy' ? styles.dangerBtn : styles.primaryBtn}
            onClick={handlePrimary}
          >
            {config.primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface EventConfig {
  title: string;
  primaryLabel: string;
  secondaryLabel?: string;
  wide?: boolean;
  summaryData?: YearEndData;
  report?: string;
  suggestion?: string;
}

interface ExpenseLineItem {
  label: string;
  amount: number;
  testId: string;
}

interface YearEndData {
  revenue: number;
  expenses: number;
  net: number;
  cash: number;
  breakdown?: ExpenseLineItem[];
}

function getEventConfig(event: AutoPauseEvent, state: import('../../engine/types.ts').GameState | null): EventConfig {
  switch (event.reason) {
    case 'harvest_ready':
      return {
        title: 'Harvest Time!',
        primaryLabel: 'Harvest Field',
        secondaryLabel: 'Continue',
      };

    case 'water_stress':
      return {
        title: 'Water Warning',
        primaryLabel: 'Water Field',
        secondaryLabel: 'Continue without watering',
      };

    case 'year_end': {
      const data = event.data as Record<string, unknown> | undefined;
      const breakdown = data?.expenseBreakdown as Record<string, number> | undefined;
      // Canonical expense display order (maps to ExpenseBreakdown fields)
      const expenseCategories: { key: string; label: string; testId: string }[] = [
        { key: 'planting', label: 'Planting', testId: 'expense-line-planting' },
        { key: 'watering', label: 'Watering', testId: 'expense-line-watering' },
        { key: 'harvestLabor', label: 'Harvest labor', testId: 'expense-line-harvestLabor' },
        { key: 'maintenance', label: 'Maintenance', testId: 'expense-line-maintenance' },
        { key: 'coverCrops', label: 'Cover crops', testId: 'expense-line-coverCrops' },
        { key: 'annualOverhead', label: 'Annual overhead', testId: 'expense-line-annualOverhead' },
        { key: 'loanRepayment', label: 'Loan repayment', testId: 'expense-line-loanRepayment' },
        { key: 'eventCosts', label: 'Event costs', testId: 'expense-line-eventCosts' },
        { key: 'removal', label: 'Crop removal', testId: 'expense-line-removal' },
      ];
      const breakdownLines = breakdown
        ? expenseCategories
            .filter(cat => (breakdown[cat.key] ?? 0) > 0)
            .map(cat => ({ label: cat.label, amount: breakdown[cat.key], testId: cat.testId }))
        : undefined;
      return {
        title: `Year ${data?.year ?? '?'} Complete`,
        primaryLabel: `Continue to Year ${((data?.year as number) ?? 0) + 1}`,
        wide: true,
        summaryData: data ? {
          revenue: data.revenue as number,
          expenses: data.expenses as number,
          net: data.netProfit as number,
          cash: data.cash as number,
          breakdown: breakdownLines,
        } : undefined,
      };
    }

    case 'bankruptcy': {
      const suggestion = getSuggestion(state);
      return {
        title: `Game Over \u2014 Your Farm Reached Year ${state?.calendar.year ?? '?'}`,
        primaryLabel: 'Start New Game',
        wide: true,
        report: state ? buildReflectionSummary(state) : undefined,
        suggestion,
      };
    }

    case 'year_30': {
      return {
        title: 'Congratulations!',
        primaryLabel: 'Start New Game',
        wide: true,
        report: state ? buildReflectionSummary(state) : undefined,
      };
    }

    case 'loan_offer': {
      const data = event.data as Record<string, number> | undefined;
      return {
        title: 'Emergency Loan Offer',
        primaryLabel: `Accept Loan ($${(data?.loanAmount ?? 0).toLocaleString()})`,
        secondaryLabel: 'Decline (Game Over)',
      };
    }

    case 'event':
      return {
        title: event.message || 'Event',
        primaryLabel: 'View Details',
        secondaryLabel: 'Dismiss',
      };

    case 'advisor':
      return {
        title: event.message || 'Advisor',
        primaryLabel: 'View Details',
        secondaryLabel: 'Dismiss',
      };

    default:
      return { title: 'Paused', primaryLabel: 'Continue' };
  }
}

function getSuggestion(state: import('../../engine/types.ts').GameState | null): string {
  if (!state) return 'Try a different strategy next time.';

  // Simple heuristic suggestions
  const avgN = state.grid.flat().reduce((sum, c) => sum + c.soil.nitrogen, 0) / 64;
  if (avgN < 30) {
    return 'Tip: Your soil nitrogen was very low. Try rotating crops \u2014 plant winter wheat after tomatoes to give the soil a break.';
  }

  const avgMoisture = state.grid.flat().reduce((sum, c) => sum + c.soil.moisture, 0) / 64;
  if (avgMoisture < 1) {
    return 'Tip: Your crops were very thirsty. Try watering more often during hot summer months.';
  }

  return 'Tip: Consider diversifying your crops and watching your expenses carefully.';
}

function buildReflectionSummary(state: import('../../engine/types.ts').GameState): string {
  const ref = buildReflectionData(state);
  const lines: string[] = [];

  // Financial
  const startCash = STARTING_CASH;
  const finalCash = Math.floor(state.economy.cash);
  lines.push(`Starting cash: $${startCash.toLocaleString()}. Final cash: $${finalCash.toLocaleString()}.`);

  if (ref.financialArc.length > 0) {
    const totalRevenue = ref.financialArc.reduce((sum, y) => sum + y.revenue, 0);
    lines.push(`Total revenue across all years: $${Math.floor(totalRevenue).toLocaleString()}.`);

    const bestYear = ref.financialArc.reduce((best, y) => y.revenue > best.revenue ? y : best);
    if (bestYear.revenue > 0) {
      lines.push(`Best year: Year ${bestYear.year} ($${Math.floor(bestYear.revenue).toLocaleString()} revenue).`);
    }
  }

  // Soil
  const trendText = ref.soilTrend === 'improved' ? 'Soil health improved over the game.'
    : ref.soilTrend === 'declined' ? 'Soil health declined over the game.'
    : 'Soil health was maintained.';
  lines.push(trendText);

  // Decisions
  if (ref.decisions.length > 0) {
    const labels = ref.decisions.map(d => d.label);
    lines.push(`Technologies and events: ${labels.join(', ')}.`);
  }

  // Crop diversity
  if (ref.diversity.uniqueCount > 0) {
    const names = ref.diversity.cropsGrown.map(id => {
      try { return getCropDefinition(id).name; } catch { return id; }
    });
    lines.push(`Crops grown: ${names.join(', ')} (${ref.diversity.uniqueCount} varieties).`);
  }

  return lines.join('\n');
}

function YearEndTable({ data }: { data: YearEndData }) {
  const isProfit = data.net >= 0;

  return (
    <table class={styles.summaryTable} data-testid="year-end-summary">
      <tbody>
        <tr>
          <td>Revenue</td>
          <td class={styles.positive}>${Math.floor(data.revenue).toLocaleString()}</td>
        </tr>
        <tr class={styles.expenseHeader}>
          <td>Expenses</td>
          <td class={styles.negative}>-${Math.floor(data.expenses).toLocaleString()}</td>
        </tr>
        {data.breakdown && data.breakdown.length > 0 && (
          data.breakdown.map(line => (
            <tr key={line.testId} data-testid={line.testId} class={styles.expenseLine}>
              <td class={styles.expenseIndent}>{line.label}</td>
              <td class={styles.expenseAmount}>${Math.floor(line.amount).toLocaleString()}</td>
            </tr>
          ))
        )}
        <tr class={styles.netRow}>
          <td>Net {isProfit ? 'Profit' : 'Loss'}</td>
          <td class={isProfit ? styles.positive : styles.negative}>
            {isProfit ? '+' : '-'}${Math.floor(Math.abs(data.net)).toLocaleString()}
          </td>
        </tr>
        <tr>
          <td>Cash Balance (before loan)</td>
          <td>${Math.floor(data.cash).toLocaleString()}</td>
        </tr>
      </tbody>
    </table>
  );
}
