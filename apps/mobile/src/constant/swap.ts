import { DEX_ENUM, DEX_SUPPORT_CHAINS } from '@rabby-wallet/rabby-swap';

import { CHAINS, CHAINS_ENUM } from '@debank/common';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';

const LogoParaswap = require('@/assets/icons/swap/paraswap.png');
const Logo0X = require('@/assets/icons/swap/0xswap.png');
const Logo1inch = require('@/assets/icons/swap/1inch.png');

const LogoOpenOcean = require('@/assets/icons/swap/openocean.png');
const LogoBinance = require('@/assets/icons/swap/binance.png');
const LogoCoinbase = require('@/assets/icons/swap/coinbase.png');
const LogoOkx = require('@/assets/icons/swap/okx.png');
const LogoKyberSwap = require('@/assets/icons/swap/kyberswap.png');

const LogoTokenDefault = require('@/assets/icons/swap/token-default.svg');

export const SWAP_FEE_ADDRESS = '0x39041F1B366fE33F9A5a79dE5120F2Aee2577ebc';

export const ETH_USDT_CONTRACT = '0xdac17f958d2ee523a2206206994597c13d831ec7';

export const DEX = {
  // [DEX_ENUM.UNISWAP]: {
  //   id: DEX_ENUM.UNISWAP,
  //   logo: LogoUniswap,
  //   name: 'Uniswap',
  //   chains: DEX_SUPPORT_CHAINS[DEX_ENUM.UNISWAP],
  // },
  [DEX_ENUM.ONEINCH]: {
    id: DEX_ENUM.ONEINCH,
    logo: Logo1inch,
    name: '1inch',
    chains: DEX_SUPPORT_CHAINS[DEX_ENUM.ONEINCH],
  },
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
};

export const CEX = {
  binance: {
    id: 'binance',
    name: 'Binance',
    logo: LogoBinance,
  },
  coinbase: {
    id: 'coinbase',
    name: 'Coinbase',
    logo: LogoCoinbase,
  },
  okex: {
    id: 'okex',
    name: 'OKX',
    logo: LogoOkx,
  },
};

export const DEX_WITH_WRAP = {
  ...DEX,
  [DEX_ENUM.WRAPTOKEN]: {
    logo: LogoTokenDefault,
    name: 'Wrap Contract',
    chains: DEX_SUPPORT_CHAINS.WrapToken,
  },
};

export const getChainDefaultToken = (chain: CHAINS_ENUM) => {
  const chainInfo = CHAINS[chain];
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
