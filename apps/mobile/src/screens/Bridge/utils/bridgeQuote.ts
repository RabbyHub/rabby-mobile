import BigNumber from 'bignumber.js';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';

import type { SelectedBridgeQuote } from '../types';

export const bridgeQuoteEstimatedValueBn = (
  quote: SelectedBridgeQuote,
  receiveToken: TokenItem,
) => {
  const receiveAmount = new BigNumber(quote.to_token_amount);

  if (!receiveToken.price) {
    return receiveAmount;
  }

  return receiveAmount.times(receiveToken.price).minus(quote.gas_fee.usd_value);
};

const PER_MINUTE_TIME_COST = 20000; // $20k USD per minute time cost

/**
 * Best quote scoring formula: score = amount_usd - gas_fee_usd - time_cost_usd
 * Time cost per second = amount_usd / 20K / 60, capped at $1 USD
 * If the receive-token price is unavailable, rank by receive amount only.
 */
export const bridgeQuoteScore = (
  quote: SelectedBridgeQuote,
  receiveToken: TokenItem,
) => {
  const receiveAmount = new BigNumber(quote.to_token_amount);

  if (!receiveToken.price) {
    return receiveAmount;
  }

  const amountUsd = receiveAmount.times(receiveToken.price);
  const gasFeeUsd = new BigNumber(quote.gas_fee.usd_value);
  const timeCostUsd = BigNumber.min(
    amountUsd.div(PER_MINUTE_TIME_COST).times(quote.duration).div(60),
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
