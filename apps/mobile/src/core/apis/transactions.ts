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
import {
  GasTokenBalanceInfo,
  getTempoFeeTokenInfo,
  isTempoChain,
} from '@/utils/tempo';

const GAS_PRICE_DECIMALS = 18;

const rawAmountToBn = (
  value: string | number | BigNumber | null | undefined,
) => {
  if (BigNumber.isBigNumber(value)) {
    return value;
  }
  return new BigNumber(value || 0);
};

const pow10 = (decimals: number) => {
  return new BigNumber(10).pow(Math.max(0, decimals));
};

const convert18RawToTokenRaw = (
  rawAmountIn18: BigNumber,
  tokenDecimals: number,
) => {
  if (tokenDecimals === GAS_PRICE_DECIMALS) {
    return rawAmountIn18;
  }
  if (tokenDecimals > GAS_PRICE_DECIMALS) {
    return rawAmountIn18.times(pow10(tokenDecimals - GAS_PRICE_DECIMALS));
  }
  return rawAmountIn18.div(pow10(GAS_PRICE_DECIMALS - tokenDecimals));
};

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
  gasTokenDecimals = GAS_PRICE_DECIMALS,
  checkTxValueInBalance = true,
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
  gasTokenDecimals?: number;
  checkTxValueInBalance?: boolean;
}) {
  let block: null | BlockInfo = null;
  try {
    block = preparedBlock ? await preparedBlock : null;
  } catch (error) {
    // NOTHING
  }
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
  const sendNativeTokenRawAmount = checkTxValueInBalance
    ? convert18RawToTokenRaw(rawAmountToBn(tx.value || 0), gasTokenDecimals)
    : new BigNumber(0);
  const gasNotEnough = gas
    .times(ratio)
    .times(selectedGas?.price || 0)
    .plus(sendNativeTokenRawAmount)
    .isGreaterThan(rawAmountToBn(nativeTokenBalance));
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

export const getGasTokenBalance = async ({
  address,
  chainId,
  account,
}: {
  address: string;
  chainId: number;
  account: Account;
}): Promise<GasTokenBalanceInfo> => {
  const chain = findChain({
    id: chainId,
  });
  if (!chain) {
    throw new Error('chain not found');
  }

  if (isTempoChain(chain.serverId)) {
    const feeToken = await getTempoFeeTokenInfo({
      account,
      userAddress: address,
      chainServerId: chain.serverId,
    });
    return {
      rawBalance: rawAmountToBn(feeToken.rawBalanceHex || 0).toFixed(0),
      token: {
        tokenId: feeToken.tokenId,
        symbol: feeToken.symbol,
        decimals: feeToken.decimals,
        logoUrl: feeToken.logoUrl,
      },
    };
  }

  const balance = await apiProvider.requestETHRpc<any>(
    {
      method: 'eth_getBalance',
      params: [address, 'latest'],
    },
    chain.serverId,
    account,
  );

  return {
    rawBalance: rawAmountToBn(balance || 0).toFixed(0),
    token: {
      tokenId: chain.nativeTokenAddress,
      symbol: chain.nativeTokenSymbol,
      decimals: chain.nativeTokenDecimals || GAS_PRICE_DECIMALS,
      logoUrl: chain.nativeTokenLogo,
    },
  };
};

export const getNativeTokenBalance = async ({
  address,
  chainId,
  account,
}: {
  address: string;
  chainId: number;
  account: Account;
}): Promise<string> => {
  const gasToken = await getGasTokenBalance({
    address,
    chainId,
    account,
  });
  return gasToken.rawBalance;
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
  gasTokenDecimals = GAS_PRICE_DECIMALS,
}: {
  gasUsed: number | string;
  gasPrice: number | string;
  chainId: number;
  nativeTokenPrice: number;
  tx: Tx;
  gasLimit: string | undefined;
  account: Account;
  preparedL1Fee?: string | Promise<string>;
  gasTokenDecimals?: number;
}) => {
  let gasCostRawAmountIn18 = rawAmountToBn(gasUsed).times(gasPrice);
  let maxGasCostRawAmountIn18 = rawAmountToBn(gasLimit || 0).times(gasPrice);
  let gasCostTokenAmount = gasCostRawAmountIn18.div(1e18);
  let maxGasCostAmount = maxGasCostRawAmountIn18.div(1e18);
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
    gasCostRawAmountIn18 = gasCostRawAmountIn18.plus(rawAmountToBn(res));
    maxGasCostRawAmountIn18 = maxGasCostRawAmountIn18.plus(rawAmountToBn(res));
    gasCostTokenAmount = gasCostRawAmountIn18.div(1e18);
    maxGasCostAmount = maxGasCostRawAmountIn18.div(1e18);
  }
  const gasCostUsd = new BigNumber(gasCostTokenAmount).times(
    isTempoChain(chain.serverId) ? 1 : nativeTokenPrice,
  );
  const gasCostRawAmount = convert18RawToTokenRaw(
    gasCostRawAmountIn18,
    gasTokenDecimals,
  );
  const maxGasCostRawAmount = convert18RawToTokenRaw(
    maxGasCostRawAmountIn18,
    gasTokenDecimals,
  );

  return {
    gasCostUsd,
    gasCostAmount: gasCostTokenAmount,
    maxGasCostAmount,
    gasCostRawAmount,
    maxGasCostRawAmount,
  };
};
