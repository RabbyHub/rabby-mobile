import type { L2Book, WsLevel } from '@rabby-wallet/hyperliquid-sdk';

export type PerpsProBboStrategy = 'cp1' | 'cp5' | 'q1' | 'q5';

export interface PerpsProBboPrices {
  asks1: string | null;
  asks5: string | null;
  bids1: string | null;
  bids5: string | null;
}

export const getPerpsProBboStrategyLabel = (strategy: PerpsProBboStrategy) =>
  ((
    {
      cp1: 'Counterparty 1',
      cp5: 'Counterparty 5',
      q1: 'Queue 1',
      q5: 'Queue 5',
    } as const
  )[strategy]);

const readPrice = (levels: WsLevel[] | undefined, index: number) => {
  const value = levels?.[index]?.px;
  const numeric = Number(value);
  return value && Number.isFinite(numeric) && numeric > 0 ? value : null;
};

export const buildPerpsProBboPrices = (
  book: L2Book | null | undefined,
): PerpsProBboPrices => ({
  bids1: readPrice(book?.levels?.[0], 0),
  bids5: readPrice(book?.levels?.[0], 4),
  asks1: readPrice(book?.levels?.[1], 0),
  asks5: readPrice(book?.levels?.[1], 4),
});

export const resolvePerpsProBboPrice = ({
  isBuy,
  prices,
  strategy,
}: {
  isBuy: boolean;
  prices: PerpsProBboPrices;
  strategy: PerpsProBboStrategy | null;
}): string | null => {
  if (!strategy) {
    return null;
  }
  const isCounterparty = strategy === 'cp1' || strategy === 'cp5';
  const isFifth = strategy === 'cp5' || strategy === 'q5';
  const opposingKey = `${isBuy ? 'asks' : 'bids'}${
    isFifth ? '5' : '1'
  }` as const;
  const queueKey = `${isBuy ? 'bids' : 'asks'}${isFifth ? '5' : '1'}` as const;
  return prices[isCounterparty ? opposingKey : queueKey];
};
