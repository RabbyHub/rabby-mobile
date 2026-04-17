import {
  AllDexsClearinghouseState,
  MarketData,
} from '@/hooks/perps/usePerpsStore';
import {
  PERPS_MAX_NTL_VALUE,
  PerpsQuoteAsset,
  COLLATERAL_TOKEN_TO_QUOTE,
} from '@/constant/perps';
import {
  Meta,
  MarginTable,
  ClearinghouseState,
  SpotClearinghouseState,
} from '@rabby-wallet/hyperliquid-sdk';
import { isSameAddress } from '@rabby-wallet/base-utils/src/isomorphic/address';
import { Account } from '@/core/services/preference';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { apisPerps } from '@/core/apis';
import { perpsService } from '@/core/services';
import { PerpTopTokenV3 } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';

export const getPxDecimals = (markPx: string) => {
  const parts = markPx.split('.');
  if (!parts[1]) {
    return 2;
  }
  const decimalPart = parts[1];
  return decimalPart.length;
};

export const normalizeHyperliquidCoinForLogo = (coin: string) => {
  if (!coin) {
    return '';
  }
  // Keep km:* untouched, but drop k-prefix for meme perps like kPEPE -> PEPE.
  if (coin.startsWith('k') && !coin.startsWith('km:')) {
    return coin.slice(1);
  }
  return coin;
};

export const getHyperliquidCoinLogoUrl = (coin: string) => {
  const iconKey = normalizeHyperliquidCoinForLogo(coin);
  if (!iconKey) {
    return '';
  }
  return `https://app.hyperliquid.xyz/coins/${iconKey}.svg`;
};

/**
 * Determine quote asset from Meta.collateralToken.
 */
export const getQuoteAssetFromMeta = (meta: Meta): PerpsQuoteAsset => {
  return COLLATERAL_TOKEN_TO_QUOTE[meta.collateralToken] ?? 'USDC';
};

export const formatMarkData = (
  allMetas: Meta[],
  topAssets: PerpTopTokenV3[],
  dexIdMap: Record<number, string>,
): MarketData[] => {
  try {
    if (!Array.isArray(allMetas) || allMetas.length === 0) {
      console.error('Failed to format market data: allMetas is empty');
      return [];
    }

    // Build a lookup: dexId → { meta, marginTableMap, quoteAsset }
    const dexLookup: Record<
      string,
      {
        meta: Meta;
        marginTableMap: Record<number, MarginTable>;
        quoteAsset: PerpsQuoteAsset;
      }
    > = {};

    allMetas.forEach((meta, idx) => {
      const dexId = dexIdMap[idx] ?? String(idx);
      const marginTableMap: Record<number, MarginTable> = {};
      if (Array.isArray(meta.marginTables)) {
        for (const entry of meta.marginTables) {
          const [id, table] = entry || [];
          if (id != null) {
            marginTableMap[id] = table;
          }
        }
      }
      dexLookup[dexId] = {
        meta,
        marginTableMap,
        quoteAsset: getQuoteAssetFromMeta(meta),
      };
    });

    const result: MarketData[] = topAssets
      .map(topAsset => {
        const index = topAsset.token_id;
        const dexId = topAsset.dex_id ?? '';
        const dexInfo = dexLookup[dexId] ?? dexLookup[''];
        if (!dexInfo) {
          return null;
        }

        const { meta, marginTableMap, quoteAsset } = dexInfo;
        const hlDataAsset = meta.universe[index];
        if (!hlDataAsset || hlDataAsset.isDelisted) {
          return null;
        }

        const table = marginTableMap[hlDataAsset.marginTableId];
        const tiers = table?.marginTiers || [];
        const firstTier = tiers[0];
        const nextTier = tiers[1];

        const item: MarketData = {
          index,
          dexId: topAsset.dex_id ?? '',
          name: String(topAsset.name ?? ''),
          quoteAsset,
          maxLeverage: Number(
            firstTier?.maxLeverage ?? hlDataAsset?.maxLeverage,
          ),
          displayName: topAsset.display_name || topAsset.name,
          minLeverage: 1,
          maxUsdValueSize: String(nextTier?.lowerBound ?? PERPS_MAX_NTL_VALUE),
          szDecimals: Number(hlDataAsset.szDecimals ?? 0),
          onlyIsolated: hlDataAsset.onlyIsolated,
          pxDecimals: 2, // Will be updated by WebSocket AssetCtx
          dayBaseVlm: '0',
          dayNtlVlm: '0',
          funding: '0',
          markPx: '',
          midPx: '',
          openInterest: '0',
          oraclePx: '',
          premium: '0',
          prevDayPx: '',
          logoUrl:
            topAsset.full_logo_url || getHyperliquidCoinLogoUrl(topAsset.name),
          category: topAsset.category || '',
        };
        return item;
      })
      .filter(Boolean) as MarketData[];

    return result;
  } catch (e) {
    console.error('Failed to format market data:', e);
    return [];
  }
};

export const calLiquidationPrice = (
  markPrice: number,
  margin: number,
  direction: 'Long' | 'Short',
  positionSize: number,
  nationalValue: number,
  maxLeverage: number,
) => {
  const MMR = 1 / maxLeverage / 2;
  const side = direction === 'Long' ? 1 : -1;
  // const nationalValue = margin * leverage;
  // const nationalValue = positionSize * markPrice;
  const maintenance_margin_required = nationalValue * MMR;
  const margin_available = margin - maintenance_margin_required;
  const liq_price =
    markPrice - (side * margin_available) / positionSize / (1 - MMR * side);
  // liq_price = price - side * margin_available / position_size / (1 - l * side)
  return Math.max(liq_price, 0);
};

// transfer_margin_required = max(initial_margin_required, 0.1 * total_position_value)
export const calTransferMarginRequired = (
  markPrice: number,
  positionSize: number,
  leverage: number,
) => {
  const nationalValue = Number(positionSize) * Number(markPrice);
  const initialNationalValue = Number(positionSize) * Number(markPrice);
  const initialMarginRequired = initialNationalValue * (1 / leverage);
  const transferMarginRequired = Math.max(
    initialMarginRequired,
    0.1 * nationalValue,
  );
  return transferMarginRequired;
};

export const MAX_SIGNIFICANT_FIGURES = 6;

export const formatPerpsPct = (v: number) => `${(v * 100).toFixed(2)}%`;

/**
 * Format price to ensure it passes validatePriceInput validation
 * Rules:
 * 1. Decimal places <= (6 - szDecimals)
 * 2. Significant figures <= 5
 * 3. Can be downgraded to integer if decimal part is all zeros
 * @param price - The price number to format
 * @param szDecimals - Size decimals parameter
 * @returns Formatted price string that will always pass validatePriceInput
 */
export const formatTpOrSlPrice = (
  price: number,
  szDecimals: number,
): string => {
  if (!price || price === 0) {
    return '0';
  }

  const vStr = price.toString();
  if (!vStr.includes('.')) {
    // Integer: always valid
    return vStr;
  }

  const [integerPart = '', decimalPart = ''] = vStr.split('.');

  // Rule: if integer part has 6+ digits, force integer to always pass validator
  if (integerPart.length >= 6) {
    return integerPart;
  }

  // Calculate max decimal places: (6 - szDecimals)
  const maxDecimals = MAX_SIGNIFICANT_FIGURES - szDecimals;

  // Calculate significant figures (same logic as validatePriceInput)
  // Merge integer and decimal parts first, then remove leading zeros
  const allSignificantDigits = (integerPart + decimalPart).replace(/^0+/, '');
  const integerDigits = integerPart.replace(/^0+/, '');

  // If significant digits <= 5, just limit decimal places
  if (allSignificantDigits.length <= 5) {
    if (decimalPart.length > maxDecimals) {
      const newDecimalPart = decimalPart.slice(0, maxDecimals);
      // Remove trailing zeros
      const trimmedDecimal = newDecimalPart.replace(/0+$/, '');
      if (trimmedDecimal) {
        return `${integerPart}.${trimmedDecimal}`;
      }
      return `${integerPart}`;
    }
    // Remove trailing zeros from original
    const trimmedDecimal = decimalPart.replace(/0+$/, '');
    if (trimmedDecimal) {
      return `${integerPart}.${trimmedDecimal}`;
    }
    return `${integerPart}`;
  }

  // Significant digits > 5
  // Integer significant digits = non-zero digits in integer part (leading zeros removed)
  const integerPartLength = integerDigits.length;

  if (integerPartLength >= 5) {
    // When integer already occupies 5 digits, drop decimals to pass validator
    return integerPart;
  }

  // Calculate remaining digits allowed in decimal part
  // Note: every digit in decimalPart counts toward allDigits length
  const remainingDigits = 5 - integerPartLength;

  // Limit decimal part to the minimum of remainingDigits and maxDecimals
  const maxDecimalLength = Math.min(remainingDigits, maxDecimals);
  let composedDecimal = decimalPart.slice(0, maxDecimalLength);

  // Remove trailing zeros
  composedDecimal = composedDecimal.replace(/0+$/, '');
  if (composedDecimal) {
    return `${integerPart}.${composedDecimal}`;
  }
  return `${integerPart}`;
};

export const calcAccountValueByAllDexs = (
  clearinghouseState?: AllDexsClearinghouseState,
) => {
  if (!Array.isArray(clearinghouseState) || !clearinghouseState) {
    return 0;
  }
  return clearinghouseState.reduce((acc, item) => {
    return acc + Number(item[1]?.marginSummary?.accountValue || 0);
  }, 0);
};

export const formatPositionPnl = (clearinghouseState: ClearinghouseState) => {
  return {
    pnl: Number(
      clearinghouseState.assetPositions.reduce((acc, asset) => {
        return acc + Number(asset.position.unrealizedPnl);
      }, 0),
    ),
    show: Number(clearinghouseState.marginSummary.accountValue) > 0,
    type: (clearinghouseState.assetPositions.length > 0
      ? 'pnl'
      : 'accountValue') as 'pnl' | 'accountValue',
    accountValue: Number(clearinghouseState.marginSummary.accountValue),
  };
};

export const formatAllDexsClearinghouseState = (
  allClearinghouseState: AllDexsClearinghouseState,
): ClearinghouseState | null => {
  if (!allClearinghouseState || !allClearinghouseState[0]) {
    return null;
  }
  const hyperDexState = allClearinghouseState[0][1];

  const assetPositions = allClearinghouseState
    .map(item => item[1]?.assetPositions || [])
    .flat();

  const withdrawable = allClearinghouseState.reduce((acc, item) => {
    return acc + Number(item[1]?.withdrawable || 0);
  }, 0);

  return {
    assetPositions: assetPositions,
    crossMaintenanceMarginUsed:
      hyperDexState?.crossMaintenanceMarginUsed || '0',
    crossMarginSummary: hyperDexState?.crossMarginSummary || {},
    marginSummary: {
      ...hyperDexState.marginSummary,
      accountValue: calcAccountValueByAllDexs(allClearinghouseState).toString(),
    },
    time: hyperDexState?.time || 0,
    withdrawable: withdrawable.toString(),
  };
};

export const formatPerpsCoin = (coin: string) => {
  if (coin.includes(':')) {
    // is hip-3 coin
    return coin.split(':')[1] || '';
  } else {
    return coin;
  }
};

/**
 * Format a perps market name for display with its quote asset.
 * Examples: 'BTC' + 'USDC' → 'BTC/USDC', 'xyz:TSLA' + 'USDC' → 'TSLA/USDC'
 */
export const formatPerpsDisplayName = (
  coinName: string,
  quoteAsset: string = 'USDC',
): string => {
  const baseCoin = formatPerpsCoin(coinName);
  return `${baseCoin}/${quoteAsset}`;
};

export const findDefaultAccount = (
  accounts: Account[],
  currentAccount: Account,
) => {
  const selectedItem =
    currentAccount &&
    accounts.find(
      item =>
        isSameAddress(item.address, currentAccount.address) &&
        item.type === currentAccount.type,
    );
  return selectedItem;
};

export const checkPerpsReference = async ({
  account,
  scene = 'invite',
}: {
  account?: Account | null;
  scene?: 'invite' | 'connect';
}) => {
  try {
    const address = account?.address;
    if (!address) {
      return false;
    }
    let accountTypes = Object.values(KEYRING_CLASS.HARDWARE);
    const inviteConfig = perpsService.getInviteConfig(address) || {};
    let lastTime = inviteConfig.lastInvitedAt || 0;
    let duration = 7 * 24 * 60 * 60 * 1000; // 7 days

    if (scene === 'connect') {
      accountTypes.push(...[KEYRING_CLASS.PRIVATE_KEY, KEYRING_CLASS.MNEMONIC]);
      lastTime = inviteConfig.lastConnectedAt || 0;
      duration = 24 * 60 * 60 * 1000; // 1 day
    }

    if (!accountTypes.includes(account.type)) {
      return false;
    }

    if (lastTime) {
      const now = Date.now();
      const diff = now - lastTime;
      if (diff < duration) {
        return false;
      }
    }
    const sdk = apisPerps.getPerpsSDK();
    const info = await sdk.info.getClearingHouseState(address);
    const needDepositFirst =
      Number(info?.marginSummary?.accountValue || 0) === 0 &&
      Number(info?.withdrawable || 0) === 0;
    if (needDepositFirst) {
      return false;
    }

    const data = await sdk.info.getReferral(account?.address || '');

    if (data?.referredBy) {
      return false;
    }

    return true;
  } catch (e) {
    console.error('checkPerpsReference error', e);
    return false;
  }
};

export const formatSpotState = (spotState: SpotClearinghouseState) => {
  if (!spotState || !spotState.balances || spotState.balances.length === 0) {
    return {
      accountValue: '0',
      availableToTrade: '0',
      balances: [],
      balancesMap: {},
    };
  }

  // Only extract the 4 stablecoins we support, filter by token ID
  const STABLECOIN_TOKEN_IDS = new Set(
    Object.keys(COLLATERAL_TOKEN_TO_QUOTE).map(Number),
  );

  const balances = spotState.balances
    .filter(b => STABLECOIN_TOKEN_IDS.has(b.token))
    .map(b => {
      const available = new BigNumber(b.total || '0')
        .minus(b.hold || '0')
        .toString();
      return {
        coin: b.coin,
        token: b.token,
        total: b.total || '0',
        hold: b.hold || '0',
        available,
      };
    });

  // Assumes all stablecoins at 1:1 USD parity (matches Hyperliquid internal accounting)
  const totalAccountValue = balances
    .reduce((sum, b) => sum.plus(b.total), new BigNumber(0))
    .toString();

  const totalAvailable = balances
    .reduce((sum, b) => sum.plus(b.available), new BigNumber(0))
    .toString();

  // Key by coin name for quick lookup (e.g. balancesMap['USDT'])
  const balancesMap: Record<string, (typeof balances)[number]> = {};
  for (const b of balances) {
    balancesMap[b.coin] = b;
  }

  return {
    accountValue: totalAccountValue,
    availableToTrade: totalAvailable,
    balances,
    balancesMap,
  };
};

export const getStatsReportSide = (isBuy: boolean, isReduceOnly: boolean) => {
  if (isReduceOnly) {
    return isBuy ? 'close short' : 'close long';
  }
  return isBuy ? 'open long' : 'open short';
};

export const handleDisplayFundingPayments = (fundingPayments: string) => {
  const bn = new BigNumber(fundingPayments || 0);
  if (bn.isZero()) {
    return '$0.00';
  }
  // negative means funding payment, positive means funding gains
  const sign = bn.isNegative() ? '+' : '-';
  if (bn.abs().lt(0.01)) {
    return sign + '$0.01';
  }

  return sign + '$' + bn.abs().toFixed(2);
};
