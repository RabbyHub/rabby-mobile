import BigNumber from 'bignumber.js';

function loadSendUtils() {
  jest.resetModules();
  jest.doMock(
    '@rabby-wallet/biz-utils/dist/isomorphic/biz-number',
    () => ({
      formatSpeicalAmount(input: number | string) {
        return String(input);
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
    }),
    {
      virtual: true,
    },
  );

  return require('./utils') as typeof import('./utils');
}

describe('Send utils', () => {
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
