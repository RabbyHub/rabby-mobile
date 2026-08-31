import { createPerpsProTradeFormState } from './trade';
import {
  getPerpsProMaxDisplayAmount,
  getPerpsProMaxDisplayReferencePrice,
  getPerpsProNetNewBaseSize,
  getPerpsProTradeDisplayReferencePrice,
  resolvePerpsProLimitCapacityPrice,
  resolvePerpsProMaxBaseCapacity,
  resolvePerpsProSliderAmount,
  resolvePerpsProTradeProjection,
} from './tradeProjection';

describe('Perps Pro trade projection', () => {
  it('uses mid as the shared BBO unit-conversion price', () => {
    expect(
      getPerpsProTradeDisplayReferencePrice({
        form: createPerpsProTradeFormState({ orderType: 'limit' }),
        marketPrice: '100',
      }),
    ).toBe('');
    expect(
      getPerpsProTradeDisplayReferencePrice({
        form: {
          ...createPerpsProTradeFormState({ orderType: 'limit' }),
          bboEnabled: true,
        },
        marketPrice: '100',
      }),
    ).toBe('100');
  });

  it('uses live market only as the empty manual Limit Max fallback', () => {
    const limitForm = createPerpsProTradeFormState({ orderType: 'limit' });

    expect(
      getPerpsProMaxDisplayReferencePrice({
        form: limitForm,
        marketPrice: '100',
      }),
    ).toBe('100');
    expect(
      getPerpsProMaxDisplayReferencePrice({
        form: { ...limitForm, limitPrice: '95' },
        marketPrice: '100',
      }),
    ).toBe('95');
    expect(
      getPerpsProMaxDisplayReferencePrice({
        form: { ...limitForm, bboEnabled: true },
        marketPrice: '100',
      }),
    ).toBe('100');
  });

  it('applies the plugin Limit safety reserve at the mark price', () => {
    expect(
      resolvePerpsProMaxBaseCapacity({
        availableQuote: '100',
        leverage: 10,
        markPrice: '100',
        orderType: 'limit',
        referencePrice: '100',
        serverMaxBase: '12',
        side: 'buy',
        szDecimals: 2,
      }),
    ).toBe('9.9');
    expect(
      resolvePerpsProMaxBaseCapacity({
        availableQuote: '1000',
        leverage: 10,
        markPrice: '100',
        orderType: 'limit',
        referencePrice: '100',
        serverMaxBase: '10',
        side: 'buy',
        szDecimals: 2,
      }),
    ).toBe('10');
  });

  it('adds closable opposite exposure to the conservative Limit capacity', () => {
    expect(
      resolvePerpsProMaxBaseCapacity({
        availableQuote: '100',
        currentPositionSize: '-2',
        leverage: 10,
        markPrice: '100',
        orderType: 'limit',
        referencePrice: '100',
        serverMaxBase: '20',
        side: 'buy',
        szDecimals: 2,
      }),
    ).toBe('11.9');
  });

  it.each([
    ['buy', '80', '80'],
    ['buy', '120', '100'],
    ['sell', '125', '125'],
    ['sell', '80', '100'],
  ] as const)(
    'uses the Hyperliquid resting-price rule for %s Limit %s',
    (side, limitPrice, expected) => {
      expect(
        resolvePerpsProLimitCapacityPrice({
          limitPrice,
          markPrice: '100',
          side,
        }),
      ).toBe(expected);
    },
  );

  it('rebases the mark-priced server max before applying the Limit reserve', () => {
    expect(
      resolvePerpsProMaxBaseCapacity({
        availableQuote: '100',
        leverage: 10,
        markPrice: '100',
        orderType: 'limit',
        referencePrice: '80',
        serverMaxBase: '10',
        side: 'buy',
        szDecimals: 2,
      }),
    ).toBe('12.37');
    expect(
      resolvePerpsProMaxBaseCapacity({
        availableQuote: '100',
        leverage: 10,
        markPrice: '100',
        orderType: 'limit',
        referencePrice: '125',
        serverMaxBase: '10',
        side: 'sell',
        szDecimals: 2,
      }),
    ).toBe('7.92');
    expect(
      resolvePerpsProMaxBaseCapacity({
        availableQuote: '100',
        leverage: 10,
        markPrice: '100',
        orderType: 'limit',
        referencePrice: '120',
        serverMaxBase: '10',
        side: 'buy',
        szDecimals: 2,
      }),
    ).toBe('8.25');
    expect(
      resolvePerpsProMaxBaseCapacity({
        availableQuote: '100',
        leverage: 10,
        markPrice: '100',
        orderType: 'limit',
        referencePrice: '80',
        serverMaxBase: '10',
        side: 'sell',
        szDecimals: 2,
      }),
    ).toBe('10');
  });

  it('keeps the official Limit price adjustment when balance facts are unavailable', () => {
    expect(
      resolvePerpsProMaxBaseCapacity({
        availableQuote: '',
        leverage: 10,
        markPrice: '100',
        orderType: 'limit',
        referencePrice: '80',
        serverMaxBase: '10',
        side: 'buy',
        szDecimals: 2,
      }),
    ).toBe('12.5');
  });

  it.each(['0', '-1'])(
    'treats a known non-positive balance %s as zero new Limit capacity',
    availableQuote => {
      expect(
        resolvePerpsProMaxBaseCapacity({
          availableQuote,
          leverage: 10,
          markPrice: '100',
          orderType: 'limit',
          referencePrice: '80',
          serverMaxBase: '10',
          side: 'buy',
          szDecimals: 2,
        }),
      ).toBe('0');
    },
  );

  it('keeps opposite closable exposure when the available balance is zero', () => {
    expect(
      resolvePerpsProMaxBaseCapacity({
        availableQuote: '0',
        currentPositionSize: '-2',
        leverage: 10,
        markPrice: '100',
        orderType: 'limit',
        referencePrice: '80',
        serverMaxBase: '10',
        side: 'buy',
        szDecimals: 2,
      }),
    ).toBe('2');
  });

  it('extends the Limit reserve to Conditional Limit but not Conditional Market', () => {
    expect(
      resolvePerpsProMaxBaseCapacity({
        availableQuote: '100',
        conditionalExecution: 'limit',
        leverage: 10,
        markPrice: '100',
        orderType: 'conditional',
        referencePrice: '80',
        serverMaxBase: '10',
        side: 'buy',
        szDecimals: 2,
      }),
    ).toBe('12.37');
    expect(
      resolvePerpsProMaxBaseCapacity({
        availableQuote: '100',
        conditionalExecution: 'market',
        leverage: 10,
        markPrice: '100',
        orderType: 'conditional',
        referencePrice: '80',
        serverMaxBase: '10.129',
        side: 'buy',
        szDecimals: 2,
      }),
    ).toBe('10.12');
    expect(
      resolvePerpsProMaxBaseCapacity({
        availableQuote: '100',
        leverage: 10,
        markPrice: '100',
        orderType: 'market',
        referencePrice: '80',
        serverMaxBase: '10.129',
        side: 'buy',
        szDecimals: 2,
      }),
    ).toBe('10.12');
  });

  it('uses live market only as the empty Conditional Limit Max fallback', () => {
    const conditionalForm = {
      ...createPerpsProTradeFormState({ orderType: 'conditional' }),
      conditionalExecution: 'limit' as const,
    };

    expect(
      getPerpsProMaxDisplayReferencePrice({
        form: conditionalForm,
        marketPrice: '100',
      }),
    ).toBe('100');
    expect(
      getPerpsProMaxDisplayReferencePrice({
        form: { ...conditionalForm, conditionalLimitPrice: '96' },
        marketPrice: '100',
      }),
    ).toBe('96');
  });

  it('converts quote Max with its display reference and fails closed without it', () => {
    expect(
      getPerpsProMaxDisplayAmount({
        amountUnit: 'quote',
        maxBase: '10',
        referencePrice: '100',
      }),
    ).toBe('1000.00');
    expect(
      getPerpsProMaxDisplayAmount({
        amountUnit: 'quote',
        maxBase: '10',
        referencePrice: null,
      }),
    ).toBe('0');
    expect(
      getPerpsProMaxDisplayAmount({
        amountUnit: 'base',
        maxBase: '10',
        referencePrice: null,
      }),
    ).toBe('10');
  });

  it('uses mid for the entered quote but direction BBO for Cost', () => {
    const projection = resolvePerpsProTradeProjection({
      amount: '100',
      amountSource: 'manual',
      amountUnit: 'quote',
      currentPositionSize: null,
      displayPrice: '100',
      executionPrice: '110',
      leverage: 10,
      maxBase: '10',
      percentage: 0,
      reduceOnly: false,
      side: 'buy',
      szDecimals: 4,
    });

    expect(projection).toMatchObject({
      baseSize: '1',
      costQuote: '11.00',
      displayQuoteAmount: '100',
      executionQuoteAmount: '110',
    });
  });

  it('nets an opposite position before calculating new exposure', () => {
    expect(
      getPerpsProNetNewBaseSize({
        baseSize: '3',
        currentPositionSize: '-2',
        reduceOnly: false,
        side: 'buy',
      }),
    ).toBe('1');
    expect(
      getPerpsProNetNewBaseSize({
        baseSize: '3',
        currentPositionSize: '-2',
        reduceOnly: true,
        side: 'buy',
      }),
    ).toBe('0');
  });

  it('rounds slider base size down to the market precision', () => {
    expect(
      resolvePerpsProTradeProjection({
        amount: '33%',
        amountSource: 'slider',
        amountUnit: 'base',
        displayPrice: '100',
        executionPrice: '100',
        leverage: 10,
        maxBase: '1',
        percentage: 33.333,
        reduceOnly: false,
        side: 'sell',
        szDecimals: 2,
      })?.baseSize,
    ).toBe('0.33');
  });

  it('uses the canonical direction max as the exact 100% endpoint', () => {
    expect(
      resolvePerpsProSliderAmount({
        maxBase: '12.37',
        percentage: 100,
        price: '80',
        szDecimals: 2,
      }),
    ).toEqual({ baseSize: '12.37', quoteAmount: '989.6' });
    expect(
      resolvePerpsProSliderAmount({
        maxBase: '12.37',
        percentage: 37,
        price: '80',
        szDecimals: 2,
      })?.baseSize,
    ).toBe('4.57');
  });
});
