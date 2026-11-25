import type { PerpsCandleDataInterval } from '@/constant/perps';

const mockGetSimpleChartPreference = jest.fn();
const mockSetSimpleChartPreference = jest.fn();
const mockLoadPerpsCandleSourceSnapshot = jest.fn();
const mockUsePerpsCandleFeed = jest.fn(
  ({
    coin,
    enabled,
    interval,
  }: {
    coin: string;
    enabled: boolean;
    interval: PerpsCandleDataInterval;
  }) => ({
    candles: [],
    error: null,
    identity: enabled ? `${coin}:${interval}` : 'disabled',
    latestCandle: null,
    status: enabled ? 'loading' : 'idle',
    updateType: 'reset',
  }),
);

jest.mock('@/core/apis/perps', () => ({
  apisPerps: {
    getSimpleChartPreference: mockGetSimpleChartPreference,
    setSimpleChartPreference: mockSetSimpleChartPreference,
  },
}));

jest.mock('@/hooks/perps/candles/usePerpsCandleFeed', () => ({
  usePerpsCandleFeed: mockUsePerpsCandleFeed,
}));

jest.mock('@/hooks/perps/candles/sourceSnapshot', () => ({
  getPerpsCandleSourceIdentity: (coin: string, interval: string) =>
    `${coin}:${interval}`,
  isPerpsCandleSourceSnapshotFresh: () => true,
  loadPerpsCandleSourceSnapshot: mockLoadPerpsCandleSourceSnapshot,
}));

// The shared preference store is module state: load a fresh registry
// (React and the testing library included) for every test.
type TestingLibrary = typeof import('@testing-library/react-native/pure');
let act: TestingLibrary['act'];
let cleanup: TestingLibrary['cleanup'];
let renderHook: TestingLibrary['renderHook'];
let usePerpsProKline: typeof import('./usePerpsProKline').usePerpsProKline;
let usePerpsChartPreference: typeof import('@/hooks/perps/candles/chartPreference').usePerpsChartPreference;

const flushPromises = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('usePerpsProKline', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    ({
      act,
      cleanup,
      renderHook,
    } = require('@testing-library/react-native/pure'));
    ({ usePerpsProKline } = require('./usePerpsProKline'));
    ({
      usePerpsChartPreference,
    } = require('@/hooks/perps/candles/chartPreference'));
    mockGetSimpleChartPreference.mockResolvedValue(undefined);
    mockSetSimpleChartPreference.mockResolvedValue(undefined);
    mockLoadPerpsCandleSourceSnapshot.mockImplementation(
      ({ coin, interval }: { coin: string; interval: string }) =>
        Promise.resolve({
          candles: [
            {
              close: 12,
              high: 13,
              low: 9,
              open: 10,
              quoteTurnover: null,
              time: 1_800_000,
              trades: 2,
              volume: 3,
            },
          ],
          identity: `${coin}:${interval}`,
          loadedAt: 1,
        }),
    );
  });

  it('hydrates the shared interval before enabling the candle feed', async () => {
    mockGetSimpleChartPreference.mockResolvedValueOnce({
      version: 2,
      style: 'candle',
      range: null,
      interval: '1M',
    });
    const hook = renderHook(() =>
      usePerpsProKline({ coin: 'BTC', enabled: true }),
    );

    expect(hook.result.current).toMatchObject({
      hydrated: false,
      interval: '15m',
    });
    expect(mockUsePerpsCandleFeed).toHaveBeenLastCalledWith({
      coin: 'BTC',
      enabled: false,
      initialSourceCandles: undefined,
      interval: '15m',
      publicationEnabled: true,
    });

    await flushPromises();

    expect(hook.result.current).toMatchObject({
      hydrated: true,
      interval: '1M',
    });
    expect(mockUsePerpsCandleFeed).toHaveBeenLastCalledWith({
      coin: 'BTC',
      enabled: true,
      initialSourceCandles: expect.any(Array),
      interval: '1M',
      publicationEnabled: true,
    });
  });

  it('writes a manual Simple interval that Simple observes immediately', async () => {
    mockGetSimpleChartPreference.mockResolvedValue({
      version: 2,
      style: 'area',
      range: '1D',
      interval: '30m',
    });
    const pro = renderHook(() =>
      usePerpsProKline({ coin: 'BTC', enabled: true }),
    );
    const simple = renderHook(() => usePerpsChartPreference());
    await flushPromises();

    act(() => pro.result.current.selectInterval('5m'));
    await flushPromises();

    const next = { version: 2, style: 'area', range: null, interval: '5m' };
    expect(pro.result.current.interval).toBe('5m');
    expect(simple.result.current.preference).toEqual(next);
    expect(mockSetSimpleChartPreference).toHaveBeenCalledWith(next);
  });

  it('keeps 15m over a Simple range view and ignores re-picking it', async () => {
    mockGetSimpleChartPreference.mockResolvedValue({
      version: 2,
      style: 'candle',
      range: '1W',
      interval: '4h',
    });
    const pro = renderHook(() =>
      usePerpsProKline({ coin: 'BTC', enabled: true }),
    );
    const simple = renderHook(() => usePerpsChartPreference());
    await flushPromises();

    expect(pro.result.current.interval).toBe('15m');
    act(() => pro.result.current.selectInterval('15m'));
    await flushPromises();
    expect(mockSetSimpleChartPreference).not.toHaveBeenCalled();
    expect(simple.result.current.preference.range).toBe('1W');
  });

  it('falls back to the Pro default when preference hydration fails', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockGetSimpleChartPreference.mockRejectedValueOnce(
      new Error('read failed'),
    );
    const hook = renderHook(() =>
      usePerpsProKline({ coin: 'BTC', enabled: true }),
    );

    await flushPromises();

    expect(hook.result.current).toMatchObject({
      hydrated: true,
      interval: '15m',
    });
    consoleError.mockRestore();
  });

  it('preloads an HTTP snapshot without enabling the live Candle feed', async () => {
    const hook = renderHook(() =>
      usePerpsProKline({
        coin: 'BTC',
        enabled: false,
        preloadEnabled: true,
      }),
    );

    await flushPromises();

    expect(mockLoadPerpsCandleSourceSnapshot).toHaveBeenCalledWith({
      coin: 'BTC',
      interval: '15m',
    });
    expect(mockUsePerpsCandleFeed).toHaveBeenLastCalledWith({
      coin: 'BTC',
      enabled: false,
      initialSourceCandles: expect.any(Array),
      interval: '15m',
      publicationEnabled: true,
    });
    expect(hook.result.current.feed).toMatchObject({
      identity: 'BTC:15m',
      status: 'ready',
    });
  });
});
