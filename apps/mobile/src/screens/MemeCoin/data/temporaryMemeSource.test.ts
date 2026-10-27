import { openapi } from '@/core/request';
import useTokenList from '@/store/tokens';
import type { RawMemeToken } from './memeApi';
import {
  loadTemporaryMemeTokens,
  pageMemeTokens,
  temporaryFetchMemeUserTokenList,
  toRawMemeToken,
  toRawPositions,
} from './temporaryMemeSource';

jest.mock('@/core/request', () => ({
  openapi: { getTokenMarketTokenList: jest.fn() },
}));

jest.mock('@/store/tokens', () => ({
  __esModule: true,
  default: { getState: jest.fn() },
}));

const getList = openapi.getTokenMarketTokenList as jest.Mock;
const getTokenState = useTokenList.getState as jest.Mock;

let now = 0;
beforeAll(() => {
  jest.spyOn(Date, 'now').mockImplementation(() => now);
});
beforeEach(() => {
  getList.mockReset();
  // every test starts after the previous test's 60 s cache expired
  now += 120_000;
});

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

const raw = (id: string, over: Partial<RawMemeToken> = {}): RawMemeToken => ({
  chain_id: 'hood',
  id,
  symbol: id.toUpperCase(),
  name: id,
  decimals: 18,
  logo_url: null,
  price: 1,
  price_24h_change: null,
  fdv_usd: 1,
  ...over,
});

describe('toRawMemeToken', () => {
  it('maps the market item to the backend token shape', () => {
    expect(
      toRawMemeToken({
        ...item('0xAbC', 'hood'),
        display_symbol: 'PEPE2',
        logo_url: 'logo',
        price: 2,
        price_24h_change: 0.26,
        fdv: 6e8,
      }),
    ).toEqual({
      chain_id: 'hood',
      id: '0xAbC',
      symbol: 'PEPE2',
      name: '0xAbC',
      decimals: 18,
      logo_url: 'logo',
      price: 2,
      price_24h_change: 0.26,
      fdv_usd: 6e8,
    });
  });

  it('turns missing logo, change and fdv into null / null / 0', () => {
    expect(
      toRawMemeToken({
        ...item('0xabc'),
        price_24h_change: null as unknown as number,
        fdv: null as unknown as number,
      }),
    ).toMatchObject({
      symbol: '0XABC',
      logo_url: null,
      price_24h_change: null,
      fdv_usd: 0,
    });
  });
});

describe('pageMemeTokens', () => {
  const all = ['doge', 'doggo', 'hotdog', 'pepe', 'dogwif'].map(id => raw(id));

  it('defaults to page 1 with 100 per page', () => {
    expect(pageMemeTokens(all, {})).toEqual({
      page: 1,
      page_size: 100,
      has_more: false,
      tokens: all,
    });
  });

  it('slices pages and reports has_more', () => {
    expect(pageMemeTokens(all, { page: 1, pageSize: 2 })).toMatchObject({
      page: 1,
      page_size: 2,
      has_more: true,
      tokens: [all[0], all[1]],
    });
    expect(pageMemeTokens(all, { page: 3, pageSize: 2 })).toMatchObject({
      has_more: false,
      tokens: [all[4]],
    });
  });

  it('returns no tokens past the end', () => {
    expect(pageMemeTokens(all, { page: 4, pageSize: 2 })).toMatchObject({
      page: 4,
      has_more: false,
      tokens: [],
    });
  });

  it('filters by symbol prefix before paging', () => {
    expect(pageMemeTokens(all, { symbol: ' dog ', pageSize: 2 })).toMatchObject(
      {
        has_more: true,
        tokens: [all[0], all[1]],
      },
    );
    expect(
      pageMemeTokens(all, { symbol: 'dog', page: 2, pageSize: 2 }),
    ).toMatchObject({ has_more: false, tokens: [all[4]] });
  });
});

describe('toRawPositions', () => {
  const pepe = raw('0xabc', { chain_id: 'eth', symbol: 'PEPE', price: 1 });
  const bonk = raw('bonk', { chain_id: 'bsc', symbol: 'BONK', price: 6 });
  const position = (token: RawMemeToken, amount: number, usd: number) => ({
    chain_id: token.chain_id,
    id: token.id,
    symbol: token.symbol,
    name: token.name,
    decimals: token.decimals,
    logo_url: token.logo_url,
    price: token.price,
    price_24h_change: token.price_24h_change,
    amount,
    usd_value: usd,
  });

  it('intersects by chain and lowercase id, sorted by value desc', () => {
    expect(
      toRawPositions(
        [
          { id: '0xABC', chain: 'eth', amount: 10, price: 1, usd_value: 10 },
          { id: 'bonk', chain: 'bsc', amount: 5, price: 6, usd_value: 30 },
          { id: '0xabc', chain: 'base', amount: 99, price: 1, usd_value: 99 },
          { id: '0xusdc', chain: 'eth', amount: 50, price: 1, usd_value: 50 },
        ],
        [pepe, bonk],
        '0xOwNeR',
      ),
    ).toEqual({
      owner: '0xowner',
      total_usd_value: 40,
      positions: [position(bonk, 5, 30), position(pepe, 10, 10)],
    });
  });

  it('skips zero balances and falls back to amount × price', () => {
    expect(
      toRawPositions(
        [
          { id: '0xabc', chain: 'eth', amount: 0, price: 1, usd_value: 0 },
          { id: 'bonk', chain: 'bsc', amount: 2, price: 3 },
        ],
        [pepe, bonk],
        '0xowner',
      ),
    ).toEqual({
      owner: '0xowner',
      total_usd_value: 6,
      positions: [position(bonk, 2, 6)],
    });
  });

  it('breaks value ties by token key', () => {
    const result = toRawPositions(
      [
        { id: '0xabc', chain: 'eth', amount: 1, price: 1, usd_value: 5 },
        { id: 'bonk', chain: 'bsc', amount: 1, price: 1, usd_value: 5 },
      ],
      [pepe, bonk],
      '0xowner',
    );
    expect(result.positions.map(p => p.id)).toEqual(['bonk', '0xabc']);
  });
});

describe('loadTemporaryMemeTokens', () => {
  it('requests the meme category by fdv desc and follows one cursor page', async () => {
    getList
      .mockResolvedValueOnce({
        data_list: [item('a'), item('b')],
        pagination: { limit: 100, has_next: true, next_cursor: 'c1' },
      })
      .mockResolvedValueOnce({
        data_list: [item('B'), item('c')],
        pagination: { limit: 100, has_next: true, next_cursor: 'c2' },
      });

    const list = await loadTemporaryMemeTokens();

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

    const list = await loadTemporaryMemeTokens();

    expect(getList).toHaveBeenCalledTimes(1);
    expect(list.map(m => m.id)).toEqual(['a']);
  });

  it('shares one request and reuses the list for 60 s', async () => {
    getList.mockResolvedValue({
      data_list: [item('a')],
      pagination: { limit: 100, has_next: false, next_cursor: '' },
    });

    const [first, second] = await Promise.all([
      loadTemporaryMemeTokens(),
      loadTemporaryMemeTokens(),
    ]);
    expect(second).toBe(first);
    now += 59_000;
    expect(await loadTemporaryMemeTokens()).toBe(first);
    expect(getList).toHaveBeenCalledTimes(1);

    now += 2_000;
    await loadTemporaryMemeTokens();
    expect(getList).toHaveBeenCalledTimes(2);
  });
});

describe('temporaryFetchMemeUserTokenList', () => {
  it('builds positions from the refreshed wallet tokens', async () => {
    getList.mockResolvedValueOnce({
      data_list: [item('0xpepe', 'hood')],
      pagination: { limit: 100, has_next: false, next_cursor: '' },
    });
    const getTokenList = jest.fn().mockResolvedValue(undefined);
    getTokenState.mockReturnValue({
      getTokenList,
      tokenListMap: {
        '0xowner': [
          { id: '0xPEPE', chain: 'hood', amount: 3, price: 1, usd_value: 3 },
        ],
      },
    });

    const result = await temporaryFetchMemeUserTokenList('0xOwner');

    expect(getTokenList).toHaveBeenCalledWith('0xOwner', true);
    expect(result.owner).toBe('0xowner');
    expect(result.total_usd_value).toBe(3);
    expect(result.positions.map(p => p.id)).toEqual(['0xpepe']);
  });
});
