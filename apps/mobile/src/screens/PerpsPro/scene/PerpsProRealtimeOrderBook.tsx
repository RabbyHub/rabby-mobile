import {
  PERPS_BOOK_ATOMIC_SWITCH_BUDGET_MS,
  type PerpsBookPrecision,
} from '@/hooks/perps/subscriptions/perpsBookTypes';
import {
  PERPS_FAST_L2_DISPLAY_CACHE_MS,
  prewarmPerpsFastL2HttpSnapshot,
  usePerpsFastL2,
  waitForPerpsFastL2HttpSnapshot,
} from '@/hooks/perps/subscriptions/usePerpsFastL2';
import { usePerpsLatestTrade } from '@/hooks/perps/subscriptions/usePerpsLatestTrade';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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
  const precisionIntentGenerationRef = useRef(0);
  const marketIdentityRef = useRef(market.marketKey);
  if (marketIdentityRef.current !== market.marketKey) {
    marketIdentityRef.current = market.marketKey;
    precisionIntentGenerationRef.current += 1;
  }
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

  const startPrecisionIntent = useCallback(
    (option: PerpsTickOption) => {
      if (
        option.nSigFigs === selectedTickOption?.nSigFigs &&
        option.mantissa === selectedTickOption.mantissa
      ) {
        precisionIntentGenerationRef.current += 1;
        return;
      }
      void prewarmPerpsFastL2HttpSnapshot({
        coin: market.canonicalCoin,
        precision: {
          mantissa: option.mantissa,
          nSigFigs: option.nSigFigs,
        },
      });
    },
    [market.canonicalCoin, selectedTickOption],
  );
  const selectTickOptionWithSnapshot = useCallback(
    (option: PerpsTickOption) => {
      if (
        option.nSigFigs === selectedTickOption?.nSigFigs &&
        option.mantissa === selectedTickOption.mantissa
      ) {
        precisionIntentGenerationRef.current += 1;
        return;
      }
      const generation = ++precisionIntentGenerationRef.current;
      const marketKey = market.marketKey;
      const precision = {
        mantissa: option.mantissa,
        nSigFigs: option.nSigFigs,
      };
      void waitForPerpsFastL2HttpSnapshot({
        coin: market.canonicalCoin,
        precision,
        timeoutMs: PERPS_BOOK_ATOMIC_SWITCH_BUDGET_MS,
      }).then(() => {
        if (
          generation === precisionIntentGenerationRef.current &&
          marketIdentityRef.current === marketKey
        ) {
          onSelectTickOption(option);
        }
      });
    },
    [
      market.canonicalCoin,
      market.marketKey,
      onSelectTickOption,
      selectedTickOption,
    ],
  );

  useEffect(() => {
    setFundingDetailOpen(false);
  }, [market.marketKey]);

  useEffect(
    () => () => {
      precisionIntentGenerationRef.current += 1;
    },
    [],
  );

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
        onPrecisionIntentStart={startPrecisionIntent}
        onSelectTickOption={selectTickOptionWithSnapshot}
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
