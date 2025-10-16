import { CHAINS_ENUM } from '@/constant/chains';

export const SAFE_GAS_LIMIT_RATIO = {
  '1284': 2,
  '1285': 2,
  '1287': 2,
};

export const SAFE_GAS_LIMIT_BUFFER = {
  '996': 0.86,
  '49088': 0.86,
  '3068': 0.86,
};

export const DEFAULT_GAS_LIMIT_BUFFER = 0.95;

export const GAS_TOP_UP_ADDRESS = '0x7559e1bbe06e94aeed8000d5671ed424397d25b5';
export const GAS_TOP_UP_PAY_ADDRESS =
  '0x1f1f2bf8942861e6194fda1c0a9f13921c0cf117';
export const FREE_GAS_ADDRESS = '0x76dd65529dc6c073c1e0af2a5ecc78434bdbf7d9';

export const GAS_TOP_UP_SUPPORT_TOKENS: Record<string, string[]> = {
  arb: [
    '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
    '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1',
    '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
    'arb',
  ],
  astar: ['astar'],
  aurora: ['aurora'],
  avax: ['avax'],
  base: ['0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', 'base'],
  boba: ['boba'],
  bsc: [
    '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3',
    '0x2170ed0880ac9a755fd29b2688956bd959f933f8',
    '0x55d398326f99059ff775485246999027b3197955',
    '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
    '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
    'bsc',
  ],
  canto: ['canto'],
  celo: ['celo'],
  cro: ['0x5c7f8a570d578ed84e63fdfa7b1ee72deae1ae23', 'cro'],
  era: ['era'],
  eth: [
    '0x6b175474e89094c44da98b954eedeac495271d0f',
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    '0xdac17f958d2ee523a2206206994597c13d831ec7',
    'eth',
  ],
  evmos: ['evmos'],
  ftm: ['0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83', 'ftm'],
  hmy: ['hmy'],
  kava: ['kava'],
  kcc: ['kcc'],
  linea: ['linea'],
  matic: [
    '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
    '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
    '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063',
    '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
    'matic',
  ],
  metis: ['metis'],
  mnt: ['mnt'],
  mobm: ['mobm'],
  movr: ['movr'],
  nova: ['nova'],
  okt: ['okt'],
  op: [
    '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
    '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58',
    '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1',
    'op',
  ],
  opbnb: ['opbnb'],
  pls: ['pls'],
  pze: ['pze'],
  scrl: ['scrl'],
  xdai: ['xdai'],
};

export const DEFAULT_GAS_LIMIT_RATIO = 1.5;

export const MINIMUM_GAS_LIMIT = 21000;

// non-opstack L2 chains
export const L2_ENUMS = [
  CHAINS_ENUM.ARBITRUM,
  CHAINS_ENUM.AURORA,
  CHAINS_ENUM.NOVA,
  CHAINS_ENUM.BOBA,
  CHAINS_ENUM.MANTLE,
  CHAINS_ENUM.LINEA,
  CHAINS_ENUM.MANTA,
  CHAINS_ENUM.SCRL,
  CHAINS_ENUM.ERA,
  CHAINS_ENUM.PZE,
  CHAINS_ENUM.MANTA,
  CHAINS_ENUM.OP,
  CHAINS_ENUM.BASE,
  CHAINS_ENUM.ZORA,
  CHAINS_ENUM.OPBNB,
  CHAINS_ENUM.BLAST,
  CHAINS_ENUM.MODE,
  'DBK',
  'MINT',
  'CYBER',
  'KATANA',
  'WORLD',
  'INK',
  'SONEIUM',
];

// opstack L2 chains
export const OP_STACK_ENUMS = [
  CHAINS_ENUM.OP,
  CHAINS_ENUM.BASE,
  CHAINS_ENUM.ZORA,
  CHAINS_ENUM.OPBNB,
  CHAINS_ENUM.BLAST,
  CHAINS_ENUM.MODE,
  'DBK',
  'MINT',
  'CYBER',
  'KATANA',
  'WORLD',
  'INK',
  'SONEIUM',
];

export const ARB_LIKE_L2_CHAINS = [CHAINS_ENUM.ARBITRUM, CHAINS_ENUM.AURORA];

export const CAN_NOT_SPECIFY_INTRINSIC_GAS_CHAINS = [...L2_ENUMS];

export const CAN_ESTIMATE_L1_FEE_CHAINS = [
  ...OP_STACK_ENUMS,
  CHAINS_ENUM.SCRL,
  ...ARB_LIKE_L2_CHAINS,
  CHAINS_ENUM.PZE,
  CHAINS_ENUM.ERA,
  CHAINS_ENUM.LINEA,
];

export const ALIAS_ADDRESS = {
  [GAS_TOP_UP_ADDRESS]: 'Gas Top Up',
  [GAS_TOP_UP_PAY_ADDRESS]: 'Gas Top Up',
  [FREE_GAS_ADDRESS]: 'Free Gas',
};
