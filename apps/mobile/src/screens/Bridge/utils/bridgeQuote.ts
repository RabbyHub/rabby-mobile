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
