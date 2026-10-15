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
import { preloadSimpleChart } from '@/hooks/perps/candles/preloadSimpleChart';
import type { PerpsCandleDataInterval } from '@/constant/perps';
import type { PerpsCandle } from '@/hooks/perps/candles/candle';
import { touchedFeedback } from '@/utils/touch';
import type { SimplePriceAxisCommand } from './simplePriceAxisDrag';

let nextSession = 0;
let nextAxisGeneration = 0;
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
    simplePresentation: true,
  });
  const [readyEpoch, setReadyEpoch] = useState(0);
  const [webReady, setWebReady] = useState(false);
  const [webFailed, setWebFailed] = useState(false);
  const identity = useMemo(
    () =>
      `simple:${coin}:${preference.interval}:${
        preference.range
      }:${readyEpoch}:${++nextSession}`,
    [coin, preference.interval, preference.range, readyEpoch],
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
  // A hold can emit many selected candles before React commits a render.
  const hapticSelectionIdentity = useRef<string | null>(null);
  const [viewport, setViewport] = useState({
    identity: '',
    presentationSequence: -1,
    priceAxisSession: -1,
    style: '' as string,
    resetVisible: false,
    latestVisible: false,
    paneWidth: 0,
    paneHeight: 0,
  });
  const send = useMemoizedFn((command: Command) => {
    const sequenceNumber = ++sequence.current;
    chartRef.current?.sendSimpleMessage({
      type: 'PERPS_SIMPLE_CHART',
      identity,
      sequence: sequenceNumber,
      ...command,
    } as SimpleChartMessage);
    return sequenceNumber;
  });
  type Presentation = {
    coin: string;
    identity: string;
    epoch: number;
    sequence: number;
    preference: SimpleChartPreference;
  };
  const [applied, setApplied] = useState<Presentation | null>(null);
  const pendingApplied = useRef<Presentation | null>(null);
  const [rangeReference, setRangeReference] = useState<{
    identity: string;
    referencePrice: number | null;
  } | null>(null);
  // One bounded presentation snapshot, not a second market-data store.
  const lastGood = useRef<{
    coin: string;
    preference: SimpleChartPreference;
    candles: PerpsCandle[];
  } | null>(null);
  const sentData = useRef<{
    identity: string;
    first: number | undefined;
    count: number;
  } | null>(null);
  const hasAppliedData =
    webReady && applied?.coin === coin && applied.epoch === readyEpoch;
  const displayedPreference = hasAppliedData
    ? {
        ...applied.preference,
        style: preference.style,
      }
    : preference;
  const targetReady =
    feed.identity === `${coin}:${preference.interval}` &&
    (feed.status === 'ready' || feed.status === 'empty');

  const axisGeneration = useMemo(
    () =>
      `${identity}:${active}:${webReady}:${targetReady}:${preference.style}:${
        applied?.sequence
      }:${viewport.priceAxisSession}:${++nextAxisGeneration}`,
    [
      active,
      webReady,
      targetReady,
      identity,
      preference.style,
      applied?.sequence,
      viewport.priceAxisSession,
    ],
  );
  const priceAxisOwner =
    config.nativePriceAxis &&
    active &&
    webReady &&
    targetReady &&
    feed.candles.length > 0 &&
    applied?.identity === identity &&
    pendingApplied.current?.sequence === applied.sequence &&
    viewport.identity === identity &&
    viewport.presentationSequence === applied.sequence &&
    viewport.style === preference.style &&
    viewport.priceAxisSession >= 0 &&
    Number.isFinite(viewport.paneWidth) &&
    viewport.paneWidth > 0 &&
    Number.isFinite(viewport.paneHeight) &&
    viewport.paneHeight > 0
      ? axisGeneration
      : null;
  const axisOwner = useRef(priceAxisOwner);
  axisOwner.current = priceAxisOwner;
  const axisMounted = useRef(true);
  useEffect(() => {
    axisMounted.current = true;
    return () => {
      axisMounted.current = false;
    };
  }, []);
  const onPriceAxisCommand = useMemoizedFn(
    (owner: string, command: SimplePriceAxisCommand) => {
      // Queued UI-thread callbacks must never acquire the next coin/style/session.
      if (
        !axisMounted.current ||
        owner !== axisOwner.current ||
        !priceAxisOwner
      )
        return;
      send({ ...command, session: viewport.priceAxisSession });
    },
  );

  useEffect(() => {
    hapticSelectionIdentity.current = null;
  }, [identity, active, webReady, targetReady]);

  useEffect(() => {
    // Web clears its selection while inactive, when its callbacks are ignored.
    // RN must release its own selection too, before the same identity resumes.
    setSelection(null);
  }, [identity, active, webReady]);

  useEffect(() => {
    if (!webReady || !active || !hydrated) return;
    const previous = sentData.current;
    if (!targetReady) {
      // Rehydrate a replaced WebView from this coin's last good frame, including
      // when HTTP is offline. Keep its original interval/range label until commit.
      const retained = lastGood.current;
      if (
        retained?.coin === coin &&
        pendingApplied.current?.epoch !== readyEpoch
      ) {
        const sequenceNumber = send({
          action: 'replace',
          config: {
            ...config,
            ...retained.preference,
            style: preference.style,
          },
          candles: retained.candles.map(toSimpleChartCandle),
        });
        pendingApplied.current = {
          coin,
          identity,
          epoch: readyEpoch,
          sequence: sequenceNumber,
          preference: retained.preference,
        };
        sentData.current = null;
      }
      return;
    }
    const candles = feed.candles;
    lastGood.current = { coin, preference, candles };
    if (
      previous?.identity !== identity ||
      pendingApplied.current?.identity !== applied?.identity
    ) {
      const sequenceNumber = send({
        action: 'replace',
        config: { ...config, ...preference },
        candles: candles.map(toSimpleChartCandle),
      });
      pendingApplied.current = {
        coin,
        identity,
        epoch: readyEpoch,
        sequence: sequenceNumber,
        preference,
      };
      send({ action: 'overlays', accountKey, fills, prices });
    } else if (
      feed.updateType === 'realtime' &&
      previous.first === candles[0]?.time &&
      previous.count > 0 &&
      candles.length >= previous.count &&
      candles.length <= previous.count + 1 &&
      feed.latestCandle
    ) {
      send({
        action: 'update',
        candle: toSimpleChartCandle(feed.latestCandle),
      });
    } else {
      send({
        action: 'data',
        state: feed.status,
        candles: candles.map(toSimpleChartCandle),
        preserve: true,
      });
    }
    sentData.current = {
      identity,
      first: candles[0]?.time,
      count: candles.length,
    };
    // Config/overlays have their own effect below; market ticks must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    identity,
    feed.candles,
    feed.latestCandle,
    feed.updateType,
    feed.status,
    targetReady,
    webReady,
    active,
    hydrated,
    readyEpoch,
    send,
  ]);

  useEffect(() => {
    if (!webReady || !hasAppliedData || !active) return;
    // Configure only the displayed identity. A pending period must never relabel
    // the retained curve. A successful replace carries the newest theme/labels.
    chartRef.current?.sendSimpleMessage({
      type: 'PERPS_SIMPLE_CHART',
      identity: applied.identity,
      sequence: ++sequence.current,
      action: 'configure',
      config: { ...config, ...applied.preference, style: preference.style },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, preference.style, applied, hasAppliedData, webReady, active]);
  useEffect(() => {
    if (!webReady || !hasAppliedData) return;
    chartRef.current?.sendSimpleMessage({
      type: 'PERPS_SIMPLE_CHART',
      identity: applied.identity,
      sequence: ++sequence.current,
      action: 'overlays',
      accountKey,
      fills,
      prices,
    });
  }, [accountKey, fills, prices, applied, webReady, hasAppliedData]);
  useEffect(() => {
    if (!webReady || !applied) return;
    chartRef.current?.sendSimpleMessage({
      type: 'PERPS_SIMPLE_CHART',
      identity: applied.identity,
      sequence: ++sequence.current,
      action: 'activity',
      active: active && targetReady && applied.identity === identity,
    });
  }, [active, identity, applied, webReady, targetReady]);

  const historyBusy = useRef<{ identity: string; ticket: number } | null>(null);
  const historyTicket = useRef(0);
  useEffect(() => {
    if (!active || !targetReady) {
      historyTicket.current++;
      historyBusy.current = null;
    }
  }, [active, targetReady, identity]);
  const loadOlder = useMemoizedFn(async () => {
    const owner = identity;
    if (
      !active ||
      feed.status !== 'ready' ||
      historyBusy.current?.identity === owner
    )
      return 'ignored' as const;
    const ticket = ++historyTicket.current;
    historyBusy.current = { identity: owner, ticket };
    const result = await feed.loadOlder();
    if (historyTicket.current !== ticket) return 'ignored' as const;
    if (historyBusy.current?.ticket === ticket) historyBusy.current = null;
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
  const onSimpleEvent = useMemoizedFn((event: SimpleChartEvent) => {
    if (!active) return;
    if (event.event === 'applied') {
      const pending = pendingApplied.current;
      if (
        pending?.coin === coin &&
        pending.epoch === readyEpoch &&
        pending.identity === event.identity &&
        pending.sequence === event.sequence
      ) {
        // Replace clears Web selection even when it retains the same identity.
        if (applied?.sequence !== pending.sequence) {
          hapticSelectionIdentity.current = null;
          setSelection(null);
        }
        setApplied(pending);
        setRangeReference({
          identity: event.identity,
          referencePrice: event.referencePrice,
        });
      }
      return;
    }
    if (event.identity !== currentIdentity.current || !targetReady) return;
    if (event.event === 'selection') {
      if (
        event.candle &&
        (!webReady ||
          !hasAppliedData ||
          applied.identity !== event.identity ||
          pendingApplied.current?.sequence !== applied.sequence)
      )
        return;
      if (event.candle && hapticSelectionIdentity.current !== identity) {
        hapticSelectionIdentity.current = identity;
        touchedFeedback();
      } else if (!event.candle) hapticSelectionIdentity.current = null;
      setSelection({ identity, candle: event.candle });
    } else if (event.event === 'viewport')
      setViewport(previous =>
        previous.identity === identity &&
        (event.presentationSequence < previous.presentationSequence ||
          event.priceAxisSession < previous.priceAxisSession)
          ? previous
          : {
              identity,
              presentationSequence: event.presentationSequence,
              priceAxisSession: event.priceAxisSession,
              style: event.style,
              resetVisible: event.resetVisible,
              latestVisible: event.latestVisible,
              paneWidth: event.paneWidth,
              paneHeight: event.paneHeight,
            },
      );
    else if (event.event === 'rangeReference') {
      if (
        applied?.identity !== event.identity ||
        pendingApplied.current?.sequence !== applied.sequence
      )
        return;
      setRangeReference(previous =>
        previous?.identity === event.identity &&
        previous.referencePrice === event.referencePrice
          ? previous
          : { identity: event.identity, referencePrice: event.referencePrice },
      );
    } else if (event.event === 'history') void loadOlder();
  });
  const onChartReady = useCallback(() => {
    setWebFailed(false);
    setWebReady(true);
    setReadyEpoch(epoch => epoch + 1);
  }, []);
  const onChartLoading = useCallback(() => {
    setWebReady(false);
    setWebFailed(false);
  }, []);
  const onChartError = useCallback(() => {
    setWebReady(false);
    setWebFailed(true);
  }, []);
  const prefetch = useMemoizedFn((interval: PerpsCandleDataInterval) => {
    if (active && hydrated) preloadSimpleChart(coin, interval);
  });
  return {
    chartRef,
    active,
    feed,
    preference: displayedPreference,
    requestedPreference: preference,
    updatePreference,
    prefetch,
    hasAppliedData,
    rangeReference:
      hasAppliedData && rangeReference?.identity === applied.identity
        ? rangeReference.referencePrice
        : null,
    referenceLoading:
      !hasAppliedData &&
      !webFailed &&
      feed.status !== 'error' &&
      feed.status !== 'empty',
    loading: !hasAppliedData || !targetReady || applied?.identity !== identity,
    retry: () => {
      if (!active) return;
      if (webFailed) chartRef.current?.reloadSimple();
      if (feed.status === 'error' || feed.status === 'stale') feed.retry();
    },
    loadingBusy: !webFailed && feed.status !== 'error',
    onChartLoading,
    onChartError,
    selection: active && targetReady ? selection : null,
    onSimpleEvent,
    onChartReady,
    resetVisible:
      active &&
      targetReady &&
      viewport.identity === identity &&
      viewport.resetVisible,
    latestVisible:
      active &&
      targetReady &&
      viewport.identity === identity &&
      viewport.latestVisible,
    paneWidth: viewport.paneWidth,
    paneHeight: viewport.paneHeight,
    priceAxisOwner,
    onPriceAxisCommand,
    reset: () => send({ action: 'reset' }),
    latest: () => send({ action: 'latest' }),
  };
}
