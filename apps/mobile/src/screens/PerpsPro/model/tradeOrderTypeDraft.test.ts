import { updatePerpsProTradeAmountDraft } from './tradeAmountDraft';
import {
  createPerpsProTradeOrderTypeAmountDrafts,
  getPerpsProTradeOrderTypeAmountDisplay,
} from './tradeOrderTypeDraft';

describe('Perps Pro order-type Amount drafts', () => {
  it('creates independent empty drafts for every order type', () => {
    const drafts = createPerpsProTradeOrderTypeAmountDrafts();

    drafts.market.percentage = 100;
    drafts.market.amountSource = 'slider';

    expect(drafts.market).toMatchObject({
      amountSource: 'slider',
      percentage: 100,
    });
    expect(drafts.limit).toMatchObject({
      amountSource: 'manual',
      percentage: 0,
    });
    expect(drafts.conditional).toMatchObject({
      amountSource: 'manual',
      percentage: 0,
    });
    expect(drafts.market.amountDraft).not.toBe(drafts.limit.amountDraft);
  });

  it('restores Slider percentage independently from the current unit', () => {
    const drafts = createPerpsProTradeOrderTypeAmountDrafts();
    drafts.market = {
      ...drafts.market,
      amountSource: 'slider',
      percentage: 100,
    };

    expect(
      getPerpsProTradeOrderTypeAmountDisplay({
        amountUnit: 'quote',
        draft: drafts.market,
      }),
    ).toBe('100%');
    expect(
      getPerpsProTradeOrderTypeAmountDisplay({
        amountUnit: 'base',
        draft: drafts.market,
      }),
    ).toBe('100%');
  });

  it('restores the manual source in the current shared Amount unit', () => {
    const drafts = createPerpsProTradeOrderTypeAmountDrafts();
    drafts.limit.amountDraft = updatePerpsProTradeAmountDraft({
      amount: '200',
      amountUnit: 'quote',
      price: '100',
      szDecimals: 2,
    });

    expect(
      getPerpsProTradeOrderTypeAmountDisplay({
        amountUnit: 'quote',
        draft: drafts.limit,
      }),
    ).toBe('200');
    expect(
      getPerpsProTradeOrderTypeAmountDisplay({
        amountUnit: 'base',
        draft: drafts.limit,
      }),
    ).toBe('2');
  });
});
