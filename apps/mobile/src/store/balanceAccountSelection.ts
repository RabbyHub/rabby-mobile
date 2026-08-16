import {
  filterMyAccounts,
  getAccountList,
  sortAccountList,
} from '@/core/apis/account';
import {
  getHomeAssetSelectionSettings,
  isHomeAssetSelectionExperimentEnabled,
  subscribeHomeAssetSelectionSettings,
} from '@/hooks/appSettings';
import {
  bindKeyringEventAfterRegistration,
  isKeyringUnlockedSnapshot,
} from '@/core/serviceApi/keyring';
import { traceAndroidInstant } from '@/core/utils/androidTrace';
import type { Account, IPinAddress } from '@/types/account';
import accountStore from './account';
import addressBalanceStore, {
  commitAccountBalanceSelectionSnapshot,
  type AccountBalanceSelectionSnapshot,
  setAccountBalanceSelectionSnapshotGetter,
  startProcessAddressBalanceEvents,
} from './balance';
import { pickHomeAccountSelectionFromSortedAccounts } from './homePortfolio/accountSelection';

export function pickSelectedAccountsFromSortedAccounts(
  sortedAccounts: Account[],
) {
  const settings = getHomeAssetSelectionSettings();
  const { selectedAccounts, selectedAddresses } =
    pickHomeAccountSelectionFromSortedAccounts(sortedAccounts, {
      topN: settings.topN,
      uniqueAddresses: isHomeAssetSelectionExperimentEnabled(settings),
    });

  return {
    selectedAccounts,
    selectedAddresses,
  };
}

async function getMatteredAccountsSnapshot(): Promise<AccountBalanceSelectionSnapshot> {
  const { includeWatchAddresses } = getHomeAssetSelectionSettings();
  const { sortedAccounts } = await getAccountList({
    filter: includeWatchAddresses ? 'all' : 'onlyMine',
  });
  return buildMatteredAccountsSnapshotFromSortedAccounts(sortedAccounts);
}

function buildMatteredAccountsSnapshotFromSortedAccounts(
  sortedAccounts: Account[],
): AccountBalanceSelectionSnapshot {
  const matteredAccountLength = sortedAccounts.length;
  const { selectedAccounts, selectedAddresses } =
    pickSelectedAccountsFromSortedAccounts(sortedAccounts);

  return {
    selectedAccounts,
    selectedAddresses,
    matteredAccountLength,
  };
}

function buildMatteredAccountsSnapshotFromStoreAccounts(
  accounts: Account[],
  pinnedAddresses: IPinAddress[],
) {
  const { includeWatchAddresses } = getHomeAssetSelectionSettings();
  const sortedAccounts = sortAccountList(
    includeWatchAddresses ? accounts : filterMyAccounts(accounts),
    {
      highlightedAddresses: pinnedAddresses,
    },
  );

  return buildMatteredAccountsSnapshotFromSortedAccounts(sortedAccounts);
}

setAccountBalanceSelectionSnapshotGetter(getMatteredAccountsSnapshot);

const accountBalanceSelectionLifecycleStateRef = {
  promise: null as Promise<void> | null,
  hasSubscribed: false,
  prevSelectionSignature: '',
  syncGeneration: 0,
};

async function initAccountBalanceSelectionLifecycle() {
  console.time('initAccountBalanceSelectionLifecycle');

  try {
    const syncSelectionFromAccounts = async ({
      accountState = accountStore.getState(),
      allowFetchFallback = false,
    }: {
      accountState?: ReturnType<typeof accountStore.getState>;
      allowFetchFallback?: boolean;
    } = {}) => {
      const syncGeneration =
        ++accountBalanceSelectionLifecycleStateRef.syncGeneration;
      const canUseStoreSnapshot =
        accountState.hasFetchedAccounts || accountState.accounts.length > 0;
      if (!canUseStoreSnapshot && !allowFetchFallback) {
        return;
      }

      const snapshot = canUseStoreSnapshot
        ? buildMatteredAccountsSnapshotFromStoreAccounts(
            accountState.accounts,
            accountState.pinnedAddresses,
          )
        : await getMatteredAccountsSnapshot();

      if (
        syncGeneration !==
        accountBalanceSelectionLifecycleStateRef.syncGeneration
      ) {
        return;
      }

      commitAccountBalanceSelectionSnapshot(snapshot, {
        source: 'accounts_changed',
      });

      await addressBalanceStore.hydrateCachedBalancesForAccounts(
        snapshot.selectedAccounts,
      );

      if (
        syncGeneration !==
        accountBalanceSelectionLifecycleStateRef.syncGeneration
      ) {
        return;
      }

      commitAccountBalanceSelectionSnapshot(snapshot, {
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
        void syncSelectionFromAccounts({ accountState: state });
      });

      subscribeHomeAssetSelectionSettings(() => {
        void syncSelectionFromAccounts({
          allowFetchFallback: true,
        });
      });
    }

    await syncSelectionFromAccounts();
  } finally {
    console.timeEnd('initAccountBalanceSelectionLifecycle');
  }
}

export async function ensureAccountBalanceSelectionLifecycle() {
  if (!isKeyringUnlockedSnapshot()) {
    return;
  }

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

  const ensureSelectionLifecycle = () => {
    traceAndroidInstant('global_task.balance_selection_lifecycle.start');
    ensureAccountBalanceSelectionLifecycle()
      .catch(error => {
        traceAndroidInstant('global_task.balance_selection_lifecycle.error', {
          error: error instanceof Error ? error.message : String(error),
        });
        console.error('ensureAccountBalanceSelectionLifecycle::error', error);
      })
      .finally(() => {
        traceAndroidInstant('global_task.balance_selection_lifecycle.end');
      });
  };

  if (isKeyringUnlockedSnapshot()) {
    ensureSelectionLifecycle();
  }

  bindKeyringEventAfterRegistration('unlock', ensureSelectionLifecycle);
}
