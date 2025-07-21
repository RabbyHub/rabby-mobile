import { sortBy } from 'lodash';
import type { TransactionHistoryItem } from '../services/transactionHistory';
import { customRPCService } from '../services';

const getGasPrice = (tx: TransactionHistoryItem) => {
  return Number(tx.rawTx.gasPrice || tx.rawTx.maxFeePerGas || 0);
};
export const findMaxGasTx = (txs: TransactionHistoryItem[]) => {
  const list = sortBy(
    txs,
    tx =>
      tx.isSubmitFailed && !tx.isWithdrawed ? 2 : tx.isWithdrawed ? 1 : -1,
    tx => -getGasPrice(tx),
  );

  return list[0];
};

export const getRpcTxReceipt = (chainServerId: string, hash: string) => {
  return customRPCService
    .defaultEthRPC({
      chainServerId,
      method: 'eth_getTransactionReceipt',
      params: [hash],
    })
    .then(res => {
      return {
        hash: res.transactionHash,
        code: 0,
        status: parseInt(res.status, 16),
        gas_used: parseInt(res.gasUsed, 16),
      };
    })
    .catch(() => {
      return {
        hash: hash,
        code: -1,
        status: 0,
        gas_used: 0,
      };
    });
};
