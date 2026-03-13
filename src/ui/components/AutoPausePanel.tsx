import { useEffect, useRef, useState } from 'preact/hooks';
import {
  autoPauseQueue, handleDismissAutoPause, declineLoan,
  harvestBulk, waterBulk, returnToTitle,
  gameState, dispatch, pendingFollowUp,
} from '../../adapter/signals.ts';
import type { AutoPauseEvent, GameState } from '../../engine/types.ts';
import { STARTING_CASH } from '../../engine/types.ts';
import { buildReflectionData } from '../../engine/game.ts';
import { getCropDefinition } from '../../data/crops.ts';
import { EventPanel } from './EventPanel.tsx';
import styles from '../styles/Overlay.module.css';
import { computeScore } from '../../engine/scoring.ts';
import type { ScoreResult } from '../../engine/scoring.ts';
import { getSession, renderSignInButton, submitGameResult } from '../../auth.ts';
import type { SubmissionPayload } from '../../auth.ts';

export function AutoPausePanel() {
  const queue = autoPauseQueue.value;
  if (queue.length === 0) return null;

  const event = queue[0];

  // Event/advisor auto-pause: render the EventPanel with choices
  // Also stay on EventPanel during follow-up beat (activeEvent is cleared but follow-up is pending)
  if (event.reason === 'event' || event.reason === 'advisor') {
    const state = gameState.value;
    if (state?.activeEvent || pendingFollowUp.value) {
      return <EventPanel event={state?.activeEvent ?? null} isAdvisor={event.reason === 'advisor'} />;
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
      case 'planting_options':
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
      // Declining the loan — show bankruptcy reflection before title (#88)
      declineLoan();
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

        {config.scoreResult && state && (
          <ScorePanel scoreResult={config.scoreResult} state={state} />
        )}

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
  scoreResult?: ScoreResult;
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
  hasLoans?: boolean;
  insurancePayouts?: number;
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
        { key: 'insurance', label: 'Crop insurance', testId: 'expense-line-insurance' },
        { key: 'organicCertification', label: 'Organic certification', testId: 'expense-line-organic' },
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
          hasLoans: (state?.economy.totalLoansReceived ?? 0) > 0,
          insurancePayouts: breakdown?.insurancePayouts as number | undefined,
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
        scoreResult: state ? computeScore(state) : undefined,
      };
    }

    case 'year_30': {
      return {
        title: 'Congratulations!',
        primaryLabel: 'Start New Game',
        wide: true,
        report: state ? buildReflectionSummary(state) : undefined,
        scoreResult: state ? computeScore(state) : undefined,
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

    case 'planting_options':
      return {
        title: 'Planting Window',
        primaryLabel: 'Continue',
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
        {(data.insurancePayouts ?? 0) > 0 && (
          <tr data-testid="income-line-insurance-payouts">
            <td>Insurance payouts</td>
            <td class={styles.positive}>+${Math.floor(data.insurancePayouts!).toLocaleString()}</td>
          </tr>
        )}
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
          <td>{data.hasLoans ? 'Cash Balance (before loan)' : 'Cash Balance'}</td>
          <td>${Math.floor(data.cash).toLocaleString()}</td>
        </tr>
      </tbody>
    </table>
  );
}

function ScorePanel({ scoreResult, state }: { scoreResult: ScoreResult; state: GameState }) {
  const [subState, setSubState] = useState<'idle' | 'signed_in' | 'submitting' | 'success' | 'error'>(
    () => getSession() ? 'signed_in' : 'idle',
  );
  const [receipt, setReceipt] = useState<{ receiptId: string; email: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [gisError, setGisError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const signinRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (subState !== 'idle' || !signinRef.current || gisError) return;
    renderSignInButton(
      signinRef.current,
      () => setSubState('signed_in'),
      (msg) => setGisError(msg),
    );
  }, [subState, gisError]);

  async function handleSubmit() {
    const session = getSession();
    if (!session) {
      setSubState('idle');
      return;
    }
    setSubState('submitting');
    const payload: SubmissionPayload = {
      id_token: session.idToken,
      player_id: state.playerId,
      scenario_id: state.scenarioId,
      score: Math.round(scoreResult.total),
      tier: scoreResult.tier.toLowerCase(),
      years_completed: scoreResult.yearsSurvived,
      final_cash: Math.round(state.economy.cash),
      completion_code: scoreResult.completionCode,
      curated_seed: state.curatedSeed ?? 0,
      components: {
        financial: scoreResult.components.find(c => c.id === 'financial')!.weighted,
        soil: scoreResult.components.find(c => c.id === 'soil')!.weighted,
        diversity: scoreResult.components.find(c => c.id === 'diversity')!.weighted,
        adaptation: scoreResult.components.find(c => c.id === 'adaptation')!.weighted,
        consistency: scoreResult.components.find(c => c.id === 'consistency')!.weighted,
      },
    };
    const result = await submitGameResult(payload);
    if (result.success) {
      setReceipt({ receiptId: result.receipt_id!, email: result.email! });
      setSubState('success');
    } else {
      setSubmitError(result.error ?? 'Unknown error');
      setSubState('error');
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(scoreResult.completionCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const tierClass = scoreResult.tier === 'Thriving' ? styles.tierThriving
    : scoreResult.tier === 'Stable' ? styles.tierStable
      : scoreResult.tier === 'Struggling' ? styles.tierStruggling
        : styles.tierFailed;

  return (
    <div class={styles.scorePanel} data-testid="score-panel">
      <div class={`${styles.tierBadge} ${tierClass}`}>
        Farm Resilience: {scoreResult.tier}
      </div>

      <table class={styles.scoreTable}>
        <tbody>
          {scoreResult.components.map(c => (
            <tr key={c.id}>
              <td>
                <div class={styles.scoreLabel}>{c.label}</div>
                <div class={styles.scoreExplanation}>{c.explanation}</div>
              </td>
              <td class={styles.scoreValue} data-testid={`score-${c.id}`}>
                {c.weighted}<span class={styles.scoreMax}>/{Math.round(c.weight * 100)}</span>
              </td>
            </tr>
          ))}
          <tr class={styles.scoreTotalRow}>
            <td>Total Score</td>
            <td class={styles.scoreValue} data-testid="score-total">
              {scoreResult.total}<span class={styles.scoreMax}>/100</span>
            </td>
          </tr>
        </tbody>
      </table>

      <div class={styles.completionCodeBox}>
        <span class={styles.completionCodeLabel}>Completion Code:</span>
        <code class={styles.completionCode} data-testid="completion-code">
          {scoreResult.completionCode}
        </code>
        <button class={styles.copyBtn} data-testid="completion-copy" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <div class={styles.submissionArea} data-testid="submit-signin-container">
        {subState === 'idle' && (
          <>
            <p class={styles.submissionPrompt}>
              d.tech students: Sign in with your school Google account to submit results
            </p>
            <p class={styles.mutedNote}>Score submission is for d.tech HS students only</p>
            {gisError ? (
              <p class={styles.submissionError}>{gisError}</p>
            ) : (
              <div ref={signinRef} class={styles.signinContainer} />
            )}
          </>
        )}
        {subState === 'signed_in' && (
          <>
            <p class={styles.submissionPrompt}>Signed in as {getSession()?.email}</p>
            <button class={styles.primaryBtn} data-testid="submit-button" onClick={handleSubmit}>
              Submit Results
            </button>
          </>
        )}
        {subState === 'submitting' && (
          <p class={styles.submissionPrompt}>Submitting results...</p>
        )}
        {subState === 'success' && receipt && (
          <div data-testid="submit-receipt">
            <p class={styles.submissionSuccess}>Results submitted! Receipt: {receipt.receiptId}</p>
            <p class={styles.mutedNote}>Submitted as: {receipt.email}</p>
          </div>
        )}
        {subState === 'error' && (
          <div data-testid="submit-error">
            <p class={styles.submissionError}>
              Submission failed: {submitError}. Your completion code is saved above.
            </p>
            <button class={styles.secondaryBtn} onClick={handleSubmit}>Retry</button>
          </div>
        )}
      </div>
    </div>
  );
}
