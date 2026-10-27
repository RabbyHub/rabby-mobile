import { zCreate } from '@/core/utils/reexports';
import { appendByTokenKey, toMemeMarketItem } from './market';
import { fetchMemeTokenList } from './memeApi';
import type { MemeMarketItem } from './types';

export const MEME_MARKET_PAGE_SIZE = 100;

type MemeMarketState = {
  items: MemeMarketItem[];
  page: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: boolean;
};

export const useMemeMarketStore = zCreate<MemeMarketState>(() => ({
  items: [],
  page: 0,
  hasMore: false,
  loading: true,
  loadingMore: false,
  error: false,
}));

let inflight: Promise<void> | null = null;

export const refreshMemeMarket = () => {
  if (!inflight) {
    useMemeMarketStore.setState({ loading: true, error: false });
    inflight = fetchMemeTokenList({ page: 1, pageSize: MEME_MARKET_PAGE_SIZE })
      .then(res =>
        useMemeMarketStore.setState({
          items: res.tokens.map(toMemeMarketItem),
          page: res.page,
          hasMore: res.has_more,
          loading: false,
        }),
      )
      .catch(() => useMemeMarketStore.setState({ loading: false, error: true }))
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
};

export const loadMoreMemeMarket = async () => {
  const { loading, loadingMore, hasMore, error, page } =
    useMemeMarketStore.getState();
  if (loading || loadingMore || !hasMore || error) {
    return;
  }
  useMemeMarketStore.setState({ loadingMore: true });
  try {
    const res = await fetchMemeTokenList({
      page: page + 1,
      pageSize: MEME_MARKET_PAGE_SIZE,
    });
    useMemeMarketStore.setState(state => ({
      items: appendByTokenKey(state.items, res.tokens.map(toMemeMarketItem)),
      page: res.page,
      hasMore: res.has_more,
      loadingMore: false,
    }));
  } catch {
    useMemeMarketStore.setState({ loadingMore: false });
  }
};
