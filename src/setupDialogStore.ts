/**
 * In-memory open flag for the setup dialog, shared by the toolbar and the
 * panel. It is deliberately not addon state: Storybook writes the whole
 * `addons` map to localStorage on every `'permanent'` write, which is how a
 * persisted open flag used to leave the dialog stuck open across reloads.
 * A module store starts closed on every manager load by construction.
 */
export interface SetupDialogStore {
  get: () => boolean;
  open: () => void;
  close: () => void;
  subscribe: (listener: () => void) => () => void;
}

export function createSetupDialogStore(initial = false): SetupDialogStore {
  let value = initial;
  const listeners = new Set<() => void>();
  const set = (next: boolean): void => {
    if (next === value) return;
    value = next;
    for (const listener of listeners) listener();
  };
  return {
    get: () => value,
    open: () => set(true),
    close: () => set(false),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The manager-wide instance; the default value of `SetupDialogContext`. */
export const setupDialogStore = createSetupDialogStore();
