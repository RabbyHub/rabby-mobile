import {
  ChainId,
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
import { useEffect, useMemo } from 'react';
import { DisplayPoolReserveInfo } from './type';
import { BigNumber } from 'bignumber.js';
import { formatUserYield } from './utils/apy';

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
const loadingAtom = atom<boolean>(false);

const useLendingData = (address?: string) => {
  const [reserves, setReserves] = useAtom(reservesAtom);
  const [userReserves, setUserReserves] = useAtom(userReservesAtom);
  const [walletBalances, setWalletBalances] = useAtom(walletBalancesAtom);
  const [loading, setLoading] = useAtom(loadingAtom);

  useEffect(() => {
    if (address && !reserves) {
      setLoading(true);
      fetchContractData(address)
        .then(data => {
          setReserves(data?.reserves);
          setUserReserves(data?.userReserves);
          setWalletBalances(data?.walletBalances || { 0: [], 1: [] });
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [
    address,
    reserves,
    setLoading,
    setReserves,
    setUserReserves,
    setWalletBalances,
  ]);

  return {
    reserves,
    userReserves,
    walletBalances,
    loading,
  };
};

const useLendingSummary = () => {
  const reserves = useAtomValue(reservesAtom);
  const userReserves = useAtomValue(userReservesAtom);
  const walletBalances = useAtomValue(walletBalancesAtom);
  const loading = useAtomValue(loadingAtom);

  const { displayPoolReserves, iUserSummary, apyInfo } = useMemo(() => {
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
    const formattedPoolReservesAndIncentives = formatReservesAndIncentives({
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

    const _apyInfo = formatUserYield(
      formattedPoolReservesAndIncentives || [],
      _iUserSummary,
    );
    return {
      displayPoolReserves: _displayPoolReserves,
      iUserSummary: _iUserSummary,
      apyInfo: _apyInfo,
    };
  }, [reserves, userReserves, walletBalances]);

  return {
    reserves,
    userReserves,
    walletBalances,
    displayPoolReserves,
    iUserSummary,
    apyInfo,
    loading,
  };
};

export { useLendingData, useLendingSummary };
