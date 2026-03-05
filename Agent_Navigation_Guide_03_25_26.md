# Climate Farmer - Agent Navigation Guide (Verified)

Purpose: reliable UI navigation guidance for AI/manual QA agents. This is navigation, not gameplay strategy.

## 1) Start and Resume Flow
- Title screen primary button is `Start New Game` (`data-testid="newgame-start"`).
- Enter any non-empty Player ID first (`data-testid="newgame-player-id"`).
- Tutorial may appear after starting. Dismiss with `data-testid="tutorial-skip"`.
- `Continue Saved Game` appears only if the auto-save key exists (`data-testid="save-resume"`).

## 2) Debug API (Important: Not Read-Only)
Debug API is exposed as `window.__gameDebug`.

Useful methods:
- `getState()` -> returns live game state object (mutable reference).
- `fastForward(ticks)` -> sync simulation helper for tests.
- `triggerEvent(storyletId)` -> inject event/advisor directly.
- `setCash`, `setDay`, `setDebt`, `setTotalLoansReceived`, `setFlag`, `publish`, `setScenario`.

Notes:
- `getState()` is not a deep clone.
- Mutating returned state directly can create test-only behavior if `publish()` is not called.

## 3) Time/Speed Controls
- Speed controls exist in top bar:
  - `speed-pause` (0x)
  - `speed-play` (1x)
  - `speed-fast` (2x)
  - `speed-fastest` (4x)
- For resilient targeting, prefer `data-testid="speed-fastest"` over text/icon matching.
- After auto-pauses, speed is set to 0 and must be resumed by clicking a speed button.

## 4) Core Layout Anchors
- Grid container: `role="grid"` with 8x8 cells.
- Cells: `role="gridcell"` and `data-testid="farm-cell-r-c"`.
- Cell aria labels include row/column and crop/soil status.
- Side panel contains single-cell actions and Bulk Actions.

## 5) Plant/Harvest/Water Navigation
- Select a cell first to expose row/column scoped bulk controls.
- Bulk buttons:
  - Plant field: `data-testid="action-plant-all-<cropId>"`
  - Plant row: `action-plant-row-<row>-<cropId>`
  - Plant col: `action-plant-col-<col>-<cropId>`
  - Harvest field: `action-harvest-all`
  - Water field: `action-water-all`
- Field-scope water always opens a confirm dialog.

## 6) Dialog Handling (Most Important)
Most blocking overlays use `role="alertdialog"`.

Common dialog testids:
- Auto-pause/event/advisor panel: `autopause-panel`, `event-panel`, `advisor-panel`, `loan-panel`, `gameover-panel`, `year30-panel`
- Confirm dialog: `confirm-dialog`
- Confirm buttons: `confirm-accept`, `confirm-cancel`

Confirm metadata (on confirm dialog root):
- `data-confirm-action` in:
  - `plant-all`
  - `plant-partial`
  - `water-all`
  - `water-partial`
  - `cover-crop-all`
  - `cover-crop-partial`
  - `remove-crop`
- `data-confirm-origin` currently `manual` for all call sites.

Handling order recommendation:
1. If `confirm-dialog` exists, resolve it first.
2. Then handle other alertdialogs (event/advisor/auto-pause).
3. Re-apply desired speed.

Rationale: confirm and autopause can coexist in DOM; confirm is rendered on top and should be consumed first.

## 7) Year-End and Year 30
- Year-end dialog uses primary button text `Continue to Year N+1`.
- End of Year 30 produces `year30-panel` and requires explicit click on `year30-new-game`.
- Returning to title is not automatic at the moment Year 30 is reached.

## 8) Save/Load References
- Auto-save key: `climateFarmer_autosave`
- Manual saves use keys prefixed with `climateFarmer_save_`
- `Save` button from top bar writes auto-save + manual seasonal slot.

## 9) Selector Quick Reference
- Start game: `[data-testid="newgame-start"]`
- Player ID: `[data-testid="newgame-player-id"]`
- Tutorial skip: `[data-testid="tutorial-skip"]`
- Grid cells: `[role="gridcell"]` or `[data-testid^="farm-cell-"]`
- Fastest speed: `[data-testid="speed-fastest"]`
- Any overlay: `[role="alertdialog"]`
- Confirm root: `[data-testid="confirm-dialog"]`
- Confirm action-specific: `[data-testid="confirm-dialog"][data-confirm-action="water-all"]`
- Confirm accept: `[data-testid="confirm-accept"]`

## 10) Minimal Robust Automation Skeleton
```javascript
if (window._cfHandler) clearInterval(window._cfHandler);
window._cfHandler = setInterval(() => {
  // 1) Confirm first
  const confirm = document.querySelector('[data-testid="confirm-dialog"]');
  if (confirm) {
    confirm.querySelector('[data-testid="confirm-accept"]')?.click();
    return;
  }

  // 2) Resolve other blocking dialogs
  const dialogs = [...document.querySelectorAll('[role="alertdialog"]')];
  for (const d of dialogs) {
    const btns = [...d.querySelectorAll('button')];
    if (!btns.length) continue;
    const primary = btns.find(b =>
      /Water Field|Harvest Field|Continue to Year|Start New Game|Accept Loan|Good to Know|Show Me|Help Me|Plan Replacement/.test((b.textContent || '').trim())
    );
    (primary || btns[btns.length - 1]).click();
  }

  // 3) Keep simulation running
  document.querySelector('[data-testid="speed-fastest"]')?.click();
}, 400);
```

Stop with:
```javascript
clearInterval(window._cfHandler);
```

## 11) Current Caveats for QA Agents
- Water Warning auto-pause can chain into a second confirm dialog for watering-all.
- Speed does not auto-resume after dismissing auto-pauses.
- `Continue Saved Game` visibility is key-presence based; corrupted auto-save can lead to a visible button that does nothing.

