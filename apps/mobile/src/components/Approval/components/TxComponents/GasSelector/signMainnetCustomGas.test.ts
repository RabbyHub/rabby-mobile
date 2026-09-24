import { buildSignMainnetGasChange } from './signMainnetCustomGas';

describe('buildSignMainnetGasChange', () => {
  it('builds custom gas changes in wei and preserves fixed mode', () => {
    expect(
      buildSignMainnetGasChange({
        gas: {
          level: 'custom',
          front_tx_count: 0,
          price: 0,
          estimated_seconds: 0,
          base_fee: 30,
          priority_price: 0,
        },
        gasLimit: 21000,
        nonce: 7,
        maxPriorityFeeGwei: 1.5,
        customGasGwei: 25.25,
        fixedMode: true,
      }),
    ).toEqual({
      level: 'custom',
      front_tx_count: 0,
      price: 25250000000,
      estimated_seconds: 0,
      base_fee: 30,
      priority_price: 1500000000,
      gasLimit: 21000,
      nonce: 7,
      maxPriorityFee: 1500000000,
      fixedMode: true,
    });
  });

  it('adds gas limit, nonce, and priority fee to preset gas levels', () => {
    expect(
      buildSignMainnetGasChange({
        gas: {
          level: 'fast',
          front_tx_count: 2,
          price: 42000000000,
          estimated_seconds: 15,
          base_fee: 28,
          priority_price: 1000000000,
        },
        gasLimit: 65000,
        nonce: 12,
        maxPriorityFeeGwei: 2,
        customGasGwei: 99,
        fixedMode: true,
      }),
    ).toEqual({
      level: 'fast',
      front_tx_count: 2,
      price: 42000000000,
      estimated_seconds: 15,
      base_fee: 28,
      priority_price: 2000000000,
      gasLimit: 65000,
      nonce: 12,
      maxPriorityFee: 2000000000,
    });
  });

  it('defaults missing custom gas and priority fee values to zero', () => {
    expect(
      buildSignMainnetGasChange({
        gas: {
          level: 'custom',
          front_tx_count: 0,
          price: 123,
          estimated_seconds: 0,
          base_fee: 0,
          priority_price: 456,
        },
        gasLimit: 50000,
        nonce: 1,
        maxPriorityFeeGwei: 0,
      }),
    ).toMatchObject({
      level: 'custom',
      price: 0,
      priority_price: 0,
      maxPriorityFee: 0,
      gasLimit: 50000,
      nonce: 1,
    });
  });
});
