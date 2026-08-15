import type { PerpsBookPrecision } from '@/hooks/perps/subscriptions/perpsBookTypes';
import {
  PERPS_FAST_L2_DISPLAY_CACHE_MS,
  usePerpsFastL2,
} from '@/hooks/perps/subscriptions/usePerpsFastL2';
import { usePerpsLatestTrade } from '@/hooks/perps/subscriptions/usePerpsLatestTrade';
import React, { useEffect, useMemo, useState } from 'react';

import { PerpsProFundingDetailSheet } from '../components/funding/PerpsProFundingDetailSheet';
import { PerpsProOrderBook } from '../components/orderbook/PerpsProOrderBook';
import type { PerpsProMarket } from '../model/market';
import type { PerpsProTradeAmountUnit } from '../model/trade';
import {
  processPerpsOrderBook,
  type PerpsTickOption,
} from '../model/orderBook';

export const PERPS_PRO_ORDER_BOOK_RECONNECT_GRACE_MS =
  PERPS_FAST_L2_DISPLAY_CACHE_MS;

export const PerpsProRealtimeOrderBook: React.FC<{
  amountUnit?: PerpsProTradeAmountUnit;
  enabled: boolean;
  height?: number;
  market: PerpsProMarket;
  onSelectTickOption: (option: PerpsTickOption) => void;
  onSelectPrice?: (price: string) => void;
  precision: PerpsBookPrecision | null;
  publicationEnabled?: boolean;
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
  publicationEnabled = enabled,
  selectedTickOption,
  tickOptions,
}) => {
  const [fundingDetailOpen, setFundingDetailOpen] = useState(false);
  const fastL2 = usePerpsFastL2({
    coin: market.canonicalCoin,
    enabled,
    precision,
    publicationEnabled,
  });
  const latestTrade = usePerpsLatestTrade({
    coin: market.canonicalCoin,
    enabled,
    publicationEnabled,
  });
  const usesCachedSnapshot = !!fastL2.book && fastL2.status !== 'ready';
  const displayBook = fastL2.book;
  const displayLatestTrade = latestTrade.trade;
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
        onSelectPrice={usesCachedSnapshot ? undefined : onSelectPrice}
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
