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
import { startTransition, useCallback, useMemo } from 'react';
import { unstable_batchedUpdates } from 'react-native';
import { InteractionManager } from 'react-native';
import { BigNumber } from 'bignumber.js';
import { formatUserYield } from './utils/apy';
import { CustomMarket, MarketDataType, marketsData } from './config/market';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import wrapperToken from './config/wrapperToken';
import { CHAINS_ENUM } from '@debank/common';
import { API_ETH_MOCK_ADDRESS } from './utils/constant';
import { DisplayPoolReserveInfo } from './type';
import {
  storeApiAccountsSwitcher,
  useSceneAccountInfo,
} from '@/hooks/accountsSwitcher';
import { atomByMMKV, MMKVStorageStrategy } from '@/core/storage/mmkv';
import { findChainByID } from '@/utils/chain';
import { getProvider } from './provider';
import { fetchIconSymbolAndName } from './utils/icon';
import { ExtractAtomValueType } from '@/utils/type';
import { jotaiStore } from '@/core/utils/reexports';

export const marketAtom = atomByMMKV(
  '@lendingMarket',
  CustomMarket.proto_mainnet_v3,
  {
    storage: MMKVStorageStrategy.compatString,
  },
);

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
  const selectedMarketData = apisLending.getSelectedMarketInfo().marketData;
  const pools = apisLending.getPools();
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

const reservesAtom = atom<ReservesDataHumanized | undefined>(undefined);
const userReservesAtom = atom<
  | {
      userReserves: UserReserveDataHumanized[];
      userEmodeCategoryId: number;
    }
  | undefined
>(undefined);
const eModesAtom = atom<EmodeDataHumanized[] | undefined>(undefined);

const EMPTY_WALLET_BALANCES: UserWalletBalancesResponse = { 0: [], 1: [] };
const walletBalancesAtom = atom<UserWalletBalancesResponse>(
  EMPTY_WALLET_BALANCES,
);
const addressAtom = atom<string | undefined>(undefined);
const loadingAtom = atom<boolean>(false);
const refreshHistoryIdAtom = atom<number>(0);

const formattedReservesAndIncentivesAtom = atom(get => {
  const reserves = get(reservesAtom);
  const eModes = get(eModesAtom);
  if (!reserves) {
    return {
      formattedReserves: null,
      formattedPoolReservesAndIncentives: [],
    };
  }

  const reservesArray = reserves.reservesData;
  const baseCurrencyData = reserves.baseCurrencyData;
  const currentTimestamp = dayjs().unix();

  const formattedReserves = formatReserves({
    reserves: reservesArray,
    currentTimestamp,
    eModes,
    marketReferenceCurrencyDecimals:
      baseCurrencyData.marketReferenceCurrencyDecimals,
    marketReferencePriceInUsd:
      baseCurrencyData.marketReferenceCurrencyPriceInUsd,
  }).map(item => ({
    ...item,
    ...fetchIconSymbolAndName(item),
  }));

  const formattedPoolReservesAndIncentives = formatReservesAndIncentives({
    reserves: reservesArray,
    currentTimestamp,
    marketReferenceCurrencyDecimals:
      baseCurrencyData.marketReferenceCurrencyDecimals,
    marketReferencePriceInUsd:
      baseCurrencyData.marketReferenceCurrencyPriceInUsd,
    reserveIncentives: [],
    eModes,
  }).map(item => ({
    ...item,
    ...fetchIconSymbolAndName(item),
  }));

  return {
    formattedReserves,
    formattedPoolReservesAndIncentives,
  };
});

export const formattedReservesAtom = atom(get => {
  return get(formattedReservesAndIncentivesAtom).formattedReserves;
});

export const formattedPoolReservesAndIncentivesAtom = atom(get => {
  return get(formattedReservesAndIncentivesAtom)
    .formattedPoolReservesAndIncentives;
});

export const iUserSummaryAtom = atom(get => {
  const userReserves = get(userReservesAtom);
  const formattedReserves = get(formattedReservesAtom);
  const reserves = get(reservesAtom);

  if (!userReserves || !formattedReserves) {
    return null;
  }

  const baseCurrencyData = reserves?.baseCurrencyData;
  if (!baseCurrencyData) {
    return null;
  }

  const currentTimestamp = dayjs().unix();
  const userReservesArray = userReserves.userReserves;

  return formatUserSummaryAndIncentives({
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
});

const mappedBalancesAtom = atom(get => {
  const walletBalances = get(walletBalancesAtom);
  const { 0: tokenAddresses, 1: balances } = walletBalances;
  return tokenAddresses.map((_address, ix) => ({
    address: _address.toLowerCase(),
    amount: balances[ix]?.toString(),
  }));
});

const displayPoolReservesAtom = atom(get => {
  const iUserSummary = get(iUserSummaryAtom);
  const reserves = get(reservesAtom);
  const mappedBalances = get(mappedBalancesAtom);
  const market = get(marketAtom);

  if (!iUserSummary || !reserves?.baseCurrencyData) {
    return [];
  }

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
});

const wrapperPoolReserveAndFinalDisplayPoolReservesAtom = atom(get => {
  const displayPoolReserves = get(displayPoolReservesAtom);
  const formattedPoolReservesAndIncentives = get(
    formattedPoolReservesAndIncentivesAtom,
  );
  const mappedBalances = get(mappedBalancesAtom);
  const reserves = get(reservesAtom);
  const market = get(marketAtom);
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
});

const wrapperPoolReserveAtom = atom(get => {
  return get(wrapperPoolReserveAndFinalDisplayPoolReservesAtom)
    .wrapperPoolReserve;
});

const finalDisplayPoolReservesAtom = atom(get => {
  return get(wrapperPoolReserveAndFinalDisplayPoolReservesAtom)
    .finalDisplayPoolReserves;
});

const apyInfoAtom = atom(get => {
  const formattedPoolReservesAndIncentives = get(
    formattedPoolReservesAndIncentivesAtom,
  );
  const iUserSummary = get(iUserSummaryAtom);

  if (!formattedPoolReservesAndIncentives.length || !iUserSummary) {
    return null;
  }

  return formatUserYield(formattedPoolReservesAndIncentives, iUserSummary);
});

const useRefreshHistoryId = () => {
  const [refreshHistoryId, setRefreshHistoryId] = useAtom(refreshHistoryIdAtom);
  const refresh = useCallback(() => {
    setRefreshHistoryId(e => e + 1);
  }, [setRefreshHistoryId]);
  return { refreshHistoryId, refresh };
};

const preQueryParams: {
  address?: string;
  marketKey?: CustomMarket;
} = {
  address: undefined,
  marketKey: undefined,
};

const globalSets = {
  setReserves: (value: ExtractAtomValueType<typeof reservesAtom>) =>
    jotaiStore.set(reservesAtom, value),
  setUserReserves: (value: ExtractAtomValueType<typeof userReservesAtom>) =>
    jotaiStore.set(userReservesAtom, value),
  setWalletBalances: (value: ExtractAtomValueType<typeof walletBalancesAtom>) =>
    jotaiStore.set(walletBalancesAtom, value),
  setEModes: (value: ExtractAtomValueType<typeof eModesAtom>) =>
    jotaiStore.set(eModesAtom, value),
  setLoading: (value: ExtractAtomValueType<typeof loadingAtom>) =>
    jotaiStore.set(loadingAtom, value),
  setCurrentAddress: (value: ExtractAtomValueType<typeof addressAtom>) =>
    jotaiStore.set(addressAtom, value),
};

export const apisLending = {
  getSelectedMarketInfo() {
    const market = jotaiStore.get(marketAtom);
    return getMarketInfo(market);
  },
  getMarketKey() {
    const marketKey = jotaiStore.get(marketAtom);
    return marketKey;
  },
  getPools() {
    const marketKey = apisLending.getMarketKey();
    const selectedMarketData = apisLending.getSelectedMarketInfo().marketData;
    if (!marketKey || !selectedMarketData) {
      return undefined;
    }
    return getCachePools(marketKey);
  },
  fetchLendingData,
};

async function fetchLendingData(options?: {
  accountAddress?: string;
  ignoreLoading?: boolean;
}) {
  const {
    accountAddress = storeApiAccountsSwitcher.getSceneAccountInfo({
      forScene: 'Lending',
    }).finalSceneCurrentAccount?.address,
    ignoreLoading,
  } = options || {};

  const requestAddress = accountAddress;
  if (!requestAddress) {
    return;
  }

  const marketKey = apisLending.getMarketKey();

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
    .then(data => {
      InteractionManager.runAfterInteractions(() => {
        startTransition(() => {
          const nextReserves = data?.reserves;
          const nextUserReserves = data?.userReserves;
          const nextWalletBalances =
            data?.walletBalances || EMPTY_WALLET_BALANCES;
          unstable_batchedUpdates(() => {
            globalSets.setReserves(nextReserves);
            globalSets.setUserReserves(nextUserReserves);
            globalSets.setWalletBalances(nextWalletBalances);
            globalSets.setEModes(data?.eModes);
            globalSets.setCurrentAddress(requestAddress);
            globalSets.setLoading(false);
          });
        });
      });
    })
    .catch(() => {
      globalSets.setLoading(false);
    });
}

const useLendingData = () => {
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'Lending',
  });
  const [reserves] = useAtom(reservesAtom);
  const [userReserves] = useAtom(userReservesAtom);
  const [walletBalances] = useAtom(walletBalancesAtom);
  const [loading, setLoading] = useAtom(loadingAtom);

  const fetchData = useCallback(
    (ignoreLoading?: boolean) => {
      return fetchLendingData({
        accountAddress: currentAccount?.address,
        ignoreLoading,
      });
    },
    [currentAccount],
  );

  return {
    reserves,
    userReserves,
    walletBalances,
    loading,
    setLoading,
    fetchData,
  };
};

const useLendingSummary = () => {
  const reserves = useAtomValue(reservesAtom);
  const userReserves = useAtomValue(userReservesAtom);
  const walletBalances = useAtomValue(walletBalancesAtom);
  const loading = useAtomValue(loadingAtom);
  const formattedPoolReservesAndIncentives = useAtomValue(
    formattedPoolReservesAndIncentivesAtom,
  );
  const iUserSummary = useAtomValue(iUserSummaryAtom);
  const finalDisplayPoolReserves = useAtomValue(finalDisplayPoolReservesAtom);
  const wrapperPoolReserve = useAtomValue(wrapperPoolReserveAtom);
  const apyInfo = useAtomValue(apyInfoAtom);

  return {
    reserves,
    userReserves,
    walletBalances,
    displayPoolReserves: finalDisplayPoolReserves,
    iUserSummary,
    formattedPoolReservesAndIncentives,
    wrapperPoolReserve,
    apyInfo,
    loading,
  };
};

export { useLendingData, useLendingSummary, useRefreshHistoryId };
