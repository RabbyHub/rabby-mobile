import type { Candle } from '@rabby-wallet/hyperliquid-sdk';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { PerpsCandleInterval } from '@/constant/perps';
import { apisPerps } from '@/core/apis/perps';

import {
  mergePerpsCandles,
  parsePerpsCandle,
  selectPerpsDisplayCandles,
  type PerpsCandle,
} from './candle';
import { getPerpsCandleSource } from './interval';
import { loadPerpsCandleSourceSnapshot } from './sourceSnapshot';

export type PerpsCandleFeedStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'empty'
  | 'stale'
  | 'error';

export type PerpsCandleFeedSnapshot = {
  candles: PerpsCandle[];
  error: Error | null;
  identity: string;
  latestCandle: PerpsCandle | null;
  status: PerpsCandleFeedStatus;
  updateType: 'reset' | 'snapshot' | 'realtime';
};

const createIdentity = (
  enabled: boolean,
  coin: string,
  interval: PerpsCandleInterval,
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

const toError = (error: unknown, fallback: string) =>
  error instanceof Error ? error : new Error(fallback);

export const usePerpsCandleFeed = ({
  coin,
  enabled,
  initialSourceCandles,
  interval,
}: {
  coin: string;
  enabled: boolean;
  initialSourceCandles?: ReadonlyArray<PerpsCandle>;
  interval: PerpsCandleInterval;
}) => {
  const initialSourceCandlesRef = useRef(initialSourceCandles);
  initialSourceCandlesRef.current = initialSourceCandles;
  const identity = createIdentity(enabled, coin, interval);
  const generationRef = useRef(0);
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
      return;
    }

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

    const { sourceCandleCount, sourceInterval } =
      getPerpsCandleSource(interval);
    let sourceCandles = limitCandleMap(
      toCandleMap(initialSourceCandlesRef.current ?? []),
      sourceCandleCount,
    );
    let bufferedCandles = new Map<number, PerpsCandle>();
    let baselineReady = sourceCandles.size > 0;
    let baselineRequest = 0;
    let waitingForReconnect = false;
    let unsubscribe = () => {};

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
      setSnapshot({
        candles,
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
      const request = ++baselineRequest;
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
          sourceCandleCount,
        );
        bufferedCandles = new Map();
        baselineReady = true;
        commitSourceCandles('snapshot');
      } catch (error) {
        if (!isCurrent() || request !== baselineRequest) {
          return;
        }
        if (preserveVisible && sourceCandles.size > 0) {
          sourceCandles = limitCandleMap(
            toCandleMap(
              mergePerpsCandles(
                Array.from(sourceCandles.values()),
                Array.from(bufferedCandles.values()),
              ),
            ),
            sourceCandleCount,
          );
          bufferedCandles = new Map();
          baselineReady = true;
          commitSourceCandles('snapshot');
        } else {
          baselineReady = false;
          setNonReady(
            'error',
            toError(error, 'Failed to load Perps candle snapshot'),
          );
        }
      }
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
        bufferedCandles = limitCandleMap(bufferedCandles, sourceCandleCount);
        return;
      }
      const previousLatestTime = Math.max(
        ...Array.from(sourceCandles.keys()),
        Number.NEGATIVE_INFINITY,
      );
      sourceCandles.set(candle.time, candle);
      sourceCandles = limitCandleMap(sourceCandles, sourceCandleCount);
      commitSourceCandles(
        candle.time >= previousLatestTime ? 'realtime' : 'snapshot',
      );
    };

    const handleConnectionLoss = () => {
      waitingForReconnect = true;
      baselineReady = false;
      baselineRequest += 1;
      sourceCandles = new Map();
      bufferedCandles = new Map();
      setNonReady('stale');
    };
    const handleOpen = () => {
      if (!waitingForReconnect) {
        return;
      }
      waitingForReconnect = false;
      void loadBaseline();
    };
    const handleReconnectFailed = () => {
      waitingForReconnect = false;
      baselineReady = false;
      baselineRequest += 1;
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
      setNonReady(
        'error',
        toError(error, 'Failed to subscribe to Perps candles'),
      );
    }

    return () => {
      generationRef.current += 1;
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
  }, [coin, identity, interval]);

  return useMemo<PerpsCandleFeedSnapshot>(
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
};
