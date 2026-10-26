import {
  getGasAccountPriceImpact,
  getNextDefaultQuoteToken,
} from './GasAccountDepositTokenForm.utils';

describe('getGasAccountPriceImpact', () => {
  it('warns from 5% loss and only marks impact above 20% as too high', () => {
    expect(getGasAccountPriceImpact({ payUsd: 1, receiveUsd: 0.98 })).toEqual({
      lossUsd: 0.02,
      showWarning: false,
      isTooHigh: false,
    });
    expect(getGasAccountPriceImpact({ payUsd: 1, receiveUsd: 0.95 })).toEqual({
      lossUsd: 0.05,
      showWarning: true,
      isTooHigh: false,
    });
    expect(getGasAccountPriceImpact({ payUsd: 1, receiveUsd: 0.38 })).toEqual({
      lossUsd: 0.62,
      showWarning: true,
      isTooHigh: true,
    });
  });
});

describe('getNextDefaultQuoteToken', () => {
  it('moves down the balance-sorted list without wrapping', () => {
    const tokens = [
      {
        owner_addr: '0x1',
        chain: 'arb',
        id: '0xA',
        gasAccountDepositType: 'bridge' as const,
      },
      {
        owner_addr: '0x2',
        chain: 'base',
        id: '0xB',
        gasAccountDepositType: 'bridge' as const,
      },
    ];

    expect(getNextDefaultQuoteToken(tokens, tokens[0]!)).toBe(tokens[1]);
    expect(getNextDefaultQuoteToken(tokens, tokens[1]!)).toBeUndefined();
  });
});
