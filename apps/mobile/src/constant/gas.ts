import { CHAINS_ENUM } from '@/constant/chains';

export const SAFE_GAS_LIMIT_RATIO = {
  '1284': 2,
  '1285': 2,
  '1287': 2,
};
export const GAS_TOP_UP_ADDRESS = '0x7559e1bbe06e94aeed8000d5671ed424397d25b5';
export const GAS_TOP_UP_PAY_ADDRESS =
  '0x1f1f2bf8942861e6194fda1c0a9f13921c0cf117';

export const GAS_TOP_UP_SUPPORT_TOKENS: Record<string, string[]> = {
  arb: [
    '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1',
    '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
    '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8',
    'arb',
  ],
  astar: ['astar'],
  aurora: ['aurora'],
  avax: [
    '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7',
    '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7',
    '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e',
    '0xd586e7f844cea2f87f50152665bcbc2c279d8d70',
    'avax',
  ],
  boba: ['boba'],
  bsc: [
    '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3',
    '0x2170ed0880ac9a755fd29b2688956bd959f933f8',
    '0x55d398326f99059ff775485246999027b3197955',
    '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
    '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
    '0xe9e7cea3dedca5984780bafc599bd69add087d56',
    'bsc',
  ],
  btt: ['btt'],
  canto: ['canto'],
  celo: ['celo'],
  cro: [
    '0x5c7f8a570d578ed84e63fdfa7b1ee72deae1ae23',
    '0x66e428c3f67a68878562e79a0234c1f83c208770',
    '0xc21223249ca28397b4b6541dffaecc539bff0c59',
    '0xf2001b145b43032aaf5ee2884e456ccd805f677d',
    'cro',
  ],
  dfk: ['dfk'],
  doge: ['doge'],
  eth: [
    '0x4fabb145d64652a948d72533023f6e7a623c7c53',
    '0x6b175474e89094c44da98b954eedeac495271d0f',
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    '0xdac17f958d2ee523a2206206994597c13d831ec7',
    'eth',
  ],
  evmos: ['evmos'],
  ftm: [
    '0x04068da6c83afcfa0e13ba15a6696662335d5b75',
    '0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83',
    'ftm',
  ],
  fuse: ['fuse'],
  heco: ['heco'],
  hmy: ['hmy'],
  iotx: ['iotx'],
  kcc: ['kcc'],
  klay: ['klay'],
  matic: [
    '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
    '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
    '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063',
    '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
    'matic',
  ],
  metis: ['metis'],
  mobm: ['mobm'],
  movr: ['movr'],
  nova: ['nova'],
  okt: ['okt'],
  op: [
    '0x7f5c764cbc14f9669b88837ca1490cca17c31607',
    '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58',
    '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1',
    'op',
  ],
  palm: ['palm'],
  rsk: ['rsk'],
  sbch: ['sbch'],
  sdn: ['sdn'],
  sgb: ['sgb'],
  // swm: ['swm'],
  tlos: ['tlos'],
  wan: ['wan'],
  xdai: ['xdai'],
};

export const DEFAULT_GAS_LIMIT_RATIO = 1.5;

export const MINIMUM_GAS_LIMIT = 21000;

// opstack L2 chains
export const OP_STACK_ENUMS = [
  CHAINS_ENUM.OP,
  CHAINS_ENUM.BASE,
  CHAINS_ENUM.ZORA,
  CHAINS_ENUM.OPBNB,
  CHAINS_ENUM.BLAST,
];

export const ARB_LIKE_L2_CHAINS = [CHAINS_ENUM.ARBITRUM, CHAINS_ENUM.AURORA];

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
};

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
];
