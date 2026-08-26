import { resolvePerpsProTradeAddFundsAction } from './addFunds';

describe('Perps Pro trade add-funds action', () => {
  it.each(['unified', 'portfolioMargin'] as const)(
    'routes non-USDC collateral through Swap for %s accounts',
    accountMode => {
      expect(
        resolvePerpsProTradeAddFundsAction({
          accountMode,
          quoteAsset: 'USDE',
        }),
      ).toEqual({ mode: 'swap', targetAsset: 'USDE' });
    },
  );

  it('keeps USDC and standard accounts on the USDC deposit route', () => {
    expect(
      resolvePerpsProTradeAddFundsAction({
        accountMode: 'unified',
        quoteAsset: 'USDC',
      }),
    ).toEqual({ mode: 'deposit', targetAsset: 'USDC' });
    expect(
      resolvePerpsProTradeAddFundsAction({
        accountMode: 'standard',
        quoteAsset: 'USDE',
      }),
    ).toEqual({ mode: 'deposit', targetAsset: 'USDC' });
  });
});
