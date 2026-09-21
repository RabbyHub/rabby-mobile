function loadNumberModule() {
  jest.resetModules();

  jest.doMock(
    '@rabby-wallet/biz-utils/dist/isomorphic/biz-number',
    () => ({}),
    {
      virtual: true,
    },
  );

  return require('./number') as typeof import('./number');
}

function loadNumberModuleWithAmountFormatter() {
  jest.resetModules();
  jest.doMock(
    '@rabby-wallet/biz-utils/dist/isomorphic/biz-number',
    () => ({
      formatSpeicalAmount(input: number | string) {
        const inputStr = String(input);
        const matched = inputStr.match(/^[0-9]+(\.|,)\d*/);
        const firstSep = matched?.[1];

        if (firstSep && firstSep !== '.') {
          return inputStr.replace(new RegExp(firstSep), '.');
        }

        return inputStr;
      },
    }),
    {
      virtual: true,
    },
  );

  return require('./number') as typeof import('./number');
}

describe('number utils', () => {
  it('calcAspectRatio respects explicit maxWidth and maxHeight constraints', () => {
    const { calcAspectRatio } = loadNumberModule();

    expect(
      calcAspectRatio(
        {
          width: 200,
          height: 100,
        },
        { maxWidth: 100 },
      ),
    ).toEqual({
      aspectRatio: 2,
      height: 50,
      width: 100,
    });

    expect(
      calcAspectRatio(
        {
          width: 200,
          height: 100,
        },
        { maxHeight: 25 },
      ),
    ).toEqual({
      aspectRatio: 4,
      height: 25,
      width: 50,
    });
  });

  it('calcAspectRatio falls back to coerceNumber defaults for invalid input', () => {
    const { calcAspectRatio } = loadNumberModule();

    expect(
      calcAspectRatio(
        {
          width: 'oops' as any,
          height: undefined,
        },
        { maxWidth: 50 },
      ),
    ).toEqual({
      aspectRatio: 2,
      height: 0,
      width: 50,
    });
  });

  it('isMeaningfulNumber only accepts non-NaN numbers', () => {
    const { isMeaningfulNumber } = loadNumberModule();

    expect(isMeaningfulNumber(0)).toBe(true);
    expect(isMeaningfulNumber(1.23)).toBe(true);
    expect(isMeaningfulNumber(NaN)).toBe(false);
    expect(isMeaningfulNumber('1.23')).toBe(false);
  });
});

describe('amount input decimal formatting', () => {
  it('keeps input within the token decimals limit', () => {
    const { formatTokenAmountInput } = loadNumberModuleWithAmountFormatter();

    expect(formatTokenAmountInput('1.1234567', 6)).toBe('1.123456');
    expect(formatTokenAmountInput('0.0000000000000000009', 18)).toBe(
      '0.000000000000000000',
    );
  });

  it('preserves intermediate decimal input while it is valid for the token', () => {
    const { formatTokenAmountInput } = loadNumberModuleWithAmountFormatter();

    expect(formatTokenAmountInput('1.', 6)).toBe('1.');
    expect(formatTokenAmountInput('.123', 6)).toBe('.123');
  });

  it('removes fractional input for integer tokens', () => {
    const { formatTokenAmountInput, truncateAmountToDecimals } =
      loadNumberModuleWithAmountFormatter();

    expect(formatTokenAmountInput('10.1', 0)).toBe('10');
    expect(truncateAmountToDecimals('10.', 0)).toBe('10');
  });

  it('normalizes comma decimals before truncating', () => {
    const { formatTokenAmountInput } = loadNumberModuleWithAmountFormatter();

    expect(formatTokenAmountInput('12,34567', 4)).toBe('12.3456');
  });

  it('does not truncate when token decimals are unknown', () => {
    const { formatTokenAmountInput } = loadNumberModuleWithAmountFormatter();

    expect(formatTokenAmountInput('1.123456789')).toBe('1.123456789');
  });
});
