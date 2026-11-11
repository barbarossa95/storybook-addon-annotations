import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ONBOARDING_PERSISTENCE,
  ONBOARDING_STATE_DEFAULTS,
  dismissNotification,
  dismissOnboarding,
  markSetupDone,
  reviewerNameOrDefault,
  sanitizeAddonState,
  setReviewerName,
  shouldShowOnboarding,
} from './onboarding.ts';

const DEFAULTS = ONBOARDING_STATE_DEFAULTS;

test('onboarding shows only while it is undismissed and the story has no threads', () => {
  assert.equal(shouldShowOnboarding(DEFAULTS, 0), true);
  assert.equal(shouldShowOnboarding(DEFAULTS, 2), false);
  assert.equal(shouldShowOnboarding(dismissOnboarding(DEFAULTS), 0), false);
});

test('dismissing one surface preserves the other surface flag', () => {
  assert.deepEqual(dismissOnboarding(DEFAULTS), { ...DEFAULTS, onboardingDismissed: true });
  assert.deepEqual(dismissNotification(dismissOnboarding(DEFAULTS)), {
    ...DEFAULTS,
    onboardingDismissed: true,
    notificationDismissed: true,
  });
});

test('setup starts pending and markSetupDone only flips setupDone', () => {
  assert.equal(DEFAULTS.setupDone, false);
  assert.deepEqual(markSetupDone(DEFAULTS), { ...DEFAULTS, setupDone: true });
});

test('onboarding state persists in the manager store so it survives a reload', () => {
  assert.deepEqual(ONBOARDING_PERSISTENCE, { persistence: 'permanent' });
});

test('the setup dialog open flag is not part of persisted state', () => {
  assert.equal('setupDialogOpen' in DEFAULTS, false);
});

test('reviewer name defaults empty and is stored trimmed', () => {
  assert.equal(DEFAULTS.reviewerName, '');
  assert.equal(setReviewerName(DEFAULTS, '  Reviewer  ').reviewerName, 'Reviewer');
});

test('reviewerNameOrDefault falls back to Reviewer when unset', () => {
  assert.equal(reviewerNameOrDefault(DEFAULTS), 'Reviewer');
  assert.equal(reviewerNameOrDefault(setReviewerName(DEFAULTS, 'Ada')), 'Ada');
});

test('sanitizeAddonState recovers from corrupted or partial localStorage payloads without crashing', () => {
  assert.deepEqual(sanitizeAddonState(undefined), DEFAULTS);
  assert.deepEqual(sanitizeAddonState({}), DEFAULTS);

  const recovered = sanitizeAddonState({
    onboardingDismissed: true,
    setupDone: true,
    reviewerName: '  Alice  ',
  });
  assert.deepEqual(recovered, { ...DEFAULTS, onboardingDismissed: true, setupDone: true, reviewerName: 'Alice' });
});

test('sanitizeAddonState drops a legacy persisted setupDialogOpen so old storage cannot reopen the dialog', () => {
  // A payload written by a version that still persisted the flag. Passed as a variable,
  // not a literal, because the stored shape no longer declares the key.
  const legacy = { setupDone: true, setupDialogOpen: true };
  const sanitized = sanitizeAddonState(legacy);
  assert.equal('setupDialogOpen' in sanitized, false);
  assert.equal(sanitized.setupDone, true);
});
