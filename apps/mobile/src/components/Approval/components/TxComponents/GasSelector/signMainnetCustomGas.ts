import { GasLevel } from '@rabby-wallet/rabby-api/dist/types';

type BuildSignMainnetGasChangeParams = {
  gas: GasLevel;
  gasLimit: number;
  nonce: number;
  maxPriorityFeeGwei: number;
  customGasGwei?: number;
  fixedMode?: boolean;
};

export type SignMainnetGasChange = GasLevel & {
  gasLimit: number;
  nonce: number;
  maxPriorityFee: number;
  fixedMode?: boolean;
};

export const buildSignMainnetGasChange = ({
  gas,
  gasLimit,
  nonce,
  maxPriorityFeeGwei,
  customGasGwei,
  fixedMode,
}: BuildSignMainnetGasChangeParams): SignMainnetGasChange => {
  if (gas.level === 'custom') {
    return {
      ...gas,
      level: 'custom',
      price: Number(customGasGwei || 0) * 1e9,
      gasLimit,
      nonce,
      maxPriorityFee: Number(maxPriorityFeeGwei || 0) * 1e9,
      fixedMode,
    };
  }

  return {
    ...gas,
    gasLimit,
    nonce,
    level: gas.level,
    maxPriorityFee: Number(maxPriorityFeeGwei || 0) * 1e9,
  };
};
