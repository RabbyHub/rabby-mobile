import {
  createPerpsProAttachedTpSlDraft,
  evaluatePerpsProAttachedTpSl,
  getPerpsProAttachedTpSlCompatibilityError,
  previewPerpsProTpSlLeg,
  validatePerpsProFrozenAttachedTpSl,
} from './tpsl';

const evaluate = (
  overrides: Partial<Parameters<typeof evaluatePerpsProAttachedTpSl>[0]> = {},
) =>
  evaluatePerpsProAttachedTpSl({
    baseSize: '2',
    currentPositionSize: '0',
    draft: {
      enabled: true,
      sl: { mode: 'price', rawMagnitude: '90' },
      tp: { mode: 'price', rawMagnitude: '110' },
    },
    expectedEntryPrice: '100',
    leverage: 10,
    liquidationPrice: '50',
    order: {
      bboEnabled: false,
      orderType: 'market',
      reduceOnly: false,
      tif: 'Gtc',
    },
    side: 'buy',
    szDecimals: 2,
    ...overrides,
  });

describe('Perps Pro TP/SL model', () => {
  it('creates independent Price drafts without enabling attachment', () => {
    expect(createPerpsProAttachedTpSlDraft()).toEqual({
      enabled: false,
      sl: { mode: 'price', rawMagnitude: '' },
      tp: { mode: 'price', rawMagnitude: '' },
    });
  });

  it.each([
    ['buy', 'tp', 'pnl', '20', '110'],
    ['buy', 'sl', 'pnl', '20', '90'],
    ['sell', 'tp', 'pnl', '20', '90'],
    ['sell', 'sl', 'pnl', '20', '110'],
    ['buy', 'tp', 'roi', '100', '110'],
    ['buy', 'sl', 'roi', '100', '90'],
    ['sell', 'tp', 'roi', '100', '90'],
    ['sell', 'sl', 'roi', '100', '110'],
  ] as const)(
    'converts %s %s %s into a direction-correct trigger',
    (side, kind, mode, rawMagnitude, triggerPrice) => {
      expect(
        previewPerpsProTpSlLeg({
          baseSize: '2',
          draft: { mode, rawMagnitude },
          expectedEntryPrice: '100',
          kind,
          leverage: 10,
          side,
          szDecimals: 2,
        }),
      ).toMatchObject({ triggerPrice });
    },
  );

  it('derives signed PnL and ROI from a Price input', () => {
    expect(
      previewPerpsProTpSlLeg({
        baseSize: '2',
        draft: { mode: 'price', rawMagnitude: '90' },
        expectedEntryPrice: '100',
        kind: 'sl',
        leverage: 10,
        side: 'buy',
        szDecimals: 2,
      }),
    ).toMatchObject({ estimatedPnl: '-20', estimatedRoi: '-100' });
  });

  it('keeps the positive-side preview when a high ROI makes the opposite trigger non-positive', () => {
    const input = {
      baseSize: '2',
      draft: { mode: 'roi' as const, rawMagnitude: '10000' },
      expectedEntryPrice: '224.83',
      kind: 'tp' as const,
      leverage: 20,
      szDecimals: 2,
    };

    expect(previewPerpsProTpSlLeg({ ...input, side: 'buy' })).toMatchObject({
      triggerPrice: '1348.9',
    });
    expect(previewPerpsProTpSlLeg({ ...input, side: 'sell' })).toBeNull();
  });

  it('requires at least one leg only at evaluation time', () => {
    expect(
      evaluate({
        draft: {
          enabled: true,
          sl: { mode: 'price', rawMagnitude: '' },
          tp: { mode: 'price', rawMagnitude: '' },
        },
      }).errors,
    ).toContainEqual({ code: 'atLeastOneRequired' });
  });

  it('distinguishes a derived non-positive trigger from malformed input', () => {
    expect(
      evaluate({
        draft: {
          enabled: true,
          sl: { mode: 'price', rawMagnitude: '' },
          tp: { mode: 'pnl', rawMagnitude: '300' },
        },
        side: 'sell',
      }).errors,
    ).toContainEqual({ code: 'nonPositiveTrigger', leg: 'tp' });
  });

  it.each([
    ['conditional', 'Gtc', false, false, 'conditionalUnsupported'],
    ['limit', 'Ioc', false, false, 'iocUnsupported'],
    ['limit', 'Gtc', true, false, 'bboUnsupported'],
    ['market', 'Gtc', true, false, null],
    ['market', 'Gtc', false, true, 'reduceOnlyUnsupported'],
  ] as const)(
    'rejects incompatible %s order state',
    (orderType, tif, bboEnabled, reduceOnly, expected) => {
      expect(
        getPerpsProAttachedTpSlCompatibilityError({
          bboEnabled,
          orderType,
          reduceOnly,
          tif,
        }),
      ).toBe(expected);
    },
  );

  it('enforces the strict Long liquidation interval', () => {
    expect(evaluate().errors).toEqual([]);
    expect(
      evaluate({
        draft: {
          enabled: true,
          sl: { mode: 'price', rawMagnitude: '50' },
          tp: { mode: 'price', rawMagnitude: '' },
        },
      }).errors,
    ).toContainEqual({ code: 'outsideLiquidationRange', leg: 'sl' });
  });

  it('enforces the strict Short liquidation interval', () => {
    expect(
      evaluate({
        draft: {
          enabled: true,
          sl: { mode: 'price', rawMagnitude: '110' },
          tp: { mode: 'price', rawMagnitude: '90' },
        },
        liquidationPrice: '150',
        side: 'sell',
      }).errors,
    ).toEqual([]);
  });

  it('blocks only a present SL when liquidation is unavailable', () => {
    expect(evaluate({ liquidationPrice: null }).errors).toContainEqual({
      code: 'liquidationUnavailable',
      leg: 'sl',
    });
    expect(
      evaluate({
        draft: {
          enabled: true,
          sl: { mode: 'price', rawMagnitude: '' },
          tp: { mode: 'price', rawMagnitude: '110' },
        },
        liquidationPrice: null,
      }).errors,
    ).toEqual([]);
  });

  it('blocks attached TP/SL for any opposite position', () => {
    expect(evaluate({ currentPositionSize: '-0.01' }).errors).toContainEqual({
      code: 'oppositePosition',
    });
  });

  it('revalidates frozen triggers without deriving new PnL/ROI prices', () => {
    const attached = evaluate();
    expect(
      validatePerpsProFrozenAttachedTpSl({
        attached,
        expectedEntryPrice: '100',
        liquidationPrice: '50',
      }),
    ).toEqual([]);
    expect(
      validatePerpsProFrozenAttachedTpSl({
        attached,
        expectedEntryPrice: '111',
        liquidationPrice: '50',
      }),
    ).toContainEqual({ code: 'invalidDirection', leg: 'tp' });
    expect(
      validatePerpsProFrozenAttachedTpSl({
        attached,
        expectedEntryPrice: '100',
        liquidationPrice: '95',
      }),
    ).toContainEqual({ code: 'outsideLiquidationRange', leg: 'sl' });
  });
});
