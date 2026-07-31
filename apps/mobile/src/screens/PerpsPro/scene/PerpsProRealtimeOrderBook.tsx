import type { PerpsBookPrecision } from '@/core/services/perpsService';
import { usePerpsFastL2 } from '@/hooks/perps/subscriptions/usePerpsFastL2';
import { usePerpsLatestTrade } from '@/hooks/perps/subscriptions/usePerpsLatestTrade';
import React, { useEffect, useMemo, useState } from 'react';

import { PerpsProFundingDetailSheet } from '../components/funding/PerpsProFundingDetailSheet';
import { PerpsProOrderBook } from '../components/orderbook/PerpsProOrderBook';
import type { PerpsProMarket } from '../model/market';
import {
  processPerpsOrderBook,
  type PerpsTickOption,
} from '../model/orderBook';

export const PerpsProRealtimeOrderBook: React.FC<{
  enabled: boolean;
  market: PerpsProMarket;
  onSelectTickOption: (option: PerpsTickOption) => void;
  precision: PerpsBookPrecision | null;
  selectedTickOption: PerpsTickOption | null;
  tickOptions: PerpsTickOption[];
}> = ({
  enabled,
  market,
  onSelectTickOption,
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
  const processedBook = useMemo(
    () => processPerpsOrderBook(fastL2.book),
    [fastL2.book],
  );
  const serverTime = Math.max(
    fastL2.book?.time ?? 0,
    latestTrade.trade?.time ?? 0,
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
        book={processedBook}
        bookStatus={fastL2.status}
        hasBookSnapshot={fastL2.book != null}
        latestTrade={latestTrade.trade}
        market={market}
        onOpenFunding={() => setFundingDetailOpen(true)}
        onSelectTickOption={onSelectTickOption}
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
