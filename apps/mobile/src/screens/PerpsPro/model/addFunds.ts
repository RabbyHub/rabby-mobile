import type { PerpsQuoteAsset } from '@/constant/perps';

export type PerpsProTradeAddFundsAction = Readonly<{
  isReady: boolean;
  mode: 'deposit' | 'swap';
  targetAsset: PerpsQuoteAsset;
}>;

export const resolvePerpsProTradeAddFundsAction = ({
  fundingAccountValue,
  fundingAccountValueReady,
  quoteAsset,
}: {
  fundingAccountValue: number | string | null | undefined;
  fundingAccountValueReady: boolean;
  quoteAsset: PerpsQuoteAsset;
}): PerpsProTradeAddFundsAction => {
  if (quoteAsset === 'USDC') {
    return {
      isReady: fundingAccountValueReady,
      mode: 'deposit',
      targetAsset: 'USDC',
    };
  }

  if (!fundingAccountValueReady) {
    return {
      isReady: false,
      mode: 'swap',
      targetAsset: quoteAsset,
    };
  }

  const numericAccountValue =
    fundingAccountValue == null || fundingAccountValue === ''
      ? Number.NaN
      : Number(fundingAccountValue);
  return Number.isFinite(numericAccountValue) && numericAccountValue > 0
    ? { isReady: true, mode: 'swap', targetAsset: quoteAsset }
    : { isReady: true, mode: 'deposit', targetAsset: 'USDC' };
};
