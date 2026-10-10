import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useMemoizedFn } from 'ahooks';
import type { TradingViewChartRef } from '@/components2024/TradingViewCandleChart';
import type {
  CandleStick,
  SimpleChartConfig,
  SimpleChartEvent,
  SimpleChartMessage,
  SimpleChartFill,
} from '@/components2024/TradingViewCandleChart/type';
import {
  DEFAULT_SIMPLE_CHART_PREFERENCE,
  normalizeSimpleChartPreference,
  type SimpleChartPreference,
} from '@/constant/perpsSimpleChart';
import { apisPerps } from '@/core/apis/perps';
import { usePerpsCandleFeed } from '@/hooks/perps/candles/usePerpsCandleFeed';
import { toSimpleChartCandle } from './model';

let nextSession = 0;
type Command = SimpleChartMessage extends infer Message
  ? Message extends SimpleChartMessage
    ? Omit<Message, 'type' | 'identity' | 'sequence'>
    : never
  : never;
export function usePerpsSimpleChart({
  coin,
  config,
  accountKey,
  fills,
  prices,
}: {
  coin: string;
  config: Omit<SimpleChartConfig, 'interval' | 'range' | 'style'>;
  accountKey: string;
  fills: SimpleChartFill[];
  prices: Extract<SimpleChartMessage, { action: 'overlays' }>['prices'];
}) {
  const chartRef = useRef<TradingViewChartRef>(null);
  const isFocused = useIsFocused();
  const [foreground, setForeground] = useState(
    AppState.currentState === 'active',
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', state =>
      setForeground(state === 'active'),
    );
    return () => sub.remove();
  }, []);
  const active = isFocused && foreground;
  const [preference, setPreference] = useState<SimpleChartPreference>(
    DEFAULT_SIMPLE_CHART_PREFERENCE,
  );
  const [hydrated, setHydrated] = useState(false);
  const userEdited = useRef(false);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    let mounted = true;
    void apisPerps
      .getSimpleChartPreference()
      .then(value => {
        if (mounted && !userEdited.current)
          setPreference(normalizeSimpleChartPreference(value));
      })
      .catch(error => console.error('[SimpleChart] read preference', error))
      .finally(() => {
        if (mounted) setHydrated(true);
      });
    return () => {
      mounted = false;
    };
  }, []);
  const updatePreference = useMemoizedFn((value: SimpleChartPreference) => {
    const next = normalizeSimpleChartPreference(value);
    userEdited.current = true;
    setPreference(next);
    writes.current = writes.current
      .then(() => apisPerps.setSimpleChartPreference(next))
      .catch(error => console.error('[SimpleChart] save preference', error));
  });
  const feed = usePerpsCandleFeed({
    coin,
    interval: preference.interval,
    enabled: active && hydrated,
  });
  const [readyEpoch, setReadyEpoch] = useState(0);
  const identity = useMemo(
    () =>
      `simple:${coin}:${preference.interval}:${
        preference.range
      }:${readyEpoch}:${active}:${++nextSession}`,
    [coin, preference.interval, preference.range, readyEpoch, active],
  );
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const sequence = useRef(0);
  const [selectionState, setSelection] = useState<{
    identity: string;
    candle: CandleStick | null;
  } | null>(null);
  const selection =
    selectionState?.identity === identity ? selectionState.candle : null;
  const [viewport, setViewport] = useState({
    identity: '',
    resetVisible: false,
    latestVisible: false,
    paneWidth: 0,
    paneHeight: 0,
  });
  const send = useMemoizedFn((command: Command) => {
    chartRef.current?.sendSimpleMessage({
      type: 'PERPS_SIMPLE_CHART',
      identity,
      sequence: ++sequence.current,
      ...command,
    } as SimpleChartMessage);
  });
  const chartConfig = useMemo<SimpleChartConfig>(
    () => ({ ...config, ...preference }),
    [config, preference],
  );
  useEffect(() => {
    if (readyEpoch) send({ action: 'configure', config: chartConfig });
  }, [identity, chartConfig, readyEpoch, send]);
  const sentData = useRef<{
    identity: string;
    first: number | undefined;
    count: number;
  } | null>(null);
  useEffect(() => {
    if (!readyEpoch) return;
    const previous = sentData.current;
    const incremental =
      previous?.identity === identity &&
      feed.updateType === 'realtime' &&
      previous.first === feed.candles[0]?.time &&
      previous.count > 0 &&
      feed.candles.length >= previous.count &&
      feed.candles.length <= previous.count + 1;
    if (incremental && feed.latestCandle)
      send({
        action: 'update',
        candle: toSimpleChartCandle(feed.latestCandle),
      });
    else
      send({
        action: 'data',
        state: feed.status,
        candles: feed.candles.map(toSimpleChartCandle),
        preserve: previous?.identity === identity,
      });
    sentData.current = {
      identity,
      first: feed.candles[0]?.time,
      count: feed.candles.length,
    };
  }, [
    identity,
    feed.candles,
    feed.latestCandle,
    feed.updateType,
    feed.status,
    readyEpoch,
    send,
  ]);
  useEffect(() => {
    if (readyEpoch) send({ action: 'overlays', accountKey, fills, prices });
  }, [identity, accountKey, fills, prices, readyEpoch, send]);
  useEffect(() => {
    if (!active) send({ action: 'clearSelection' });
  }, [active, send]);

  const historyBusy = useRef<string | null>(null);
  const loadOlder = useMemoizedFn(async () => {
    const owner = identity;
    if (!active || feed.status !== 'ready' || historyBusy.current === owner)
      return 'ignored' as const;
    historyBusy.current = owner;
    const result = await feed.loadOlder();
    if (historyBusy.current === owner) historyBusy.current = null;
    if (currentIdentity.current === owner)
      send({
        action: 'historyComplete',
        outcome:
          result === 'loaded'
            ? 'loaded'
            : result === 'exhausted'
            ? 'exhausted'
            : 'retry',
      });
    return result;
  });
  useEffect(() => {
    if (preference.range !== 'ALL' || feed.status !== 'ready' || !active)
      return;
    let cancelled = false;
    const owner = identity;
    void (async () => {
      // The feed caps source history at 5000 daily candles; never run an unbounded backfill.
      for (
        let page = 0;
        page < 6 && !cancelled && currentIdentity.current === owner;
        page++
      ) {
        if ((await loadOlder()) !== 'loaded') break;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [identity, preference.range, feed.status, active, loadOlder]);
  const onSimpleEvent = useMemoizedFn((event: SimpleChartEvent) => {
    if (event.identity !== currentIdentity.current || !active) return;
    if (event.event === 'selection')
      setSelection({ identity, candle: event.candle });
    else if (event.event === 'viewport')
      setViewport({
        identity,
        resetVisible: event.resetVisible,
        latestVisible: event.latestVisible,
        paneWidth: event.paneWidth,
        paneHeight: event.paneHeight,
      });
    else if (preference.range !== 'ALL') void loadOlder();
  });
  const onChartReady = useCallback(() => setReadyEpoch(epoch => epoch + 1), []);
  return {
    chartRef,
    active: active && hydrated,
    feed,
    preference,
    updatePreference,
    selection,
    onSimpleEvent,
    onChartReady,
    resetVisible: viewport.identity === identity && viewport.resetVisible,
    latestVisible: viewport.identity === identity && viewport.latestVisible,
    paneWidth: viewport.paneWidth,
    paneHeight: viewport.paneHeight,
    reset: () => send({ action: 'reset' }),
    latest: () => send({ action: 'latest' }),
  };
}
