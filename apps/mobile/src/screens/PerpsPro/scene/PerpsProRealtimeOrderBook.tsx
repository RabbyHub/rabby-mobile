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
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { PerpsProFundingDetailSheet } from '../components/funding/PerpsProFundingDetailSheet';
import {
  PerpsProOrderBook,
  type PerpsProOrderBookPriceSelectionSource,
} from '../components/orderbook/PerpsProOrderBook';
import type { PerpsProMarket } from '../model/market';
import type { PerpsServerClockSample } from '../model/funding';
import type { PerpsProOrderBookPriceIntent } from '../model/orderBookPriceIntent';
import type { PerpsProTradeAmountUnit } from '../model/trade';
import {
  processPerpsOrderBook,
  type PerpsTickOption,
} from '../model/orderBook';

export const PERPS_PRO_ORDER_BOOK_RECONNECT_GRACE_MS =
  PERPS_FAST_L2_DISPLAY_CACHE_MS;

export const PerpsProRealtimeOrderBook: React.FC<{
  sceneActive?: boolean;
  amountUnit?: PerpsProTradeAmountUnit;
  enabled: boolean;
  height?: number;
  market: PerpsProMarket;
  onSelectTickOption: (option: PerpsTickOption) => void;
  onSelectPrice?: (
    price: string | null,
    intent: PerpsProOrderBookPriceIntent,
  ) => void;
  onSelectPriceIntentStart?: () => PerpsProOrderBookPriceIntent;
  precision: PerpsBookPrecision | null;
  publicationEnabled?: boolean;
  selectedTickOption: PerpsTickOption | null;
  tickOptions: PerpsTickOption[];
  viewportVisible?: boolean;
}> = React.memo(function PerpsProRealtimeOrderBook({
  sceneActive = true,
  amountUnit = 'quote',
  enabled,
  height,
  market,
  onSelectTickOption,
  onSelectPrice,
  onSelectPriceIntentStart,
  precision,
  publicationEnabled = enabled,
  selectedTickOption,
  tickOptions,
  viewportVisible = true,
}) {
  const [fundingDetailOpen, setFundingDetailOpen] = useState(false);
  const sceneActiveRef = useRef(sceneActive);
  sceneActiveRef.current = sceneActive;
  // A visible funding sheet still needs feed clock samples, but cannot reopen
  // publication while the owning scene is inactive or backgrounded.
  const displayPublicationEnabled =
    publicationEnabled && (viewportVisible || fundingDetailOpen);
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
    publicationEnabled: displayPublicationEnabled,
  });
  const latestTrade = usePerpsLatestTrade({
    coin: market.canonicalCoin,
    enabled,
    publicationEnabled: displayPublicationEnabled,
  });
  const priceSelectionStateRef = useRef({
    bookIdentity: fastL2.identity,
    bookStatus: fastL2.status,
    latestTradeIdentity: latestTrade.identity,
    latestTradeStatus: latestTrade.status,
    marketKey: market.marketKey,
  });
  priceSelectionStateRef.current = {
    bookIdentity: fastL2.identity,
    bookStatus: fastL2.status,
    latestTradeIdentity: latestTrade.identity,
    latestTradeStatus: latestTrade.status,
    marketKey: market.marketKey,
  };
  const serverTime = Math.max(
    fastL2.book?.time ?? 0,
    latestTrade.trade?.time ?? 0,
  );
  // The clock is part of this feed snapshot, not a second React update after
  // every book/trade publication. Keep its receive time stable between ticks.
  const currentServerClock = useMemo(
    () =>
      Number.isFinite(serverTime) && serverTime > 0
        ? {
            marketKey: market.marketKey,
            receivedAt: Date.now(),
            serverTime,
          }
        : null,
    [market.marketKey, serverTime],
  );
  // Retained Root previews may paint the last successful exact-market view,
  // but never publish it back to a feed or turn its disabled state into ready.
  // Keep only one committed presentation; a market/precision change drops it.
  const presentationKey = JSON.stringify([
    market.marketKey,
    market.canonicalCoin,
    precision?.nSigFigs ?? null,
    precision?.mantissa ?? null,
  ]);
  const retainedPresentation = useRef<{
    key: string;
    book: typeof fastL2.book;
    trade: typeof latestTrade.trade;
    clock: PerpsServerClockSample | null;
  } | null>(null);
  useLayoutEffect(() => {
    const previous =
      retainedPresentation.current?.key === presentationKey
        ? retainedPresentation.current
        : null;
    const bookReady =
      sceneActive &&
      enabled &&
      fastL2.status === 'ready' &&
      fastL2.book?.coin === market.canonicalCoin;
    const tradeReady =
      sceneActive &&
      enabled &&
      latestTrade.status === 'ready' &&
      latestTrade.trade?.coin === market.canonicalCoin;
    retainedPresentation.current = {
      key: presentationKey,
      book: bookReady ? fastL2.book : previous?.book ?? null,
      trade: tradeReady ? latestTrade.trade : previous?.trade ?? null,
      clock:
        bookReady || tradeReady ? currentServerClock : previous?.clock ?? null,
    };
  }, [
    currentServerClock,
    enabled,
    fastL2.book,
    fastL2.status,
    latestTrade.status,
    latestTrade.trade,
    market.canonicalCoin,
    presentationKey,
    sceneActive,
  ]);
  const preview =
    !sceneActive && retainedPresentation.current?.key === presentationKey
      ? retainedPresentation.current
      : null;
  const displayBook = preview ? preview.book : fastL2.book;
  const displayLatestTrade = preview ? preview.trade : latestTrade.trade;
  const displayClock = preview ? preview.clock : currentServerClock;
  const processedBook = useMemo(
    () => processPerpsOrderBook(displayBook),
    [displayBook],
  );
  const openFundingDetail = useCallback(() => {
    if (sceneActiveRef.current) {
      setFundingDetailOpen(true);
    }
  }, []);
  const closeFundingDetail = useCallback(() => setFundingDetailOpen(false), []);

  const startPrecisionIntent = useCallback(
    (option: PerpsTickOption) => {
      if (!sceneActiveRef.current) {
        return;
      }
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
      if (!sceneActiveRef.current) {
        return;
      }
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
          sceneActiveRef.current &&
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

  useLayoutEffect(() => {
    if (!sceneActive) {
      precisionIntentGenerationRef.current += 1;
      setFundingDetailOpen(false);
    }
  }, [sceneActive]);

  useEffect(
    () => () => {
      precisionIntentGenerationRef.current += 1;
    },
    [],
  );

  const selectCurrentBookPrice = useCallback(
    (
      price: string | null,
      intent: PerpsProOrderBookPriceIntent,
      source: PerpsProOrderBookPriceSelectionSource,
    ) => {
      const current = priceSelectionStateRef.current;
      if (
        sceneActiveRef.current &&
        source.type === 'book' &&
        source.marketKey === current.marketKey &&
        current.bookStatus === 'ready' &&
        source.feedIdentity === current.bookIdentity
      ) {
        onSelectPrice?.(price, intent);
      }
    },
    [onSelectPrice],
  );
  const selectCurrentLatestTradePrice = useCallback(
    (
      price: string | null,
      intent: PerpsProOrderBookPriceIntent,
      source: PerpsProOrderBookPriceSelectionSource,
    ) => {
      const current = priceSelectionStateRef.current;
      if (
        sceneActiveRef.current &&
        source.type === 'latestTrade' &&
        source.marketKey === current.marketKey &&
        current.latestTradeStatus === 'ready' &&
        source.feedIdentity === current.latestTradeIdentity
      ) {
        onSelectPrice?.(price, intent);
      }
    },
    [onSelectPrice],
  );

  return (
    <>
      <PerpsProOrderBook
        sceneActive={sceneActive}
        amountUnit={amountUnit}
        book={processedBook}
        bookIdentity={fastL2.identity}
        bookStatus={fastL2.status}
        hasBookSnapshot={displayBook != null}
        height={height}
        latestTrade={displayLatestTrade}
        latestTradeIdentity={latestTrade.identity}
        market={market}
        onOpenFunding={openFundingDetail}
        onPrecisionIntentStart={startPrecisionIntent}
        onSelectBookPrice={
          sceneActive && onSelectPrice && fastL2.status === 'ready'
            ? selectCurrentBookPrice
            : undefined
        }
        onSelectLatestTradePrice={
          sceneActive && onSelectPrice && latestTrade.status === 'ready'
            ? selectCurrentLatestTradePrice
            : undefined
        }
        onSelectTickOption={selectTickOptionWithSnapshot}
        onSelectPriceIntentStart={onSelectPriceIntentStart}
        selectedTickOption={selectedTickOption}
        serverClock={displayClock}
        tickOptions={tickOptions}
      />
      {sceneActive && fundingDetailOpen ? (
        <PerpsProFundingDetailSheet
          market={market}
          onClose={closeFundingDetail}
          serverClock={currentServerClock}
        />
      ) : null}
    </>
  );
});
