import {
  accountEvents,
  fetchAllAccounts,
  KeyringAccountWithAlias,
} from '@/core/apis/account';
import { apiMnemonic } from '@/core/apis';
import { getCurrentAccount, removeAddress } from '@/core/apis/address';
import { zCreate } from '@/core/utils/reexports';
import { ResourceBaseStore } from './_resourceBase';
import { AccountInfoEntity } from '@/databases/entities/accountInfo';
import { EntityAccountBase } from '@/databases/entities/base';
import { ormEvents } from '@/databases/entities/_helpers';
import { deleteDBResourceForAddress } from '@/databases/sync/assets';
import { BaseStore } from './_base';
import { useMemo } from 'react';
import { InteractionManager } from 'react-native';
import { isEqual } from 'lodash';
import { Account, IPinAddress } from '@/core/services/preference';
import {
  keyringService,
  preferenceService,
  transactionHistoryService,
} from '@/core/services';
import { perfEvents } from '@/core/utils/perf';
import { UpdaterOrPartials } from '@/core/utils/store';
import { EVENT_SWITCH_ACCOUNT, eventBus } from '@/utils/events';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import {
  KeyringAccount,
  KEYRING_CLASS,
  KEYRING_TYPE,
} from '@rabby-wallet/keyring-utils';
import { matomoRequestEvent } from '@/utils/analytics';
import { updateHistoryTimeSingleAddress } from '@/hooks/historyTokenDict';
import { checkAddedAccountsGasAccountIfNeeded } from '@/utils/autoLoginGasAccount';
import { makeMutable, type SharedValue } from 'react-native-reanimated';

const ACCOUNT_RESOURCE_KEY_SEPARATOR = '::';

type AccountResourceDetail = {
  trigger: 'fetchAccounts' | 'setAccounts';
  reason?: string;
};

const createAccountResourceKey = (
  account:
    | Pick<KeyringAccountWithAlias, 'address' | 'type' | 'brandName'>
    | undefined
    | null,
) => {
  if (!account?.address || !account?.type) {
    return undefined;
  }

  return [
    account.address.toLowerCase(),
    account.type,
    account.brandName || '',
  ].join(ACCOUNT_RESOURCE_KEY_SEPARATOR);
};

const isSameAccountIdentity = (
  left:
    | Pick<KeyringAccountWithAlias, 'address' | 'type' | 'brandName'>
    | null
    | undefined,
  right:
    | Pick<KeyringAccountWithAlias, 'address' | 'type' | 'brandName'>
    | null
    | undefined,
) => {
  if (!left || !right) {
    return false;
  }

  return (
    isSameAddress(left.address, right.address) &&
    left.type === right.type &&
    (left.brandName || '') === (right.brandName || '')
  );
};

const isSameStringRecord = (
  left: Record<string, string>,
  right: Record<string, string>,
) => {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every(key => left[key] === right[key]);
};

export interface AccountStoreState {
  accounts: KeyringAccountWithAlias[];
  hasFetchedAccounts: boolean;
  isFetchingAccounts: boolean;
  pinnedAddresses: IPinAddress[];
  currentAccount: KeyringAccountWithAlias | null;
  newlyAddedAccounts: Record<
    AccountInfoEntity['_db_id'],
    Awaited<ReturnType<typeof AccountInfoEntity.getAccountsAddedIn>>[0]
  >;
}

type DeleteTrace = {
  id: string;
  startedAt: number;
  accountLabel: string;
};

type DeleteCommitSource = 'expected' | 'fallback';
export type AccountRemovingVisualStage = 'idle' | 'deleting' | 'finishing';
type RemovingToastBridge = {
  successMessage: string;
  toastId: number;
  transitioned: boolean;
};

const isSameRemovingToastBridge = (
  left: RemovingToastBridge | undefined,
  right: RemovingToastBridge | undefined,
) => {
  if (!left || !right) {
    return left === right;
  }

  return (
    left.toastId === right.toastId &&
    left.successMessage === right.successMessage &&
    left.transitioned === right.transitioned
  );
};

const logDeleteTrace = (
  trace: DeleteTrace | undefined,
  stage: string,
  extra?: Record<string, unknown>,
) => {
  if (!trace) {
    return;
  }

  console.log(
    '[delete-trace]',
    JSON.stringify({
      id: trace.id,
      account: trace.accountLabel,
      stage,
      dt: Date.now() - trace.startedAt,
      ...extra,
    }),
  );
};

export const NEWLY_ADDED_ACCOUNT_DURATION = 10 * 60 * 1000;

const waitForNextFrame = () =>
  new Promise<void>(resolve => {
    requestAnimationFrame(() => resolve());
  });

class AccountResourceStore extends ResourceBaseStore<KeyringAccountWithAlias> {
  private readonly idleRemovingVisualStageSV =
    makeMutable<AccountRemovingVisualStage>('idle');
  private readonly removingVisualStageSVMap = new Map<
    string,
    SharedValue<AccountRemovingVisualStage>
  >();
  private readonly orderedKeysStore = zCreate<{
    orderedKeys: string[];
  }>(() => ({
    orderedKeys: [],
  }));

  private readonly removingKeysStore = zCreate<{
    removingKeys: string[];
  }>(() => ({
    removingKeys: [],
  }));

  private readonly finishingKeysStore = zCreate<{
    finishingKeys: string[];
  }>(() => ({
    finishingKeys: [],
  }));
  private readonly removingToastBridgeStore = zCreate<{
    bridgeByResourceKey: Record<string, RemovingToastBridge | undefined>;
  }>(() => ({
    bridgeByResourceKey: {},
  }));

  private readonly addressLookupStore = zCreate<{
    resourceKeyByAddress: Record<string, string>;
    watchResourceKeyByAddress: Record<string, string>;
  }>(() => ({
    resourceKeyByAddress: {},
    watchResourceKeyByAddress: {},
  }));

  constructor() {
    super('account');
  }

  private getOrderedKeys() {
    return this.orderedKeysStore.getState().orderedKeys;
  }

  private getRemovingKeys() {
    return this.removingKeysStore.getState().removingKeys;
  }

  private getFinishingKeys() {
    return this.finishingKeysStore.getState().finishingKeys;
  }

  private ensureRemovingVisualStageSV(resourceKey: string) {
    const existing = this.removingVisualStageSVMap.get(resourceKey);

    if (existing) {
      return existing;
    }

    const next = makeMutable<AccountRemovingVisualStage>('idle');
    this.removingVisualStageSVMap.set(resourceKey, next);
    return next;
  }

  private setRemovingVisualStage(
    account: KeyringAccountWithAlias,
    stage: AccountRemovingVisualStage,
  ) {
    const resourceKey = this.getResourceKey(account);

    if (!resourceKey) {
      return;
    }

    const stageSV = this.ensureRemovingVisualStageSV(resourceKey);
    if (stageSV.value === stage) {
      return;
    }
    stageSV.value = stage;
  }

  private clearRemovingVisualStage(account?: KeyringAccountWithAlias | null) {
    const resourceKey = this.getResourceKey(account);

    if (!resourceKey) {
      return;
    }

    const stageSV = this.removingVisualStageSVMap.get(resourceKey);

    if (stageSV) {
      stageSV.value = 'idle';
    }

    this.removingVisualStageSVMap.delete(resourceKey);
  }

  getNextOrderedKeysWithoutAccount(account: KeyringAccountWithAlias) {
    const resourceKey = this.getResourceKey(account);

    if (!resourceKey) {
      return this.getOrderedKeys();
    }

    return this.getOrderedKeys().filter(item => item !== resourceKey);
  }

  private setRemovingKeys(removingKeys: string[]) {
    this.removingKeysStore.setState(prev => {
      const prevKeys = prev.removingKeys;
      if (
        prevKeys.length === removingKeys.length &&
        prevKeys.every((item, index) => item === removingKeys[index])
      ) {
        return prev;
      }

      return {
        removingKeys,
      };
    });
  }

  private setOrderedKeys(orderedKeys: string[]) {
    this.orderedKeysStore.setState(prev => {
      const prevKeys = prev.orderedKeys;
      if (
        prevKeys.length === orderedKeys.length &&
        prevKeys.every((item, index) => item === orderedKeys[index])
      ) {
        return prev;
      }

      return {
        orderedKeys,
      };
    });
  }

  private setFinishingKeys(finishingKeys: string[]) {
    this.finishingKeysStore.setState(prev => {
      const prevKeys = prev.finishingKeys;
      if (
        prevKeys.length === finishingKeys.length &&
        prevKeys.every((item, index) => item === finishingKeys[index])
      ) {
        return prev;
      }

      return {
        finishingKeys,
      };
    });
  }

  private setAddressLookup(args: {
    resourceKeyByAddress: Record<string, string>;
    watchResourceKeyByAddress: Record<string, string>;
  }) {
    this.addressLookupStore.setState(prev => {
      if (
        isSameStringRecord(
          prev.resourceKeyByAddress,
          args.resourceKeyByAddress,
        ) &&
        isSameStringRecord(
          prev.watchResourceKeyByAddress,
          args.watchResourceKeyByAddress,
        )
      ) {
        return prev;
      }

      return args;
    });
  }

  private setRemovingToastBridgeValue(
    resourceKey: string,
    nextBridge: RemovingToastBridge | undefined,
  ) {
    this.removingToastBridgeStore.setState(prev => {
      const prevBridge = prev.bridgeByResourceKey[resourceKey];

      if (isSameRemovingToastBridge(prevBridge, nextBridge)) {
        return prev;
      }

      const nextBridgeByResourceKey = {
        ...prev.bridgeByResourceKey,
      };

      if (nextBridge) {
        nextBridgeByResourceKey[resourceKey] = nextBridge;
      } else {
        delete nextBridgeByResourceKey[resourceKey];
      }

      return {
        bridgeByResourceKey: nextBridgeByResourceKey,
      };
    });
  }

  private rebuildAddressLookupForAddress(
    normalizedAddress: string,
    orderedKeys = this.getOrderedKeys(),
  ) {
    let nextResourceKeyForAddress: string | undefined;
    let nextWatchResourceKeyForAddress: string | undefined;

    for (const resourceKey of orderedKeys) {
      const account = this.getValue(resourceKey);
      if (!account || account.address.toLowerCase() !== normalizedAddress) {
        continue;
      }

      nextResourceKeyForAddress ||= resourceKey;
      if (
        account.type === KEYRING_CLASS.WATCH &&
        !nextWatchResourceKeyForAddress
      ) {
        nextWatchResourceKeyForAddress = resourceKey;
      }

      if (nextResourceKeyForAddress && nextWatchResourceKeyForAddress) {
        break;
      }
    }

    this.addressLookupStore.setState(prev => {
      const nextResourceKeyByAddress = { ...prev.resourceKeyByAddress };
      const nextWatchResourceKeyByAddress = {
        ...prev.watchResourceKeyByAddress,
      };

      if (nextResourceKeyForAddress) {
        nextResourceKeyByAddress[normalizedAddress] = nextResourceKeyForAddress;
      } else {
        delete nextResourceKeyByAddress[normalizedAddress];
      }

      if (nextWatchResourceKeyForAddress) {
        nextWatchResourceKeyByAddress[normalizedAddress] =
          nextWatchResourceKeyForAddress;
      } else {
        delete nextWatchResourceKeyByAddress[normalizedAddress];
      }

      if (
        isSameStringRecord(
          prev.resourceKeyByAddress,
          nextResourceKeyByAddress,
        ) &&
        isSameStringRecord(
          prev.watchResourceKeyByAddress,
          nextWatchResourceKeyByAddress,
        )
      ) {
        return prev;
      }

      return {
        resourceKeyByAddress: nextResourceKeyByAddress,
        watchResourceKeyByAddress: nextWatchResourceKeyByAddress,
      };
    });
  }

  private getLifecycleDetail(
    account: Pick<KeyringAccountWithAlias, 'address' | 'type' | 'brandName'>,
    detail: AccountResourceDetail,
  ) {
    return {
      ...detail,
      address: account.address.toLowerCase(),
      accountType: account.type,
      brandName: account.brandName || '',
    };
  }

  getResourceKey = createAccountResourceKey;

  isRemovingAccount(account?: KeyringAccountWithAlias | null) {
    const resourceKey = this.getResourceKey(account);

    return resourceKey ? this.getRemovingKeys().includes(resourceKey) : false;
  }

  private syncAccounts(
    accounts: KeyringAccountWithAlias[],
    detail: AccountResourceDetail,
    syncItem: (args: {
      account: KeyringAccountWithAlias;
      resourceKey: string;
      lifecycleDetail: ReturnType<AccountResourceStore['getLifecycleDetail']>;
    }) => void,
  ) {
    const nextOrderedKeys: string[] = [];
    const prevOrderedKeys = this.getOrderedKeys();
    const prevOrderedKeyIndexMap = new Map(
      prevOrderedKeys.map((resourceKey, index) => [resourceKey, index]),
    );
    const staleKeys = new Set(prevOrderedKeys);
    const nextResourceKeyByAddress: Record<string, string> = {};
    const nextWatchResourceKeyByAddress: Record<string, string> = {};

    accounts.forEach(account => {
      const resourceKey = this.getResourceKey(account);

      if (!resourceKey) {
        return;
      }

      const normalizedAddress = account.address.toLowerCase();

      staleKeys.delete(resourceKey);
      nextOrderedKeys.push(resourceKey);
      nextResourceKeyByAddress[normalizedAddress] ||= resourceKey;
      if (
        account.type === KEYRING_CLASS.WATCH &&
        !nextWatchResourceKeyByAddress[normalizedAddress]
      ) {
        nextWatchResourceKeyByAddress[normalizedAddress] = resourceKey;
      }

      syncItem({
        account,
        resourceKey,
        lifecycleDetail: this.getLifecycleDetail(account, detail),
      });
    });

    const removingKeysSet = new Set(this.getRemovingKeys());
    const finishingKeysSet = new Set(this.getFinishingKeys());
    const preservedStaleKeys = Array.from(staleKeys)
      .filter(resourceKey => {
        return (
          removingKeysSet.has(resourceKey) || finishingKeysSet.has(resourceKey)
        );
      })
      .sort((left, right) => {
        return (
          (prevOrderedKeyIndexMap.get(left) ?? 0) -
          (prevOrderedKeyIndexMap.get(right) ?? 0)
        );
      });

    preservedStaleKeys.forEach(resourceKey => {
      const existingAccount = this.getValue(resourceKey);

      if (!existingAccount) {
        return;
      }

      staleKeys.delete(resourceKey);

      const normalizedAddress = existingAccount.address.toLowerCase();
      nextResourceKeyByAddress[normalizedAddress] ||= resourceKey;
      if (
        existingAccount.type === KEYRING_CLASS.WATCH &&
        !nextWatchResourceKeyByAddress[normalizedAddress]
      ) {
        nextWatchResourceKeyByAddress[normalizedAddress] = resourceKey;
      }
    });

    staleKeys.forEach(resourceKey => {
      this.removeResource(resourceKey, {
        detail: {
          ...detail,
          reason: 'removed_from_latest_snapshot',
        },
      });
      this.removingVisualStageSVMap.delete(resourceKey);
    });

    const mergedOrderedKeys = [...nextOrderedKeys];
    const mergedOrderedKeysSet = new Set(mergedOrderedKeys);

    preservedStaleKeys.forEach(resourceKey => {
      if (mergedOrderedKeysSet.has(resourceKey)) {
        return;
      }

      const insertAt = Math.min(
        prevOrderedKeyIndexMap.get(resourceKey) ?? mergedOrderedKeys.length,
        mergedOrderedKeys.length,
      );
      mergedOrderedKeys.splice(insertAt, 0, resourceKey);
      mergedOrderedKeysSet.add(resourceKey);
    });

    this.setOrderedKeys(mergedOrderedKeys);
    this.setAddressLookup({
      resourceKeyByAddress: nextResourceKeyByAddress,
      watchResourceKeyByAddress: nextWatchResourceKeyByAddress,
    });
  }

  replaceAccounts(
    accounts: KeyringAccountWithAlias[],
    detail: AccountResourceDetail,
  ) {
    this.syncAccounts(
      accounts,
      detail,
      ({ account, lifecycleDetail, resourceKey }) => {
        if (this.getValue(resourceKey) === account) {
          return;
        }
        this.markHydrateStarted(resourceKey, {
          detail: lifecycleDetail,
        });
        this.applyHydratedValue(resourceKey, account, {
          detail: lifecycleDetail,
        });
      },
    );
  }

  startRemovingAccount(account: KeyringAccountWithAlias) {
    const resourceKey = this.getResourceKey(account);

    if (!resourceKey) {
      return;
    }

    const removingKeys = this.getRemovingKeys();
    if (removingKeys.includes(resourceKey)) {
      return;
    }

    this.setRemovingKeys([...removingKeys, resourceKey]);
    this.setFinishingKeys(
      this.getFinishingKeys().filter(item => item !== resourceKey),
    );
    this.setRemovingVisualStage(account, 'deleting');
  }

  markRemovingAccountFinishing(account: KeyringAccountWithAlias) {
    const resourceKey = this.getResourceKey(account);

    if (!resourceKey || !this.getRemovingKeys().includes(resourceKey)) {
      return;
    }

    const finishingKeys = this.getFinishingKeys();
    if (finishingKeys.includes(resourceKey)) {
      return;
    }

    this.setFinishingKeys([...finishingKeys, resourceKey]);
    this.setRemovingVisualStage(account, 'finishing');
  }

  rollbackRemovingAccount(account: KeyringAccountWithAlias) {
    const resourceKey = this.getResourceKey(account);

    if (!resourceKey) {
      return;
    }

    this.setRemovingKeys(
      this.getRemovingKeys().filter(item => item !== resourceKey),
    );
    this.setFinishingKeys(
      this.getFinishingKeys().filter(item => item !== resourceKey),
    );
    this.clearRemovingToastBridge(account);
    this.setRemovingVisualStage(account, 'idle');
  }

  getRemovingVisualStageSV = (
    account?: KeyringAccountWithAlias | null,
  ): SharedValue<AccountRemovingVisualStage> => {
    const resourceKey = this.getResourceKey(account);

    if (!resourceKey) {
      return this.idleRemovingVisualStageSV;
    }

    return this.ensureRemovingVisualStageSV(resourceKey);
  };

  registerRemovingToastBridge = (
    account: KeyringAccountWithAlias,
    bridge: Omit<RemovingToastBridge, 'transitioned'>,
  ) => {
    const resourceKey = this.getResourceKey(account);

    if (!resourceKey) {
      return;
    }

    this.setRemovingToastBridgeValue(resourceKey, {
      ...bridge,
      transitioned: false,
    });
  };

  getRemovingToastBridge = (account?: KeyringAccountWithAlias | null) => {
    const resourceKey = this.getResourceKey(account);

    if (!resourceKey) {
      return null;
    }

    return (
      this.removingToastBridgeStore.getState().bridgeByResourceKey[
        resourceKey
      ] || null
    );
  };

  markRemovingToastTransitioned = (
    account?: KeyringAccountWithAlias | null,
  ) => {
    const resourceKey = this.getResourceKey(account);

    if (!resourceKey) {
      return;
    }

    const currentBridge =
      this.removingToastBridgeStore.getState().bridgeByResourceKey[resourceKey];

    if (!currentBridge || currentBridge.transitioned) {
      return;
    }

    this.setRemovingToastBridgeValue(resourceKey, {
      ...currentBridge,
      transitioned: true,
    });
  };

  clearRemovingToastBridge = (account?: KeyringAccountWithAlias | null) => {
    const resourceKey = this.getResourceKey(account);

    if (!resourceKey) {
      return;
    }

    this.setRemovingToastBridgeValue(resourceKey, undefined);
  };

  removeAccountOptimistically(
    account: KeyringAccountWithAlias,
    detail: AccountResourceDetail,
    options?: {
      deferNonVisualCleanup?: boolean;
    },
  ) {
    const resourceKey = this.getResourceKey(account);

    if (!resourceKey) {
      return undefined;
    }

    const nextOrderedKeys = this.getOrderedKeys().filter(
      item => item !== resourceKey,
    );

    if (options?.deferNonVisualCleanup) {
      return {
        resourceKey,
        nextOrderedKeys,
      };
    }

    this.removeResource(resourceKey, {
      detail: this.getLifecycleDetail(account, detail),
    });
    this.setOrderedKeys(nextOrderedKeys);
    this.setRemovingKeys(
      this.getRemovingKeys().filter(item => item !== resourceKey),
    );
    this.setFinishingKeys(
      this.getFinishingKeys().filter(item => item !== resourceKey),
    );
    this.rebuildAddressLookupForAddress(
      account.address.toLowerCase(),
      nextOrderedKeys,
    );
    this.clearRemovingVisualStage(account);

    return {
      resourceKey,
      nextOrderedKeys,
    };
  }

  cleanupRemovedAccountVisual(
    account: KeyringAccountWithAlias,
    nextOrderedKeys = this.getOrderedKeys(),
  ) {
    const resourceKey = this.getResourceKey(account);

    if (!resourceKey) {
      return;
    }

    this.removeResource(resourceKey, {
      detail: this.getLifecycleDetail(account, {
        trigger: 'setAccounts',
        reason: 'removed_account_visual_cleanup',
      }),
    });
    this.setOrderedKeys(nextOrderedKeys);
    this.setRemovingKeys(
      this.getRemovingKeys().filter(item => item !== resourceKey),
    );
    this.setFinishingKeys(
      this.getFinishingKeys().filter(item => item !== resourceKey),
    );
    this.rebuildAddressLookupForAddress(
      account.address.toLowerCase(),
      nextOrderedKeys,
    );
    this.clearRemovingVisualStage(account);
  }

  startFetchForKnownAccounts(detail: AccountResourceDetail) {
    const requestId = `account:list:remote:${Date.now()}`;

    this.getOrderedKeys().forEach(resourceKey => {
      this.markRemoteFetchStartedWithRequestId(resourceKey, requestId, {
        detail: {
          ...detail,
          reason: 'refresh_accounts',
        },
      });
    });

    return requestId;
  }

  applyFetchedAccounts(
    accounts: KeyringAccountWithAlias[],
    requestId: string,
    detail: AccountResourceDetail,
  ) {
    this.syncAccounts(
      accounts,
      detail,
      ({ account, lifecycleDetail, resourceKey }) => {
        this.applyRemoteValue(resourceKey, requestId, account, {
          detail: lifecycleDetail,
        });
      },
    );
  }

  markFetchErrorForKnownAccounts(
    requestId: string,
    error: unknown,
    detail: AccountResourceDetail,
  ) {
    this.getOrderedKeys().forEach(resourceKey => {
      this.markError(resourceKey, 'remote', error, {
        requestId,
        detail: {
          ...detail,
          reason: 'refresh_accounts_failed',
        },
      });
    });
  }

  getAccounts(opts?: {
    includeRemoving?: boolean;
    includeFinishingVisual?: boolean;
  }) {
    const { includeRemoving = true, includeFinishingVisual = false } =
      opts || {};
    const removingKeys = this.getRemovingKeys();
    const finishingKeys = this.getFinishingKeys();
    const orderedKeys = this.getOrderedKeys().filter(resourceKey => {
      if (!includeFinishingVisual && finishingKeys.includes(resourceKey)) {
        return false;
      }

      if (!includeRemoving && removingKeys.includes(resourceKey)) {
        return false;
      }

      return true;
    });

    return orderedKeys
      .map(resourceKey => this.getValue(resourceKey))
      .filter((value): value is KeyringAccountWithAlias => !!value);
  }

  useAccounts = (opts?: {
    includeRemoving?: boolean;
    includeFinishingVisual?: boolean;
  }) => {
    const { includeRemoving = true, includeFinishingVisual = false } =
      opts || {};
    const orderedKeys = this.orderedKeysStore(state => state.orderedKeys);
    const removingKeys = this.removingKeysStore(state => state.removingKeys);
    const finishingKeys = this.finishingKeysStore(state => state.finishingKeys);
    const visibleOrderedKeys = useMemo(() => {
      if (
        includeRemoving &&
        includeFinishingVisual &&
        !removingKeys.length &&
        !finishingKeys.length
      ) {
        return orderedKeys;
      }

      const removingKeysSet = new Set(removingKeys);
      const finishingKeysSet = new Set(finishingKeys);

      return orderedKeys.filter(resourceKey => {
        if (!includeFinishingVisual && finishingKeysSet.has(resourceKey)) {
          return false;
        }

        if (!includeRemoving && removingKeysSet.has(resourceKey)) {
          return false;
        }

        return true;
      });
    }, [
      finishingKeys,
      includeFinishingVisual,
      includeRemoving,
      orderedKeys,
      removingKeys,
    ]);
    const values = this.useValues(visibleOrderedKeys);

    return useMemo(() => {
      return values.filter(
        (value): value is KeyringAccountWithAlias => !!value,
      );
    }, [values]);
  };

  getAccountByAddress = (
    address?: string,
    opts?: { includeRemoving?: boolean; includeFinishingVisual?: boolean },
  ) => {
    if (!address) {
      return undefined;
    }

    const { includeRemoving = true, includeFinishingVisual = false } =
      opts || {};
    const resourceKey =
      this.addressLookupStore.getState().resourceKeyByAddress[
        address.toLowerCase()
      ];

    if (
      resourceKey &&
      ((!includeRemoving && this.getRemovingKeys().includes(resourceKey)) ||
        (!includeFinishingVisual &&
          this.getFinishingKeys().includes(resourceKey)))
    ) {
      return undefined;
    }

    return this.getValue(resourceKey);
  };

  useAccountByAddress = (
    address?: string,
    opts?: { includeRemoving?: boolean; includeFinishingVisual?: boolean },
  ) => {
    const { includeRemoving = true, includeFinishingVisual = false } =
      opts || {};
    const normalizedAddress = address?.toLowerCase();
    const removingKeys = this.removingKeysStore(state => state.removingKeys);
    const finishingKeys = this.finishingKeysStore(state => state.finishingKeys);
    const resourceKey = this.addressLookupStore(state => {
      if (!normalizedAddress) {
        return undefined;
      }

      return state.resourceKeyByAddress[normalizedAddress];
    });

    const visibleResourceKey = useMemo(() => {
      if (
        resourceKey &&
        ((!includeRemoving && removingKeys.includes(resourceKey)) ||
          (!includeFinishingVisual && finishingKeys.includes(resourceKey)))
      ) {
        return undefined;
      }

      return resourceKey;
    }, [
      finishingKeys,
      includeFinishingVisual,
      includeRemoving,
      removingKeys,
      resourceKey,
    ]);

    return this.useValue(visibleResourceKey);
  };

  useIsRemovingAccount = (account?: KeyringAccountWithAlias | null) => {
    const resourceKey = this.getResourceKey(account);

    return this.removingKeysStore(state => {
      return resourceKey ? state.removingKeys.includes(resourceKey) : false;
    });
  };

  useRemovingKeys = () => {
    return this.removingKeysStore(state => state.removingKeys);
  };

  useRemovingToastBridge = (account?: KeyringAccountWithAlias | null) => {
    const resourceKey = this.getResourceKey(account);

    return this.removingToastBridgeStore(state => {
      return resourceKey
        ? state.bridgeByResourceKey[resourceKey] ?? null
        : null;
    });
  };

  useHasWatchAccountByAddress = (address?: string) => {
    const normalizedAddress = address?.toLowerCase();

    return this.addressLookupStore(state => {
      if (!normalizedAddress) {
        return false;
      }

      return !!state.watchResourceKeyByAddress[normalizedAddress];
    });
  };
}

export const accountResourceStore = new AccountResourceStore();

class AccountStore extends BaseStore<AccountStoreState> {
  private hasStartedLifecycle = false;
  private readonly locallyRemovingAccountKeys = new Set<string>();
  private localAccountMutationInFlightCount = 0;
  private readonly pendingRemoveVisualCommits = new Map<
    string,
    {
      account: KeyringAccountWithAlias;
      opts?:
        | {
            beforeCommit?: (ctx: {
              source: DeleteCommitSource;
            }) => void | Promise<void>;
            afterCommit?: () => void | Promise<void>;
            trace?: DeleteTrace;
          }
        | undefined;
      nextOrderedKeys?: string[];
      fallbackTimer: ReturnType<typeof setTimeout> | null;
      isFinalizing: boolean;
    }
  >();

  private readonly fetchAccountsInParallel =
    this.createAvoidParallelAsyncMethod(async () => {
      this.setState(prev => {
        if (prev.isFetchingAccounts) {
          return prev;
        }
        return {
          isFetchingAccounts: true,
        };
      });

      const requestId = accountResourceStore.startFetchForKnownAccounts({
        trigger: 'fetchAccounts',
      });

      try {
        await waitForNextFrame();
        const accounts = await fetchAllAccounts();
        accountResourceStore.applyFetchedAccounts(accounts, requestId, {
          trigger: 'fetchAccounts',
        });
        this.setState({
          accounts: accountResourceStore.getAccounts(),
          hasFetchedAccounts: true,
          isFetchingAccounts: false,
        });
        return accountResourceStore.getAccounts();
      } catch (error) {
        accountResourceStore.markFetchErrorForKnownAccounts(requestId, error, {
          trigger: 'fetchAccounts',
        });
        this.setState({
          hasFetchedAccounts: true,
          isFetchingAccounts: false,
        });
        throw error;
      }
    });

  constructor() {
    super({
      accounts: [],
      hasFetchedAccounts: false,
      isFetchingAccounts: false,
      pinnedAddresses: preferenceService.getPinAddresses(),
      currentAccount: null,
      newlyAddedAccounts: {},
    });
  }

  setAccounts = (val: AccountStoreState['accounts']) => {
    accountResourceStore.replaceAccounts(val, {
      trigger: 'setAccounts',
    });
    this.setField('accounts', accountResourceStore.getAccounts(), {
      strict: true,
    });
  };

  setCurrentAccount = (
    valOrFunc: UpdaterOrPartials<AccountStoreState['currentAccount']>,
  ) => {
    this.setField('currentAccount', valOrFunc, { strict: true });
  };

  setPinnedAddresses = (
    valOrFunc: UpdaterOrPartials<AccountStoreState['pinnedAddresses']>,
  ) => {
    this.setField('pinnedAddresses', valOrFunc);
  };

  fetchAccounts = async () => {
    return this.fetchAccountsInParallel();
  };

  fetchNewlyAddedAccounts = async () => {
    const accounts = await AccountInfoEntity.getAccountsAddedIn(
      NEWLY_ADDED_ACCOUNT_DURATION,
    );

    const nextValue = accounts.reduce((acc, item) => {
      acc[item._db_id] = item;
      return acc;
    }, {} as AccountStoreState['newlyAddedAccounts']);

    this.setState(prev => {
      if (isEqual(prev.newlyAddedAccounts, nextValue)) {
        return prev;
      }
      return {
        newlyAddedAccounts: nextValue,
      };
    });

    return accounts;
  };

  getIsNewlyAddedAccount = (account: KeyringAccount) => {
    const dbId = EntityAccountBase.buildDBId({
      address: account.address,
      type: account.type,
      brandName: account.brandName,
    });
    const newlyAddedAccount = this.getState().newlyAddedAccounts[dbId] ?? null;

    return {
      newlyAddedAccount,
      isNewlyAdded:
        !!newlyAddedAccount &&
        Date.now() - newlyAddedAccount.updated_at <=
          NEWLY_ADDED_ACCOUNT_DURATION,
    };
  };

  togglePinAddressAsync = async (payload: {
    brandName: Account['brandName'];
    address: Account['address'];
    nextPinned?: boolean;
  }) => {
    const allPinAddresses = preferenceService.getPinAddresses();
    const nextPinned =
      payload.nextPinned ??
      !allPinAddresses.some(
        item =>
          isSameAddress(item.address, payload.address) &&
          item.brandName === payload.brandName,
      );

    const nextAddresses = [...allPinAddresses];
    const newItem = {
      brandName: payload.brandName,
      address: payload.address,
    };

    if (nextPinned) {
      nextAddresses.unshift(newItem);
      preferenceService.updatePinAddresses(nextAddresses);
      matomoRequestEvent({
        category: 'Pin Address',
        action: 'PinAddress_Finish',
      });
    } else {
      const index = nextAddresses.findIndex(
        item =>
          item.brandName === payload.brandName &&
          isSameAddress(item.address, payload.address),
      );
      if (index > -1) {
        nextAddresses.splice(index, 1);
      }
      preferenceService.updatePinAddresses(nextAddresses);
    }

    this.setPinnedAddresses(nextAddresses);
    return nextAddresses;
  };

  removeAccount = async (
    account: KeyringAccountWithAlias,
    opts?: {
      beforeCommit?: (ctx: {
        source: DeleteCommitSource;
      }) => void | Promise<void>;
      afterCommit?: () => void | Promise<void>;
      trace?: DeleteTrace;
    },
  ) => {
    const prevAccounts = accountResourceStore.getAccounts();
    const accountResourceKey = createAccountResourceKey(account);
    logDeleteTrace(opts?.trace, 'store_remove_start');

    try {
      if (accountResourceKey) {
        this.locallyRemovingAccountKeys.add(accountResourceKey);
        accountResourceStore.startRemovingAccount(account);
      }
      this.localAccountMutationInFlightCount += 1;
      await removeAddress(account);
      logDeleteTrace(opts?.trace, 'remove_address_resolved');
    } catch (error) {
      logDeleteTrace(opts?.trace, 'remove_address_failed', {
        error: error instanceof Error ? error.message : String(error || ''),
      });
      if (accountResourceKey) {
        this.locallyRemovingAccountKeys.delete(accountResourceKey);
        accountResourceStore.rollbackRemovingAccount(account);
      }
      this.localAccountMutationInFlightCount = Math.max(
        0,
        this.localAccountMutationInFlightCount - 1,
      );
      void this.fetchAccounts().catch(fetchError => {
        console.error(
          'resync accounts after delete failure failed',
          fetchError,
        );
      });

      throw error;
    }

    if (!accountResourceKey) {
      await this.finalizeRemovedAccountCommit({
        account,
        prevAccounts,
        opts,
        source: 'expected',
      });
      return;
    }

    accountResourceStore.markRemovingAccountFinishing(account);
    logDeleteTrace(opts?.trace, 'remove_finish_animation_start');

    const fallbackTimer = setTimeout(() => {
      void this.finishRemovingAccountVisual(account, 'fallback_timeout');
    }, 560);

    this.pendingRemoveVisualCommits.set(accountResourceKey, {
      account,
      opts,
      nextOrderedKeys:
        accountResourceStore.getNextOrderedKeysWithoutAccount(account),
      fallbackTimer,
      isFinalizing: false,
    });

    try {
      const removeCommitResult = await this.finalizeRemovedAccountCommit({
        account,
        prevAccounts,
        opts,
        source: 'expected',
        deferVisualCleanup: true,
      });

      const pendingCommit =
        this.pendingRemoveVisualCommits.get(accountResourceKey);
      if (pendingCommit && removeCommitResult) {
        pendingCommit.nextOrderedKeys = removeCommitResult.nextOrderedKeys;
      }
    } catch (error) {
      const pendingCommit =
        this.pendingRemoveVisualCommits.get(accountResourceKey);
      if (pendingCommit?.fallbackTimer) {
        clearTimeout(pendingCommit.fallbackTimer);
      }
      this.pendingRemoveVisualCommits.delete(accountResourceKey);
      throw error;
    }
  };

  private finalizeRemovedAccountCommit = async (args: {
    account: KeyringAccountWithAlias;
    prevAccounts: KeyringAccountWithAlias[];
    source: DeleteCommitSource;
    deferVisualCleanup?: boolean;
    opts?:
      | {
          beforeCommit?: (ctx: {
            source: DeleteCommitSource;
          }) => void | Promise<void>;
          afterCommit?: () => void | Promise<void>;
          trace?: DeleteTrace;
        }
      | undefined;
  }) => {
    const { account, prevAccounts, opts, source, deferVisualCleanup } = args;

    if (opts?.beforeCommit) {
      try {
        logDeleteTrace(opts?.trace, 'before_commit_callback_start');
        await opts.beforeCommit({ source });
        logDeleteTrace(opts?.trace, 'before_commit_callback_end');
      } catch (error) {
        logDeleteTrace(opts?.trace, 'before_commit_failed', {
          error: error instanceof Error ? error.message : String(error || ''),
        });
        console.error('account remove beforeCommit failed', error);
      }
    }

    logDeleteTrace(opts?.trace, 'account_commit_start');
    const removeCommitResult = accountResourceStore.removeAccountOptimistically(
      account,
      {
        trigger: 'setAccounts',
        reason: 'removed_account_commit_after_success',
      },
      {
        deferNonVisualCleanup: deferVisualCleanup,
      },
    );
    const nextAccounts = accountResourceStore.getAccounts();
    logDeleteTrace(opts?.trace, 'account_commit_done', {
      nextAccountsLength: nextAccounts.length,
    });

    const nextPinnedAddresses = preferenceService.getPinAddresses();
    const rawCurrentAccount = getCurrentAccount();
    const nextCurrentAccount = rawCurrentAccount
      ? nextAccounts.find(item =>
          isSameAccountIdentity(item, rawCurrentAccount),
        ) || rawCurrentAccount
      : null;

    logDeleteTrace(opts?.trace, 'account_mirror_commit_start');
    this.setState({
      pinnedAddresses: nextPinnedAddresses,
      accounts: nextAccounts,
      currentAccount: nextCurrentAccount,
    });
    logDeleteTrace(opts?.trace, 'account_mirror_commit_done', {
      nextAccountsLength: nextAccounts.length,
    });

    if (removeCommitResult && !deferVisualCleanup) {
      void Promise.resolve().then(() => {
        accountResourceStore.cleanupRemovedAccountVisual(
          account,
          removeCommitResult.nextOrderedKeys,
        );
        logDeleteTrace(opts?.trace, 'account_commit_cleanup_done');
      });
    }

    if (opts?.afterCommit) {
      try {
        logDeleteTrace(opts?.trace, 'after_commit_start');
        await opts.afterCommit();
        logDeleteTrace(opts?.trace, 'after_commit_end');
      } catch (error) {
        logDeleteTrace(opts?.trace, 'after_commit_failed', {
          error: error instanceof Error ? error.message : String(error || ''),
        });
        console.error('account remove afterCommit failed', error);
      }
    }

    this.localAccountMutationInFlightCount = Math.max(
      0,
      this.localAccountMutationInFlightCount - 1,
    );

    this.runRemovedAccountSideEffects(account);

    if (
      prevAccounts.filter(acc => isSameAddress(acc.address, account.address))
        .length === 1
    ) {
      void Promise.resolve()
        .then(async () => {
          await deleteDBResourceForAddress(account.address);
          updateHistoryTimeSingleAddress(account.address, 0);
          transactionHistoryService.clearSuccessAndFailList(account.address);
        })
        .catch(error => {
          console.error('post delete account cleanup failed', error);
        });
    }

    return removeCommitResult;
  };

  finishRemovingAccountVisual = async (
    account: KeyringAccountWithAlias,
    source: 'ui_animation_end' | 'fallback_timeout' = 'ui_animation_end',
  ) => {
    const accountResourceKey = createAccountResourceKey(account);

    if (!accountResourceKey) {
      return;
    }

    const pendingCommit =
      this.pendingRemoveVisualCommits.get(accountResourceKey);
    if (!pendingCommit || pendingCommit.isFinalizing) {
      return;
    }

    pendingCommit.isFinalizing = true;
    if (pendingCommit.fallbackTimer) {
      clearTimeout(pendingCommit.fallbackTimer);
      pendingCommit.fallbackTimer = null;
    }

    logDeleteTrace(pendingCommit.opts?.trace, 'remove_finish_animation_end', {
      source,
    });

    try {
      accountResourceStore.cleanupRemovedAccountVisual(
        pendingCommit.account,
        pendingCommit.nextOrderedKeys,
      );
      logDeleteTrace(pendingCommit.opts?.trace, 'account_commit_cleanup_done', {
        source: source === 'fallback_timeout' ? 'fallback' : 'expected',
      });
    } finally {
      this.pendingRemoveVisualCommits.delete(accountResourceKey);
    }
  };

  private runRemovedAccountSideEffects = (account: KeyringAccountWithAlias) => {
    void Promise.resolve()
      .then(async () => {
        accountEvents.emit('ACCOUNT_REMOVED', {
          removedAccounts: [account],
        });

        if (account.type === KEYRING_TYPE.HdKeyring) {
          try {
            const info = await apiMnemonic.getMnemonicAddressInfo(
              account.address,
            );
            if (info?.basePublicKey) {
              preferenceService.clearNeedsBackupReminder(info.basePublicKey);
            }
          } catch {
            // Silently ignore errors
          }
        }

        await AccountInfoEntity.deleteByAccount(account);
      })
      .catch(error => {
        console.error('post remove account side effects failed', error);
      });
  };

  startLifecycle = () => {
    if (this.hasStartedLifecycle) {
      return;
    }
    this.hasStartedLifecycle = true;

    perfEvents.subscribe('USER_MANUALLY_UNLOCK', () => {
      this.fetchAccounts();
    });

    keyringService.on('newAccount', () => {
      this.fetchAccounts();
    });

    keyringService.on('removedAccount', async account => {
      const accountResourceKey = createAccountResourceKey(account);
      const isLocallyManagedRemoval = accountResourceKey
        ? this.locallyRemovingAccountKeys.delete(accountResourceKey)
        : false;

      if (!isLocallyManagedRemoval) {
        await this.fetchAccounts();
        this.runRemovedAccountSideEffects(account);
      }
    });

    keyringService.store.subscribe(state => {
      if (this.localAccountMutationInFlightCount > 0) {
        return;
      }
      if (state.booted && state.vault) {
        this.fetchAccounts();
      }
    });

    accountEvents.on(
      'ACCOUNT_ADDED',
      async ({ accounts, needsBackupReminder }) => {
        // Store backup reminder in preferenceService (MMKV) for reliable persistence
        // Use basePublicKey as the key so all addresses from the same seed phrase
        // share the same backup reminder state
        if (needsBackupReminder) {
          for (const account of accounts) {
            // Only HD keyring accounts have seed phrases
            if (account.type === KEYRING_TYPE.HdKeyring) {
              try {
                const info = await apiMnemonic.getMnemonicAddressInfo(
                  account.address,
                );
                if (info?.basePublicKey) {
                  preferenceService.setNeedsBackupReminder(
                    info.basePublicKey,
                    true,
                  );
                }
              } catch {
                // Silently ignore errors - account might not be from mnemonic
              }
            }
          }
        }
        checkAddedAccountsGasAccountIfNeeded(accounts).catch(error => {
          console.error('checkAddedAccountsGasAccountIfNeeded error', error);
        });
        await AccountInfoEntity.recordNewAccount(accounts);
        await this.fetchNewlyAddedAccounts();
      },
    );

    ormEvents.on('account_info:removed', () => {
      this.fetchNewlyAddedAccounts();
    });

    eventBus.on(EVENT_SWITCH_ACCOUNT, account => {
      this.setCurrentAccount(account);
    });

    this.fetchNewlyAddedAccounts();

    setInterval(() => {
      InteractionManager.runAfterInteractions(() => {
        this.fetchNewlyAddedAccounts();
      });
    }, 10 * 1e3);

    setInterval(() => {
      InteractionManager.runAfterInteractions(() => {
        AccountInfoEntity.trimExpiredAccounts(NEWLY_ADDED_ACCOUNT_DURATION);
      });
    }, 60 * 1e3);
  };
}

export const accountStore = new AccountStore();

export const useAccountStore = accountStore.useStore;

export default accountStore;
