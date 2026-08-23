import type { OpenOrder } from '@rabby-wallet/hyperliquid-sdk';

import {
  buildPositionTpSlSummary,
  calculatePartialTpSlCoverage,
  calculatePositionTpSlEstimatedPnl,
  calculatePositionTpSlRoi,
  calculatePositionTpSlTriggerFromPnl,
  calculatePositionTpSlTriggerFromRoi,
  collectActivePositionTpSlOrders,
  sortPartialPositionTpSlOrders,
  validatePartialPositionTpSlAmount,
  validateFullPositionTpSlFormTrigger,
  validatePositionTpSlTrigger,
  resolvePositionTpSlEditTab,
} from './positionTpSl';

const order = (overrides: Partial<OpenOrder> = {}): OpenOrder => ({
  coin: 'BTC',
  isPositionTpsl: false,
  isTrigger: true,
  limitPx: '0',
  oid: 1,
  orderType: 'Take Profit Market',
  origSz: '0.5',
  reduceOnly: true,
  side: 'A',
  sz: '0.5',
  tif: null,
  timestamp: 1,
  triggerCondition: 'Price above 70000',
  triggerPx: '70000',
  ...overrides,
});

describe('Perps Pro position TP/SL model', () => {
  it('classifies active top-level full and fixed-size orders but excludes attached children', () => {
    const attachedChild = order({ oid: 3, triggerPx: '73000' });
    const result = collectActivePositionTpSlOrders('BTC', [
      order({ oid: 1 }),
      order({ isPositionTpsl: true, oid: 2, sz: '0' }),
      order({
        children: [attachedChild],
        isTrigger: false,
        oid: 10,
        orderType: 'Limit',
        reduceOnly: false,
      }),
      order({ coin: 'ETH', oid: 4 }),
      order({ oid: 5, orderType: 'Limit' }),
    ]);

    expect(result).toEqual([
      expect.objectContaining({
        oid: 1,
        remainingSize: '0.5',
        scope: 'partial',
      }),
      expect.objectContaining({
        oid: 2,
        remainingSize: '0',
        scope: 'position',
      }),
    ]);
  });

  it('counts independent partial TP and SL and selects each nearest Mark order', () => {
    const orders = collectActivePositionTpSlOrders('BTC', [
      order({ oid: 1, triggerPx: '70000' }),
      order({ oid: 2, triggerPx: '68000' }),
      order({ oid: 3, orderType: 'Stop Market', triggerPx: '60000' }),
      order({
        isPositionTpsl: true,
        oid: 4,
        orderType: 'Stop Market',
        sz: '0',
        triggerPx: '59000',
      }),
    ]);
    const summary = buildPositionTpSlSummary(orders, '65000');

    expect(summary.mode).toBe('mixed');
    expect(summary.partialCount).toBe(3);
    expect(summary.takeProfit.nearestPartialOrder?.oid).toBe(2);
    expect(summary.stopLoss.nearestPartialOrder?.oid).toBe(3);
    expect(summary.stopLoss.nearestPositionOrder?.oid).toBe(4);
  });

  it('routes edit to Position only when a Position TP/SL order exists', () => {
    const partial = collectActivePositionTpSlOrders('BTC', [order({ oid: 1 })]);
    const position = collectActivePositionTpSlOrders('BTC', [
      order({ isPositionTpsl: true, oid: 2, sz: '0' }),
    ]);

    expect(resolvePositionTpSlEditTab([])).toBe('partial');
    expect(resolvePositionTpSlEditTab(partial)).toBe('partial');
    expect(resolvePositionTpSlEditTab([...partial, ...position])).toBe(
      'position',
    );
  });

  it('uses deterministic Mark-nearest tie breaking and detects duplicate full sides', () => {
    const orders = collectActivePositionTpSlOrders('BTC', [
      order({
        isPositionTpsl: true,
        oid: 2,
        sz: '0',
        timestamp: 2,
        triggerPx: '66000',
      }),
      order({
        isPositionTpsl: true,
        oid: 1,
        sz: '0',
        timestamp: 3,
        triggerPx: '64000',
      }),
    ]);
    const summary = buildPositionTpSlSummary(orders, '65000');

    expect(summary.takeProfit.duplicatePositionOrders).toBe(true);
    expect(summary.takeProfit.nearestPositionOrder?.oid).toBe(1);
    expect(
      buildPositionTpSlSummary(orders, null).takeProfit.nearestPositionOrder,
    ).toBeNull();
  });

  it('sorts long high-to-low and short low-to-high with stable tie breakers', () => {
    const orders = collectActivePositionTpSlOrders('BTC', [
      order({ oid: 3, timestamp: 3, triggerPx: '69000' }),
      order({ oid: 1, timestamp: 2, triggerPx: '70000' }),
      order({ oid: 2, timestamp: 1, triggerPx: '70000' }),
    ]);

    expect(
      sortPartialPositionTpSlOrders(orders, 'long').map(item => item.oid),
    ).toEqual([2, 1, 3]);
    expect(
      sortPartialPositionTpSlOrders(orders, 'short').map(item => item.oid),
    ).toEqual([3, 2, 1]);
  });

  it('does not clamp cumulative coverage over one hundred percent', () => {
    const orders = collectActivePositionTpSlOrders('BTC', [
      order({ oid: 1, sz: '0.8' }),
      order({ oid: 2, sz: '0.7' }),
    ]);

    expect(calculatePartialTpSlCoverage(orders, '1')).toBe('1.5');
  });

  it('calculates direction-aware estimated PnL without fees or slippage', () => {
    expect(
      calculatePositionTpSlEstimatedPnl({
        direction: 'long',
        entryPrice: '60000',
        size: '0.5',
        triggerPrice: '62000',
      }),
    ).toBe('1000');
    expect(
      calculatePositionTpSlEstimatedPnl({
        direction: 'short',
        entryPrice: '60000',
        size: '0.5',
        triggerPrice: '62000',
      }),
    ).toBe('-1000');
  });

  it('keeps ROI and trigger price coupled by entry price and leverage', () => {
    expect(
      calculatePositionTpSlRoi({
        direction: 'long',
        entryPrice: '100',
        leverage: 20,
        triggerPrice: '105',
      }),
    ).toBe('100');
    expect(
      calculatePositionTpSlTriggerFromRoi({
        direction: 'short',
        entryPrice: '100',
        kind: 'stopLoss',
        leverage: 20,
        pxDecimals: 2,
        roiPercent: '100',
      }),
    ).toBe('105');
  });

  it('converts a positive PnL magnitude into direction-aware TP and SL triggers', () => {
    expect(
      calculatePositionTpSlTriggerFromPnl({
        direction: 'long',
        entryPrice: '100',
        kind: 'takeProfit',
        pnl: '10',
        pxDecimals: 2,
        size: '2',
      }),
    ).toBe('105');
    expect(
      calculatePositionTpSlTriggerFromPnl({
        direction: 'short',
        entryPrice: '100',
        kind: 'stopLoss',
        pnl: '10',
        pxDecimals: 2,
        size: '2',
      }),
    ).toBe('105');
    expect(
      calculatePositionTpSlTriggerFromPnl({
        direction: 'long',
        entryPrice: '100',
        kind: 'stopLoss',
        pnl: '300',
        pxDecimals: 2,
        size: '2',
      }),
    ).toBeNull();
  });

  it('validates every fixed-size order independently without aggregate limits', () => {
    expect(
      validatePartialPositionTpSlAmount({
        amount: '1',
        positionSize: '1',
        szDecimals: 3,
      }),
    ).toEqual({ kind: 'valid', normalized: '1' });
    expect(
      validatePartialPositionTpSlAmount({
        amount: '1.001',
        positionSize: '1',
        szDecimals: 3,
      }),
    ).toEqual({ kind: 'invalid' });
  });

  it('validates every trigger against Mark for both position directions', () => {
    expect(
      validatePositionTpSlTrigger({
        direction: 'long',
        kind: 'takeProfit',
        markPrice: '100',
        triggerPrice: '101',
      }),
    ).toEqual({ kind: 'valid', normalized: '101' });
    expect(
      validatePositionTpSlTrigger({
        direction: 'long',
        kind: 'stopLoss',
        markPrice: '100',
        triggerPrice: '101',
      }),
    ).toEqual({ kind: 'invalid' });
    expect(
      validatePositionTpSlTrigger({
        direction: 'short',
        kind: 'takeProfit',
        markPrice: '100',
        triggerPrice: '99',
      }),
    ).toEqual({ kind: 'valid', normalized: '99' });
    expect(
      validatePositionTpSlTrigger({
        direction: 'short',
        kind: 'stopLoss',
        markPrice: '100',
        triggerPrice: '101',
      }),
    ).toEqual({ kind: 'valid', normalized: '101' });
  });

  it('mirrors Desktop full-position feedback without adding PnL or ROI caps', () => {
    const validate = (
      overrides: Partial<
        Parameters<typeof validateFullPositionTpSlFormTrigger>[0]
      >,
    ) =>
      validateFullPositionTpSlFormTrigger({
        direction: 'long',
        inputSource: 'trigger',
        kind: 'stopLoss',
        liquidationPrice: '80',
        markPrice: '100',
        rawMagnitude: '',
        triggerPrice: '90',
        ...overrides,
      });

    expect(validate({ triggerPrice: '80' })).toEqual({
      kind: 'invalid',
      liquidationPrice: '80',
      reason: 'stopLossBelowLiquidation',
    });
    expect(validate({ triggerPrice: '100' })).toEqual({
      kind: 'invalid',
      reason: 'stopLossAboveMark',
    });
    expect(validate({ triggerPrice: '90' })).toEqual({
      kind: 'valid',
      normalized: '90',
    });
    expect(
      validate({
        direction: 'short',
        liquidationPrice: '120',
        triggerPrice: '120',
      }),
    ).toEqual({
      kind: 'invalid',
      liquidationPrice: '120',
      reason: 'stopLossAboveLiquidation',
    });
    expect(
      validate({
        direction: 'short',
        liquidationPrice: '120',
        triggerPrice: '100',
      }),
    ).toEqual({ kind: 'invalid', reason: 'stopLossBelowMark' });
    expect(
      validate({
        direction: 'short',
        liquidationPrice: '120',
        triggerPrice: '110',
      }),
    ).toEqual({ kind: 'valid', normalized: '110' });
    expect(validate({ kind: 'takeProfit', triggerPrice: '100' })).toEqual({
      kind: 'invalid',
      reason: 'takeProfitBelowMark',
    });
    expect(
      validate({
        direction: 'short',
        kind: 'takeProfit',
        triggerPrice: '100',
      }),
    ).toEqual({ kind: 'invalid', reason: 'takeProfitAboveMark' });
    expect(validate({ liquidationPrice: null, triggerPrice: '1' })).toEqual({
      kind: 'valid',
      normalized: '1',
    });
    expect(validate({ triggerPrice: '' })).toEqual({ kind: 'empty' });
    expect(validate({ triggerPrice: '0' })).toEqual({ kind: 'empty' });
    expect(
      validate({
        inputSource: 'mode',
        rawMagnitude: '999999999999999999999',
        triggerPrice: '',
      }),
    ).toEqual({
      kind: 'invalid',
      liquidationPrice: '80',
      reason: 'stopLossBelowLiquidation',
    });
    expect(
      validate({
        direction: 'short',
        inputSource: 'mode',
        kind: 'stopLoss',
        liquidationPrice: '120',
        rawMagnitude: '999999999999999999999',
        triggerPrice: '',
      }),
    ).toEqual({ kind: 'invalid', reason: 'stopLossDerivedInvalid' });
    expect(
      validate({
        inputSource: 'mode',
        kind: 'takeProfit',
        rawMagnitude: '999999999999999999999',
        triggerPrice: '',
      }),
    ).toEqual({ kind: 'invalid', reason: 'takeProfitDerivedInvalid' });
    expect(
      validate({
        kind: 'takeProfit',
        triggerPrice: '100000000000000000000000000000000000000',
      }).kind,
    ).toBe('valid');
  });
});
