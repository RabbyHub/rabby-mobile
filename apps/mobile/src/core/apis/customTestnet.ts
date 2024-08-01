import { matomoRequestEvent } from '@/utils/analytics';
import {
  customTestnetService,
  transactionHistoryService,
} from '../services/shared';

import { findChain } from '@/utils/chain';
import BigNumber from 'bignumber.js';
import { openapi } from '../request';

class ApiCustomTestnet {
  addCustomTestnet = async (
    chain: Parameters<typeof customTestnetService.add>[0],
    ctx?: {
      ga?: {
        source?: string;
      };
    },
  ) => {
    const source = ctx?.ga?.source || 'setting';

    const res = await customTestnetService.add(chain);
    if (!('error' in res)) {
      matomoRequestEvent({
        category: 'Custom Network',
        action: 'Success Add Network',
        label: `${source}_${String(chain.id)}`,
      });
    }
    return res;
  };
  updateCustomTestnet = customTestnetService.update;
  removeCustomTestnet = customTestnetService.remove;
  getCustomTestnetList = customTestnetService.getList;

  getCustomTestnetNonce = async ({
    address,
    chainId,
  }: {
    address: string;
    chainId: number;
  }) => {
    const count = await customTestnetService.getTransactionCount({
      address,
      chainId,
      blockTag: 'latest',
    });
    const localNonce =
      (await transactionHistoryService.getNonceByChain(address, chainId)) || 0;
    return BigNumber.max(count, localNonce).toNumber();
  };

  estimateCustomTestnetGas = customTestnetService.estimateGas;

  getCustomTestnetGasPrice = customTestnetService.getGasPrice;

  getCustomTestnetGasMarket = customTestnetService.getGasMarket;

  getCustomTestnetToken = customTestnetService.getToken;
  removeCustomTestnetToken = customTestnetService.removeToken;
  addCustomTestnetToken = customTestnetService.addToken;
  getCustomTestnetTokenList = customTestnetService.getTokenList;
  isAddedCustomTestnetToken = customTestnetService.hasToken;
  getCustomTestnetTx = customTestnetService.getTx;
  getCustomTestnetTxReceipt = customTestnetService.getTransactionReceipt;
  // getCustomTestnetTokenListWithBalance = customTestnetService.getTokenListWithBalance;

  getUsedCustomTestnetChainList = async () => {
    const ids = new Set<number>();
    Object.values(transactionHistoryService.store.transactions).forEach(
      item => {
        ids.add(item.chainId);
      },
    );
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
