import {
  ChainId,
  UiIncentiveDataProvider,
  UiPoolDataProvider,
  WalletBalanceProvider,
} from '@aave/contract-helpers';
import { ethers } from 'ethers';
import * as markets from '@bgd-labs/aave-address-book';

const provider = new ethers.providers.JsonRpcProvider('https://rpc.payload.de');

const poolDataProviderContract = new UiPoolDataProvider({
  uiPoolDataProviderAddress: markets.AaveV3Ethereum.UI_POOL_DATA_PROVIDER,
  provider,
  chainId: ChainId.mainnet,
});

const incentiveDataProviderContract = new UiIncentiveDataProvider({
  uiIncentiveDataProviderAddress:
    markets.AaveV3Ethereum.UI_INCENTIVE_DATA_PROVIDER,
  provider,
  chainId: ChainId.mainnet,
});

const walletBalanceProviderContract = new WalletBalanceProvider({
  walletBalanceProviderAddress: markets.AaveV3Ethereum.WALLET_BALANCE_PROVIDER,
  provider,
});
