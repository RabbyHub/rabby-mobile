import { openapi } from '@/core/request';
import { fetchMemeMarket } from './fetchMemeMarket';

jest.mock('@/core/request', () => ({
  openapi: { getTokenMarketTokenList: jest.fn() },
}));

const getList = openapi.getTokenMarketTokenList as jest.Mock;

const item = (id: string, chain = 'eth') => ({
  id,
  chain,
  name: id,
  symbol: id.toUpperCase(),
  display_symbol: '',
  logo_url: '',
  is_verified: true,
  is_core: true,
  credit_score: 0,
  price: 1,
  price_24h_change: 0,
  volume_24h: 0,
  fdv: 1,
  launchpad: null,
  asset: null,
});

describe('fetchMemeMarket', () => {
  beforeEach(() => getList.mockReset());

  it('requests the meme category by fdv desc and follows one cursor page', async () => {
    getList
      .mockResolvedValueOnce({
        data_list: [item('a'), item('b')],
        pagination: { limit: 100, has_next: true, next_cursor: 'c1' },
      })
      .mockResolvedValueOnce({
        data_list: [item('b'), item('c')],
        pagination: { limit: 100, has_next: true, next_cursor: 'c2' },
      });

    const list = await fetchMemeMarket();

    expect(getList).toHaveBeenCalledTimes(2);
    expect(getList).toHaveBeenNthCalledWith(1, {
      category_id: 'meme',
      order_by: 'fdv',
      order: 'desc',
      limit: 100,
      cursor: '',
    });
    expect(getList.mock.calls[1][0]).toMatchObject({ cursor: 'c1' });
    expect(list.map(m => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('stops when there is no next page', async () => {
    getList.mockResolvedValueOnce({
      data_list: [item('a')],
      pagination: { limit: 100, has_next: false, next_cursor: '' },
    });

    const list = await fetchMemeMarket();

    expect(getList).toHaveBeenCalledTimes(1);
    expect(list.map(m => m.id)).toEqual(['a']);
  });
});
