import assert from 'node:assert/strict';
import test from 'node:test';

import { createSetupDialogStore, setupDialogStore } from './setupDialogStore.ts';

test('a new store starts closed unless told otherwise', () => {
  assert.equal(createSetupDialogStore().get(), false);
  assert.equal(createSetupDialogStore(true).get(), true);
});

test('the shared store starts closed so a reload never reopens the dialog', () => {
  assert.equal(setupDialogStore.get(), false);
});

test('open and close toggle the flag', () => {
  const store = createSetupDialogStore();
  store.open();
  assert.equal(store.get(), true);
  store.close();
  assert.equal(store.get(), false);
});

test('subscribers are notified once per real change and not after unsubscribing', () => {
  const store = createSetupDialogStore();
  let calls = 0;
  const unsubscribe = store.subscribe(() => {
    calls += 1;
  });
  store.open();
  store.open();
  assert.equal(calls, 1);
  store.close();
  assert.equal(calls, 2);
  unsubscribe();
  store.open();
  assert.equal(calls, 2);
});

test('separate stores do not share state', () => {
  const a = createSetupDialogStore();
  const b = createSetupDialogStore();
  a.open();
  assert.equal(b.get(), false);
});
