import { BigNumber as EthersBigNumber, constants } from 'ethers';

import {
  DEFAULT_DEBT_SWAP_SLIPPAGE,
  ZERO_PERMIT,
  formatTx,
  getParaswapSlippage,
  maxInputAmountWithSlippage,
  sliderHapticTriggerNumbers,
  swapTypesThatRequiresInvertedQuote,
} from '../utils';

describe('DebtSwapModal utils', () => {
  describe('constants', () => {
    it('keeps debt swap UI and permit defaults stable', () => {
      expect(sliderHapticTriggerNumbers).toEqual([0, 50, 100]);
      expect(DEFAULT_DEBT_SWAP_SLIPPAGE).toBe(40);
      expect(ZERO_PERMIT).toEqual({
        value: '0',
        deadline: '0',
        v: 0,
        r: constants.HashZero,
        s: constants.HashZero,
      });
      expect(swapTypesThatRequiresInvertedQuote).toEqual([
        'debt_swap',
        'repay_with_collateral',
      ]);
    });
  });

  describe('maxInputAmountWithSlippage', () => {
    it('adds basis-point slippage and rounds up to a raw integer amount', () => {
      expect(maxInputAmountWithSlippage('1000', 40)).toBe('1004');
      expect(maxInputAmountWithSlippage('1', 1)).toBe('2');
    });

    it('returns zero for empty, zero or negative inputs', () => {
      expect(maxInputAmountWithSlippage('', 40)).toBe('0');
      expect(maxInputAmountWithSlippage('0', 40)).toBe('0');
      expect(maxInputAmountWithSlippage('-1', 40)).toBe('0');
    });
  });

  describe('formatTx', () => {
    it('formats populated transactions with fallback from address, hex value and nonce zero', () => {
      expect(
        formatTx(
          {
            to: '0x0000000000000000000000000000000000000001',
            data: '0x1234',
            value: EthersBigNumber.from('1000000000000000000'),
            nonce: 0,
          },
          '0x0000000000000000000000000000000000000002',
          1,
        ),
      ).toEqual({
        from: '0x0000000000000000000000000000000000000002',
        to: '0x0000000000000000000000000000000000000001',
        data: '0x1234',
        value: '0x0de0b6b3a7640000',
        chainId: 1,
        nonce: 0,
      });
    });

    it('preserves explicit from, string value and non-zero nonce', () => {
      expect(
        formatTx(
          {
            from: '0x0000000000000000000000000000000000000003',
            to: '0x0000000000000000000000000000000000000001',
            data: '0xabcd',
            value: '0x2a',
            nonce: 7,
          },
          '0x0000000000000000000000000000000000000002',
          42161,
        ),
      ).toEqual({
        from: '0x0000000000000000000000000000000000000003',
        to: '0x0000000000000000000000000000000000000001',
        data: '0xabcd',
        value: '0x2a',
        chainId: 42161,
        nonce: 7,
      });
    });

    it('returns null when populated transaction data is missing', () => {
      expect(
        formatTx(
          {
            to: '0x0000000000000000000000000000000000000001',
            value: '0x0',
          },
          '0x0000000000000000000000000000000000000002',
          1,
        ),
      ).toBe(null);
    });
  });

  describe('getParaswapSlippage', () => {
    it('uses lower base slippage for assets in the same group', () => {
      expect(getParaswapSlippage('USDC', 'USDT', 'swap' as any)).toBe(10);
      expect(getParaswapSlippage('USDC', 'USDT', 'debt_swap' as any)).toBe(20);
      expect(
        getParaswapSlippage('USDC', 'USDT', 'repay_with_collateral' as any),
      ).toBe(50);
    });

    it('uses higher base slippage for assets in different groups', () => {
      expect(getParaswapSlippage('USDC', 'WETH', 'swap' as any)).toBe(20);
      expect(getParaswapSlippage('USDC', 'WETH', 'debt_swap' as any)).toBe(40);
      expect(
        getParaswapSlippage('USDC', 'WETH', 'repay_with_collateral' as any),
      ).toBe(100);
    });
  });
});
