import { PERPS_PRO_FIELD_EXPLANATIONS } from './fieldExplanation';

const fieldExplanations = require('../../../assets/locales/en/messages.json')
  .page.perps.pro.fieldExplanations;

describe('Perps Pro field explanations', () => {
  it('keeps one strict registry entry for each approved explanatory field', () => {
    expect(Object.keys(PERPS_PRO_FIELD_EXPLANATIONS).sort()).toEqual(
      [
        'cost',
        'estimatedLiquidationPrice',
        'estimatedPnl',
        'liquidationDistance',
        'liquidationPrice',
        'marginRatio',
        'markPrice',
        'pnl',
        'reduceOnly',
        'roi',
        'tpSl',
        'totalValue',
      ].sort(),
    );
  });

  it('preserves the approved English titles and descriptions verbatim', () => {
    expect(fieldExplanations).toEqual({
      cost: {
        title: 'Cost',
        description:
          'The margin required to execute this order. Reducing a position does not cost margin.',
      },
      estimatedLiquidationPrice: {
        title: 'Liq. Price',
        description:
          'The Liq. Price shown is an estimate and may differ from the actual price. Please monitor the liquidation price and margin ratio after opening a position.',
      },
      estimatedPnl: {
        title: 'Estimated PNL',
        description:
          'Estimated PNL represents the projected profit or loss from closing a position. The actual realized PNL may differ due to trading fees and variations in the execution price. This estimate is provided for reference only.',
      },
      liquidationDistance: {
        title: 'Liq. Distance',
        description:
          'Price distance refers to the difference between the liquidation price and the mark price.\nIf the distance is positive, a price increase will lead to liquidation. If the distance is negative, a price drop will lead to liquidation.',
      },
      liquidationPrice: {
        title: 'Liq Price',
        description:
          'If the mark price falls below the liquidation price (when long) or rises above it (when short), your position will be liquidated.',
      },
      marginRatio: {
        title: 'Margin Ratio',
        description:
          'The lower the Margin Ratio, the lower your liquidation level will be relative to your position size. Your positions will be liquidated once Margin Ratio reaches 100%.',
      },
      markPrice: {
        title: 'Mark Price',
        description:
          'Used for margining, computing unrealized PNL, liquidations, and triggering TP/SL orders.',
      },
      pnl: {
        title: 'PNL',
        description:
          'The mark price is used to calculate unrealized PnL, while realized PnL is calculated using execution prices.',
      },
      reduceOnly: {
        title: 'Reduce Only',
        description:
          'This order will not open a new position, regardless of its size. At the time of execution, the order size will be compared with the size of the existing position.',
      },
      roi: {
        title: 'ROI',
        description:
          'ROI = Unrealized PnL / Initial Margin, where the initial margin is calculated using the mark price.',
      },
      tpSl: {
        title: 'TP/SL',
        description:
          'Places basic market TP/SL orders. For advanced features such as partial TP/SL, set TP/SL on an open position.',
      },
      totalValue: {
        title: 'Total Value',
        description:
          'Portfolio Value includes the value of spot assets in your Unified Account.',
      },
    });
  });
});
