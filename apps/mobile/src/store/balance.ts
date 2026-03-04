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
import { useAppChainStore } from './appchain';

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
  getIsTop10BalanceLoading: (
    myTop10Addresses: string[],
    isLoadingByAddress?: BalanceState['isLoadingByAddress'],
  ) => {
    isTop10BalanceLoading: boolean;
  };
}

const getTotalBalanceQueue = new PQueue({
  interval: 1000,
  intervalCap: 10,
});

const balanceStore = zCreate<BalanceState>(set => ({
  balanceMap: {},
  chainUSDMap: {},
  isLoadingByAddress: {},
  // balance24HMap: {},
  // curveMap: {},
  // tokenUSDMapByChain: {},
  // defiUSDMapByChain: {},

  async initStore() {
    // 在 App 启动时执行，初始化冷备数据
    const balanceMap: Record<string, IBalanceData> = {};
    const chainUSDMap: Record<string, ChainWithBalance[]> = {};

    const res = await BalanceEntity.queryAllBalance();
    const appChainMap = useAppChainStore.getState().appChainMap;
    for (const item of res) {
      const lowerAddr = item.owner_addr.toLowerCase();
      const evmBalance = item.evm_usd_value || 0;
      const appChains = appChainMap[lowerAddr] ?? [];
      const appChainUsdValue = appChains.reduce(
        (acc, appChain) => acc + (appChain.netWorth || 0),
        0,
      );
      balanceMap[lowerAddr] = {
        evmBalance,
        totalBalance: evmBalance + appChainUsdValue,
      };
      chainUSDMap[lowerAddr] = item.chain_list;
    }
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
    const lowerAddresses = Array.from(
      new Set(top10Addresses.map(item => item.toLowerCase())),
    );
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

    for (const address of lowerAddresses) {
      const lowerAddress = address.toLowerCase();
      const isCore = coreAddressSet.has(lowerAddress);
      if (!force) {
        const isExpired = await BalanceEntity.isExpired(lowerAddress, isCore);

        if (!isExpired) {
          const res = await BalanceEntity.queryBalance(lowerAddress, isCore);
          const evmBalance = res.evm_usd_value || 0;
          const appChainUsdValue = useAppChainStore
            .getState()
            .getAppChainTotalUsdValue(lowerAddress);
          cacheBalanceMap[lowerAddress] = {
            evmBalance,
            totalBalance: evmBalance + appChainUsdValue,
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
    console.log('updateBalance batchGetTotalBalance');

    // 先批量获取 appchain 数据
    const fetchAddresses = fetchList.map(item => item.address);
    await useAppChainStore.getState().batchGetAppChains(fetchAddresses, force);

    const results = await Promise.allSettled(
      fetchList.map(({ address, isCore }) =>
        getTotalBalanceQueue.add<{
          address: string;
          isCore: boolean;
          formatBalance: EvmTotalBalanceResponse;
          appChainUsdValue: number;
        }>(async () => {
          const balance = await openapi.getTotalBalanceV2({
            address,
            isCore,
            included_token_uuids: [],
            excluded_token_uuids: [],
            excluded_protocol_ids: [],
            excluded_chain_ids: [],
          });
          console.log('updateBalance batchGetTotalBalance single', address);

          const evmUsdValue = balance.total_usd_value;
          const appChainUsdValue = useAppChainStore
            .getState()
            .getAppChainTotalUsdValue(address);

          const formatBalance: EvmTotalBalanceResponse = {
            ...balance,
            evm_usd_value: evmUsdValue,
            total_usd_value: evmUsdValue + appChainUsdValue,
          };

          syncBalance(address, isCore, formatBalance);
          return { address, isCore, formatBalance, appChainUsdValue };
        }),
      ),
    );

    const latestBalanceMap: Record<string, IBalanceData> = {};
    const latestChainUSDMap: Record<string, ChainWithBalance[]> = {};
    const finishedLoadingMap: Record<string, boolean> = {};
    results.forEach(result => {
      if (result.status !== 'fulfilled') {
        return;
      }
      if (!result.value) {
        return;
      }
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
        const evmBalance = res.evm_usd_value || 0;
        const appChainUsdValue = useAppChainStore
          .getState()
          .getAppChainTotalUsdValue(lowerAddress);
        set(state => ({
          balanceMap: {
            ...state.balanceMap,
            [lowerAddress]: {
              evmBalance,
              totalBalance: evmBalance + appChainUsdValue,
            },
          },
          chainUSDMap: {
            ...state.chainUSDMap,
            [lowerAddress]: res.chain_list,
          },
        }));
        return;
      }

      // 获取 appchain 数据
      await useAppChainStore.getState().getAppChains(lowerAddress, force);
      const appChainUsdValue = useAppChainStore
        .getState()
        .getAppChainTotalUsdValue(lowerAddress);

      const balance = await openapi.getTotalBalanceV2({
        address: lowerAddress,
        isCore: core,
        included_token_uuids: [],
        excluded_token_uuids: [],
        excluded_protocol_ids: [],
        excluded_chain_ids: [],
      });

      console.log('updateBalance getTotalBalance', lowerAddress);
      const evmUsdValue = balance.total_usd_value;
      const formatBalance: EvmTotalBalanceResponse = {
        ...balance,
        evm_usd_value: evmUsdValue,
        total_usd_value: evmUsdValue + appChainUsdValue,
      };

      set(state => ({
        balanceMap: {
          ...state.balanceMap,
          [lowerAddress]: {
            evmBalance: evmUsdValue,
            totalBalance: evmUsdValue + appChainUsdValue,
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

  getIsTop10BalanceLoading(
    myTop10Addresses: string[],
    isLoadingByAddress: BalanceState['isLoadingByAddress'] = balanceStore.getState()
      .isLoadingByAddress,
  ) {
    const isTop10BalanceLoading = (() => {
      if (!myTop10Addresses.length) {
        return false;
      }
      return myTop10Addresses.some(
        address => isLoadingByAddress[address.toLowerCase()],
      );
    })();

    return {
      isTop10BalanceLoading,
    };
  },
}));

export default balanceStore;
