export const PERPS_PRO_FIELD_EXPLANATIONS = {
  cost: {
    descriptionKey: 'page.perps.pro.fieldExplanations.cost.description',
    titleKey: 'page.perps.pro.fieldExplanations.cost.title',
  },
  estimatedLiquidationPrice: {
    descriptionKey:
      'page.perps.pro.fieldExplanations.estimatedLiquidationPrice.description',
    titleKey:
      'page.perps.pro.fieldExplanations.estimatedLiquidationPrice.title',
  },
  estimatedPnl: {
    descriptionKey: 'page.perps.pro.fieldExplanations.estimatedPnl.description',
    titleKey: 'page.perps.pro.fieldExplanations.estimatedPnl.title',
  },
  liquidationDistance: {
    descriptionKey:
      'page.perps.pro.fieldExplanations.liquidationDistance.description',
    titleKey: 'page.perps.pro.fieldExplanations.liquidationDistance.title',
  },
  liquidationPrice: {
    descriptionKey:
      'page.perps.pro.fieldExplanations.liquidationPrice.description',
    titleKey: 'page.perps.pro.fieldExplanations.liquidationPrice.title',
  },
  marginRatio: {
    descriptionKey: 'page.perps.pro.fieldExplanations.marginRatio.description',
    titleKey: 'page.perps.pro.fieldExplanations.marginRatio.title',
  },
  markPrice: {
    descriptionKey: 'page.perps.pro.fieldExplanations.markPrice.description',
    titleKey: 'page.perps.pro.fieldExplanations.markPrice.title',
  },
  pnl: {
    descriptionKey: 'page.perps.pro.fieldExplanations.pnl.description',
    titleKey: 'page.perps.pro.fieldExplanations.pnl.title',
  },
  reduceOnly: {
    descriptionKey: 'page.perps.pro.fieldExplanations.reduceOnly.description',
    titleKey: 'page.perps.pro.fieldExplanations.reduceOnly.title',
  },
  roi: {
    descriptionKey: 'page.perps.pro.fieldExplanations.roi.description',
    titleKey: 'page.perps.pro.fieldExplanations.roi.title',
  },
  tpSl: {
    descriptionKey: 'page.perps.pro.fieldExplanations.tpSl.description',
    titleKey: 'page.perps.pro.fieldExplanations.tpSl.title',
  },
  totalValue: {
    descriptionKey: 'page.perps.pro.fieldExplanations.totalValue.description',
    titleKey: 'page.perps.pro.fieldExplanations.totalValue.title',
  },
} as const;

export type PerpsProFieldExplanationKey =
  keyof typeof PERPS_PRO_FIELD_EXPLANATIONS;
