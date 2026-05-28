import BigNumber from 'bignumber.js';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';

import type { SelectedBridgeQuote } from '../types';

export const bridgeQuoteEstimatedValueBn = (
  quote: SelectedBridgeQuote,
  receiveToken: TokenItem,
) => {
  return new BigNumber(quote.to_token_amount)
    .times(receiveToken.price || 1)
    .minus(quote.gas_fee.usd_value);
};

const PER_MINUTE_TIME_COST = 20000; // $20k USD per minute time cost

/**
 * Best quote scoring formula: score = amount_usd - gas_fee_usd - time_cost_usd
 * Time cost per minute = amount_usd / 20K, capped at $1 USD
 */
export const bridgeQuoteScore = (
  quote: SelectedBridgeQuote,
  receiveToken: TokenItem,
) => {
  const amountUsd = new BigNumber(quote.to_token_amount).times(
    receiveToken.price || 1,
  );
  const gasFeeUsd = new BigNumber(quote.gas_fee.usd_value);
  const durationMinutes = Math.ceil(quote.duration / 60);
  const timeCostUsd = BigNumber.min(
    amountUsd.div(PER_MINUTE_TIME_COST).times(durationMinutes),
    1,
  );
  return amountUsd.minus(gasFeeUsd).minus(timeCostUsd);
};

export const isSameBridgeQuote = (
  left?: SelectedBridgeQuote,
  right?: SelectedBridgeQuote,
) => {
  return (
    !!left &&
    !!right &&
    left.aggregator.id === right.aggregator.id &&
    left.bridge_id === right.bridge_id
  );
};

export const getBestBridgeQuote = (
  quotes: SelectedBridgeQuote[],
  receiveToken: TokenItem,
) => {
  return quotes.reduce<
    | {
        quote: SelectedBridgeQuote;
        score: BigNumber;
      }
    | undefined
  >((best, quote) => {
    if (quote.loading) {
      return best;
    }

    const score = bridgeQuoteScore(quote, receiveToken);
    if (!best || score.gt(best.score)) {
      return { quote, score };
    }

    return best;
  }, undefined);
};
