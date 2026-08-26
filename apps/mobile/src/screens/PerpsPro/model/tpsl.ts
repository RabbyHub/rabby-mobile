import BigNumber from 'bignumber.js';

export type PerpsProTpSlMode = 'pnl' | 'price' | 'roi';
export type PerpsProTpSlLegKind = 'sl' | 'tp';

export type PerpsProTpSlLegDraft = {
  mode: PerpsProTpSlMode;
  rawMagnitude: string;
};

export type PerpsProAttachedTpSlDraft = {
  enabled: boolean;
  sl: PerpsProTpSlLegDraft;
  tp: PerpsProTpSlLegDraft;
};

export type PerpsProAttachedTpSlModes = Record<
  PerpsProTpSlLegKind,
  PerpsProTpSlMode
>;

export type PerpsProTpSlValidationErrorCode =
  | 'atLeastOneRequired'
  | 'bboUnsupported'
  | 'conditionalUnsupported'
  | 'invalidDirection'
  | 'invalidInput'
  | 'invalidOrderAmount'
  | 'invalidTrigger'
  | 'iocUnsupported'
  | 'insufficientDepth'
  | 'marketBookUnavailable'
  | 'nonPositiveTrigger'
  | 'reduceOnlyUnsupported';

export type PerpsProTpSlValidationError = {
  code: PerpsProTpSlValidationErrorCode;
  leg?: PerpsProTpSlLegKind;
};

export type PerpsProFrozenAttachedTpSlValidationError = {
  code: Extract<
    PerpsProTpSlValidationErrorCode,
    'invalidDirection' | 'invalidTrigger'
  >;
  leg?: PerpsProTpSlLegKind;
};

export type PerpsProEvaluatedTpSlLeg = {
  estimatedPnl: string;
  estimatedRoi: string;
  kind: PerpsProTpSlLegKind;
  mode: PerpsProTpSlMode;
  rawMagnitude: string;
  triggerPrice: string;
};

export type PerpsProAttachedTpSlEvaluation = {
  errors: PerpsProTpSlValidationError[];
  expectedEntryPrice: string;
  liquidationPrice: string | null;
  normalizedBaseSize: string;
  side: 'buy' | 'sell';
  sl: PerpsProEvaluatedTpSlLeg | null;
  tp: PerpsProEvaluatedTpSlLeg | null;
};

const decimal = (value: unknown) => {
  const result = new BigNumber(
    (value as string | number | null | undefined) ?? Number.NaN,
  );
  return result.isFinite() ? result : null;
};

const positive = (value: unknown) => {
  const result = decimal(value);
  return result?.gt(0) ? result : null;
};

export const createPerpsProAttachedTpSlDraft = (
  modes: PerpsProAttachedTpSlModes = { sl: 'price', tp: 'price' },
): PerpsProAttachedTpSlDraft => ({
  enabled: false,
  sl: { mode: modes.sl, rawMagnitude: '' },
  tp: { mode: modes.tp, rawMagnitude: '' },
});

export const getPerpsProAttachedTpSlCompatibilityError = ({
  bboEnabled,
  orderType,
  reduceOnly,
  tif,
}: {
  bboEnabled: boolean;
  orderType: 'conditional' | 'limit' | 'market';
  reduceOnly: boolean;
  tif: 'Alo' | 'Gtc' | 'Ioc';
}): PerpsProTpSlValidationErrorCode | null => {
  if (orderType === 'conditional') return 'conditionalUnsupported';
  if (reduceOnly) return 'reduceOnlyUnsupported';
  if (orderType === 'limit' && bboEnabled) return 'bboUnsupported';
  if (orderType === 'limit' && tif === 'Ioc') return 'iocUnsupported';
  return null;
};

export const normalizePerpsProTpSlPrice = ({
  price,
  szDecimals,
}: {
  price: BigNumber;
  szDecimals: number;
}) => {
  if (
    !price.isFinite() ||
    price.lte(0) ||
    !Number.isSafeInteger(szDecimals) ||
    szDecimals < 0
  ) {
    return null;
  }
  // Hyperliquid explicitly permits integer prices regardless of significant
  // figures. Preserve the user's exact integer before applying the non-integer
  // five-significant-figure rule.
  if (price.isInteger()) {
    return price.toFixed(0);
  }
  const significant = new BigNumber(price.toPrecision(5, BigNumber.ROUND_DOWN));
  const normalized = significant.decimalPlaces(
    Math.max(0, 6 - szDecimals),
    BigNumber.ROUND_DOWN,
  );
  return normalized.gt(0) ? normalized.toFixed() : null;
};

type PerpsProTpSlLegCalculation =
  | {
      leg: PerpsProEvaluatedTpSlLeg;
      status: 'ok';
    }
  | {
      leg: null;
      status: 'empty' | 'invalidInput' | 'nonPositiveTrigger';
    };

const calculatePerpsProTpSlLeg = ({
  baseSize,
  draft,
  expectedEntryPrice,
  kind,
  leverage,
  side,
  szDecimals,
}: {
  baseSize: string;
  draft: PerpsProTpSlLegDraft;
  expectedEntryPrice: string;
  kind: PerpsProTpSlLegKind;
  leverage: number;
  side: 'buy' | 'sell';
  szDecimals: number;
}): PerpsProTpSlLegCalculation => {
  if (!draft.rawMagnitude.trim()) return { leg: null, status: 'empty' };
  const raw = positive(draft.rawMagnitude);
  const entry = positive(expectedEntryPrice);
  const size = positive(baseSize);
  const leverageValue = positive(leverage);
  if (!raw || !entry || !size || !leverageValue) {
    return { leg: null, status: 'invalidInput' };
  }

  const isBuy = side === 'buy';
  const signedTarget = kind === 'tp' ? raw : raw.negated();
  let trigger: BigNumber;
  if (draft.mode === 'price') {
    trigger = raw;
  } else if (draft.mode === 'pnl') {
    trigger = isBuy
      ? entry.plus(signedTarget.dividedBy(size))
      : entry.minus(signedTarget.dividedBy(size));
  } else {
    const returnFraction = signedTarget.dividedBy(100).dividedBy(leverageValue);
    trigger = isBuy
      ? entry.multipliedBy(new BigNumber(1).plus(returnFraction))
      : entry.multipliedBy(new BigNumber(1).minus(returnFraction));
  }
  if (!trigger.isFinite()) {
    return { leg: null, status: 'invalidInput' };
  }
  if (draft.mode !== 'price' && trigger.lte(0)) {
    return { leg: null, status: 'nonPositiveTrigger' };
  }

  const normalizedTrigger = normalizePerpsProTpSlPrice({
    price: trigger,
    szDecimals,
  });
  if (!normalizedTrigger) return { leg: null, status: 'invalidInput' };
  const normalized = new BigNumber(normalizedTrigger);
  const pnl = (isBuy ? normalized.minus(entry) : entry.minus(normalized))
    .multipliedBy(size)
    .decimalPlaces(20, BigNumber.ROUND_DOWN);
  const margin = entry.multipliedBy(size).dividedBy(leverageValue);
  if (!margin.isFinite() || margin.lte(0)) {
    return { leg: null, status: 'invalidInput' };
  }

  return {
    leg: {
      estimatedPnl: pnl.toFixed(),
      estimatedRoi: pnl
        .dividedBy(margin)
        .multipliedBy(100)
        .decimalPlaces(20, BigNumber.ROUND_DOWN)
        .toFixed(),
      kind,
      mode: draft.mode,
      rawMagnitude: draft.rawMagnitude,
      triggerPrice: normalizedTrigger,
    },
    status: 'ok',
  };
};

export const previewPerpsProTpSlLeg = (
  input: Parameters<typeof calculatePerpsProTpSlLeg>[0],
): PerpsProEvaluatedTpSlLeg | null => calculatePerpsProTpSlLeg(input).leg;

const validateDirection = ({
  entry,
  kind,
  side,
  trigger,
}: {
  entry: BigNumber;
  kind: PerpsProTpSlLegKind;
  side: 'buy' | 'sell';
  trigger: BigNumber;
}) => {
  if (side === 'buy') {
    return kind === 'tp' ? trigger.gt(entry) : trigger.lt(entry);
  }
  return kind === 'tp' ? trigger.lt(entry) : trigger.gt(entry);
};

export const evaluatePerpsProAttachedTpSl = ({
  baseSize,
  draft,
  expectedEntryPrice,
  leverage,
  liquidationPrice,
  order,
  side,
  szDecimals,
}: {
  baseSize: string;
  draft: PerpsProAttachedTpSlDraft;
  expectedEntryPrice: string;
  leverage: number;
  liquidationPrice: string | null;
  order: {
    bboEnabled: boolean;
    orderType: 'conditional' | 'limit' | 'market';
    reduceOnly: boolean;
    tif: 'Alo' | 'Gtc' | 'Ioc';
  };
  side: 'buy' | 'sell';
  szDecimals: number;
}): PerpsProAttachedTpSlEvaluation => {
  const errors: PerpsProTpSlValidationError[] = [];
  const compatibility = getPerpsProAttachedTpSlCompatibilityError(order);
  if (compatibility) errors.push({ code: compatibility });

  const tpCalculation = calculatePerpsProTpSlLeg({
    baseSize,
    draft: draft.tp,
    expectedEntryPrice,
    kind: 'tp',
    leverage,
    side,
    szDecimals,
  });
  const slCalculation = calculatePerpsProTpSlLeg({
    baseSize,
    draft: draft.sl,
    expectedEntryPrice,
    kind: 'sl',
    leverage,
    side,
    szDecimals,
  });
  const tp = tpCalculation.leg;
  const sl = slCalculation.leg;

  if (!draft.tp.rawMagnitude.trim() && !draft.sl.rawMagnitude.trim()) {
    errors.push({ code: 'atLeastOneRequired' });
  }
  (['tp', 'sl'] as const).forEach(kind => {
    const calculation = kind === 'tp' ? tpCalculation : slCalculation;
    if (calculation.status === 'empty' || calculation.status === 'ok') {
      return;
    }
    errors.push({
      code:
        calculation.status === 'nonPositiveTrigger'
          ? 'nonPositiveTrigger'
          : 'invalidInput',
      leg: kind,
    });
  });

  const entry = positive(expectedEntryPrice);
  (['tp', 'sl'] as const).forEach(kind => {
    const leg = kind === 'tp' ? tp : sl;
    if (!leg || !entry) return;
    const trigger = positive(leg.triggerPrice);
    if (!trigger) {
      errors.push({ code: 'invalidTrigger', leg: kind });
    } else if (!validateDirection({ entry, kind, side, trigger })) {
      errors.push({ code: 'invalidDirection', leg: kind });
    }
  });

  return {
    errors,
    expectedEntryPrice,
    liquidationPrice,
    normalizedBaseSize: baseSize,
    side,
    sl,
    tp,
  };
};

export const validatePerpsProFrozenAttachedTpSl = ({
  attached,
  expectedEntryPrice,
}: {
  attached: Pick<PerpsProAttachedTpSlEvaluation, 'side' | 'sl' | 'tp'>;
  expectedEntryPrice: string;
}): PerpsProFrozenAttachedTpSlValidationError[] => {
  const errors: PerpsProFrozenAttachedTpSlValidationError[] = [];
  const entry = positive(expectedEntryPrice);
  if (!entry || (!attached.tp && !attached.sl)) {
    return [{ code: 'invalidTrigger' }];
  }
  (['tp', 'sl'] as const).forEach(kind => {
    const leg = attached[kind];
    if (!leg) return;
    const trigger = positive(leg.triggerPrice);
    if (!trigger) {
      errors.push({ code: 'invalidTrigger', leg: kind });
      return;
    }
    if (!validateDirection({ entry, kind, side: attached.side, trigger })) {
      errors.push({ code: 'invalidDirection', leg: kind });
    }
  });
  return errors;
};
