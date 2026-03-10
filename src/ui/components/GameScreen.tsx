import { useEffect } from 'preact/hooks';
import { startGameLoop, stopGameLoop, tutorialStep, gameState, autoPauseQueue, notifications } from '../../adapter/signals.ts';
import { TopBar } from './TopBar.tsx';
import { FarmGrid } from './FarmGrid.tsx';
import { SidePanel } from './SidePanel.tsx';
import { NotificationBar } from './NotificationBar.tsx';
import { AutoPausePanel } from './AutoPausePanel.tsx';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { Tutorial } from './Tutorial.tsx';
import styles from '../styles/GameScreen.module.css';

export function GameScreen() {
  // Start/stop the game loop when this screen mounts/unmounts
  useEffect(() => {
    startGameLoop();
    return () => stopGameLoop();
  }, []);

  const showTutorial = tutorialStep.value >= 0;
  const state = gameState.value;
  const queue = autoPauseQueue.value;
  const blocked = queue.length > 0;
  const blockReason = blocked ? queue[0].reason : undefined;
  const activePanel = blocked
    ? blockReason === 'bankruptcy' ? 'gameover-panel'
    : blockReason === 'year_30' ? 'year30-panel'
    : blockReason === 'loan_offer' ? 'loan-panel'
    : blockReason === 'event' ? 'event-panel'
    : blockReason === 'advisor' ? 'advisor-panel'
    : 'autopause-panel'
    : undefined;

  return (
    <div class={styles.layout}>
      <TopBar />
      <div class={styles.main}>
        <FarmGrid />
        <SidePanel />
      </div>
      <NotificationBar />
      <AutoPausePanel />
      <ConfirmDialog />
      {showTutorial && <Tutorial />}
      {/* Machine-readable state for AI test agents */}
      <div
        data-testid="game-observer"
        data-blocked={blocked ? 'true' : 'false'}
        data-block-reason={blockReason ?? ''}
        data-panel={activePanel ?? ''}
        data-speed={String(state?.speed ?? 0)}
        data-notification-count={String(notifications.value.length)}
        data-year={String(state?.calendar.year ?? 0)}
        data-season={state ? (state.calendar.month >= 3 && state.calendar.month <= 5 ? 'spring' : state.calendar.month >= 6 && state.calendar.month <= 8 ? 'summer' : state.calendar.month >= 9 && state.calendar.month <= 11 ? 'fall' : 'winter') : ''}
        data-day={String(state?.calendar.totalDay ?? 0)}
        style="display:none"
        aria-hidden="true"
      />
    </div>
  );
}
