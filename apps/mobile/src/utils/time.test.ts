function loadTimeModule() {
  jest.resetModules();

  jest.doMock(
    '@rabby-wallet/biz-utils/dist/isomorphic/biz-number',
    () => ({
      coerceInteger: (value: unknown, fallback = 0) => {
        const parsed = Number.parseInt(String(value), 10);
        return Number.isNaN(parsed) ? fallback : parsed;
      },
    }),
    {
      virtual: true,
    },
  );

  return require('./time') as typeof import('./time');
}

describe('time utils', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-09T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('formats seconds and spans using the current thresholds', () => {
    const { formatSeconds, getTimeSpan, getTimeSpanByMs, timeago } =
      loadTimeModule();

    expect(formatSeconds(59)).toBe('59 sec');
    expect(formatSeconds(61)).toBe('1min 1sec');
    expect(getTimeSpan(90061)).toEqual({ d: 1, h: 1, m: 1, s: 1 });
    expect(getTimeSpanByMs(90061_000)).toEqual({ d: 1, h: 1, m: 1, s: 1 });
    expect(timeago(0, 3_661_000)).toEqual({ hour: 1, minute: 1, second: 1 });
  });

  it('keeps the current human-readable wording for durations', () => {
    const { formatTimeReadable } = loadTimeModule();

    expect(formatTimeReadable(0)).toBe('0sec');
    expect(formatTimeReadable(61)).toBe('1min');
    expect(formatTimeReadable(3600)).toBe('1hr');
    expect(formatTimeReadable(172800)).toBe('2days');
  });

  it('fromNow and fromNowWithSecs follow the current minimum-minute and second-level rules', () => {
    const { fromNow, fromNowWithSecs } = loadTimeModule();

    expect(fromNow(100, 100)).toBe('1min');
    expect(fromNow(0, 90061, true)).toBe('1 day  1 hour 1 min');
    expect(fromNowWithSecs(100, 100)).toBe('0sec');
    expect(fromNowWithSecs(0, 90061)).toBe('1day  1hour 1min');
  });

  it('calcGasEstimated and formatTimestamp preserve current branching behavior', () => {
    const { calcGasEstimated, formatTimestamp } = loadTimeModule();
    const t = (key: string) => key;

    expect(calcGasEstimated(undefined)).toBeUndefined();
    expect(calcGasEstimated(59.4)).toBe('~59sec');
    expect(calcGasEstimated(61)).toBe('~1min');
    expect(calcGasEstimated(1800)).toBe('>30 min');

    expect(formatTimestamp(Date.now(), t)).toBe('page.transactions.Today');
    expect(formatTimestamp(Date.now() - 24 * 60 * 60 * 1000, t)).toBe(
      'page.transactions.Yesterday',
    );
    expect(formatTimestamp(Date.UTC(2020, 0, 1), t)).toBe('Jan 1, 2020');
  });

  it('computes lottie duration from frames and fallbacks', () => {
    const { getLottieAnimationDurationInMS } = loadTimeModule();

    expect(
      getLottieAnimationDurationInMS(
        {
          ip: 10,
          op: 40,
          fr: 10,
        },
        {},
      ),
    ).toBe(3000);

    expect(
      getLottieAnimationDurationInMS(
        {
          ip: 0,
        },
        {
          frameCountFallback: 60,
          frameRateFallback: 0,
        },
      ),
    ).toBe(0);
  });
});
