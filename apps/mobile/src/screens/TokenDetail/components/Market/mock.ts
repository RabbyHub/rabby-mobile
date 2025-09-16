export type MarketTradingHistoryItem = {
  id: string;
  action: 'buy' | 'sell';
  price: number;
  amount: number;
  usd_value: number;
  tx_id: string;
  user_addr: string;
  time_at: number;
};

const mock_list_data: MarketTradingHistoryItem[] = [
  {
    id: '123',
    action: 'buy',
    price: 123.2234424,
    amount: 123,
    usd_value: 123,
    tx_id: '12312312312',
    user_addr: '0xb84168cf3be63c6b8dad05ff5d755e97432ff80b',
    time_at: 1757183318,
  },
  {
    id: '124',
    action: 'sell',
    price: 123.000021,
    amount: 123,
    usd_value: 123,
    tx_id: '12312312312',
    user_addr: '0xb84168cf3be63c6b8dad05ff5d755e97432ff801',
    time_at: 1757677406,
  },
  {
    id: '125',
    action: 'buy',
    price: 0.000004324,
    amount: 123424233,
    usd_value: 13343244243,
    tx_id: '12312312312',
    user_addr: '0xb84168cf3be63c6b8dad05ff5d755e97432ff802',
    time_at: 1757670406,
  },
  {
    id: '126',
    action: 'buy',
    price: 0.000000000001,
    amount: 123042342,
    usd_value: 123,
    tx_id: '12312312312',
    user_addr: '0xb84168cf3be63c6b8dad05ff5d755e97432ff803',
    time_at: 1757677006,
  },
];

export const getMarketTradingHistory = async (params: {
  token_id: string;
  chain_id: string;
  action: 'buy' | 'sell';
  after_time_at?: number;
  limit?: number; // default 20 max 20
  cursor?: string;
}): Promise<{
  page: {
    limit: number;
    has_next: boolean;
    next_cursor?: string;
  };
  data_list: MarketTradingHistoryItem[];
}> => {
  const {
    token_id,
    chain_id,
    action,
    after_time_at,
    limit = 20,
    cursor,
  } = params;

  let pageIndex = 0;
  try {
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
      pageIndex = typeof decoded.page === 'number' ? decoded.page : 0;
    }
  } catch (_) {
    pageIndex = 0;
  }

  const seed = `${token_id}:${chain_id}:${action}`;
  const poolSize = 100;
  const baseTime = 1758000000;

  const pool: MarketTradingHistoryItem[] = Array.from({ length: poolSize }).map(
    (_, idx) => {
      const id = `${seed}:${idx}`;
      const price = Number(
        (Math.abs(hashCode(seed) % 1000) / 10 + idx / 1000).toFixed(9),
      );
      const amount = (idx + 1) * (action === 'buy' ? 3 : 2);
      const usd_value = Number((price * amount).toFixed(6));
      const tx_id = `${hashCode(id)}:${idx}`;
      const user_addr = `0x${Math.abs(hashCode(id + 'addr'))
        .toString(16)
        .padStart(40, '0')}`.slice(0, 42);
      const time_at = baseTime - idx * 60;
      return {
        id,
        action,
        price,
        amount,
        usd_value,
        tx_id,
        user_addr,
        time_at,
      } as MarketTradingHistoryItem;
    },
  );

  const filtered =
    typeof after_time_at === 'number'
      ? pool.filter(item => item.time_at > after_time_at)
      : pool;

  const pageLimit = Math.min(20, limit);
  const start = pageIndex * pageLimit;
  const end = start + pageLimit;
  const slice = filtered.slice(start, end);
  const has_next = end < filtered.length;
  const next_cursor = has_next
    ? Buffer.from(JSON.stringify({ page: pageIndex + 1 })).toString('base64')
    : undefined;

  await sleep(200);

  return {
    page: {
      limit: pageLimit,
      has_next,
      next_cursor,
    },
    data_list: slice.length ? slice : mock_list_data,
  };
};

function hashCode(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const chr = input.charCodeAt(i);
    hash = (hash * 31 + chr) % 2147483647; // avoid bitwise operators
  }
  return hash;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
