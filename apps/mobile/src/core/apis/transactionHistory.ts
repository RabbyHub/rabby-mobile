import BigNumber from 'bignumber.js';
import { transactionBroadcastWatcherServiceApi } from '@/core/serviceApi/transactionBroadcastWatcher';
import {
  getTransactionHistoryTransactions,
  getTransactionHistoryTransactionsSnapshot,
  transactionHistoryServiceApi,
} from '@/core/serviceApi/transactionHistory';
import { transactionWatcherServiceApi } from '@/core/serviceApi/transactionWatcher';
import type { Tx } from '@rabby-wallet/rabby-api/dist/types';
import { groupBy } from 'lodash';
import { findChain } from '@/utils/chain';
import { requestETHRpc } from './provider';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import type { Account } from '@/types/account';

class ApisTransactionHistory {
  removeLocalPendingTx = async ({
    address,
    nonce,
    chainId,
  }: {
    address: string;
    nonce?: number;
    chainId?: number;
  }) => {
    await Promise.all([
      transactionHistoryServiceApi.removeLocalPendingTx({
        address,
        nonce,
        chainId,
      }),
      transactionWatcherServiceApi.removeLocalPendingTx({
        address,
        nonce,
        chainId,
      }),
      transactionBroadcastWatcherServiceApi.removeLocalPendingTx({
        address,
        nonce,
        chainId,
      }),
    ]);
  };

  clearPendingTxs = async (address: string) => {
    await Promise.all([
      transactionHistoryServiceApi.clearPendingTransactions(address),
      transactionWatcherServiceApi.clearPendingTx(address),
      transactionBroadcastWatcherServiceApi.clearPendingTx(address),
    ]);
  };

  getPendingTxs = async ({
    recommendNonce,
    address,
    chainId,
  }: {
    recommendNonce: string;
    address: string;
    chainId: number;
  }) => {
    const { pendings } = await transactionHistoryServiceApi.getList(address);

    return pendings
      .filter(
        item =>
          item.chainId === chainId &&
          new BigNumber(item.nonce).lt(recommendNonce),
      )
      .sort((a, b) =>
        new BigNumber(a.nonce).minus(new BigNumber(b.nonce)).toNumber(),
      )
      .reduce((result, item) => {
        return result.concat(item.txs.map(tx => tx.rawTx));
      }, [] as Tx[])
      .map(item => ({
        from: item.from,
        to: item.to,
        chainId: item.chainId,
        data: item.data || '0x',
        nonce: item.nonce,
        value: item.value,
        gasPrice: `0x${new BigNumber(
          item.gasPrice || item.maxFeePerGas || 0,
        ).toString(16)}`,
        gas: item.gas || item.gasLimit || '0x0',
      }));
  };

  getSkipedTxs = async (address: string, account?: Account) => {
    const { pendings: pendingList } =
      await transactionHistoryServiceApi.getList(address);
    const dict = groupBy(pendingList, item => item.chainId);

    const res: Record<
      string,
      { chainId: number; nonce: number; address: string }[]
    > = {};
    for (const [chainId, list] of Object.entries(dict)) {
      const chain = findChain({
        id: +chainId,
      });
      if (!chain) {
        continue;
      }
      const onChainNonce = await requestETHRpc(
        {
          method: 'eth_getTransactionCount',
          params: [address, 'latest'],
        },
        chain.serverId,
        account,
      );
      const localNonce =
        (await transactionHistoryServiceApi.getNonceByChain(
          address,
          +chainId,
        )) || 0;
      for (let nonce = +onChainNonce; nonce < +localNonce; nonce++) {
        if (
          !list.find(txGroup => {
            return +txGroup.nonce === nonce;
          })
        ) {
          if (res[chainId]) {
            res[chainId].push({ nonce, chainId: +chainId, address });
          } else {
            res[chainId] = [{ nonce, chainId: +chainId, address }];
          }
        }
      }
    }

    return res;
  };

  getRabbySendPendingTxs = async ({ address }: { address: string }) => {
    const { pendings } = await transactionHistoryServiceApi.getList(address);

    return pendings.filter(
      item =>
        isSameAddress(address, item.address) &&
        item.action?.actionData.send &&
        item.$ctx?.ga?.source === 'sendToken',
    );
  };

  updateBridgeGasAccountTx = async ({
    address,
    chainId,
    hash,
  }: {
    address: string;
    chainId?: number;
    hash: string;
  }) => {
    if (!chainId) {
      return;
    }
    const transactions = await getTransactionHistoryTransactions();
    const tx = transactions.find(item => {
      return (
        isSameAddress(item.address, address) &&
        item.chainId === chainId &&
        item.hash === hash
      );
    });

    if (tx) {
      await transactionHistoryServiceApi.updateTx({
        ...tx,
        isGasDeposit: true,
      });
    }
  };

  checkIsGasDepositTx = ({
    chainId,
    hash,
  }: {
    chainId?: number;
    hash: string;
  }) => {
    if (!hash || !chainId) {
      return false;
    }

    return !!getTransactionHistoryTransactionsSnapshot().find(item => {
      return (
        item.chainId === chainId && item.hash === hash && item.isGasDeposit
      );
    });
  };
}

export const apisTransactionHistory = new ApisTransactionHistory();
