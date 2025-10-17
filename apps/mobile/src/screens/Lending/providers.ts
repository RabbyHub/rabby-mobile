import {
  ChainId,
  UiIncentiveDataProvider,
  UiPoolDataProvider,
  WalletBalanceProvider,
} from '@aave/contract-helpers';
import {
  formatReserves,
  formatReservesAndIncentives,
  formatUserSummary,
  formatUserSummaryAndIncentives,
} from '@aave/math-utils';
import { ethers } from 'ethers';
import * as markets from '@bgd-labs/aave-address-book';
import dayjs from 'dayjs';

const provider = new ethers.providers.JsonRpcProvider('https://rpc.payload.de');

const poolDataProviderContract = new UiPoolDataProvider({
  uiPoolDataProviderAddress: markets.AaveV3Ethereum.UI_POOL_DATA_PROVIDER,
  provider,
  chainId: ChainId.mainnet,
});

// const incentiveDataProviderContract = new UiIncentiveDataProvider({
//   uiIncentiveDataProviderAddress:
//     markets.AaveV3Ethereum.UI_INCENTIVE_DATA_PROVIDER,
//   provider,
//   chainId: ChainId.mainnet,
// });

const walletBalanceProviderContract = new WalletBalanceProvider({
  walletBalanceProviderAddress: markets.AaveV3Ethereum.WALLET_BALANCE_PROVIDER,
  provider,
});

async function fetchContractData(address?: string) {
  if (!address) {
    return { userSummary: null };
  }
  try {
    // 纯池子信息
    const reserves = await poolDataProviderContract.getReservesHumanized({
      lendingPoolAddressProvider:
        markets.AaveV3Ethereum.POOL_ADDRESSES_PROVIDER,
    });

    // 用户在各个仓位的信息
    const userReserves =
      await poolDataProviderContract.getUserReservesHumanized({
        lendingPoolAddressProvider:
          markets.AaveV3Ethereum.POOL_ADDRESSES_PROVIDER,
        user: address,
      });

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

    const iUserSummary = formatUserSummaryAndIncentives({
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

    const { 0: tokenAddresses, 1: balances } =
      await walletBalanceProviderContract.getUserWalletBalancesForLendingPoolProvider(
        address,
        markets.AaveV3Ethereum.POOL_ADDRESSES_PROVIDER,
      );
    const mappedBalances = tokenAddresses.map((_address, ix) => ({
      address: _address.toLowerCase(),
      amount: balances[ix].toString(),
    }));

    console.log('CUSTOM_LOGGER:=>: iUserSummary', iUserSummary);
    return {
      formattedPoolReservesAndIncentives,
      iUserSummary,
      mappedBalances,
      baseCurrencyData: reserves.baseCurrencyData,
    };
  } catch (error) {
    console.error('CUSTOM_LOGGER:=>: error', error);
    return { userSummary: null };
  }
}

export { fetchContractData };
