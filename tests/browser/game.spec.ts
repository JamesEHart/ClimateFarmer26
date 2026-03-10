import { test, expect, type Page } from '@playwright/test';

// Helper: Start a new game with a given player ID
async function startNewGame(page: Page, playerId = 'TestPlayer') {
  await page.goto('/');
  await page.getByTestId('newgame-player-id').fill(playerId);
  await page.getByTestId('newgame-start').click();
  // Dismiss tutorial if it appears
  const tutorialSkip = page.getByTestId('tutorial-skip');
  if (await tutorialSkip.isVisible({ timeout: 500 }).catch(() => false)) {
    await tutorialSkip.click();
  }
}

// Helper: Wait for game screen to be ready
async function waitForGameScreen(page: Page) {
  await expect(page.getByTestId('farm-grid')).toBeVisible();
  await expect(page.getByTestId('topbar-cash')).toBeVisible();
}

/**
 * Helper: Dismiss non-target auto-pauses and keep the game running
 * until the target testid appears or timeout.
 *
 * Handles: generic auto-pauses (dismiss secondary), event panels (pick first choice),
 * loan offers (accept), and game over (throws).
 */
async function dismissAutoPausesUntil(page: Page, targetTestId: string, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    // Target found?
    if (await page.getByTestId(targetTestId).isVisible().catch(() => false)) return;

    // Handle game over — bail out
    for (const id of ['gameover-panel', 'year30-panel']) {
      if (await page.getByTestId(id).isVisible().catch(() => false)) {
        throw new Error(`Game ended (${id}) before ${targetTestId} appeared`);
      }
    }

    // Dismiss generic auto-pauses via secondary (cheaper) or primary button
    const dismissBtn = page.getByTestId('autopause-dismiss');
    if (await dismissBtn.isVisible().catch(() => false)) {
      await dismissBtn.click();
      await page.getByTestId('speed-fastest').click().catch(() => {});
      await page.waitForTimeout(50);
      continue;
    }
    const primaryBtn = page.getByTestId('autopause-action-primary');
    if (await primaryBtn.isVisible().catch(() => false)) {
      await primaryBtn.click();
      await page.getByTestId('speed-fastest').click().catch(() => {});
      await page.waitForTimeout(50);
      continue;
    }

    // Handle non-target event panels (pick first choice to dismiss)
    if (targetTestId !== 'event-panel') {
      const firstEventChoice = page.locator('[data-testid^="event-choice-"]').first();
      if (await firstEventChoice.isVisible().catch(() => false)) {
        await firstEventChoice.click();
        await page.getByTestId('speed-fastest').click().catch(() => {});
        await page.waitForTimeout(50);
        continue;
      }
    }

    // Handle non-target advisor panels (pick first choice to dismiss)
    if (targetTestId !== 'advisor-panel') {
      const firstAdvisorChoice = page.locator('[data-testid^="advisor-choice-"]').first();
      if (await firstAdvisorChoice.isVisible().catch(() => false)) {
        await firstAdvisorChoice.click();
        await page.getByTestId('speed-fastest').click().catch(() => {});
        await page.waitForTimeout(50);
        continue;
      }
    }

    // Handle loan offer (accept to keep playing)
    if (targetTestId !== 'loan-panel') {
      const loanAccept = page.getByTestId('loan-accept');
      if (await loanAccept.isVisible().catch(() => false)) {
        await loanAccept.click();
        await page.getByTestId('speed-fastest').click().catch(() => {});
        await page.waitForTimeout(50);
        continue;
      }
    }

    // Ensure still running at max speed
    await page.getByTestId('speed-fastest').click().catch(() => {});
    await page.waitForTimeout(100);
  }

  throw new Error(`Timeout (${timeoutMs}ms) waiting for ${targetTestId}`);
}

// ==========================================================================
// §1 — New Game & Main Screen
// ==========================================================================

test.describe('New Game & Main Screen', () => {
  test('shows new game screen on first load', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('newgame-player-id')).toBeVisible();
    await expect(page.getByTestId('newgame-start')).toBeVisible();
  });

  test('starts game with player ID', async ({ page }) => {
    await startNewGame(page, 'P3-14');
    await waitForGameScreen(page);

    // SPEC §1.1: should see farm field, top bar, side panel
    await expect(page.getByTestId('farm-grid')).toBeVisible();
    await expect(page.getByTestId('topbar-date')).toBeVisible();
    await expect(page.getByTestId('topbar-cash')).toBeVisible();

    // SPEC §1.1: "Spring — Year 1" and "$50,000"
    await expect(page.getByTestId('topbar-date')).toContainText('Year 1');
    await expect(page.getByTestId('topbar-date')).toContainText('Spring');
    await expect(page.getByTestId('topbar-cash')).toContainText('50,000');

    // SPEC §1.1: paused on start
    await expect(page.getByTestId('speed-pause')).toHaveAttribute('aria-pressed', 'true');
  });

  test('rejects empty player ID', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('newgame-start').click();
    // Should still be on new game screen
    await expect(page.getByTestId('newgame-player-id')).toBeVisible();
  });

  test('allows special characters in player ID', async ({ page }) => {
    await startNewGame(page, 'P3-14 Team Blue!');
    await waitForGameScreen(page);
  });

  test('truncates long player ID to 30 chars', async ({ page }) => {
    await page.goto('/');
    const longId = 'A'.repeat(50);
    await page.getByTestId('newgame-player-id').fill(longId);
    const value = await page.getByTestId('newgame-player-id').inputValue();
    expect(value.length).toBeLessThanOrEqual(30);
  });

  test('all 64 farm cells are present', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        await expect(page.getByTestId(`farm-cell-${r}-${c}`)).toBeVisible();
      }
    }
  });
});

// ==========================================================================
// §1.3 — Tutorial
// ==========================================================================

test.describe('Tutorial', () => {
  test('shows tutorial on first launch', async ({ page }) => {
    // Clear tutorial dismissal
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('climateFarmer_tutorialDismissed'));
    await page.reload();

    await page.getByTestId('newgame-player-id').fill('TutorialTest');
    await page.getByTestId('newgame-start').click();

    await expect(page.getByTestId('tutorial-overlay')).toBeVisible();
    await expect(page.getByTestId('tutorial-step')).toBeVisible();
    await expect(page.getByTestId('tutorial-next')).toBeVisible();
    await expect(page.getByTestId('tutorial-skip')).toBeVisible();
  });

  test('can skip tutorial', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('climateFarmer_tutorialDismissed'));
    await page.reload();

    await page.getByTestId('newgame-player-id').fill('SkipTest');
    await page.getByTestId('newgame-start').click();

    await page.getByTestId('tutorial-skip').click();
    await expect(page.getByTestId('tutorial-overlay')).not.toBeVisible();
  });

  test('can advance through all 3 steps', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('climateFarmer_tutorialDismissed'));
    await page.reload();

    await page.getByTestId('newgame-player-id').fill('StepTest');
    await page.getByTestId('newgame-start').click();

    // Step 1
    await expect(page.getByTestId('tutorial-step')).toContainText('Select a Plot');
    await page.getByTestId('tutorial-next').click();

    // Step 2
    await expect(page.getByTestId('tutorial-step')).toContainText('Plant a Crop');
    await page.getByTestId('tutorial-next').click();

    // Step 3
    await expect(page.getByTestId('tutorial-step')).toContainText('Start Time');
    await page.getByTestId('tutorial-next').click();

    // Tutorial done
    await expect(page.getByTestId('tutorial-overlay')).not.toBeVisible();
  });

  test('dont-show-again checkbox persists', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('climateFarmer_tutorialDismissed'));
    await page.reload();

    await page.getByTestId('newgame-player-id').fill('DontShowTest');
    await page.getByTestId('newgame-start').click();

    await page.getByTestId('tutorial-dont-show').check();
    await page.getByTestId('tutorial-skip').click();

    // Verify localStorage was set
    const dismissed = await page.evaluate(() => localStorage.getItem('climateFarmer_tutorialDismissed'));
    expect(dismissed).toBe('true');
  });
});

// ==========================================================================
// §2 — Farm Grid Interactions
// ==========================================================================

test.describe('Farm Grid Interactions', () => {
  test('clicking a cell selects it and shows details', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await page.getByTestId('farm-cell-3-4').click();
    await expect(page.getByTestId('sidebar-cell-detail')).toBeVisible();
    await expect(page.getByTestId('sidebar-crop-name')).toContainText('Empty');
    await expect(page.getByTestId('sidebar-soil-n')).toBeVisible();
    await expect(page.getByTestId('sidebar-soil-moisture')).toBeVisible();
    await expect(page.getByTestId('sidebar-soil-om')).toBeVisible();
  });

  test('clicking different cell moves selection', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await page.getByTestId('farm-cell-0-0').click();
    await expect(page.getByTestId('sidebar-cell-detail')).toBeVisible();

    await page.getByTestId('farm-cell-5-5').click();
    // Still showing detail for the new cell
    await expect(page.getByTestId('sidebar-cell-detail')).toBeVisible();
  });

  test('clicking selected cell deselects it', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await page.getByTestId('farm-cell-2-2').click();
    await expect(page.getByTestId('sidebar-cell-detail')).toBeVisible();

    // Click again to deselect
    await page.getByTestId('farm-cell-2-2').click();
    await expect(page.getByTestId('sidebar-cell-detail')).not.toBeVisible();
  });

  test('can plant a crop on an empty plot', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-processing-tomatoes').click();

    // Crop should now show in the cell
    await expect(page.getByTestId('sidebar-crop-name')).toContainText('Processing Tomatoes');
    // Cash should decrease
    const cash = await page.getByTestId('topbar-cash').textContent();
    expect(cash).not.toContain('50,000');
  });

  test('crop menu shows costs', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();

    // All 3 crop options should be visible
    await expect(page.getByTestId('menu-crop-processing-tomatoes')).toBeVisible();
    await expect(page.getByTestId('menu-crop-silage-corn')).toBeVisible();
    // Winter wheat should be disabled in spring
    await expect(page.getByTestId('menu-crop-winter-wheat')).toBeDisabled();
  });

  test('cancel button closes crop menu', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await expect(page.getByTestId('menu-cancel')).toBeVisible();

    await page.getByTestId('menu-cancel').click();
    await expect(page.getByTestId('menu-cancel')).not.toBeVisible();
  });

  test('escape closes crop menu', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await expect(page.getByTestId('menu-crop-processing-tomatoes')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('menu-crop-processing-tomatoes')).not.toBeVisible();
  });
});

// ==========================================================================
// §3 — Time & Simulation
// ==========================================================================

test.describe('Time & Simulation', () => {
  test('speed controls work', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Initially paused
    await expect(page.getByTestId('speed-pause')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('speed-play')).toHaveAttribute('aria-pressed', 'false');

    // Start playing
    await page.getByTestId('speed-play').click();
    await expect(page.getByTestId('speed-play')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('speed-pause')).toHaveAttribute('aria-pressed', 'false');

    // Pause again
    await page.getByTestId('speed-pause').click();
    await expect(page.getByTestId('speed-pause')).toHaveAttribute('aria-pressed', 'true');
  });

  test('date advances when playing', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    const initialDate = await page.getByTestId('topbar-date').textContent();

    // Play at fastest speed for a bit
    await page.getByTestId('speed-fastest').click();
    await page.waitForTimeout(2000);
    await page.getByTestId('speed-pause').click();

    const laterDate = await page.getByTestId('topbar-date').textContent();
    expect(laterDate).not.toBe(initialDate);
  });

  test('simulation pauses when auto-pause triggers', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Plant some crops and run for a long time — should eventually hit auto-pause
    // Plant a tomato first
    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-processing-tomatoes').click();

    // Run at 4x speed — should eventually hit water stress, harvest ready, or event
    await page.getByTestId('speed-fastest').click();

    // Wait for any auto-pause panel to appear (standard, event, loan, or advisor)
    const autoPausePanel = page.locator('[data-testid="autopause-panel"], [data-testid="event-panel"], [data-testid="loan-panel"], [data-testid="advisor-panel"]');
    await expect(autoPausePanel.first()).toBeVisible({ timeout: 15000 });

    // Game should be paused
    await expect(page.getByTestId('speed-pause')).toHaveAttribute('aria-pressed', 'true');
  });
});

// ==========================================================================
// §5 — Economy
// ==========================================================================

test.describe('Economy', () => {
  test('cash display shows starting amount', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);
    await expect(page.getByTestId('topbar-cash')).toContainText('50,000');
  });

  test('planting reduces cash', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-processing-tomatoes').click();

    // Cash should be 50000 - 150 = 49850
    await expect(page.getByTestId('topbar-cash')).toContainText('49,850');
  });
});

// ==========================================================================
// §6 — Save & Resume
// ==========================================================================

test.describe('Save & Resume', () => {
  test('save button saves game', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await page.getByTestId('save-button').click();

    // Notification should appear
    await expect(page.getByTestId('notify-bar')).toContainText('saved');
  });

  test('saved game can be resumed', async ({ page }) => {
    // Start a game and plant something
    await startNewGame(page, 'SaveTest');
    await waitForGameScreen(page);

    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-silage-corn').click();

    // Save
    await page.getByTestId('save-button').click();

    // Reload the page
    await page.reload();

    // Should see resume button
    await expect(page.getByTestId('save-resume')).toBeVisible();
    await page.getByTestId('save-resume').click();

    // Should be back in game with the planted crop
    await waitForGameScreen(page);
    await page.getByTestId('farm-cell-0-0').click();
    await expect(page.getByTestId('sidebar-crop-name')).toContainText('Silage Corn');
  });
});

// ==========================================================================
// §7 — Accessibility
// ==========================================================================

test.describe('Accessibility', () => {
  test('grid cells have meaningful ARIA labels', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    const cell = page.getByTestId('farm-cell-0-0');
    const label = await cell.getAttribute('aria-label');
    expect(label).toContain('Row 1');
    expect(label).toContain('Column 1');
    expect(label).toContain('Empty');
  });

  test('speed controls have ARIA labels', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    const pause = page.getByTestId('speed-pause');
    const label = await pause.getAttribute('aria-label');
    expect(label).toContain('Pause');
  });

  test('grid cells respond to Enter key', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Focus and press Enter on a cell
    await page.getByTestId('farm-cell-0-0').focus();
    await page.keyboard.press('Enter');

    // Cell should be selected — detail panel should show
    await expect(page.getByTestId('sidebar-cell-detail')).toBeVisible();
  });

  test('notification bar is an ARIA live region', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    const bar = page.getByTestId('notify-bar');
    const live = await bar.getAttribute('aria-live');
    expect(live).toBe('polite');
  });
});

// ==========================================================================
// §8 — UI Polish
// ==========================================================================

test.describe('UI Polish', () => {
  test('empty field shows hint', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Should see the empty field hint
    await expect(page.getByText('Select a plot and plant your first crop!')).toBeVisible();
  });

  test('notification bar is visible', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);
    await expect(page.getByTestId('notify-bar')).toBeVisible();
  });
});

// ==========================================================================
// §11 — data-testid coverage
// ==========================================================================

test.describe('data-testid Coverage', () => {
  test('top bar test IDs are present', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await expect(page.getByTestId('topbar-date')).toBeVisible();
    await expect(page.getByTestId('topbar-cash')).toBeVisible();
    await expect(page.getByTestId('topbar-season-icon')).toBeVisible();
    await expect(page.getByTestId('speed-pause')).toBeVisible();
    await expect(page.getByTestId('speed-play')).toBeVisible();
    await expect(page.getByTestId('speed-fast')).toBeVisible();
    await expect(page.getByTestId('speed-fastest')).toBeVisible();
  });

  test('grid test IDs are present', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await expect(page.getByTestId('farm-grid')).toBeVisible();
    // Spot-check a few cells
    await expect(page.getByTestId('farm-cell-0-0')).toBeVisible();
    await expect(page.getByTestId('farm-cell-7-7')).toBeVisible();
  });

  test('action test IDs work after selection', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Plant button appears after selecting empty cell
    await page.getByTestId('farm-cell-0-0').click();
    await expect(page.getByTestId('action-plant')).toBeVisible();
    await expect(page.getByTestId('action-harvest')).toBeVisible();
  });

  test('bulk action test IDs are present', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await expect(page.getByTestId('action-harvest-all')).toBeVisible();
    await expect(page.getByTestId('action-water-all')).toBeVisible();
  });

  test('save/new-game test IDs are present', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('newgame-player-id')).toBeVisible();
    await expect(page.getByTestId('newgame-start')).toBeVisible();

    await startNewGame(page);
    await waitForGameScreen(page);
    await expect(page.getByTestId('save-button')).toBeVisible();
  });

  test('crop menu test IDs are present', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();

    await expect(page.getByTestId('menu-crop-processing-tomatoes')).toBeVisible();
    await expect(page.getByTestId('menu-crop-silage-corn')).toBeVisible();
    await expect(page.getByTestId('menu-crop-winter-wheat')).toBeVisible();
    await expect(page.getByTestId('menu-cancel')).toBeVisible();
  });
});

// ==========================================================================
// §10 — Edge Cases
// ==========================================================================

test.describe('Edge Cases', () => {
  test('cannot plant on occupied cell', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Plant a crop
    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-processing-tomatoes').click();

    // Select same cell — plant button should not be available
    await page.getByTestId('farm-cell-0-0').click();
    await expect(page.getByTestId('action-plant')).not.toBeVisible();
  });

  test('idle farm has no charges within first year', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Run at 4x speed for a bit with no crops
    await page.getByTestId('speed-fastest').click();
    await page.waitForTimeout(2000);
    await page.getByTestId('speed-pause').click();

    // Cash should still be $50,000
    await expect(page.getByTestId('topbar-cash')).toContainText('50,000');
  });
});

// ==========================================================================
// Column bulk actions (Issue #4)
// ==========================================================================

test.describe('Column Bulk Actions', () => {
  test('column plant and water buttons appear when cell selected', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Select a cell to reveal column actions
    await page.getByTestId('farm-cell-2-3').click();

    // Plant Col button should appear (unique per crop now)
    await expect(page.getByTestId('action-plant-col-3-processing-tomatoes')).toBeVisible();

    // Water Col button should appear
    await expect(page.getByTestId('action-water-col-3')).toBeVisible();

    // Harvest Row and Col buttons should be present (even if disabled)
    await expect(page.getByTestId('action-harvest-row-2')).toBeVisible();
    await expect(page.getByTestId('action-harvest-col-3')).toBeVisible();
  });
});

// ==========================================================================
// Auto-pause dismiss testid (Issue #9)
// ==========================================================================

test.describe('Auto-pause testids', () => {
  test('autopause-dismiss testid is present on generic auto-pause secondary button', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Plant a crop to trigger an auto-pause eventually
    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-processing-tomatoes').click();

    // Run at max speed until we get any auto-pause panel
    await page.getByTestId('speed-fastest').click();

    const deadline = Date.now() + 15000;
    let found = false;
    while (Date.now() < deadline) {
      // Check for a generic auto-pause panel with dismiss button
      if (await page.getByTestId('autopause-dismiss').isVisible().catch(() => false)) {
        found = true;
        break;
      }

      // If an event or advisor panel appeared first, dismiss it and continue
      const eventChoice = page.locator('[data-testid^="event-choice-"]').first();
      const advisorChoice = page.locator('[data-testid^="advisor-choice-"]').first();
      if (await eventChoice.isVisible().catch(() => false)) {
        await eventChoice.click();
        await page.getByTestId('speed-fastest').click().catch(() => {});
        await page.waitForTimeout(50);
        continue;
      }
      if (await advisorChoice.isVisible().catch(() => false)) {
        await advisorChoice.click();
        await page.getByTestId('speed-fastest').click().catch(() => {});
        await page.waitForTimeout(50);
        continue;
      }

      await page.waitForTimeout(100);
    }

    expect(found).toBe(true);
  });
});

// ==========================================================================
// New Game button from game screen (Issue #9)
// ==========================================================================

test.describe('New Game from TopBar', () => {
  test('save-new-game button returns to title screen', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await expect(page.getByTestId('save-new-game')).toBeVisible();
    await page.getByTestId('save-new-game').click();

    // #69: confirm dialog now appears before returning to title
    await expect(page.getByTestId('confirm-dialog')).toBeVisible();
    await page.getByTestId('confirm-accept').click();

    // Should be back on new game screen
    await expect(page.getByTestId('newgame-player-id')).toBeVisible();
  });
});

// ==========================================================================
// Field confirmation dialog (confirm + cancel paths)
// ==========================================================================

test.describe('Field Confirmation Dialog', () => {
  test('Plant Field shows confirmation dialog and confirm plants crops', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Click Plant Field for silage corn
    await page.getByTestId('action-plant-all-silage-corn').click();

    // Confirmation dialog should appear with action metadata
    await expect(page.getByTestId('confirm-dialog')).toBeVisible();
    await expect(page.getByTestId('confirm-message')).toContainText('Silage Corn');
    await expect(page.getByTestId('confirm-dialog')).toHaveAttribute('data-confirm-action', 'plant-all');
    await expect(page.getByTestId('confirm-dialog')).toHaveAttribute('data-confirm-origin', 'manual');

    // Confirm planting
    await page.getByTestId('confirm-accept').click();

    // Dialog should close
    await expect(page.getByTestId('confirm-dialog')).not.toBeVisible();

    // Cash should have decreased (64 plots * cost)
    const cash = await page.getByTestId('topbar-cash').textContent();
    expect(cash).not.toContain('50,000');
  });

  test('Plant Field cancel does not plant or deduct cash', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await page.getByTestId('action-plant-all-silage-corn').click();
    await expect(page.getByTestId('confirm-dialog')).toBeVisible();

    // Cancel
    await page.getByTestId('confirm-cancel').click();

    // Dialog should close, cash unchanged
    await expect(page.getByTestId('confirm-dialog')).not.toBeVisible();
    await expect(page.getByTestId('topbar-cash')).toContainText('50,000');
  });

  test('Water Field confirm dialog has water-all action metadata', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Plant something first so watering is available
    await page.getByTestId('action-plant-all-silage-corn').click();
    await expect(page.getByTestId('confirm-dialog')).toBeVisible();
    await page.getByTestId('confirm-accept').click();
    await expect(page.getByTestId('confirm-dialog')).not.toBeVisible();

    // Now click Water Field
    await page.getByTestId('action-water-all').click();

    // Confirm dialog should appear with water-all action metadata
    await expect(page.getByTestId('confirm-dialog')).toBeVisible();
    await expect(page.getByTestId('confirm-dialog')).toHaveAttribute('data-confirm-action', 'water-all');
    await expect(page.getByTestId('confirm-dialog')).toHaveAttribute('data-confirm-origin', 'manual');

    // Cancel to avoid side effects
    await page.getByTestId('confirm-cancel').click();
    await expect(page.getByTestId('confirm-dialog')).not.toBeVisible();
  });
});

// ==========================================================================
// Manual save/load/delete flow from title screen
// ==========================================================================

test.describe('Manual Save/Load/Delete', () => {
  test('save creates named slot visible in Load Game menu', async ({ page }) => {
    await startNewGame(page, 'SaveLoadTest');
    await waitForGameScreen(page);

    // Save the game
    await page.getByTestId('save-button').click();
    await expect(page.getByTestId('notify-bar')).toContainText('saved');

    // Return to title screen (#69: confirm dialog)
    await page.getByTestId('save-new-game').click();
    await page.getByTestId('confirm-accept').click();
    await expect(page.getByTestId('newgame-player-id')).toBeVisible();

    // Load Game toggle should be visible
    await expect(page.getByTestId('save-load-toggle')).toBeVisible();
    await page.getByTestId('save-load-toggle').click();

    // Save list should appear
    await expect(page.getByTestId('save-load-menu')).toBeVisible();

    // Should contain at least one save entry with Year/Season name
    const menuText = await page.getByTestId('save-load-menu').textContent();
    expect(menuText).toContain('Year 1');
    expect(menuText).toContain('Spring');
  });

  test('loading a saved game restores game state', async ({ page }) => {
    await startNewGame(page, 'LoadTest');
    await waitForGameScreen(page);

    // Plant a crop so we have a distinguishable state
    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-silage-corn').click();

    // Save
    await page.getByTestId('save-button').click();

    // Return to title (#69: confirm dialog), open load menu, load the save
    await page.getByTestId('save-new-game').click();
    await page.getByTestId('confirm-accept').click();
    await page.getByTestId('save-load-toggle').click();

    // Click Load on the first save entry
    const loadBtn = page.getByTestId('save-load-menu').getByRole('button', { name: 'Load' });
    await loadBtn.first().click();

    // Should be back in game with the planted crop
    await waitForGameScreen(page);
    await page.getByTestId('farm-cell-0-0').click();
    await expect(page.getByTestId('sidebar-crop-name')).toContainText('Silage Corn');
  });
});

// ==========================================================================
// §14 — Slice 2a: Event Panel
// ==========================================================================

test.describe('Event Panel', () => {
  test('event panel appears with title, description, and choices', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Inject a heatwave event directly via debug hook (deterministic, no RNG wait)
    await page.evaluate(() => {
      (window as Record<string, any>).__gameDebug.triggerEvent('heatwave-advisory');
    });

    // Verify event panel structure
    await expect(page.getByTestId('event-panel')).toBeVisible();
    await expect(page.getByTestId('event-title')).toBeVisible();
    await expect(page.getByTestId('event-title')).toHaveText('Heatwave Advisory');
    await expect(page.getByTestId('event-description')).toBeVisible();

    // Should have at least 2 choices (Emergency Irrigation + Wait It Out)
    await expect(page.getByTestId('event-choice-emergency-irrigation')).toBeVisible();
    await expect(page.getByTestId('event-choice-wait-it-out')).toBeVisible();
  });

  test('clicking an event choice dismisses the panel', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Inject late frost warning via debug hook
    await page.evaluate(() => {
      (window as Record<string, any>).__gameDebug.triggerEvent('late-frost-warning');
    });

    await expect(page.getByTestId('event-panel')).toBeVisible();

    // Click the first available choice
    const firstChoice = page.locator('[data-testid^="event-choice-"]').first();
    await firstChoice.click();

    // Event panel should close
    await expect(page.getByTestId('event-panel')).not.toBeVisible();
  });

  // Uses fastForward debug hook to advance game synchronously, bypassing rAF throttling
  // that makes this test unreliable in parallel Playwright runs.
  test('foreshadowing notification appears before event fires naturally', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Plant a crop (needed for Late Frost Warning precondition: has_crop)
    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-processing-tomatoes').click();

    // Fast-forward through game ticks synchronously until an event fires.
    // fastForward auto-dismisses non-event pauses (year-end, water stress, etc.)
    // and stops when an event/advisor auto-pause fires.
    const result = await page.evaluate(() => {
      const debug = (window as Record<string, any>).__gameDebug;
      // Try up to 10 batches of 1000 ticks (covers ~27 years)
      for (let batch = 0; batch < 10; batch++) {
        const r = debug.fastForward(1000);
        if (r === 'event') return 'event';
        if (r === 'gameover') return 'gameover';
      }
      return 'no-event';
    });

    expect(result).toBe('event');

    // Wait for UI to reflect the event panel
    await expect(page.getByTestId('event-panel').or(page.getByTestId('advisor-panel'))).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('event-title')).not.toBeEmpty();

    // Verify foreshadowing happened: either pending foreshadows exist or
    // a foreshadowing notification was created at some point during the run.
    // Note: condition-only advisors (per-tick) don't use foreshadowing,
    // but seasonal draw events (the ones fastForward stops on) always do.
    const foreshadowingInfo = await page.evaluate(() => {
      const debug = (window as Record<string, any>).__gameDebug;
      const state = debug?.getState();
      if (!state) return { pending: 0, notifications: 0 };
      return {
        pending: state.pendingForeshadows.length,
        notifications: state.notifications.filter((n: any) => n.type === 'foreshadowing').length,
      };
    });
    // At least one foreshadowing signal should have appeared during the game
    expect(foreshadowingInfo.pending + foreshadowingInfo.notifications).toBeGreaterThan(0);
  });
});

// ==========================================================================
// §14 — Slice 2a: Loan Panel
// ==========================================================================

test.describe('Loan Panel', () => {
  test('loan offer panel appears when cash hits zero (via debug hook)', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Use debug hook to force cash to $0 — triggers loan offer on next tick
    await page.evaluate(() => {
      (window as Record<string, any>).__gameDebug.setCash(0);
    });

    // Start the game loop so simulateTick detects bankruptcy
    await page.getByTestId('speed-play').click();

    // Wait for the loan panel to appear
    await expect(page.getByTestId('loan-panel')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('loan-accept')).toBeVisible();
    await expect(page.getByTestId('autopause-dismiss')).toBeVisible();
  });

  test('accepting loan adds debt and continues game', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Force bankruptcy via debug hook
    await page.evaluate(() => {
      (window as Record<string, any>).__gameDebug.setCash(0);
    });

    await page.getByTestId('speed-play').click();
    await expect(page.getByTestId('loan-panel')).toBeVisible({ timeout: 10000 });

    // Accept the loan
    await page.getByTestId('loan-accept').click();

    // Loan panel should close, debt should appear in TopBar
    await expect(page.getByTestId('loan-panel')).not.toBeVisible();
    await expect(page.getByTestId('topbar-debt')).toBeVisible();
  });

  test('declining loan shows reflection panel then returns to title', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Force bankruptcy via debug hook
    await page.evaluate(() => {
      (window as Record<string, any>).__gameDebug.setCash(0);
    });

    await page.getByTestId('speed-play').click();
    await expect(page.getByTestId('loan-panel')).toBeVisible({ timeout: 10000 });

    // Decline the loan — should show gameover panel with reflection, not go straight to title
    await page.getByTestId('autopause-dismiss').click();

    // Gameover panel should appear with reflection summary (#88)
    await expect(page.getByTestId('gameover-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('gameover-report')).toBeVisible();

    // Click "Start New Game" to return to title
    await page.getByTestId('gameover-new-game').click();
    await expect(page.getByTestId('newgame-start')).toBeVisible({ timeout: 5000 });
  });
});

// ==========================================================================
// §15 — Slice 2b: Perennial Crops
// ==========================================================================

test.describe('Perennial Crops', () => {
  test('perennials appear in crop menu with establishment warning', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Set day to January (month 1) so perennials are in planting window
    await page.evaluate(() => {
      const debug = (window as Record<string, any>).__gameDebug;
      // Day 0 = Jan 1
      debug.setDay(0);
    });

    // Click a cell and open crop menu
    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();

    // Almonds and pistachios should be visible
    await expect(page.getByTestId('menu-crop-almonds')).toBeVisible();
    await expect(page.getByTestId('menu-crop-pistachios')).toBeVisible();
  });

  test('planting a perennial shows tree icon and perennial status in sidebar', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Set day to January so perennials can be planted
    await page.evaluate(() => {
      (window as Record<string, any>).__gameDebug.setDay(0);
    });

    // Plant almonds
    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-almonds').click();
    // #71: first perennial plant shows warning confirm
    await page.getByTestId('confirm-accept').click();

    // Cell is still selected after planting — sidebar updates automatically
    // Sidebar should show perennial status
    await expect(page.getByTestId('sidebar-perennial-status')).toBeVisible();
    await expect(page.getByTestId('sidebar-perennial-age')).toBeVisible();
    // Should show "Establishing" since it's year 0
    await expect(page.getByTestId('sidebar-perennial-status')).toContainText('Establishing');
  });

  test('perennial sidebar shows Remove button with cost', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Plant almonds in January
    await page.evaluate(() => {
      (window as Record<string, any>).__gameDebug.setDay(0);
    });

    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-almonds').click();
    await page.getByTestId('confirm-accept').click();

    // Cell is still selected after planting — sidebar updates automatically
    // Remove button should be visible
    await expect(page.getByTestId('action-remove-crop')).toBeVisible();
    await expect(page.getByTestId('action-remove-crop')).toContainText('500');
  });

  test('removing a perennial shows confirmation and clears the cell', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Plant almonds in January
    await page.evaluate(() => {
      (window as Record<string, any>).__gameDebug.setDay(0);
    });

    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-almonds').click();
    await page.getByTestId('confirm-accept').click();

    // Cell is still selected after planting — click Remove
    await page.getByTestId('action-remove-crop').click();

    // Confirmation dialog should appear with remove-crop action metadata
    await expect(page.getByTestId('confirm-dialog')).toBeVisible();
    await expect(page.getByTestId('confirm-dialog')).toHaveAttribute('data-confirm-action', 'remove-crop');
    await expect(page.getByTestId('confirm-dialog')).toHaveAttribute('data-confirm-origin', 'manual');

    // Confirm removal
    await page.getByTestId('confirm-accept').click();

    // Cell is still selected — sidebar should now show Empty
    await expect(page.getByTestId('sidebar-crop-name')).toHaveText('Empty');
  });

  test('perennial harvest does not remove the tree', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Use debug hook to set up an established perennial at harvestable stage
    await page.evaluate(() => {
      const debug = (window as Record<string, any>).__gameDebug;
      const state = debug.getState();
      if (!state) return;
      const cell = state.grid[0][0];
      cell.crop = {
        cropId: 'almonds',
        plantedDay: state.calendar.totalDay,
        gddAccumulated: 3000,
        waterStressDays: 0,
        growthStage: 'harvestable',
        overripeDaysRemaining: -1,
        isPerennial: true,
        perennialAge: 4,
        perennialEstablished: true,
        isDormant: false,
        harvestedThisSeason: false,
        chillHoursAccumulated: 700,
      };
    });
    // Publish the state change
    await page.evaluate(() => {
      const debug = (window as Record<string, any>).__gameDebug;
      debug.setCash(debug.getState().economy.cash); // triggers publishState
    });

    // Select cell and harvest
    await page.getByTestId('farm-cell-0-0').click();
    await expect(page.getByTestId('sidebar-crop-name')).toHaveText('Almonds');
    await page.getByTestId('action-harvest').click();

    // Tree should still be there (perennial harvest doesn't remove)
    // Cell is still selected — sidebar updates automatically
    await expect(page.getByTestId('sidebar-crop-name')).toHaveText('Almonds');
    await expect(page.getByTestId('sidebar-perennial-status')).toContainText('Producing');
  });

  test('dormant perennial shows dormancy visual', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Set up a dormant perennial via debug hook
    await page.evaluate(() => {
      const debug = (window as Record<string, any>).__gameDebug;
      const state = debug.getState();
      if (!state) return;
      const cell = state.grid[0][0];
      cell.crop = {
        cropId: 'almonds',
        plantedDay: 0,
        gddAccumulated: 0,
        waterStressDays: 0,
        growthStage: 'seedling',
        overripeDaysRemaining: -1,
        isPerennial: true,
        perennialAge: 1,
        perennialEstablished: false,
        isDormant: true,
        harvestedThisSeason: false,
        chillHoursAccumulated: 200,
      };
      // Set season to winter
      state.calendar.season = 'winter';
      debug.setCash(state.economy.cash); // triggers publishState
    });

    // Select dormant cell
    await page.getByTestId('farm-cell-0-0').click();
    await expect(page.getByTestId('sidebar-crop-name')).toHaveText('Almonds');
    await expect(page.getByTestId('sidebar-perennial-status')).toContainText('Dormant');
  });
});

// ==========================================================================
// §16 — Slice 2c: Advisor Panel
// ==========================================================================

test.describe('Advisor Panel', () => {
  test('advisor panel shows name, role, and advisor-choice testids', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Inject an advisor event via debug hook
    await page.evaluate(() => {
      (window as Record<string, any>).__gameDebug.triggerEvent('advisor-soil-nitrogen');
    });

    // Verify advisor panel structure
    await expect(page.getByTestId('advisor-panel')).toBeVisible();
    await expect(page.getByTestId('advisor-name')).toHaveText('Dr. Maria Santos');
    await expect(page.getByTestId('advisor-role')).toHaveText('County Extension Agent');
    await expect(page.getByTestId('event-title')).toHaveText('Soil Health Check');

    // Choices should use advisor-choice-* testids
    await expect(page.getByTestId('advisor-choice-buy-fertilizer')).toBeVisible();
    await expect(page.getByTestId('advisor-choice-acknowledge')).toBeVisible();
  });

  test('advisor choice with cost shows cost and advisor-choice-cost testid', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await page.evaluate(() => {
      (window as Record<string, any>).__gameDebug.triggerEvent('advisor-soil-nitrogen');
    });

    await expect(page.getByTestId('advisor-panel')).toBeVisible();
    // Fertilizer costs $400
    await expect(page.getByTestId('advisor-choice-cost-buy-fertilizer')).toBeVisible();
    await expect(page.getByTestId('advisor-choice-cost-buy-fertilizer')).toContainText('400');
  });

  test('clicking advisor choice dismisses the panel', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await page.evaluate(() => {
      (window as Record<string, any>).__gameDebug.triggerEvent('advisor-crop-failure');
    });

    await expect(page.getByTestId('advisor-panel')).toBeVisible();

    // Click the first choice
    await page.getByTestId('advisor-choice-diversify-advice').click();

    // Panel should close
    await expect(page.getByTestId('advisor-panel')).not.toBeVisible();
  });

  test('Chen advisor renders correct portrait, name, role, and subtitle', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await page.evaluate(() => {
      (window as Record<string, any>).__gameDebug.triggerEvent('advisor-chen-intro');
    });

    await expect(page.getByTestId('advisor-panel')).toBeVisible();
    await expect(page.getByTestId('advisor-name')).toHaveText('Marcus Chen');
    await expect(page.getByTestId('advisor-role')).toHaveText('Valley Farm Credit — Agricultural Lender');
    await expect(page.getByTestId('advisor-subtitle')).toHaveText('Focused on returns and financial growth');
    await expect(page.getByTestId('event-title')).toHaveText('A Visit from Valley Farm Credit');

    // Dismiss Chen panel
    await page.getByTestId('advisor-choice-welcome-review').click();
    await expect(page.getByTestId('advisor-panel')).not.toBeVisible();

    // Now trigger Forum and verify it renders correctly
    await page.evaluate(() => {
      (window as Record<string, any>).__gameDebug.triggerEvent('advisor-forum-intro');
    });

    await expect(page.getByTestId('advisor-panel')).toBeVisible();
    await expect(page.getByTestId('advisor-name')).toHaveText('Valley Growers Forum');
    await expect(page.getByTestId('advisor-role')).toHaveText('Local Farming Community');
    await expect(page.getByTestId('advisor-subtitle')).toHaveText('Word-of-mouth from neighboring farms');
    await expect(page.getByTestId('event-title')).toHaveText('Valley Growers Forum Meetup');

    // Dismiss Forum panel
    await page.getByTestId('advisor-choice-attend-meeting').click();
    await expect(page.getByTestId('advisor-panel')).not.toBeVisible();
  });

  test('non-advisor event still uses event-choice testids', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await page.evaluate(() => {
      (window as Record<string, any>).__gameDebug.triggerEvent('heatwave-advisory');
    });

    await expect(page.getByTestId('event-panel')).toBeVisible();
    await expect(page.getByTestId('event-choice-emergency-irrigation')).toBeVisible();
  });
});

// ==========================================================================
// §17 — Slice 2c: Chill Hours in Sidebar
// ==========================================================================

test.describe('Chill Hours Sidebar', () => {
  test('chill hours not visible before fog-of-war reveal', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Set up an established perennial but do NOT reveal chill hours
    await page.evaluate(() => {
      const debug = (window as Record<string, any>).__gameDebug;
      const state = debug.getState();
      if (!state) return;
      const cell = state.grid[0][0];
      cell.crop = {
        cropId: 'almonds',
        plantedDay: 0,
        gddAccumulated: 3000,
        waterStressDays: 0,
        growthStage: 'harvestable',
        overripeDaysRemaining: -1,
        isPerennial: true,
        perennialAge: 4,
        perennialEstablished: true,
        isDormant: false,
        harvestedThisSeason: false,
        chillHoursAccumulated: 500,
      };
      // Ensure flag is NOT set
      state.flags['chillHoursRevealed'] = false;
      debug.setCash(state.economy.cash); // triggers publishState
    });

    await page.getByTestId('farm-cell-0-0').click();
    await expect(page.getByTestId('sidebar-perennial-status')).toBeVisible();
    await expect(page.getByTestId('sidebar-perennial-chill')).not.toBeVisible();
  });

  test('chill hours visible after flag is set', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Set up an established perennial WITH chill hours revealed
    await page.evaluate(() => {
      const debug = (window as Record<string, any>).__gameDebug;
      const state = debug.getState();
      if (!state) return;
      const cell = state.grid[0][0];
      cell.crop = {
        cropId: 'almonds',
        plantedDay: 0,
        gddAccumulated: 3000,
        waterStressDays: 0,
        growthStage: 'harvestable',
        overripeDaysRemaining: -1,
        isPerennial: true,
        perennialAge: 4,
        perennialEstablished: true,
        isDormant: false,
        harvestedThisSeason: false,
        chillHoursAccumulated: 500,
      };
      debug.setFlag('chillHoursRevealed', true);
    });

    await page.getByTestId('farm-cell-0-0').click();
    await expect(page.getByTestId('sidebar-perennial-chill')).toBeVisible();
    // Should show accumulated/required
    await expect(page.getByTestId('sidebar-perennial-chill')).toContainText('500');
    await expect(page.getByTestId('sidebar-perennial-chill')).toContainText('700');
  });

  test('chill deficit warning shows when chill hours insufficient', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await page.evaluate(() => {
      const debug = (window as Record<string, any>).__gameDebug;
      const state = debug.getState();
      if (!state) return;
      const cell = state.grid[0][0];
      cell.crop = {
        cropId: 'almonds',
        plantedDay: 0,
        gddAccumulated: 3000,
        waterStressDays: 0,
        growthStage: 'harvestable',
        overripeDaysRemaining: -1,
        isPerennial: true,
        perennialAge: 4,
        perennialEstablished: true,
        isDormant: false,
        harvestedThisSeason: false,
        chillHoursAccumulated: 400,
      };
      debug.setFlag('chillHoursRevealed', true);
    });

    await page.getByTestId('farm-cell-0-0').click();
    await expect(page.getByTestId('sidebar-chill-deficit')).toBeVisible();
    await expect(page.getByTestId('sidebar-chill-deficit')).toContainText('300');
  });

  test('planting a perennial reveals chill hours via fog-of-war', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Set day to January so perennials can be planted
    await page.evaluate(() => {
      (window as Record<string, any>).__gameDebug.setDay(0);
    });

    // Verify flag is not set initially
    const flagBefore = await page.evaluate(() => {
      const state = (window as Record<string, any>).__gameDebug.getState();
      return state?.flags['chillHoursRevealed'] ?? false;
    });
    expect(flagBefore).toBe(false);

    // Plant almonds
    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-almonds').click();
    await page.getByTestId('confirm-accept').click();

    // Flag should now be set
    const flagAfter = await page.evaluate(() => {
      const state = (window as Record<string, any>).__gameDebug.getState();
      return state?.flags['chillHoursRevealed'] ?? false;
    });
    expect(flagAfter).toBe(true);
  });
});

// ==========================================================================
// §20 — Slice 3a1: New Crops (Sorghum + Citrus Navels)
// ==========================================================================

test.describe('New Crops — Sorghum', () => {
  test('sorghum appears in crop menu during April-June planting window', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Advance to April (day 90 = April 1)
    await page.evaluate(() => {
      (window as Record<string, any>).__gameDebug.setDay(90);
    });

    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await expect(page.getByTestId('menu-crop-sorghum')).toBeVisible();
  });

  test('sorghum is disabled in crop menu during March (outside window)', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Game starts in March — sorghum window is April-June
    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await expect(page.getByTestId('menu-crop-sorghum')).toBeVisible();
    await expect(page.getByTestId('menu-crop-sorghum')).toBeDisabled();
  });

  test('planting sorghum shows crop in sidebar', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Advance to April
    await page.evaluate(() => {
      (window as Record<string, any>).__gameDebug.setDay(90);
    });

    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-sorghum').click();

    // Sidebar should show sorghum info
    await expect(page.getByTestId('sidebar-crop-name')).toContainText('Sorghum');
  });
});

test.describe('New Crops — Citrus Navels', () => {
  test('citrus navels appears in crop menu during Feb-April planting window', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Game starts in March — within citrus Feb-April window
    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await expect(page.getByTestId('menu-crop-citrus-navels')).toBeVisible();
  });

  test('planting citrus shows perennial status in sidebar', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Plant citrus (March is in window)
    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-citrus-navels').click();
    await page.getByTestId('confirm-accept').click();

    // Sidebar should show perennial info
    await expect(page.getByTestId('sidebar-perennial-status')).toBeVisible();
    await expect(page.getByTestId('sidebar-perennial-status')).toContainText('Establishing');
    await expect(page.getByTestId('sidebar-crop-name')).toContainText('Citrus Navels');
  });

  test('citrus planting reveals chill hours fog-of-war (perennial flag)', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Plant citrus
    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-citrus-navels').click();
    await page.getByTestId('confirm-accept').click();

    // chillHoursRevealed flag should be set (same as other perennials)
    const flag = await page.evaluate(() => {
      const state = (window as Record<string, any>).__gameDebug.getState();
      return state?.flags['chillHoursRevealed'] ?? false;
    });
    expect(flag).toBe(true);
  });
});

// ==========================================================================
// §21 — Slice 3a1: Stretch Events (via debug injection)
// ==========================================================================

test.describe('Stretch Events', () => {
  test('tomato market surge event renders with single choice', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Inject the event via debug hook
    await page.evaluate(() => {
      (window as Record<string, any>).__gameDebug.triggerEvent('tomato-market-surge');
    });

    // Event panel should appear
    await expect(page.getByTestId('event-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('event-panel')).toContainText('Tomato Market Surge');

    // Single choice
    await expect(page.getByTestId('event-choice-acknowledge-surge')).toBeVisible();
  });

  test('groundwater pumping ban event renders with two choices', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Inject the event via debug hook
    await page.evaluate(() => {
      (window as Record<string, any>).__gameDebug.triggerEvent('groundwater-pumping-ban');
    });

    // Event panel should appear
    await expect(page.getByTestId('event-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('event-panel')).toContainText('Groundwater Pumping Ban');

    // Two choices
    await expect(page.getByTestId('event-choice-comply')).toBeVisible();
    await expect(page.getByTestId('event-choice-buy-rights')).toBeVisible();
  });

  test('choosing a stretch event choice dismisses the panel', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Trigger tomato surge
    await page.evaluate(() => {
      (window as Record<string, any>).__gameDebug.triggerEvent('tomato-market-surge');
    });

    await expect(page.getByTestId('event-panel')).toBeVisible({ timeout: 5000 });
    await page.getByTestId('event-choice-acknowledge-surge').click();

    // Panel should dismiss
    await expect(page.getByTestId('event-panel')).not.toBeVisible();
  });
});

// ==========================================================================
// §22 — Slice 3a2: Perennial Yield Curve Phase Display
// ==========================================================================

test.describe('Perennial Yield Curve UI', () => {
  test('establishing perennial shows "Establishing" phase label', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Plant almonds (game starts in March, almonds window Jan-Mar)
    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-almonds').click();
    await page.getByTestId('confirm-accept').click();

    // Phase should show "Establishing"
    await expect(page.getByTestId('sidebar-perennial-phase')).toBeVisible();
    await expect(page.getByTestId('sidebar-perennial-phase')).toContainText('Establishing');
  });

  test('peak perennial shows phase and years until decline', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Plant almonds and set to established peak
    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-almonds').click();
    await page.getByTestId('confirm-accept').click();

    // Use debug to set perennial to established at peak age
    await page.evaluate(() => {
      const debug = (window as Record<string, any>).__gameDebug;
      const state = debug.getState();
      const crop = state.grid[0][0].crop;
      if (crop) {
        crop.perennialEstablished = true;
        crop.perennialAge = 10; // peak (yp=7 for almonds)
      }
      debug.publish();
    });

    // Click cell again to refresh sidebar
    await page.getByTestId('farm-cell-0-1').click();
    await page.getByTestId('farm-cell-0-0').click();

    await expect(page.getByTestId('sidebar-perennial-phase')).toContainText('Peak Production');
    await expect(page.getByTestId('sidebar-perennial-decline-info')).toBeVisible();
    await expect(page.getByTestId('sidebar-perennial-decline-info')).toContainText('until decline');
  });
});

// ==========================================================================
// §23 — Slice 3b: Cover Crop UI
// ==========================================================================

test.describe('Cover Crop UI', () => {
  test('plant cover crop button appears in fall on empty cell', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Set calendar to fall (October = day ~275 from start, totalDay ~334)
    await page.evaluate(() => {
      const debug = (window as Record<string, any>).__gameDebug;
      // Fall starts Sep (month 9), day 244 from Jan 1
      debug.setDay(244); // Sep 1
    });

    // Click an empty cell
    await page.getByTestId('farm-cell-0-0').click();

    // Plant cover crop button should be visible
    await expect(page.getByTestId('action-plant-cover-crop')).toBeVisible();
    await expect(page.getByTestId('action-plant-cover-crop')).toContainText('Cover Crop ($30)');
  });

  test('plant cover crop button NOT visible in spring', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Game starts in spring — click empty cell
    await page.getByTestId('farm-cell-0-0').click();

    // Cover crop button should NOT be visible
    await expect(page.getByTestId('action-plant-cover-crop')).not.toBeVisible();
  });

  test('planting cover crop shows status and clover icon', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Set to fall
    await page.evaluate(() => {
      const debug = (window as Record<string, any>).__gameDebug;
      debug.setDay(244);
    });

    // Click cell and plant cover crop
    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant-cover-crop').click();

    // Should show cover crop status
    await expect(page.getByTestId('sidebar-cover-crop-status')).toBeVisible();
    await expect(page.getByTestId('sidebar-cover-crop-status')).toContainText('Clover/Vetch Mix');

    // Cell should show clover icon
    await expect(page.getByTestId('farm-cell-cover-0-0')).toBeVisible();
  });

  test('remove cover crop button clears cover crop', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Set to fall and plant cover crop
    await page.evaluate(() => {
      const debug = (window as Record<string, any>).__gameDebug;
      debug.setDay(244);
    });

    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant-cover-crop').click();

    // Verify it's planted
    await expect(page.getByTestId('sidebar-cover-crop-status')).toBeVisible();

    // Remove it
    await page.getByTestId('action-remove-cover-crop').click();

    // Status gone, clover icon gone
    await expect(page.getByTestId('sidebar-cover-crop-status')).not.toBeVisible();
    await expect(page.getByTestId('farm-cell-cover-0-0')).not.toBeVisible();
  });

  test('bulk cover crop field button appears in fall', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Set to fall
    await page.evaluate(() => {
      const debug = (window as Record<string, any>).__gameDebug;
      debug.setDay(244);
    });

    // Bulk cover crop button should be visible
    await expect(page.getByTestId('action-plant-cover-crop-bulk')).toBeVisible();
    await expect(page.getByTestId('action-plant-cover-crop-bulk')).toContainText('Cover Crop');
  });

  test('bulk cover crop field button NOT visible in spring', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Game starts in spring
    await expect(page.getByTestId('action-plant-cover-crop-bulk')).not.toBeVisible();
  });
});

// ==========================================================================
// §24 — Weather Service Advisor
// ==========================================================================

test.describe('Weather Service Advisor', () => {
  test('weather advisor panel shows NWS character info', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Plant something so has_crop passes
    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-silage-corn').click();

    // Inject weather-frost-alert directly
    await page.evaluate(() => {
      const debug = (window as Record<string, any>).__gameDebug;
      debug.triggerEvent('weather-frost-alert');
    });

    // Advisor panel should appear
    await expect(page.getByTestId('advisor-panel')).toBeVisible();
    await expect(page.getByTestId('advisor-name')).toContainText('NWS Fresno');
    await expect(page.getByTestId('advisor-role')).toContainText('National Weather Service');
    await expect(page.getByTestId('advisor-subtitle')).toContainText('Forecast accuracy varies');
    await expect(page.getByTestId('event-description')).toContainText('Moderate confidence');
  });

  test('weather advisor frost protection choice deducts cash', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-silage-corn').click();

    // Trigger frost alert
    await page.evaluate(() => {
      const debug = (window as Record<string, any>).__gameDebug;
      debug.triggerEvent('weather-frost-alert');
    });

    await expect(page.getByTestId('advisor-panel')).toBeVisible();

    // Click deploy protection
    await page.getByTestId('advisor-choice-deploy-protection').click();

    // Cash should be reduced by $150
    const cashText = await page.getByTestId('topbar-cash').textContent();
    const cash = parseInt(cashText!.replace(/[^0-9]/g, ''));
    // Started at 50000, spent seed cost + $150 for protection
    expect(cash).toBeLessThan(50000);
  });
});

// ==========================================================================
// §32 — Sub-Slice 4e: UX Polish & Art Overhaul
// ==========================================================================

test.describe('4e: Play Prompt (#50)', () => {
  test('play prompt appears after planting at speed 0 and disappears on play', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Game starts at speed 0 — plant a crop
    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-silage-corn').click();

    // Play prompt should be visible
    await expect(page.getByTestId('play-prompt')).toBeVisible();

    // Click play (testId is 'speed-play')
    await page.getByTestId('speed-play').click();

    // Prompt should disappear
    await expect(page.getByTestId('play-prompt')).not.toBeVisible();
  });

  test('play prompt is hidden while an auto-pause panel is active', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Set prompt true from a paused manual action.
    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-silage-corn').click();
    await expect(page.getByTestId('play-prompt')).toBeVisible();

    // Trigger an auto-pause event while still paused.
    await page.evaluate(() => {
      const debug = (window as Record<string, any>).__gameDebug;
      debug.triggerEvent('weather-frost-alert');
    });

    await expect(page.getByTestId('advisor-panel')).toBeVisible();
    await expect(page.getByTestId('play-prompt')).not.toBeVisible();
  });
});

test.describe('4e: Year Net P/L (#73)', () => {
  test('topbar shows year net after planting', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Plant field — spends money
    await page.getByTestId('action-plant-all-silage-corn').click();
    await page.getByTestId('confirm-accept').click();

    // Year net should show negative (planting cost)
    const netEl = page.getByTestId('topbar-year-net');
    await expect(netEl).toBeVisible();
    await expect(netEl).toContainText('-');
  });
});

test.describe('4e: Harvest Indicator (#74)', () => {
  test('harvest indicator appears on harvestable cells', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Plant corn
    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-silage-corn').click();

    // Set crop to harvestable via getState (returns _liveState) + publish
    await page.evaluate(() => {
      const debug = (window as Record<string, any>).__gameDebug;
      const state = debug.getState();
      const crop = state.grid[0][0].crop;
      if (crop) {
        crop.growthStage = 'harvestable';
        crop.overripeDaysRemaining = 30;
      }
      debug.publish();
    });

    // Harvest indicator should be visible on cell 0,0
    await expect(page.getByTestId('harvest-indicator-0-0')).toBeVisible();
    await expect(page.getByTestId('harvest-indicator-0-0')).toContainText('Ready!');
  });
});

test.describe('4e: Year-End Expense Breakdown (#53)', () => {
  test('year-end panel shows expense breakdown lines', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Plant a single crop so there are planting expenses
    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-silage-corn').click();

    // Give enough cash to survive + advance to 1 day before year-end
    // Year-end fires at totalDay 364 (when (364+1) % 365 === 0)
    await page.evaluate(() => {
      const debug = (window as Record<string, any>).__gameDebug;
      debug.setCash(100000);
      debug.setDay(363);
    });

    // Run at fastest speed — only 1 tick needed to reach year-end
    await page.getByTestId('speed-fastest').click();

    // Poll: dismiss non-year-end auto-pauses, stop when year-end-summary appears.
    // Double-check before clicking primary to avoid race where year-end panel
    // renders between the year-end-summary check and the primary button click.
    for (let i = 0; i < 150; i++) {
      if (await page.getByTestId('year-end-summary').isVisible().catch(() => false)) break;

      // Dismiss non-year-end auto-pauses
      const dismissBtn = page.getByTestId('autopause-dismiss');
      if (await dismissBtn.isVisible().catch(() => false)) {
        await dismissBtn.click();
        await page.getByTestId('speed-fastest').click().catch(() => {});
        await page.waitForTimeout(50);
        continue;
      }
      const primaryBtn = page.getByTestId('autopause-action-primary');
      if (await primaryBtn.isVisible().catch(() => false)) {
        // Re-check: if year-end-summary appeared, don't click primary (it's year-end's button)
        if (await page.getByTestId('year-end-summary').isVisible().catch(() => false)) break;
        await primaryBtn.click();
        await page.getByTestId('speed-fastest').click().catch(() => {});
        await page.waitForTimeout(50);
        continue;
      }

      // Handle events/advisors
      for (const prefix of ['event-choice-', 'advisor-choice-']) {
        const choice = page.locator(`[data-testid^="${prefix}"]`).first();
        if (await choice.isVisible().catch(() => false)) {
          await choice.click();
          await page.getByTestId('speed-fastest').click().catch(() => {});
          break;
        }
      }

      await page.waitForTimeout(100);
    }

    // Year-end summary should contain expense breakdown
    await expect(page.getByTestId('year-end-summary')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('expense-line-planting')).toBeVisible();
    await expect(page.getByTestId('expense-line-annualOverhead')).toBeVisible();
  });
});

test.describe('4e: New Game Confirm Guard (#69)', () => {
  test('new game button shows confirm dialog, cancel keeps game', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await page.getByTestId('save-new-game').click();

    // Confirm dialog should appear
    await expect(page.getByTestId('confirm-dialog')).toBeVisible();
    await expect(page.getByTestId('confirm-dialog')).toHaveAttribute('data-confirm-action', 'return-to-title');

    // Cancel — should stay in game
    await page.getByTestId('confirm-cancel').click();
    await expect(page.getByTestId('confirm-dialog')).not.toBeVisible();
    await expect(page.getByTestId('farm-grid')).toBeVisible();
  });
});

test.describe('4e: Crop Art Overhaul', () => {
  test('planted cells render img elements not emoji text', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Plant a crop
    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-silage-corn').click();

    // Cell should contain an <img> element
    const img = page.getByTestId('farm-cell-0-0').locator('img');
    await expect(img).toBeVisible();
  });

  test('sidebar crop preview shows when cell with crop selected', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Plant a crop
    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-silage-corn').click();

    // Sidebar should show crop preview image and stage label
    await expect(page.getByTestId('sidebar-crop-preview')).toBeVisible();
    await expect(page.getByTestId('sidebar-crop-stage-label')).toBeVisible();
    await expect(page.getByTestId('sidebar-crop-stage-label')).toContainText('Silage Corn');
  });
});

test.describe('TopBar Grid Geometry Regression', () => {
  test('speed controls stay centered within 2px between different right-side states', async ({ page }) => {
    // Use 1366×768 viewport (common Chromebook resolution)
    await page.setViewportSize({ width: 1366, height: 768 });
    await startNewGame(page);
    await waitForGameScreen(page);

    // State A: baseline — no frost, no debt
    await page.evaluate(() => {
      const dbg = (window as any).__gameDebug;
      dbg.setDebt(0);
      // Ensure no frost protection
      const state = dbg.getState();
      state.frostProtectionEndsDay = 0;
      dbg.publish();
    });

    const speedGroup = page.locator('[data-testid="speed-pause"]').locator('..');
    const boxA = await speedGroup.boundingBox();
    expect(boxA).toBeTruthy();

    // State B: add debt + frost protection (max right-side content)
    await page.evaluate(() => {
      const dbg = (window as any).__gameDebug;
      dbg.setDebt(50000);
      const state = dbg.getState();
      state.frostProtectionEndsDay = state.calendar.totalDay + 30;
      dbg.publish();
    });

    const boxB = await speedGroup.boundingBox();
    expect(boxB).toBeTruthy();

    // Speed controls x-position must not drift more than 2px
    const drift = Math.abs(boxA!.x - boxB!.x);
    expect(drift).toBeLessThanOrEqual(2);
  });

  test('save/new-game buttons stay within viewport at 1024px width', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await startNewGame(page);
    await waitForGameScreen(page);

    // Add maximum right-side content
    await page.evaluate(() => {
      const dbg = (window as any).__gameDebug;
      dbg.setDebt(50000);
      const state = dbg.getState();
      state.frostProtectionEndsDay = state.calendar.totalDay + 30;
      dbg.publish();
    });

    const newGameBtn = page.getByTestId('save-new-game');
    const box = await newGameBtn.boundingBox();
    expect(box).toBeTruthy();
    // Right edge of button must be within viewport
    expect(box!.x + box!.width).toBeLessThanOrEqual(1024);
  });

  test('speed controls do not overlap right-group at narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 768 });
    await startNewGame(page);
    await waitForGameScreen(page);

    // Add debt + frost to maximize right-side content
    await page.evaluate(() => {
      const dbg = (window as any).__gameDebug;
      dbg.setDebt(50000);
      const state = dbg.getState();
      state.frostProtectionEndsDay = state.calendar.totalDay + 30;
      dbg.publish();
    });

    const speedGroup = page.locator('[data-testid="speed-pause"]').locator('..');
    const speedBox = await speedGroup.boundingBox();
    const cashBox = await page.getByTestId('topbar-cash').boundingBox();
    expect(speedBox).toBeTruthy();
    expect(cashBox).toBeTruthy();

    // Speed controls right edge must not overlap cash section left edge
    expect(speedBox!.x + speedBox!.width).toBeLessThanOrEqual(cashBox!.x + 2);
  });
});

test.describe('Perennial Harvest Badge Regression', () => {
  test('no harvest indicator badge when harvestedThisSeason is true', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Plant almonds (perennial — triggers confirm dialog)
    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-almonds').click();

    // Confirm the perennial planting dialog
    await page.getByTestId('confirm-accept').click();

    // Wait for crop to be planted (sidebar shows crop name)
    await expect(page.getByTestId('sidebar-crop-name')).toContainText('Almonds');

    // Set up: established perennial, harvested this season, harvestable stage
    await page.evaluate(() => {
      const dbg = (window as any).__gameDebug;
      const state = dbg.getState();
      const crop = state.grid[0][0].crop;
      if (crop) {
        crop.perennialAge = 4;
        crop.perennialEstablished = true;
        crop.harvestedThisSeason = true;
        crop.growthStage = 'harvestable';
      }
      dbg.publish();
    });

    // Wait for the sidebar to re-render with the new state
    await expect(page.locator('[data-testid="sidebar-cell-detail"]')).toContainText('Already harvested this season');

    // No harvest indicator badge should show
    await expect(page.getByTestId('harvest-indicator-0-0')).not.toBeVisible();

    // Harvest button should be disabled
    await expect(page.getByTestId('action-harvest')).toBeDisabled();
  });
});

// ==========================================================================
// §5d: Bulk Plant Full-Field Feedback (#81)
// ==========================================================================

test.describe('5d: Bulk Plant Full-Field Feedback (#81)', () => {
  test('bulk plant shows notification when all plots are already planted', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Bulk plant corn on all cells
    await page.getByTestId('action-plant-all-silage-corn').click();
    await expect(page.getByTestId('confirm-dialog')).toBeVisible();
    await page.getByTestId('confirm-accept').click();
    await expect(page.getByTestId('confirm-dialog')).not.toBeVisible();

    // Attempt bulk plant again — field is full
    await page.getByTestId('action-plant-all-silage-corn').click();

    // Should show notification instead of confirm dialog (#81)
    await expect(page.getByTestId('notify-bar')).toContainText('All plots are already planted');
    await expect(page.getByTestId('confirm-dialog')).not.toBeVisible();
  });
});

// ==========================================================================
// Observer Layer (AI test agent affordances)
// ==========================================================================

test.describe('Observer Layer', () => {
  test('game-observer element is present with correct attributes', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    const observer = page.getByTestId('game-observer');
    await expect(observer).toHaveAttribute('data-blocked', 'false');
    await expect(observer).toHaveAttribute('data-speed', '0');
    await expect(observer).toHaveAttribute('data-year', '1');
    await expect(observer).toHaveAttribute('data-season', 'spring');
  });

  test('game-observer reflects blocked state when autopause fires', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Trigger an event via debug hook
    await page.evaluate(() => {
      (window as Record<string, any>).__gameDebug.triggerEvent('heatwave-advisory');
    });

    const observer = page.getByTestId('game-observer');
    await expect(observer).toHaveAttribute('data-blocked', 'true');
    await expect(observer).toHaveAttribute('data-block-reason', 'event');
    await expect(observer).toHaveAttribute('data-panel', 'event-panel');
  });

  test('getBlockingState() returns structured data via debug hook', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    const result = await page.evaluate(() => {
      return (window as Record<string, any>).__gameDebug.getBlockingState();
    });

    expect(result.blocked).toBe(false);
    expect(result.year).toBe(1);
    expect(result.season).toBe('spring');
    expect(result.notificationCount).toBeGreaterThanOrEqual(0);
  });

  test('getBlockingState() includes event choices when blocked by event', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await page.evaluate(() => {
      (window as Record<string, any>).__gameDebug.triggerEvent('heatwave-advisory');
    });

    const result = await page.evaluate(() => {
      return (window as Record<string, any>).__gameDebug.getBlockingState();
    });

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('event');
    expect(result.eventId).toBe('heatwave-advisory');
    expect(result.choices.length).toBeGreaterThan(0);
    expect(result.choices[0].testid).toContain('event-choice-');
  });

  test('fastForwardUntilBlocked() stops at autopause', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Plant corn so there will be a harvest autopause eventually
    await page.getByTestId('action-plant-all-silage-corn').click();
    await page.getByTestId('confirm-accept').click();

    const result = await page.evaluate(() => {
      return (window as Record<string, any>).__gameDebug.fastForwardUntilBlocked(5000);
    });

    expect(result.stopped).toBe(true);
    expect(result.ticksRun).toBeGreaterThan(0);
    expect(result.reason).toBeDefined();
  });
});
