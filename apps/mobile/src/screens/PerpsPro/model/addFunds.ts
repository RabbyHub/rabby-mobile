import {
  SWAP_REQUIRED_QUOTE_ASSETS,
  type PerpsQuoteAsset,
} from '@/constant/perps';

export type PerpsProTradeAddFundsAction = Readonly<{
  mode: 'deposit' | 'swap';
  targetAsset: PerpsQuoteAsset;
}>;

export const resolvePerpsProTradeAddFundsAction = ({
  quoteAsset,
}: {
  quoteAsset: PerpsQuoteAsset;
}): PerpsProTradeAddFundsAction =>
  SWAP_REQUIRED_QUOTE_ASSETS.includes(quoteAsset)
    ? { mode: 'swap', targetAsset: quoteAsset }
    : { mode: 'deposit', targetAsset: 'USDC' };
