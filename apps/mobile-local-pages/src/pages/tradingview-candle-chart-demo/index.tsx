import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createRoot } from 'react-dom/client';
import type { UTCTimestamp } from 'lightweight-charts';

import '../../styles/index.css';

const FRAME_TO_PARENT_SOURCE = 'RABBY_TV_DEMO_CHILD';
const PARENT_TO_FRAME_SOURCE = 'RABBY_TV_DEMO_PARENT';
const FIXED_NOW = 1715990400;

type DemoPresetKey = 'intraday' | 'micro' | 'daily';
type ThemeMode = 'light' | 'dark';
type PlatformMode = 'ios' | 'android';
type LanguageMode = 'en-US' | 'zh-CN';
type DataMode = 'preset' | 'empty' | 'remote';
type CandleTime = UTCTimestamp;
type RemoteLoadStatus = 'idle' | 'loading' | 'success' | 'error';
type DemoChartData = {
  coin: string;
  interval: string;
  showVolume?: boolean;
  candles: TradingViewCandlestickData[];
};

type DemoPreset = {
  key: DemoPresetKey;
  label: string;
  description: string;
  stepSeconds: number;
  defaultShowVolume: boolean;
  defaultNoTime: boolean;
  candles: TradingViewCandlestickData[];
};

type LogEntry = {
  id: number;
  direction: 'frame->demo' | 'demo->frame';
  payload: unknown;
};

type RemoteKlineResponse = {
  data_list?: Array<[number, number, number, number, number, number?]>;
};

function roundNumber(value: number, precision = 8) {
  return Number(value.toFixed(precision));
}

function buildCandleSeries({
  count,
  startTime,
  stepSeconds,
  basePrice,
  amplitude,
  driftPerStep,
  precision,
  floor,
  volumeBase,
}: {
  count: number;
  startTime: number;
  stepSeconds: number;
  basePrice: number;
  amplitude: number;
  driftPerStep: number;
  precision: number;
  floor: number;
  volumeBase?: number;
}): TradingViewCandlestickData[] {
  const candles: TradingViewCandlestickData[] = [];
  let previousClose = basePrice;

  for (let index = 0; index < count; index += 1) {
    const drift = driftPerStep * index;
    const wave = Math.sin(index / 2.4) * amplitude;
    const stagger = ((index % 5) - 2) * amplitude * 0.15;
    const open = previousClose;
    const close = Math.max(floor, basePrice + drift + wave + stagger);
    const high =
      Math.max(open, close) + amplitude * (0.32 + (index % 3) * 0.08);
    const low = Math.max(
      floor,
      Math.min(open, close) - amplitude * (0.26 + (index % 4) * 0.07),
    );

    const candle: TradingViewCandlestickData = {
      time: (startTime + index * stepSeconds) as CandleTime,
      open: roundNumber(open, precision),
      high: roundNumber(high, precision),
      low: roundNumber(low, precision),
      close: roundNumber(close, precision),
    };

    if (volumeBase) {
      candle.volume = Math.max(
        1,
        Math.round(
          volumeBase *
            (1 +
              ((index % 7) - 3) * 0.12 +
              Math.abs(close - open) / Math.max(amplitude, floor)),
        ),
      );
    }

    candles.push(candle);
    previousClose = candle.close;
  }

  return candles;
}

function cloneCandles(candles: TradingViewCandlestickData[]) {
  return candles.map(item => ({ ...item }));
}

function normalizeChartCandle(
  candle: TradingViewCandlestickData,
): TradingViewCandlestickData | null {
  const time = Math.floor(Number(candle.time)) as CandleTime;
  const volume =
    candle.volume === undefined ? undefined : Number(candle.volume);
  const normalized = {
    time,
    open: Number(candle.open),
    high: Number(candle.high),
    low: Number(candle.low),
    close: Number(candle.close),
    ...(volume === undefined ? {} : { volume }),
  } satisfies TradingViewCandlestickData;

  const isValid =
    !Number.isNaN(Number(normalized.time)) &&
    !Number.isNaN(normalized.open) &&
    !Number.isNaN(normalized.high) &&
    !Number.isNaN(normalized.low) &&
    !Number.isNaN(normalized.close) &&
    normalized.open > 0 &&
    normalized.high > 0 &&
    normalized.low > 0 &&
    normalized.close > 0;

  return isValid ? normalized : null;
}

function normalizeChartCandles(candles: TradingViewCandlestickData[]) {
  return candles
    .map(normalizeChartCandle)
    .filter((item): item is TradingViewCandlestickData => item !== null)
    .sort((a, b) => Number(a.time) - Number(b.time));
}

const PRESETS: Record<DemoPresetKey, DemoPreset> = {
  intraday: {
    key: 'intraday',
    label: 'Intraday',
    description: '30m candles with volume and visible price-line movement.',
    stepSeconds: 30 * 60,
    defaultShowVolume: true,
    defaultNoTime: false,
    candles: buildCandleSeries({
      count: 48,
      startTime: FIXED_NOW - 47 * 30 * 60,
      stepSeconds: 30 * 60,
      basePrice: 2.18,
      amplitude: 0.17,
      driftPerStep: 0.006,
      precision: 6,
      floor: 0.01,
      volumeBase: 128000,
    }),
  },
  micro: {
    key: 'micro',
    label: 'Micro Price',
    description: 'Tiny prices to verify subscript zero formatting on the axis.',
    stepSeconds: 60 * 60,
    defaultShowVolume: true,
    defaultNoTime: false,
    candles: buildCandleSeries({
      count: 36,
      startTime: FIXED_NOW - 35 * 60 * 60,
      stepSeconds: 60 * 60,
      basePrice: 0.0000382,
      amplitude: 0.0000043,
      driftPerStep: -0.00000018,
      precision: 10,
      floor: 0.00000011,
      volumeBase: 5400000,
    }),
  },
  daily: {
    key: 'daily',
    label: 'Daily',
    description:
      '1d candles without volume, useful for `noTime` and long ranges.',
    stepSeconds: 24 * 60 * 60,
    defaultShowVolume: false,
    defaultNoTime: true,
    candles: buildCandleSeries({
      count: 30,
      startTime: FIXED_NOW - 29 * 24 * 60 * 60,
      stepSeconds: 24 * 60 * 60,
      basePrice: 1860,
      amplitude: 62,
      driftPerStep: 4.5,
      precision: 4,
      floor: 10,
    }),
  },
};

const CHART_I18N: Record<LanguageMode, Record<string, string>> = {
  'en-US': {
    'component.kline.tp': 'TP',
    'component.kline.entry': 'Entry',
    'component.kline.sl': 'SL',
    'component.kline.liq': 'Liq',
    'component.kline.high': 'High',
    'component.kline.low': 'Low',
    'component.kline.time': 'Time',
    'component.kline.open': 'Open',
    'component.kline.close': 'Close',
    'component.kline.chg': 'Chg',
    'component.kline.chgPercent': 'Chg%',
    'component.kline.volume': 'Volume',
  },
  'zh-CN': {
    'component.kline.tp': '止盈',
    'component.kline.entry': '开仓',
    'component.kline.sl': '止损',
    'component.kline.liq': '强平',
    'component.kline.high': '最高',
    'component.kline.low': '最低',
    'component.kline.time': '时间',
    'component.kline.open': '开',
    'component.kline.close': '收',
    'component.kline.chg': '涨跌',
    'component.kline.chgPercent': '涨跌幅',
    'component.kline.volume': '成交量',
  },
};

const REMOTE_INTERVAL_OPTIONS = [
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '8h',
  '12h',
  '1d',
  '3d',
  '1w',
  '1M',
] as const;

function buildCandlesFromRemoteResponse(response: RemoteKlineResponse) {
  return (response.data_list || []).map(item => ({
    time: item[0] as CandleTime,
    open: item[1],
    high: item[2],
    low: item[3],
    close: item[4],
    volume: item[5],
  }));
}

async function fetchTokenPriceDataForDemo({
  endpoint,
  token,
  interval,
  afterTimeAt,
}: {
  endpoint: string;
  token: {
    chain: string;
    tokenId: string;
  };
  interval: string;
  afterTimeAt?: number;
}): Promise<DemoChartData> {
  const url = new URL(endpoint);
  url.searchParams.set('token_id', token.tokenId);
  url.searchParams.set('chain_id', token.chain);
  url.searchParams.set('interval', interval);

  if (afterTimeAt !== undefined) {
    url.searchParams.set('after_time_at', String(afterTimeAt));
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = (await response.json()) as RemoteKlineResponse;

  return {
    coin: `${token.chain}:${token.tokenId}`,
    interval,
    showVolume: true,
    candles: buildCandlesFromRemoteResponse(data),
  };
}

function getFramePageUrl() {
  return new URL(
    './tradingview-candle-chart-demo-frame.html',
    window.location.href,
  ).toString();
}

function buildRuntimeInfo(
  frameUrl: string,
  themeMode: ThemeMode,
  platform: PlatformMode,
  language: LanguageMode,
): RuntimeInfo {
  return {
    runtimeBaseUrl: new URL('../', frameUrl).toString(),
    platform,
    useDevResource: true,
    isDark: themeMode === 'dark',
    language,
    i18nTexts: CHART_I18N[language],
  };
}

function buildPriceLines(candles: TradingViewCandlestickData[]) {
  const lastCandle = candles[candles.length - 1];

  if (!lastCandle) {
    return {};
  }

  const close = lastCandle.close;

  return {
    entryPrice: roundNumber(close * 0.985, 10),
    tpPrice: roundNumber(close * 1.042, 10),
    slPrice: roundNumber(close * 0.956, 10),
    liquidationPrice: roundNumber(close * 0.912, 10),
  };
}

function parseIncomingPayload(raw: unknown) {
  if (typeof raw !== 'string') {
    return raw;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function prettyPrintPayload(payload: unknown) {
  return JSON.stringify(payload, null, 2);
}

function App() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const frameUrl = useMemo(() => getFramePageUrl(), []);
  const chartCandlesRef = useRef<TradingViewCandlestickData[]>([]);
  const nextLogIdRef = useRef(1);

  const [frameKey, setFrameKey] = useState(0);
  const [frameReady, setFrameReady] = useState(false);
  const [presetKey, setPresetKey] = useState<DemoPresetKey>('intraday');
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  const [platform, setPlatform] = useState<PlatformMode>('ios');
  const [language, setLanguage] = useState<LanguageMode>('en-US');
  const [showVolume, setShowVolume] = useState(true);
  const [fitContent, setFitContent] = useState(true);
  const [noTime, setNoTime] = useState(false);
  const [showPriceLines, setShowPriceLines] = useState(true);
  const [dataMode, setDataMode] = useState<DataMode>('preset');
  const [remoteEndpoint, setRemoteEndpoint] = useState(
    'http://api.rabby.io/v1/token/market/kline',
  );
  const [remoteChainId, setRemoteChainId] = useState('base');
  const [remoteTokenId, setRemoteTokenId] = useState(
    '0x014611db66e4add93019b9a0151ee699bb1ee906',
  );
  const [remoteInterval, setRemoteInterval] =
    useState<(typeof REMOTE_INTERVAL_OPTIONS)[number]>('1h');
  const [remoteAfterTimeAt, setRemoteAfterTimeAt] = useState('');
  const [remoteStatus, setRemoteStatus] = useState<RemoteLoadStatus>('idle');
  const [remoteError, setRemoteError] = useState('');
  const [remoteSourceLabel, setRemoteSourceLabel] = useState('');
  const [remoteChartData, setRemoteChartData] = useState<DemoChartData | null>(
    null,
  );
  const [chartStats, setChartStats] = useState({ count: 0, lastClose: '-' });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logExpanded, setLogExpanded] = useState(false);

  const preset = PRESETS[presetKey];
  const runtimeInfo = useMemo(
    () => buildRuntimeInfo(frameUrl, themeMode, platform, language),
    [frameUrl, themeMode, platform, language],
  );

  const appendLog = useCallback(
    (direction: LogEntry['direction'], payload: unknown) => {
      setLogs(prev =>
        [
          {
            id: nextLogIdRef.current++,
            direction,
            payload,
          },
          ...prev,
        ].slice(0, 16),
      );
    },
    [],
  );

  const postToFrame = useCallback(
    (message: DuplexReceive) => {
      const target = iframeRef.current?.contentWindow;

      if (!target) {
        return;
      }

      appendLog('demo->frame', message);
      target.postMessage(
        {
          source: PARENT_TO_FRAME_SOURCE,
          message,
        },
        '*',
      );
    },
    [appendLog],
  );

  const syncStatsFromCandles = useCallback(
    (candles: TradingViewCandlestickData[]) => {
      const lastCandle = candles[candles.length - 1];

      setChartStats({
        count: candles.length,
        lastClose: lastCandle ? String(lastCandle.close) : '-',
      });
    },
    [],
  );

  const syncScenarioToFrame = useCallback(() => {
    if (!frameReady) {
      return;
    }

    const candles =
      dataMode === 'empty'
        ? []
        : dataMode === 'remote'
        ? cloneCandles(remoteChartData?.candles || [])
        : cloneCandles(preset.candles);
    const normalizedCandles = normalizeChartCandles(candles);

    chartCandlesRef.current = normalizedCandles;
    syncStatsFromCandles(normalizedCandles);

    postToFrame({
      type: 'GOT_RUNTIME_INFO',
      info: runtimeInfo,
    });

    postToFrame({
      type: 'TRADINGVIEW_MESSAGE',
      data: {
        type: 'SET_CANDLESTICK_DATA',
        data: normalizedCandles,
        source:
          dataMode === 'remote'
            ? remoteChartData?.coin ||
              remoteSourceLabel ||
              `remote:${remoteChainId}:${remoteTokenId}`
            : `${preset.key}:${dataMode}`,
        showVolume:
          dataMode === 'remote'
            ? remoteChartData?.showVolume ?? showVolume
            : showVolume,
        fitContent,
        noTime,
      },
    });

    postToFrame({
      type: 'TRADINGVIEW_MESSAGE',
      data: {
        type: 'UPDATE_TPSL_PRICE_LINES',
        data:
          showPriceLines && normalizedCandles.length > 0
            ? buildPriceLines(normalizedCandles)
            : {},
      },
    });
  }, [
    dataMode,
    fitContent,
    frameReady,
    noTime,
    postToFrame,
    preset,
    remoteChartData,
    remoteChainId,
    remoteSourceLabel,
    remoteTokenId,
    runtimeInfo,
    showPriceLines,
    showVolume,
    syncStatsFromCandles,
  ]);

  useEffect(() => {
    syncScenarioToFrame();
  }, [syncScenarioToFrame]);

  useEffect(() => {
    const handleFrameMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      if (!event.data || event.data.source !== FRAME_TO_PARENT_SOURCE) {
        return;
      }

      const payload = parseIncomingPayload(event.data.raw);
      appendLog('frame->demo', payload);

      if (!payload || typeof payload !== 'object' || !('type' in payload)) {
        return;
      }

      switch (payload.type) {
        case 'GET_RUNTIME_INFO':
          postToFrame({
            type: 'GOT_RUNTIME_INFO',
            info: runtimeInfo,
          });
          break;
        case 'CHART_READY':
          setFrameReady(true);
          break;
        default:
          break;
      }
    };

    window.addEventListener('message', handleFrameMessage);

    return () => {
      window.removeEventListener('message', handleFrameMessage);
    };
  }, [appendLog, postToFrame, runtimeInfo]);

  const switchPreset = useCallback((nextPresetKey: DemoPresetKey) => {
    const nextPreset = PRESETS[nextPresetKey];

    setPresetKey(nextPresetKey);
    setDataMode('preset');
    setShowVolume(nextPreset.defaultShowVolume);
    setNoTime(nextPreset.defaultNoTime);
    setShowPriceLines(true);
    setFitContent(true);
  }, []);

  const handleUpdateLastCandle = useCallback(() => {
    const candles = chartCandlesRef.current;

    if (!frameReady || candles.length === 0) {
      return;
    }

    const lastCandle = candles[candles.length - 1];
    const baseDelta = Math.max(
      Math.abs(lastCandle.close) * 0.012,
      preset.key === 'micro' ? 0.0000007 : 0.01,
    );
    const nextClose = roundNumber(
      lastCandle.close + baseDelta,
      preset.key === 'micro' ? 10 : 6,
    );
    const nextCandle: TradingViewCandlestickData = {
      ...lastCandle,
      high: roundNumber(
        Math.max(lastCandle.high, nextClose + baseDelta * 0.35),
        preset.key === 'micro' ? 10 : 6,
      ),
      low: roundNumber(
        Math.min(lastCandle.low, nextClose - baseDelta * 0.22),
        preset.key === 'micro' ? 10 : 6,
      ),
      close: nextClose,
      volume:
        typeof lastCandle.volume === 'number'
          ? lastCandle.volume +
            Math.max(1, Math.round(lastCandle.volume * 0.08))
          : undefined,
    };

    chartCandlesRef.current = [...candles.slice(0, -1), nextCandle];
    syncStatsFromCandles(chartCandlesRef.current);

    postToFrame({
      type: 'TRADINGVIEW_MESSAGE',
      data: {
        type: 'UPDATE_CANDLESTICK_DATA',
        data: nextCandle,
      },
    });

    if (showPriceLines) {
      postToFrame({
        type: 'TRADINGVIEW_MESSAGE',
        data: {
          type: 'UPDATE_TPSL_PRICE_LINES',
          data: buildPriceLines(chartCandlesRef.current),
        },
      });
    }
  }, [
    frameReady,
    postToFrame,
    preset.key,
    showPriceLines,
    syncStatsFromCandles,
  ]);

  const handleAppendNextCandle = useCallback(() => {
    const candles = chartCandlesRef.current;

    if (!frameReady || candles.length === 0) {
      return;
    }

    const lastCandle = candles[candles.length - 1];
    const index = candles.length;
    const oscillation =
      Math.sin(index / 2.2) *
      (preset.key === 'micro'
        ? 0.0000018
        : Math.max(lastCandle.close * 0.018, 0.025));
    const open = lastCandle.close;
    const close = roundNumber(
      Math.max(preset.key === 'micro' ? 0.00000011 : 0.01, open + oscillation),
      preset.key === 'micro' ? 10 : 6,
    );
    const swing = Math.max(
      Math.abs(close - open),
      preset.key === 'micro' ? 0.0000009 : 0.018,
    );

    const nextCandle: TradingViewCandlestickData = {
      time: (Number(lastCandle.time) + preset.stepSeconds) as CandleTime,
      open: roundNumber(open, preset.key === 'micro' ? 10 : 6),
      high: roundNumber(
        Math.max(open, close) + swing * 0.48,
        preset.key === 'micro' ? 10 : 6,
      ),
      low: roundNumber(
        Math.max(
          preset.key === 'micro' ? 0.00000011 : 0.01,
          Math.min(open, close) - swing * 0.38,
        ),
        preset.key === 'micro' ? 10 : 6,
      ),
      close,
      volume:
        typeof lastCandle.volume === 'number'
          ? Math.max(
              1,
              Math.round(lastCandle.volume * (0.92 + (index % 3) * 0.09)),
            )
          : undefined,
    };

    chartCandlesRef.current = [...candles, nextCandle];
    syncStatsFromCandles(chartCandlesRef.current);

    postToFrame({
      type: 'TRADINGVIEW_MESSAGE',
      data: {
        type: 'UPDATE_CANDLESTICK_DATA',
        data: nextCandle,
      },
    });

    if (showPriceLines) {
      postToFrame({
        type: 'TRADINGVIEW_MESSAGE',
        data: {
          type: 'UPDATE_TPSL_PRICE_LINES',
          data: buildPriceLines(chartCandlesRef.current),
        },
      });
    }
  }, [
    frameReady,
    postToFrame,
    preset.key,
    preset.stepSeconds,
    showPriceLines,
    syncStatsFromCandles,
  ]);

  const handleLoadRemoteData = useCallback(async () => {
    const endpoint = remoteEndpoint.trim();
    const chainId = remoteChainId.trim();
    const tokenId = remoteTokenId.trim();

    if (!endpoint || !chainId || !tokenId) {
      setRemoteStatus('error');
      setRemoteError('endpoint / chain_id / token_id 不能为空');
      return;
    }

    setRemoteStatus('loading');
    setRemoteError('');

    try {
      const url = new URL(endpoint);
      url.searchParams.set('chain_id', chainId);
      url.searchParams.set('token_id', tokenId);
      url.searchParams.set('interval', remoteInterval);

      const afterTimeAt = remoteAfterTimeAt.trim();
      const chartData = await fetchTokenPriceDataForDemo({
        endpoint,
        token: {
          chain: chainId,
          tokenId,
        },
        interval: remoteInterval,
        afterTimeAt: afterTimeAt ? Number(afterTimeAt) : undefined,
      });

      setRemoteChartData(chartData);
      setRemoteSourceLabel(url.toString());
      setRemoteStatus('success');
      setDataMode('remote');
      setShowVolume(chartData.showVolume ?? true);
      setFitContent(true);
    } catch (error) {
      setRemoteStatus('error');
      setRemoteError(error instanceof Error ? error.message : String(error));
    }
  }, [
    remoteAfterTimeAt,
    remoteChainId,
    remoteEndpoint,
    remoteInterval,
    remoteTokenId,
  ]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f172a',
        color: '#e2e8f0',
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}>
      <div
        style={{
          width: 'min(1440px, 100%)',
          margin: '0 auto',
          padding: '24px',
          boxSizing: 'border-box',
        }}>
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              marginBottom: 8,
            }}>
            TradingView Candle Chart Demo
          </div>
          <div style={{ color: '#94a3b8', lineHeight: 1.5 }}>
            This page simulates the RN bridge around{' '}
            <code>/src/pages/tradingview-candle-chart/index.tsx</code> by
            loading the real page inside an iframe and replaying the same
            message protocol.
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(320px, 420px) minmax(0, 1fr)',
            gap: 20,
            alignItems: 'start',
          }}>
          <div
            style={{
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: 20,
              padding: 20,
              boxSizing: 'border-box',
              position: 'sticky',
              top: 16,
            }}>
            <SectionTitle title="Preset" />
            <ButtonRow>
              {Object.values(PRESETS).map(item => (
                <OptionButton
                  key={item.key}
                  active={item.key === presetKey}
                  label={item.label}
                  onClick={() => switchPreset(item.key)}
                />
              ))}
            </ButtonRow>
            <MutedText>{preset.description}</MutedText>

            <SectionTitle title="Runtime" />
            <ButtonRow>
              <OptionButton
                active={themeMode === 'light'}
                label="Light"
                onClick={() => setThemeMode('light')}
              />
              <OptionButton
                active={themeMode === 'dark'}
                label="Dark"
                onClick={() => setThemeMode('dark')}
              />
            </ButtonRow>
            <ButtonRow>
              <OptionButton
                active={platform === 'ios'}
                label="iOS"
                onClick={() => setPlatform('ios')}
              />
              <OptionButton
                active={platform === 'android'}
                label="Android"
                onClick={() => setPlatform('android')}
              />
            </ButtonRow>
            <ButtonRow>
              <OptionButton
                active={language === 'en-US'}
                label="English"
                onClick={() => setLanguage('en-US')}
              />
              <OptionButton
                active={language === 'zh-CN'}
                label="中文"
                onClick={() => setLanguage('zh-CN')}
              />
            </ButtonRow>

            <SectionTitle title="Flags" />
            <ToggleRow
              checked={showVolume}
              label="showVolume"
              onChange={() => setShowVolume(prev => !prev)}
            />
            <ToggleRow
              checked={fitContent}
              label="fitContent"
              onChange={() => setFitContent(prev => !prev)}
            />
            <ToggleRow
              checked={noTime}
              label="noTime"
              onChange={() => setNoTime(prev => !prev)}
            />
            <ToggleRow
              checked={showPriceLines}
              label="TP / SL / Liq / Entry"
              onChange={() => setShowPriceLines(prev => !prev)}
            />

            <SectionTitle title="Actions" />
            <ButtonRow>
              <ActionButton
                label="Use Preset Data"
                onClick={() => setDataMode('preset')}
              />
              <ActionButton
                label="Send Empty State"
                onClick={() => setDataMode('empty')}
              />
            </ButtonRow>
            <SectionTitle title="Remote API" />
            <MutedText>
              Current mobile code fetches kline through{' '}
              <code>/v1/token/market/kline</code>.
            </MutedText>
            <FieldLabel label="endpoint" />
            <Input
              value={remoteEndpoint}
              onChange={setRemoteEndpoint}
              placeholder="http://api.rabby.io/v1/token/market/kline"
            />
            <FieldLabel label="chain_id" />
            <Input
              value={remoteChainId}
              onChange={setRemoteChainId}
              placeholder="eth"
            />
            <FieldLabel label="token_id" />
            <Input
              value={remoteTokenId}
              onChange={setRemoteTokenId}
              placeholder="0x..."
            />
            <FieldLabel label="interval" />
            <select
              value={remoteInterval}
              onChange={event =>
                setRemoteInterval(
                  event.target
                    .value as (typeof REMOTE_INTERVAL_OPTIONS)[number],
                )
              }
              style={selectStyle}>
              {REMOTE_INTERVAL_OPTIONS.map(item => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <FieldLabel label="after_time_at (optional)" />
            <Input
              value={remoteAfterTimeAt}
              onChange={setRemoteAfterTimeAt}
              placeholder="unix seconds"
            />
            <ButtonRow>
              <ActionButton
                disabled={remoteStatus === 'loading'}
                label={
                  remoteStatus === 'loading'
                    ? 'Loading Remote...'
                    : 'Load Remote Kline'
                }
                onClick={handleLoadRemoteData}
              />
              <ActionButton
                disabled={!remoteChartData?.candles.length}
                label="Use Cached Remote"
                onClick={() => setDataMode('remote')}
              />
            </ButtonRow>
            {remoteStatus === 'error' ? (
              <ErrorText>{remoteError}</ErrorText>
            ) : null}
            {remoteStatus === 'success' ? (
              <MutedText>
                Loaded {remoteChartData?.candles.length || 0} candles from{' '}
                <code>{remoteSourceLabel}</code>
              </MutedText>
            ) : null}
            <ButtonRow>
              <ActionButton
                disabled={!frameReady || dataMode === 'empty'}
                label="Update Last Candle"
                onClick={handleUpdateLastCandle}
              />
              <ActionButton
                disabled={!frameReady || dataMode === 'empty'}
                label="Append Next Candle"
                onClick={handleAppendNextCandle}
              />
            </ButtonRow>
            <ButtonRow>
              <ActionButton
                label="Reload Frame"
                onClick={() => {
                  setFrameReady(false);
                  setFrameKey(prev => prev + 1);
                }}
              />
            </ButtonRow>

            <SectionTitle title="Status" />
            <StatLine label="frame" value={frameReady ? 'ready' : 'booting'} />
            <StatLine label="candles" value={String(chartStats.count)} />
            <StatLine label="lastClose" value={chartStats.lastClose} />
            <StatLine label="mode" value={dataMode} />
            <StatLine label="remoteStatus" value={remoteStatus} />
            <StatLine label="frame URL" value={frameUrl} mono />
          </div>

          <div
            style={{
              display: 'grid',
              gap: 20,
            }}>
            <div
              style={{
                background: '#111827',
                border: '1px solid #1f2937',
                borderRadius: 20,
                padding: 20,
                boxSizing: 'border-box',
              }}>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  marginBottom: 12,
                }}>
                Preview
              </div>
              <div
                style={{
                  background: '#020617',
                  borderRadius: 16,
                  padding: 12,
                  border: '1px solid #1e293b',
                }}>
                <iframe
                  key={frameKey}
                  ref={iframeRef}
                  title="TradingView Candle Chart Demo Frame"
                  src={frameUrl}
                  onLoad={() => {
                    setFrameReady(false);
                  }}
                  style={{
                    width: '100%',
                    height: 420,
                    border: 0,
                    borderRadius: 12,
                    background: themeMode === 'dark' ? '#111827' : '#ffffff',
                  }}
                />
              </div>
            </div>

            <div
              style={{
                background: '#111827',
                border: '1px solid #1f2937',
                borderRadius: 20,
                padding: 20,
                boxSizing: 'border-box',
              }}>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  marginBottom: 12,
                }}>
                <button
                  onClick={() => setLogExpanded(prev => !prev)}
                  style={{
                    display: 'flex',
                    width: '100%',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'transparent',
                    border: 0,
                    padding: 0,
                    color: '#e2e8f0',
                    cursor: 'pointer',
                    fontSize: 18,
                    fontWeight: 600,
                    marginBottom: 12,
                  }}>
                  <span>Bridge Log</span>
                  <span
                    style={{
                      fontSize: 12,
                      color: '#94a3b8',
                    }}>
                    {logExpanded ? 'Collapse' : `Expand (${logs.length})`}
                  </span>
                </button>
              </div>
              {logExpanded ? (
                <div
                  style={{
                    display: 'grid',
                    gap: 12,
                  }}>
                  {logs.length === 0 ? (
                    <div
                      style={{
                        color: '#94a3b8',
                        fontSize: 13,
                      }}>
                      Waiting for iframe messages...
                    </div>
                  ) : (
                    logs.map(entry => (
                      <div
                        key={entry.id}
                        style={{
                          background: '#020617',
                          border: '1px solid #1e293b',
                          borderRadius: 12,
                          overflow: 'hidden',
                        }}>
                        <div
                          style={{
                            padding: '10px 12px',
                            borderBottom: '1px solid #1e293b',
                            fontSize: 12,
                            color: '#93c5fd',
                            fontWeight: 600,
                          }}>
                          {entry.direction}
                        </div>
                        <pre
                          style={{
                            margin: 0,
                            padding: 12,
                            fontSize: 12,
                            lineHeight: 1.5,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            color: '#e2e8f0',
                          }}>
                          {prettyPrintPayload(entry.payload)}
                        </pre>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div
                  style={{
                    color: '#94a3b8',
                    fontSize: 13,
                  }}>
                  Log is collapsed by default.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div
      style={{
        fontSize: 14,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: '#93c5fd',
        marginBottom: 10,
        marginTop: 18,
      }}>
      {title}
    </div>
  );
}

function ButtonRow({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 8,
      }}>
      {children}
    </div>
  );
}

function OptionButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        border: '1px solid',
        borderColor: active ? '#38bdf8' : '#334155',
        background: active ? '#0f172a' : '#111827',
        color: active ? '#e0f2fe' : '#cbd5e1',
        borderRadius: 999,
        padding: '8px 12px',
        fontSize: 13,
        cursor: 'pointer',
      }}>
      {label}
    </button>
  );
}

function ActionButton({
  disabled,
  label,
  onClick,
}: {
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        border: '1px solid #334155',
        background: disabled ? '#0f172a' : '#1d4ed8',
        color: disabled ? '#64748b' : '#eff6ff',
        borderRadius: 12,
        padding: '10px 12px',
        fontSize: 13,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}>
      {label}
    </button>
  );
}

function ToggleRow({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 10,
        fontSize: 14,
        color: '#cbd5e1',
      }}>
      <span>{label}</span>
      <input checked={checked} onChange={onChange} type="checkbox" />
    </label>
  );
}

function MutedText({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        color: '#94a3b8',
        fontSize: 13,
        lineHeight: 1.5,
      }}>
      {children}
    </div>
  );
}

function ErrorText({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        color: '#fca5a5',
        fontSize: 13,
        lineHeight: 1.5,
        marginBottom: 8,
      }}>
      {children}
    </div>
  );
}

function FieldLabel({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: 12,
        color: '#94a3b8',
        marginBottom: 6,
        marginTop: 10,
      }}>
      {label}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      style={inputStyle}
    />
  );
}

function StatLine({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '100px minmax(0, 1fr)',
        gap: 12,
        marginBottom: 8,
        alignItems: 'start',
        fontSize: 13,
        color: '#cbd5e1',
      }}>
      <div style={{ color: '#94a3b8' }}>{label}</div>
      <div
        style={{
          wordBreak: 'break-word',
          fontFamily: mono
            ? 'ui-monospace, SFMono-Regular, Menlo, monospace'
            : undefined,
        }}>
        {value}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: 12,
  border: '1px solid #334155',
  background: '#020617',
  color: '#e2e8f0',
  padding: '10px 12px',
  fontSize: 13,
  marginBottom: 8,
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none',
};

createRoot(document.getElementById('root')!).render(<App />);
