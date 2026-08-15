import { prewarmPerpsFastL2 } from '@/hooks/perps/subscriptions/usePerpsFastL2';
import { prewarmPerpsLatestTrade } from '@/hooks/perps/subscriptions/usePerpsLatestTrade';

import type { PerpsProMarket } from '../model/market';
import { getPerpTickOptions, resolvePerpsTickOption } from '../model/orderBook';
import { getPerpsProSessionBookPrecision } from '../session/perpsProMarketSession';
import { preparePerpsProLeverageSources } from './perpsProZeroAddressLeverageBaseline';

export const PERPS_PRO_ENTRY_INTENT_TIMEOUT_MS = 1500;

/**
 * Starts bounded realtime work for one exact Pro target. The mounted Scene can
 * join the same registries or consume the fresh display snapshot without a
 * second SDK subscription.
 */
export const prewarmPerpsProRealtimeIntent = (market: PerpsProMarket) => {
  const tickOptions = getPerpTickOptions(
    market.price ?? 0,
    market.marketData.szDecimals,
  );
  const tickOption = resolvePerpsTickOption(
    tickOptions,
    getPerpsProSessionBookPrecision(market.marketKey),
  );
  const cancelFastL2 = tickOption
    ? prewarmPerpsFastL2({
        coin: market.canonicalCoin,
        precision: {
          mantissa: tickOption.mantissa,
          nSigFigs: tickOption.nSigFigs,
        },
        timeoutMs: PERPS_PRO_ENTRY_INTENT_TIMEOUT_MS,
      })
    : () => undefined;
  const cancelLatestTrade = prewarmPerpsLatestTrade({
    coin: market.canonicalCoin,
    timeoutMs: PERPS_PRO_ENTRY_INTENT_TIMEOUT_MS,
  });
  let cancelled = false;

  return () => {
    if (cancelled) {
      return;
    }
    cancelled = true;
    cancelFastL2();
    cancelLatestTrade();
  };
};

/**
 * Starts bounded work for the exact Pro scope the route would select. Leverage
 * requests only seed their existing shared cache and never publish into the
 * Simple UI; realtime work is delegated to the shared target intent above.
 */
export const prewarmPerpsProEntryIntent = ({
  accountAddress,
  market,
}: {
  accountAddress?: string | null;
  market: PerpsProMarket;
}) => {
  preparePerpsProLeverageSources(market.canonicalCoin, accountAddress).catch(
    () => undefined,
  );
  return prewarmPerpsProRealtimeIntent(market);
};
