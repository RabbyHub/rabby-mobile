import { Chain } from '@/constant/chains';
import {
  CAN_ESTIMATE_L1_FEE_CHAINS,
  DEFAULT_GAS_LIMIT_RATIO,
  SAFE_GAS_LIMIT_RATIO,
} from '@/constant/gas';
import * as apiProvider from '@/core/apis/provider';
import type {
  ExplainTxResponse,
  GasLevel,
} from '@rabby-wallet/rabby-api/dist/types';
import { Tx } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';
import {
  transactionBroadcastWatcherService,
  transactionHistoryService,
  transactionWatcherService,
} from '../services';
import { findChain } from '@/utils/chain';
import { intToHex } from '@/utils/number';

export const clearPendingTxs = (address: string) => {
  transactionHistoryService.clearPendingTransactions(address);
  transactionWatcherService.clearPendingTx(address);
  transactionBroadcastWatcherService.clearPendingTx(address);
  return;
};

export const getPendingTxs = async ({
  recommendNonce,
  address,
}: {
  recommendNonce: string;
  address: string;
}) => {
  const { pendings } = await transactionHistoryService.getList(address);

  return pendings
    .filter(item => new BigNumber(item.nonce).lt(recommendNonce))
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

interface BlockInfo {
  baseFeePerGas: string;
  difficulty: string;
  extraData: string;
  gasLimit: string;
  gasUsed: string;
  hash: string;
  logsBloom: string;
  miner: string;
  mixHash: string;
  nonce: string;
  number: string;
  parentHash: string;
  receiptsRoot: string;
  sha3Uncles: string;
  size: string;
  stateRoot: string;
  timestamp: string;
  totalDifficulty: string;
  transactions: string[];
  transactionsRoot: string;
  uncles: string[];
}

export async function calcGasLimit({
  chain,
  tx,
  gas,
  selectedGas,
  nativeTokenBalance,
  explainTx,
  needRatio,
}: {
  chain: Chain;
  tx: Tx;
  gas: BigNumber;
  selectedGas: GasLevel | null;
  nativeTokenBalance: string;
  explainTx: ExplainTxResponse;
  needRatio: boolean;
}) {
  let block: null | BlockInfo = null;
  try {
    block = await apiProvider.requestETHRpc<any>(
      {
        method: 'eth_getBlockByNumber',
        params: ['latest', false],
      },
      chain.serverId,
    );
  } catch (e) {
    // NOTHING
  }

  // use server response gas limit
  let ratio = SAFE_GAS_LIMIT_RATIO[chain.id] || DEFAULT_GAS_LIMIT_RATIO;
  let sendNativeTokenAmount = new BigNumber(tx.value); // current transaction native token transfer count
  sendNativeTokenAmount = isNaN(sendNativeTokenAmount.toNumber())
    ? new BigNumber(0)
    : sendNativeTokenAmount;
  const gasNotEnough = gas
    .times(ratio)
    .times(selectedGas?.price || 0)
    .div(1e18)
    .plus(sendNativeTokenAmount.div(1e18))
    .isGreaterThan(new BigNumber(nativeTokenBalance).div(1e18));
  if (gasNotEnough) {
    ratio = explainTx.gas.gas_ratio;
  }
  const recommendGasLimitRatio = needRatio ? ratio : 1;
  let recommendGasLimit = needRatio
    ? gas.times(ratio).toFixed(0)
    : gas.toFixed(0);
  if (block && new BigNumber(recommendGasLimit).gt(block.gasLimit)) {
    recommendGasLimit = new BigNumber(block.gasLimit).times(0.95).toFixed(0);
  }
  const gasLimit = intToHex(
    Math.max(Number(recommendGasLimit), Number(tx.gas || 0)),
  );

  return {
    gasLimit,
    recommendGasLimitRatio,
  };
}

export const getNativeTokenBalance = async ({
  address,
  chainId,
}: {
  address: string;
  chainId: number;
}): Promise<string> => {
  const chain = findChain({
    id: chainId,
  });
  if (!chain) {
    throw new Error('chain not found');
  }
  const balance = await apiProvider.requestETHRpc<any>(
    {
      method: 'eth_getBalance',
      params: [address, 'latest'],
    },
    chain.serverId,
  );
  return balance;
};

export const explainGas = async ({
  gasUsed,
  gasPrice,
  chainId,
  nativeTokenPrice,
  tx,
  gasLimit,
}: {
  gasUsed: number | string;
  gasPrice: number | string;
  chainId: number;
  nativeTokenPrice: number;
  tx: Tx;
  gasLimit: string | undefined;
}) => {
  let gasCostTokenAmount = new BigNumber(gasUsed).times(gasPrice).div(1e18);
  let maxGasCostAmount = new BigNumber(gasLimit || 0).times(gasPrice).div(1e18);
  const chain = findChain({
    id: chainId,
  });
  if (!chain) {
    throw new Error(`${chainId} is not found in supported chains`);
  }
  if (CAN_ESTIMATE_L1_FEE_CHAINS.includes(chain.enum)) {
    const res = await apiProvider.fetchEstimatedL1Fee(
      {
        txParams: tx,
      },
      chain.enum,
    );
    gasCostTokenAmount = new BigNumber(res).div(1e18).plus(gasCostTokenAmount);
    maxGasCostAmount = new BigNumber(res).div(1e18).plus(maxGasCostAmount);
  }
  const gasCostUsd = new BigNumber(gasCostTokenAmount).times(nativeTokenPrice);

  return {
    gasCostUsd,
    gasCostAmount: gasCostTokenAmount,
    maxGasCostAmount,
  };
};
