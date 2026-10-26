import { resolvePerpsProTradeAddFundsAction } from './addFunds';

describe('Perps Pro trade add-funds action', () => {
  it.each(['USDT', 'USDH', 'USDE'] as const)(
    'routes ready funded %s collateral through Swap',
    quoteAsset => {
      expect(
        resolvePerpsProTradeAddFundsAction({
          fundingAccountValue: '12.5',
          fundingAccountValueReady: true,
          quoteAsset,
        }),
      ).toEqual({
        isReady: true,
        mode: 'swap',
        targetAsset: quoteAsset,
      });
    },
  );

  it.each(['USDT', 'USDH', 'USDE'] as const)(
    'routes ready zero-value %s collateral through USDC Deposit',
    quoteAsset => {
      expect(
        resolvePerpsProTradeAddFundsAction({
          fundingAccountValue: '0',
          fundingAccountValueReady: true,
          quoteAsset,
        }),
      ).toEqual({
        isReady: true,
        mode: 'deposit',
        targetAsset: 'USDC',
      });
    },
  );

  it.each([
    0,
    '0',
    '-1',
    '',
    'invalid',
    Number.NaN,
    Number.POSITIVE_INFINITY,
    null,
  ])(
    'routes ready non-USDC collateral without a positive finite funding value through Deposit for %s',
    fundingAccountValue => {
      expect(
        resolvePerpsProTradeAddFundsAction({
          fundingAccountValue,
          fundingAccountValueReady: true,
          quoteAsset: 'USDE',
        }),
      ).toEqual({
        isReady: true,
        mode: 'deposit',
        targetAsset: 'USDC',
      });
    },
  );

  it('keeps unresolved non-USDC presentation on Swap without making the action executable', () => {
    expect(
      resolvePerpsProTradeAddFundsAction({
        fundingAccountValue: null,
        fundingAccountValueReady: false,
        quoteAsset: 'USDE',
      }),
    ).toEqual({
      isReady: false,
      mode: 'swap',
      targetAsset: 'USDE',
    });
  });

  it('keeps USDC on the deposit route', () => {
    expect(
      resolvePerpsProTradeAddFundsAction({
        fundingAccountValue: '100',
        fundingAccountValueReady: true,
        quoteAsset: 'USDC',
      }),
    ).toEqual({
      isReady: true,
      mode: 'deposit',
      targetAsset: 'USDC',
    });

    expect(
      resolvePerpsProTradeAddFundsAction({
        fundingAccountValue: null,
        fundingAccountValueReady: false,
        quoteAsset: 'USDC',
      }),
    ).toEqual({
      isReady: false,
      mode: 'deposit',
      targetAsset: 'USDC',
    });
  });
});
