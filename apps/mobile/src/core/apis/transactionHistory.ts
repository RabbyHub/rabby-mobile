import BigNumber from 'bignumber.js';
import {
  transactionBroadcastWatcherService,
  transactionHistoryService,
  transactionWatcherService,
} from '../services/shared';
import { Tx } from '@rabby-wallet/rabby-api/dist/types';
import { groupBy } from 'lodash';
import { findChain } from '@/utils/chain';
import { requestETHRpc } from './provider';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { Account } from '../services/preference';

class ApisTransactionHistory {
  removeLocalPendingTx = ({
    address,
    nonce,
    chainId,
  }: {
    address: string;
    nonce?: number;
    chainId?: number;
  }) => {
    transactionHistoryService.removeLocalPendingTx({
      address,
      nonce,
      chainId,
    });
    transactionWatcherService.removeLocalPendingTx({
      address,
      nonce,
      chainId,
    });
    transactionBroadcastWatcherService.removeLocalPendingTx({
      address,
      nonce,
      chainId,
    });
    return;
  };

  clearPendingTxs = (address: string) => {
    transactionHistoryService.clearPendingTransactions(address);
    transactionWatcherService.clearPendingTx(address);
    transactionBroadcastWatcherService.clearPendingTx(address);
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
    const { pendings } = await transactionHistoryService.getList(address);

    return pendings
      .filter(item => new BigNumber(item.nonce).lt(recommendNonce))
      .reduce((result, item) => {
        return result.concat(item.txs.map(tx => tx.rawTx));
      }, [] as Tx[])
      .filter(item => item.chainId === chainId)
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
      transactionHistoryService.getList(address);
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
        transactionHistoryService.getNonceByChain(address, +chainId) || 0;
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

  getRabbySendPendingTxs = ({ address }: { address: string }) => {
    const { pendings } = transactionHistoryService.getList(address);

    return pendings.filter(
      item =>
        isSameAddress(address, item.address) &&
        item.action?.actionData.send &&
        item.$ctx?.ga?.source === 'sendToken',
    );
  };
}

export const apisTransactionHistory = new ApisTransactionHistory();
