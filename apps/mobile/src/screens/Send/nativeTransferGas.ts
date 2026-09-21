export const DEFAULT_NATIVE_TRANSFER_GAS_LIMIT = 21000;

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
