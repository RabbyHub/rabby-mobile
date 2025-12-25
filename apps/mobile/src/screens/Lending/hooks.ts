import {
  EmodeDataHumanized,
  Pool,
  PoolBundle,
  ReservesDataHumanized,
  UiPoolDataProvider,
  UserReserveDataHumanized,
  UserWalletBalancesResponse,
  WalletBalanceProvider,
} from '@aave/contract-helpers';
import {
  formatReserves,
  formatReservesAndIncentives,
  formatUserSummaryAndIncentives,
  nativeToUSD,
  normalize,
  USD_DECIMALS,
} from '@aave/math-utils';
import { ethers } from 'ethers';
import dayjs from 'dayjs';
import { atom, useAtom, useAtomValue } from 'jotai';
import { useCallback, useMemo } from 'react';
import { InteractionManager, unstable_batchedUpdates } from 'react-native';
import { BigNumber } from 'bignumber.js';
import { FormattedReservesAndIncentives, formatUserYield } from './utils/apy';
import { CustomMarket, MarketDataType, marketsData } from './config/market';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import wrapperToken from './config/wrapperToken';
import { CHAINS_ENUM } from '@debank/common';
import { API_ETH_MOCK_ADDRESS } from './utils/constant';
import { DisplayPoolReserveInfo, UserSummary } from './type';
import {
  storeApiAccountsSwitcher,
  useSceneAccountInfo,
} from '@/hooks/accountsSwitcher';
import {
  atomByMMKV,
  makeJotaiJsonStore,
  makeMMKVStorage,
  MMKVStorageStrategy,
} from '@/core/storage/mmkv';
import { findChainByID } from '@/utils/chain';
import { getProvider } from './provider';
import { fetchIconSymbolAndName, IconSymbolInterface } from './utils/icon';
import { ExtractAtomValueType, RefLikeObject } from '@/utils/type';
import { jotaiStore, zCreate } from '@/core/utils/reexports';
import {
  resolveValFromUpdater,
  runIIFEFunc,
  UpdaterOrPartials,
} from '@/core/utils/store';
import { makeSWRKeyAsyncFunc } from '@/core/utils/concurrency';
import { debounce } from 'lodash';
import {
  worker_formatReserves,
  worker_formatReservesAndIncentives,
  worker_formatUserSummaryAndIncentives,
} from '@/perfs/workerReq';
import { StoreApi, UseBoundStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { isValidAddress } from '@ethereumjs/util';
import { nativeToWrapper } from './config/nativeToWrapper';

const marketAtom = atomByMMKV('@lendingMarket', CustomMarket.proto_mainnet_v3, {
  storage: MMKVStorageStrategy.compatString,
});

const getMarketInfo = (market?: CustomMarket) => {
  const marketData: MarketDataType | undefined =
    !!market && marketsData[market as CustomMarket]
      ? marketsData[market as CustomMarket]
      : undefined;
  const chainEnum = marketData?.chainId
    ? findChainByID(marketData?.chainId)?.enum
    : undefined;
  const chainInfo = marketData?.chainId
    ? findChainByID(marketData?.chainId)
    : undefined;
  const isMainnet = chainEnum === CHAINS_ENUM.ETH;
  return {
    marketData,
    chainEnum,
    chainInfo,
    isMainnet,
  };
};

export const useSelectedMarket = () => {
  const [market, setMarket] = useAtom(marketAtom);
  const { marketData, chainEnum, chainInfo, isMainnet } = useMemo(
    () => getMarketInfo(market),
    [market],
  );

  return {
    marketKey: market,
    selectedMarketData: marketData,
    setMarketKey: setMarket,
    chainEnum,
    chainInfo,
    isMainnet,
  };
};

const poolsMap = new Map<
  CustomMarket,
  {
    provider: ethers.providers.Web3Provider;
    uiPoolDataProvider: UiPoolDataProvider;
    walletBalanceProvider: WalletBalanceProvider;
    pool: Pool;
    poolBundle: PoolBundle;
  }
>();

const getCachePools = (marketKey?: CustomMarket) => {
  const { marketData: selectedMarketData, chainInfo } =
    getMarketInfo(marketKey);
  if (!marketKey || !selectedMarketData) {
    return undefined;
  }
  const existingPools = poolsMap.get(marketKey as CustomMarket);
  if (existingPools) {
    return existingPools;
  }
  const provider = getProvider(chainInfo?.network || '');
  const newPools = {
    provider,
    uiPoolDataProvider: new UiPoolDataProvider({
      uiPoolDataProviderAddress:
        selectedMarketData.addresses.UI_POOL_DATA_PROVIDER,
      provider,
      chainId: selectedMarketData.chainId,
    }),
    walletBalanceProvider: new WalletBalanceProvider({
      walletBalanceProviderAddress:
        selectedMarketData.addresses.WALLET_BALANCE_PROVIDER,
      provider,
    }),
    pool: new Pool(provider, {
      POOL: selectedMarketData.addresses.LENDING_POOL,
      REPAY_WITH_COLLATERAL_ADAPTER:
        selectedMarketData.addresses.REPAY_WITH_COLLATERAL_ADAPTER,
      SWAP_COLLATERAL_ADAPTER:
        selectedMarketData.addresses.SWAP_COLLATERAL_ADAPTER,
      WETH_GATEWAY: selectedMarketData.addresses.WETH_GATEWAY,
      L2_ENCODER: selectedMarketData.addresses.L2_ENCODER,
    }),
    poolBundle: new PoolBundle(provider, {
      POOL: selectedMarketData.addresses.LENDING_POOL,
      WETH_GATEWAY: selectedMarketData.addresses.WETH_GATEWAY,
      L2_ENCODER: selectedMarketData.addresses.L2_ENCODER,
    }),
  };
  poolsMap.set(marketKey as CustomMarket, newPools);
  return newPools;
};

const fetchContractData = async (address: string) => {
  const selectedMarketData = getSelectedMarketInfo().marketData;
  const pools = getPools();
  if (!selectedMarketData || !pools) {
    return {};
  }

  try {
    const [reserves, userReserves, walletBalances, eModes] = await Promise.all([
      pools.uiPoolDataProvider.getReservesHumanized({
        lendingPoolAddressProvider:
          selectedMarketData.addresses.LENDING_POOL_ADDRESS_PROVIDER,
      }),
      pools.uiPoolDataProvider.getUserReservesHumanized({
        lendingPoolAddressProvider:
          selectedMarketData.addresses.LENDING_POOL_ADDRESS_PROVIDER,
        user: address,
      }),
      pools.walletBalanceProvider.getUserWalletBalancesForLendingPoolProvider(
        address,
        selectedMarketData.addresses.LENDING_POOL_ADDRESS_PROVIDER,
      ),
      pools.uiPoolDataProvider.getEModesHumanized({
        lendingPoolAddressProvider:
          selectedMarketData.addresses.LENDING_POOL_ADDRESS_PROVIDER,
      }),
    ]);

    return {
      reserves,
      userReserves,
      walletBalances,
      // walletBalances: EMPTY_WALLET_BALANCES as UserWalletBalancesResponse,
      eModes,
    };
  } catch (error) {
    console.error('CUSTOM_LOGGER:=>: error', error);
    return {};
  }
};
export const usePoolDataProviderContract = () => {
  const { selectedMarketData, marketKey, chainEnum } = useSelectedMarket();
  const pools = useMemo(() => {
    if (!marketKey || !selectedMarketData) {
      return undefined;
    }
    return getCachePools(marketKey);
  }, [marketKey, selectedMarketData]);

  return {
    pools,
    selectedMarketData,
    chainEnum,
  };
};

const EMPTY_WALLET_BALANCES: UserWalletBalancesResponse = { 0: [], 1: [] };

type RemoteDataState = {
  reserves: ReservesDataHumanized | undefined;
  userReserves:
    | {
        userReserves: UserReserveDataHumanized[];
        userEmodeCategoryId: number;
      }
    | undefined;
  walletBalances: UserWalletBalancesResponse;
  eModes: EmodeDataHumanized[] | undefined;
};

function getInitData() {
  return {
    reserves: undefined,
    userReserves: undefined,
    walletBalances: EMPTY_WALLET_BALANCES,
    eModes: undefined,
  };
}
// const addressAtom = atom<string | undefined>(undefined);
// const loadingAtom = atom<boolean>(false);
// const refreshHistoryIdAtom = atom<number>(0);

// const remoteDataAtom = atom<RemoteDataState>(getInitData());
const remoteDataState = zCreate<RemoteDataState>(() => getInitData());

const lendingLoadState = zCreate<{
  address: string | undefined;
  loading: boolean;
  refreshHistoryId: number;
}>(() => ({
  address: undefined,
  loading: false,
  refreshHistoryId: 0,
}));

function mapItem<T extends IconSymbolInterface>(item: T): T {
  return {
    ...item,
    ...fetchIconSymbolAndName(item),
  };
}

function re_formatReserves(params: Parameters<typeof formatReserves>[0]) {
  return (formatReserves(params) || []).map(mapItem);
}

// function re_formatReservesAndIncentives(
//   params: Parameters<typeof formatReservesAndIncentives>[0],
// ) {
//   return (formatReservesAndIncentives(params) || []).map(
//     mapItem,
//   ) as unknown as FormattedReservesAndIncentives[];
// }

const DEFAULT_RESERVES_AND_INCENTIVES = {
  formattedReserves: null as null | ReturnType<typeof re_formatReserves>,
  formattedPoolReservesAndIncentives: [] as FormattedReservesAndIncentives[],
};

async function computeFormattedReservesAndIncentives({
  reserves,
  eModes,
}: {
  reserves: ReservesDataHumanized | undefined;
  eModes: EmodeDataHumanized[] | undefined;
}) {
  if (!reserves) {
    return DEFAULT_RESERVES_AND_INCENTIVES;
  }

  const reservesArray = reserves.reservesData;
  const baseCurrencyData = reserves.baseCurrencyData;
  const currentTimestamp = dayjs().unix();

  const formattedReserves = (
    (await worker_formatReserves({
      reserves: reservesArray,
      currentTimestamp,
      eModes,
      marketReferenceCurrencyDecimals:
        baseCurrencyData.marketReferenceCurrencyDecimals,
      marketReferencePriceInUsd:
        baseCurrencyData.marketReferenceCurrencyPriceInUsd,
    })) || []
  ).map(mapItem);
  console.debug(
    '[perf] formattedReservesAndIncentivesAtom:: formattedReserves',
    formattedReserves,
  );
  const formattedPoolReservesAndIncentives = (
    (await worker_formatReservesAndIncentives({
      reserves: reservesArray,
      currentTimestamp,
      marketReferenceCurrencyDecimals:
        baseCurrencyData.marketReferenceCurrencyDecimals,
      marketReferencePriceInUsd:
        baseCurrencyData.marketReferenceCurrencyPriceInUsd,
      reserveIncentives: [],
      eModes,
    })) || []
  ).map(mapItem) as unknown as FormattedReservesAndIncentives[];
  console.debug(
    '[perf] formattedReservesAndIncentivesAtom:: formattedPoolReservesAndIncentives',
    formattedPoolReservesAndIncentives,
  );

  return {
    formattedReserves,
    formattedPoolReservesAndIncentives,
  };
}

export function useFormattedReservesAtom() {
  // return formattedReservesAndIncentivesState(s => s.formattedReserves);
  return computedInfoState(
    s => s.formattedReservesAndIncentivesState.formattedReserves,
  );
}

export function useFormattedPoolReservesAndIncentivesAtom() {
  // return formattedReservesAndIncentivesState(
  //   s => s.formattedPoolReservesAndIncentives,
  // );
  return computedInfoState(
    s =>
      s.formattedReservesAndIncentivesState.formattedPoolReservesAndIncentives,
  );
}

// const iUserSummaryState = zCreate<null | UserSummary>(() => null);

async function computeIUserSummary({
  userReserves,
  reserves,
  formattedReserves,
}: Pick<RemoteDataState, 'userReserves' | 'reserves'> & {
  formattedReserves: ReturnType<typeof formatReservesAndIncentives> | null;
}) {
  // const formattedReserves = formattedReservesAndIncentivesState.getState().formattedReserves;

  if (!userReserves || !formattedReserves) {
    return null;
  }

  const baseCurrencyData = reserves?.baseCurrencyData;
  if (!baseCurrencyData) {
    return null;
  }

  const currentTimestamp = dayjs().unix();
  const userReservesArray = userReserves.userReserves;

  console.debug(
    '[perf] iUserSummaryAtom:: userReservesArray, formattedReserves',
    userReservesArray,
    formattedReserves,
  );

  const startTime = Date.now();

  const syncResult = await worker_formatUserSummaryAndIncentives({
    currentTimestamp,
    marketReferencePriceInUsd:
      baseCurrencyData.marketReferenceCurrencyPriceInUsd,
    marketReferenceCurrencyDecimals:
      baseCurrencyData.marketReferenceCurrencyDecimals,
    userReserves: userReservesArray,
    formattedReserves,
    userEmodeCategoryId: userReserves.userEmodeCategoryId,
    reserveIncentives: [],
    userIncentives: [],
  });
  const endTime = Date.now();
  const diff = endTime - startTime;
  console.debug(
    '[perf] iUserSummaryAtom:: syncResult, startTime, endTime, diff',
    syncResult,
    startTime,
    endTime,
    diff,
  );

  return syncResult;
}

type ExtractStateType<T> = T extends UseBoundStore<StoreApi<infer U>>
  ? U
  : never;
type MappedBalances = Array<{ address: string; amount: string }>;
// const mappedBalancesState = zCreate<
//   Array<{
//     address: string;
//     amount: string;
//   }>
// >(() => {
//   return [];
// });

function computeMappedBalances({
  walletBalances,
}: Pick<RemoteDataState, 'walletBalances'>) {
  const { 0: tokenAddresses, 1: balances } = walletBalances;
  return tokenAddresses.map((_address, ix) => ({
    address: _address.toLowerCase(),
    amount: balances[ix]?.toString() || '',
  }));
}

// const displayPoolReservesState = zCreate<DisplayPoolReserveInfo[]>(() => {
//   return [];
// });

function computeDisplayPoolReserves({
  reserves,
  iUserSummary,
  mappedBalances,
  market,
}: {
  reserves: ReservesDataHumanized | undefined;
  iUserSummary: null | ReturnType<typeof formatUserSummaryAndIncentives>;
  mappedBalances: MappedBalances;
  market: CustomMarket;
}) {
  if (!iUserSummary || !reserves?.baseCurrencyData) {
    return [];
  }

  console.debug('[perf] displayPoolReservesAtom::');

  const baseCurrencyData = reserves.baseCurrencyData;
  const chainEnum =
    findChainByID(marketsData[market]?.chainId)?.enum || CHAINS_ENUM.ETH;

  return iUserSummary.userReservesData.map(item => {
    const balance = mappedBalances.find(
      x => x.address === item.reserve.underlyingAsset.toLowerCase(),
    );
    return {
      ...item,
      chain: chainEnum,
      walletBalance: normalize(balance?.amount || '0', item.reserve.decimals),
      walletBalanceUSD: nativeToUSD({
        amount: new BigNumber(balance?.amount || '0'),
        currencyDecimals: item.reserve.decimals,
        priceInMarketReferenceCurrency:
          item.reserve.priceInMarketReferenceCurrency,
        marketReferenceCurrencyDecimals:
          baseCurrencyData?.marketReferenceCurrencyDecimals || 0,
        normalizedMarketReferencePriceInUsd: normalize(
          baseCurrencyData?.marketReferenceCurrencyPriceInUsd || '0',
          USD_DECIMALS,
        ),
      }),
    };
  }) as DisplayPoolReserveInfo[];
}

function computeWrapperPoolReserveAndFinalDisplayPoolReserves({
  displayPoolReserves,
  formattedPoolReservesAndIncentives,
  mappedBalances,
  reserves,
  market,
}: {
  displayPoolReserves: DisplayPoolReserveInfo[];
  formattedPoolReservesAndIncentives: ReturnType<
    typeof formatReservesAndIncentives
  >;
  mappedBalances: MappedBalances;
  reserves: ReservesDataHumanized | undefined;
  market: CustomMarket;
}) {
  const chainEnum =
    findChainByID(marketsData[market]?.chainId)?.enum || CHAINS_ENUM.ETH;
  if (
    !displayPoolReserves.length ||
    !formattedPoolReservesAndIncentives.length
  ) {
    return {
      wrapperPoolReserve: null,
      finalDisplayPoolReserves: displayPoolReserves,
    };
  }

  console.debug('[perf] wrapperPoolReserveAndFinalDisplayPoolReservesAtom::');

  const wrapperReserve = displayPoolReserves.find(item => {
    return isSameAddress(
      item.reserve.underlyingAsset,
      wrapperToken?.[chainEnum]?.address,
    );
  });

  const wrapperPoolReserve = formattedPoolReservesAndIncentives.find(item =>
    isSameAddress(item.underlyingAsset, wrapperToken?.[chainEnum]?.address),
  );

  let finalDisplayPoolReserves = [...displayPoolReserves];

  if (wrapperReserve && reserves?.baseCurrencyData) {
    const balance = mappedBalances.find(x =>
      isSameAddress(x.address, API_ETH_MOCK_ADDRESS),
    );
    const baseCurrencyData = reserves.baseCurrencyData;

    finalDisplayPoolReserves.unshift({
      ...wrapperReserve,
      underlyingAsset: API_ETH_MOCK_ADDRESS.toLowerCase(),
      reserve: {
        ...wrapperReserve.reserve,
        symbol: wrapperToken?.[chainEnum]?.origin?.symbol || 'ETH',
        name: wrapperToken?.[chainEnum]?.origin?.name || 'ETH',
        underlyingAsset: API_ETH_MOCK_ADDRESS.toLowerCase(),
      },
      walletBalance: normalize(
        balance?.amount || '0',
        wrapperReserve.reserve.decimals,
      ),
      chain: chainEnum,
      walletBalanceUSD: nativeToUSD({
        amount: new BigNumber(balance?.amount || '0'),
        currencyDecimals: wrapperReserve.reserve.decimals,
        priceInMarketReferenceCurrency:
          wrapperReserve.reserve.priceInMarketReferenceCurrency,
        marketReferenceCurrencyDecimals:
          baseCurrencyData?.marketReferenceCurrencyDecimals || 0,
        normalizedMarketReferencePriceInUsd: normalize(
          baseCurrencyData?.marketReferenceCurrencyPriceInUsd || '0',
          USD_DECIMALS,
        ),
      }),
    });
  }

  return {
    wrapperPoolReserve,
    finalDisplayPoolReserves,
  };
}

// const apyInfoState = zCreate<null | ReturnType<typeof formatUserYield>>(
//   () => null,
// );
function computeApyInfo({
  formattedPoolReservesAndIncentives,
  iUserSummary,
}: {
  formattedPoolReservesAndIncentives: FormattedReservesAndIncentives[];
  iUserSummary: null | UserSummary;
}) {
  if (!formattedPoolReservesAndIncentives.length || !iUserSummary) {
    return null;
  }

  return formatUserYield(formattedPoolReservesAndIncentives, iUserSummary);
}

const computedInfoState = zCreate<{
  formattedReservesAndIncentivesState: typeof DEFAULT_RESERVES_AND_INCENTIVES;
  iUserSummary: null | UserSummary;
  mappedBalances: { address: string; amount: string }[];
  displayPoolReserves: DisplayPoolReserveInfo[];
  wrapperPoolReserveAndFinalDisplayPoolReserves: ReturnType<
    typeof computeWrapperPoolReserveAndFinalDisplayPoolReserves
  >;
  apyInfo: null | ReturnType<typeof formatUserYield>;
}>(() => {
  return {
    formattedReservesAndIncentivesState: DEFAULT_RESERVES_AND_INCENTIVES,
    iUserSummary: null,
    mappedBalances: [],
    displayPoolReserves: [],
    wrapperPoolReserveAndFinalDisplayPoolReserves: {
      wrapperPoolReserve: null,
      finalDisplayPoolReserves: [],
    },
    apyInfo: null,
  };
});

function setRefreshHistoryId(valOrFunc: UpdaterOrPartials<number>) {
  lendingLoadState.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.refreshHistoryId, valOrFunc, {
      strict: false,
    });
    return {
      ...prev,
      refreshHistoryId: newVal,
    };
  });
}
const useRefreshHistoryId = () => {
  const refreshHistoryId = lendingLoadState(s => s.refreshHistoryId);
  const refresh = useCallback(() => {
    setRefreshHistoryId(e => e + 1);
  }, []);
  return { refreshHistoryId, refresh };
};

const preQueryParams: {
  address?: string;
  marketKey?: CustomMarket;
} = {
  address: undefined,
  marketKey: undefined,
};

// const setRemoteTaskRef: RefLikeObject<null | ReturnType<
//   typeof InteractionManager.runAfterInteractions
// >> = { current: null };
const globalSets = {
  setRemoteData: debounce(
    async (valOrFunc: UpdaterOrPartials<RemoteDataState>) => {
      const prev = remoteDataState.getState();
      const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
        strict: false,
      });

      const computed = await computeFormattedReservesAndIncentives(newVal);
      // formattedReservesAndIncentivesState.setState(computed);

      const computed2 = await computeIUserSummary({
        ...newVal,
        formattedReserves: computed.formattedReserves,
      });

      const computed3 = computeMappedBalances({
        walletBalances: newVal.walletBalances,
      });

      const computed4 = computeDisplayPoolReserves({
        ...newVal,
        iUserSummary: computed2 as UserSummary,
        mappedBalances: computed3,
        market: jotaiStore.get(marketAtom),
      });

      const computed5 = computeWrapperPoolReserveAndFinalDisplayPoolReserves({
        displayPoolReserves: computed4,
        formattedPoolReservesAndIncentives:
          computed.formattedPoolReservesAndIncentives,
        mappedBalances: computed3,
        reserves: newVal.reserves,
        market: jotaiStore.get(marketAtom),
      });

      const computed6 = computeApyInfo({
        formattedPoolReservesAndIncentives:
          computed.formattedPoolReservesAndIncentives,
        iUserSummary: computed2 as UserSummary,
      });

      console.debug('[perf] lending:: remote data will be set', newVal);
      remoteDataState.setState(newVal);
      computedInfoState.setState({
        formattedReservesAndIncentivesState: computed,
        iUserSummary: computed2 as UserSummary,
        mappedBalances: computed3,
        displayPoolReserves: computed4,
        wrapperPoolReserveAndFinalDisplayPoolReserves: computed5,
        apyInfo: computed6,
      });
    },
    200,
  ),

  setLoading: (value: boolean) => {
    lendingLoadState.setState(prev => ({
      ...prev,
      loading: value,
    }));
  },
  setCurrentAddress: (value: string) =>
    lendingLoadState.setState(prev => ({
      ...prev,
      currentAddress: value,
    })),
};

const fetchLendingData = makeSWRKeyAsyncFunc(
  async (options?: {
    accountAddress?: string;
    ignoreLoading?: boolean;
    persistOnly?: boolean;
    marketKey?: CustomMarket;
  }) => {
    const {
      accountAddress = storeApiAccountsSwitcher.getSceneAccountInfo({
        forScene: 'Lending',
      }).finalSceneCurrentAccount?.address,
      ignoreLoading,
      persistOnly = false,
      marketKey: paramMarketKey,
    } = options || {};

    const requestAddress = accountAddress;
    if (!requestAddress) {
      return;
    }

    const marketKey = paramMarketKey || getMarketKey();
    if (!marketKey) return;

    // 用户强制忽略loading、前后params一样
    const isSameParams =
      preQueryParams.address === requestAddress &&
      preQueryParams.marketKey === marketKey;
    const isForceIgnoreLoading = ignoreLoading || isSameParams;
    preQueryParams.address = requestAddress;
    preQueryParams.marketKey = marketKey;
    if (!isForceIgnoreLoading) {
      globalSets.setLoading(true);
    }
    return fetchContractData(requestAddress)
      .then(async data => {
        await globalSets.setRemoteData(data);

        globalSets.setCurrentAddress(requestAddress);
        globalSets.setLoading(false);
      })
      .catch(() => {
        globalSets.setLoading(false);
      });
  },
  ctx => {
    const { accountAddress, ignoreLoading, persistOnly } = ctx.args[0] || {};
    return `lendingData-${accountAddress || 'no_address'}-${
      ignoreLoading ? 'ignore' : 'normal'
    }-${persistOnly ? 'persist' : 'normal'}`;
  },
);

function getSelectedMarketInfo() {
  const market = jotaiStore.get(marketAtom);
  return getMarketInfo(market);
}
function getMarketKey() {
  const marketKey = jotaiStore.get(marketAtom);
  return marketKey;
}
function getPools() {
  const marketKey = getMarketKey();
  const selectedMarketData = getSelectedMarketInfo().marketData;
  if (!marketKey || !selectedMarketData) {
    return undefined;
  }
  return getCachePools(marketKey);
}

export const apisLending = {
  fetchLendingData,
  setLoading: globalSets.setLoading,
};

const useFetchLendingData = () => {
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'Lending',
  });

  const { marketKey } = useSelectedMarket();

  const fetchData = useCallback(
    (ignoreLoading?: boolean) => {
      return fetchLendingData({
        accountAddress: currentAccount?.address,
        ignoreLoading,
        marketKey,
      });
    },
    [currentAccount?.address, marketKey],
  );

  return {
    fetchData,
  };
};

const useLendingSummary = () => {
  console.debug('[perf] useLendingSummary:: called');
  const { iUserSummary } = useLendingISummary();

  const {
    formattedReservesAndIncentivesState: { formattedPoolReservesAndIncentives },
    wrapperPoolReserveAndFinalDisplayPoolReserves: {
      finalDisplayPoolReserves,
      wrapperPoolReserve,
    },
    apyInfo,
  } = computedInfoState();

  const getTargetReserve = useCallback(
    (underlyingAsset: string) => {
      const validAddress = isValidAddress(underlyingAsset);
      const nativeWrapperReserveAddress = wrapperPoolReserve?.underlyingAsset;
      const defaultAddress = nativeToWrapper[underlyingAsset];
      const realTimeReserve = finalDisplayPoolReserves?.find(item =>
        isSameAddress(
          item.underlyingAsset,
          validAddress
            ? underlyingAsset
            : nativeWrapperReserveAddress || defaultAddress,
        ),
      );
      return realTimeReserve;
    },
    [finalDisplayPoolReserves, wrapperPoolReserve?.underlyingAsset],
  );

  return {
    // reserves,
    // userReserves,
    // walletBalances,
    displayPoolReserves: finalDisplayPoolReserves,
    iUserSummary,
    formattedPoolReservesAndIncentives,
    wrapperPoolReserve,
    apyInfo,
    getTargetReserve,
  };
};

export function useLendingRemoteData() {
  const { reserves, userReserves, walletBalances, eModes } = remoteDataState(
    s => s,
  );
  // const { reserves, userReserves, walletBalances, eModes } = useAtomValue(remoteDataAtom);

  return {
    reserves,
    userReserves,
    walletBalances,
    eModes,
  };
}

export function useLendingSummaryCard() {
  // const iUserSummary = iUserSummaryState(
  //   useShallow(s => ({
  //     totalLiquidityMarketReferenceCurrency:
  //       s?.totalLiquidityMarketReferenceCurrency || '0',
  //     healthFactor: s?.healthFactor || '0',
  //     netWorthUSD: s?.netWorthUSD || '0',
  //     totalBorrowsUSD: s?.totalBorrowsUSD || '0',
  //     totalLiquidityUSD: s?.totalLiquidityUSD || '0',
  //   })),
  // );
  // const netAPY = apyInfoState(useCallback(apy => apy?.netAPY || 0, []));
  const iUserSummary = computedInfoState(
    useShallow(s => ({
      totalLiquidityMarketReferenceCurrency:
        s.iUserSummary?.totalLiquidityMarketReferenceCurrency || '0',
      healthFactor: s.iUserSummary?.healthFactor || '0',
      netWorthUSD: s.iUserSummary?.netWorthUSD || '0',
      totalBorrowsUSD: s.iUserSummary?.totalBorrowsUSD || '0',
      totalLiquidityUSD: s.iUserSummary?.totalLiquidityUSD || '0',
    })),
  );
  const { apyInfo } = computedInfoState();
  const netAPY = apyInfo?.netAPY || 0;

  return { iUserSummary, netAPY };
}
export function useLendingIsLoading() {
  // const loading = useAtomValue(loadingAtom);
  const loading = lendingLoadState(s => s.loading);

  return { loading };
}
export function useLendingPoolContainer() {
  // const totalLiquidityMarketReferenceCurrency = iUserSummaryState(
  //   useShallow(s => s?.totalLiquidityMarketReferenceCurrency || '0'),
  // );
  const totalLiquidityMarketReferenceCurrency = computedInfoState(
    useShallow(
      s => s.iUserSummary?.totalLiquidityMarketReferenceCurrency || '0',
    ),
  );
  const { loading } = useLendingIsLoading();

  return {
    totalLiquidityMarketReferenceCurrency,
    loading,
  };
}
export function useLendingISummary() {
  // const iUserSummary = useAtomValue(iUserSummaryAtom);
  // const iUserSummary = iUserSummaryState();
  const iUserSummary = computedInfoState(s => s.iUserSummary);

  return {
    iUserSummary,
  };
}
export function useHasUserSummary() {
  // const hasUserSummary = iUserSummaryState(useShallow(s => !!s));
  const hasUserSummary = computedInfoState(useShallow(s => !!s.iUserSummary));

  return {
    hasUserSummary,
  };
}
export function useLendingHF() {
  // const lendingHf = iUserSummaryState(
  //   useShallow(s => {
  //     if (!s) {
  //       return null;
  //     }
  //     return {
  //       healthFactor: s?.healthFactor || '0',
  //       netWorthUSD: s?.netWorthUSD || '0',
  //     };
  //   }),
  // );
  const lendingHf = computedInfoState(
    useShallow(s => {
      if (!s.iUserSummary) {
        return null;
      }
      return {
        healthFactor: s.iUserSummary?.healthFactor || '0',
        netWorthUSD: s.iUserSummary?.netWorthUSD || '0',
      };
    }),
  );

  return {
    lendingHf,
  };
}

export { useFetchLendingData, useLendingSummary, useRefreshHistoryId };
