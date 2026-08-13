import type { PasswordStatus } from '@/core/apis/lock';
import type { UpdaterOrPartials } from '@/core/utils/store';
import { resolveValFromUpdater } from '@/core/utils/store';
import type { WalletAccountState } from '@/core/utils/walletEntryState';
import { create } from 'zustand';

export type AppLockState = {
  appUnlocked: boolean;
  isUnlockSessionValid: boolean;
  hasVisibleAccounts: boolean;
  hasStoredKeyrings: boolean;
  accountState: WalletAccountState;
  pwdStatus: PasswordStatus;
};

const zAppLockStore = create<AppLockState>(() => ({
  appUnlocked: false,
  isUnlockSessionValid: false,
  hasVisibleAccounts: false,
  hasStoredKeyrings: false,
  accountState: 'checking',
  pwdStatus: -1 as PasswordStatus,
}));

function setAppLock(valOrFunc: UpdaterOrPartials<AppLockState>) {
  zAppLockStore.setState(prev => resolveValFromUpdater(prev, valOrFunc).newVal);
}

function getIsAppUnlocked() {
  return zAppLockStore.getState().appUnlocked;
}

export function getAppLockStateSnapshot() {
  return zAppLockStore.getState();
}

export function useAppLockState<T>(selector: (state: AppLockState) => T) {
  return zAppLockStore(selector);
}

export const storeApiLock = {
  setAppLock,
  getIsAppUnlocked,
};
