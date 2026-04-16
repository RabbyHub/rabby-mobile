import { openapi } from '@/core/request';
import {
  contactService,
  keyringService,
  preferenceService,
} from '@/core/services/shared';
import { makeJsEEClass } from '@/core/services/_utils';
import { ORM_TABLE_NAMES } from '@/databases/constant';
import { BalanceEntity } from '@/databases/entities/balance';
import type { EvmTotalBalanceResponse } from '@/databases/hooks/balance';
import { syncBalance } from '@/databases/sync/assets';
import { HOME_REFRESH_INTERVAL } from '@/constant/home';
import { appStorage } from '@/core/storage/mmkv';
import { APP_MMKV_WEAK_KEYS } from '@/core/storage/mmkvConstants';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import {
  CORE_KEYRING_TYPES,
  KeyringTypeName,
} from '@rabby-wallet/keyring-utils';
import { ChainWithBalance } from '@rabby-wallet/rabby-api/dist/types';
import { unionBy } from 'lodash';
import PQueue from 'p-queue';
import { useCallback, useMemo, useRef } from 'react';
import { perfEvents } from '@/core/utils/perf';
import { zCreate, zMutative } from '@/core/utils/reexports';
import { makeSWRKeyAsyncFunc } from '@/core/utils/concurrency';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import {
  filterMyAccounts,
  filterOutTopAccounts,
  KeyringAccountWithAlias,
  sortAccountList,
} from '@/core/account/utils';
import { registerAccountBalanceSnapshotProvider } from '@/core/account/balanceSnapshot';
import {
  ResourceBaseStore,
  ResourceFlowState,
  ResourceSnapshot,
} from './_resourceBase';
import { ResourceLocalTarget } from './_resourceFlowDebug';
import { useAppChainStore } from './appchain';

export interface CURVE_STEP_ITEM {
  timestamp: number;
  usd_value: number;
}

export interface IBalanceData {
  evmBalance: number;
  totalBalance: number;
}

type AddressBalanceResourceValue = IBalanceData & {
  chainList: ChainWithBalance[];
  isCore: boolean;
};

const getTotalBalanceQueue = new PQueue({
  interval: 1000,
  intervalCap: 10,
});

const buildBalanceLocalTargets = (address: string): ResourceLocalTarget[] => [
  {
    kind: 'sqlite',
    table: ORM_TABLE_NAMES.cache_balance,
    where: {
      owner_addr: address,
    },
  },
];

const buildPersistedBalanceValue = (
  balance: EvmTotalBalanceResponse,
  appChainUsdValue: number,
  isCore: boolean,
): AddressBalanceResourceValue => {
  const evmBalance = balance.evm_usd_value || 0;

  return {
    evmBalance,
    totalBalance: evmBalance + appChainUsdValue,
    chainList: balance.chain_list,
    isCore,
  };
};

const buildRemoteBalancePayload = (
  balance: EvmTotalBalanceResponse,
  appChainUsdValue: number,
  isCore: boolean,
) => {
  const evmUsdValue = balance.total_usd_value;
  const formatBalance: EvmTotalBalanceResponse = {
    ...balance,
    evm_usd_value: evmUsdValue,
    total_usd_value: evmUsdValue + appChainUsdValue,
  };

  return {
    formatBalance,
    value: {
      evmBalance: formatBalance.evm_usd_value || 0,
      totalBalance: formatBalance.total_usd_value,
      chainList: formatBalance.chain_list,
      isCore,
    } satisfies AddressBalanceResourceValue,
  };
};

const getAppChainUsdValue = (address: string) =>
  useAppChainStore.getState().getAppChainTotalUsdValue(address);

const buildCoreAddressSet = <
  T extends {
    address: string;
    type: string;
  },
>(
  accounts: T[],
) =>
  new Set(
    accounts
      .filter(item => CORE_KEYRING_TYPES.includes(item.type as any))
      .map(item => item.address.toLowerCase()),
  );
export type AddressBalanceFlowState = ResourceFlowState;

export type AddressBalancesFlowState = {
  addresses: string[];
  loadingAddresses: string[];
  missingAddresses: string[];
  hasAnyValue: boolean;
  isAnyLoading: boolean;
  isAnyLoadingWithoutValue: boolean;
  hasAllValues: boolean;
};

export type AddressBalanceSnapshot = {
  address: string;
  value?: AddressBalanceResourceValue;
  flow: ResourceFlowState;
  sourceOfCurrentValue?: 'hydrate' | 'remote';
  persistStatus: ResourceFlowState['persistStatus'];
};

export type AddressBalancesSummary = {
  snapshots: AddressBalanceSnapshot[];
  flow: AddressBalancesFlowState;
  totalBalance: number;
};

export type BalanceResourceTraceContext = {
  scene?: string;
  requester?: string;
  endpoint?: string;
};

const buildBalanceTraceDetail = (
  detail: Record<string, unknown>,
  trace?: BalanceResourceTraceContext,
) => {
  return {
    ...detail,
    scene: trace?.scene,
    requester: trace?.requester,
    endpoint: trace?.endpoint,
  };
};

function normalizeBalanceAddresses(addresses: string[]) {
  return Array.from(new Set(addresses.map(address => address.toLowerCase())));
}

function buildAddressBalanceSnapshots(
  snapshots: ResourceSnapshot<AddressBalanceResourceValue>[],
) {
  return snapshots.map(snapshot => {
    return {
      address: snapshot.resourceKey,
      value: snapshot.value,
      flow: snapshot.flow,
      sourceOfCurrentValue: snapshot.sourceOfCurrentValue,
      persistStatus: snapshot.persistStatus,
    } satisfies AddressBalanceSnapshot;
  });
}

function buildAddressBalancesSummary(
  snapshots: AddressBalanceSnapshot[],
): AddressBalancesSummary {
  const summary = snapshots.reduce(
    (acc, item) => {
      acc.addresses.push(item.address);

      if (item.flow.isLoading) {
        acc.loadingAddresses.push(item.address);
      }

      if (!item.flow.hasValue) {
        acc.missingAddresses.push(item.address);
      } else {
        acc.hasAnyValue = true;
      }

      if (item.flow.isLoadingWithoutValue) {
        acc.isAnyLoadingWithoutValue = true;
      }

      acc.totalBalance += item.value?.totalBalance || 0;

      return acc;
    },
    {
      addresses: [] as string[],
      loadingAddresses: [] as string[],
      missingAddresses: [] as string[],
      hasAnyValue: false,
      isAnyLoadingWithoutValue: false,
      totalBalance: 0,
    },
  );

  return {
    snapshots,
    flow: {
      addresses: summary.addresses,
      loadingAddresses: summary.loadingAddresses,
      missingAddresses: summary.missingAddresses,
      hasAnyValue: summary.hasAnyValue,
      isAnyLoading: summary.loadingAddresses.length > 0,
      isAnyLoadingWithoutValue: summary.isAnyLoadingWithoutValue,
      hasAllValues:
        snapshots.length > 0 && summary.missingAddresses.length === 0,
    },
    totalBalance: summary.totalBalance,
  } satisfies AddressBalancesSummary;
}

class AddressBalanceStore extends ResourceBaseStore<AddressBalanceResourceValue> {
  constructor() {
    super('addressBalance');
  }

  private normalizeAddress(address?: string) {
    return address?.toLowerCase();
  }

  removeAddressBalance = (
    address: string,
    detail?: Record<string, unknown>,
  ) => {
    const lowerAddress = this.normalizeAddress(address);
    if (!lowerAddress) {
      return false;
    }

    return this.removeResource(lowerAddress, {
      localTargets: buildBalanceLocalTargets(lowerAddress),
      detail,
    });
  };

  private toAddressFlowState(addresses: string[]) {
    const flow = this.getFamilyFlowState(addresses);

    return {
      addresses: flow.resourceKeys,
      loadingAddresses: flow.loadingResourceKeys,
      missingAddresses: flow.missingResourceKeys,
      hasAnyValue: flow.hasAnyValue,
      isAnyLoading: flow.isAnyLoading,
      isAnyLoadingWithoutValue: flow.isAnyLoadingWithoutValue,
      hasAllValues: flow.hasAllValues,
    } satisfies AddressBalancesFlowState;
  }

  getAddressResourceState = (address?: string) => {
    return this.getMeta(this.normalizeAddress(address));
  };

  getAddressValue = (address?: string) => {
    return this.getValue(this.normalizeAddress(address));
  };

  getAddressValueMap = () => this.getValueMap();

  getAddressMetaMap = () => this.getMetaMap();

  getAddressChainList = (address?: string) => {
    return this.getAddressValue(address)?.chainList || [];
  };

  getAddressChainListMap = () => {
    const valueMap = this.getAddressValueMap();
    return Object.keys(valueMap).reduce((acc, address) => {
      acc[address] = valueMap[address]?.chainList || [];
      return acc;
    }, {} as Record<string, ChainWithBalance[]>);
  };

  useAddressResourceState = (address?: string) => {
    return this.useMeta(this.normalizeAddress(address) || '');
  };

  useAddressValue = (address?: string) => {
    return this.useValue(this.normalizeAddress(address) || '');
  };

  useAddressChainList = (address?: string) => {
    const value = this.useAddressValue(address);

    return value?.chainList;
  };

  getAddressFlowState = (address?: string) => {
    return this.getFlowState(this.normalizeAddress(address));
  };

  getAddressesSnapshot = (addresses: string[]) => {
    return buildAddressBalanceSnapshots(
      this.getSnapshots(normalizeBalanceAddresses(addresses)),
    );
  };

  getAddressesBalanceSummary = (addresses: string[]) => {
    return buildAddressBalancesSummary(this.getAddressesSnapshot(addresses));
  };

  useAddressFlowState = (address?: string) => {
    return this.useFlowState(this.normalizeAddress(address) || '');
  };

  useAddressesSnapshot = (addresses: string[]) => {
    const normalizedAddresses = useMemo(
      () => normalizeBalanceAddresses(addresses),
      [addresses],
    );
    const snapshots = this.useSnapshots(normalizedAddresses);

    return useMemo(() => {
      return buildAddressBalanceSnapshots(snapshots);
    }, [snapshots]);
  };

  useAddressesBalanceSummary = (
    addresses: string[],
  ): AddressBalancesSummary => {
    const snapshots = this.useAddressesSnapshot(addresses);

    return useMemo(() => {
      return buildAddressBalancesSummary(snapshots);
    }, [snapshots]);
  };

  getAddressesFlowState = (addresses: string[]) => {
    return this.toAddressFlowState(
      addresses.map(address => address.toLowerCase()),
    );
  };

  useAddressesFlowState = (addresses: string[]) => {
    const normalizedAddresses = useMemo(
      () =>
        Array.from(new Set(addresses.map(address => address.toLowerCase()))),
      [addresses],
    );
    const flow = this.useFamilyFlowState(normalizedAddresses);

    return useMemo(() => {
      return {
        addresses: flow.resourceKeys,
        loadingAddresses: flow.loadingResourceKeys,
        missingAddresses: flow.missingResourceKeys,
        hasAnyValue: flow.hasAnyValue,
        isAnyLoading: flow.isAnyLoading,
        isAnyLoadingWithoutValue: flow.isAnyLoadingWithoutValue,
        hasAllValues: flow.hasAllValues,
      } satisfies AddressBalancesFlowState;
    }, [flow]);
  };
  initStore = async () => {
    const result = await BalanceEntity.queryAllBalance();
    const appChainMap = useAppChainStore.getState().appChainMap;

    for (const item of result) {
      const lowerAddress = item.owner_addr.toLowerCase();
      const localTargets = buildBalanceLocalTargets(lowerAddress);
      const appChains = appChainMap[lowerAddress] ?? [];
      const appChainUsdValue = appChains.reduce(
        (acc, appChain) => acc + (appChain.netWorth || 0),
        0,
      );
      const value = buildPersistedBalanceValue(
        {
          total_usd_value: item.balance || 0,
          evm_usd_value: item.evm_usd_value || 0,
          chain_list: item.chain_list,
        },
        appChainUsdValue,
        !!item.isCore,
      );

      this.markHydrateStarted(lowerAddress, {
        localTargets,
        detail: {
          source: 'initStore',
        },
      });
      this.applyHydratedValue(lowerAddress, value, {
        localTargets,
        detail: {
          source: 'initStore',
          appChainUsdValue,
          isCore: !!item.isCore,
          totalBalance: value.totalBalance,
        },
      });
    }
  };

  hydrateCachedBalancesForAccounts = async (
    accounts: Array<Pick<KeyringAccountWithAlias, 'address' | 'type'>>,
  ) => {
    if (!accounts.length) {
      return;
    }

    const lowerAddresses = Array.from(
      new Set(accounts.map(item => item.address.toLowerCase())),
    );
    const currentBalanceMap = this.getAddressValueMap();
    const hasAnyMissingBalance = lowerAddresses.some(
      address => !currentBalanceMap[address],
    );

    if (!hasAnyMissingBalance) {
      return;
    }

    const coreAddressSet = buildCoreAddressSet(accounts);
    for (const address of lowerAddresses) {
      const localTargets = buildBalanceLocalTargets(address);

      if (currentBalanceMap[address]) {
        this.markHydrateSkipped(address, {
          localTargets,
          detail: {
            source: 'hydrateCachedBalancesForAccounts',
            hasMemoryValue: true,
          },
        });
        continue;
      }

      this.markHydrateStarted(address, {
        localTargets,
        detail: {
          source: 'hydrateCachedBalancesForAccounts',
        },
      });

      const cacheBalance = await BalanceEntity.queryBalanceCache(
        address,
        coreAddressSet.has(address),
      );

      if (!cacheBalance) {
        this.markHydrateSkipped(address, {
          localTargets,
          detail: {
            source: 'hydrateCachedBalancesForAccounts',
            hasCache: false,
          },
        });
        continue;
      }

      const appChainUsdValue = getAppChainUsdValue(address);
      const value = buildPersistedBalanceValue(
        cacheBalance,
        appChainUsdValue,
        coreAddressSet.has(address),
      );

      this.applyHydratedValue(address, value, {
        localTargets,
        detail: {
          source: 'hydrateCachedBalancesForAccounts',
          appChainUsdValue,
          isCore: coreAddressSet.has(address),
          totalBalance: value.totalBalance,
        },
      });
    }
  };

  batchGetTotalBalance = async (
    top10Addresses: string[],
    force = false,
    trace?: BalanceResourceTraceContext,
  ) => {
    if (!top10Addresses.length) {
      return;
    }

    const lowerAddresses = Array.from(
      new Set(top10Addresses.map(item => item.toLowerCase())),
    );
    const addresses = await keyringService.getAllAddresses();
    const coreAddressSet = buildCoreAddressSet(addresses);

    const fetchList: Array<{ address: string; isCore: boolean }> = [];

    for (const address of lowerAddresses) {
      const isCore = coreAddressSet.has(address);
      const localTargets = buildBalanceLocalTargets(address);

      if (!force) {
        this.markHydrateStarted(address, {
          localTargets,
          detail: buildBalanceTraceDetail(
            {
              source: 'batchGetTotalBalance',
              force,
            },
            trace,
          ),
        });

        const isExpired = await BalanceEntity.isExpired(address, isCore);
        if (!isExpired) {
          const cachedBalance = await BalanceEntity.queryBalance(
            address,
            isCore,
          );
          const appChainUsdValue = getAppChainUsdValue(address);
          const value = buildPersistedBalanceValue(
            cachedBalance,
            appChainUsdValue,
            isCore,
          );

          this.applyHydratedValue(address, value, {
            localTargets,
            detail: buildBalanceTraceDetail(
              {
                source: 'batchGetTotalBalance',
                force,
                isCore,
                appChainUsdValue,
                totalBalance: value.totalBalance,
              },
              trace,
            ),
          });
          continue;
        }

        this.markHydrateSkipped(address, {
          localTargets,
          detail: buildBalanceTraceDetail(
            {
              source: 'batchGetTotalBalance',
              force,
              isCore,
              reason: 'expired_or_missing',
            },
            trace,
          ),
        });
      }

      fetchList.push({ address, isCore });
    }

    if (!fetchList.length) {
      return;
    }

    const fetchAddresses = fetchList.map(item => item.address);
    await useAppChainStore.getState().batchGetAppChains(fetchAddresses, force);

    const results = await Promise.all(
      fetchList.map(async ({ address, isCore }) => {
        const localTargets = buildBalanceLocalTargets(address);
        const requestId = this.startRemoteFetch(address, {
          localTargets,
          detail: buildBalanceTraceDetail(
            {
              source: 'batchGetTotalBalance',
              force,
              isCore,
            },
            trace,
          ),
        });

        try {
          const queuedBalance = await getTotalBalanceQueue.add(async () => {
            return openapi.getTotalBalanceV2({
              address,
              isCore,
              included_token_uuids: [],
              excluded_token_uuids: [],
              excluded_protocol_ids: [],
              excluded_chain_ids: [],
            });
          });
          if (!queuedBalance) {
            throw new Error(
              'address balance remote task returned empty result',
            );
          }

          return {
            ok: true as const,
            address,
            isCore,
            requestId,
            localTargets,
            balance: queuedBalance,
          };
        } catch (error) {
          return {
            ok: false as const,
            address,
            isCore,
            requestId,
            localTargets,
            error,
          };
        }
      }),
    );

    results.forEach(result => {
      if (!result.ok) {
        this.markError(result.address, 'remote', result.error, {
          requestId: result.requestId,
          localTargets: result.localTargets,
          detail: buildBalanceTraceDetail(
            {
              source: 'batchGetTotalBalance',
              force,
              isCore: result.isCore,
            },
            trace,
          ),
        });
        return;
      }

      const appChainUsdValue = getAppChainUsdValue(result.address);
      const { formatBalance, value } = buildRemoteBalancePayload(
        result.balance,
        appChainUsdValue,
        result.isCore,
      );
      const applied = this.applyRemoteValue(
        result.address,
        result.requestId,
        value,
        {
          localTargets: result.localTargets,
          detail: buildBalanceTraceDetail(
            {
              source: 'batchGetTotalBalance',
              force,
              isCore: result.isCore,
              appChainUsdValue,
              totalBalance: value.totalBalance,
            },
            trace,
          ),
        },
      );

      if (!applied) {
        return;
      }

      this.persistInBackground(
        result.address,
        () => syncBalance(result.address, result.isCore, formatBalance),
        {
          requestId: result.requestId,
          localTargets: result.localTargets,
          detail: buildBalanceTraceDetail(
            {
              source: 'batchGetTotalBalance',
              force,
              isCore: result.isCore,
              totalBalance: formatBalance.total_usd_value,
            },
            trace,
          ),
        },
      );
    });
  };

  getTotalBalance = async (
    address: string,
    force = false,
    trace?: BalanceResourceTraceContext,
  ) => {
    const lowerAddress = address.toLowerCase();

    const addresses = await keyringService.getAllAddresses();
    const isCore = addresses
      .filter(item => isSameAddress(item.address, address))
      .some(item => CORE_KEYRING_TYPES.includes(item.type as any));
    const localTargets = buildBalanceLocalTargets(lowerAddress);
    let requestId: string | undefined;

    try {
      if (!force) {
        this.markHydrateStarted(lowerAddress, {
          localTargets,
          detail: buildBalanceTraceDetail(
            {
              source: 'getTotalBalance',
              force,
              isCore,
            },
            trace,
          ),
        });

        const isExpired = await BalanceEntity.isExpired(lowerAddress, isCore);
        if (!isExpired) {
          const cachedBalance = await BalanceEntity.queryBalance(
            lowerAddress,
            isCore,
          );
          const appChainUsdValue = getAppChainUsdValue(lowerAddress);
          const value = buildPersistedBalanceValue(
            cachedBalance,
            appChainUsdValue,
            isCore,
          );

          this.applyHydratedValue(lowerAddress, value, {
            localTargets,
            detail: buildBalanceTraceDetail(
              {
                source: 'getTotalBalance',
                force,
                isCore,
                appChainUsdValue,
                totalBalance: value.totalBalance,
              },
              trace,
            ),
          });
          return;
        }

        this.markHydrateSkipped(lowerAddress, {
          localTargets,
          detail: buildBalanceTraceDetail(
            {
              source: 'getTotalBalance',
              force,
              isCore,
              reason: 'expired_or_missing',
            },
            trace,
          ),
        });
      }

      await useAppChainStore.getState().getAppChains(lowerAddress, force);
      const appChainUsdValue = getAppChainUsdValue(lowerAddress);
      requestId = this.startRemoteFetch(lowerAddress, {
        localTargets,
        detail: buildBalanceTraceDetail(
          {
            source: 'getTotalBalance',
            force,
            isCore,
          },
          trace,
        ),
      });
      const balance = await openapi.getTotalBalanceV2({
        address: lowerAddress,
        isCore,
        included_token_uuids: [],
        excluded_token_uuids: [],
        excluded_protocol_ids: [],
        excluded_chain_ids: [],
      });
      const { formatBalance, value } = buildRemoteBalancePayload(
        balance,
        appChainUsdValue,
        isCore,
      );
      const applied = this.applyRemoteValue(lowerAddress, requestId, value, {
        localTargets,
        detail: buildBalanceTraceDetail(
          {
            source: 'getTotalBalance',
            force,
            isCore,
            appChainUsdValue,
            totalBalance: value.totalBalance,
          },
          trace,
        ),
      });

      if (!applied) {
        return;
      }

      this.persistInBackground(
        lowerAddress,
        () => syncBalance(lowerAddress, isCore, formatBalance),
        {
          requestId,
          localTargets,
          detail: buildBalanceTraceDetail(
            {
              source: 'getTotalBalance',
              force,
              isCore,
              totalBalance: formatBalance.total_usd_value,
            },
            trace,
          ),
        },
      );
    } catch (error) {
      this.markError(lowerAddress, requestId ? 'remote' : 'hydrate', error, {
        requestId,
        localTargets,
        detail: buildBalanceTraceDetail(
          {
            source: 'getTotalBalance',
            force,
            isCore,
          },
          trace,
        ),
      });
      throw error;
    }
  };

  computeTotalBalance = (
    addresses: string[],
    balanceAccounts: AccountsBalanceState['balance'] = balanceAccountsStore.getState()
      .balance,
  ) => {
    let total = 0;
    let totalEvm = 0;

    addresses.forEach(address => {
      const account = balanceAccounts[address.toLowerCase()];
      total += Number(account?.balance) || 0;
      totalEvm += Number(account?.evmBalance) || 0;
    });

    return { total, totalEvm };
  };

  useLoadBalanceFromApiStage = () => {
    const selectedAddresses = balanceAccountsStore(s => s.selectedAddresses);
    const hasResolvedSelection = balanceAccountsStore(
      s => s.hasResolvedSelection,
    );
    const isAnyBalanceLoadingWithoutValue = balanceAccountsStore(
      s => s.isAnyBalanceLoadingWithoutValue,
    );
    const isLoading =
      !hasResolvedSelection ||
      (selectedAddresses.length > 0 && isAnyBalanceLoadingWithoutValue);
    const loadBalanceFromApiStage: LoadBalanceStage = isLoading
      ? 'loading'
      : 'finished';

    return { loadBalanceFromApiStage };
  };

  fetchTotalBalance = makeSWRKeyAsyncFunc(
    async (fetchType: 'from_cache' | 'from_api') => {
      const retBalances = {} as Record<string, BalanceAccountType>;
      try {
        console.debug('[perf] fetchTotalBalance:: fetchType', fetchType);

        const { selectedAccounts, selectedAddresses, matteredAccountLength } =
          await getMatteredAccountsSnapshot();

        if (selectedAccounts.length) {
          await this.batchGetTotalBalance(
            selectedAddresses,
            fetchType === 'from_api',
            {
              scene: 'Home',
              requester: 'fetchTotalBalance',
              endpoint: 'openapi.getTotalBalanceV2',
            },
          );
        }

        const balanceValueMap = this.getAddressValueMap();
        Object.assign(
          retBalances,
          buildBalanceAccountsFromList(selectedAccounts, balanceValueMap),
        );
        setAccountsBalanceState(
          {
            balance: retBalances,
            selectedAddresses,
            hasResolvedSelection: true,
            matteredAccountLength,
            ...buildSelectedBalanceDerivedState(selectedAddresses, retBalances),
          },
          {
            source: 'manual_refresh',
          },
        );
      } catch (e) {
        console.error('fetchTotalBalance  error', e);
      }

      return retBalances;
    },
    ctx => {
      return `fetchTotalBalance-${ctx.args[0]}`;
    },
  );

  useAccountsBalanceTrigger = () => {
    const lastTimeStamps = useRef<number>(0);
    const isNeedFetchData = useCallback(() => {
      const currentTime = Date.now();
      const diff = currentTime - lastTimeStamps.current;
      if (diff > CACHE_TIME) {
        lastTimeStamps.current = currentTime;
        return true;
      }
      return false;
    }, []);

    const triggerUpdate = useCallback(
      async (forceFromApi?: boolean) => {
        const isForceFetchFromApi = isNeedFetchData() || forceFromApi;

        console.debug(
          '[perf] triggerUpdate fetchTotalBalance',
          isForceFetchFromApi ? 'from_api' : 'from_cache',
        );
        if (forceFromApi) {
          lastTimeStamps.current = Date.now();
        }
        return this.fetchTotalBalance(
          isForceFetchFromApi ? 'from_api' : 'from_cache',
        );
      },
      [isNeedFetchData],
    );

    return {
      triggerUpdate,
    };
  };
}

export interface BalanceAccountType {
  address: string;
  balance: number;
  evmBalance: number;
  type: KeyringTypeName;
  brandName: string;
  alias?: string;
  aliasName?: string;
}

export type AccountsBalanceState = {
  balance: Record<string, BalanceAccountType>;
  selectedAddresses: string[];
  hasResolvedSelection: boolean;
  matteredAccountLength: number;
  totalBalance: number;
  hasAnyBalanceValue: boolean;
  isAnyBalanceLoading: boolean;
  isAnyBalanceLoadingWithoutValue: boolean;
  isAnyBalanceFetchingRemote: boolean;
};

export type LoadBalanceStage = 'idle' | 'loading' | 'finished';

type AccountsBalanceChangeSource =
  | 'manual_refresh'
  | 'balance_changed'
  | 'accounts_changed';

type AccountsBalanceEventBusListeners = {
  SELECTION_CHANGED: (ctx: {
    prevAddresses: string[];
    nextAddresses: string[];
    balance: AccountsBalanceState['balance'];
    matteredAccountLength: number;
    source: AccountsBalanceChangeSource;
  }) => void;
  BALANCE_CHANGED: (ctx: {
    addresses: string[];
    changedAddresses: string[];
    balance: AccountsBalanceState['balance'];
    source: AccountsBalanceChangeSource;
  }) => void;
};

const { EventEmitter: AccountsBalanceEE } =
  makeJsEEClass<AccountsBalanceEventBusListeners>();

export const balanceAccountsStore = zCreate(
  zMutative<AccountsBalanceState>(() => ({
    balance: {},
    selectedAddresses: getCachedHomeTop10Addresses(),
    hasResolvedSelection: false,
    matteredAccountLength: 0,
    totalBalance: 0,
    hasAnyBalanceValue: false,
    isAnyBalanceLoading: false,
    isAnyBalanceLoadingWithoutValue: false,
    isAnyBalanceFetchingRemote: false,
  })),
);

export const accountsBalanceEvents = new AccountsBalanceEE();

const CACHE_TIME = HOME_REFRESH_INTERVAL;
let hasStartedAccountBalanceLifecycle = false;

function getCachedHomeTop10Addresses() {
  const cached = appStorage.getItem(APP_MMKV_WEAK_KEYS.HOME_TOP10_ADDRESSES) as
    | string[]
    | null;
  if (!Array.isArray(cached)) {
    return [];
  }

  return Array.from(
    new Set(
      cached
        .filter(address => typeof address === 'string' && !!address)
        .map(address => address.toLowerCase()),
    ),
  );
}

function persistCachedHomeTop10Addresses(addresses: string[]) {
  appStorage.setItem(
    APP_MMKV_WEAK_KEYS.HOME_TOP10_ADDRESSES,
    Array.from(
      new Set(addresses.filter(Boolean).map(address => address.toLowerCase())),
    ),
  );
}

const buildBalanceAccountsFromList = (
  accounts: KeyringAccountWithAlias[],
  balanceMap: Record<string, IBalanceData>,
) => {
  return accounts.reduce((acc, account) => {
    const lcAddr = account.address.toLowerCase();
    const balance = balanceMap[lcAddr];
    acc[lcAddr] = {
      address: lcAddr,
      balance: balance?.totalBalance || 0,
      evmBalance: balance?.evmBalance || 0,
      type: account.type,
      brandName: account.brandName,
      aliasName: account.aliasName,
    };

    return acc;
  }, {} as AccountsBalanceState['balance']);
};

function areAddressListsEqual(prev: string[], next: string[]) {
  if (prev.length !== next.length) {
    return false;
  }

  return prev.every((address, index) => address === next[index]);
}

function getChangedBalanceAddresses(
  prevBalance: AccountsBalanceState['balance'],
  nextBalance: AccountsBalanceState['balance'],
  selectedAddresses: string[],
) {
  return selectedAddresses.filter(address => {
    const prev = prevBalance[address];
    const next = nextBalance[address];

    return (
      prev?.balance !== next?.balance || prev?.evmBalance !== next?.evmBalance
    );
  });
}

function setAccountsBalanceState(
  valOrFunc: UpdaterOrPartials<AccountsBalanceState>,
  meta?: {
    source: AccountsBalanceChangeSource;
  },
) {
  const prevState = balanceAccountsStore.getState();
  balanceAccountsStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(prev, valOrFunc, {
      strict: true,
    });
    if (!changed) {
      return prev;
    }

    return newVal;
  });

  const nextState = balanceAccountsStore.getState();
  if (nextState === prevState || !meta) {
    return;
  }

  const selectionChanged = !areAddressListsEqual(
    prevState.selectedAddresses,
    nextState.selectedAddresses,
  );
  const changedAddresses = getChangedBalanceAddresses(
    prevState.balance,
    nextState.balance,
    nextState.selectedAddresses,
  );

  if (selectionChanged) {
    persistCachedHomeTop10Addresses(nextState.selectedAddresses);
    accountsBalanceEvents.emit('SELECTION_CHANGED', {
      prevAddresses: prevState.selectedAddresses,
      nextAddresses: nextState.selectedAddresses,
      balance: nextState.balance,
      matteredAccountLength: nextState.matteredAccountLength,
      source: meta.source,
    });
  }

  if (changedAddresses.length) {
    accountsBalanceEvents.emit('BALANCE_CHANGED', {
      addresses: nextState.selectedAddresses,
      changedAddresses,
      balance: nextState.balance,
      source: meta.source,
    });
  }
}

function buildBalanceAccountsFromSelectedState(
  current: AccountsBalanceState['balance'],
  balanceMap: Record<string, IBalanceData>,
  selectedAddresses: string[],
) {
  return selectedAddresses.reduce((acc, address) => {
    const prev = current[address];
    const latest = balanceMap[address];

    acc[address] = {
      address,
      balance: latest?.totalBalance || 0,
      evmBalance: latest?.evmBalance || 0,
      type: prev?.type || ('' as KeyringTypeName),
      brandName: prev?.brandName || '',
      aliasName: prev?.aliasName,
    };

    return acc;
  }, {} as AccountsBalanceState['balance']);
}

function buildSelectedBalanceDerivedState(
  selectedAddresses: string[],
  balanceAccounts: AccountsBalanceState['balance'],
) {
  const snapshots = addressBalanceStore.getAddressesSnapshot(selectedAddresses);

  return snapshots.reduce(
    (acc, snapshot) => {
      acc.totalBalance += balanceAccounts[snapshot.address]?.balance || 0;

      if (snapshot.flow.hasValue) {
        acc.hasAnyBalanceValue = true;
      }
      if (snapshot.flow.isLoading) {
        acc.isAnyBalanceLoading = true;
      }
      if (snapshot.flow.isLoadingWithoutValue) {
        acc.isAnyBalanceLoadingWithoutValue = true;
      }
      if (snapshot.flow.isFetchingRemote) {
        acc.isAnyBalanceFetchingRemote = true;
      }

      return acc;
    },
    {
      totalBalance: 0,
      hasAnyBalanceValue: false,
      isAnyBalanceLoading: false,
      isAnyBalanceLoadingWithoutValue: false,
      isAnyBalanceFetchingRemote: false,
    },
  );
}

async function pickSelectedAccountsFromSortedAccounts(
  sortedAccounts: KeyringAccountWithAlias[],
) {
  const { topAccounts, topAddresses } = filterOutTopAccounts(sortedAccounts, {
    topCount: 10,
    gatherSameAddress: false,
  });

  return {
    selectedAccounts: unionBy(topAccounts, account =>
      account.address.toLowerCase(),
    ),
    selectedAddresses: topAddresses.map(address => address.toLowerCase()),
  };
}

async function getSortedMyAccountsSnapshot() {
  const balanceMap = addressBalanceStore.getAddressValueMap();
  const accounts = await keyringService.getAllVisibleAccountsArray();
  const myAccounts = filterMyAccounts(
    accounts.map(account => {
      const lowerAddress = account.address.toLowerCase();
      const balance = balanceMap[lowerAddress];
      return {
        ...account,
        aliasName:
          contactService.getAliasByAddress(account.address)?.alias || '',
        evmBalance: balance?.evmBalance || 0,
        balance: balance?.totalBalance || 0,
      } satisfies KeyringAccountWithAlias;
    }),
  );

  return sortAccountList(myAccounts, {
    highlightedAddresses: preferenceService.getPinAddresses(),
  });
}

async function getMatteredAccountsSnapshot() {
  const sortedAccounts = await getSortedMyAccountsSnapshot();
  const matteredAccountLength = sortedAccounts.length;
  const { selectedAccounts, selectedAddresses } =
    await pickSelectedAccountsFromSortedAccounts(sortedAccounts);

  return {
    selectedAccounts,
    selectedAddresses,
    matteredAccountLength,
  };
}

async function warmupSelectedAccountsBalance(
  selectedAccounts: KeyringAccountWithAlias[],
) {
  await addressBalanceStore.hydrateCachedBalancesForAccounts(selectedAccounts);
}

const accountBalanceSelectionLifecycleStateRef = {
  promise: null as Promise<void> | null,
  hasSubscribed: false,
  prevSelectionSignature: '',
};

async function initAccountBalanceSelectionLifecycle() {
  console.time('initAccountBalanceSelectionLifecycle');

  try {
    const { default: accountStore } = await import('./account');

    const syncSelectionFromAccounts = async () => {
      const { selectedAccounts, selectedAddresses, matteredAccountLength } =
        await getMatteredAccountsSnapshot();
      await warmupSelectedAccountsBalance(selectedAccounts);
      const nextBalance = buildBalanceAccountsFromList(
        selectedAccounts,
        addressBalanceStore.getAddressValueMap(),
      );

      setAccountsBalanceState(
        prev => ({
          ...prev,
          balance: nextBalance,
          selectedAddresses,
          hasResolvedSelection: true,
          matteredAccountLength,
          ...buildSelectedBalanceDerivedState(selectedAddresses, nextBalance),
        }),
        {
          source: 'accounts_changed',
        },
      );
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

export const syncBalanceAccountStore = () => {
  const state = balanceAccountsStore.getState();
  if (!state.selectedAddresses.length) {
    return;
  }

  const nextBalance = buildBalanceAccountsFromSelectedState(
    state.balance,
    addressBalanceStore.getAddressValueMap(),
    state.selectedAddresses,
  );

  setAccountsBalanceState(
    {
      balance: nextBalance,
      ...buildSelectedBalanceDerivedState(state.selectedAddresses, nextBalance),
    },
    {
      source: 'balance_changed',
    },
  );
};

export function startProcessAccountBalanceEvents() {
  if (hasStartedAccountBalanceLifecycle) {
    return;
  }
  hasStartedAccountBalanceLifecycle = true;

  keyringService.on('removedAccount', async account => {
    const addresses = await keyringService.getAllAddresses();
    const stillExists = addresses.some(item => {
      return isSameAddress(item.address, account.address);
    });

    if (stillExists) {
      return;
    }

    addressBalanceStore.removeAddressBalance(account.address, {
      source: 'keyringService.removedAccount',
      reason: 'address_deleted',
    });
  });

  perfEvents.subscribe('USER_MANUALLY_UNLOCK', async () => {
    syncBalanceAccountStore();
  });

  keyringService.once('unlock', () => {
    ensureAccountBalanceSelectionLifecycle().catch(error => {
      console.error('ensureAccountBalanceSelectionLifecycle::error', error);
    });
  });

  addressBalanceStore.subscribe(() => {
    const current = balanceAccountsStore.getState();
    if (!current.selectedAddresses.length) {
      return;
    }

    const nextBalance = buildBalanceAccountsFromSelectedState(
      current.balance,
      addressBalanceStore.getAddressValueMap(),
      current.selectedAddresses,
    );

    setAccountsBalanceState(
      {
        ...current,
        balance: nextBalance,
        ...buildSelectedBalanceDerivedState(
          current.selectedAddresses,
          nextBalance,
        ),
      },
      {
        source: 'balance_changed',
      },
    );
  });
}

export const addressBalanceStore = new AddressBalanceStore();

registerAccountBalanceSnapshotProvider({
  getAddressValueMap: () => addressBalanceStore.getAddressValueMap(),
});

export default addressBalanceStore;
export { getCachedHomeTop10Addresses };
