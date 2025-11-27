import {
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
import { BigNumber } from 'bignumber.js';
import { formatUserYield } from './utils/apy';
import { CustomMarket, MarketDataType, marketsData } from './config/market';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import wrapperToken from './config/wrapperToken';
import { CHAINS_ENUM } from '@debank/common';
import { API_ETH_MOCK_ADDRESS } from './utils/constant';
import { DisplayPoolReserveInfo } from './type';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { atomByMMKV, MMKVStorageStrategy } from '@/core/storage/mmkv';
import { findChainByID } from '@/utils/chain';
import { getProvider } from './provider';

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
export const usePoolDataProviderContract = () => {
  const { selectedMarketData, marketKey, chainEnum } = useSelectedMarket();
  const pools = useMemo(() => {
    if (!marketKey || !selectedMarketData) {
      return undefined;
    }
    return getCachePools(marketKey);
  }, [marketKey, selectedMarketData]);

  const fetchContractData = useCallback(
    async (address: string) => {
      if (!selectedMarketData || !pools) {
        return {};
      }
      console.log('CUSTOM_LOGGER:=>: fetchContractData', address.slice(-4));
      try {
        const [reserves, userReserves, walletBalances] = await Promise.all([
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
        ]);
        return {
          reserves,
          userReserves,
          walletBalances,
        };
      } catch (error) {
        console.error('CUSTOM_LOGGER:=>: error', error);
        return {};
      }
    },
    [pools, selectedMarketData],
  );

  return {
    pools,
    selectedMarketData,
    fetchContractData,
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
const walletBalancesAtom = atom<UserWalletBalancesResponse>({
  0: [],
  1: [],
});
const addressAtom = atom<string | undefined>(undefined);
const loadingAtom = atom<boolean>(false);
const refreshHistoryIdAtom = atom<number>(0);

const formattedReservesAndIncentivesAtom = atom(get => {
  const reserves = get(reservesAtom);
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
    marketReferenceCurrencyDecimals:
      baseCurrencyData.marketReferenceCurrencyDecimals,
    marketReferencePriceInUsd:
      baseCurrencyData.marketReferenceCurrencyPriceInUsd,
  });

  const formattedPoolReservesAndIncentives = formatReservesAndIncentives({
    reserves: reservesArray,
    currentTimestamp,
    marketReferenceCurrencyDecimals:
      baseCurrencyData.marketReferenceCurrencyDecimals,
    marketReferencePriceInUsd:
      baseCurrencyData.marketReferenceCurrencyPriceInUsd,
    reserveIncentives: [],
  });

  return {
    formattedReserves,
    formattedPoolReservesAndIncentives,
  };
});

const formattedReservesAtom = atom(get => {
  return get(formattedReservesAndIncentivesAtom).formattedReserves;
});

const formattedPoolReservesAndIncentivesAtom = atom(get => {
  return get(formattedReservesAndIncentivesAtom)
    .formattedPoolReservesAndIncentives;
});

const iUserSummaryAtom = atom(get => {
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
    amount: balances[ix].toString(),
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

const useLendingData = () => {
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'Lending',
  });
  const [reserves, setReserves] = useAtom(reservesAtom);
  const [userReserves, setUserReserves] = useAtom(userReservesAtom);
  const [walletBalances, setWalletBalances] = useAtom(walletBalancesAtom);
  const [loading, setLoading] = useAtom(loadingAtom);
  const { marketKey } = useSelectedMarket();
  const [, setCurrentAddress] = useAtom(addressAtom);
  const { fetchContractData } = usePoolDataProviderContract();

  const fetchData = useCallback(
    async (ignoreLoading: boolean = false) => {
      const requestAddress = currentAccount?.address;
      if (!requestAddress) {
        return;
      }
      // 用户强制忽略loading、前后params一样
      const isSameParams =
        preQueryParams.address === requestAddress &&
        preQueryParams.marketKey === marketKey;
      const isForceIgnoreLoading = ignoreLoading || isSameParams;
      preQueryParams.address = requestAddress;
      preQueryParams.marketKey = marketKey;
      if (!isForceIgnoreLoading) {
        setLoading(true);
      }
      fetchContractData(requestAddress)
        .then(data => {
          setReserves(data?.reserves);
          setUserReserves(data?.userReserves);
          setWalletBalances(data?.walletBalances || { 0: [], 1: [] });
          setCurrentAddress(requestAddress);
          setLoading(false);
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [
      currentAccount?.address,
      fetchContractData,
      marketKey,
      setCurrentAddress,
      setLoading,
      setReserves,
      setUserReserves,
      setWalletBalances,
    ],
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
