import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';

import type { QuoteProvider, TDexQuoteData } from './quote';

export const EARLY_QUOTE_DISPLAY_MIN_TO_FROM_USD_RATIO = 0.03;

export const getSwapQuoteScore = ({
  quote,
  receiveToken,
  inSufficient,
  sortIncludeGasFee = true,
}: {
  quote: TDexQuoteData;
  receiveToken: TokenItem;
  inSufficient: boolean;
  sortIncludeGasFee?: boolean;
}) => {
  if (
    quote.loading ||
    !quote.data?.toTokenAmount ||
    !quote.preExecResult?.isSdkPass
  ) {
    return null;
  }

  const receiveTokenAmount = new BigNumber(quote.data.toTokenAmount).div(
    10 ** (quote.data.toTokenDecimals || receiveToken.decimals),
  );

  if (inSufficient || !receiveToken.price || !sortIncludeGasFee) {
    return receiveTokenAmount;
  }

  return receiveTokenAmount
    .times(receiveToken.price)
    .minus(quote.preExecResult.gasUsdValue || 0);
};

export const getSwapProviderScore = ({
  provider,
  receiveToken,
  inSufficient,
}: {
  provider: QuoteProvider;
  receiveToken: TokenItem;
  inSufficient: boolean;
}) => {
  if (!provider.quote?.toTokenAmount || !provider.preExecResult?.isSdkPass) {
    return null;
  }

  const receiveTokenAmount = new BigNumber(provider.quote.toTokenAmount).div(
    10 ** (provider.quote.toTokenDecimals || receiveToken.decimals),
  );

  if (inSufficient || !receiveToken.price) {
    return receiveTokenAmount;
  }

  return receiveTokenAmount
    .times(receiveToken.price)
    .minus(provider.preExecResult.gasUsdValue || 0);
};

const getTokenUsdValue = ({
  token,
  amount,
}: {
  token?: TokenItem;
  amount: string;
}) => new BigNumber(amount || 0).times(token?.price || 0);

const getSwapQuoteToTokenUsdValue = ({
  quote,
  receiveToken,
}: {
  quote: TDexQuoteData;
  receiveToken: TokenItem;
}) => {
  if (!quote.data?.toTokenAmount) {
    return new BigNumber(0);
  }

  return new BigNumber(quote.data.toTokenAmount)
    .div(
      new BigNumber(10).pow(
        quote.data.toTokenDecimals || receiveToken.decimals,
      ),
    )
    .times(receiveToken.price || 0);
};

const getSwapProviderToTokenUsdValue = ({
  provider,
  receiveToken,
}: {
  provider: QuoteProvider;
  receiveToken: TokenItem;
}) => {
  if (!provider.quote?.toTokenAmount) {
    return new BigNumber(0);
  }

  return new BigNumber(provider.quote.toTokenAmount)
    .div(
      new BigNumber(10).pow(
        provider.quote.toTokenDecimals || receiveToken.decimals,
      ),
    )
    .times(receiveToken.price || 0);
};

const canDisplayEarlyQuoteByUsdValue = ({
  fromToken,
  fromAmount,
  toUsdValue,
}: {
  fromToken?: TokenItem;
  fromAmount: string;
  toUsdValue: BigNumber;
}) => {
  const fromUsdValue = getTokenUsdValue({
    token: fromToken,
    amount: fromAmount,
  });

  if (!fromUsdValue.gt(0)) {
    return true;
  }

  return toUsdValue.gte(
    fromUsdValue.times(EARLY_QUOTE_DISPLAY_MIN_TO_FROM_USD_RATIO),
  );
};

export const canDisplaySwapQuoteBeforeAllQuotesLoaded = ({
  quote,
  payToken,
  payAmount,
  receiveToken,
}: {
  quote: TDexQuoteData;
  payToken?: TokenItem;
  payAmount: string;
  receiveToken: TokenItem;
}) =>
  canDisplayEarlyQuoteByUsdValue({
    fromToken: payToken,
    fromAmount: payAmount,
    toUsdValue: getSwapQuoteToTokenUsdValue({ quote, receiveToken }),
  });

export const canDisplaySwapProviderBeforeAllQuotesLoaded = ({
  provider,
  payToken,
  payAmount,
  receiveToken,
}: {
  provider: QuoteProvider;
  payToken?: TokenItem;
  payAmount: string;
  receiveToken: TokenItem;
}) =>
  canDisplayEarlyQuoteByUsdValue({
    fromToken: payToken,
    fromAmount: payAmount,
    toUsdValue: getSwapProviderToTokenUsdValue({ provider, receiveToken }),
  });

export const getBestSwapQuote = ({
  quoteList,
  receiveToken,
  inSufficient,
}: {
  quoteList: TDexQuoteData[];
  receiveToken: TokenItem;
  inSufficient: boolean;
}) => {
  return quoteList.reduce<
    | {
        quote: TDexQuoteData;
        score: BigNumber;
      }
    | undefined
  >((best, quote) => {
    const score = getSwapQuoteScore({ quote, receiveToken, inSufficient });
    if (!score) {
      return best;
    }

    if (!best || score.gt(best.score)) {
      return { quote, score };
    }

    return best;
  }, undefined);
};

export const createSwapQuoteProvider = ({
  quote,
  receiveToken,
}: {
  quote: TDexQuoteData;
  receiveToken: TokenItem;
}): QuoteProvider => {
  const { preExecResult } = quote;

  return {
    name: quote.name,
    quote: quote.data,
    preExecResult: quote.preExecResult,
    gasPrice: preExecResult?.gasPrice,
    shouldApproveToken: !!preExecResult?.shouldApproveToken,
    shouldTwoStepApprove: !!preExecResult?.shouldTwoStepApprove,
    error: !preExecResult,
    halfBetterRate: '',
    quoteWarning: undefined,
    actualReceiveAmount:
      new BigNumber(quote.data?.toTokenAmount || 0)
        .div(10 ** (quote.data?.toTokenDecimals || receiveToken.decimals))
        .toString() || '',
    gasUsd: preExecResult?.gasUsd,
  };
};
