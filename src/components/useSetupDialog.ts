import { useContext, useSyncExternalStore } from 'react';

import { SetupDialogContext } from './SetupDialogContext.ts';

export interface SetupDialogControls {
  open: boolean;
  openDialog: () => void;
  closeDialog: () => void;
}

export function useSetupDialog(): SetupDialogControls {
  const store = useContext(SetupDialogContext);
  const open = useSyncExternalStore(store.subscribe, store.get);
  return { open, openDialog: store.open, closeDialog: store.close };
}
