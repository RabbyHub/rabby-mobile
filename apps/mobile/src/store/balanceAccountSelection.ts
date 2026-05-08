import { unionBy } from 'lodash';

import { filterOutTop10Accounts, getAccountList } from '@/core/apis/account';
import { keyringService } from '@/core/services';
import type { Account } from '@/types/account';
import accountStore from './account';
import {
  type AccountBalanceSelectionSnapshot,
  applyAccountBalanceSelectionSnapshot,
  setAccountBalanceSelectionSnapshotGetter,
  startProcessAddressBalanceEvents,
} from './balance';

async function pickSelectedAccountsFromSortedAccounts(
  sortedAccounts: Account[],
) {
  const { top10Accounts, top10Addresses } = filterOutTop10Accounts(
    sortedAccounts,
    {
      gatherSameAddress: false,
    },
  );

  return {
    selectedAccounts: unionBy(top10Accounts, account =>
      account.address.toLowerCase(),
    ),
    selectedAddresses: top10Addresses.map(address => address.toLowerCase()),
  };
}

async function getMatteredAccountsSnapshot(): Promise<AccountBalanceSelectionSnapshot> {
  const { sortedAccounts } = await getAccountList({ filter: 'onlyMine' });
  const matteredAccountLength = sortedAccounts.length;
  const { selectedAccounts, selectedAddresses } =
    await pickSelectedAccountsFromSortedAccounts(sortedAccounts);

  return {
    selectedAccounts,
    selectedAddresses,
    matteredAccountLength,
  };
}

setAccountBalanceSelectionSnapshotGetter(getMatteredAccountsSnapshot);

const accountBalanceSelectionLifecycleStateRef = {
  promise: null as Promise<void> | null,
  hasSubscribed: false,
  prevSelectionSignature: '',
};

async function initAccountBalanceSelectionLifecycle() {
  console.time('initAccountBalanceSelectionLifecycle');

  try {
    const syncSelectionFromAccounts = async () => {
      const snapshot = await getMatteredAccountsSnapshot();
      await applyAccountBalanceSelectionSnapshot(snapshot, {
        hydrate: true,
        source: 'accounts_changed',
      });
    };

    if (!accountBalanceSelectionLifecycleStateRef.hasSubscribed) {
      accountBalanceSelectionLifecycleStateRef.hasSubscribed = true;

      accountStore.subscribe(state => {
        const accountsSignature = state.accounts
          .map(
            account =>
              `${account.address.toLowerCase()}::${account.type}::${
                account.brandName
              }`,
          )
          .sort()
          .join('|');
        const pinSignature = state.pinnedAddresses
          .map(item => `${item.address.toLowerCase()}::${item.brandName}`)
          .join('|');
        const nextSignature = `${accountsSignature}##${pinSignature}`;

        if (
          nextSignature ===
          accountBalanceSelectionLifecycleStateRef.prevSelectionSignature
        ) {
          return;
        }

        accountBalanceSelectionLifecycleStateRef.prevSelectionSignature =
          nextSignature;
        void syncSelectionFromAccounts();
      });
    }

    await syncSelectionFromAccounts();
  } finally {
    console.timeEnd('initAccountBalanceSelectionLifecycle');
  }
}

export async function ensureAccountBalanceSelectionLifecycle() {
  if (accountBalanceSelectionLifecycleStateRef.promise) {
    return accountBalanceSelectionLifecycleStateRef.promise;
  }

  const promise = initAccountBalanceSelectionLifecycle().catch(error => {
    accountBalanceSelectionLifecycleStateRef.promise = null;
    throw error;
  });
  accountBalanceSelectionLifecycleStateRef.promise = promise;
  await promise;
}

let hasStartedAccountBalanceLifecycle = false;

export function startProcessAccountBalanceEvents() {
  if (hasStartedAccountBalanceLifecycle) {
    return;
  }
  hasStartedAccountBalanceLifecycle = true;

  startProcessAddressBalanceEvents();

  keyringService.once('unlock', () => {
    ensureAccountBalanceSelectionLifecycle().catch(error => {
      console.error('ensureAccountBalanceSelectionLifecycle::error', error);
    });
  });
}
