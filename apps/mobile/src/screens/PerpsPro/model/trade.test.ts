import {
  createPerpsProTradeFormState,
  getPerpsProReduceOnlyAvailability,
  inferPerpsProConditionalClassification,
  isPerpsProAmountAboveSharedMax,
  isPerpsProTradeCombinationSupported,
  resolvePerpsProDisplayAmount,
  resolvePerpsProMinimumOrderAmount,
  resolvePerpsProTradeAmount,
  sanitizePerpsProDecimalInput,
} from './trade';

const englishTradeMessages = require('../../../assets/locales/en/messages.json')
  .page.perps.pro.trade;

describe('Perps Pro trade model', () => {
  it('uses the approved insufficient-balance feedback copy', () => {
    expect(englishTradeMessages.insufficientBalance).toBe(
      'Insufficient balance',
    );
  });

  it.each([
    [true, '2', false, true, false],
    [true, '-2', false, false, true],
    [true, '0', true, true, true],
    [false, '-2', true, true, true],
  ] as const)(
    'derives Reduce Only availability for ready=%s and szi=%s',
    (
      isUserDataReady,
      currentPositionSize,
      checkboxDisabled,
      buyUnavailable,
      sellUnavailable,
    ) => {
      expect(
        getPerpsProReduceOnlyAvailability({
          currentPositionSize,
          isUserDataReady,
          reduceOnly: true,
        }),
      ).toMatchObject({
        buyUnavailable,
        checkboxDisabled,
        sellUnavailable,
      });
    },
  );

  it('does not disable normal order directions without Reduce Only', () => {
    expect(
      getPerpsProReduceOnlyAvailability({
        currentPositionSize: null,
        isUserDataReady: true,
        reduceOnly: false,
      }),
    ).toMatchObject({ buyUnavailable: false, sellUnavailable: false });
  });

  it.each([
    [true, '101', 'sl'],
    [true, '99', 'tp'],
    [false, '99', 'sl'],
    [false, '101', 'tp'],
  ] as const)(
    'infers conditional classification',
    (isBuy, trigger, expected) => {
      expect(
        inferPerpsProConditionalClassification({
          isBuy,
          referencePrice: '100',
          triggerPrice: trigger,
        }),
      ).toBe(expected);
    },
  );

  it('rejects an equal conditional trigger', () => {
    expect(
      inferPerpsProConditionalClassification({
        isBuy: true,
        referencePrice: '100',
        triggerPrice: '100',
      }),
    ).toBeNull();
  });

  it('converts quote amount to protocol base size with round-down precision', () => {
    expect(
      resolvePerpsProTradeAmount({
        amount: '100',
        amountUnit: 'quote',
        price: '63000',
        szDecimals: 5,
      }),
    ).toEqual({ baseSize: '0.00158', quoteAmount: '99.54' });
  });

  it('preserves the current MSFT 12 USDC canonical amount behavior', () => {
    expect(
      resolvePerpsProTradeAmount({
        amount: '12',
        amountUnit: 'quote',
        price: '509.21',
        szDecimals: 3,
      }),
    ).toEqual({ baseSize: '0.023', quoteAmount: '11.71183' });
  });

  it('derives the first SP500 lot above the 10 USDC floor and rounds the hint up', () => {
    expect(
      resolvePerpsProMinimumOrderAmount({
        minimumQuoteAmount: 10,
        price: '7673',
        szDecimals: 3,
      }),
    ).toEqual({
      displayQuoteAmount: '15.35',
      exactQuoteAmount: '15.346',
      minimumBaseSize: '0.002',
    });
  });

  it('keeps 10 as the fallback display when one base lot does not raise the floor', () => {
    expect(
      resolvePerpsProMinimumOrderAmount({
        minimumQuoteAmount: 10,
        price: '50000',
        szDecimals: 5,
      })?.displayQuoteAmount,
    ).toBe('10');
    expect(
      resolvePerpsProMinimumOrderAmount({
        minimumQuoteAmount: 10,
        price: '',
        szDecimals: 3,
      }),
    ).toBeNull();
  });

  it('keeps base amount as canonical protocol size', () => {
    expect(
      resolvePerpsProTradeAmount({
        amount: '0.001234',
        amountUnit: 'base',
        price: '63000',
        szDecimals: 5,
      }),
    ).toEqual({ baseSize: '0.00123', quoteAmount: '77.49' });
  });

  it('validates balance against the shared canonical base-size Max', () => {
    const facts = {
      amountUnit: 'base' as const,
      buyMaxBase: '5',
      minimumQuoteAmount: '10',
      price: '100',
      sellMaxBase: '10',
      szDecimals: 2,
    };

    expect(isPerpsProAmountAboveSharedMax({ amount: '10.01', ...facts })).toBe(
      true,
    );
    expect(isPerpsProAmountAboveSharedMax({ amount: '6', ...facts })).toBe(
      false,
    );
    expect(isPerpsProAmountAboveSharedMax({ amount: '10', ...facts })).toBe(
      false,
    );
  });

  it('quantizes quote input before comparing it with the shared Max', () => {
    const facts = {
      amountUnit: 'quote' as const,
      buyMaxBase: '5',
      minimumQuoteAmount: '10',
      price: '100',
      sellMaxBase: '10',
      szDecimals: 2,
    };

    expect(
      isPerpsProAmountAboveSharedMax({ amount: '1000.01', ...facts }),
    ).toBe(false);
    expect(isPerpsProAmountAboveSharedMax({ amount: '1001', ...facts })).toBe(
      true,
    );
  });

  it('keeps minimum-order and unavailable-Max states ahead of balance feedback', () => {
    expect(
      isPerpsProAmountAboveSharedMax({
        amount: '5',
        amountUnit: 'quote',
        buyMaxBase: '0.01',
        minimumQuoteAmount: '10',
        price: '100',
        sellMaxBase: '0.02',
        szDecimals: 2,
      }),
    ).toBe(false);
    expect(
      isPerpsProAmountAboveSharedMax({
        amount: '100',
        amountUnit: 'quote',
        buyMaxBase: '0',
        minimumQuoteAmount: '10',
        price: '100',
        sellMaxBase: '0',
        szDecimals: 2,
      }),
    ).toBe(false);
  });

  it('keeps base display independent and requires a price only for quote display', () => {
    expect(
      resolvePerpsProDisplayAmount({
        amountUnit: 'base',
        baseAmount: '0.25',
        price: null,
      }),
    ).toBe('0.25');
    expect(
      resolvePerpsProDisplayAmount({
        amountUnit: 'quote',
        baseAmount: '0.25',
        price: '64000',
      }),
    ).toBe('16000');
    expect(
      resolvePerpsProDisplayAmount({
        amountUnit: 'quote',
        baseAmount: '0.25',
        price: null,
      }),
    ).toBeNull();
  });

  it('sanitizes unsupported input without adding separators', () => {
    expect(sanitizePerpsProDecimalInput('-01a.23.45e2', 3)).toBe('1.234');
    expect(sanitizePerpsProDecimalInput('01,23', 2)).toBe('1.23');
  });

  it('only allows BBO with GTC', () => {
    const form = {
      ...createPerpsProTradeFormState({ orderType: 'limit' }),
      bboEnabled: true,
      tif: 'Ioc' as const,
    };
    expect(isPerpsProTradeCombinationSupported(form)).toBe(false);
    expect(isPerpsProTradeCombinationSupported({ ...form, tif: 'Gtc' })).toBe(
      true,
    );
    expect(
      isPerpsProTradeCombinationSupported({
        ...form,
        attachedTpSl: {
          ...form.attachedTpSl,
          enabled: true,
          tp: { mode: 'price', rawMagnitude: '101' },
        },
        tif: 'Gtc',
      }),
    ).toBe(false);
  });

  it('rejects attached TP/SL for Conditional, IOC and Reduce Only', () => {
    const base = createPerpsProTradeFormState({ orderType: 'limit' });
    const attachedTpSl = {
      ...base.attachedTpSl,
      enabled: true,
      tp: { mode: 'price' as const, rawMagnitude: '101' },
    };
    expect(
      isPerpsProTradeCombinationSupported({
        ...base,
        attachedTpSl,
        tif: 'Ioc',
      }),
    ).toBe(false);
    expect(
      isPerpsProTradeCombinationSupported({
        ...base,
        attachedTpSl,
        orderType: 'conditional',
      }),
    ).toBe(false);
    expect(
      isPerpsProTradeCombinationSupported({
        ...base,
        attachedTpSl,
        orderType: 'market',
        reduceOnly: true,
      }),
    ).toBe(false);
  });
});
