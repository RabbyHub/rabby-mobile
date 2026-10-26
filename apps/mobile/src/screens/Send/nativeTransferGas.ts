import BigNumber from 'bignumber.js';

export const DEFAULT_NATIVE_TRANSFER_GAS_LIMIT = 21000;

type NativeTransferChain = {
  isTestnet?: boolean;
  needEstimateGas?: boolean;
};

export function needsNativeTransferGasEstimate(chain: NativeTransferChain) {
  return !!(chain.isTestnet || chain.needEstimateGas);
}

export async function estimateNativeTransferGas({
  chain,
  from,
  to,
  estimateGas,
}: {
  chain: NativeTransferChain;
  from: string;
  to: string;
  estimateGas: (tx: {
    from: string;
    to: string;
    value: string;
    gasPrice: string;
  }) => Promise<string>;
}) {
  if (!needsNativeTransferGasEstimate(chain)) {
    return DEFAULT_NATIVE_TRANSFER_GAS_LIMIT;
  }

  try {
    const result = await estimateGas({
      from,
      to,
      gasPrice: '0x0',
      // A zero-value transfer misses new-recipient costs on chains such as
      // Somnia. Probe with 1 wei so MAX can reserve gas before setting value.
      value: chain.isTestnet ? '0x1' : '0x0',
    });
    const gas = new BigNumber(result)
      .times(1.5)
      .integerValue(BigNumber.ROUND_CEIL)
      .toNumber();
    if (Number.isSafeInteger(gas) && gas > 0) {
      return gas;
    }
  } catch (error) {
    console.error(error);
  }

  // Custom networks have no known intrinsic gas cost. Leave gas unknown on
  // failure rather than reserving an Ethereum-specific fallback for MAX.
  return chain.isTestnet ? 0 : DEFAULT_NATIVE_TRANSFER_GAS_LIMIT * 1.5;
}

export function resolveNativeTransferGasLimit({
  estimatedGas,
  needEstimateGas,
  couldSpecifyIntrinsicGas,
  isContract,
}: {
  estimatedGas?: number;
  needEstimateGas: boolean;
  couldSpecifyIntrinsicGas: boolean;
  isContract?: boolean;
}) {
  if (isContract) {
    return undefined;
  }

  if (estimatedGas && estimatedGas > 0) {
    return estimatedGas;
  }

  if (!needEstimateGas && couldSpecifyIntrinsicGas) {
    return DEFAULT_NATIVE_TRANSFER_GAS_LIMIT;
  }

  return undefined;
}
