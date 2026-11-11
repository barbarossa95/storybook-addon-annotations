import { createContext } from 'react';

import { setupDialogStore } from '../setupDialogStore.ts';
import type { SetupDialogStore } from '../setupDialogStore.ts';

/**
 * Defaults to the shared singleton, so consumers need no provider. Wrap a
 * subtree in `<SetupDialogContext.Provider value={createSetupDialogStore()}>`
 * only to isolate it (stories, tests).
 */
export const SetupDialogContext = createContext<SetupDialogStore>(setupDialogStore);
