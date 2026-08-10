import { createPerpsProTradeFormState } from './trade';
import {
  getPerpsProNetNewBaseSize,
  getPerpsProTradeDisplayReferencePrice,
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
});
