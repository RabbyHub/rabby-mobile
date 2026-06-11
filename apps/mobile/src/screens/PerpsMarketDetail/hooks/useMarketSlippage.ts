import { useEffect, useMemo, useState } from 'react';
import { apisPerps } from '@/core/apis';
import {
  BookLevel,
  computeMarketSlippage,
  MarketSlippageResult,
} from '../slippageUtils';

type Book = {
  bids: BookLevel[];
  asks: BookLevel[];
};

export type UseMarketSlippageParams = {
  coin: string;
  /** true eats asks (buy), false eats bids (sell). */
  isBuy: boolean;
  /** Order size in coin units. */
  size: number;
  markPrice: number;
  enabled?: boolean;
};

export type UseMarketSlippageResult = MarketSlippageResult & {
  isReady: boolean;
};

/** Subscribes to the L2 book for `coin` and estimates market fill slippage for a `size`-unit order. */
export const useMarketSlippage = ({
  coin,
  isBuy,
  size,
  markPrice,
  enabled = true,
}: UseMarketSlippageParams): UseMarketSlippageResult => {
  const [book, setBook] = useState<Book | null>(null);

  useEffect(() => {
    setBook(null);
    if (!enabled || !coin) {
      return;
    }

    const sdk = apisPerps.getPerpsSDK();
    // Omit nSigFigs -> SDK sends null -> full-precision book.
    const { unsubscribe } = sdk.ws.subscribeToL2Book({ coin }, data => {
      // Drop empty payloads and late frames from a previous coin's subscription
      if (!data?.levels || data.coin !== coin) {
        return;
      }
      setBook({
        bids: data.levels[0] || [],
        asks: data.levels[1] || [],
      });
    });

    return () => unsubscribe();
  }, [coin, enabled]);

  return useMemo(() => {
    if (!book) {
      return {
        avgPx: 0,
        slippage: 0,
        depthInsufficient: false,
        isReady: false,
      };
    }
    const levels = isBuy ? book.asks : book.bids;
    return {
      ...computeMarketSlippage(levels, size, markPrice),
      isReady: true,
    };
  }, [book, isBuy, size, markPrice]);
};
