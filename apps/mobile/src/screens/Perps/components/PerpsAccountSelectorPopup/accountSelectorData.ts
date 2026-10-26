import type { Account } from '@/core/startupServices/preference';
import type { ClearinghouseState } from '@rabby-wallet/hyperliquid-sdk';
import { sortBy } from 'lodash';
import type PQueue from 'p-queue';

export type PerpsAccountInfoByAddress = Record<
  string,
  ClearinghouseState | null
>;

/** Portfolio Value per lowercase address; null = not cached yet. */
export type PerpsPortfolioValueByAddress = Record<string, number | null>;

/** Reopening the selector within this window must not refetch portfolios. */
export const PERPS_SELECTOR_PORTFOLIO_MAX_AGE_MS = 5 * 60_000;
/** Drip the opening burst instead of firing all (up to 10) requests at once. */
export const PERPS_SELECTOR_PORTFOLIO_CONCURRENCY = 3;

/**
 * Rows with open positions first, then by Portfolio Value. The PV map is a
 * snapshot taken when the popup opens — NOT the live store — so responses
 * landing while the popup is open update row numbers without re-sorting the
 * list under the user's finger. An address with no cached PV yet falls back
 * to its withdrawable (same scale, always ≤ PV) so the first-ever open still
 * gets a sane order.
 */
export const buildPerpsAccountSelectorData = (
  accounts: Account[],
  infoByAddress?: PerpsAccountInfoByAddress,
  portfolioValueByAddress?: PerpsPortfolioValueByAddress,
) =>
  sortBy(
    accounts.map(account => ({
      account,
      info: infoByAddress?.[account.address.toLowerCase()] ?? null,
    })),
    item => -(item.info?.assetPositions?.length || 0),
    item =>
      -(
        portfolioValueByAddress?.[item.account.address.toLowerCase()] ??
        Number(item.info?.withdrawable || 0)
      ),
  );

/**
 * Queue one portfolio fetch per account, richest wallet first — p-queue runs
 * higher `priority` first, so the wallet total balance is the priority as-is.
 * Dedup (in-flight + freshness TTL) lives in the portfolio store, so
 * re-enqueueing the same address is a cheap no-op.
 */
export const enqueuePortfolioFetches = (
  queue: Pick<PQueue, 'add'>,
  accounts: Array<Pick<Account, 'address'> & { balance?: number }>,
  fetcher: (address: string) => Promise<void>,
) => {
  const getPriority = (account: (typeof accounts)[number]) => {
    const balance = Number(account.balance);
    return Number.isFinite(balance) ? balance : 0;
  };
  const prioritizedAccounts = [...accounts].sort(
    (left, right) => getPriority(right) - getPriority(left),
  );

  return prioritizedAccounts.map(account =>
    queue.add(() => fetcher(account.address), {
      priority: getPriority(account),
    }),
  );
};
