import type { PerpsProTpSlValidationError } from '../model/tpsl';

export type PerpsProTpSlErrorContext = {
  liquidationPrice: string | null;
  side: 'buy' | 'sell' | null;
};

type Translate = (
  key: string,
  options?: { price?: string; side?: string },
) => unknown;

const key = (name: string) => `page.perps.pro.trade.tpSlError.${name}`;

export const getPerpsProTpSlErrorText = ({
  context,
  error,
  t,
}: {
  context: PerpsProTpSlErrorContext;
  error: PerpsProTpSlValidationError;
  t: Translate;
}) => {
  if (error.code === 'invalidDirection' && context.side && error.leg) {
    const name =
      context.side === 'buy'
        ? error.leg === 'tp'
          ? 'tpTriggerMoreThanOrderPrice'
          : 'slTriggerLessThanOrderPrice'
        : error.leg === 'tp'
        ? 'tpTriggerLessThanOrderPrice'
        : 'slTriggerMoreThanOrderPrice';
    return String(t(key(name)));
  }

  if (
    error.code === 'outsideLiquidationRange' &&
    context.side &&
    context.liquidationPrice
  ) {
    return String(
      t(
        key(
          context.side === 'buy'
            ? 'priceBelowLiquidation'
            : 'priceAboveLiquidation',
        ),
        { price: context.liquidationPrice },
      ),
    );
  }

  if (error.code === 'nonPositiveTrigger' && context.side && error.leg) {
    const side = String(
      t(key(context.side === 'buy' ? 'sideLongBuy' : 'sideShortSell')),
    );
    return String(
      t(
        key(
          error.leg === 'tp' ? 'tpTriggerPriceIsZero' : 'slTriggerPriceIsZero',
        ),
        { side },
      ),
    );
  }

  return String(t(key(error.code)));
};
