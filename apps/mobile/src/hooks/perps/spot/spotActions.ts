import { apisPerps } from '@/core/apis/perps';
import type { Account } from '@/core/startupServices/preference';
import { isSamePerpsActionAccount } from '@/hooks/perps/actions/accountGuard';
import { ensurePerpsActionApproval } from '@/hooks/perps/actions/perpsActionApproval';
import { runPerpsAction } from '@/hooks/perps/perpsActionError';
import { showToast } from '@/hooks/perps/showToast';
import { perpsStore } from '@/hooks/perps/usePerpsStore';

import type { SpotOrderSide, SpotOrderType } from './spotMarkets';

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

const assertActionAccount = async (account: Account | null) => {
  if (!account) {
    throw new Error('No current Perps account');
  }
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
};

const getExchange = () => {
  const exchange = apisPerps.getPerpsSDK().exchange;
  if (!exchange) {
    throw new Error('Hyperliquid exchange client unavailable');
  }
  return exchange;
};

export const executePerpsSpotOrder = (
  account: Account | null,
  params: PerpsSpotOrderParams,
) =>
  runPerpsAction<PerpsSpotOrderResult | null>(
    {
      fallback: null,
      label: 'spot trade',
      context: params,
    },
    async () => {
      await assertActionAccount(account);
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

export const cancelPerpsSpotOrder = (
  account: Account | null,
  params: { pairIndex: number; oid: number },
) =>
  runPerpsAction<boolean>(
    {
      fallback: false,
      label: 'spot cancel',
      context: params,
    },
    async () => {
      await assertActionAccount(account);
      const response = await getExchange().cancelSpotOrders([params]);
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
