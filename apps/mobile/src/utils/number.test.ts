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
