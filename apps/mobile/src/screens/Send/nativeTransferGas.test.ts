import {
  DEFAULT_NATIVE_TRANSFER_GAS_LIMIT,
  resolveNativeTransferGasLimit,
} from './nativeTransferGas';

describe('resolveNativeTransferGasLimit', () => {
  it('uses the estimated gas for a chain that requires estimation', () => {
    expect(
      resolveNativeTransferGasLimit({
        estimatedGas: 31500,
        needEstimateGas: true,
        couldSpecifyIntrinsicGas: true,
        isContract: false,
      }),
    ).toBe(31500);
  });

  it('does not fall back to intrinsic gas when estimation is required', () => {
    expect(
      resolveNativeTransferGasLimit({
        estimatedGas: 0,
        needEstimateGas: true,
        couldSpecifyIntrinsicGas: true,
        isContract: false,
      }),
    ).toBeUndefined();
  });

  it('uses intrinsic gas when the chain does not require estimation', () => {
    expect(
      resolveNativeTransferGasLimit({
        estimatedGas: 0,
        needEstimateGas: false,
        couldSpecifyIntrinsicGas: true,
        isContract: false,
      }),
    ).toBe(DEFAULT_NATIVE_TRANSFER_GAS_LIMIT);
  });

  it('preserves estimated gas when the recipient code lookup fails', () => {
    expect(
      resolveNativeTransferGasLimit({
        estimatedGas: 31500,
        needEstimateGas: true,
        couldSpecifyIntrinsicGas: true,
      }),
    ).toBe(31500);
  });

  it('does not preset gas for a contract recipient', () => {
    expect(
      resolveNativeTransferGasLimit({
        estimatedGas: 31500,
        needEstimateGas: true,
        couldSpecifyIntrinsicGas: true,
        isContract: true,
      }),
    ).toBeUndefined();
  });
});
