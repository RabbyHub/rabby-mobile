import { CustomMarket } from './market';

const commonUnfoldTokenSymbols = [
  'usdc',
  'weth',
  'usdt',
  'eth',
  'wsteth',
  'aave',
  'wbtc',
  'dai',
];

const unfoldTokenSymbols = {
  // Core
  [CustomMarket.proto_mainnet_v3]: ['usde', 'cbbtc', 'weeth'],

  // Prime
  [CustomMarket.proto_lido_v3]: ['usds', 'gho'],

  // Base
  [CustomMarket.proto_base_v3]: ['cbeth', 'cbbtc', 'eurc'],

  // Arbitrum
  [CustomMarket.proto_arbitrum_v3]: ['arb', 'usd₮0', 'weeth'],

  // Avalanche
  [CustomMarket.proto_avalanche_v3]: [
    'wavax',
    'avax',
    'savax',
    'btc.b',
    'dai.e',
    'eurc',
    'eusde',
  ],

  // Linea
  [CustomMarket.proto_linea_v3]: ['weeth'],

  // Sonic
  [CustomMarket.proto_sonic_v3]: ['s', 'ws'],

  // OP
  [CustomMarket.proto_optimism_v3]: ['op'],

  // Horizon RWA
  [CustomMarket.proto_horizon_v3]: ['rlusd', 'ustb', 'gho'],

  // Plasma
  [CustomMarket.proto_plasma_v3]: ['usde', 'usdt0', 'susde', 'syrupusdt'],

  // Polygon
  [CustomMarket.proto_polygon_v3]: ['wpol', 'pol', 'usdt0'],

  // Ink
  [CustomMarket.proto_ink_v3]: ['usdg', 'usd₮0', 'kbtc'],

  // Gnosis
  [CustomMarket.proto_gnosis_v3]: ['wxdai', 'xdai', 'eure', 'sdai'],

  // BNB Chain
  [CustomMarket.proto_bnb_v3]: ['bnb', 'wbnb', 'btcb'],

  // Scroll
  [CustomMarket.proto_scroll_v3]: ['scr'],

  // ZKsync
  [CustomMarket.proto_zksync_v3]: ['zk'],

  // Celo
  [CustomMarket.proto_celo_v3]: ['celo', 'usd₮'],

  // Soneium
  [CustomMarket.proto_soneium_v3]: [],

  // Metis
  [CustomMarket.proto_metis_v3]: ['metis', 'm.usdt', 'm.usdc', 'm.dai'],
};

export const isUnFoldToken = (market: CustomMarket, symbol: string) => {
  const normalizedSymbol = symbol.toLowerCase();
  if (commonUnfoldTokenSymbols.includes(normalizedSymbol)) {
    return true;
  }
  if (!unfoldTokenSymbols[market]) {
    // 没找到就是新配置的market，默认展开
    return true;
  }
  return unfoldTokenSymbols[market]?.includes(normalizedSymbol) ?? false;
};
