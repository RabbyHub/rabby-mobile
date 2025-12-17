import { DEX_ENUM, DEX_SUPPORT_CHAINS } from '@rabby-wallet/rabby-swap';

import { CHAINS, CHAINS_ENUM } from '@debank/common';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { findChainByEnum } from '@/utils/chain';

const LogoParaswap = require('@/assets/icons/swap/paraswap.png');
const Logo0X = require('@/assets/icons/swap/0xswap.png');
const Logo1inch = require('@/assets/icons/swap/1inch.jpg');

const LogoOpenOcean = require('@/assets/icons/swap/openocean.png');
const LogoBinance = require('@/assets/icons/swap/binance.png');
const LogoCoinbase = require('@/assets/icons/swap/coinbase.png');
const LogoOkx = require('@/assets/icons/swap/okx.png');
const LogoKyberSwap = require('@/assets/icons/swap/kyberswap.png');
const LogoOdos = require('@/assets/icons/swap/odos.png');
const LogoMagpie = require('@/assets/icons/swap/magpie.jpg');

const LogoTokenDefault = require('@/assets/icons/swap/token-default.svg');

export const SWAP_FEE_ADDRESS = '0x39041F1B366fE33F9A5a79dE5120F2Aee2577ebc';

export const ETH_USDT_CONTRACT = '0xdac17f958d2ee523a2206206994597c13d831ec7';

export const DEX = {
  [DEX_ENUM.ZEROXAPI]: {
    id: DEX_ENUM.ZEROXAPI,
    logo: Logo0X,
    name: '0x',
    chains: DEX_SUPPORT_CHAINS[DEX_ENUM.ZEROXAPI],
  },
  [DEX_ENUM.PARASWAP]: {
    id: DEX_ENUM.PARASWAP,
    logo: LogoParaswap,
    name: 'ParaSwap',
    chains: DEX_SUPPORT_CHAINS[DEX_ENUM.PARASWAP],
  },
  [DEX_ENUM.ONEINCH]: {
    id: DEX_ENUM.ONEINCH,
    logo: Logo1inch,
    name: '1inch',
    chains: DEX_SUPPORT_CHAINS[DEX_ENUM.ONEINCH],
  },
  [DEX_ENUM.OPENOCEAN]: {
    id: DEX_ENUM.OPENOCEAN,
    logo: LogoOpenOcean,
    name: 'OpenOcean',
    chains: DEX_SUPPORT_CHAINS[DEX_ENUM.OPENOCEAN],
  },
  [DEX_ENUM.KYBERSWAP]: {
    id: DEX_ENUM.KYBERSWAP,
    logo: LogoKyberSwap,
    name: 'KyberSwap',
    chains: DEX_SUPPORT_CHAINS[DEX_ENUM.KYBERSWAP],
  },
  [DEX_ENUM.PARASWAPV6]: {
    id: DEX_ENUM.PARASWAPV6,
    logo: LogoParaswap,
    name: 'ParaSwap',
    chains: DEX_SUPPORT_CHAINS[DEX_ENUM.PARASWAPV6],
  },
  [DEX_ENUM.ODOS]: {
    id: DEX_ENUM.ODOS,
    logo: LogoOdos,
    name: 'Odos',
    chains: DEX_SUPPORT_CHAINS[DEX_ENUM.ODOS],
  },
  [DEX_ENUM.ZEROXAPIV2]: {
    id: DEX_ENUM.ZEROXAPIV2,
    logo: Logo0X,
    name: '0x',
    chains: DEX_SUPPORT_CHAINS[DEX_ENUM.ZEROXAPIV2],
  },
  [DEX_ENUM.MAGPIE]: {
    id: DEX_ENUM.MAGPIE,
    logo: LogoMagpie,
    name: 'Fly',
    chains: DEX_SUPPORT_CHAINS[DEX_ENUM.MAGPIE],
  },
};

export const CEX = {};

export const DEX_WITH_WRAP = {
  ...DEX,
  [DEX_ENUM.WRAPTOKEN]: {
    logo: LogoTokenDefault,
    name: 'Wrap Contract',
    chains: DEX_SUPPORT_CHAINS.WrapToken,
  },
};

export const getChainDefaultToken = (chain: CHAINS_ENUM) => {
  const chainInfo = findChainByEnum(chain) || CHAINS[chain];
  return {
    id: chainInfo.nativeTokenAddress,
    decimals: chainInfo.nativeTokenDecimals,
    logo_url: chainInfo.nativeTokenLogo,
    symbol: chainInfo.nativeTokenSymbol,
    display_symbol: chainInfo.nativeTokenSymbol,
    optimized_symbol: chainInfo.nativeTokenSymbol,
    is_core: true,
    is_verified: true,
    is_wallet: true,
    amount: 0,
    price: 0,
    name: chainInfo.nativeTokenSymbol,
    chain: chainInfo.serverId,
    time_at: 0,
  } as TokenItem;
};

export const defaultGasFee = {
  base_fee: 0,
  level: 'normal',
  front_tx_count: 0,
  price: 0,
  estimated_seconds: 0,
};

export const SWAP_SUPPORT_CHAINS = Array.from(
  new Set(Object.values(DEX_SUPPORT_CHAINS).flat()),
);

/**
 *
 * USDT：
ETH: 0xdac17f958d2ee523a2206206994597c13d831ec7
AVAX: 0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7
Celo: 0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e
 USDC：
ARB: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831
AVAX: 0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E
Base: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
Celo: 0xcebA9300f2b948710d2653dD7B07f33A8B32118C
ETH: 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
OP: 0x0b2c639c533813f4aa9d7837caf62653d097ff85
Polygon: 0x3c499c542cef5e3811e1192ce70d8cc03d5c3359
zksync: 0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4
unichain: 0x078D782b760474a361dDA0AF3839290b0EF57AD6
 DAI：
ETH: 0x6b175474e89094c44da98b954eedeac495271d0f
 */

const stableCoinList = ['usdt', 'usdc', 'dai'] as const;

export type StableCoin = (typeof stableCoinList)[number];

type StableCoinMapT = Record<StableCoin, Partial<Record<CHAINS_ENUM, string>>>;

type StablecoinAggregatedByChainT = Partial<
  Record<CHAINS_ENUM, Partial<Record<StableCoin, string>>>
>;

const stablecoinAddressMap: StableCoinMapT = {
  usdt: {
    [CHAINS_ENUM.ETH]: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    [CHAINS_ENUM.AVAX]: '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7',
    [CHAINS_ENUM.CELO]: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e',
  },
  usdc: {
    [CHAINS_ENUM.ARBITRUM]: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    [CHAINS_ENUM.AVAX]: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    [CHAINS_ENUM.BASE]: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    [CHAINS_ENUM.CELO]: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
    [CHAINS_ENUM.ETH]: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    [CHAINS_ENUM.OP]: '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
    [CHAINS_ENUM.POLYGON]: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
    [CHAINS_ENUM.ERA]: '0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4',
    ['UNI' as CHAINS_ENUM]: '0x078D782b760474a361dDA0AF3839290b0EF57AD6',
  },
  dai: {
    [CHAINS_ENUM.ETH]: '0x6b175474e89094c44da98b954eedeac495271d0f',
  },
};

function aggregateAddresses(addresses: StableCoinMapT) {
  const result: StablecoinAggregatedByChainT = {};

  for (const [token, chains] of Object.entries(addresses) as [
    StableCoin,
    Record<CHAINS_ENUM, string>,
  ][]) {
    for (const [chain, address] of Object.entries(chains)) {
      if (!result[chain]) {
        result[chain] = {};
      }
      result[chain][token] = address;
    }
  }

  return result;
}

export const StablecoinMapAggregatedByChain =
  aggregateAddresses(stablecoinAddressMap);
