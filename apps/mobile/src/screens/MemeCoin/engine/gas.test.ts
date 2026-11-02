import { gasReserveInNativeUnits, toChainGasInfo } from './gas';

describe('gas', () => {
  it('converts gasLimit × gas price into native units', () => {
    expect(
      gasReserveInNativeUnits({
        gasLimit: 1000000,
        gasPriceWei: 2e10,
        nativeDecimals: 18,
      }).toNumber(),
    ).toBe(0.02);
  });

  it('builds chain gas info in USD', () => {
    expect(
      toChainGasInfo({
        gasLimit: 1000000,
        gasPriceWei: 2e10,
        nativeDecimals: 18,
        nativePrice: 3000,
        nativeBalanceUsd: 500,
        bridgeSupported: true,
      }),
    ).toEqual({
      perLegGasUsd: 60,
      nativeBalanceUsd: 500,
      bridgeSupported: true,
    });
  });
});
