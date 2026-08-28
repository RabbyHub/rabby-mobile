import { resolvePerpsProTradeAddFundsAction } from './addFunds';

describe('Perps Pro trade add-funds action', () => {
  it('routes non-USDC collateral through Swap independent of account mode', () => {
    expect(resolvePerpsProTradeAddFundsAction({ quoteAsset: 'USDE' })).toEqual({
      mode: 'swap',
      targetAsset: 'USDE',
    });
  });

  it('keeps USDC on the deposit route', () => {
    expect(resolvePerpsProTradeAddFundsAction({ quoteAsset: 'USDC' })).toEqual({
      mode: 'deposit',
      targetAsset: 'USDC',
    });
  });
});
