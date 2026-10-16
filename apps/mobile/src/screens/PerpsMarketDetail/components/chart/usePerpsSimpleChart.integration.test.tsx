import { act, renderHook, cleanupAsync } from '@testing-library/react-native';
import { AppState } from 'react-native';
import type { Candle } from '@rabby-wallet/hyperliquid-sdk';
import type { StorageAdapater } from '@rabby-wallet/persist-store';
/* eslint-disable no-runtime-service-imports */
import { PerpsService } from '@/core/services/perpsService';
import { registerService } from '@/core/services/serviceRegistry';
/* eslint-enable no-runtime-service-imports */
import { apisPerps } from '@/core/apis/perps';
import { resetPerpsCandleSourceSnapshotCacheForTests } from '@/hooks/perps/candles/sourceSnapshot';
import type {
  SimpleChartConfig,
  SimpleChartMessage,
} from '@/components2024/TradingViewCandleChart/type';
import type { TradingViewChartRef } from '@/components2024/TradingViewCandleChart';
import { usePerpsSimpleChart } from './usePerpsSimpleChart';
import { resetFirstDailyCandleCacheForTests } from './firstDailyCandle';

jest.mock('@ledgerhq/react-native-hw-transport-ble', () => ({}));
jest.mock('react-native-haptic-feedback', () => ({ trigger: jest.fn() }));
let mockFocused = true;
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFocused,
}));
jest.useFakeTimers();

const config: Omit<SimpleChartConfig, 'range' | 'style' | 'interval'> = {
  priceDecimals: 2,
  colors: {
    background: '#fff',
    text: '#000',
    grid: '#ddd',
    secondary: '#888',
    entry: '#888',
    entryBackground: '#ccc',
    entryText: '#333',
    up: '#36B16D',
    down: '#E85046',
    accent: '#23C0B0',
    areaTop: '#50D2C1',
    areaBottom: 'transparent',
    contrast: '#fff',
    liquidation: '#FF9F0A',
  },
  labels: {
    entry: 'Avg. entry',
    tp: 'Take profit',
    sl: 'Stop loss',
    liq: 'Liquidation',
    buy: 'Buy',
    sell: 'Sell',
    empty: 'No data',
  },
};
const prices = { entryPrice: 100 };
const fills = [{ time: 1700000000, side: 'B' }];
const raw = (coin = 'BTC', interval = '30m', close = '105'): Candle => ({
  t: 1700000000000,
  T: 1700000899999,
  s: coin,
  i: interval,
  o: '100',
  h: '120',
  l: '90',
  c: close,
  v: '10',
  n: 2,
});
const settle = async () => {
  await act(async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  });
};

describe('Simple chart real preference/API/feed/controller integration', () => {
  let unregister: () => void;
  let service: PerpsService;
  let messages: SimpleChartMessage[];
  let candleCallbacks: Array<(candle: Candle) => void>;
  let releases: jest.Mock[];
  let requests: Array<{ coin: string; interval: string }>;
  let fetchCandles: (coin: string, interval: string) => Promise<Candle[]>;

  beforeEach(() => {
    mockFocused = true;
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      value: 'active',
    });
    messages = [];
    candleCallbacks = [];
    releases = [];
    requests = [];
    resetPerpsCandleSourceSnapshotCacheForTests();
    resetFirstDailyCandleCacheForTests();
    const values = new Map<string, string>();
    const storageAdapter: StorageAdapater = {
      getItem: key => values.get(String(key)) ?? null,
      setItem: (key, value) => {
        values.set(String(key), value);
      },
      removeItem: key => {
        values.delete(String(key));
      },
      clearAll: () => values.clear(),
    };
    service = new PerpsService({
      storageAdapter,
      keyringCrypto: {
        isUnlocked: () => false,
        decryptWithPassword: async () => {
          throw new Error('No signing in chart tests');
        },
        encryptWithPassword: async () => {
          throw new Error('No signing in chart tests');
        },
      },
    });
    unregister = registerService('perpsService', service);
    fetchCandles = async (coin, interval) => [raw(coin, interval)];
    jest.spyOn(global, 'fetch').mockImplementation(async (_url, init) => {
      const request = JSON.parse(String(init?.body));
      if (request.type === 'allPerpMetas')
        return {
          ok: true,
          json: async () => [{ universe: [], marginTables: [] }],
        } as unknown as Response;
      if (request.type !== 'candleSnapshot')
        throw new Error(`Unexpected network request: ${request.type}`);
      const { coin, interval } = request.req;
      requests.push({ coin, interval });
      const candles = await fetchCandles(coin, interval);
      return { ok: true, json: async () => candles } as Response;
    });
    // The external SDK's WS transport is the process boundary; repository feed and API stay real.
    jest
      .spyOn(apisPerps.getPerpsSDK().ws, 'subscribeToCandles')
      .mockImplementation((_coin, _interval, listener) => {
        candleCallbacks.push(listener);
        const unsubscribe = jest.fn();
        releases.push(unsubscribe);
        return { unsubscribe } as ReturnType<
          ReturnType<typeof apisPerps.getPerpsSDK>['ws']['subscribeToCandles']
        >;
      });
  });
  afterEach(async () => {
    await cleanupAsync();
    apisPerps.destroyPerpsSDK();
    unregister();
    jest.restoreAllMocks();
    jest.clearAllTimers();
  });
  const mount = (coin = 'BTC', chartConfig = config) => {
    const hook = renderHook(
      ({ name, owner, chartConfig }) =>
        usePerpsSimpleChart({
          coin: name,
          accountKey: owner,
          config: chartConfig,
          prices: owner ? prices : {},
          fills: owner ? fills : [],
        }),
      { initialProps: { name: coin, owner: 'account-a', chartConfig } },
    );
    // Native WebView bridge boundary: collect messages, preserving the real controller protocol.
    hook.result.current.chartRef.current = {
      sendSimpleMessage: message => {
        messages.push(message);
        if (message.action === 'replace')
          void Promise.resolve().then(() =>
            hook.result.current.onSimpleEvent({
              type: 'PERPS_SIMPLE_EVENT',
              event: 'applied',
              identity: message.identity,
              sequence: message.sequence,
              referencePrice: message.config.range === '1W' ? 90 : null,
            }),
          );
      },
    } as TradingViewChartRef;
    act(() => hook.result.current.onChartReady());
    return hook;
  };

  const replacement = () =>
    messages.filter(m => m.action === 'replace').at(-1)!;
  const viewport = (hook: ReturnType<typeof mount>) => ({
    type: 'PERPS_SIMPLE_EVENT' as const,
    event: 'viewport' as const,
    identity: replacement().identity,
    presentationSequence: replacement().sequence,
    priceAxisSession: 1,
    style: hook.result.current.requestedPreference.style,
    paneWidth: 310,
    paneHeight: 274,
    resetVisible: true,
    latestVisible: true,
  });

  it.each(['viewport-first', 'applied-first'])(
    'requires the current drawing with %s and blocks actions after loading/error',
    async order => {
      const hook = mount();
      await settle();
      hook.result.current.chartRef.current = {
        sendSimpleMessage: message => messages.push(message),
      } as TradingViewChartRef;
      act(() => hook.result.current.onChartReady());
      await settle();
      const view = viewport(hook);
      const applied = {
        type: 'PERPS_SIMPLE_EVENT' as const,
        event: 'applied' as const,
        identity: replacement().identity,
        sequence: replacement().sequence,
        referencePrice: null,
      };
      const events =
        order === 'viewport-first' ? [view, applied] : [applied, view];
      act(() => hook.result.current.onSimpleEvent(events[0]));
      expect(hook.result.current.resetVisible).toBe(false);
      expect(hook.result.current.latestVisible).toBe(false);
      act(() => hook.result.current.onSimpleEvent(events[1]));
      expect(hook.result.current.loading).toBe(false);
      expect(hook.result.current.resetVisible).toBe(true);
      expect(hook.result.current.latestVisible).toBe(true);
      const { reset, latest } = hook.result.current;
      messages.length = 0;
      act(() => {
        reset();
        latest();
      });
      expect(messages.map(m => m.action)).toEqual(['reset', 'latest']);
      act(() => {
        if (order === 'viewport-first') hook.result.current.onChartLoading();
        else hook.result.current.onChartError();
      });
      expect(hook.result.current.resetVisible).toBe(false);
      expect(hook.result.current.latestVisible).toBe(false);
      messages.length = 0;
      act(() => {
        reset();
        latest();
      });
      expect(messages).toEqual([]);
      expect(hook.result.current.loading).toBe(true);
    },
  );

  it('streams seconds, isolates Pro preferences and commits only the latest requested period', async () => {
    await service.setSelectedKlineInterval('4h');
    const hook = mount();
    await settle();
    expect(replacement()).toMatchObject({
      candles: [{ time: 1700000000, close: 105 }],
    });
    messages.length = 0;
    act(() => candleCallbacks.at(-1)!(raw('BTC', '30m', '110')));
    expect(messages).toEqual([
      expect.objectContaining({
        action: 'update',
        candle: expect.objectContaining({ close: 110 }),
      }),
    ]);
    messages.length = 0;
    act(() =>
      hook.result.current.updatePreference({
        ...hook.result.current.preference,
        style: 'area',
      }),
    );
    await settle();
    expect(requests).toHaveLength(1);
    expect(messages.every(m => m.action === 'configure')).toBe(true);
    const pending = new Map<string, (candles: Candle[]) => void>();
    fetchCandles = (_coin, interval) =>
      new Promise(resolve => pending.set(interval, resolve));
    const choose = (interval: '1h' | '3d') =>
      act(() =>
        hook.result.current.updatePreference({
          version: 2,
          style: 'area',
          range: null,
          interval,
        }),
      );
    choose('1h');
    await settle();
    expect(hook.result.current.preference.interval).toBe('30m');
    expect(hook.result.current.loading).toBe(true);
    choose('3d');
    await settle();
    await act(async () => pending.get('3d')!([raw('BTC', '3d', '108')]));
    await settle();
    expect(hook.result.current.preference).toMatchObject({
      interval: '3d',
      range: null,
    });
    expect(hook.result.current.loading).toBe(false);
    await act(async () => pending.get('1h')!([raw('BTC', '1h', '99')]));
    await settle();
    expect(hook.result.current.feed.latestCandle?.close).toBe(108);
    expect(await service.getSimpleChartPreference()).toMatchObject({
      interval: '3d',
      style: 'area',
    });
    expect(await service.getSelectedKlineInterval()).toBe('4h');
  });

  it('rejects old coin and native-axis callbacks while releasing the old subscription', async () => {
    const chartConfig = { ...config, nativePriceAxis: true };
    const hook = mount('BTC', chartConfig);
    await settle();
    expect(hook.result.current.priceAxisOwner).toBeNull();
    act(() => hook.result.current.onSimpleEvent(viewport(hook)));
    const owner = hook.result.current.priceAxisOwner!;
    expect(owner).not.toBeNull();
    const identity = replacement().identity;
    const staleCandle = candleCallbacks[0];
    const command = {
      action: 'priceAxis',
      phase: 'start',
      gestureId: 1,
      deltaY: 0,
    } as const;
    act(() => hook.result.current.onPriceAxisCommand(owner, command));
    expect(messages.at(-1)).toMatchObject({ ...command, session: 1 });
    fetchCandles = () => new Promise(() => {});
    hook.rerender({ name: 'ETH', owner: 'account-a', chartConfig });
    await settle();
    expect(releases[0]).toHaveBeenCalledTimes(1);
    expect(hook.result.current.hasAppliedData).toBe(false);
    expect(hook.result.current.feed.candles).toHaveLength(0);
    expect(hook.result.current.priceAxisOwner).toBeNull();
    messages.length = 0;
    act(() => {
      staleCandle(raw('BTC', '30m', '119'));
      hook.result.current.onPriceAxisCommand(owner, {
        ...command,
        phase: 'move',
        deltaY: 30,
      });
      hook.result.current.onSimpleEvent({
        type: 'PERPS_SIMPLE_EVENT',
        identity,
        event: 'selection',
        candle: { time: 1, open: 1, high: 2, low: 1, close: 2 },
      });
    });
    expect(messages).toEqual([]);
    expect(hook.result.current.feed.candles).toHaveLength(0);
    expect(hook.result.current.selection).toBeNull();
  });

  it('recovers when the socket opens before the resumed HTTP baseline fails and merges the buffered latest candle', async () => {
    const handlers = new Map<string, () => void>();
    const ws = apisPerps.getPerpsSDK().ws;
    jest.spyOn(ws, 'on').mockImplementation((event, callback) => {
      handlers.set(event, callback as () => void);
    });
    const listeners: Array<(state: string) => void> = [];
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, listener) => {
        listeners.push(listener);
        return {
          remove: () => {
            const i = listeners.indexOf(listener);
            if (i >= 0) listeners.splice(i, 1);
          },
        };
      });
    const hook = mount();
    await settle();
    act(() => listeners.forEach(listener => listener('background')));
    await settle();
    act(() => jest.advanceTimersByTime(16000));
    let fail!: (error: Error) => void;
    fetchCandles = () =>
      new Promise((_resolve, reject) => {
        fail = reject;
      });
    act(() => listeners.forEach(listener => listener('active')));
    await settle();
    act(() => handlers.get('open')!());
    await settle();
    await act(async () => fail(new Error('Network request failed')));
    await settle();
    act(() => candleCallbacks.at(-1)!(raw('BTC', '30m', '115')));
    await settle();
    expect(hook.result.current.feed.status).toBe('error');
    fetchCandles = async () => [raw('BTC', '30m', '108')];
    act(() => jest.advanceTimersByTime(1000));
    await settle();
    expect(hook.result.current.feed.latestCandle?.close).toBe(115);
    expect(hook.result.current.loading).toBe(false);
    expect(
      messages.filter(message => message.action === 'data').at(-1),
    ).toMatchObject({
      preserve: true,
      candles: [expect.objectContaining({ close: 115 })],
    });
  });

  it('uses verified short-history data without tick refetches and ignores a superseded daily lookup', async () => {
    const hook = mount();
    await settle();
    expect(replacement()).toMatchObject({ sourceStartTime: 1700000000 });
    const shortHistory = (start = 1699000000) =>
      act(() =>
        hook.result.current.onSimpleEvent({
          type: 'PERPS_SIMPLE_EVENT',
          event: 'rangeReference',
          identity: replacement().identity,
          referencePrice: null,
          coverage: { kind: 'short', start },
        }),
      );
    shortHistory();
    await settle();
    expect(hook.result.current.rangeReference).toBe(100);
    expect(hook.result.current.shortHistory).toBe(true);
    act(() => candleCallbacks.at(-1)!(raw('BTC', '30m', '115')));
    await settle();
    expect(requests.filter(r => r.interval === '1d')).toHaveLength(1);
    expect(releases).toHaveLength(1);
    resetFirstDailyCandleCacheForTests();
    let resolveDaily!: (candles: Candle[]) => void;
    fetchCandles = () =>
      new Promise(resolve => {
        resolveDaily = resolve;
      });
    shortHistory(1699000001);
    await settle();
    act(() => hook.result.current.onChartLoading());
    await act(async () => resolveDaily([raw('BTC', '1d')]));
    await settle();
    expect(hook.result.current.rangeReference).toBeNull();
  });
});
