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
import { useCallback, useEffect } from 'react';
import { BigNumber } from 'bignumber.js';
import { formatUserYield } from './utils/apy';
import { CustomMarket, marketsData } from './config/market';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import wrapperToken from './config/wrapperToken';
import { CHAINS_ENUM } from '@debank/common';
import { API_ETH_MOCK_ADDRESS } from './utils/constant';
import buildinProvider from '@/core/apis/buildinProvider';
import { DisplayPoolReserveInfo } from './type';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';

const provider = new ethers.providers.Web3Provider(
  buildinProvider.currentProvider,
);
const poolDataProviderContract = new UiPoolDataProvider({
  uiPoolDataProviderAddress:
    marketsData[CustomMarket.proto_mainnet_v3].addresses.UI_POOL_DATA_PROVIDER,
  provider,
  chainId: marketsData[CustomMarket.proto_mainnet_v3].chainId,
});
const walletBalanceProviderContract = new WalletBalanceProvider({
  walletBalanceProviderAddress:
    marketsData[CustomMarket.proto_mainnet_v3].addresses
      .WALLET_BALANCE_PROVIDER,
  provider,
});

export const poolBundle = new PoolBundle(provider, {
  POOL: marketsData[CustomMarket.proto_mainnet_v3].addresses.LENDING_POOL,
  WETH_GATEWAY:
    marketsData[CustomMarket.proto_mainnet_v3].addresses.WETH_GATEWAY,
  L2_ENCODER: marketsData[CustomMarket.proto_mainnet_v3].addresses.L2_ENCODER,
});

export const pool = new Pool(provider, {
  POOL: marketsData[CustomMarket.proto_mainnet_v3].addresses.LENDING_POOL,
  REPAY_WITH_COLLATERAL_ADAPTER:
    marketsData[CustomMarket.proto_mainnet_v3].addresses
      .REPAY_WITH_COLLATERAL_ADAPTER,
  SWAP_COLLATERAL_ADAPTER:
    marketsData[CustomMarket.proto_mainnet_v3].addresses
      .SWAP_COLLATERAL_ADAPTER,
  WETH_GATEWAY:
    marketsData[CustomMarket.proto_mainnet_v3].addresses.WETH_GATEWAY,
  L2_ENCODER: marketsData[CustomMarket.proto_mainnet_v3].addresses.L2_ENCODER,
});

async function fetchContractData(address: string) {
  try {
    const [reserves, userReserves, walletBalances] = await Promise.all([
      poolDataProviderContract.getReservesHumanized({
        lendingPoolAddressProvider:
          marketsData[CustomMarket.proto_mainnet_v3].addresses
            .LENDING_POOL_ADDRESS_PROVIDER,
      }),
      poolDataProviderContract.getUserReservesHumanized({
        lendingPoolAddressProvider:
          marketsData[CustomMarket.proto_mainnet_v3].addresses
            .LENDING_POOL_ADDRESS_PROVIDER,
        user: address,
      }),
      walletBalanceProviderContract.getUserWalletBalancesForLendingPoolProvider(
        address,
        marketsData[CustomMarket.proto_mainnet_v3].addresses
          .LENDING_POOL_ADDRESS_PROVIDER,
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
}

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

  if (!iUserSummary || !reserves?.baseCurrencyData) {
    return [];
  }

  const baseCurrencyData = reserves.baseCurrencyData;

  return iUserSummary.userReservesData.map(item => {
    const balance = mappedBalances.find(
      x => x.address === item.reserve.underlyingAsset.toLowerCase(),
    );
    return {
      ...item,
      chain: CHAINS_ENUM.ETH,
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
      wrapperToken[CHAINS_ENUM.ETH].address,
    );
  });

  const wrapperPoolReserve = formattedPoolReservesAndIncentives.find(item =>
    isSameAddress(item.underlyingAsset, wrapperToken[CHAINS_ENUM.ETH].address),
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
        symbol: 'ETH',
        name: 'ETH',
        underlyingAsset: API_ETH_MOCK_ADDRESS.toLowerCase(),
      },
      walletBalance: normalize(
        balance?.amount || '0',
        wrapperReserve.reserve.decimals,
      ),
      chain: CHAINS_ENUM.ETH,
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

const useLendingData = (init: boolean = false) => {
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'Lending',
  });
  const [reserves, setReserves] = useAtom(reservesAtom);
  const [userReserves, setUserReserves] = useAtom(userReservesAtom);
  const [walletBalances, setWalletBalances] = useAtom(walletBalancesAtom);
  const [loading, setLoading] = useAtom(loadingAtom);
  const [currentAddress, setCurrentAddress] = useAtom(addressAtom);

  const fetchData = useCallback(
    async (ignoreLoading: boolean = false) => {
      const requestAddress = currentAccount?.address;
      if (!requestAddress || loading) {
        return;
      }
      if (!ignoreLoading) {
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
      loading,
      setCurrentAddress,
      setLoading,
      setReserves,
      setUserReserves,
      setWalletBalances,
    ],
  );

  useEffect(() => {
    if (!currentAccount?.address || !init) {
      return;
    }
    if (
      currentAddress &&
      isSameAddress(currentAddress, currentAccount?.address) &&
      reserves
    ) {
      return;
    }
    if (loading) {
      return;
    }

    fetchData();
  }, [
    currentAccount?.address,
    reserves,
    currentAddress,
    loading,
    fetchData,
    init,
  ]);

  return {
    reserves,
    userReserves,
    walletBalances,
    loading,
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
