import BigNumber from 'bignumber.js';

function loadSendUtils() {
  jest.resetModules();
  jest.doMock(
    '@rabby-wallet/biz-utils/dist/isomorphic/biz-number',
    () => {
      return {
        formatSpeicalAmount(input: number | string) {
          return String(input);
        },
        formatTokenAmount(value: string | number | BigNumber) {
          return new BigNumber(value).toFixed();
        },
        formatUsdValue(value: string | number, decimal = 2) {
          const bnValue = new BigNumber(value);
          if (bnValue.lt(0)) {
            return `-$${bnValue.abs().toFormat(decimal)}`;
          }
          if (bnValue.gte(0.01) || bnValue.eq(0)) {
            return `$${bnValue.toFormat(decimal)}`;
          }
          return '<$0.01';
        },
      };
    },
    {
      virtual: true,
    },
  );

  return require('./utils') as typeof import('./utils');
}

describe('Send utils', () => {
  describe('formatSendTokenBalanceText', () => {
    it('preserves a positive balance below the Send display precision', () => {
      const { formatSendTokenBalanceText } = loadSendUtils();
      const b2BtcBalance = new BigNumber('0x1adb0').div(
        new BigNumber(10).pow(18),
      );

      expect(formatSendTokenBalanceText(b2BtcBalance, 4)).toBe(
        '0.00000000000011',
      );
      expect(formatSendTokenBalanceText(b2BtcBalance, 8)).toBe(
        '0.00000000000011',
      );
    });

    it('preserves the zero balance display', () => {
      const { formatSendTokenBalanceText } = loadSendUtils();

      expect(formatSendTokenBalanceText(0, 4)).toBe('0');
    });

    it('keeps flooring regular balances instead of rounding up', () => {
      const { formatSendTokenBalanceText } = loadSendUtils();

      expect(formatSendTokenBalanceText('1.23459', 4)).toBe('1.2345');
    });
  });

  describe('formatSendUsdValueText', () => {
    it('preserves the Send zero display', () => {
      const { formatSendUsdValueText } = loadSendUtils();

      expect(formatSendUsdValueText(0)).toBe('$0');
    });

    it('uses canonical USD placement for sub-cent positive values', () => {
      const { formatSendUsdValueText } = loadSendUtils();

      expect(formatSendUsdValueText(0.009)).toBe('<$0.01');
    });

    it('formats regular values with cents and grouping', () => {
      const { formatSendUsdValueText } = loadSendUtils();

      expect(formatSendUsdValueText(new BigNumber('1234.5'))).toBe('$1,234.50');
    });
  });
});
