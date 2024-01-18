import { sortBy } from 'lodash';
import type { TransactionHistoryItem } from '../services/transactionHistory';

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
