import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ONBOARDING_PERSISTENCE,
  ONBOARDING_STATE_DEFAULTS,
  closeSetupDialog,
  dismissNotification,
  dismissOnboarding,
  markSetupDone,
  openSetupDialog,
  reviewerNameOrDefault,
  sanitizeAddonState,
  setReviewerName,
  shouldShowOnboarding,
} from './onboarding.ts';

test('onboarding shows only while it is undismissed and the story has no threads', () => {
  assert.equal(shouldShowOnboarding(ONBOARDING_STATE_DEFAULTS, 0), true);
  assert.equal(shouldShowOnboarding(ONBOARDING_STATE_DEFAULTS, 2), false);
  assert.equal(shouldShowOnboarding(dismissOnboarding(ONBOARDING_STATE_DEFAULTS), 0), false);
});

test('dismissing one surface preserves the other surface flag', () => {
  assert.deepEqual(dismissOnboarding(ONBOARDING_STATE_DEFAULTS), {
    onboardingDismissed: true,
    notificationDismissed: false,
    setupDone: false,
    setupDialogOpen: false,
    reviewerName: '',
  });
  assert.deepEqual(dismissNotification(dismissOnboarding(ONBOARDING_STATE_DEFAULTS)), {
    onboardingDismissed: true,
    notificationDismissed: true,
    setupDone: false,
    setupDialogOpen: false,
    reviewerName: '',
  });
});

test('first run routes the toolbar to setup until setup completes', () => {
  assert.equal(ONBOARDING_STATE_DEFAULTS.setupDone, false);
  const opened = openSetupDialog(ONBOARDING_STATE_DEFAULTS);
  assert.deepEqual(opened.setupDialogOpen, true);
  const done = markSetupDone(opened);
  assert.deepEqual(done.setupDone, true);
  assert.deepEqual(done.setupDialogOpen, false);
});

test('closing the dialog keeps setup pending so the toolbar still routes to setup', () => {
  const closed = closeSetupDialog(openSetupDialog(ONBOARDING_STATE_DEFAULTS));
  assert.deepEqual(closed.setupDialogOpen, false);
  assert.deepEqual(closed.setupDone, false);
});

test('onboarding state persists in the manager store so it survives a reload', () => {
  assert.deepEqual(ONBOARDING_PERSISTENCE, { persistence: 'permanent' });
});

test('reviewer name defaults empty and is stored trimmed', () => {
  assert.equal(ONBOARDING_STATE_DEFAULTS.reviewerName, '');
  assert.equal(setReviewerName(ONBOARDING_STATE_DEFAULTS, '  Reviewer  ').reviewerName, 'Reviewer');
});

test('reviewerNameOrDefault falls back to Reviewer when unset', () => {
  assert.equal(reviewerNameOrDefault(ONBOARDING_STATE_DEFAULTS), 'Reviewer');
  assert.equal(reviewerNameOrDefault(setReviewerName(ONBOARDING_STATE_DEFAULTS, 'Ada')), 'Ada');
});

test('sanitizeAddonState recovers from corrupted or partial localStorage payloads without crashing', () => {
  assert.deepEqual(sanitizeAddonState(undefined), ONBOARDING_STATE_DEFAULTS);
  assert.deepEqual(sanitizeAddonState({}), ONBOARDING_STATE_DEFAULTS);

  // Even if setupDialogOpen was persisted as true during a crash/reload, it is reset to false
  const recovered = sanitizeAddonState({
    onboardingDismissed: true,
    setupDone: true,
    setupDialogOpen: true,
    reviewerName: '  Alice  ',
  });
  assert.equal(recovered.onboardingDismissed, true);
  assert.equal(recovered.setupDone, true);
  assert.equal(recovered.setupDialogOpen, false);
  assert.equal(recovered.reviewerName, 'Alice');
});
