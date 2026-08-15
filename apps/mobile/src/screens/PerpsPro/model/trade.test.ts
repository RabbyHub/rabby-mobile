import {
  createPerpsProTradeFormState,
  getPerpsProReduceOnlyAvailability,
  inferPerpsProConditionalClassification,
  isPerpsProAmountAboveBothMax,
  isPerpsProTradeCombinationSupported,
  resolvePerpsProDisplayAmount,
  resolvePerpsProTradeAmount,
  sanitizePerpsProDecimalInput,
} from './trade';

describe('Perps Pro trade model', () => {
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

  it('only reports a direction-neutral amount overflow above both side maxima', () => {
    expect(
      isPerpsProAmountAboveBothMax({
        amount: '10.01',
        buyMax: '10',
        sellMax: '8',
      }),
    ).toBe(true);
    expect(
      isPerpsProAmountAboveBothMax({
        amount: '9',
        buyMax: '10',
        sellMax: '8',
      }),
    ).toBe(false);
    expect(
      isPerpsProAmountAboveBothMax({
        amount: '10',
        buyMax: '10',
        sellMax: '8',
      }),
    ).toBe(false);
    expect(
      isPerpsProAmountAboveBothMax({
        amount: '',
        buyMax: '10',
        sellMax: '8',
      }),
    ).toBe(false);
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
