import type {
  AssetPosition,
  ClearinghouseState,
  SpotMeta,
} from '@rabby-wallet/hyperliquid-sdk';

// The formatter module also exposes runtime helpers backed by the SDK/API
// singleton. Account-model tests only exercise its pure state formatters.
jest.mock('@/core/apis/perps', () => ({ apisPerps: {} }));
jest.mock('@/core/services', () => ({ perpsService: {} }));

import {
  formatAllDexsClearinghouseState,
  formatSpotState,
  mergeFastAssetCtxs,
  type AggregatedClearinghouseState,
} from '@/utils/perps';

import {
  buildPerpsAccountViewModel,
  computeSpotPortfolioValue,
  computeUnifiedAccountRatio,
  getSpotPriceDependencyKeys,
  resolveSpotUsdcPrice,
} from './account';

const summary = (accountValue: string) => ({
  accountValue,
  totalMarginUsed: '0',
  totalNtlPos: '0',
  totalRawUsd: '0',
});

const position = ({
  coin,
  isolated = false,
  marginUsed = '0',
  pnl = '0',
}: {
  coin: string;
  isolated?: boolean;
  marginUsed?: string;
  pnl?: string;
}): AssetPosition => ({
  position: {
    coin,
    cumFunding: { allTime: '0', sinceChange: '0', sinceOpen: '0' },
    leverage: { type: isolated ? 'isolated' : 'cross', value: 10 },
    marginUsed,
    maxLeverage: 50,
    positionValue: '100',
    returnOnEquity: '0',
    szi: '1',
    unrealizedPnl: pnl,
  },
  type: 'oneWay',
});

const clearinghouse = ({
  accountValue,
  crossAccountValue,
  maintenance,
  positions = [],
  time,
  withdrawable = '0',
}: {
  accountValue: string;
  crossAccountValue: string;
  maintenance: string;
  positions?: AssetPosition[];
  time: number;
  withdrawable?: string;
}): ClearinghouseState => ({
  assetPositions: positions,
  crossMaintenanceMarginUsed: maintenance,
  crossMarginSummary: summary(crossAccountValue),
  marginSummary: summary(accountValue),
  time,
  withdrawable,
});

const spotMeta: SpotMeta = {
  tokens: [
    { index: 0, name: 'USDC' },
    { index: 1, name: 'HYPE' },
    { index: 2, name: 'BTC' },
    { index: 3, name: 'REV' },
  ],
  universe: [
    { index: 10, name: 'HYPE/USDC', tokens: [1, 0] },
    { index: 11, name: 'BTC/HYPE', tokens: [2, 1] },
    { index: 12, name: 'USDC/REV', tokens: [0, 3] },
  ],
};

const formattedSpotState = () =>
  formatSpotState({
    balances: [
      {
        coin: 'USDC',
        entryNtl: '0',
        hold: '10',
        token: 0,
        total: '100',
      },
      {
        coin: 'HYPE',
        entryNtl: '1',
        hold: '0',
        ltv: '0.5',
        token: 1,
        total: '10',
      },
    ],
    portfolioMarginEnabled: true,
    portfolioMarginRatio: '0.2',
    tokenToPortfolioBorrowRatio: [[0, '1.2']],
  });

describe('Perps Pro account facts', () => {
  it('merges fast asset-context deltas without deleting omitted fields or keys', () => {
    const previous = {
      '@10': { markPx: '2', midPx: '1.9' },
      BTC: { markPx: '50000', midPx: '49999' },
    };
    const result = mergeFastAssetCtxs(previous, {
      '@10': { markPx: '2.1' },
      '@11': { midPx: '3' },
    });

    expect(result).toEqual({
      '@10': { markPx: '2.1', midPx: '1.9' },
      '@11': { markPx: undefined, midPx: '3' },
      BTC: { markPx: '50000', midPx: '49999' },
    });
    expect(mergeFastAssetCtxs(result, {})).toBe(result);
  });

  it('keeps legacy stablecoin outputs while preserving every raw spot balance', () => {
    const result = formattedSpotState();

    expect(result.accountValue).toBe('100');
    expect(result.availableToTrade).toBe('90');
    expect(result.balances.map(balance => balance.coin)).toEqual(['USDC']);
    expect(result.balancesMap.HYPE).toBeUndefined();
    expect(result.rawBalancesMap.HYPE).toMatchObject({
      available: '10',
      entryNtl: '1',
      ltv: '0.5',
      token: 1,
    });
    expect(result.rawBalancesByToken[1]?.coin).toBe('HYPE');
    expect(result.portfolioMarginRatio).toBe('0.2');
    expect(result.tokenToPortfolioBorrowRatio).toEqual([[0, '1.2']]);
  });

  it('aggregates cross equity and retains per-dex facts without changing legacy totals', () => {
    const result = formatAllDexsClearinghouseState([
      [
        '',
        clearinghouse({
          accountValue: '100',
          crossAccountValue: '80',
          maintenance: '8',
          time: 10,
          withdrawable: '70',
        }),
      ],
      [
        'xyz',
        clearinghouse({
          accountValue: '50',
          crossAccountValue: '40',
          maintenance: '4',
          time: 20,
          withdrawable: '30',
        }),
      ],
    ]);

    expect(result).toMatchObject({
      crossMaintenanceMarginUsed: '12',
      crossMaintByDex: { '': '8', xyz: '4' },
      time: 20,
      withdrawable: '100',
    });
    expect(result?.marginSummary.accountValue).toBe('150');
    expect(result?.crossMarginSummary.accountValue).toBe('120');
    expect(result?.perDexSummaries.xyz).toEqual({
      accountValue: '50',
      crossAccountValue: '40',
      crossMaintenanceMarginUsed: '4',
      time: 20,
      withdrawable: '30',
    });
  });

  it('does not construct an aggregate from an all-null clearinghouse frame', () => {
    expect(
      formatAllDexsClearinghouseState([
        ['', undefined as unknown as ClearinghouseState],
      ]),
    ).toBeNull();
  });

  it('matches Desktop direct, first-base chained and merge-key spot prices', () => {
    const prices = {
      '@10': { markPx: '2' },
      '@11': { markPx: '3' },
      '@12': { markPx: '0.5' },
      '#7': { markPx: '4' },
    };

    expect(resolveSpotUsdcPrice('USDC', prices, spotMeta)).toBe('1');
    expect(resolveSpotUsdcPrice('HYPE', prices, spotMeta)).toBe('2');
    expect(resolveSpotUsdcPrice('BTC', prices, spotMeta)).toBe('6');
    expect(resolveSpotUsdcPrice('REV', prices, spotMeta)).toBeNull();
    expect(resolveSpotUsdcPrice('+7', prices, spotMeta)).toBe('4');
    expect(resolveSpotUsdcPrice('UNKNOWN', prices, spotMeta)).toBeNull();
    expect(getSpotPriceDependencyKeys(['BTC', 'REV'], spotMeta)).toEqual([
      '@10',
      '@11',
      'BTC/HYPE',
      'HYPE/USDC',
    ]);
    expect(
      computeSpotPortfolioValue(
        [
          {
            available: '2',
            coin: 'BTC',
            entryNtl: '0',
            hold: '0',
            token: 2,
            total: '2',
          },
          {
            available: '5',
            coin: 'REV',
            entryNtl: '0',
            hold: '0',
            token: 3,
            total: '5',
          },
        ],
        prices,
        spotMeta,
      ),
    ).toEqual({ unpricedNonZeroAssets: ['REV'], value: '12' });
  });

  it('matches the Rabby unified ratio scope and reports unresolved dex collateral', () => {
    const state = formatAllDexsClearinghouseState([
      [
        '',
        clearinghouse({
          accountValue: '100',
          crossAccountValue: '80',
          maintenance: '10',
          positions: [
            position({ coin: 'BTC', isolated: true, marginUsed: '20' }),
          ],
          time: 1,
        }),
      ],
      [
        'xyz',
        clearinghouse({
          accountValue: '50',
          crossAccountValue: '50',
          maintenance: '5',
          time: 1,
        }),
      ],
    ]);
    const spotState = formatSpotState({
      balances: [
        { coin: 'USDC', entryNtl: '0', hold: '0', token: 0, total: '100' },
        {
          coin: 'USDT0',
          entryNtl: '0',
          hold: '0',
          token: 268,
          total: '50',
        },
      ],
    });

    expect(
      computeUnifiedAccountRatio({
        clearinghouseState: state,
        marketDataMap: {
          BTC: { coin: 'BTC', dexId: '', quoteAsset: 'USDC' },
          'xyz:ABC': {
            coin: 'xyz:ABC',
            dexId: 'xyz',
            quoteAsset: 'USDT',
          },
        },
        spotBalancesByToken: spotState.rawBalancesByToken,
      }),
    ).toEqual({ ratio: '0.125', unresolvedDexes: [] });

    expect(
      computeUnifiedAccountRatio({
        clearinghouseState: state,
        marketDataMap: {
          BTC: { coin: 'BTC', dexId: '', quoteAsset: 'USDC' },
        },
        spotBalancesByToken: spotState.rawBalancesByToken,
      }),
    ).toEqual({ ratio: null, unresolvedDexes: ['xyz'] });

    expect(
      computeUnifiedAccountRatio({
        clearinghouseState: formatAllDexsClearinghouseState([
          [
            '',
            clearinghouse({
              accountValue: '10',
              crossAccountValue: '10',
              maintenance: '1',
              time: 1,
            }),
          ],
        ]),
        marketDataMap: {},
        spotBalancesByToken: {},
      }),
    ).toEqual({ ratio: null, unresolvedDexes: [] });
  });

  it('builds Standard and Portfolio Margin summaries with distinct formulas', () => {
    const aggregate = formatAllDexsClearinghouseState([
      [
        '',
        clearinghouse({
          accountValue: '200',
          crossAccountValue: '150',
          maintenance: '30',
          positions: [position({ coin: 'BTC', pnl: '10' })],
          time: 1,
          withdrawable: '120',
        }),
      ],
    ]) as AggregatedClearinghouseState;
    const spotState = formattedSpotState();
    const standard = buildPerpsAccountViewModel({
      clearinghouseState: aggregate,
      marketDataMap: {
        BTC: { coin: 'BTC', dexId: '', quoteAsset: 'USDC' },
      },
      spotAssetCtxs: { '@10': { markPx: '2' } },
      spotMeta,
      spotState,
      userAbstraction: 'default',
    });
    const portfolioMargin = buildPerpsAccountViewModel({
      clearinghouseState: aggregate,
      marketDataMap: {
        BTC: { coin: 'BTC', dexId: '', quoteAsset: 'USDC' },
      },
      spotAssetCtxs: { '@10': { markPx: '2' } },
      spotMeta,
      spotState,
      userAbstraction: 'portfolioMargin',
    });
    const invalidPortfolioMarginRatio = buildPerpsAccountViewModel({
      clearinghouseState: aggregate,
      marketDataMap: {
        BTC: { coin: 'BTC', dexId: '', quoteAsset: 'USDC' },
      },
      spotAssetCtxs: { '@10': { markPx: '2' } },
      spotMeta,
      spotState: { ...spotState, portfolioMarginRatio: 'invalid' },
      userAbstraction: 'portfolioMargin',
    });

    expect(standard).toMatchObject({
      mode: 'standard',
      primaryKey: 'balance',
      primaryValue: '190',
      unrealizedPnl: '10',
    });
    expect(standard.metrics).toEqual([
      {
        key: 'crossMarginRatio',
        kind: 'ratio',
        value: '0.19999999998666666667',
      },
      { key: 'maintenanceMargin', kind: 'usd', value: '30' },
      { key: 'marginBalance', kind: 'usd', value: '150' },
    ]);
    expect(standard.assets[0]).toMatchObject({
      action: 'transfer',
      fullName: 'USD Coin',
      key: 'spot:USDC',
      ledger: 'spot',
    });
    expect(standard.assets[1]).toMatchObject({
      fullName: 'USD Coin',
      ledger: 'perps',
    });

    const incompleteStandard = buildPerpsAccountViewModel({
      clearinghouseState: formatAllDexsClearinghouseState([
        [
          'unknown-dex',
          clearinghouse({
            accountValue: '1',
            crossAccountValue: '1',
            maintenance: '0.1',
            time: 1,
          }),
        ],
      ]),
      marketDataMap: {},
      spotAssetCtxs: {},
      spotMeta,
      spotState,
      userAbstraction: 'default',
    });
    expect(incompleteStandard.diagnostics).toMatchObject({
      complete: false,
      unresolvedDexes: ['unknown-dex'],
    });

    expect(portfolioMargin).toMatchObject({
      mode: 'portfolioMargin',
      primaryKey: 'portfolioValue',
      primaryValue: '120',
      unrealizedPnl: '10',
    });
    expect(portfolioMargin.assets[0]).toMatchObject({
      fullName: 'USD Coin',
      ledger: 'unified',
    });
    expect(portfolioMargin.metrics).toEqual([
      { key: 'portfolioMarginRatio', kind: 'ratio', value: '0.2' },
      { key: 'maintenanceMargin', kind: 'usd', value: '30' },
      { key: 'ltvAdjustedPortfolioValue', kind: 'usd', value: '110' },
      { key: 'borrowCapUsed', kind: 'ratio', value: '1' },
    ]);
    expect(invalidPortfolioMarginRatio.metrics[0]?.value).toBeNull();
  });
});
