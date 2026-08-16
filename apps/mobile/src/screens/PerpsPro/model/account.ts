import type {
  FFastAssetCtx,
  SpotMeta,
  UserAbstractionResp,
} from '@rabby-wallet/hyperliquid-sdk';
import BigNumber from 'bignumber.js';

import {
  COLLATERAL_TOKEN_TO_QUOTE,
  PERPS_QUOTE_ASSET_FULL_NAME,
  type PerpsQuoteAsset,
} from '@/constant/perps';
import { isPerpsStandardTransferAbstraction } from '@/hooks/perps/funding/transferEligibility';
import type {
  AggregatedClearinghouseState,
  RawSpotBalance,
} from '@/utils/perps';

import {
  ACCOUNT_ZERO as ZERO,
  accountDecimal as decimal,
  computeLtvAdjustedPortfolioValue,
  computeSpotPortfolioValue,
  computeTotalCollateralBalance,
  resolveSpotUsdcPrice,
  SETTLEMENT_TOKEN_IDS,
} from './accountPricing';

export {
  computeLtvAdjustedPortfolioValue,
  computeSpotPortfolioValue,
  computeTotalCollateralBalance,
  getSpotPriceDependencyKeys,
  resolveSpotUsdcPrice,
} from './accountPricing';

export type PerpsAccountMode = 'standard' | 'unified' | 'portfolioMargin';
export type PerpsAccountMetricKind = 'usd' | 'ratio';

export interface PerpsAccountMarketFact {
  coin: string;
  dexId: string;
  quoteAsset: PerpsQuoteAsset;
}

export interface PerpsAccountSpotStateFact {
  rawBalances: RawSpotBalance[];
  rawBalancesByToken: Record<number, RawSpotBalance>;
  portfolioMarginRatio?: string;
  tokenToPortfolioBorrowRatio?: [number, string][];
}

export interface PerpsAccountMetric {
  key:
    | 'crossMarginRatio'
    | 'unifiedAccountRatio'
    | 'portfolioMarginRatio'
    | 'maintenanceMargin'
    | 'marginBalance'
    | 'totalCollateralBalance'
    | 'ltvAdjustedPortfolioValue'
    | 'borrowCapUsed';
  kind: PerpsAccountMetricKind;
  value: string | null;
}

export interface PerpsAccountAssetRow {
  action: 'none' | 'swap' | 'transfer';
  available: string;
  coin: PerpsQuoteAsset;
  fullName: string;
  key: string;
  ledger: 'spot' | 'perps' | 'unified';
  total: string;
  usdValue: string | null;
}

export interface PerpsAccountDiagnostics {
  complete: boolean;
  unresolvedDexes: string[];
  unpricedNonZeroAssets: string[];
}

export interface PerpsAccountViewModel {
  assets: PerpsAccountAssetRow[];
  diagnostics: PerpsAccountDiagnostics;
  metrics: PerpsAccountMetric[];
  mode: PerpsAccountMode;
  primaryKey: 'balance' | 'portfolioValue';
  primaryValue: string;
  titleKey:
    | 'perpsAccountSummary'
    | 'unifiedAccountSummary'
    | 'portfolioMarginSummary';
  unrealizedPnl: string;
}

export interface BuildPerpsAccountViewModelInput {
  clearinghouseState: AggregatedClearinghouseState | null;
  marketDataMap: Record<string, PerpsAccountMarketFact | undefined>;
  spotAssetCtxs: Record<string, FFastAssetCtx>;
  spotMeta: SpotMeta | null;
  spotState: PerpsAccountSpotStateFact;
  userAbstraction: UserAbstractionResp | string;
}

export const resolvePerpsAccountMode = (
  userAbstraction: UserAbstractionResp | string,
): PerpsAccountMode => {
  if (userAbstraction === 'portfolioMargin') {
    return 'portfolioMargin';
  }
  if (userAbstraction === 'unifiedAccount') {
    return 'unified';
  }
  return 'standard';
};

export const computeCrossMarginRatio = (
  clearinghouseState: AggregatedClearinghouseState | null,
): string => {
  const denominator = decimal(
    clearinghouseState?.crossMarginSummary?.accountValue,
  ).plus('0.00000001');
  return decimal(clearinghouseState?.crossMaintenanceMarginUsed)
    .dividedBy(denominator)
    .toString();
};

const quoteByDex = (
  marketDataMap: Record<string, PerpsAccountMarketFact | undefined>,
) => {
  const result = new Map<string, PerpsQuoteAsset>();
  for (const market of Object.values(marketDataMap)) {
    if (market && !result.has(market.dexId || '')) {
      result.set(market.dexId || '', market.quoteAsset);
    }
  }
  return result;
};

const normalizeFiniteDecimal = (value: unknown): string | null => {
  if (value == null) {
    return null;
  }
  const result = new BigNumber(value as string | number);
  return result.isFinite() ? result.toString() : null;
};

const getUnresolvedStandardDexes = (
  clearinghouseState: AggregatedClearinghouseState | null,
  marketDataMap: Record<string, PerpsAccountMarketFact | undefined>,
) => {
  const dexQuotes = quoteByDex(marketDataMap);
  return Object.entries(clearinghouseState?.perDexSummaries || {})
    .filter(([dex, summary]) => {
      if (dex === '' || dexQuotes.has(dex)) {
        return false;
      }
      return [
        summary.accountValue,
        summary.crossAccountValue,
        summary.crossMaintenanceMarginUsed,
        summary.withdrawable,
      ].some(value => !decimal(value).isZero());
    })
    .map(([dex]) => dex)
    .sort();
};

export const computeUnifiedAccountRatio = ({
  clearinghouseState,
  marketDataMap,
  spotBalancesByToken,
}: {
  clearinghouseState: AggregatedClearinghouseState | null;
  marketDataMap: Record<string, PerpsAccountMarketFact | undefined>;
  spotBalancesByToken: Record<number, RawSpotBalance>;
}): { ratio: string | null; unresolvedDexes: string[] } => {
  if (!clearinghouseState) {
    return { ratio: '0', unresolvedDexes: [] };
  }

  const dexQuotes = quoteByDex(marketDataMap);
  const quoteTokenEntries = Object.entries(COLLATERAL_TOKEN_TO_QUOTE).map(
    ([token, quote]) => [quote, Number(token)] as const,
  );
  const tokenByQuote = new Map<PerpsQuoteAsset, number>(quoteTokenEntries);
  const crossByToken = new Map<number, BigNumber>();
  const isolatedByToken = new Map<number, BigNumber>();
  const unresolvedDexes = new Set<string>();

  for (const [dex, maintenance] of Object.entries(
    clearinghouseState.crossMaintByDex || {},
  )) {
    const quote = dexQuotes.get(dex || '') ?? (dex === '' ? 'USDC' : undefined);
    const token = quote ? tokenByQuote.get(quote) : undefined;
    if (token == null) {
      if (!decimal(maintenance).isZero()) {
        unresolvedDexes.add(dex || 'hyperliquid');
      }
      continue;
    }
    crossByToken.set(
      token,
      (crossByToken.get(token) ?? ZERO).plus(maintenance || 0),
    );
  }

  for (const asset of clearinghouseState.assetPositions || []) {
    if (asset.position.leverage?.type !== 'isolated') {
      continue;
    }
    const market = marketDataMap[asset.position.coin];
    const token = market ? tokenByQuote.get(market.quoteAsset) : undefined;
    if (token == null) {
      if (!decimal(asset.position.marginUsed).isZero()) {
        unresolvedDexes.add(market?.dexId || asset.position.coin);
      }
      continue;
    }
    isolatedByToken.set(
      token,
      (isolatedByToken.get(token) ?? ZERO).plus(asset.position.marginUsed || 0),
    );
  }

  if (unresolvedDexes.size > 0) {
    return { ratio: null, unresolvedDexes: [...unresolvedDexes].sort() };
  }

  let maxRatio = ZERO;
  for (const [token, maintenance] of crossByToken) {
    const available = decimal(spotBalancesByToken[token]?.total).minus(
      isolatedByToken.get(token) ?? ZERO,
    );
    if (maintenance.gt(0) && available.lte(0)) {
      return { ratio: null, unresolvedDexes: [] };
    }
    if (available.gt(0)) {
      maxRatio = BigNumber.max(maxRatio, maintenance.dividedBy(available));
    }
  }
  return {
    ratio: BigNumber.min(BigNumber.max(maxRatio, 0), 1).toString(),
    unresolvedDexes: [],
  };
};

export const computeBorrowCapUsed = (
  tokenToPortfolioBorrowRatio?: [number, string][],
): string => {
  const value = decimal(
    tokenToPortfolioBorrowRatio?.find(([token]) => token === 0)?.[1],
  );
  return BigNumber.min(BigNumber.max(value, 0), 1).toString();
};

const buildAccountAssets = ({
  clearinghouseState,
  marketDataMap,
  mode,
  spotAssetCtxs,
  spotMeta,
  spotState,
  userAbstraction,
}: BuildPerpsAccountViewModelInput & {
  mode: PerpsAccountMode;
}): PerpsAccountAssetRow[] => {
  if (mode !== 'standard') {
    const rows: PerpsAccountAssetRow[] = [];
    for (const balance of spotState.rawBalances) {
      if (!SETTLEMENT_TOKEN_IDS.has(balance.token)) {
        continue;
      }
      const coin = COLLATERAL_TOKEN_TO_QUOTE[balance.token];
      if (!coin) {
        continue;
      }
      const price = resolveSpotUsdcPrice(balance.coin, spotAssetCtxs, spotMeta);
      rows.push({
        action: coin === 'USDC' ? 'none' : 'swap',
        available: balance.available,
        coin,
        fullName: PERPS_QUOTE_ASSET_FULL_NAME[coin],
        key: `unified:${balance.token}`,
        ledger: 'unified',
        total: balance.total,
        usdValue: price
          ? decimal(balance.total).multipliedBy(price).toString()
          : null,
      });
    }
    return rows;
  }

  const rows: PerpsAccountAssetRow[] = [];
  const spotUsdc = spotState.rawBalancesByToken[0];
  rows.push({
    action: isPerpsStandardTransferAbstraction(userAbstraction)
      ? 'transfer'
      : 'none',
    available: spotUsdc?.available || '0',
    coin: 'USDC',
    fullName: PERPS_QUOTE_ASSET_FULL_NAME.USDC,
    key: 'spot:USDC',
    ledger: 'spot',
    total: spotUsdc?.total || '0',
    usdValue: spotUsdc?.total || '0',
  });

  const dexQuotes = quoteByDex(marketDataMap);
  const perpsByQuote = new Map<
    PerpsQuoteAsset,
    { available: BigNumber; total: BigNumber }
  >();
  for (const [dex, summary] of Object.entries(
    clearinghouseState?.perDexSummaries || {},
  )) {
    const quote = dexQuotes.get(dex || '') ?? (dex === '' ? 'USDC' : undefined);
    if (!quote) {
      continue;
    }
    const current = perpsByQuote.get(quote) ?? {
      available: ZERO,
      total: ZERO,
    };
    perpsByQuote.set(quote, {
      available: current.available.plus(summary.withdrawable || 0),
      total: current.total.plus(summary.accountValue || 0),
    });
  }
  if (perpsByQuote.size === 0 && clearinghouseState) {
    perpsByQuote.set('USDC', {
      available: decimal(clearinghouseState.withdrawable),
      total: decimal(clearinghouseState.marginSummary.accountValue),
    });
  }
  for (const [coin, value] of perpsByQuote) {
    rows.push({
      action: coin === 'USDC' ? 'none' : 'swap',
      available: value.available.toString(),
      coin,
      fullName: PERPS_QUOTE_ASSET_FULL_NAME[coin],
      key: `perps:${coin}`,
      ledger: 'perps',
      total: value.total.toString(),
      usdValue: value.total.toString(),
    });
  }
  return rows;
};

export const buildPerpsAccountViewModel = (
  input: BuildPerpsAccountViewModelInput,
): PerpsAccountViewModel => {
  const mode = resolvePerpsAccountMode(input.userAbstraction);
  const clearinghouse = input.clearinghouseState;
  const unrealizedPnl = (clearinghouse?.assetPositions || [])
    .reduce(
      (total, asset) => total.plus(asset.position.unrealizedPnl || 0),
      ZERO,
    )
    .toString();
  const maintenanceMargin = decimal(
    clearinghouse?.crossMaintenanceMarginUsed,
  ).toString();
  const portfolio = computeSpotPortfolioValue(
    input.spotState.rawBalances,
    input.spotAssetCtxs,
    input.spotMeta,
  );
  const assets = buildAccountAssets({ ...input, mode });

  if (mode === 'portfolioMargin') {
    const ltvAdjusted = computeLtvAdjustedPortfolioValue(
      input.spotState.rawBalances,
      input.spotAssetCtxs,
      input.spotMeta,
    );
    return {
      assets,
      diagnostics: {
        complete:
          portfolio.unpricedNonZeroAssets.length === 0 &&
          ltvAdjusted.unpricedNonZeroAssets.length === 0,
        unresolvedDexes: [],
        unpricedNonZeroAssets: [
          ...new Set([
            ...portfolio.unpricedNonZeroAssets,
            ...ltvAdjusted.unpricedNonZeroAssets,
          ]),
        ],
      },
      metrics: [
        {
          key: 'portfolioMarginRatio',
          kind: 'ratio',
          value: normalizeFiniteDecimal(input.spotState.portfolioMarginRatio),
        },
        { key: 'maintenanceMargin', kind: 'usd', value: maintenanceMargin },
        {
          key: 'ltvAdjustedPortfolioValue',
          kind: 'usd',
          value: ltvAdjusted.value,
        },
        {
          key: 'borrowCapUsed',
          kind: 'ratio',
          value: computeBorrowCapUsed(
            input.spotState.tokenToPortfolioBorrowRatio,
          ),
        },
      ],
      mode,
      primaryKey: 'portfolioValue',
      primaryValue: portfolio.value,
      titleKey: 'portfolioMarginSummary',
      unrealizedPnl,
    };
  }

  if (mode === 'unified') {
    const unifiedRatio = computeUnifiedAccountRatio({
      clearinghouseState: clearinghouse,
      marketDataMap: input.marketDataMap,
      spotBalancesByToken: input.spotState.rawBalancesByToken,
    });
    const collateral = computeTotalCollateralBalance(
      input.spotState.rawBalances,
      input.spotAssetCtxs,
      input.spotMeta,
    );
    return {
      assets,
      diagnostics: {
        complete:
          unifiedRatio.ratio != null &&
          portfolio.unpricedNonZeroAssets.length === 0 &&
          collateral.unpricedNonZeroAssets.length === 0,
        unresolvedDexes: unifiedRatio.unresolvedDexes,
        unpricedNonZeroAssets: [
          ...new Set([
            ...portfolio.unpricedNonZeroAssets,
            ...collateral.unpricedNonZeroAssets,
          ]),
        ],
      },
      metrics: [
        {
          key: 'unifiedAccountRatio',
          kind: 'ratio',
          value: unifiedRatio.ratio,
        },
        { key: 'maintenanceMargin', kind: 'usd', value: maintenanceMargin },
        {
          key: 'totalCollateralBalance',
          kind: 'usd',
          value: collateral.value,
        },
      ],
      mode,
      primaryKey: 'portfolioValue',
      primaryValue: portfolio.value,
      titleKey: 'unifiedAccountSummary',
      unrealizedPnl,
    };
  }

  const totalAccountValue = decimal(clearinghouse?.marginSummary?.accountValue);
  const unresolvedDexes = getUnresolvedStandardDexes(
    clearinghouse,
    input.marketDataMap,
  );
  return {
    assets,
    diagnostics: {
      complete: unresolvedDexes.length === 0,
      unresolvedDexes,
      unpricedNonZeroAssets: [],
    },
    metrics: [
      {
        key: 'crossMarginRatio',
        kind: 'ratio',
        value: computeCrossMarginRatio(clearinghouse),
      },
      { key: 'maintenanceMargin', kind: 'usd', value: maintenanceMargin },
      {
        key: 'marginBalance',
        kind: 'usd',
        value: decimal(
          clearinghouse?.crossMarginSummary?.accountValue,
        ).toString(),
      },
    ],
    mode,
    primaryKey: 'balance',
    primaryValue: totalAccountValue.minus(unrealizedPnl).toString(),
    titleKey: 'perpsAccountSummary',
    unrealizedPnl,
  };
};
