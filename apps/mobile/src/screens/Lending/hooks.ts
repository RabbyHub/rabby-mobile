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
import { useCallback, useEffect, useMemo } from 'react';
import { BigNumber } from 'bignumber.js';
import { formatUserYield } from './utils/apy';
import { CustomMarket, marketsData } from './config/market';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import wrapperToken from './config/wrapperToken';
import { CHAINS_ENUM } from '@debank/common';
import { API_ETH_MOCK_ADDRESS } from './utils/constant';
import buildinProvider from '@/core/apis/buildinProvider';

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

const useRefreshHistoryId = () => {
  const [refreshHistoryId, setRefreshHistoryId] = useAtom(refreshHistoryIdAtom);
  const refresh = useCallback(() => {
    setRefreshHistoryId(e => e + 1);
  }, [setRefreshHistoryId]);
  return { refreshHistoryId, refresh };
};

const useLendingData = (address?: string, init: boolean = false) => {
  const [reserves, setReserves] = useAtom(reservesAtom);
  const [userReserves, setUserReserves] = useAtom(userReservesAtom);
  const [walletBalances, setWalletBalances] = useAtom(walletBalancesAtom);
  const [loading, setLoading] = useAtom(loadingAtom);
  const [currentAddress, setCurrentAddress] = useAtom(addressAtom);

  const fetchData = useCallback(
    async (ignoreLoading: boolean = false) => {
      if (!address || loading) {
        return;
      }
      if (!ignoreLoading) {
        setLoading(true);
      }
      fetchContractData(address)
        .then(data => {
          setReserves(data?.reserves);
          setUserReserves(data?.userReserves);
          setWalletBalances(data?.walletBalances || { 0: [], 1: [] });
          setCurrentAddress(address);
          setLoading(false);
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [
      address,
      loading,
      setCurrentAddress,
      setLoading,
      setReserves,
      setUserReserves,
      setWalletBalances,
    ],
  );

  useEffect(() => {
    if (!address || !init) {
      return;
    }
    if (currentAddress && isSameAddress(currentAddress, address) && reserves) {
      return;
    }
    if (loading) {
      return;
    }

    fetchData();
  }, [address, reserves, currentAddress, loading, fetchData, init]);

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

  const { formattedReserves, formattedPoolReservesAndIncentives } =
    useMemo(() => {
      if (!reserves) {
        return {
          formattedReserves: null,
          formattedPoolReservesAndIncentives: [],
        };
      }

      const reservesArray = reserves.reservesData;
      const baseCurrencyData = reserves.baseCurrencyData;
      const currentTimestamp = dayjs().unix();

      const _formattedReserves = formatReserves({
        reserves: reservesArray,
        currentTimestamp,
        marketReferenceCurrencyDecimals:
          baseCurrencyData.marketReferenceCurrencyDecimals,
        marketReferencePriceInUsd:
          baseCurrencyData.marketReferenceCurrencyPriceInUsd,
      });

      const _formattedPoolReservesAndIncentives = formatReservesAndIncentives({
        reserves: reservesArray,
        currentTimestamp,
        marketReferenceCurrencyDecimals:
          baseCurrencyData.marketReferenceCurrencyDecimals,
        marketReferencePriceInUsd:
          baseCurrencyData.marketReferenceCurrencyPriceInUsd,
        reserveIncentives: [],
      });

      return {
        formattedReserves: _formattedReserves,
        formattedPoolReservesAndIncentives: _formattedPoolReservesAndIncentives,
      };
    }, [reserves]);

  const iUserSummary = useMemo(() => {
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
  }, [userReserves, formattedReserves, reserves?.baseCurrencyData]);

  const mappedBalances = useMemo(() => {
    const { 0: tokenAddresses, 1: balances } = walletBalances;
    return tokenAddresses.map((_address, ix) => ({
      address: _address.toLowerCase(),
      amount: balances[ix].toString(),
    }));
  }, [walletBalances]);

  const displayPoolReserves = useMemo(() => {
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
        chain: 'ETH',
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
    });
  }, [iUserSummary, mappedBalances, reserves?.baseCurrencyData]);

  const { wrapperPoolReserve, finalDisplayPoolReserves } = useMemo(() => {
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

    const _wrapperPoolReserve = formattedPoolReservesAndIncentives.find(
      item => {
        return isSameAddress(
          item.underlyingAsset,
          wrapperToken[CHAINS_ENUM.ETH].address,
        );
      },
    );

    let _finalDisplayPoolReserves = [...displayPoolReserves];

    if (wrapperReserve && reserves?.baseCurrencyData) {
      const balance = mappedBalances.find(x =>
        isSameAddress(x.address, API_ETH_MOCK_ADDRESS),
      );
      const baseCurrencyData = reserves.baseCurrencyData;

      _finalDisplayPoolReserves.unshift({
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
      wrapperPoolReserve: _wrapperPoolReserve,
      finalDisplayPoolReserves: _finalDisplayPoolReserves,
    };
  }, [
    displayPoolReserves,
    formattedPoolReservesAndIncentives,
    mappedBalances,
    reserves?.baseCurrencyData,
  ]);

  const apyInfo = useMemo(() => {
    if (!formattedPoolReservesAndIncentives.length || !iUserSummary) {
      return null;
    }

    return formatUserYield(formattedPoolReservesAndIncentives, iUserSummary);
  }, [formattedPoolReservesAndIncentives, iUserSummary]);

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
