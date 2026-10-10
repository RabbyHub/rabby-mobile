import { act, renderHook, cleanup } from '@testing-library/react-native';
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
const raw = (coin = 'BTC', interval = '15m', close = '105'): Candle => ({
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
      sendSimpleMessage: message => messages.push(message),
    } as TradingViewChartRef;
    act(() => hook.result.current.onChartReady());
    return hook;
  };

  it('keeps Pro preferences untouched, sends seconds, and publishes realtime tail updates', async () => {
    await service.setSelectedKlineInterval('4h');
    const hook = mount();
    await settle();
    expect(hook.result.current.feed.status).toBe('ready');
    expect(requests).toEqual([{ coin: 'BTC', interval: '15m' }]);
    const baseline = messages.filter(m => m.action === 'data').at(-1);
    expect(baseline).toMatchObject({
      action: 'data',
      candles: [{ time: 1700000000, close: 105 }],
    });
    messages.length = 0;
    act(() => candleCallbacks.at(-1)!(raw('BTC', '15m', '110')));
    expect(messages).toEqual([
      expect.objectContaining({
        action: 'update',
        candle: expect.objectContaining({ close: 110 }),
      }),
    ]);
    act(() =>
      hook.result.current.updatePreference({
        version: 1,
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
      staleCandle(raw('BTC', '15m', '119'));
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
    expect(messages.map(m => m.action)).toEqual([
      'configure',
      'data',
      'overlays',
    ]);
    expect(messages[0].identity).not.toBe(previousIdentity);
  });
});
