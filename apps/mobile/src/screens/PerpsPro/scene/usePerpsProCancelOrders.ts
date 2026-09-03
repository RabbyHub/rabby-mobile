import { APP_VERSIONS } from '@/constant';
import type { Account } from '@/core/startupServices/preference';
import { isSamePerpsActionAccount } from '@/hooks/perps/actions/accountGuard';
import {
  buildPerpsCancelOrdersCommand,
  executePerpsCancelOrders,
} from '@/hooks/perps/actions/cancelOrders';
import { ensurePerpsActionApproval } from '@/hooks/perps/actions/perpsActionApproval';
import { isPerpsActionUserCancelled } from '@/hooks/perps/actions/actionError';
import {
  judgeIsBuilderFeeNeedApprove,
  judgeIsUserAgentIsExpired,
} from '@/hooks/perps/perpsActionError';
import { showToast } from '@/hooks/perps/showToast';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { getStatsReportSide } from '@/utils/perps';
import { stats } from '@/utils/stats';
import * as Sentry from '@sentry/react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  PerpsOpenOrderCategory,
  PerpsOpenOrderViewModel,
} from '../model/openOrder';

type VisibleCategory = Exclude<PerpsOpenOrderCategory, 'unsupported'>;

export interface PerpsProCancelConfirmation {
  account: Account;
  kind: 'all' | 'single';
  message: string;
  orders: PerpsOpenOrderViewModel[];
  title: string;
}

const reportCancelledOrders = (orders: PerpsOpenOrderViewModel[]) => {
  const account = perpsStore.getState().currentPerpsAccount;
  orders.forEach(order => {
    try {
      stats.report('perpsTradeHistory', {
        address_type: account?.type || '',
        app_version: APP_VERSIONS.fromNative || '0',
        coin: order.coin,
        created_at: Date.now(),
        leverage: '',
        margin_mode: '',
        price: order.executionPrice || '',
        service_provider: 'hyperliquid',
        size: order.amountBase,
        trade_side: getStatsReportSide(order.side === 'buy', false),
        trade_type: 'pro cancel limit order',
        trade_usd_value: order.amountQuote,
        user_addr: account?.address || '',
      });
    } catch {
      // Analytics must not change an already accepted cancellation result.
    }
  });
};

export const usePerpsProCancelOrders = () => {
  const { t } = useTranslation();
  const pendingRef = useRef(false);
  const [pendingOids, setPendingOids] = useState<number[]>([]);
  const [confirmation, setConfirmation] =
    useState<PerpsProCancelConfirmation | null>(null);
  const pendingOidSet = useMemo(() => new Set(pendingOids), [pendingOids]);

  const execute = useCallback(
    async (orders: PerpsOpenOrderViewModel[], expectedAccount: Account) => {
      if (pendingRef.current || orders.length === 0) {
        return;
      }
      if (
        !isSamePerpsActionAccount(
          perpsStore.getState().currentPerpsAccount,
          expectedAccount,
        )
      ) {
        showToast(t('page.perps.pro.openOrders.cancelContextChanged'), 'error');
        return;
      }

      pendingRef.current = true;
      setPendingOids(orders.map(order => order.oid));
      try {
        const command = buildPerpsCancelOrdersCommand(
          expectedAccount,
          orders.map(order => ({ coin: order.coin, oid: order.oid })),
        );
        await ensurePerpsActionApproval(expectedAccount, {
          builderFee: false,
        });
        const result = await executePerpsCancelOrders(command);
        if (result.failureReason === 'userCancelled') {
          return;
        }
        if (result.kind === 'staleContext') {
          showToast(
            t('page.perps.pro.openOrders.cancelContextChanged'),
            'error',
          );
          return;
        }

        const successOids = new Set(
          result.items
            .filter(item => item.status === 'success')
            .map(item => item.oid),
        );
        const successfulOrders = orders.filter(order =>
          successOids.has(order.oid),
        );
        if (successfulOrders.length > 0) {
          reportCancelledOrders(successfulOrders);
        }
        if (result.refreshError) {
          Sentry.captureException(
            new Error(
              `Perps Pro cancel refresh failed: ${result.refreshError}`,
            ),
          );
        }

        if (result.kind === 'success') {
          showToast(
            orders.length === 1
              ? t('page.perps.pro.openOrders.cancelSuccess')
              : t('page.perps.pro.openOrders.cancelAllSuccess', {
                  count: orders.length,
                }),
            'success',
          );
          return;
        }
        if (result.kind === 'partial') {
          showToast(
            t('page.perps.pro.openOrders.cancelPartial', {
              failed: orders.length - successfulOrders.length,
              success: successfulOrders.length,
            }),
            'error',
          );
          Sentry.captureException(
            new Error(`Perps Pro cancel partial: ${JSON.stringify(result)}`),
          );
          return;
        }

        const errorMessage = result.items[0]?.error || '';
        if (
          (errorMessage && (await judgeIsUserAgentIsExpired(errorMessage))) ||
          judgeIsBuilderFeeNeedApprove(errorMessage)
        ) {
          return;
        }
        showToast(t('page.perps.pro.openOrders.cancelFailed'), 'error');
        Sentry.captureException(
          new Error(`Perps Pro cancel failed: ${JSON.stringify(result)}`),
        );
      } catch (error) {
        if (isPerpsActionUserCancelled(error)) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        if (message === 'Perps account changed') {
          showToast(
            t('page.perps.pro.openOrders.cancelContextChanged'),
            'error',
          );
          return;
        }
        if (
          (await judgeIsUserAgentIsExpired(message)) ||
          judgeIsBuilderFeeNeedApprove(message)
        ) {
          return;
        }
        showToast(t('page.perps.pro.openOrders.cancelFailed'), 'error');
        Sentry.captureException(
          error instanceof Error ? error : new Error(String(error)),
          { extra: { scene: 'Perps Pro cancel orders' } },
        );
      } finally {
        pendingRef.current = false;
        setPendingOids([]);
      }
    },
    [t],
  );

  const confirmCancelOrder = useCallback(
    (order: PerpsOpenOrderViewModel) => {
      const account = perpsStore.getState().currentPerpsAccount;
      if (!account) {
        showToast(t('page.perps.pro.openOrders.cancelFailed'), 'error');
        return;
      }
      const accountSnapshot = { ...account };
      const orderSnapshot = { ...order };
      setConfirmation({
        account: accountSnapshot,
        kind: 'single',
        message: t('page.perps.pro.openOrders.cancelConfirmMessage', {
          symbol: order.coin,
        }),
        orders: [orderSnapshot],
        title: t('page.perps.pro.openOrders.cancelConfirmTitle'),
      });
    },
    [t],
  );

  const confirmCancelAll = useCallback(
    (orders: PerpsOpenOrderViewModel[], category: VisibleCategory) => {
      if (orders.length === 0) {
        return;
      }
      const account = perpsStore.getState().currentPerpsAccount;
      if (!account) {
        showToast(t('page.perps.pro.openOrders.cancelFailed'), 'error');
        return;
      }
      const accountSnapshot = { ...account };
      const orderSnapshots = orders.map(order => ({ ...order }));
      const isBasic = category === 'basic';
      setConfirmation({
        account: accountSnapshot,
        kind: 'all',
        message: t(
          isBasic
            ? 'page.perps.pro.openOrders.cancelAllBasicConfirmMessage'
            : 'page.perps.pro.openOrders.cancelAllConditionalConfirmMessage',
        ),
        orders: orderSnapshots,
        title: t(
          isBasic
            ? 'page.perps.pro.openOrders.cancelAllBasicConfirmTitle'
            : 'page.perps.pro.openOrders.cancelAllConditionalConfirmTitle',
        ),
      });
    },
    [t],
  );

  const dismissConfirmation = useCallback(() => setConfirmation(null), []);
  const confirmCancellation = useCallback(() => {
    if (!confirmation) {
      return;
    }
    const snapshot = confirmation;
    setConfirmation(null);
    void execute(snapshot.orders, snapshot.account);
  }, [confirmation, execute]);

  return {
    confirmation,
    confirmCancellation,
    confirmCancelAll,
    confirmCancelOrder,
    dismissConfirmation,
    isCancelAllPending: pendingOids.length > 0,
    isOrderPending: (oid: number) => pendingOidSet.has(oid),
  };
};
