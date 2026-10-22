import React from 'react';
import { act, cleanupAsync, render } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { WebViewMessageEvent, WebViewProps } from 'react-native-webview';
import type { Candle } from '@rabby-wallet/hyperliquid-sdk';
import type { StorageAdapater } from '@rabby-wallet/persist-store';
/* eslint-disable no-runtime-service-imports */
import { PerpsService } from '@/core/services/perpsService';
import { registerService } from '@/core/services/serviceRegistry';
/* eslint-enable no-runtime-service-imports */
import { apisPerps } from '@/core/apis/perps';
import { resetPerpsCandleSourceSnapshotCacheForTests } from '@/hooks/perps/candles/sourceSnapshot';
import TradingViewCandleChart from '@/components2024/TradingViewCandleChart';
import type {
  SimpleChartConfig,
  SimpleChartFill,
  SimpleChartMessage,
} from '@/components2024/TradingViewCandleChart/type';
import { usePerpsSimpleChart } from './usePerpsSimpleChart';
import { simpleLiquidationPriceText } from '../account/model';

jest.mock('react-native-localize', () => ({
  getLocales: () => [{ languageCode: 'en', countryCode: 'US', isRTL: false }],
}));
jest.mock('react-native-inappbrowser-reborn', () => ({ InAppBrowser: {} }));
jest.mock('@ledgerhq/react-native-hw-transport-ble', () => ({}));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.useFakeTimers();

let mockWebProps: WebViewProps;
let mockCommands: SimpleChartMessage[];
const mockReload = jest.fn();
jest.mock('react-native-webview', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ReactModule.forwardRef(
      (props: WebViewProps, ref: React.Ref<unknown>) => {
        mockWebProps = props;
        ReactModule.useImperativeHandle(ref, () => ({
          reload: mockReload,
          injectJavaScript: (script: string) => {
            // Execute the real LocalWebView serialization at the native boundary.
            const vm = require('node:vm');
            vm.runInNewContext(script, {
              CustomEvent: class {
                detail: unknown;
                constructor(_type: string, options: { detail: unknown }) {
                  this.detail = options.detail;
                }
              },
              window: {
                dispatchEvent: (event: {
                  detail: { data?: SimpleChartMessage };
                }) => {
                  const message = event.detail.data;
                  if (message?.type === 'PERPS_SIMPLE_CHART')
                    mockCommands.push(message);
                },
              },
            });
          },
        }));
        return ReactModule.createElement(View, {
          testID: 'native-webview-boundary',
        });
      },
    ),
  };
});

const config: Omit<SimpleChartConfig, 'range' | 'style' | 'interval'> = {
  priceDecimals: 3,
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
const fills: SimpleChartFill[] = [];
const prices = {
  liquidationPrice: 23.45,
  liquidationPriceText: simpleLiquidationPriceText('23.4500', 3),
};
const raw = (close = '105'): Candle => ({
  t: 1700000000000,
  T: 1700001799999,
  s: 'HYPE',
  i: '30m',
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

describe('Simple chart native load and ready ordering', () => {
  let unregister: () => void;
  let candleCallback: (candle: Candle) => void;
  let resolveCandles: (candles: Candle[]) => void;
  let latest: ReturnType<typeof usePerpsSimpleChart>;

  beforeEach(() => {
    mockCommands = [];
    mockReload.mockClear();
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      value: 'active',
    });
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
    unregister = registerService(
      'perpsService',
      new PerpsService({
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
      }),
    );
    jest.spyOn(global, 'fetch').mockImplementation(async (_url, init) => {
      if (init?.method === 'HEAD') return { ok: false } as Response;
      const request = JSON.parse(String(init?.body));
      if (request.type === 'allPerpMetas')
        return {
          ok: true,
          json: async () => [{ universe: [], marginTables: [] }],
        } as unknown as Response;
      expect(request).toMatchObject({
        type: 'candleSnapshot',
        req: { coin: 'HYPE', interval: '30m' },
      });
      const candles = await new Promise<Candle[]>(resolve => {
        resolveCandles = resolve;
      });
      return { ok: true, json: async () => candles } as Response;
    });
    // Only the external SDK transport is replaced; API/feed/cache stay real.
    jest
      .spyOn(apisPerps.getPerpsSDK().ws, 'subscribeToCandles')
      .mockImplementation((_coin, _interval, listener) => {
        candleCallback = listener;
        return { unsubscribe: jest.fn() } as ReturnType<
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

  function Screen() {
    latest = usePerpsSimpleChart({
      coin: 'HYPE',
      accountKey: '',
      config,
      prices,
      fills,
    });
    return (
      <TradingViewCandleChart
        ref={latest.chartRef}
        height={320}
        variant="perps-simple"
        onChartReady={latest.onChartReady}
        onChartLoading={latest.onChartLoading}
        onChartError={latest.onChartError}
        onSimpleEvent={latest.onSimpleEvent}
      />
    );
  }
  const mountScreen = () =>
    render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, bottom: 0, left: 0, right: 0 },
        }}>
        <Screen />
      </SafeAreaProvider>,
    );
  const emitMessage = (message: object) =>
    act(async () => {
      mockWebProps.onMessage?.({
        nativeEvent: { data: JSON.stringify(message) },
      } as WebViewMessageEvent);
    });
  const start = () =>
    act(async () => {
      mockWebProps.onLoadStart?.({
        nativeEvent: { url: 'file:///chart.html' },
      } as Parameters<NonNullable<WebViewProps['onLoadStart']>>[0]);
    });
  const ready = () =>
    emitMessage({
      type: 'CHART_READY',
      capabilities: { perpsSimpleKlineProtocolVersion: 5 },
    });
  const applyReplacement = async () => {
    const message = mockCommands.filter(m => m.action === 'replace').at(-1)!;
    expect(message).toBeDefined();
    await emitMessage({
      type: 'PERPS_SIMPLE_EVENT',
      event: 'applied',
      identity: message.identity,
      sequence: message.sequence,
      referencePrice: 100,
    });
  };

  it.each(['start-first', 'ready-first'] as const)(
    'waits for drawing with %s and survives a late load event while streaming',
    async order => {
      mountScreen();
      await settle();
      if (order === 'start-first') {
        await start();
        await ready();
      } else {
        await ready();
        await start();
      }
      await act(async () => resolveCandles([raw()]));
      await settle();
      expect(latest.feed.status).toBe('ready');
      expect(latest.hasAppliedData).toBe(false);
      expect(latest.loading).toBe(true);
      await applyReplacement();
      expect(
        mockCommands.filter(m => m.action === 'overlays').at(-1),
      ).toMatchObject({
        prices: { liquidationPrice: 23.45, liquidationPriceText: '23.45' },
      });
      expect(latest.loading).toBe(false);
      await start();
      await act(async () => candleCallback(raw('115')));
      await settle();
      expect(latest.hasAppliedData).toBe(true);
      expect(latest.loading).toBe(false);
      expect(mockCommands.filter(m => m.action === 'replace')).toHaveLength(1);
      expect(
        mockCommands.filter(m => m.action === 'update').at(-1),
      ).toMatchObject({
        candle: { close: 115 },
      });
      expect(mockReload).not.toHaveBeenCalled();
    },
  );
});
