import type { WsTrade } from '@rabby-wallet/hyperliquid-sdk';
import { useEffect, useMemo, useRef, useState } from 'react';

import { apisPerps } from '@/core/apis/perps';

import type { PerpsRealtimeStatus } from './usePerpsFastL2';

export type PerpsLatestTrade = {
  coin: string;
  price: string;
  side: 'buy' | 'sell';
  size: string;
  tid: number;
  time: number;
};

type LatestTradeSnapshot = {
  error: Error | null;
  identity: string;
  status: PerpsRealtimeStatus;
  trade: PerpsLatestTrade | null;
};

const isLaterTrade = (
  candidate: PerpsLatestTrade,
  current: PerpsLatestTrade | null,
) =>
  !current ||
  candidate.time > current.time ||
  (candidate.time === current.time && candidate.tid > current.tid);

export const selectLatestPerpsTrade = (
  trades: WsTrade[],
  coin: string,
  current: PerpsLatestTrade | null = null,
) =>
  trades.reduce<PerpsLatestTrade | null>((latest, trade) => {
    const price = Number(trade.px);
    const size = Number(trade.sz);
    if (
      trade.coin !== coin ||
      !Number.isFinite(trade.time) ||
      !Number.isFinite(trade.tid) ||
      !Number.isFinite(price) ||
      price <= 0 ||
      !Number.isFinite(size) ||
      size < 0 ||
      (trade.side !== 'A' && trade.side !== 'B')
    ) {
      return latest;
    }
    const candidate: PerpsLatestTrade = {
      coin,
      price: trade.px,
      side: trade.side === 'B' ? 'buy' : 'sell',
      size: trade.sz,
      tid: trade.tid,
      time: trade.time,
    };
    return isLaterTrade(candidate, latest) ? candidate : latest;
  }, current);

export const usePerpsLatestTrade = ({
  coin,
  enabled,
}: {
  coin: string;
  enabled: boolean;
}) => {
  const identity = enabled && coin ? coin : 'disabled';
  const generationRef = useRef(0);
  const [snapshot, setSnapshot] = useState<LatestTradeSnapshot>({
    error: null,
    identity,
    status: identity === 'disabled' ? 'idle' : 'loading',
    trade: null,
  });

  useEffect(() => {
    generationRef.current += 1;
    const generation = generationRef.current;
    setSnapshot({
      error: null,
      identity,
      status: identity === 'disabled' ? 'idle' : 'loading',
      trade: null,
    });
    if (identity === 'disabled') {
      return;
    }

    const sdk = apisPerps.getPerpsSDK();
    const handleConnectionLoss = () => {
      if (generationRef.current !== generation) {
        return;
      }
      setSnapshot({
        error: null,
        identity,
        status: 'stale',
        trade: null,
      });
    };
    const handleOpen = () => {
      if (generationRef.current !== generation) {
        return;
      }
      setSnapshot({
        error: null,
        identity,
        status: 'loading',
        trade: null,
      });
    };
    const handleReconnectFailed = () => {
      if (generationRef.current !== generation) {
        return;
      }
      setSnapshot({
        error: new Error('Perps trades reconnect failed'),
        identity,
        status: 'error',
        trade: null,
      });
    };

    sdk.ws.on('close', handleConnectionLoss);
    sdk.ws.on('reconnecting', handleConnectionLoss);
    sdk.ws.on('open', handleOpen);
    sdk.ws.on('reconnectFailed', handleReconnectFailed);

    let unsubscribe = () => {};
    try {
      const subscription = sdk.ws.subscribeToTrades(coin, trades => {
        if (generationRef.current !== generation) {
          return;
        }
        setSnapshot(previous => {
          if (previous.identity !== identity) {
            return previous;
          }
          const trade = selectLatestPerpsTrade(
            trades ?? [],
            coin,
            previous.trade,
          );
          if (trade === previous.trade) {
            return previous;
          }
          return {
            error: null,
            identity,
            status: 'ready',
            trade,
          };
        });
      });
      unsubscribe = subscription.unsubscribe;
    } catch (error) {
      setSnapshot({
        error:
          error instanceof Error
            ? error
            : new Error('Failed to subscribe to Perps trades'),
        identity,
        status: 'error',
        trade: null,
      });
    }

    return () => {
      generationRef.current += 1;
      sdk.ws.off('close', handleConnectionLoss);
      sdk.ws.off('reconnecting', handleConnectionLoss);
      sdk.ws.off('open', handleOpen);
      sdk.ws.off('reconnectFailed', handleReconnectFailed);
      try {
        unsubscribe();
      } catch (error) {
        console.error('[usePerpsLatestTrade] unsubscribe failed', error);
      }
    };
  }, [coin, identity]);

  return useMemo(
    () =>
      snapshot.identity === identity
        ? snapshot
        : {
            error: null,
            identity,
            status:
              identity === 'disabled'
                ? ('idle' as const)
                : ('loading' as const),
            trade: null,
          },
    [identity, snapshot],
  );
};
