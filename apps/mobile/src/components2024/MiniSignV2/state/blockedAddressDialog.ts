import { useSyncExternalStore } from 'react';

// SignatureManager is not a component, so it raises the blocked dialog here
// and GlobalSignerPortal renders it.
let visible = false;
const listeners = new Set<() => void>();

const setVisible = (next: boolean) => {
  visible = next;
  listeners.forEach(fn => fn());
};

export const showBlockedAddressDialog = () => setVisible(true);
export const hideBlockedAddressDialog = () => setVisible(false);

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export const useBlockedAddressDialogVisible = () =>
  useSyncExternalStore(subscribe, () => visible);
