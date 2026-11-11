import React, { useEffect, useState } from 'react';
import { CommentIcon } from '@storybook/icons';
import { GLOBALS_UPDATED } from 'storybook/internal/core-events';
import { Button } from 'storybook/internal/components';
import { useAddonState, useGlobals, useStorybookApi } from 'storybook/manager-api';
import { useTheme } from 'storybook/theming';

import { sanitizeAddonState, ONBOARDING_STATE_DEFAULTS } from '../onboarding.ts';
import { ADDON_ID, GLOBAL_KEY, PANEL_ID, TOOL_ID } from '../constants.ts';
import type { AnnotationsAddonState } from '../types.ts';
import { useSetupDialog } from './useSetupDialog.ts';

function isAnnotationModeActive(value: string | boolean | undefined): boolean {
  if (value === 'on') return true;
  return value === true;
}

export function ToolToggle(): React.ReactElement {
  const api = useStorybookApi();
  const theme = useTheme();
  const [globals, updateGlobals] = useGlobals();
  const [rawState] = useAddonState<AnnotationsAddonState>(ADDON_ID, ONBOARDING_STATE_DEFAULTS);
  const addonState = sanitizeAddonState(rawState);
  const { openDialog: openSetupDialog } = useSetupDialog();
  const [syncedActive, setSyncedActive] = useState(() => isAnnotationModeActive(globals[GLOBAL_KEY]));

  useEffect(() => {
    setSyncedActive(isAnnotationModeActive(globals[GLOBAL_KEY]));
  }, [globals]);

  useEffect(() => {
    const channel = api.getChannel();
    const onGlobalsUpdated = (payload: { globals?: Record<string, string | boolean | undefined> }): void => {
      if (payload.globals !== undefined) {
        setSyncedActive(isAnnotationModeActive(payload.globals[GLOBAL_KEY]));
      }
    };
    channel?.on(GLOBALS_UPDATED, onGlobalsUpdated);
    return () => channel?.off(GLOBALS_UPDATED, onGlobalsUpdated);
  }, [api]);

  const toggle = (): void => {
    if (!addonState.setupDone) {
      openSetupDialog();
      return;
    }
    const nextActive = !syncedActive;
    setSyncedActive(nextActive);
    updateGlobals({ [GLOBAL_KEY]: nextActive ? 'on' : 'off' });
    if (nextActive) api.setSelectedPanel(PANEL_ID);
  };

  return (
    <Button
      key={TOOL_ID}
      title={syncedActive ? 'Annotation mode on — stop annotating' : 'Annotation mode off — start annotating'}
      ariaLabel={false}
      aria-pressed={syncedActive}
      variant={syncedActive ? 'solid' : 'ghost'}
      style={{
        color: syncedActive ? theme.color.lightest : undefined,
        backgroundColor: syncedActive ? theme.color.primary : undefined,
        boxShadow: syncedActive ? `0 0 0 2px color-mix(in srgb, ${theme.color.primary} 35%, transparent)` : undefined,
      }}
      onClick={toggle}
    >
      <CommentIcon />
    </Button>
  );
}
