import { z } from 'zod';

import type { AnnotationsAddonState } from './types.ts';

const addonStateSchema = z.object({
  onboardingDismissed: z.boolean().catch(false),
  notificationDismissed: z.boolean().catch(false),
  setupDone: z.boolean().catch(false),
  reviewerName: z.string().catch(''),
});

/**
 * Onboarding/notification flags live in Storybook's addon state. Without an
 * explicit persistence option `setAddonState` defaults to `'none'`, so a
 * dismissal would be forgotten on the next page load. `'permanent'` writes to
 * localStorage via the manager store, which is what makes "only shows once"
 * actually true.
 */
export const ONBOARDING_PERSISTENCE = { persistence: 'permanent' } as const;

export const ONBOARDING_STATE_DEFAULTS: AnnotationsAddonState = {
  onboardingDismissed: false,
  notificationDismissed: false,
  setupDone: false,
  reviewerName: '',
};

export type StoredAddonState = Partial<AnnotationsAddonState> | undefined;

/**
 * Decode and sanitize stored addon state.
 * Guarantees all fields conform to the schema and prevents undefined exceptions on property
 * access. Unknown keys are stripped, so a legacy `setupDialogOpen` from older payloads is
 * dropped; the dialog's open flag now lives in memory (see setupDialogStore.ts).
 */
export function sanitizeAddonState(raw: StoredAddonState): AnnotationsAddonState {
  const parsed = addonStateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ...ONBOARDING_STATE_DEFAULTS };
  }
  return {
    ...parsed.data,
    reviewerName: parsed.data.reviewerName.trim(),
  };
}

/** Fallback display name when the reviewer has not named themselves yet. */
export const DEFAULT_REVIEWER_NAME = 'Reviewer';

export function setReviewerName(state: AnnotationsAddonState, name: string): AnnotationsAddonState {
  return { ...state, reviewerName: name.trim() };
}

export function reviewerNameOrDefault(state: AnnotationsAddonState): string {
  const name = state.reviewerName.trim();
  return name === '' ? DEFAULT_REVIEWER_NAME : name;
}

export function markSetupDone(state: AnnotationsAddonState): AnnotationsAddonState {
  return { ...state, setupDone: true };
}

/**
 * The first-run card is a setup affordance, not a permanent fixture: hide it
 * once the user dismissed it, and hide it for stories that already carry
 * review threads.
 */
export function shouldShowOnboarding(state: AnnotationsAddonState, threadCount: number): boolean {
  if (state.onboardingDismissed) return false;
  return threadCount === 0;
}

export function dismissOnboarding(state: AnnotationsAddonState): AnnotationsAddonState {
  return { ...state, onboardingDismissed: true };
}

export function dismissNotification(state: AnnotationsAddonState): AnnotationsAddonState {
  return { ...state, notificationDismissed: true };
}
