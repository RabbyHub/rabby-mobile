import { Chain } from '@/constant/chains';
import {
  CAN_ESTIMATE_L1_FEE_CHAINS,
  DEFAULT_GAS_LIMIT_BUFFER,
  DEFAULT_GAS_LIMIT_RATIO,
  SAFE_GAS_LIMIT_BUFFER,
  SAFE_GAS_LIMIT_RATIO,
} from '@/constant/gas';
import * as apiProvider from '@/core/apis/provider';
import { findChain } from '@/utils/chain';
import { intToHex } from '@/utils/number';
import type {
  ExplainTxResponse,
  GasLevel,
} from '@rabby-wallet/rabby-api/dist/types';
import { Tx } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';
import { Account } from '../services/preference';
import { TX_GAS_LIMIT_CHAIN_MAPPING } from '@/constant/txGasLimit';

export interface BlockInfo {
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
  account,
  preparedBlock,
}: {
  chain: Chain;
  tx: Tx;
  gas: BigNumber;
  selectedGas: GasLevel | null;
  nativeTokenBalance: string;
  explainTx: ExplainTxResponse;
  needRatio: boolean;
  account: Account;
  preparedBlock?: BlockInfo | Promise<BlockInfo | null>;
}) {
  let block: null | BlockInfo = preparedBlock ? await preparedBlock : null;
  try {
    if (!block) {
      block = await apiProvider.requestETHRpc<BlockInfo>(
        {
          method: 'eth_getBlockByNumber',
          params: ['latest', false],
        },
        chain.serverId,
        account,
      );
    }
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
    const buffer = SAFE_GAS_LIMIT_BUFFER[chain.id] || DEFAULT_GAS_LIMIT_BUFFER;
    recommendGasLimit = new BigNumber(block.gasLimit).times(buffer).toFixed(0);
  }

  const singleTxGasLimit =
    TX_GAS_LIMIT_CHAIN_MAPPING[chain.enum] || Number(recommendGasLimit);

  recommendGasLimit =
    Number(recommendGasLimit) > singleTxGasLimit
      ? singleTxGasLimit + ''
      : recommendGasLimit;

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
  account,
}: {
  address: string;
  chainId: number;
  account: Account;
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
    account,
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
  account,
  preparedL1Fee,
}: {
  gasUsed: number | string;
  gasPrice: number | string;
  chainId: number;
  nativeTokenPrice: number;
  tx: Tx;
  gasLimit: string | undefined;
  account: Account;
  preparedL1Fee?: string | Promise<string>;
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
    let res =
      typeof preparedL1Fee === 'object' && 'then' in preparedL1Fee
        ? await preparedL1Fee
        : preparedL1Fee || undefined;
    if (!res) {
      res = await apiProvider.fetchEstimatedL1Fee(
        {
          txParams: tx,
          account,
        },
        chain.enum,
      );
    }
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
