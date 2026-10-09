import { apisPerps } from '@/core/apis/perps';
import type { Account } from '@/core/startupServices/preference';
import { isSamePerpsActionAccount } from '@/hooks/perps/actions/accountGuard';
import { ensurePerpsActionApproval } from '@/hooks/perps/actions/perpsActionApproval';
import { runPerpsAction } from '@/hooks/perps/perpsActionError';
import { showToast } from '@/hooks/perps/showToast';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import i18n from '@/utils/i18n';

import {
  normalizeSpotCancelIntents,
  type SpotCancelIntent,
  type SpotOrderSide,
  type SpotOrderType,
} from './spotMarkets';

export type PerpsSpotOrderParams = {
  pairIndex: number;
  side: SpotOrderSide;
  type: SpotOrderType;
  /** Already rounded to the base token szDecimals. */
  size: string;
  /** Already rounded to spot price rules. */
  limitPx: string;
};

export type PerpsSpotOrderResult =
  | { status: 'filled'; totalSz: string; avgPx: string; oid: number }
  | { status: 'resting'; oid: number };

// Same backend region gate as perps trading; checked before and after the
// approval step, which can await the network and the user.
const assertPermission = () => {
  if (!perpsStore.getState().hasPermission) {
    throw new Error(i18n.t('page.perps.regionNotSupport'));
  }
};

const assertActionAccount = async (account: Account | null) => {
  if (!account) {
    throw new Error('No current Perps account');
  }
  assertPermission();
  // Spot orders carry no builder field, only the agent must be approved.
  await ensurePerpsActionApproval(account, { builderFee: false });
  if (
    !isSamePerpsActionAccount(
      perpsStore.getState().currentPerpsAccount,
      account,
    )
  ) {
    throw new Error('Perps account changed');
  }
  assertPermission();
};

const getExchange = () => {
  const exchange = apisPerps.getPerpsSDK().exchange;
  if (!exchange) {
    throw new Error('Hyperliquid exchange client unavailable');
  }
  return exchange;
};

/**
 * Place a spot order. `buildParams` runs after the agent approval (which can
 * take a while) so the price, size and balance checks reflect the latest
 * market; returning null aborts without signing.
 */
export const executePerpsSpotOrder = (
  account: Account | null,
  pairIndex: number,
  buildParams: () => PerpsSpotOrderParams | null,
) =>
  runPerpsAction<PerpsSpotOrderResult | null>(
    {
      fallback: null,
      label: 'spot trade',
      context: { pairIndex },
    },
    async () => {
      await assertActionAccount(account);
      const params = buildParams();
      if (!params) {
        throw new Error(i18n.t('page.perpsSpot.error.contextChanged'));
      }
      const response = await getExchange().spotOrder({
        pairIndex: params.pairIndex,
        isBuy: params.side === 'buy',
        size: params.size,
        limitPx: params.limitPx,
        // Market orders must not rest on the book when they don't fill.
        tif: params.type === 'market' ? 'Ioc' : 'Gtc',
      });
      const status = response?.response?.data?.statuses?.[0];
      if (status?.filled) {
        showToast('Order filled', 'success');
        return { status: 'filled', ...status.filled };
      }
      if (status?.resting) {
        showToast('Order placed', 'success');
        return { status: 'resting', oid: status.resting.oid };
      }
      throw new Error(status?.error || 'Order failed');
    },
  );

const isCancelStatusOk = (status: unknown) =>
  status === 'success' ||
  (!!status &&
    typeof status === 'object' &&
    !!(status as { success?: boolean }).success);

const getCancelStatusError = (status: unknown) =>
  status && typeof status === 'object'
    ? (status as { error?: string }).error
    : undefined;

/** Cancel several spot orders in one signed action; true when all succeed. */
export const cancelAllPerpsSpotOrders = (
  account: Account | null,
  intents: SpotCancelIntent[],
) =>
  runPerpsAction<boolean>(
    {
      fallback: false,
      label: 'spot cancel all',
      context: { count: intents.length },
    },
    async () => {
      if (!intents.length) {
        return true;
      }
      const params = normalizeSpotCancelIntents(intents);
      await assertActionAccount(account);
      const response = await getExchange().cancelSpotOrders(params);
      const statuses: unknown[] = response?.response?.data?.statuses ?? [];
      const failed = statuses.find(status => !isCancelStatusOk(status));
      if (statuses.length === params.length && !failed) {
        showToast('Orders cancelled', 'success');
        return true;
      }
      throw new Error(getCancelStatusError(failed) || 'Cancel failed');
    },
  );

export const cancelPerpsSpotOrder = (
  account: Account | null,
  intent: SpotCancelIntent,
) =>
  runPerpsAction<boolean>(
    {
      fallback: false,
      label: 'spot cancel',
      context: intent,
    },
    async () => {
      const params = normalizeSpotCancelIntents([intent]);
      await assertActionAccount(account);
      const response = await getExchange().cancelSpotOrders(params);
      // The API answers "success" as a bare string; the SDK types it as an
      // object, so accept both shapes.
      const status: unknown = response?.response?.data?.statuses?.[0];
      const statusObj =
        status && typeof status === 'object'
          ? (status as { success?: boolean; error?: string })
          : null;
      if (status === 'success' || statusObj?.success) {
        showToast('Order cancelled', 'success');
        return true;
      }
      throw new Error(statusObj?.error || 'Cancel failed');
    },
  );
