import { customTestnetServiceApi } from '@/core/serviceApi/customTestnet';
import { disconnectDappsWithUnsupportedChain } from '@/core/serviceApi/dappUnsupportedChain';
import type { CustomTestnetService } from '@/core/services/customTestnetService';
import {
  getTransactionHistoryTransactions,
  transactionHistoryServiceApi,
} from '@/core/serviceApi/transactionHistory';

import { findChain } from '@/utils/chain';
import BigNumber from 'bignumber.js';
import { openapi } from '../request';

class ApiCustomTestnet {
  addCustomTestnet = async (
    chain: Parameters<CustomTestnetService['add']>[0],
  ) => {
    return customTestnetServiceApi.add(chain);
  };
  updateCustomTestnet = customTestnetServiceApi.update;
  removeCustomTestnet = async (chainId: number) => {
    await customTestnetServiceApi.remove(chainId);
    disconnectDappsWithUnsupportedChain();
  };
  getCustomTestnetList = customTestnetServiceApi.getList;

  getCustomTestnetNonce = async ({
    address,
    chainId,
  }: {
    address: string;
    chainId: number;
  }) => {
    const count = await customTestnetServiceApi.getTransactionCount({
      address,
      chainId,
      blockTag: 'latest',
    });
    const localNonce =
      (await transactionHistoryServiceApi.getNonceByChain(address, chainId)) ||
      0;
    return BigNumber.max(count, localNonce).toNumber();
  };

  estimateCustomTestnetGas = customTestnetServiceApi.estimateGas;

  getCustomTestnetGasPrice = customTestnetServiceApi.getGasPrice;

  getCustomTestnetGasMarket = customTestnetServiceApi.getGasMarket;

  getCustomTestnetEip1559Support = customTestnetServiceApi.getEip1559Support;

  getCustomTestnetToken = customTestnetServiceApi.getToken;
  removeCustomTestnetToken = customTestnetServiceApi.removeToken;
  addCustomTestnetToken = customTestnetServiceApi.addToken;
  getCustomTestnetTokenList = customTestnetServiceApi.getTokenList;
  isAddedCustomTestnetToken = customTestnetServiceApi.hasToken;
  getCustomTestnetTx = customTestnetServiceApi.getTx;
  getCustomTestnetTxReceipt = customTestnetServiceApi.getTransactionReceipt;
  // getCustomTestnetTokenListWithBalance = customTestnetServiceApi.getTokenListWithBalance;

  getUsedCustomTestnetChainList = async () => {
    const ids = new Set<number>();
    const transactions = await getTransactionHistoryTransactions();
    transactions.forEach(item => {
      ids.add(item.chainId);
    });
    const chainList = Array.from(ids).filter(
      id =>
        !findChain({
          id,
        }),
    );
    const res = await openapi.getChainListByIds({
      ids: chainList.join(','),
    });
    return res;
  };
}

export const apiCustomTestnet = new ApiCustomTestnet();
