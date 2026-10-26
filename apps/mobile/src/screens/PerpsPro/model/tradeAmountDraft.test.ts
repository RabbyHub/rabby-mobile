import {
  createPerpsProTradeAmountDraft,
  getPerpsProTradeAmountDraftDisplay,
  repricePerpsProTradeAmountDraft,
  updatePerpsProTradeAmountDraft,
} from './tradeAmountDraft';

describe('Perps Pro trade amount draft', () => {
  it('preserves an exact quote source across repeated unit toggles', () => {
    const draft = updatePerpsProTradeAmountDraft({
      amount: '200',
      amountUnit: 'quote',
      price: '63000',
      szDecimals: 5,
    });

    expect(draft).toEqual({
      baseAmount: '0.00317',
      inputSource: 'quote',
      quoteAmount: '200',
    });
    for (let index = 0; index < 20; index += 1) {
      expect(getPerpsProTradeAmountDraftDisplay(draft, 'base')).toBe('0.00317');
      expect(getPerpsProTradeAmountDraftDisplay(draft, 'quote')).toBe('200');
    }
  });

  it('preserves an exact base source and derives a two-decimal quote display', () => {
    const draft = updatePerpsProTradeAmountDraft({
      amount: '0.00317',
      amountUnit: 'base',
      price: '63000',
      szDecimals: 5,
    });

    expect(draft).toEqual({
      baseAmount: '0.00317',
      inputSource: 'base',
      quoteAmount: '199.71',
    });
  });

  it('reprices only the derived side and never overwrites the source', () => {
    const quoteSource = updatePerpsProTradeAmountDraft({
      amount: '200',
      amountUnit: 'quote',
      price: '63000',
      szDecimals: 5,
    });
    expect(
      repricePerpsProTradeAmountDraft({
        draft: quoteSource,
        price: '64000',
        szDecimals: 5,
      }),
    ).toEqual({
      baseAmount: '0.00312',
      inputSource: 'quote',
      quoteAmount: '200',
    });

    expect(createPerpsProTradeAmountDraft()).toEqual({
      baseAmount: '',
      inputSource: null,
      quoteAmount: '',
    });
  });
});
