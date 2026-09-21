import {
  COLLATERAL_TOKEN_TO_QUOTE,
  type PerpsQuoteAsset,
} from '@/constant/perps';
import BigNumber from 'bignumber.js';

const normalizeAvailable = (value: unknown): string | null => {
  const available = new BigNumber(
    (value as string | number | null | undefined) ?? Number.NaN,
  );
  return available.isFinite() && available.gte(0) ? available.toFixed() : null;
};

export const getPerpsProCollateralToken = (
  quoteAsset: PerpsQuoteAsset | null | undefined,
): number | null => {
  if (!quoteAsset) {
    return null;
  }
  const match = Object.entries(COLLATERAL_TOKEN_TO_QUOTE).find(
    ([, quote]) => quote === quoteAsset,
  );
  return match ? Number(match[0]) : null;
};

/**
 * Resolve the account-mode-specific Cross risk balance after current
 * maintenance, but before maintenance for the projected order.
 *
 * Unified accounts use the server-computed per-collateral-token balance.
 * Standard accounts share Cross collateral only inside the selected DEX.
 * Portfolio Margin has a different liquidation model and deliberately fails
 * closed instead of being routed through the ordinary Cross formula.
 */
export const resolvePerpsProCrossMarginAvailableAfterMaintenance = ({
  accountFactsReady,
  dexCrossAccountValue,
  dexCrossMaintenanceMarginUsed,
  unifiedAvailableAfterMaintenance,
  userAbstraction,
}: {
  accountFactsReady: boolean;
  dexCrossAccountValue: string | null;
  dexCrossMaintenanceMarginUsed: string | null;
  unifiedAvailableAfterMaintenance: string | null;
  userAbstraction: string;
}): string | null => {
  if (!accountFactsReady) {
    return null;
  }
  if (userAbstraction === 'portfolioMargin') {
    return null;
  }
  if (userAbstraction === 'unifiedAccount') {
    return normalizeAvailable(unifiedAvailableAfterMaintenance);
  }

  const accountValue = new BigNumber(dexCrossAccountValue ?? Number.NaN);
  const maintenance = new BigNumber(
    dexCrossMaintenanceMarginUsed ?? Number.NaN,
  );
  if (
    !accountValue.isFinite() ||
    !maintenance.isFinite() ||
    maintenance.isNegative()
  ) {
    return null;
  }
  return normalizeAvailable(accountValue.minus(maintenance));
};
