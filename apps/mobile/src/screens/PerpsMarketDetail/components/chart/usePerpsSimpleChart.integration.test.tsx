import { act, renderHook, cleanup } from '@testing-library/react-native';
import { AppState } from 'react-native';
import type { Candle } from '@rabby-wallet/hyperliquid-sdk';
import type { StorageAdapater } from '@rabby-wallet/persist-store';
/* eslint-disable no-runtime-service-imports */
import { PerpsService } from '@/core/services/perpsService';
import { registerService } from '@/core/services/serviceRegistry';
/* eslint-enable no-runtime-service-imports */
import { apisPerps } from '@/core/apis/perps';
import {
  loadPerpsCandleSourceSnapshot,
  resetPerpsCandleSourceSnapshotCacheForTests,
} from '@/hooks/perps/candles/sourceSnapshot';
import type {
  SimpleChartConfig,
  SimpleChartMessage,
} from '@/components2024/TradingViewCandleChart/type';
import type { TradingViewChartRef } from '@/components2024/TradingViewCandleChart';
import { usePerpsSimpleChart } from './usePerpsSimpleChart';

jest.mock('@ledgerhq/react-native-hw-transport-ble', () => ({}));
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
  afterEach(() => {
    cleanup();
    apisPerps.destroyPerpsSDK();
    unregister();
    jest.restoreAllMocks();
    jest.clearAllTimers();
  });
  const mount = (coin = 'BTC') => {
    const hook = renderHook(
      ({ name, owner, chartConfig }) =>
        usePerpsSimpleChart({
          coin: name,
          accountKey: owner,
          config: chartConfig,
          prices: owner ? prices : {},
          fills: owner ? fills : [],
        }),
      { initialProps: { name: coin, owner: 'account-a', chartConfig: config } },
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

  it('keeps Pro preferences untouched, sends seconds, and publishes realtime tail updates', async () => {
    await service.setSelectedKlineInterval('4h');
    const hook = mount();
    await settle();
    expect(hook.result.current.feed.status).toBe('ready');
    expect(requests).toEqual([{ coin: 'BTC', interval: '30m' }]);
    const baseline = messages.filter(m => m.action === 'replace').at(-1);
    expect(baseline).toMatchObject({
      action: 'replace',
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
    act(() =>
      hook.result.current.updatePreference({
        version: 2,
        style: 'area',
        range: null,
        interval: '3d',
      }),
    );
    await settle();
    expect(await service.getSimpleChartPreference()).toMatchObject({
      style: 'area',
      interval: '3d',
      range: null,
    });
    expect(await service.getSelectedKlineInterval()).toBe('4h');
    expect(requests.at(-1)).toEqual({ coin: 'BTC', interval: '3d' });
  });

  it('commits the range reference with the displayed snapshot and rejects stale summaries without bridge fan-out', async () => {
    const hook = mount();
    await settle();
    const previousIdentity = messages
      .filter(m => m.action === 'replace')
      .at(-1)!.identity;
    let resolve!: (candles: Candle[]) => void;
    fetchCandles = () =>
      new Promise(done => {
        resolve = done;
      });
    act(() =>
      hook.result.current.updatePreference({
        version: 2,
        style: 'candle',
        range: '1W',
        interval: '4h',
      }),
    );
    await settle();
    expect(hook.result.current.preference.range).toBe('1D');
    expect(hook.result.current.rangeReference).toBeNull();
    await act(async () => resolve([raw('BTC', '4h')]));
    await settle();
    expect(hook.result.current.preference.range).toBe('1W');
    expect(hook.result.current.rangeReference).toBe(90);
    const identity = messages
      .filter(m => m.action === 'replace')
      .at(-1)!.identity;
    messages.length = 0;
    act(() =>
      hook.result.current.onSimpleEvent({
        type: 'PERPS_SIMPLE_EVENT',
        event: 'rangeReference',
        identity: previousIdentity,
        referencePrice: 1,
      }),
    );
    expect(hook.result.current.rangeReference).toBe(90);
    act(() =>
      hook.result.current.onSimpleEvent({
        type: 'PERPS_SIMPLE_EVENT',
        event: 'rangeReference',
        identity,
        referencePrice: 95,
      }),
    );
    expect(hook.result.current.rangeReference).toBe(95);
    expect(messages).toHaveLength(0);
    act(() =>
      hook.result.current.onSimpleEvent({
        type: 'PERPS_SIMPLE_EVENT',
        event: 'rangeReference',
        identity,
        referencePrice: null,
      }),
    );
    expect(hook.result.current.rangeReference).toBeNull();
    expect(messages).toHaveLength(0);
  });

  it('keeps the retained range reference while a same-identity recovery replacement awaits drawing', async () => {
    const hook = mount();
    await settle();
    let resolve!: (candles: Candle[]) => void;
    fetchCandles = () =>
      new Promise(done => {
        resolve = done;
      });
    act(() =>
      hook.result.current.updatePreference({
        version: 2,
        style: 'candle',
        range: '1W',
        interval: '4h',
      }),
    );
    await settle();
    act(() => hook.result.current.onChartReady());
    await settle();
    expect(hook.result.current.preference.range).toBe('1D');
    const retained = messages.filter(m => m.action === 'replace').at(-1)!;
    // Keep the external WebView acknowledgement pending while real HTTP resolves.
    hook.result.current.chartRef.current = {
      sendSimpleMessage: message => messages.push(message),
    } as TradingViewChartRef;
    await act(async () => resolve([raw('BTC', '4h')]));
    await settle();
    const replacement = messages.filter(m => m.action === 'replace').at(-1)!;
    expect(replacement.identity).toBe(retained.identity);
    expect(replacement.sequence).not.toBe(retained.sequence);
    act(() =>
      hook.result.current.onSimpleEvent({
        type: 'PERPS_SIMPLE_EVENT',
        event: 'rangeReference',
        identity: replacement.identity,
        referencePrice: 90,
      }),
    );
    expect(hook.result.current.preference.range).toBe('1D');
    expect(hook.result.current.rangeReference).toBeNull();
    act(() =>
      hook.result.current.onSimpleEvent({
        type: 'PERPS_SIMPLE_EVENT',
        event: 'applied',
        identity: replacement.identity,
        sequence: replacement.sequence,
        referencePrice: 90,
      }),
    );
    expect(hook.result.current.preference.range).toBe('1W');
    expect(hook.result.current.rangeReference).toBe(90);
  });

  it('switches style/theme without refetching or resetting the view', async () => {
    const hook = mount();
    await settle();
    messages.length = 0;
    act(() =>
      hook.result.current.updatePreference({
        ...hook.result.current.preference,
        style: 'area',
      }),
    );
    await settle();
    hook.rerender({
      name: 'BTC',
      owner: 'account-a',
      chartConfig: {
        ...config,
        colors: { ...config.colors, background: '#131416' },
      },
    });
    await settle();
    expect(requests).toHaveLength(1);
    expect(messages.every(message => message.action === 'configure')).toBe(
      true,
    );
    expect(messages.at(-1)).toMatchObject({
      action: 'configure',
      config: { style: 'area', colors: { background: '#131416' } },
    });
  });

  it('rejects old A→B→A callbacks and clears account overlays without restarting public candles', async () => {
    const hook = mount();
    await settle();
    const oldIdentity = messages.at(-1)!.identity;
    const staleCandle = candleCallbacks[0];
    hook.rerender({ name: 'ETH', owner: 'account-a', chartConfig: config });
    await settle();
    hook.rerender({ name: 'BTC', owner: 'account-a', chartConfig: config });
    await settle();
    expect(messages.at(-1)!.identity).not.toBe(oldIdentity);
    act(() => {
      staleCandle(raw('BTC', '30m', '119'));
      hook.result.current.onSimpleEvent({
        type: 'PERPS_SIMPLE_EVENT',
        identity: oldIdentity,
        event: 'selection',
        candle: { time: 1, open: 1, high: 2, low: 1, close: 2 },
      });
    });
    expect(hook.result.current.feed.latestCandle?.close).toBe(105);
    expect(hook.result.current.selection).toBeNull();
    const count = requests.length;
    hook.rerender({ name: 'BTC', owner: '', chartConfig: config });
    await settle();
    expect(messages.at(-1)).toMatchObject({
      action: 'overlays',
      accountKey: '',
      prices: {},
      fills: [],
    });
    expect(requests).toHaveLength(count);
  });

  it('releases the local subscription on blur and resends data after WebView reload', async () => {
    const hook = mount();
    await settle();
    mockFocused = false;
    hook.rerender({ name: 'BTC', owner: 'account-a', chartConfig: config });
    await settle();
    expect(releases[0]).toHaveBeenCalledTimes(1);
    expect(hook.result.current.active).toBe(false);
    mockFocused = true;
    hook.rerender({ name: 'BTC', owner: 'account-a', chartConfig: config });
    await settle();
    const previousIdentity = messages.at(-1)!.identity;
    messages.length = 0;
    act(() => hook.result.current.onChartReady());
    await settle();
    expect(messages.filter(m => m.action === 'replace')).toHaveLength(1);
    expect(messages.at(-1)).toMatchObject({ action: 'activity', active: true });
    expect(messages[0].identity).not.toBe(previousIdentity);
  });
  it('retains the displayed period until the latest requested snapshot commits', async () => {
    const hook = mount();
    await settle();
    const pending = new Map<string, (candles: Candle[]) => void>();
    fetchCandles = (_coin, interval) =>
      new Promise(resolve => pending.set(interval, resolve));
    messages.length = 0;
    act(() =>
      hook.result.current.updatePreference({
        version: 2,
        style: 'candle',
        range: null,
        interval: '1h',
      }),
    );
    await settle();
    expect(hook.result.current.preference.interval).toBe('30m');
    expect(hook.result.current.hasAppliedData).toBe(true);
    expect(hook.result.current.loading).toBe(true);
    expect(
      messages.filter(
        message => message.action === 'replace' || message.action === 'data',
      ),
    ).toHaveLength(0);
    act(() =>
      hook.result.current.updatePreference({
        version: 2,
        style: 'candle',
        range: null,
        interval: '4h',
      }),
    );
    await settle();
    await act(async () => pending.get('4h')!([raw('BTC', '4h', '108')]));
    await settle();
    expect(hook.result.current.preference).toMatchObject({
      interval: '4h',
      range: null,
    });
    expect(hook.result.current.loading).toBe(false);
    await act(async () => pending.get('1h')!([raw('BTC', '1h', '99')]));
    await settle();
    expect(hook.result.current.feed.latestCandle?.close).toBe(108);
    expect(
      messages.filter(message => message.action === 'replace'),
    ).toHaveLength(1);
  });

  it('renders the shared preload while accuracy refresh waits, and retains it through failure and reload', async () => {
    await loadPerpsCandleSourceSnapshot({ coin: 'BTC', interval: '30m' });
    let reject!: (error: Error) => void;
    fetchCandles = () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      });
    const hook = mount();
    await settle();
    expect(hook.result.current.hasAppliedData).toBe(true);
    expect(hook.result.current.loading).toBe(false);
    await act(async () => reject(new Error('offline')));
    await settle();
    expect(hook.result.current.feed.status).toBe('error');
    expect(hook.result.current.hasAppliedData).toBe(true);
    expect(hook.result.current.loadingBusy).toBe(false);
    messages.length = 0;
    act(() => hook.result.current.onChartLoading());
    act(() => hook.result.current.onChartReady());
    await settle();
    expect(hook.result.current.hasAppliedData).toBe(true);
    expect(
      messages.find(message => message.action === 'replace'),
    ).toMatchObject({ candles: [{ close: 105 }] });
    fetchCandles = async () => [raw('BTC', '30m', '110')];
    act(() => hook.result.current.retry());
    await settle();
    expect(hook.result.current.feed.status).toBe('ready');
    expect(hook.result.current.loading).toBe(false);
    expect(hook.result.current.feed.latestCandle?.close).toBe(110);
  });

  it('never exposes the previous coin while the next coin has no cached data', async () => {
    const hook = mount();
    await settle();
    fetchCandles = () => new Promise(() => {});
    hook.rerender({ name: 'ETH', owner: 'account-a', chartConfig: config });
    await settle();
    expect(hook.result.current.hasAppliedData).toBe(false);
    expect(hook.result.current.feed.candles).toHaveLength(0);
    expect(hook.result.current.loading).toBe(true);
  });
  it('keeps the chart through socket loss and refreshes it without resetting the viewport', async () => {
    const handlers = new Map<string, () => void>();
    const ws = apisPerps.getPerpsSDK().ws;
    jest.spyOn(ws, 'on').mockImplementation((event, callback) => {
      handlers.set(event, callback as () => void);
    });
    jest.spyOn(ws, 'off').mockImplementation(event => {
      handlers.delete(event);
    });
    const hook = mount();
    await settle();
    messages.length = 0;
    act(() => handlers.get('close')!());
    await settle();
    expect(hook.result.current.feed.status).toBe('stale');
    expect(hook.result.current.hasAppliedData).toBe(true);
    expect(
      messages.some(
        message => message.action === 'data' || message.action === 'replace',
      ),
    ).toBe(false);
    fetchCandles = async () => [raw('BTC', '30m', '112')];
    act(() => handlers.get('open')!());
    await settle();
    expect(hook.result.current.loading).toBe(false);
    expect(messages.find(message => message.action === 'data')).toMatchObject({
      preserve: true,
      candles: [{ close: 112 }],
    });
    expect(messages.some(message => message.action === 'replace')).toBe(false);
  });

  it('recovers a cold failed baseline when the SDK connection opens', async () => {
    const handlers = new Map<string, () => void>();
    jest
      .spyOn(apisPerps.getPerpsSDK().ws, 'on')
      .mockImplementation((event, callback) => {
        handlers.set(event, callback as () => void);
      });
    fetchCandles = async () => {
      throw new Error('offline');
    };
    const hook = mount();
    await settle();
    expect(hook.result.current.hasAppliedData).toBe(false);
    expect(hook.result.current.loadingBusy).toBe(false);
    fetchCandles = async () => [raw()];
    act(() => handlers.get('open')!());
    await settle();
    expect(hook.result.current.loading).toBe(false);
    expect(hook.result.current.hasAppliedData).toBe(true);
  });
  it('invalidates pending history across blur without blocking the resumed chart', async () => {
    const hook = mount();
    await settle();
    let resolveOld!: (candles: Candle[]) => void;
    fetchCandles = () =>
      requests.length === 2
        ? new Promise(resolve => {
            resolveOld = resolve;
          })
        : Promise.resolve([raw()]);
    const identity = messages.at(-1)!.identity;
    act(() =>
      hook.result.current.onSimpleEvent({
        type: 'PERPS_SIMPLE_EVENT',
        identity,
        event: 'history',
      }),
    );
    await settle();
    expect(requests).toHaveLength(2);
    mockFocused = false;
    hook.rerender({ name: 'BTC', owner: 'account-a', chartConfig: config });
    await settle();
    expect(messages.at(-1)).toMatchObject({
      action: 'activity',
      active: false,
    });
    mockFocused = true;
    hook.rerender({ name: 'BTC', owner: 'account-a', chartConfig: config });
    await settle();
    expect(requests).toHaveLength(3);
    act(() =>
      hook.result.current.onSimpleEvent({
        type: 'PERPS_SIMPLE_EVENT',
        identity,
        event: 'history',
      }),
    );
    await settle();
    expect(requests).toHaveLength(4);
    messages.length = 0;
    await act(async () => resolveOld([raw('BTC', '30m', '99')]));
    await settle();
    expect(messages.some(message => message.action === 'historyComplete')).toBe(
      false,
    );
  });
});
