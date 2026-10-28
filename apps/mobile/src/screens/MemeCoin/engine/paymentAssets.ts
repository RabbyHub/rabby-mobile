import { MAINSTREAM_STABLE_SYMBOLS } from './constants';
import { compareText, tokenKey } from './keys';
import type { ChainServerId, PaymentAsset } from './types';

export type WalletToken = {
  id: string;
  chain: ChainServerId;
  symbol: string;
  price: number;
  usdValue: number;
  isNative: boolean;
};

export type BuildPaymentAssetListParams = {
  tokens: WalletToken[];
  /** tokenKey() of every meme the wallet holds plus the memes being bought */
  memeTokenKeys: ReadonlySet<string>;
  memeChains: ReadonlySet<ChainServerId>;
  swapSupportedChains: ReadonlySet<ChainServerId>;
  bridgeSupportedChains: ReadonlySet<ChainServerId>;
};

export const isMainstreamToken = (token: {
  symbol: string;
  isNative: boolean;
}) =>
  token.isNative ||
  MAINSTREAM_STABLE_SYMBOLS.includes(token.symbol.toUpperCase());

const canProduceLeg = (
  chain: ChainServerId,
  params: BuildPaymentAssetListParams,
) =>
  (params.memeChains.has(chain) && params.swapSupportedChains.has(chain)) ||
  params.bridgeSupportedChains.has(chain);

export const buildPaymentAssetList = (
  params: BuildPaymentAssetListParams,
): PaymentAsset[] => {
  const sameChainRank = (asset: PaymentAsset) =>
    params.memeChains.has(asset.chain) ? 0 : 1;

  return params.tokens
    .filter(token => !params.memeTokenKeys.has(tokenKey(token)))
    .filter(token => token.price > 0)
    .filter(token => canProduceLeg(token.chain, params))
    .map(token => ({
      id: token.id,
      chain: token.chain,
      symbol: token.symbol,
      usdValue: token.usdValue,
      price: token.price,
      isNative: token.isNative,
      isMainstream: isMainstreamToken(token),
    }))
    .sort(
      (a, b) =>
        sameChainRank(a) - sameChainRank(b) ||
        b.usdValue - a.usdValue ||
        compareText(a.chain, b.chain) ||
        compareText(a.symbol, b.symbol),
    );
};
