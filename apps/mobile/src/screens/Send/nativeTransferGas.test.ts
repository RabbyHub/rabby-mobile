import { createTestnetChain } from '@/core/utils/customTestnetChain';

import {
  DEFAULT_NATIVE_TRANSFER_GAS_LIMIT,
  estimateNativeTransferGas,
  needsNativeTransferGasEstimate,
  resolveNativeTransferGasLimit,
} from './nativeTransferGas';

const customChain = createTestnetChain({
  id: 5031,
  name: 'Somnia Mainnet',
  nativeTokenSymbol: 'SOMI',
  rpcUrl: 'https://example.invalid',
});
const transferAddresses = {
  from: '0x0000000000000000000000000000000000000001',
  to: '0x0000000000000000000000000000000000000002',
};

describe('estimateNativeTransferGas', () => {
  it('reserves nonzero native-transfer gas on a custom network without an estimate flag', async () => {
    const estimateGas = jest.fn(async ({ value }: { value: string }) =>
      value === '0x0' ? '0x5208' : '0x9a2cc',
    );

    expect(customChain.needEstimateGas).toBeUndefined();
    expect(needsNativeTransferGasEstimate(customChain)).toBe(true);
    await expect(
      estimateNativeTransferGas({
        chain: customChain,
        ...transferAddresses,
        estimateGas,
      }),
    ).resolves.toBe(947250);
    expect(estimateGas).toHaveBeenCalledWith({
      ...transferAddresses,
      gasPrice: '0x0',
      value: '0x1',
    });
  });

  it('preserves intrinsic gas without an RPC request on an ordinary integrated network', async () => {
    const estimateGas = jest.fn();

    expect(needsNativeTransferGasEstimate({})).toBe(false);
    await expect(
      estimateNativeTransferGas({
        chain: {},
        ...transferAddresses,
        estimateGas,
      }),
    ).resolves.toBe(DEFAULT_NATIVE_TRANSFER_GAS_LIMIT);
    expect(estimateGas).not.toHaveBeenCalled();
  });

  it('preserves zero-value estimation and the buffer on integrated networks requiring estimation', async () => {
    const estimateGas = jest.fn(async () => '0x5208');

    await expect(
      estimateNativeTransferGas({
        chain: { needEstimateGas: true },
        ...transferAddresses,
        estimateGas,
      }),
    ).resolves.toBe(31500);
    expect(estimateGas).toHaveBeenCalledWith({
      ...transferAddresses,
      gasPrice: '0x0',
      value: '0x0',
    });
  });

  it.each([
    { description: 'custom network', chain: customChain, expectedGas: 0 },
    {
      description: 'integrated network',
      chain: { needEstimateGas: true },
      expectedGas: 31500,
    },
  ])(
    'handles an RPC failure on a $description',
    async ({ chain, expectedGas }) => {
      const error = new Error('RPC unavailable');
      const logError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      try {
        await expect(
          estimateNativeTransferGas({
            chain,
            ...transferAddresses,
            estimateGas: async () => {
              throw error;
            },
          }),
        ).resolves.toBe(expectedGas);
        expect(logError).toHaveBeenCalledWith(error);
      } finally {
        logError.mockRestore();
      }
    },
  );

  it.each(['0x0', '-1', 'NaN', 'Infinity', 'invalid', '1e309'])(
    'does not substitute fixed gas for an unusable custom-network estimate: %s',
    async result => {
      await expect(
        estimateNativeTransferGas({
          chain: customChain,
          ...transferAddresses,
          estimateGas: async () => result,
        }),
      ).resolves.toBe(0);
    },
  );
});

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

  it('leaves custom-network gas unset when its RPC estimate is unavailable', () => {
    expect(
      resolveNativeTransferGasLimit({
        estimatedGas: 0,
        needEstimateGas: needsNativeTransferGasEstimate(customChain),
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
