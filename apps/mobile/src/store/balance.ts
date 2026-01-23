import { getTop10MyAccounts } from '@/core/apis/account';
import { openapi } from '@/core/request';
import { keyringService } from '@/core/services';
import { zCreate } from '@/core/utils/reexports';
import { BalanceEntity } from '@/databases/entities/balance';
import { EvmTotalBalanceResponse } from '@/databases/hooks/balance';
import { syncBalance } from '@/databases/sync/assets';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { CORE_KEYRING_TYPES } from '@rabby-wallet/keyring-utils';
import { ChainWithBalance } from '@rabby-wallet/rabby-api/dist/types';
import PQueue from 'p-queue';

export interface CURVE_STEP_ITEM {
  timestamp: number;
  usd_value: number;
}

export interface IBalanceData {
  evmBalance: number;
  totalBalance: number;
}

interface BalanceState {
  balanceMap: Record<string, IBalanceData>;
  chainUSDMap: Record<string, ChainWithBalance[]>;
  isLoadingByAddress: Record<string, boolean>;
  initStore(): void;
  batchGetTotalBalance: (
    top10Addresses: string[],
    force?: boolean,
  ) => Promise<void>;
  getTotalBalance: (address: string, force?: boolean) => Promise<void>;
  // balance24HMap: Record<string, number>;
  // isLoadingByAddress: Record<string, boolean>;
  // curveMap: Record<string, CURVE_STEP_ITEM[]>;
  // tokenUSDMapByChain: Record<string, Record<string, number>>;
  // defiUSDMapByChain: Record<string, Record<string, number>>;
}

const getTotalBalanceQueue = new PQueue({
  interval: 1000,
  intervalCap: 10,
});

const balanceStore = zCreate<BalanceState>((set, get) => ({
  balanceMap: {},
  chainUSDMap: {},
  isLoadingByAddress: {},
  // balance24HMap: {},
  // curveMap: {},
  // tokenUSDMapByChain: {},
  // defiUSDMapByChain: {},

  async initStore() {
    // 在 App 启动时执行，初始化冷备数据
    // 取 Top10 地址
    const balanceMap: Record<string, IBalanceData> = {};
    const chainUSDMap: Record<string, ChainWithBalance[]> = {};

    const res = await BalanceEntity.queryAllBalance();
    res.forEach(item => {
      balanceMap[item.owner_addr.toLowerCase()] = {
        totalBalance: item.balance,
        evmBalance: item.evm_usd_value || 0,
      };
      chainUSDMap[item.owner_addr.toLowerCase()] = item.chain_list;
    });
    // 写入 Store
    set(() => ({ balanceMap, chainUSDMap }));
  },

  async batchGetTotalBalance(top10Addresses: string[], force = false) {
    if (!top10Addresses.length) {
      set(() => ({
        balanceMap: {},
        chainUSDMap: {},
        isLoadingByAddress: {},
      }));
      return;
    }

    const addresses = await keyringService.getAllAddresses();
    const coreAddressSet = new Set(
      addresses
        .filter(item => CORE_KEYRING_TYPES.includes(item.type as any))
        .map(item => item.address.toLowerCase()),
    );

    const cacheBalanceMap: Record<string, IBalanceData> = {};
    const cacheChainUSDMap: Record<string, ChainWithBalance[]> = {};
    const nextLoadingMap: Record<string, boolean> = {};
    const fetchList: Array<{ address: string; isCore: boolean }> = [];

    for (const address of top10Addresses) {
      const lowerAddress = address.toLowerCase();
      const isCore = coreAddressSet.has(lowerAddress);
      if (!force) {
        const isExpired = await BalanceEntity.isExpired(lowerAddress, isCore);

        if (!isExpired) {
          const res = await BalanceEntity.queryBalance(lowerAddress, isCore);
          cacheBalanceMap[lowerAddress] = {
            totalBalance: res.total_usd_value,
            evmBalance: res.evm_usd_value || 0,
          };
          cacheChainUSDMap[lowerAddress] = res.chain_list;
          nextLoadingMap[lowerAddress] = false;
          continue;
        }
      }
      nextLoadingMap[lowerAddress] = true;
      fetchList.push({ address: lowerAddress, isCore });
    }

    set(state => ({
      balanceMap: {
        ...state.balanceMap,
        ...cacheBalanceMap,
      },
      chainUSDMap: {
        ...state.chainUSDMap,
        ...cacheChainUSDMap,
      },
      isLoadingByAddress: {
        ...state.isLoadingByAddress,
        ...nextLoadingMap,
      },
    }));

    if (!fetchList.length) {
      return;
    }

    const results = await Promise.allSettled(
      fetchList.map(({ address, isCore }) =>
        getTotalBalanceQueue.add<{
          address: string;
          isCore: boolean;
          formatBalance: EvmTotalBalanceResponse;
        }>(async () => {
          const balance = await openapi.getTotalBalanceV2({
            address,
            isCore,
            included_token_uuids: [],
            excluded_token_uuids: [],
            excluded_protocol_ids: [],
            excluded_chain_ids: [], // TODO: 移除 include 和 exclude 参数
          });

          const formatBalance: EvmTotalBalanceResponse = {
            ...balance,
            evm_usd_value: balance.total_usd_value,
          };
          try {
            const { apps } = await openapi.getAppChainList(address);
            let appChainTotalNetWorth = 0;
            apps?.forEach(app => {
              app?.portfolio_item_list?.forEach(item => {
                appChainTotalNetWorth += item.stats.net_usd_value;
              });
            });
            formatBalance.total_usd_value =
              appChainTotalNetWorth + formatBalance.total_usd_value;
          } catch (error) {
            // just ignore appChain data
          }
          syncBalance(address, isCore, formatBalance);
          return { address, isCore, formatBalance };
        }),
      ),
    );

    const latestBalanceMap: Record<string, IBalanceData> = {};
    const latestChainUSDMap: Record<string, ChainWithBalance[]> = {};
    const finishedLoadingMap: Record<string, boolean> = {};
    results.forEach(result => {
      if (result.status !== 'fulfilled') return;
      if (!result.value) return;
      const { address, formatBalance } = result.value;
      latestBalanceMap[address] = {
        totalBalance: formatBalance.total_usd_value,
        evmBalance: formatBalance.evm_usd_value || 0,
      };
      latestChainUSDMap[address] = formatBalance.chain_list;
    });
    fetchList.forEach(({ address }) => {
      finishedLoadingMap[address] = false;
    });

    set(state => ({
      balanceMap: {
        ...state.balanceMap,
        ...latestBalanceMap,
      },
      chainUSDMap: {
        ...state.chainUSDMap,
        ...latestChainUSDMap,
      },
      isLoadingByAddress: {
        ...state.isLoadingByAddress,
        ...finishedLoadingMap,
      },
    }));
  },

  async getTotalBalance(address: string, force = false) {
    const lowerAddress = address.toLowerCase();
    set(state => ({
      isLoadingByAddress: {
        ...state.isLoadingByAddress,
        [lowerAddress]: true,
      },
    }));
    const isExpired = await BalanceEntity.isExpired(address, true);
    const addresses = await keyringService.getAllAddresses();
    const filtered = addresses.filter(item =>
      isSameAddress(item.address, address),
    );
    let core = false;
    if (filtered.some(item => CORE_KEYRING_TYPES.includes(item.type as any))) {
      core = true;
    }
    try {
      if (!force && !isExpired) {
        const res = await BalanceEntity.queryBalance(address, core);
        set(state => ({
          balanceMap: {
            ...state.balanceMap,
            [lowerAddress]: {
              totalBalance: res.total_usd_value,
              evmBalance: res.evm_usd_value || 0,
            },
          },
          chainUSDMap: {
            ...state.chainUSDMap,
            [lowerAddress]: res.chain_list,
          },
        }));
        return;
      }
      const balance = await openapi.getTotalBalanceV2({
        address: lowerAddress,
        isCore: core,
        included_token_uuids: [],
        excluded_token_uuids: [],
        excluded_protocol_ids: [],
        excluded_chain_ids: [], // TODO: 移除 include 和 exclude 参数
      });
      const formatBalance: EvmTotalBalanceResponse = {
        ...balance,
        evm_usd_value: balance.total_usd_value,
      };
      try {
        const { apps } = await openapi.getAppChainList(lowerAddress);
        let appChainTotalNetWorth = 0;
        apps?.forEach(app => {
          app?.portfolio_item_list?.forEach(item => {
            appChainTotalNetWorth += item.stats.net_usd_value;
          });
        });
        formatBalance.total_usd_value =
          appChainTotalNetWorth + formatBalance.total_usd_value;
      } catch (error) {
        // just ignore appChain data
      }
      set(state => ({
        balanceMap: {
          ...state.balanceMap,
          [lowerAddress]: {
            totalBalance: formatBalance.total_usd_value,
            evmBalance: formatBalance.evm_usd_value || 0,
          },
        },
        chainUSDMap: {
          ...state.chainUSDMap,
          [lowerAddress]: formatBalance.chain_list,
        },
      }));
      syncBalance(lowerAddress, core, formatBalance);
    } finally {
      set(state => ({
        isLoadingByAddress: {
          ...state.isLoadingByAddress,
          [lowerAddress]: false,
        },
      }));
    }
  },
}));

export default balanceStore;
