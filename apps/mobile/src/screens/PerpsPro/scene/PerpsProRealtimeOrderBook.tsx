import type { PerpsBookPrecision } from '@/hooks/perps/subscriptions/perpsBookTypes';
import { usePerpsFastL2 } from '@/hooks/perps/subscriptions/usePerpsFastL2';
import {
  usePerpsLatestTrade,
  type PerpsLatestTrade,
} from '@/hooks/perps/subscriptions/usePerpsLatestTrade';
import type { L2Book } from '@rabby-wallet/hyperliquid-sdk';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { PerpsProFundingDetailSheet } from '../components/funding/PerpsProFundingDetailSheet';
import { PerpsProOrderBook } from '../components/orderbook/PerpsProOrderBook';
import type { PerpsProMarket } from '../model/market';
import type { PerpsProTradeAmountUnit } from '../model/trade';
import {
  processPerpsOrderBook,
  type PerpsTickOption,
} from '../model/orderBook';

export const PERPS_PRO_ORDER_BOOK_RECONNECT_GRACE_MS = 3000;

type ReconnectDisplayCache = {
  book: L2Book;
  identity: string;
  latestTrade: PerpsLatestTrade | null;
};

export const PerpsProRealtimeOrderBook: React.FC<{
  amountUnit?: PerpsProTradeAmountUnit;
  enabled: boolean;
  height?: number;
  market: PerpsProMarket;
  onSelectTickOption: (option: PerpsTickOption) => void;
  onSelectPrice?: (price: string) => void;
  precision: PerpsBookPrecision | null;
  selectedTickOption: PerpsTickOption | null;
  tickOptions: PerpsTickOption[];
}> = ({
  amountUnit = 'quote',
  enabled,
  height,
  market,
  onSelectTickOption,
  onSelectPrice,
  precision,
  selectedTickOption,
  tickOptions,
}) => {
  const [fundingDetailOpen, setFundingDetailOpen] = useState(false);
  const fastL2 = usePerpsFastL2({
    coin: market.canonicalCoin,
    enabled,
    precision,
  });
  const latestTrade = usePerpsLatestTrade({
    coin: market.canonicalCoin,
    enabled,
  });
  const reconnectCacheRef = useRef<ReconnectDisplayCache | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectGraceStartedRef = useRef(false);
  const [reconnectCache, setReconnectCache] =
    useState<ReconnectDisplayCache | null>(null);
  const [reconnectCacheExpired, setReconnectCacheExpired] = useState(true);

  useEffect(() => {
    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
    const clearReconnectCache = () => {
      clearReconnectTimer();
      reconnectCacheRef.current = null;
      reconnectGraceStartedRef.current = false;
      setReconnectCache(null);
      setReconnectCacheExpired(true);
    };

    if (!enabled || fastL2.identity === 'disabled') {
      clearReconnectCache();
      return;
    }

    if (fastL2.book) {
      clearReconnectTimer();
      reconnectGraceStartedRef.current = false;
      const nextCache = {
        book: fastL2.book,
        identity: fastL2.identity,
        latestTrade:
          latestTrade.trade ??
          (reconnectCacheRef.current?.identity === fastL2.identity
            ? reconnectCacheRef.current.latestTrade
            : null),
      };
      reconnectCacheRef.current = nextCache;
      setReconnectCache(nextCache);
      setReconnectCacheExpired(false);
      return;
    }

    const currentCache = reconnectCacheRef.current;
    if (currentCache?.identity !== fastL2.identity) {
      clearReconnectCache();
      return;
    }

    if (latestTrade.trade) {
      const nextCache = { ...currentCache, latestTrade: latestTrade.trade };
      reconnectCacheRef.current = nextCache;
      setReconnectCache(nextCache);
    }

    if (fastL2.status !== 'loading' && fastL2.status !== 'stale') {
      clearReconnectCache();
      return;
    }

    if (!reconnectGraceStartedRef.current) {
      reconnectGraceStartedRef.current = true;
      setReconnectCacheExpired(false);
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        setReconnectCacheExpired(true);
      }, PERPS_PRO_ORDER_BOOK_RECONNECT_GRACE_MS);
    }
  }, [enabled, fastL2.book, fastL2.identity, fastL2.status, latestTrade.trade]);

  useEffect(
    () => () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    },
    [],
  );

  const usesReconnectCache =
    !fastL2.book &&
    !reconnectCacheExpired &&
    reconnectCache?.identity === fastL2.identity &&
    (fastL2.status === 'loading' || fastL2.status === 'stale');
  const displayBook =
    fastL2.book ??
    (usesReconnectCache && reconnectCache ? reconnectCache.book : null);
  const displayLatestTrade =
    usesReconnectCache && reconnectCache
      ? latestTrade.trade ?? reconnectCache.latestTrade
      : latestTrade.trade;
  const processedBook = useMemo(
    () => processPerpsOrderBook(displayBook),
    [displayBook],
  );
  const serverTime = Math.max(
    displayBook?.time ?? 0,
    displayLatestTrade?.time ?? 0,
  );
  const [serverClock, setServerClock] = useState<{
    marketKey: string;
    receivedAt: number;
    serverTime: number;
  } | null>(null);

  useEffect(() => {
    setFundingDetailOpen(false);
  }, [market.marketKey]);

  useEffect(() => {
    if (!Number.isFinite(serverTime) || serverTime <= 0) {
      setServerClock(current =>
        current?.marketKey === market.marketKey ? null : current,
      );
      return;
    }
    setServerClock({
      marketKey: market.marketKey,
      receivedAt: Date.now(),
      serverTime,
    });
  }, [market.marketKey, serverTime]);

  const currentServerClock =
    serverClock?.marketKey === market.marketKey ? serverClock : null;

  return (
    <>
      <PerpsProOrderBook
        amountUnit={amountUnit}
        book={processedBook}
        bookStatus={fastL2.status}
        hasBookSnapshot={displayBook != null}
        height={height}
        latestTrade={displayLatestTrade}
        market={market}
        onOpenFunding={() => setFundingDetailOpen(true)}
        onSelectTickOption={onSelectTickOption}
        onSelectPrice={usesReconnectCache ? undefined : onSelectPrice}
        selectedTickOption={selectedTickOption}
        serverClock={currentServerClock}
        tickOptions={tickOptions}
      />
      {fundingDetailOpen ? (
        <PerpsProFundingDetailSheet
          market={market}
          onClose={() => setFundingDetailOpen(false)}
          serverClock={currentServerClock}
        />
      ) : null}
    </>
  );
};
