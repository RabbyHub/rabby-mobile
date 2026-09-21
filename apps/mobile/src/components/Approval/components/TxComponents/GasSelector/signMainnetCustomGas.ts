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
  const maxPriorityFee = Number(maxPriorityFeeGwei || 0) * 1e9;

  if (gas.level === 'custom') {
    return {
      ...gas,
      level: 'custom',
      price: Number(customGasGwei || 0) * 1e9,
      priority_price: maxPriorityFee,
      gasLimit,
      nonce,
      maxPriorityFee,
      fixedMode,
    };
  }

  return {
    ...gas,
    gasLimit,
    nonce,
    level: gas.level,
    priority_price: maxPriorityFee,
    maxPriorityFee,
  };
};
