import { sortBy } from 'lodash';

type RpcClient = (payload: {
  chainServerId: string;
  method: string;
  params: string[];
}) => Promise<any>;

type GasComparableTx = {
  rawTx: {
    gasPrice?: string | number | null;
    maxFeePerGas?: string | number | null;
  };
  isSubmitFailed?: boolean;
  isWithdrawed?: boolean;
};

let rpcClient: RpcClient | null = null;

export const setTxRpcClient = (client: RpcClient) => {
  rpcClient = client;
};

const getGasPrice = (tx: GasComparableTx) => {
  return Number(tx.rawTx.gasPrice || tx.rawTx.maxFeePerGas || 0);
};
export const findMaxGasTx = <T extends GasComparableTx>(txs: T[]) => {
  const list = sortBy(
    txs,
    tx =>
      tx.isSubmitFailed && !tx.isWithdrawed ? 2 : tx.isWithdrawed ? 1 : -1,
    tx => -getGasPrice(tx),
  );

  return list[0];
};

export const getRpcTxReceipt = (chainServerId: string, hash: string) => {
  return Promise.resolve()
    .then(() => {
      if (!rpcClient) {
        throw new Error('Tx RPC client is not initialized');
      }
      return rpcClient({
        chainServerId,
        method: 'eth_getTransactionReceipt',
        params: [hash],
      });
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
