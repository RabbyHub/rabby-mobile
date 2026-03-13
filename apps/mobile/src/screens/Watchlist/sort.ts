import { atomByMMKV } from '@/core/storage/mmkv';
import { TokenDetailWithPriceCurve } from '@rabby-wallet/rabby-api/dist/types';

export type WatchlistSortState = 'desc' | 'asc' | 'default';

export const watchlistTokenSortAtom = atomByMMKV<WatchlistSortState>(
  '@watchlist.tokenSort',
  'default',
);

export const watchlistChangeSortAtom = atomByMMKV<WatchlistSortState>(
  '@watchlist.changeSort',
  'default',
);

export const sortWatchlistTokens = (
  tokens: TokenDetailWithPriceCurve[],
  tokenSort: WatchlistSortState,
  changeSort: WatchlistSortState,
) => {
  return [...tokens].sort((a, b) => {
    if (tokenSort !== 'default') {
      if (tokenSort === 'asc') {
        return (a.identity?.fdv ?? 0) - (b.identity?.fdv ?? 0);
      }
      return (b.identity?.fdv ?? 0) - (a.identity?.fdv ?? 0);
    }

    if (changeSort !== 'default') {
      if (changeSort === 'asc') {
        return (a.price_24h_change ?? 0) - (b.price_24h_change ?? 0);
      }
      return (b.price_24h_change ?? 0) - (a.price_24h_change ?? 0);
    }

    return 0;
  });
};
