import { toMemeMarketItem } from './market';
import { fetchMemeTokenList } from './memeApi';
import type { MemeTokenListResult, RawMemeToken } from './memeApi';
import {
  loadMoreMemeMarket,
  MEME_MARKET_PAGE_SIZE,
  refreshMemeMarket,
  useMemeMarketStore,
} from './memeMarketStore';

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

jest.mock('./memeApi', () => ({
  fetchMemeTokenList: jest.fn(),
  fetchMemeUserTokenList: jest.fn(),
}));

const fetchList = fetchMemeTokenList as jest.Mock;

const raw = (id: string): RawMemeToken => ({
  chain_id: 'hood',
  id,
  symbol: id.toUpperCase(),
  name: id,
  decimals: 18,
  logo_url: null,
  price: 1,
  price_24h_change: null,
  fdv_usd: 1,
});

const result = (
  page: number,
  ids: string[],
  hasMore: boolean,
): MemeTokenListResult => ({
  page,
  page_size: MEME_MARKET_PAGE_SIZE,
  has_more: hasMore,
  tokens: ids.map(raw),
});

const ids = () => useMemeMarketStore.getState().items.map(m => m.id);

const initialState = useMemeMarketStore.getState();

beforeEach(() => {
  fetchList.mockReset();
  useMemeMarketStore.setState(initialState, true);
});

describe('refreshMemeMarket', () => {
  it('loads page 1 and replaces the items', async () => {
    useMemeMarketStore.setState({
      items: [toMemeMarketItem(raw('old'))],
      page: 3,
      hasMore: false,
      loading: false,
    });
    fetchList.mockResolvedValueOnce(result(1, ['a', 'b'], true));

    await refreshMemeMarket();

    expect(fetchList).toHaveBeenCalledWith({
      page: 1,
      pageSize: MEME_MARKET_PAGE_SIZE,
    });
    expect(ids()).toEqual(['a', 'b']);
    expect(useMemeMarketStore.getState()).toMatchObject({
      page: 1,
      hasMore: true,
      loading: false,
      error: false,
    });
  });

  it('shares one in-flight request', async () => {
    fetchList.mockResolvedValueOnce(result(1, ['a'], false));

    await Promise.all([refreshMemeMarket(), refreshMemeMarket()]);

    expect(fetchList).toHaveBeenCalledTimes(1);
  });

  it('flags an error when page 1 fails', async () => {
    fetchList.mockRejectedValueOnce(new Error('network'));

    await refreshMemeMarket();

    expect(useMemeMarketStore.getState()).toMatchObject({
      loading: false,
      error: true,
    });
  });
});

describe('loadMoreMemeMarket', () => {
  it('appends the next page without duplicates and advances the page', async () => {
    fetchList
      .mockResolvedValueOnce(result(1, ['a', 'b'], true))
      .mockResolvedValueOnce(result(2, ['B', 'c'], false));
    await refreshMemeMarket();

    await loadMoreMemeMarket();

    expect(fetchList).toHaveBeenLastCalledWith({
      page: 2,
      pageSize: MEME_MARKET_PAGE_SIZE,
    });
    expect(ids()).toEqual(['a', 'b', 'c']);
    expect(useMemeMarketStore.getState()).toMatchObject({
      page: 2,
      hasMore: false,
      loadingMore: false,
    });
  });

  it('does nothing when there are no more pages', async () => {
    fetchList.mockResolvedValueOnce(result(1, ['a'], false));
    await refreshMemeMarket();

    await loadMoreMemeMarket();

    expect(fetchList).toHaveBeenCalledTimes(1);
  });

  it('stays on the same page and clears loadingMore on failure', async () => {
    fetchList
      .mockResolvedValueOnce(result(1, ['a'], true))
      .mockRejectedValueOnce(new Error('network'));
    await refreshMemeMarket();

    const pending = loadMoreMemeMarket();
    expect(useMemeMarketStore.getState().loadingMore).toBe(true);
    await pending;

    expect(ids()).toEqual(['a']);
    expect(useMemeMarketStore.getState()).toMatchObject({
      page: 1,
      hasMore: true,
      loadingMore: false,
      error: false,
    });
  });
});
