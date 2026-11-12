import type { Candle } from '@rabby-wallet/hyperliquid-sdk';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { PerpsCandleDataInterval } from '@/constant/perps';
import { apisPerps } from '@/core/apis/perps';

import {
  mergePerpsCandles,
  parsePerpsCandle,
  selectPerpsDisplayCandles,
  type PerpsCandle,
} from './candle';
import { getPerpsCandleSource } from './interval';
import {
  loadPerpsCandleSourcePage,
  loadPerpsCandleSourceSnapshot,
  readPerpsCandleSourceSnapshot,
} from './sourceSnapshot';

export type PerpsCandleFeedStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'empty'
  | 'stale'
  | 'error';

export type PerpsCandleFeedSnapshot = {
  candles: PerpsCandle[];
  /** Simple range coverage uses the source boundary, before weekly aggregation. */
  sourceStartTime?: number;
  error: Error | null;
  identity: string;
  latestCandle: PerpsCandle | null;
  status: PerpsCandleFeedStatus;
  updateType: 'history' | 'reset' | 'snapshot' | 'realtime';
};

export type PerpsCandleHistoryLoadResult =
  | 'exhausted'
  | 'failed'
  | 'ignored'
  | 'loaded';

export type PerpsCandleFeed = PerpsCandleFeedSnapshot & {
  loadOlder: () => Promise<PerpsCandleHistoryLoadResult>;
  retry: () => void;
};

const createIdentity = (
  enabled: boolean,
  coin: string,
  interval: PerpsCandleDataInterval,
) => (enabled && coin ? `${coin}:${interval}` : 'disabled');

const toCandleMap = (candles: ReadonlyArray<PerpsCandle>) =>
  new Map(candles.map(candle => [candle.time, candle]));

const limitCandleMap = (
  candles: Map<number, PerpsCandle>,
  maximumSize: number,
) => {
  if (candles.size <= maximumSize) {
    return candles;
  }
  return new Map(
    Array.from(candles.entries())
      .sort(([leftTime], [rightTime]) => leftTime - rightTime)
      .slice(-maximumSize),
  );
};

const getLatestCandleTime = (candles: Map<number, PerpsCandle>) => {
  let latestTime = Number.NEGATIVE_INFINITY;
  candles.forEach((_candle, time) => {
    latestTime = Math.max(latestTime, time);
  });
  return latestTime;
};

const toError = (error: unknown, fallback: string) =>
  error instanceof Error ? error : new Error(fallback);

const SIMPLE_RECOVERY_DELAYS = [1000, 3000, 10000] as const;

export const usePerpsCandleFeed = ({
  coin,
  enabled,
  initialSourceCandles,
  interval,
  simplePresentation = false,
}: {
  coin: string;
  enabled: boolean;
  initialSourceCandles?: ReadonlyArray<PerpsCandle>;
  interval: PerpsCandleDataInterval;
  /** Simple-only warm start/recovery; default callers retain their preload contract. */
  simplePresentation?: boolean;
}) => {
  const initialSourceCandlesRef = useRef(initialSourceCandles);
  initialSourceCandlesRef.current = initialSourceCandles;
  const identity = createIdentity(enabled, coin, interval);
  const generationRef = useRef(0);
  const hasStarted = useRef(false);
  const wasInactive = useRef(false);
  const [retryEpoch, setRetryEpoch] = useState(0);
  const retryRef = useRef<() => void>(() => {});
  const loadOlderRef = useRef<() => Promise<PerpsCandleHistoryLoadResult>>(() =>
    Promise.resolve('ignored'),
  );
  const [snapshot, setSnapshot] = useState<PerpsCandleFeedSnapshot>({
    candles: [],
    error: null,
    identity,
    latestCandle: null,
    status: identity === 'disabled' ? 'idle' : 'loading',
    updateType: 'reset',
  });

  useEffect(() => {
    generationRef.current += 1;
    const generation = generationRef.current;
    setSnapshot({
      candles: [],
      error: null,
      identity,
      latestCandle: null,
      status: identity === 'disabled' ? 'idle' : 'loading',
      updateType: 'reset',
    });

    if (identity === 'disabled') {
      // Initial preference hydration is not a resume: keep its in-flight preload.
      if (hasStarted.current) wasInactive.current = true;
      retryRef.current = () => {};
      return;
    }

    retryRef.current = () => setRetryEpoch(epoch => epoch + 1);

    let sdk: ReturnType<typeof apisPerps.getPerpsSDK>;
    try {
      sdk = apisPerps.getPerpsSDK();
    } catch (error) {
      setSnapshot({
        candles: [],
        error: toError(error, 'Failed to access Perps candle SDK'),
        identity,
        latestCandle: null,
        status: 'error',
        updateType: 'reset',
      });
      return;
    }

    const { historyPageCandleCount, maximumSourceCandleCount, sourceInterval } =
      getPerpsCandleSource(interval);
    let sourceCandles = limitCandleMap(
      toCandleMap(
        initialSourceCandlesRef.current ??
          (simplePresentation
            ? readPerpsCandleSourceSnapshot(coin, interval)?.candles
            : undefined) ??
          [],
      ),
      maximumSourceCandleCount,
    );
    let latestSourceTime = getLatestCandleTime(sourceCandles);
    let sourceStartTime: number | undefined;
    let bufferedCandles = new Map<number, PerpsCandle>();
    let baselineReady = sourceCandles.size > 0;
    let baselineRequest = 0;
    let baselineLoading = false;
    let historyExhausted = sourceCandles.size >= maximumSourceCandleCount;
    let historyRequest: Promise<PerpsCandleHistoryLoadResult> | null = null;
    let waitingForReconnect = false;
    let unsubscribe = () => {};
    let pendingNotBefore =
      simplePresentation && wasInactive.current ? Date.now() : undefined;
    hasStarted.current = true;
    wasInactive.current = false;
    let recoveryAttempt = 0;
    let recoveryTimer: ReturnType<typeof setTimeout> | undefined;
    const clearRecoveryTimer = () => {
      if (recoveryTimer !== undefined) clearTimeout(recoveryTimer);
      recoveryTimer = undefined;
    };

    const isCurrent = () => generationRef.current === generation;
    const commitSourceCandles = (
      updateType: PerpsCandleFeedSnapshot['updateType'],
    ) => {
      if (!isCurrent()) {
        return;
      }
      const candles = selectPerpsDisplayCandles(
        Array.from(sourceCandles.values()),
        interval,
      );
      if (
        simplePresentation &&
        (updateType !== 'realtime' ||
          sourceStartTime === undefined ||
          !sourceCandles.has(sourceStartTime))
      ) {
        sourceStartTime = sourceCandles.size
          ? Math.min(...sourceCandles.keys())
          : undefined;
      }
      setSnapshot({
        candles,
        ...(simplePresentation && sourceStartTime !== undefined
          ? { sourceStartTime }
          : {}),
        error: null,
        identity,
        latestCandle: candles[candles.length - 1] ?? null,
        status: candles.length > 0 ? 'ready' : 'empty',
        updateType,
      });
    };

    const setNonReady = (
      status: Extract<PerpsCandleFeedStatus, 'loading' | 'stale' | 'error'>,
      error: Error | null = null,
    ) => {
      if (!isCurrent()) {
        return;
      }
      setSnapshot({
        candles: [],
        error,
        identity,
        latestCandle: null,
        status,
        updateType: 'reset',
      });
    };

    const loadBaseline = async ({
      preserveVisible = false,
    }: {
      preserveVisible?: boolean;
    } = {}) => {
      clearRecoveryTimer();
      const request = ++baselineRequest;
      baselineLoading = true;
      baselineReady = false;
      if (!preserveVisible) {
        sourceCandles = new Map();
        setNonReady('loading');
      }

      try {
        const response = await loadPerpsCandleSourceSnapshot({
          coin,
          forceRefresh: true,
          interval,
          ...(simplePresentation
            ? { pendingNotBefore, maxPendingAgeMs: 15000 }
            : {}),
        });
        if (!isCurrent() || request !== baselineRequest) {
          return;
        }
        sourceCandles = limitCandleMap(
          toCandleMap(
            mergePerpsCandles(
              response.candles,
              Array.from(bufferedCandles.values()),
            ),
          ),
          maximumSourceCandleCount,
        );
        latestSourceTime = getLatestCandleTime(sourceCandles);
        bufferedCandles = new Map();
        baselineReady = true;
        historyExhausted = sourceCandles.size >= maximumSourceCandleCount;
        baselineLoading = false;
        recoveryAttempt = 0;
        commitSourceCandles('snapshot');
      } catch (error) {
        if (!isCurrent() || request !== baselineRequest) {
          return;
        }
        if (preserveVisible && sourceCandles.size > 0 && !simplePresentation) {
          sourceCandles = limitCandleMap(
            toCandleMap(
              mergePerpsCandles(
                Array.from(sourceCandles.values()),
                Array.from(bufferedCandles.values()),
              ),
            ),
            maximumSourceCandleCount,
          );
          latestSourceTime = getLatestCandleTime(sourceCandles);
          bufferedCandles = new Map();
          baselineReady = true;
          baselineLoading = false;
          commitSourceCandles('snapshot');
        } else {
          baselineReady = false;
          baselineLoading = false;
          setNonReady(
            'error',
            toError(error, 'Failed to load Perps candle snapshot'),
          );
          if (
            simplePresentation &&
            !waitingForReconnect &&
            recoveryAttempt < SIMPLE_RECOVERY_DELAYS.length
          ) {
            const delay = SIMPLE_RECOVERY_DELAYS[recoveryAttempt++];
            recoveryTimer = setTimeout(() => {
              recoveryTimer = undefined;
              if (isCurrent() && !waitingForReconnect && !baselineLoading) {
                pendingNotBefore = Date.now();
                void loadBaseline();
              }
            }, delay);
          }
        }
      }
    };

    retryRef.current = () => {
      if (isCurrent() && !baselineLoading) {
        recoveryAttempt = 0;
        if (simplePresentation) pendingNotBefore = Date.now();
        void loadBaseline();
      }
    };

    loadOlderRef.current = () => {
      if (historyRequest) {
        return historyRequest;
      }
      if (
        !isCurrent() ||
        !baselineReady ||
        baselineLoading ||
        historyExhausted ||
        sourceCandles.size === 0
      ) {
        return Promise.resolve(historyExhausted ? 'exhausted' : 'ignored');
      }
      const oldestTime = Math.min(...sourceCandles.keys());
      const remainingCapacity = maximumSourceCandleCount - sourceCandles.size;
      const candleCount = Math.min(historyPageCandleCount, remainingCapacity);
      if (!Number.isFinite(oldestTime) || candleCount <= 0) {
        historyExhausted = true;
        return Promise.resolve('exhausted');
      }
      const historyBaselineRequest = baselineRequest;

      const request = loadPerpsCandleSourcePage({
        candleCount,
        coin,
        endTime: oldestTime - 1,
        interval,
      })
        .then(response => {
          if (
            !isCurrent() ||
            !baselineReady ||
            historyBaselineRequest !== baselineRequest
          ) {
            return 'ignored' as const;
          }
          const olderCandles = response.filter(
            candle => candle.time < oldestTime,
          );
          if (olderCandles.length === 0) {
            historyExhausted = true;
            return 'exhausted' as const;
          }
          sourceCandles = limitCandleMap(
            toCandleMap(
              mergePerpsCandles(
                olderCandles,
                Array.from(sourceCandles.values()),
              ),
            ),
            maximumSourceCandleCount,
          );
          historyExhausted =
            response.length < candleCount ||
            sourceCandles.size >= maximumSourceCandleCount;
          commitSourceCandles('history');
          return 'loaded' as const;
        })
        .catch(error => {
          if (isCurrent()) {
            console.error('[usePerpsCandleFeed] history load failed', error);
          }
          return isCurrent() ? ('failed' as const) : ('ignored' as const);
        })
        .finally(() => {
          if (historyRequest === request) {
            historyRequest = null;
          }
        });
      historyRequest = request;
      return request;
    };

    const handleCandle = (data: Candle | null | undefined) => {
      if (
        !isCurrent() ||
        !data ||
        data.s !== coin ||
        data.i !== sourceInterval
      ) {
        return;
      }
      const candle = parsePerpsCandle(data);
      if (!candle) {
        return;
      }
      if (!baselineReady) {
        bufferedCandles.set(candle.time, candle);
        bufferedCandles = limitCandleMap(
          bufferedCandles,
          maximumSourceCandleCount,
        );
        return;
      }
      const previousLatestTime = latestSourceTime;
      sourceCandles.set(candle.time, candle);
      sourceCandles = limitCandleMap(sourceCandles, maximumSourceCandleCount);
      latestSourceTime = Math.max(latestSourceTime, candle.time);
      commitSourceCandles(
        candle.time >= previousLatestTime ? 'realtime' : 'snapshot',
      );
    };

    const handleConnectionLoss = () => {
      clearRecoveryTimer();
      if (simplePresentation) pendingNotBefore = Date.now();
      waitingForReconnect = true;
      baselineReady = false;
      baselineRequest += 1;
      baselineLoading = false;
      sourceCandles = new Map();
      latestSourceTime = Number.NEGATIVE_INFINITY;
      bufferedCandles = new Map();
      setNonReady('stale');
    };
    const handleOpen = () => {
      if (
        !waitingForReconnect &&
        !(simplePresentation && !baselineReady && !baselineLoading)
      ) {
        return;
      }
      waitingForReconnect = false;
      recoveryAttempt = 0;
      void loadBaseline();
    };
    const handleReconnectFailed = () => {
      clearRecoveryTimer();
      waitingForReconnect = false;
      baselineReady = false;
      baselineRequest += 1;
      if (simplePresentation) baselineLoading = false;
      setNonReady(
        'error',
        new Error('Perps candle WebSocket reconnect failed'),
      );
    };

    sdk.ws.on('close', handleConnectionLoss);
    sdk.ws.on('reconnecting', handleConnectionLoss);
    sdk.ws.on('open', handleOpen);
    sdk.ws.on('reconnectFailed', handleReconnectFailed);

    try {
      const subscription = sdk.ws.subscribeToCandles(
        coin,
        sourceInterval,
        handleCandle,
      );
      unsubscribe = subscription.unsubscribe;
      const hasPreloadedBaseline = sourceCandles.size > 0;
      if (hasPreloadedBaseline) {
        commitSourceCandles('snapshot');
      }
      void loadBaseline({ preserveVisible: hasPreloadedBaseline });
    } catch (error) {
      retryRef.current = () => setRetryEpoch(epoch => epoch + 1);
      setNonReady(
        'error',
        toError(error, 'Failed to subscribe to Perps candles'),
      );
    }

    return () => {
      clearRecoveryTimer();
      generationRef.current += 1;
      retryRef.current = () => {};
      loadOlderRef.current = () => Promise.resolve('ignored');
      baselineRequest += 1;
      sdk.ws.off('close', handleConnectionLoss);
      sdk.ws.off('reconnecting', handleConnectionLoss);
      sdk.ws.off('open', handleOpen);
      sdk.ws.off('reconnectFailed', handleReconnectFailed);
      try {
        unsubscribe();
      } catch (error) {
        console.error('[usePerpsCandleFeed] unsubscribe failed', error);
      }
    };
  }, [coin, identity, interval, retryEpoch, simplePresentation]);

  const visibleSnapshot = useMemo<PerpsCandleFeedSnapshot>(
    () =>
      snapshot.identity === identity
        ? snapshot
        : {
            candles: [],
            error: null,
            identity,
            latestCandle: null,
            status: identity === 'disabled' ? 'idle' : 'loading',
            updateType: 'reset',
          },
    [identity, snapshot],
  );
  const loadOlder = useCallback(() => loadOlderRef.current(), []);
  const retry = useCallback(() => retryRef.current(), []);

  return useMemo<PerpsCandleFeed>(
    () => ({ ...visibleSnapshot, loadOlder, retry }),
    [loadOlder, retry, visibleSnapshot],
  );
};
