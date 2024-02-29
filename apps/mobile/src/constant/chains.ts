import {
  CHAINS_ENUM,
  CHAINS_LIST as COMMON_CHAINS_LIST,
  Chain,
} from '@debank/common';

export type { Chain } from '@debank/common';
export { CHAINS_ENUM };
import { openapi } from '@/core/request';
import { intToHex } from '@ethereumjs/util';
import { MMKV } from 'react-native-mmkv';
import { keyBy } from 'lodash';

const storage = new MMKV({
  id: 'mmkv.chains',
});

const getChainsFromStorage = () => {
  try {
    const value = storage.getString('chains');
    if (value) {
      return JSON.parse(value) as Chain[];
    }
  } catch (e) {}
};

const DEFAULT_CHAIN_LIST: Chain[] = [
  {
    id: 1,
    enum: CHAINS_ENUM.ETH,
    name: 'Ethereum',
    serverId: 'eth',
    hex: '0x1',
    network: '1',
    nativeTokenSymbol: 'ETH',
    nativeTokenLogo:
      'https://static.debank.com/image/token/logo_url/eth/935ae4e4d1d12d59a99717a24f2540b5.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'eth',
    scanLink: 'https://etherscan.io/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/eth/42ba589cd077e7bdd97db6480b0ff61d.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/eth/561dda8f1ed8f0b2f46474bde3f02d0b.png',
    eip: { '1559': true },
  },
  {
    id: 56,
    enum: CHAINS_ENUM.BSC,
    name: 'BNB Chain',
    serverId: 'bsc',
    hex: '0x38',
    network: '56',
    nativeTokenSymbol: 'BNB',
    nativeTokenLogo:
      'https://static.debank.com/image/coin/logo_url/bnb/9784283a36f23a58982fc964574ea530.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'bsc',
    scanLink: 'https://bscscan.com/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/bsc/bc73fa84b7fc5337905e527dadcbc854.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/bsc/8e44e643d6e2fd335a72b4cda6368e1a.png',
    eip: { '1559': false },
  },
  {
    id: 100,
    enum: CHAINS_ENUM.GNOSIS,
    name: 'Gnosis Chain',
    serverId: 'xdai',
    hex: '0x64',
    network: '100',
    nativeTokenSymbol: 'xDai',
    nativeTokenLogo:
      'https://static.debank.com/image/xdai_token/logo_url/xdai/297890dc063e6dfb6cb4065cdf38382e.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'xdai',
    scanLink: 'https://gnosisscan.io/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/xdai/43c1e09e93e68c9f0f3b132976394529.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/xdai/d8744f83d1a3bef4941c0820d76242a2.png',
    eip: { '1559': true },
  },
  {
    id: 137,
    enum: CHAINS_ENUM.POLYGON,
    name: 'Polygon',
    serverId: 'matic',
    hex: '0x89',
    network: '137',
    nativeTokenSymbol: 'MATIC',
    nativeTokenLogo:
      'https://static.debank.com/image/matic_token/logo_url/matic/6f5a6b6f0732a7a235131bd7804d357c.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'matic',
    scanLink: 'https://polygonscan.com/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/matic/52ca152c08831e4765506c9bd75767e8.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/matic/d9d33b57922dce7a5ac567b0e5eb1e4b.png',
    eip: { '1559': true },
  },
  {
    id: 250,
    enum: CHAINS_ENUM.FTM,
    name: 'Fantom',
    serverId: 'ftm',
    hex: '0xfa',
    network: '250',
    nativeTokenSymbol: 'FTM',
    nativeTokenLogo:
      'https://static.debank.com/image/ftm_token/logo_url/ftm/33fdb9c5067e94f3a1b9e78f6fa86984.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'ftm',
    scanLink: 'https://ftmscan.com/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/ftm/14133435f89637157a4405e954e1b1b2.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/ftm/64178bae592be3a33c160b1d9b9a124a.png',
    eip: { '1559': false },
  },
  {
    id: 66,
    enum: CHAINS_ENUM.OKT,
    name: 'OKC',
    serverId: 'okt',
    hex: '0x42',
    network: '66',
    nativeTokenSymbol: 'OKT',
    nativeTokenLogo:
      'https://static.debank.com/image/okt_token/logo_url/0x8f8526dbfd6e38e3d8307702ca8469bae6c56c15/54a64333ea780b76b96435d66ab41146.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'okt',
    scanLink: 'https://www.oklink.com/okexchain/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/okt/428bf6035abb3863c9f5c1a10dc3afd3.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/okt/f99c2d812fe1fe33afb7f5a40f073437.png',
    eip: { '1559': false },
  },
  {
    id: 128,
    enum: CHAINS_ENUM.HECO,
    name: 'HECO',
    serverId: 'heco',
    hex: '0x80',
    network: '128',
    nativeTokenSymbol: 'HT',
    nativeTokenLogo:
      'https://static.debank.com/image/heco_token/logo_url/heco/c399dcddde07e1944c4dd8f922832b53.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'heco',
    scanLink: 'https://hecoscan.io/#/transaction/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/heco/db5152613c669e0cc8624d466d6c94ea.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/heco/a9157fe205667b41ca4a0d2a24d775c0.png',
    eip: { '1559': true },
  },
  {
    id: 43114,
    enum: CHAINS_ENUM.AVAX,
    name: 'Avalanche',
    serverId: 'avax',
    hex: '0xa86a',
    network: '43114',
    nativeTokenSymbol: 'AVAX',
    nativeTokenLogo:
      'https://static.debank.com/image/avax_token/logo_url/avax/0b9c84359c84d6bdd5bfda9c2d4c4a82.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'avax',
    scanLink: 'https://snowtrace.io/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/avax/4d1649e8a0c7dec9de3491b81807d402.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/avax/e8a86458cb9e656052f0250d079622d8.png',
    eip: { '1559': true },
  },
  {
    id: 10,
    enum: CHAINS_ENUM.OP,
    name: 'Optimism',
    serverId: 'op',
    hex: '0xa',
    network: '10',
    nativeTokenSymbol: 'ETH',
    nativeTokenLogo:
      'https://static.debank.com/image/op_token/logo_url/op/d61441782d4a08a7479d54aea211679e.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'op',
    scanLink: 'https://optimistic.etherscan.io/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/op/01ae734fe781c9c2ae6a4cc7e9244056.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/op/b571a53bc1ce3833a6cc3db42847931b.png',
    eip: { '1559': false },
  },
  {
    id: 42161,
    enum: CHAINS_ENUM.ARBITRUM,
    name: 'Arbitrum',
    serverId: 'arb',
    hex: '0xa4b1',
    network: '42161',
    nativeTokenSymbol: 'ETH',
    nativeTokenLogo:
      'https://static.debank.com/image/arb_token/logo_url/arb/d61441782d4a08a7479d54aea211679e.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'arb',
    scanLink: 'https://arbiscan.io/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/arb/854f629937ce94bebeb2cd38fb336de7.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/arb/315c3c4560a12e9c94841706e3ed9ce5.png',
    eip: { '1559': true },
  },
  {
    id: 42220,
    enum: CHAINS_ENUM.CELO,
    name: 'Celo',
    serverId: 'celo',
    hex: '0xa4ec',
    network: '42220',
    nativeTokenSymbol: 'CELO',
    nativeTokenLogo:
      'https://static.debank.com/image/celo_token/logo_url/0x471ece3750da237f93b8e339c536989b8978a438/6f524d91db674876ba0f5767cf0124cc.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'celo',
    scanLink: 'https://celoscan.io/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/celo/41da5c1d3c0945ae822a1f85f02c76cf.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/celo/17b4db6dd9f3559117547bc22ddc5b89.png',
    eip: { '1559': false },
  },
  {
    id: 1285,
    enum: CHAINS_ENUM.MOVR,
    name: 'Moonriver',
    serverId: 'movr',
    hex: '0x505',
    network: '1285',
    nativeTokenSymbol: 'MOVR',
    nativeTokenLogo:
      'https://static.debank.com/image/mtr_token/logo_url/0xb158870beb809ad955bf56065c5c10d7fd957cc0/aa42368ae1d5856d15c13ecc0ff74af6.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'movr',
    scanLink: 'https://moonriver.moonscan.io/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/movr/4b0de5a711b437f187c0d0f15cc0398b.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/movr/c13a5af6c923aad7cc6cad311267da8e.png',
    eip: { '1559': true },
  },
  {
    id: 25,
    enum: CHAINS_ENUM.CRO,
    name: 'Cronos',
    serverId: 'cro',
    hex: '0x19',
    network: '25',
    nativeTokenSymbol: 'CRO',
    nativeTokenLogo:
      'https://static.debank.com/image/cro_token/logo_url/cro/7803de9b434be197c2c1399465abdf39.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'cro',
    scanLink: 'https://cronoscan.com/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/cro/f947000cc879ee8ffa032793808c741c.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/cro/555a092be8378d6e55000b3846043bec.png',
    eip: { '1559': true },
  },
  {
    id: 288,
    enum: CHAINS_ENUM.BOBA,
    name: 'Boba',
    serverId: 'boba',
    hex: '0x120',
    network: '288',
    nativeTokenSymbol: 'ETH',
    nativeTokenLogo:
      'https://static.debank.com/image/boba_token/logo_url/boba/b1947b38a90e559eb950453965714be4.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'boba',
    scanLink: 'https://bobascan.com/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/boba/e43d79cd8088ceb3ea3e4a240a75728f.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/boba/aea02e2a1cf1087f299f4d501777d0cd.png',
    eip: { '1559': false },
  },
  {
    id: 1088,
    enum: CHAINS_ENUM.METIS,
    name: 'Metis',
    serverId: 'metis',
    hex: '0x440',
    network: '1088',
    nativeTokenSymbol: 'Metis',
    nativeTokenLogo:
      'https://static.debank.com/image/coin/logo_url/metis/7485c0a61c1e05fdf707113b6b6ac917.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'metis',
    scanLink: 'https://explorer.metis.io/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/metis/7485c0a61c1e05fdf707113b6b6ac917.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/metis/3fb2c5171563b035fe4add98eca01efc.png',
    eip: { '1559': false },
  },
  {
    id: 199,
    enum: CHAINS_ENUM.BTT,
    name: 'BitTorrent',
    serverId: 'btt',
    hex: '0xc7',
    network: '199',
    nativeTokenSymbol: 'BTT',
    nativeTokenLogo:
      'https://static.debank.com/image/btt_token/logo_url/btt/2130a8d57ff2a0f3d50a4ec9432897c6.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'btt',
    scanLink: 'https://bttcscan.com/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/btt/2130a8d57ff2a0f3d50a4ec9432897c6.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/btt/4d76b329327ccfa153e47c750d0775d3.png',
    eip: { '1559': false },
  },
  {
    id: 1313161554,
    enum: CHAINS_ENUM.AURORA,
    name: 'Aurora',
    serverId: 'aurora',
    hex: '0x4e454152',
    network: '1313161554',
    nativeTokenSymbol: 'AETH',
    nativeTokenLogo:
      'https://static.debank.com/image/aurora_token/logo_url/aurora/d61441782d4a08a7479d54aea211679e.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'aurora',
    scanLink: 'https://aurorascan.dev/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/aurora/da491099bb44690eda122cdd67c5c610.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/aurora/f4109e1ec9f24aa36c23a5d9d27286fb.png',
    eip: { '1559': false },
  },
  {
    id: 1284,
    enum: CHAINS_ENUM.MOBM,
    name: 'Moonbeam',
    serverId: 'mobm',
    hex: '0x504',
    network: '1284',
    nativeTokenSymbol: 'GLMR',
    nativeTokenLogo:
      'https://static.debank.com/image/mobm_token/logo_url/mobm/a8442077d76b258297181c3e6eb8c9cc.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'mobm',
    scanLink: 'https://moonscan.io/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/mobm/a8442077d76b258297181c3e6eb8c9cc.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/mobm/293430b9780093287759bbf2ed80f939.png',
    eip: { '1559': true },
  },
  {
    id: 10000,
    enum: CHAINS_ENUM.SBCH,
    name: 'SmartBch',
    serverId: 'sbch',
    hex: '0x2710',
    network: '10000',
    nativeTokenSymbol: 'BCH',
    nativeTokenLogo:
      'https://static.debank.com/image/sbch_token/logo_url/sbch/03007b5353bb9e221efb82a6a70d9ec9.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'sbch',
    scanLink: 'https://www.smartscan.cash/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/sbch/d78ac780803e7f0a17b73558f423502e.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/sbch/0b08879f05d6a13d7a4181510a1138cf.png',
    eip: { '1559': false },
  },
  {
    id: 122,
    enum: CHAINS_ENUM.FUSE,
    name: 'Fuse',
    serverId: 'fuse',
    hex: '0x7a',
    network: '122',
    nativeTokenSymbol: 'FUSE',
    nativeTokenLogo:
      'https://static.debank.com/image/fuse_token/logo_url/fuse/6342e1cc4646e22d1e91956fdee942eb.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'fuse',
    scanLink: 'https://explorer.fuse.io/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/fuse/36dfb6fe8e9770367976dd4d2286a9ef.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/fuse/ceda89bc24064a4c583f369811ee29b6.png',
    eip: { '1559': false },
  },
  {
    id: 1666600000,
    enum: CHAINS_ENUM.HMY,
    name: 'Harmony',
    serverId: 'hmy',
    hex: '0x63564c40',
    network: '1666600000',
    nativeTokenSymbol: 'ONE',
    nativeTokenLogo:
      'https://static.debank.com/image/hmy_token/logo_url/hmy/734c003023531e31c636ae25d5a73172.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'hmy',
    scanLink: 'https://explorer.harmony.one/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/hmy/b3bfb4681f81a85e25c28e150dcbfe51.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/hmy/a92fd20b6691292d93160e2606035468.png',
    eip: { '1559': false },
  },
  {
    id: 8217,
    enum: CHAINS_ENUM.KLAY,
    name: 'Klaytn',
    serverId: 'klay',
    hex: '0x2019',
    network: '8217',
    nativeTokenSymbol: 'KLAY',
    nativeTokenLogo:
      'https://static.debank.com/image/klay_token/logo_url/klay/1df018b8493cb97c50b7e390ef63cba4.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'klay',
    scanLink: 'https://scope.klaytn.com/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/klay/1df018b8493cb97c50b7e390ef63cba4.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/klay/f5a2aefdbaa9cbc90c0fa1ec0443ec63.png',
    eip: { '1559': false },
  },
  {
    id: 592,
    enum: CHAINS_ENUM.ASTAR,
    name: 'Astar',
    serverId: 'astar',
    hex: '0x250',
    network: '592',
    nativeTokenSymbol: 'ASTR',
    nativeTokenLogo:
      'https://static.debank.com/image/astar_token/logo_url/astar/a827be92d88617a918ea060a9a6f1572.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'astar',
    scanLink: 'https://blockscout.com/astar/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/astar/398c7e0014bdada3d818367a7273fabe.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/astar/116f17a7abe800b7675377857fac1dcd.png',
    eip: { '1559': true },
  },
  {
    id: 4689,
    enum: CHAINS_ENUM.IOTX,
    name: 'IoTeX',
    serverId: 'iotx',
    hex: '0x1251',
    network: '4689',
    nativeTokenSymbol: 'IOTX',
    nativeTokenLogo:
      'https://static.debank.com/image/iotx_token/logo_url/iotx/d3be2cd8677f86bd9ab7d5f3701afcc9.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'iotx',
    scanLink: 'https://iotexscan.io/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/iotx/d3be2cd8677f86bd9ab7d5f3701afcc9.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/iotx/419fdcf87eceb9b8c34af0c5e3985d44.png',
    eip: { '1559': false },
  },
  {
    id: 30,
    enum: CHAINS_ENUM.RSK,
    name: 'RSK',
    serverId: 'rsk',
    hex: '0x1e',
    network: '30',
    nativeTokenSymbol: 'RBTC',
    nativeTokenLogo:
      'https://static.debank.com/image/rsk_token/logo_url/rsk/1dae003fa89234ac011c0dac51126770.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'rsk',
    scanLink: 'https://explorer.rsk.co/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/rsk/ff47def89fba98394168bf5f39920c8c.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/rsk/8f621d4d08c69ba79d5aae53bc9d3eeb.png',
    eip: { '1559': false },
  },
  {
    id: 888,
    enum: CHAINS_ENUM.WAN,
    name: 'Wanchain',
    serverId: 'wan',
    hex: '0x378',
    network: '888',
    nativeTokenSymbol: 'WAN',
    nativeTokenLogo:
      'https://static.debank.com/image/wan_token/logo_url/wan/f205dea796c0abae5b6749d697adfffa.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'wan',
    scanLink: 'https://www.wanscan.org/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/wan/f3aa8b31414732ea5e026e05665146e6.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/wan/dc0ce7bb158767b2de10ce3f23b62675.png',
    eip: { '1559': false },
  },
  {
    id: 321,
    enum: CHAINS_ENUM.KCC,
    name: 'KCC',
    serverId: 'kcc',
    hex: '0x141',
    network: '321',
    nativeTokenSymbol: 'KCS',
    nativeTokenLogo:
      'https://static.debank.com/image/kcc_token/logo_url/kcc/7fca710b626725fc67f02be57f71c597.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'kcc',
    scanLink: 'https://explorer.kcc.io/en/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/kcc/3a5a4ef7d5f1db1e53880d70219d75b6.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/kcc/d3f270fe9ccdd0fc9047bcf9a62d8110.png',
    eip: { '1559': false },
  },
  {
    id: 19,
    enum: CHAINS_ENUM.SGB,
    name: 'Songbird',
    serverId: 'sgb',
    hex: '0x13',
    network: '19',
    nativeTokenSymbol: 'SGB',
    nativeTokenLogo:
      'https://static.debank.com/image/sgb_token/logo_url/0x02f0826ef6ad107cfc861152b32b52fd11bab9ed/619f46d574d62a50bdfd9f0e2f47ddc1.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'sgb',
    scanLink: 'https://songbird-explorer.flare.network/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/sgb/619f46d574d62a50bdfd9f0e2f47ddc1.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/sgb/eeef2dd3241f458e7f43dd06319e6cb2.png',
    eip: { '1559': true },
  },
  {
    id: 9001,
    enum: CHAINS_ENUM.EVMOS,
    name: 'EvmOS',
    serverId: 'evmos',
    hex: '0x2329',
    network: '9001',
    nativeTokenSymbol: 'EVMOS',
    nativeTokenLogo:
      'https://static.debank.com/image/evmos_token/logo_url/evmos/26e038b4d5475d5a4b92f7fc08bdabc9.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'evmos',
    scanLink: 'https://escan.live/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/evmos/26e038b4d5475d5a4b92f7fc08bdabc9.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/evmos/4d575ca6baef4f1de8dcead622091a79.png',
    eip: { '1559': true },
  },
  {
    id: 53935,
    enum: CHAINS_ENUM.DFK,
    name: 'DFK',
    serverId: 'dfk',
    hex: '0xd2af',
    network: '53935',
    nativeTokenSymbol: 'JEWEL',
    nativeTokenLogo:
      'https://static.debank.com/image/dfk_token/logo_url/dfk/09b4ee0e9d0695201fcc7e912ac31595.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'dfk',
    scanLink:
      'https://subnets.avax.network/defi-kingdoms/dfk-chain/explorer/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/dfk/233867c089c5b71be150aa56003f3f7a.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/dfk/bab611be6bf763da73c6179c2150ffdf.png',
    eip: { '1559': true },
  },
  {
    id: 40,
    enum: CHAINS_ENUM.TLOS,
    name: 'Telos',
    serverId: 'tlos',
    hex: '0x28',
    network: '40',
    nativeTokenSymbol: 'TLOS',
    nativeTokenLogo:
      'https://static.debank.com/image/tlos_token/logo_url/tlos/7e45efcbc8d74f7fd6cda972938f4ade.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'tlos',
    scanLink: 'https://www.teloscan.io/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/telos/f9f7493def4c08ed222540bebd8ce87a.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/tlos/deae1896415f9dac66e60cb47d8165d7.png',
    eip: { '1559': false },
  },
  {
    id: 42170,
    enum: CHAINS_ENUM.NOVA,
    name: 'Arbitrum Nova',
    serverId: 'nova',
    hex: '0xa4ba',
    network: '42170',
    nativeTokenSymbol: 'ETH',
    nativeTokenLogo:
      'https://static.debank.com/image/nova_token/logo_url/nova/fa2f1f04a6761644701860eea7c4a47a.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'nova',
    scanLink: 'https://nova.arbiscan.io/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/nova/06eb2b7add8ba443d5b219c04089c326.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/nova/b61c3a7723f39265c8b98967407e46db.png',
    eip: { '1559': true },
  },
  {
    id: 7700,
    enum: CHAINS_ENUM.CANTO,
    name: 'Canto',
    serverId: 'canto',
    hex: '0x1e14',
    network: '7700',
    nativeTokenSymbol: 'Canto',
    nativeTokenLogo:
      'https://static.debank.com/image/canto_token/logo_url/canto/47574ef619e057d2c6bbce1caba57fb6.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'canto',
    scanLink: 'https://tuber.build/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/canto/47574ef619e057d2c6bbce1caba57fb6.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/canto/29bd07f96ac7805a1b14649f356d3eee.png',
    eip: { '1559': true },
  },
  {
    id: 2000,
    enum: CHAINS_ENUM.DOGE,
    name: 'Dogechain',
    serverId: 'doge',
    hex: '0x7d0',
    network: '2000',
    nativeTokenSymbol: 'wDOGE',
    nativeTokenLogo:
      'https://static.debank.com/image/doge_token/logo_url/doge/2538141079688a7a43bc22c7b60fb45f.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'doge',
    scanLink: 'https://explorer.dogechain.dog/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/doge/2538141079688a7a43bc22c7b60fb45f.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/doge/aa18ed341ae19e5e381dfac1062fee73.png',
    eip: { '1559': false },
  },
  {
    id: 2222,
    enum: CHAINS_ENUM.KAVA,
    name: 'Kava',
    serverId: 'kava',
    hex: '0x8ae',
    network: '2222',
    nativeTokenSymbol: 'KAVA',
    nativeTokenLogo:
      'https://static.debank.com/image/kava_token/logo_url/kava/f5b7c6ffbe4d99da363a78d98e748880.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'kava',
    scanLink: 'https://kavascan.com/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/kava/b26bf85a1a817e409f9a3902e996dc21.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/kava/2e672dd7947e41a34d6cbc5995ad24b2.png',
    eip: { '1559': true },
  },
  {
    id: 1234,
    enum: CHAINS_ENUM.STEP,
    name: 'Step',
    serverId: 'step',
    hex: '0x4d2',
    network: '1234',
    nativeTokenSymbol: 'FITFI',
    nativeTokenLogo:
      'https://static.debank.com/image/step_token/logo_url/step/9d345f7e03f078657bb1ffd494442d67.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'step',
    scanLink: 'https://stepscan.io/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/step/db79600b8feafe17845617ca9c606dbe.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/step/e3250b0b574f55b1ec82434549e6f959.png',
    eip: { '1559': true },
  },
  {
    id: 2001,
    enum: CHAINS_ENUM.MADA,
    name: 'Milkomeda C1',
    serverId: 'mada',
    hex: '0x7d1',
    network: '2001',
    nativeTokenSymbol: 'milkADA',
    nativeTokenLogo:
      'https://static.debank.com/image/mada_token/logo_url/mada/cb356bfa1b48206c834e62113604567d.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'mada',
    scanLink: 'https://explorer-mainnet-cardano-evm.c1.milkomeda.com/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/mada/cdc4b1112c2c5a2757cbda33f4476b7f.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/mada/185df9833e6215d48ccfd389be59b752.png',
    eip: { '1559': false },
  },
  {
    id: 1030,
    enum: CHAINS_ENUM.CFX,
    name: 'Conflux',
    serverId: 'cfx',
    hex: '0x406',
    network: '1030',
    nativeTokenSymbol: 'CFX',
    nativeTokenLogo:
      'https://static.debank.com/image/cfx_token/logo_url/cfx/f493f92ad1087e23cf8dadab9850abb5.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'cfx',
    scanLink: 'https://evm.confluxscan.io/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/cfx/eab0c7304c6820b48b2a8d0930459b82.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/cfx/d45e5225fc8e97623c798599a2f8ce50.png',
    eip: { '1559': false },
  },
  {
    id: 32520,
    enum: CHAINS_ENUM.BRISE,
    name: 'Bitgert',
    serverId: 'brise',
    hex: '0x7f08',
    network: '32520',
    nativeTokenSymbol: 'BRISE',
    nativeTokenLogo:
      'https://static.debank.com/image/brise_token/logo_url/brise/4f6c040cf49f4d8c4eabbad7cd2f4ae4.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'brise',
    scanLink: 'https://brisescan.com/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/brise/4f6c040cf49f4d8c4eabbad7cd2f4ae4.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/brise/34c2bec8f0eaaf44929ce604c645c729.png',
    eip: { '1559': false },
  },
  {
    id: 71402,
    enum: CHAINS_ENUM.CKB,
    name: 'Godwoken',
    serverId: 'ckb',
    hex: '0x116ea',
    network: '71402',
    nativeTokenSymbol: 'CKB',
    nativeTokenLogo:
      'https://static.debank.com/image/ckb_token/logo_url/ckb/18d430b7e9b48750bad7e88513a8f2c5.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'ckb',
    scanLink: 'https://gwscan.com/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/ckb/e821893503104870d5e73f56dbd73746.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/ckb/5b7e976954a29e0ff3fc67a03d702d44.png',
    eip: { '1559': false },
  },
  {
    id: 6969,
    enum: CHAINS_ENUM.TOMB,
    name: 'TOMB Chain',
    serverId: 'tomb',
    hex: '0x1b39',
    network: '6969',
    nativeTokenSymbol: 'TOMB',
    nativeTokenLogo:
      'https://static.debank.com/image/tomb_token/logo_url/0xdeaddeaddeaddeaddeaddeaddeaddeaddead0000/eee88f95c46faa10762514b44655a6a1.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'tomb',
    scanLink: 'https://tombscout.com/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/tomb/eee88f95c46faa10762514b44655a6a1.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/tomb/287c9006bea8dc14ece64d2d4499fa2b.png',
    eip: { '1559': false },
  },
  {
    id: 324,
    enum: CHAINS_ENUM.ERA,
    name: 'zkSync Era',
    serverId: 'era',
    hex: '0x144',
    network: '324',
    nativeTokenSymbol: 'ETH',
    nativeTokenLogo:
      'https://static.debank.com/image/coin/logo_url/eth/d61441782d4a08a7479d54aea211679e.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'era',
    scanLink: 'https://era.zksync.network/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/era/2cfcd0c8436b05d811b03935f6c1d7da.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/era/ae1951502c3514d43374d7e6718bda9a.png',
    eip: { '1559': false },
  },
  {
    id: 1101,
    enum: CHAINS_ENUM.PZE,
    name: 'Polygon zkEVM',
    serverId: 'pze',
    hex: '0x44d',
    network: '1101',
    nativeTokenSymbol: 'ETH',
    nativeTokenLogo:
      'https://static.debank.com/image/pze_token/logo_url/pze/d61441782d4a08a7479d54aea211679e.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'pze',
    scanLink: 'https://zkevm.polygonscan.com/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/pze/a2276dce2d6a200c6148fb975f0eadd3.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/pze/94d0cff539cb8f18c93f11a454f894b3.png',
    eip: { '1559': false },
  },
  {
    id: 17777,
    enum: CHAINS_ENUM.EOS,
    name: 'EOS EVM',
    serverId: 'eos',
    hex: '0x4571',
    network: '17777',
    nativeTokenSymbol: 'EOS',
    nativeTokenLogo:
      'https://static.debank.com/image/eos_token/logo_url/eos/3b72a264baa8cefd45b37e0520f13e6f.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'eos',
    scanLink: 'https://explorer.evm.eosnetwork.com/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/eos/7e3122a9ce6f9d522e6d5519d43b6a72.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/eos/017f8f3d4666311422524cb5da717f2e.png',
    eip: { '1559': false },
  },
  {
    id: 1116,
    enum: CHAINS_ENUM.CORE,
    name: 'CORE',
    serverId: 'core',
    hex: '0x45c',
    network: '1116',
    nativeTokenSymbol: 'CORE',
    nativeTokenLogo:
      'https://static.debank.com/image/core_token/logo_url/core/1a7becfe112c0c9bfc25628cd70e94a6.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'core',
    scanLink: 'https://scan.coredao.org/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/core/ccc02f660e5dd410b23ca3250ae7c060.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/core/e52df8e06f7763e05e1d94cce21683a5.png',
    eip: { '1559': false },
  },
  {
    id: 1111,
    enum: CHAINS_ENUM.WEMIX,
    name: 'WEMIX',
    serverId: 'wemix',
    hex: '0x457',
    network: '1111',
    nativeTokenSymbol: 'WEMIX',
    nativeTokenLogo:
      'https://static.debank.com/image/wemix_token/logo_url/wemix/6431c197ec9f2a1d334a356b316fbb49.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'wemix',
    scanLink: 'https://explorer.wemix.com/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/wemix/d1ba88d1df6cca0b0cb359c36a09c054.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/wemix/66b877a83349d6d158796f825f5b9633.png',
    eip: { '1559': true },
  },
  {
    id: 61,
    enum: CHAINS_ENUM.ETC,
    name: 'Ethereum Classic',
    serverId: 'etc',
    hex: '0x3d',
    network: '61',
    nativeTokenSymbol: 'ETC',
    nativeTokenLogo:
      'https://static.debank.com/image/okt_token/logo_url/0x99970778e2715bbc9cf8fb83d10dcbc2d2d551a3/782943aff604f69c7889d90926348210.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'etc',
    scanLink: 'https://blockscout.com/etc/mainnet/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/etc/7ccf90ee6822ab440fb603337da256fa.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/etc/81a154d78dce2782739ac9e0d8e05f6d.png',
    eip: { '1559': false },
  },
  {
    id: 369,
    enum: CHAINS_ENUM.PULSE,
    name: 'Pulse',
    serverId: 'pls',
    hex: '0x171',
    network: '369',
    nativeTokenSymbol: 'PLS',
    nativeTokenLogo:
      'https://static.debank.com/image/pls_token/logo_url/pls/aa6be079fa9eb568e02150734ebb3db0.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'pls',
    scanLink:
      'https://scan.mypinata.cloud/ipfs/bafybeidn64pd2u525lmoipjl4nh3ooa2imd7huionjsdepdsphl5slfowy/#/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/pls/aa6be079fa9eb568e02150734ebb3db0.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/pls/7c01fc668883d77e87c9334ec7d6b6ab.png',
    eip: { '1559': true },
  },
  {
    id: 14,
    enum: CHAINS_ENUM.FLR,
    name: 'Flare',
    serverId: 'flr',
    hex: '0xe',
    network: '14',
    nativeTokenSymbol: 'FLR',
    nativeTokenLogo:
      'https://static.debank.com/image/flr_token/logo_url/flr/c7d8087092d5d7b80794630612afb32e.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'flr',
    scanLink: 'https://flare-explorer.flare.network/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/flr/9ee03d5d7036ad9024e81d55596bb4dc.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/flr/ad866bf4323576b66651c9e2bbfd8a80.png',
    eip: { '1559': false },
  },
  {
    id: 32659,
    enum: CHAINS_ENUM.FSN,
    name: 'Fusion',
    serverId: 'fsn',
    hex: '0x7f93',
    network: '32659',
    nativeTokenSymbol: 'FSN',
    nativeTokenLogo:
      'https://static.debank.com/image/fsn_token/logo_url/fsn/047789979f0b5733602b29517753bdf3.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'fsn',
    scanLink: 'https://fsnscan.com/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/fsn/047789979f0b5733602b29517753bdf3.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/fsn/dfb374f7abf97b869ccf42bbf697feae.png',
    eip: { '1559': false },
  },
  {
    id: 82,
    enum: CHAINS_ENUM.METER,
    name: 'Meter',
    serverId: 'mtr',
    hex: '0x52',
    network: '82',
    nativeTokenSymbol: 'MTR',
    nativeTokenLogo:
      'https://static.debank.com/image/mtr_token/logo_url/mtr/920c6f4fdcb408703b435a97b963200b.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'mtr',
    scanLink: 'https://scan.meter.io/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/mtr/2dc6f079f52ca22778eb684e1ce650b3.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/mtr/0eafbdc8de9656a9de0f28efa2070450.png',
    eip: { '1559': false },
  },
  {
    id: 42262,
    enum: CHAINS_ENUM.ROSE,
    name: 'Oasis Emerald',
    serverId: 'rose',
    hex: '0xa516',
    network: '42262',
    nativeTokenSymbol: 'ROSE',
    nativeTokenLogo:
      'https://static.debank.com/image/rose_token/logo_url/rose/33ade55b0f3efa10e9eec002c6417257.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'rose',
    scanLink: 'https://explorer.emerald.oasis.dev/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/rose/33ade55b0f3efa10e9eec002c6417257.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/rose/2e2351720f1772e3b3c7c2891f3d0192.png',
    eip: { '1559': true },
  },
  {
    id: 248,
    enum: CHAINS_ENUM.OAS,
    name: 'Oasys',
    serverId: 'oas',
    hex: '0xf8',
    network: '248',
    nativeTokenSymbol: 'OAS',
    nativeTokenLogo:
      'https://static.debank.com/image/oas_token/logo_url/oas/322b2cb0935af95b9cabd8a59b629566.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'oas',
    scanLink: 'https://scan.oasys.games/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/oas/61dfecab1ba8a404354ce94b5a54d4b3.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/oas/95888aa80c9eb4dbde714c69b3cc7425.png',
    eip: { '1559': true },
  },
  {
    id: 7777777,
    enum: CHAINS_ENUM.ZORA,
    name: 'Zora',
    serverId: 'zora',
    hex: '0x76adf1',
    network: '7777777',
    nativeTokenSymbol: 'ETH',
    nativeTokenLogo:
      'https://static.debank.com/image/coin/logo_url/eth/d61441782d4a08a7479d54aea211679e.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'zora',
    scanLink: 'https://explorer.zora.energy/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/zora/de39f62c4489a2359d5e1198a8e02ef1.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/zora/25dfb04c552c35d3d8e30e5ba136b9e6.png',
    eip: { '1559': false },
  },
  {
    id: 8453,
    enum: CHAINS_ENUM.BASE,
    name: 'Base',
    serverId: 'base',
    hex: '0x2105',
    network: '8453',
    nativeTokenSymbol: 'ETH',
    nativeTokenLogo:
      'https://static.debank.com/image/coin/logo_url/eth/d61441782d4a08a7479d54aea211679e.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'base',
    scanLink: 'https://www.basescan.org/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/base/ccc1513e4f390542c4fb2f4b88ce9579.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/base/025de9d02848e257740c14bdd1f9330b.png',
    eip: { '1559': false },
  },
  {
    id: 59144,
    enum: CHAINS_ENUM.LINEA,
    name: 'Linea',
    serverId: 'linea',
    hex: '0xe708',
    network: '59144',
    nativeTokenSymbol: 'ETH',
    nativeTokenLogo:
      'https://static.debank.com/image/coin/logo_url/eth/d61441782d4a08a7479d54aea211679e.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'linea',
    scanLink: 'https://lineascan.build/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/linea/32d4ff2cf92c766ace975559c232179c.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/linea/adee1a93003ab543957692844fdaf9f2.png',
    eip: { '1559': false },
  },
  {
    id: 5000,
    enum: CHAINS_ENUM.MANTLE,
    name: 'Mantle',
    serverId: 'mnt',
    hex: '0x1388',
    network: '5000',
    nativeTokenSymbol: 'MNT',
    nativeTokenLogo:
      'https://static.debank.com/image/eth_token/logo_url/0x3c3a81e81dc49a522a592e7622a7e711c06bf354/a443c78c33704d48f06e5686bb87f85e.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'mnt',
    scanLink: 'https://explorer.mantle.xyz/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/mnt/0af11a52431d60ded59655c7ca7e1475.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/mnt/f642653f191f4fd59cbf9efefc4c007d.png',
    eip: { '1559': true },
  },
  {
    id: 1559,
    enum: CHAINS_ENUM.TENET,
    name: 'Tenet',
    serverId: 'tenet',
    hex: '0x617',
    network: '1559',
    nativeTokenSymbol: 'TENET',
    nativeTokenLogo:
      'https://static.debank.com/image/tenet_token/logo_url/tenet/2da9b626102a7de9625aaf753cfac321.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'tenet',
    scanLink: 'https://tenetscan.io/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/tenet/803be22e467ee9a5abe00d69a9c3ea4f.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/tenet/651386abf4fa22f64613faf8dc5187f1.png',
    eip: { '1559': false },
  },
  {
    id: 42,
    enum: CHAINS_ENUM.LYX,
    name: 'LUKSO',
    serverId: 'lyx',
    hex: '0x2a',
    network: '42',
    nativeTokenSymbol: 'LYX',
    nativeTokenLogo:
      'https://static.debank.com/image/eth_token/logo_url/0xa8b919680258d369114910511cc87595aec0be6d/78a30c7b781e3889548d5920c09133dc.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'lyx',
    scanLink: 'https://explorer.execution.mainnet.lukso.network/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/lyx/dbe6eef57e66817e61297d9b188248ed.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/lyx/83230c4279ab2813907de034d87ab319.png',
    eip: { '1559': true },
  },
  {
    id: 169,
    enum: CHAINS_ENUM.MANTA,
    name: 'Manta Pacific',
    serverId: 'manta',
    hex: '0xa9',
    network: '169',
    nativeTokenSymbol: 'ETH',
    nativeTokenLogo:
      'https://static.debank.com/image/manta_token/logo_url/manta/389dd9a835250219889e01d5a31a75f1.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'manta',
    scanLink: 'https://pacific-explorer.manta.network/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/manta/0e25a60b96a29d6a5b9e524be7565845.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/manta/ead2552c140ffd5482e7222964bac558.png',
    eip: { '1559': true },
  },
  {
    id: 534352,
    enum: CHAINS_ENUM.SCRL,
    name: 'Scroll',
    serverId: 'scrl',
    hex: '0x82750',
    network: '534352',
    nativeTokenSymbol: 'ETH',
    nativeTokenLogo:
      'https://static.debank.com/image/scrl_token/logo_url/scrl/389dd9a835250219889e01d5a31a75f1.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'scrl',
    scanLink: 'https://scrollscan.com/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/scrl/1fa5c7e0bfd353ed0a97c1476c9c42d2.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/scrl/dd0d05b6fba614d57b55f0724acd723c.png',
    eip: { '1559': false },
  },
  {
    id: 204,
    enum: CHAINS_ENUM.OPBNB,
    name: 'opBNB',
    serverId: 'opbnb',
    hex: '0xcc',
    network: '204',
    nativeTokenSymbol: 'BNB',
    nativeTokenLogo:
      'https://static.debank.com/image/coin/logo_url/bnb/9784283a36f23a58982fc964574ea530.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'opbnb',
    scanLink: 'https://mainnet.opbnbscan.com/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/opbnb/07e2e686e363a842d0982493638e1285.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/opbnb/8e44e643d6e2fd335a72b4cda6368e1a.png',
    eip: { '1559': false },
  },
  {
    id: 5151706,
    enum: CHAINS_ENUM.LOOT,
    name: 'Loot',
    serverId: 'loot',
    hex: '0x4e9bda',
    network: '5151706',
    nativeTokenSymbol: 'AGLD',
    nativeTokenLogo:
      'https://static.debank.com/image/loot_token/logo_url/loot/a6c0dc128d515e2d32526075decae9ec.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'loot',
    scanLink: 'https://explorer.lootchain.com/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/loot/0f098333a1a4f474115b05862e680573.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/loot/af8f162614f388e896872f628f3e3e6e.png',
    eip: { '1559': false },
  },
  {
    id: 109,
    enum: CHAINS_ENUM.SHIB,
    name: 'Shibarium',
    serverId: 'shib',
    hex: '0x6d',
    network: '109',
    nativeTokenSymbol: 'BONE',
    nativeTokenLogo:
      'https://static.debank.com/image/shib_token/logo_url/shib/e49e9a98f5fb1fb04ad96bb536457df9.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'shib',
    scanLink: 'https://shibariumscan.io/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/shib/4ec79ed9ee4988dfdfc41e1634a447be.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/shib/574d888cbdce3a08ea8a5f636fc2ae3e.png',
    eip: { '1559': true },
  },
  {
    id: 530,
    enum: CHAINS_ENUM.FX,
    name: 'Function X',
    serverId: 'fx',
    hex: '0x212',
    network: '530',
    nativeTokenSymbol: 'FX',
    nativeTokenLogo:
      'https://static.debank.com/image/fx_token/logo_url/fx/6fee82420b2394e0b68d7d7e692a0a01.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'fx',
    scanLink: 'https://starscan.io/evm/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/fx/6fee82420b2394e0b68d7d7e692a0a01.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/fx/528e10d16f64db1798bca33092526d96.png',
    eip: { '1559': true },
  },
  {
    id: 34443,
    enum: CHAINS_ENUM.MODE,
    name: 'Mode',
    serverId: 'mode',
    hex: '0x868b',
    network: '34443',
    nativeTokenSymbol: 'ETH',
    nativeTokenLogo:
      'https://static.debank.com/image/mode_token/logo_url/mode/d61441782d4a08a7479d54aea211679e.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'mode',
    scanLink: 'https://explorer.mode.network/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/mode/466e6e12f4fd827f8f497cceb0601a5e.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/mode/f7033404c6d09fafcbe53cbf806a585f.png',
    eip: { '1559': true },
  },
  {
    id: 4337,
    enum: CHAINS_ENUM.BEAM,
    name: 'Beam',
    serverId: 'beam',
    hex: '0x10f1',
    network: '4337',
    nativeTokenSymbol: 'BEAM',
    nativeTokenLogo:
      'https://static.debank.com/image/beam_token/logo_url/beam/90a1e9f46664d070752deeb65878a3bd.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'beam',
    scanLink: 'https://subnets.avax.network/beam/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/beam/90a1e9f46664d070752deeb65878a3bd.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/beam/f54a6974e60b63c5f328721ad0281f1b.png',
    eip: { '1559': true },
  },
  {
    id: 20201022,
    enum: CHAINS_ENUM.PEGO,
    name: 'Pego',
    serverId: 'pego',
    hex: '0x1343e3e',
    network: '20201022',
    nativeTokenSymbol: 'PG',
    nativeTokenLogo:
      'https://static.debank.com/image/pego_token/logo_url/pego/6b81cf47fdc1b86707d3fbf02f90cf18.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'pego',
    scanLink: 'https://scan.pego.network/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/pego/6b81cf47fdc1b86707d3fbf02f90cf18.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/pego/ee47a1dcfc1b990090e1894221496c8f.png',
    eip: { '1559': true },
  },
  {
    id: 201022,
    enum: CHAINS_ENUM.FON,
    name: 'FON Chain',
    serverId: 'fon',
    hex: '0x3113e',
    network: '201022',
    nativeTokenSymbol: 'FON',
    nativeTokenLogo:
      'https://static.debank.com/image/fon_token/logo_url/fon/369618f4d45053fa4439943c9c2d387d.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'fon',
    scanLink: 'https://fonscan.io/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/fon/369618f4d45053fa4439943c9c2d387d.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/fon/6c5ee096ec2173f9250d58b4384343aa.png',
    eip: { '1559': false },
  },
  {
    id: 42766,
    enum: CHAINS_ENUM.ZKFAIR,
    name: 'ZKFair',
    serverId: 'zkfair',
    hex: '0xa70e',
    network: '42766',
    nativeTokenSymbol: 'USDC',
    nativeTokenLogo:
      'https://static.debank.com/image/zkfair_token/logo_url/zkfair/35ab0987153a8355a454223aae371ac7.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'zkfair',
    scanLink: 'https://scan.zkfair.io/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/zkfair/c66f35d57c6146cdff82dfeb316ba801.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/zkfair/4133904f2769ebcffa48177c0b7831a6.png',
    eip: { '1559': false },
  },
  {
    id: 432204,
    enum: CHAINS_ENUM.ALOT,
    name: 'Dexalot',
    serverId: 'alot',
    hex: '0x6984c',
    network: '432204',
    nativeTokenSymbol: 'ALOT',
    nativeTokenLogo:
      'https://static.debank.com/image/alot_token/logo_url/alot/a03e5e8bc56a8bcd5f5c7b830e8b5877.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'alot',
    scanLink: 'https://subnets.avax.network/dexalot/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/alot/0ed4884da27d022dbd5ed5bc919ee248.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/alot/8ed0cbf9842daef43fbb32558d4f4309.png',
    eip: { '1559': true },
  },
  {
    id: 3068,
    enum: CHAINS_ENUM.BFC,
    name: 'Bifrost',
    serverId: 'bfc',
    hex: '0xbfc',
    network: '3068',
    nativeTokenSymbol: 'BFC',
    nativeTokenLogo:
      'https://static.debank.com/image/bfc_token/logo_url/bfc/f0c01b58f084660f8c8ff43f5c85301c.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'bfc',
    scanLink: 'https://explorer.mainnet.bifrostnetwork.com/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/bfc/7c10f5191b16d0cc068cb6eff32b6347.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/bfc/728682dd1707271a7b268fac3594e94e.png',
    eip: { '1559': true },
  },
  {
    id: 660279,
    enum: CHAINS_ENUM.XAI,
    name: 'Xai',
    serverId: 'xai',
    hex: '0xa1337',
    network: '660279',
    nativeTokenSymbol: 'XAI',
    nativeTokenLogo:
      'https://static.debank.com/image/xai_token/logo_url/xai/022ab00135c182f6e67e583ecda93863.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'xai',
    scanLink: 'https://explorer.xai-chain.net/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/xai/b02622ce65251bdcb31aa6621a10a096.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/xai/9eb29c6f965e70ed84e50f8e9e577b1e.png',
    eip: { '1559': true },
  },
  {
    id: 1992,
    enum: CHAINS_ENUM.HUBBLE,
    name: 'Hubble',
    serverId: 'hubble',
    hex: '0x7c8',
    network: '1992',
    nativeTokenSymbol: 'USDC',
    nativeTokenLogo:
      'https://static.debank.com/image/hubble_token/logo_url/hubble/35ab0987153a8355a454223aae371ac7.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'hubble',
    scanLink: 'https://explorer.hubble.exchange/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/hubble/dc3b830260f712058db0d70bc073dfda.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/hubble/5af24266877401ea8d086ccb08155c4e.png',
    eip: { '1559': true },
  },
  {
    id: 7000,
    enum: CHAINS_ENUM.ZETA,
    name: 'ZetaChain',
    serverId: 'zeta',
    hex: '0x1b58',
    network: '7000',
    nativeTokenSymbol: 'ZETA',
    nativeTokenLogo:
      'https://static.debank.com/image/zeta_token/logo_url/zeta/d0e1b5e519d99c452a30e83a1263d1d0.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'zeta',
    scanLink: 'https://zetachain.blockscout.com/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/zeta/d0e1b5e519d99c452a30e83a1263d1d0.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/zeta/fb4ab4eb798244887bfd65455bd42d6b.png',
    eip: { '1559': true },
  },
  {
    id: 1380012617,
    enum: CHAINS_ENUM.RARI,
    name: 'RARI',
    serverId: 'rari',
    hex: '0x52415249',
    network: '1380012617',
    nativeTokenSymbol: 'ETH',
    nativeTokenLogo:
      'https://static.debank.com/image/rari_token/logo_url/rari/d61441782d4a08a7479d54aea211679e.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'rari',
    scanLink: 'https://mainnet.explorer.rarichain.org/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/rari/67fc6abba5cfc6bb3a57bb6afcf5afee.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/rari/73456a9386ce19d00584fec493206005.png',
    eip: { '1559': true },
  },
  {
    id: 1100,
    enum: CHAINS_ENUM.DYM,
    name: 'Dymension',
    serverId: 'dym',
    hex: '0x44c',
    network: '1100',
    nativeTokenSymbol: 'DYM',
    nativeTokenLogo:
      'https://static.debank.com/image/dym_token/logo_url/dym/ab62b0f446408c84a2e17d9178a4e8e9.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'dym',
    scanLink: 'https://dym.fyi/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/dym/ab62b0f446408c84a2e17d9178a4e8e9.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/dym/0a9e4481802f4c0aae6a5a97605809d8.png',
    eip: { '1559': true },
  },
  {
    id: 4200,
    enum: CHAINS_ENUM.MERLIN,
    name: 'Merlin',
    serverId: 'merlin',
    hex: '0x1068',
    network: '4200',
    nativeTokenSymbol: 'BTC',
    nativeTokenLogo:
      'https://static.debank.com/image/merlin_token/logo_url/merlin/fe230e468272b84aba78d08bb4140456.png',
    nativeTokenDecimals: 18,
    nativeTokenAddress: 'merlin',
    scanLink: 'https://scan.merlinchain.io/tx/_s_',
    logo: 'https://static.debank.com/image/chain/logo_url/merlin/458e4686dfb909ba871bd96fe45417a8.png',
    whiteLogo:
      'https://static.debank.com/image/chain/white_logo_url/merlin/72e28432e865c544c1045017892187bc.png',
    eip: { '1559': false },
  },
];

export const CHAINS_LIST = getChainsFromStorage() || DEFAULT_CHAIN_LIST;

export const CHAINS = keyBy(CHAINS_LIST, 'enum');

export const MAINNET_CHAINS_LIST = CHAINS_LIST.filter(
  chain => !chain.isTestnet,
);
export const TESTNET_CHAINS_LIST = CHAINS_LIST.filter(chain => chain.isTestnet);

export const CHAINS_BY_NET = {
  mainnet: MAINNET_CHAINS_LIST,
  testnet: TESTNET_CHAINS_LIST,
};

interface PortfolioChain extends Chain {
  isSupportHistory: boolean;
}

// chainid 如果有值, 资产页面会发起请求
export const CHAIN_ID_LIST = new Map<string, PortfolioChain>(
  Object.values(CHAINS).map(chain => {
    return [chain.serverId, { ...chain, isSupportHistory: false }];
  }),
);

export const syncChainList = async () => {
  try {
    const chains = await openapi.getSupportedChains();
    const chainServerIdDict = keyBy(COMMON_CHAINS_LIST, 'serverId');
    const list: Chain[] = chains
      .filter(item => !item.is_disabled)
      .map(item => {
        const chain: Chain = {
          id: item.community_id,
          enum: chainServerIdDict[item.id]?.enum || item.id.toUpperCase(),
          name: item.name,
          serverId: item.id,
          hex: intToHex(item.community_id),
          network: item.community_id + '',
          nativeTokenSymbol: item.native_token?.symbol,
          nativeTokenLogo: item.native_token?.logo,
          nativeTokenDecimals: item.native_token?.decimals,
          nativeTokenAddress: item.native_token?.id,
          scanLink: `${item.explorer_host}/${
            item.id === 'heco' ? 'transaction' : 'tx'
          }/_s_`,
          logo: item.logo_url,
          whiteLogo: item.white_logo_url,
          eip: {
            '1559': item.eip_1559,
          },
        };
        CHAIN_ID_LIST.set(chain.serverId, {
          ...chain,
          isSupportHistory: false,
        });
        return chain;
      });
    replaceArray(CHAINS_LIST, list);
    replaceObject(CHAINS, keyBy(CHAINS_LIST, 'enum'));
    replaceArray(
      MAINNET_CHAINS_LIST,
      CHAINS_LIST.filter(chain => !chain.isTestnet),
    );
    replaceArray(
      TESTNET_CHAINS_LIST,
      CHAINS_LIST.filter(chain => chain.isTestnet),
    );
    storage.set('chains', JSON.stringify(list));
  } catch (e) {
    console.error('fetch chain list error: ', e);
  }
};

const replaceObject = (target: object, source: object) => {
  const keys = Object.keys(target);
  keys.forEach(key => delete target[key]);
  Object.assign(target, source);
};

const replaceArray = <V extends any>(target: V[], source: V[]) => {
  target.length = 0;
  source.forEach(item => {
    target.push(item);
  });
};
