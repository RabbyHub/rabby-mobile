import { useTokenMarketTokenList } from './useTokenMarketTokenList';

type SortOrder = 'desc' | 'asc';
type OrderBy = 'volume_24h' | 'fdv' | 'price_change_24h';

export const useMemeTokenList = (orderBy?: OrderBy, order?: SortOrder) => {
  const {
    tokenList,
    getTokenList,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    refreshTokenListSilently,
  } = useTokenMarketTokenList('meme', orderBy, order);

  return {
    memeTokenList: tokenList,
    getMemeTokenList: getTokenList,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    refreshMemeTokenListSilently: refreshTokenListSilently,
  };
};
