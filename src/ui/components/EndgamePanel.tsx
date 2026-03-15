import { useEffect, useRef, useState } from 'preact/hooks';
import type { GameState } from '../../engine/types.ts';
import { STARTING_CASH } from '../../engine/types.ts';
import { buildReflectionData } from '../../engine/game.ts';
import { getCropDefinition, CROPS } from '../../data/crops.ts';
import {
  computeScore,
  generateEpilogue,
  generateCategoryHints,
  generateAdvisorFarewells,
  estimateHumanFoodServings,
} from '../../engine/scoring.ts';
import type { ScoreResult } from '../../engine/scoring.ts';
import { getSession, renderSignInButton, submitGameResult } from '../../auth.ts';
import type { SubmissionPayload } from '../../auth.ts';
import styles from '../styles/Overlay.module.css';

const ADVISOR_PORTRAITS: Record<string, string> = {
  'extension-agent': `${import.meta.env.BASE_URL}assets/advisors/extension-agent_128x128.jpeg`,
  'farm-credit': `${import.meta.env.BASE_URL}assets/advisors/farm-credit_128x128.jpeg`,
  'weather-service': `${import.meta.env.BASE_URL}assets/advisors/weather-service_128x128.jpeg`,
  'growers-forum': `${import.meta.env.BASE_URL}assets/advisors/growers-forum_128x128.jpeg`,
};

const TIER_ART: Record<string, string> = {
  Thriving: 'endgame-thriving_600x300.jpeg',
  Stable: 'endgame-stable_600x300.jpeg',
  Struggling: 'endgame-struggling_600x300.jpeg',
  Failed: 'endgame-failed_600x300.jpeg',
};

interface EndgamePanelProps {
  state: GameState;
}

export function EndgamePanel({ state }: EndgamePanelProps) {
  const scoreResult = computeScore(state);
  const epilogue = generateEpilogue(scoreResult, state);
  const hints = generateCategoryHints(scoreResult, state);
  const farewells = generateAdvisorFarewells(scoreResult, state);
  const foodServings = estimateHumanFoodServings(state);
  const reflectionSummary = buildReflectionSummary(state);

  const artFile = TIER_ART[scoreResult.tier];

  return (
    <div data-testid="score-panel">
      {/* 1. Endgame Art */}
      {artFile && (
        <img
          class={styles.endgameArt}
          src={`${import.meta.env.BASE_URL}assets/ui/${artFile}`}
          alt=""
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}

      {/* 2. Epilogue */}
      <div class={styles.epilogueSection} data-testid="endgame-epilogue">
        <h3 class={styles.epilogueHeadline}>{epilogue.headline}</h3>
        <p>{epilogue.narrative}</p>
        <p>{epilogue.bridge}</p>
      </div>

      {/* 3. Food Servings Callout */}
      <FoodServingsCallout servings={foodServings} grewFeedCrops={grewFeedCrops(state)} />

      {/* 4. Tier Badge */}
      <TierBadge scoreResult={scoreResult} />

      {/* 5. Score Table */}
      <ScoreTable scoreResult={scoreResult} />

      {/* 6. Improvement Hints */}
      {hints.length > 0 && (
        <div class={styles.hintsSection} data-testid="endgame-hints">
          <h4>What could help next time</h4>
          <ul>
            {hints.map(h => (
              <li key={h.categoryId}>
                <strong>{h.label}:</strong> {h.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 7. Advisor Farewells */}
      {farewells.length > 0 && (
        <div class={styles.farewellSection}>
          {farewells.map(f => (
            <div key={f.advisorId} class={styles.farewellCard}>
              <img
                class={styles.farewellPortrait}
                src={ADVISOR_PORTRAITS[f.advisorId] ?? ''}
                alt=""
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div>
                <div class={styles.farewellName}>{f.name}</div>
                <div class={styles.farewellMessage}>{f.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 8. Farm History (reflection summary) */}
      <div data-testid="gameover-report" class={styles.report}>
        {reflectionSummary}
      </div>

      {/* 9. Completion Code + Submission */}
      <CompletionSection scoreResult={scoreResult} state={state} />
    </div>
  );
}

// --- Sub-components ---

function FoodServingsCallout({ servings, grewFeedCrops }: { servings: number; grewFeedCrops: boolean }) {
  return (
    <div class={styles.foodServingsCallout} data-testid="food-servings-callout">
      <div class={styles.foodServingsHeading}>Estimated Food-Production Potential</div>
      {servings > 0 ? (
        <>
          <div class={styles.foodServingsBigNumber}>
            ~{servings.toLocaleString()} servings
          </div>
          <div class={styles.foodServingsSubline}>
            A rough estimate based on the crops your farm grew. Livestock feed crops like silage corn count at ~10% efficiency (energy pyramid). Actual production depends on growing conditions.
          </div>
        </>
      ) : grewFeedCrops ? (
        <div class={styles.foodServingsSubline}>
          Your farm grew livestock feed crops. Feed supports the food system indirectly — but the energy pyramid means most of that energy doesn't reach people as food.
        </div>
      ) : (
        <div class={styles.foodServingsSubline}>
          No crop production data available. Every season is a chance to plant something new.
        </div>
      )}
    </div>
  );
}

function TierBadge({ scoreResult }: { scoreResult: ScoreResult }) {
  const tierClass = scoreResult.tier === 'Thriving' ? styles.tierThriving
    : scoreResult.tier === 'Stable' ? styles.tierStable
      : scoreResult.tier === 'Struggling' ? styles.tierStruggling
        : styles.tierFailed;

  return (
    <div class={`${styles.tierBadge} ${tierClass}`}>
      Farm Resilience: {scoreResult.tier}
    </div>
  );
}

function ScoreTable({ scoreResult }: { scoreResult: ScoreResult }) {
  return (
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
  );
}

function CompletionSection({ scoreResult, state }: { scoreResult: ScoreResult; state: GameState }) {
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

  return (
    <>
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
    </>
  );
}

// --- Helpers ---

function buildReflectionSummary(state: GameState): string {
  const ref = buildReflectionData(state);
  const lines: string[] = [];

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

  const trendText = ref.soilTrend === 'improved' ? 'Soil health improved over the game.'
    : ref.soilTrend === 'declined' ? 'Soil health declined over the game.'
    : 'Soil health was maintained.';
  lines.push(trendText);

  if (ref.decisions.length > 0) {
    const labels = ref.decisions.map(d => d.label);
    lines.push(`Technologies and events: ${labels.join(', ')}.`);
  }

  if (ref.diversity.uniqueCount > 0) {
    const names = ref.diversity.cropsGrown.map(id => {
      try { return getCropDefinition(id).name; } catch { return id; }
    });
    lines.push(`Crops grown: ${names.join(', ')} (${ref.diversity.uniqueCount} varieties).`);
  }

  return lines.join('\n');
}

/** Did the player grow any feed-only crops (humanServingsPerUnit === 0)? */
function grewFeedCrops(state: GameState): boolean {
  for (const snap of state.tracking.yearSnapshots) {
    for (const [cropId, count] of Object.entries(snap.cropCounts)) {
      if (count > 0) {
        const crop = CROPS[cropId];
        if (crop && (crop.humanServingsPerUnit === 0 || crop.humanServingsPerUnit === undefined)) {
          return true;
        }
      }
    }
  }
  return false;
}
