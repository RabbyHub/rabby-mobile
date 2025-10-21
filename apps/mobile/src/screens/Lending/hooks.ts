import {
  ChainId,
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
import * as markets from '@bgd-labs/aave-address-book';
import dayjs from 'dayjs';
import { atom, useAtom, useAtomValue } from 'jotai';
import { useCallback, useEffect, useMemo } from 'react';
import { DisplayPoolReserveInfo } from './type';
import { BigNumber } from 'bignumber.js';
import { formatUserYield } from './utils/apy';
import { CustomMarket, marketsData } from './config/market';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import wrapperToken from './config/wrapperToken';
import { CHAINS_ENUM } from '@debank/common';
import { API_ETH_MOCK_ADDRESS } from './utils/constant';

const provider = new ethers.providers.JsonRpcProvider('https://rpc.payload.de');

const poolDataProviderContract = new UiPoolDataProvider({
  uiPoolDataProviderAddress: markets.AaveV3Ethereum.UI_POOL_DATA_PROVIDER,
  provider,
  chainId: ChainId.mainnet,
});
const walletBalanceProviderContract = new WalletBalanceProvider({
  walletBalanceProviderAddress: markets.AaveV3Ethereum.WALLET_BALANCE_PROVIDER,
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
    const reserves = await poolDataProviderContract.getReservesHumanized({
      lendingPoolAddressProvider:
        markets.AaveV3Ethereum.POOL_ADDRESSES_PROVIDER,
    });

    const userReserves =
      await poolDataProviderContract.getUserReservesHumanized({
        lendingPoolAddressProvider:
          markets.AaveV3Ethereum.POOL_ADDRESSES_PROVIDER,
        user: address,
      });

    const walletBalances =
      await walletBalanceProviderContract.getUserWalletBalancesForLendingPoolProvider(
        address,
        markets.AaveV3Ethereum.POOL_ADDRESSES_PROVIDER,
      );
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

const useLendingData = (address?: string) => {
  const [reserves, setReserves] = useAtom(reservesAtom);
  const [userReserves, setUserReserves] = useAtom(userReservesAtom);
  const [walletBalances, setWalletBalances] = useAtom(walletBalancesAtom);
  const [loading, setLoading] = useAtom(loadingAtom);
  const [currentAddress, setCurrentAddress] = useAtom(addressAtom);

  const fetchData = useCallback(async () => {
    if (!address) {
      return;
    }
    setLoading(true);
    fetchContractData(address)
      .then(data => {
        setReserves(data?.reserves);
        setUserReserves(data?.userReserves);
        setWalletBalances(data?.walletBalances || { 0: [], 1: [] });
        setCurrentAddress(address);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [
    address,
    setCurrentAddress,
    setLoading,
    setReserves,
    setUserReserves,
    setWalletBalances,
  ]);

  useEffect(() => {
    if (!address) {
      return;
    }
    if (currentAddress && isSameAddress(currentAddress, address) && reserves) {
      return;
    }
    if (loading) {
      return;
    }

    fetchData();
  }, [address, reserves, currentAddress, loading, fetchData]);

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

  const {
    displayPoolReserves,
    iUserSummary,
    apyInfo,
    formattedPoolReservesAndIncentives,
    wrapperPoolReserve,
  } = useMemo(() => {
    if (!reserves || !userReserves) {
      return {
        formattedPoolReservesAndIncentives: [],
        iUserSummary: null,
      };
    }
    const { 0: tokenAddresses, 1: balances } = walletBalances;
    const reservesArray = reserves.reservesData;
    const baseCurrencyData = reserves.baseCurrencyData;
    const userReservesArray = userReserves.userReserves;

    const currentTimestamp = dayjs().unix();
    const formattedReserves = formatReserves({
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
    const _iUserSummary = formatUserSummaryAndIncentives({
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
    const mappedBalances = tokenAddresses.map((_address, ix) => ({
      address: _address.toLowerCase(),
      amount: balances[ix].toString(),
    }));
    const _displayPoolReserves: DisplayPoolReserveInfo[] =
      _iUserSummary.userReservesData.map(item => {
        const balance = mappedBalances.find(
          x => x.address === item.reserve.underlyingAsset.toLowerCase(),
        );
        return {
          ...item,
          chain: 'ETH',
          walletBalance: normalize(
            balance?.amount || '0',
            item.reserve.decimals,
          ),
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
    const wrapperReserve = _displayPoolReserves.find(item => {
      return isSameAddress(
        item.reserve.underlyingAsset,
        wrapperToken[CHAINS_ENUM.ETH].address,
      );
    });
    const _wrapperPoolReserve = _formattedPoolReservesAndIncentives.find(
      item => {
        return !isSameAddress(
          item.underlyingAsset,
          wrapperToken[CHAINS_ENUM.ETH].address,
        );
      },
    );
    if (wrapperReserve) {
      const balance = mappedBalances.find(x =>
        isSameAddress(x.address, API_ETH_MOCK_ADDRESS),
      );
      _displayPoolReserves.unshift({
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
    const _apyInfo = formatUserYield(
      _formattedPoolReservesAndIncentives || [],
      _iUserSummary,
    );
    return {
      displayPoolReserves: _displayPoolReserves,
      iUserSummary: _iUserSummary,
      apyInfo: _apyInfo,
      formattedPoolReservesAndIncentives: _formattedPoolReservesAndIncentives,
      wrapperPoolReserve: _wrapperPoolReserve,
    };
  }, [reserves, userReserves, walletBalances]);

  return {
    reserves,
    userReserves,
    walletBalances,
    displayPoolReserves,
    iUserSummary,
    formattedPoolReservesAndIncentives,
    wrapperPoolReserve,
    apyInfo,
    loading,
  };
};

export { useLendingData, useLendingSummary };
