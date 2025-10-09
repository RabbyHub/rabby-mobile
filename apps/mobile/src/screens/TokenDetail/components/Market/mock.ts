import {
  LiquidityPoolHistoryItem,
  LiquidityPoolItem,
} from '@rabby-wallet/rabby-api/dist/types';

export const pools: LiquidityPoolItem[] = [
  {
    id: '1',
    tokens: [
      {
        id: '1',
        amount: 1000000,
        symbol: 'USDT',
        price: 1,
        usd_value: 1000000,
      },
      {
        id: '2',
        amount: 1000000,
        symbol: 'DAI',
        price: 1,
        usd_value: 1000000,
      },
    ],
    project: {
      id: '1',
      name: 'USDT',
      logo_url: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
    },
    pool_id: '1',
    usd_value: 1000000,
  },
  {
    id: '2',
    tokens: [
      {
        id: '1',
        amount: 1000000,
        symbol: 'USDE',
        price: 1,
        usd_value: 1000000,
      },
      {
        id: '2',
        amount: 1000000,
        symbol: 'DAI',
        price: 1,
        usd_value: 1000000,
      },
    ],
    project: {
      id: '1',
      name: 'USDT',
      logo_url: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
    },
    pool_id: '1',
    usd_value: 1000000,
  },
  {
    id: '3',
    tokens: [
      {
        id: '1',
        amount: 1000000,
        symbol: 'USDS',
        price: 1,
        usd_value: 1000000,
      },
      {
        id: '2',
        amount: 1000000,
        symbol: 'DAI',
        price: 1,
        usd_value: 1000000,
      },
    ],
    project: {
      id: '1',
      name: 'USDT',
      logo_url: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
    },
    pool_id: '1',
    usd_value: 1000000,
  },
  {
    id: '4',
    tokens: [
      {
        id: '1',
        amount: 1000000,
        symbol: 'USDT',
        price: 1,
        usd_value: 1000000,
      },
      {
        id: '2',
        amount: 1000000,
        symbol: 'DAI',
        price: 1,
        usd_value: 1000000,
      },
    ],
    project: {
      id: '1',
      name: 'USDT',
      logo_url: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
    },
    pool_id: '1',
    usd_value: 1000000,
  },
];

// 纯 add
export const addData: LiquidityPoolHistoryItem[] = [
  {
    id: '1',
    tx_id: '0xaaa111',
    time_at: 1696040000,
    action: 'add',
    usd_value: 2660,
    tokens: [
      { id: 'eth', amount: 1.2, symbol: 'ETH', price: 1800, usd_value: 2160 },
      { id: 'usdc', amount: 500, symbol: 'USDC', price: 1, usd_value: 500 },
    ],
  },
  {
    id: '2',
    tx_id: '0xaaa112',
    time_at: 1696041000,
    action: 'add',
    usd_value: 1350,
    tokens: [
      { id: 'btc', amount: 0.05, symbol: 'BTC', price: 27000, usd_value: 1350 },
    ],
  },
  {
    id: '3',
    tx_id: '0xaaa113',
    time_at: 1696042000,
    action: 'add',
    usd_value: 460,
    tokens: [
      { id: 'sol', amount: 10, symbol: 'SOL', price: 20, usd_value: 200 },
      { id: 'avax', amount: 15, symbol: 'AVAX', price: 12, usd_value: 180 },
      { id: 'matic', amount: 100, symbol: 'MATIC', price: 0.8, usd_value: 80 },
    ],
  },
  {
    id: '4',
    tx_id: '0xaaa114',
    time_at: 1696043000,
    action: 'add',
    usd_value: 420,
    tokens: [
      { id: 'bnb', amount: 2, symbol: 'BNB', price: 210, usd_value: 420 },
    ],
  },
  {
    id: '5',
    tx_id: '0xaaa115',
    time_at: 1696044000,
    action: 'add',
    usd_value: 105,
    tokens: [
      { id: 'arb', amount: 50, symbol: 'ARB', price: 1.2, usd_value: 60 },
      { id: 'op', amount: 30, symbol: 'OP', price: 1.5, usd_value: 45 },
    ],
  },
];

// 纯 remove
export const removeData: LiquidityPoolHistoryItem[] = [
  {
    id: '6',
    tx_id: '0xbbb111',
    time_at: 1696045000,
    action: 'remove',
    usd_value: 546,
    tokens: [
      { id: 'eth', amount: 0.3, symbol: 'ETH', price: 1820, usd_value: 546 },
    ],
  },
  {
    id: '7',
    tx_id: '0xbbb112',
    time_at: 1696046000,
    action: 'remove',
    usd_value: 1200,
    tokens: [
      { id: 'usdt', amount: 1000, symbol: 'USDT', price: 1, usd_value: 1000 },
      { id: 'dai', amount: 200, symbol: 'DAI', price: 1, usd_value: 200 },
    ],
  },
  {
    id: '8',
    tx_id: '0xbbb113',
    time_at: 1696047000,
    action: 'remove',
    usd_value: 470,
    tokens: [
      { id: 'link', amount: 40, symbol: 'LINK', price: 6.5, usd_value: 260 },
      { id: 'dot', amount: 25, symbol: 'DOT', price: 4.2, usd_value: 105 },
      { id: 'atom', amount: 15, symbol: 'ATOM', price: 7, usd_value: 105 },
    ],
  },
  {
    id: '9',
    tx_id: '0xbbb114',
    time_at: 1696048000,
    action: 'remove',
    usd_value: 75,
    tokens: [
      { id: 'ftm', amount: 300, symbol: 'FTM', price: 0.25, usd_value: 75 },
    ],
  },
  {
    id: '10',
    tx_id: '0xbbb115',
    time_at: 1696049000,
    action: 'remove',
    usd_value: 223,
    tokens: [
      { id: 'gmx', amount: 5, symbol: 'GMX', price: 35, usd_value: 175 },
      { id: 'uni', amount: 12, symbol: 'UNI', price: 4, usd_value: 48 },
    ],
  },
];

// 混合
export const mixedData: LiquidityPoolHistoryItem[] = [
  {
    id: '11',
    tx_id: '0xccc111',
    time_at: 1696050000,
    action: 'add',
    usd_value: 600,
    tokens: [
      {
        id: 'doge',
        amount: 10000,
        symbol: 'DOGE',
        price: 0.06,
        usd_value: 600,
      },
    ],
  },
  {
    id: '12',
    tx_id: '0xccc112',
    time_at: 1696051000,
    action: 'remove',
    usd_value: 17,
    tokens: [
      {
        id: 'shib',
        amount: 2000000,
        symbol: 'SHIB',
        price: 0.000008,
        usd_value: 16,
      },
      {
        id: 'pepe',
        amount: 1000000,
        symbol: 'PEPE',
        price: 0.000001,
        usd_value: 1,
      },
    ],
  },
  {
    id: '13',
    tx_id: '0xccc113',
    time_at: 1696052000,
    action: 'add',
    usd_value: 2696.5,
    tokens: [
      {
        id: 'steth',
        amount: 0.8,
        symbol: 'stETH',
        price: 1780,
        usd_value: 1424,
      },
      { id: 'reth', amount: 0.2, symbol: 'rETH', price: 1850, usd_value: 370 },
      {
        id: 'cbeth',
        amount: 0.5,
        symbol: 'cbETH',
        price: 1805,
        usd_value: 902.5,
      },
    ],
  },
  {
    id: '14',
    tx_id: '0xccc114',
    time_at: 1696053000,
    action: 'remove',
    usd_value: 80,
    tokens: [
      { id: 'lido', amount: 50, symbol: 'LDO', price: 1.6, usd_value: 80 },
    ],
  },
  {
    id: '15',
    tx_id: '0xccc115',
    time_at: 1696054000,
    action: 'add',
    usd_value: 190,
    tokens: [
      { id: 'crv', amount: 300, symbol: 'CRV', price: 0.4, usd_value: 120 },
      { id: 'bal', amount: 20, symbol: 'BAL', price: 3.5, usd_value: 70 },
    ],
  },
];
