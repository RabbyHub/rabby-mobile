import {
  SWAP_REQUIRED_QUOTE_ASSETS,
  type PerpsQuoteAsset,
} from '@/constant/perps';

import type { PerpsAccountMode } from './account';

export type PerpsProTradeAddFundsAction = Readonly<{
  mode: 'deposit' | 'swap';
  targetAsset: PerpsQuoteAsset;
}>;

export const resolvePerpsProTradeAddFundsAction = ({
  accountMode,
  quoteAsset,
}: {
  accountMode: PerpsAccountMode;
  quoteAsset: PerpsQuoteAsset;
}): PerpsProTradeAddFundsAction =>
  accountMode !== 'standard' && SWAP_REQUIRED_QUOTE_ASSETS.includes(quoteAsset)
    ? { mode: 'swap', targetAsset: quoteAsset }
    : { mode: 'deposit', targetAsset: 'USDC' };
