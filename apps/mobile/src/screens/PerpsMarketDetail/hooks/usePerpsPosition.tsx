import { apisPerps } from '@/core/apis';
import { usePerpsState } from '@/hooks/perps/usePerpsState';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { judgeIsUserAgentIsExpired } from '@/hooks/perps/judgeAgentExpired';
import { useMemoizedFn } from 'ahooks';
import * as Sentry from '@sentry/react-native';
import { Dimensions, Platform } from 'react-native';
import { PERPS_BUILDER_INFO } from '@/constant/perps';
import { sleep } from '@/utils/async';
import { OpenOrder, OrderResponse } from '@rabby-wallet/hyperliquid-sdk';
import { showToast } from '@/hooks/perps/showToast';
import { formatPerpsCoin } from '@/utils/perps';
import { Text } from '@/components/Typography';
import { useTranslation } from 'react-i18next';

export const usePerpsPosition = () => {
  const currentPerpsAccount = perpsStore(s => s.currentPerpsAccount);
  const { t } = useTranslation();

  const formatTriggerPx = (px?: string) => {
    // avoid '.15' input error from hy validator
    // '.15' -> '0.15'
    return px ? Number(px).toString() : undefined;
  };

  const handleCancelOrder = useMemoizedFn(
    async (oid: number, coin: string, actionType: 'tp' | 'sl') => {
      const actionText = actionType === 'tp' ? 'Take profit' : 'Stop loss';
      try {
        const sdk = apisPerps.getPerpsSDK();
        const res = await sdk.exchange?.cancelOrder([
          {
            oid,
            coin,
          },
        ]);
        if (
          res?.response.data.statuses.every(
            item => (item as unknown as string) === 'success',
          )
        ) {
          showToast(actionText + ' canceled successfully', 'success');
        } else {
          showToast(actionText + ' cancel error', 'error');
          Sentry.captureException(
            new Error(
              actionText + ' cancel error' + 'res: ' + JSON.stringify(res),
            ),
          );
        }
      } catch (error: any) {
        const isExpired = await judgeIsUserAgentIsExpired(error?.message || '');
        if (isExpired) {
          return;
        }
        showToast(actionText + ' cancel error', 'error');
        Sentry.captureException(
          new Error(
            actionText + ' cancel error' + 'error: ' + JSON.stringify(error),
          ),
        );
      }
    },
  );

  // Single round-trip for both single-cancel and "Cancel All". Returns true
  // when ≥1 order succeeded; on expired agent the dedicated toast already
  // fired so we suppress the generic failure one.
  const handleCancelLimitOrders = useMemoizedFn(async (orders: OpenOrder[]) => {
    if (!orders.length) {
      return false;
    }
    try {
      const sdk = apisPerps.getPerpsSDK();
      const res = await sdk.exchange?.cancelOrder(
        orders.map(o => ({ oid: o.oid, coin: o.coin })),
      );
      const statuses = res?.response.data.statuses ?? [];
      const okCount = statuses.filter(
        item => (item as unknown as string) === 'success',
      ).length;
      const failCount = statuses.length - okCount;

      if (okCount > 0 && failCount === 0) {
        showToast(
          orders.length === 1
            ? t('page.perps.cancelOrderToast.singleSuccess')
            : t('page.perps.cancelOrderToast.multiSuccess', {
                count: okCount,
              }),
          'success',
        );
        return true;
      }
      if (okCount > 0) {
        showToast(
          t('page.perps.cancelOrderToast.partial', {
            okCount,
            failCount,
          }),
          'success',
        );
        Sentry.captureException(
          new Error(
            'cancel limit orders partial failure: ' + JSON.stringify(res),
          ),
        );
        return true;
      }
      showToast(t('page.perps.cancelOrderToast.failed'), 'error');
      Sentry.captureException(
        new Error('cancel limit orders all failed: ' + JSON.stringify(res)),
      );
      return false;
    } catch (e: any) {
      const expired = await judgeIsUserAgentIsExpired(e?.message || '');
      if (expired) {
        return false;
      }
      console.error('cancel limit order error', e);
      showToast(t('page.perps.cancelOrderToast.failed'), 'error');
      Sentry.captureException(
        new Error('cancel limit order error: ' + JSON.stringify(e)),
      );
      return false;
    }
  });

  const handleUpdateMargin = useMemoizedFn(
    async (coin: string, action: 'add' | 'reduce', margin: number) => {
      const actionText = action === 'add' ? 'Add Margin' : 'Reduce Margin';
      try {
        const sdk = apisPerps.getPerpsSDK();
        const marginNormalized = action === 'add' ? margin : -margin;
        console.log('marginNormalized', marginNormalized);
        const res = await sdk.exchange?.updateIsolatedMargin({
          coin,
          value: marginNormalized,
        });
        if (res?.status === 'ok') {
          showToast(actionText + ' successfully', 'success');
        } else {
          showToast(
            res?.response?.data?.error || actionText + ' error',
            'error',
          );
          Sentry.captureException(
            new Error(actionText + ' error' + 'res: ' + JSON.stringify(res)),
          );
        }
      } catch (error: any) {
        const isExpired = await judgeIsUserAgentIsExpired(error?.message || '');
        if (isExpired) {
          return;
        }
        console.error(actionText + ' error', error);
        showToast(error?.message || actionText + ' error', 'error');
        Sentry.captureException(
          new Error(actionText + ' error' + 'error: ' + JSON.stringify(error)),
        );
      }
    },
  );

  const handleSetAutoClose = useMemoizedFn(
    async (params: {
      coin: string;
      tpTriggerPx: string;
      slTriggerPx: string;
      direction: 'Long' | 'Short';
    }) => {
      const autoCloseText = params.tpTriggerPx ? 'Take profit' : 'Stop loss';
      try {
        const sdk = apisPerps.getPerpsSDK();
        const { coin, tpTriggerPx, slTriggerPx, direction } = params;
        const formattedTpTriggerPx = formatTriggerPx(tpTriggerPx);
        const formattedSlTriggerPx = formatTriggerPx(slTriggerPx);
        const res = await sdk.exchange?.bindTpslByOrderId({
          coin,
          isBuy: direction === 'Long',
          tpTriggerPx: formattedTpTriggerPx,
          slTriggerPx: formattedSlTriggerPx,
          builder: PERPS_BUILDER_INFO,
        });

        const nextCurrentTpOrSl = {} as { tpPrice?: string; slPrice?: string };
        formattedTpTriggerPx &&
          (nextCurrentTpOrSl.tpPrice = formattedTpTriggerPx);
        formattedSlTriggerPx &&
          (nextCurrentTpOrSl.slPrice = formattedSlTriggerPx);
        showToast(autoCloseText + ' set successfully', 'success');
        return true;
      } catch (error: any) {
        const isExpired = await judgeIsUserAgentIsExpired(error?.message || '');
        if (isExpired) {
          return false;
        }
        showToast(error?.message || autoCloseText + ' set error', 'error');
        Sentry.captureException(
          new Error(
            autoCloseText +
              ' set error' +
              'params: ' +
              JSON.stringify(params) +
              'error: ' +
              JSON.stringify(error),
          ),
        );
        return false;
      }
    },
  );

  const handleClosePosition = useMemoizedFn(
    async (params: {
      coin: string;
      size: string;
      price: string;
      direction: 'Long' | 'Short';
    }) => {
      try {
        const sdk = apisPerps.getPerpsSDK();
        const { coin, direction, price, size } = params;
        const res = await sdk.exchange?.marketOrderClose({
          coin,
          isBuy: direction === 'Short',
          size,
          midPx: price,
          builder: PERPS_BUILDER_INFO,
        });

        const filled = res?.response?.data?.statuses[0]?.filled;
        if (filled) {
          const { totalSz, avgPx } = filled;
          const msg = `Closed ${direction} ${formatPerpsCoin(
            coin,
          )}-USD: Size ${totalSz} at Price $${avgPx}`;
          showToast(msg, 'success');
          return res?.response?.data?.statuses[0]?.filled as {
            totalSz: string;
            avgPx: string;
            oid: number;
          };
        } else {
          const msg = res?.response?.data?.statuses[0]?.error;
          showToast(msg || 'close position error', 'error');
          Sentry.captureException(
            new Error(
              'PERPS close position noFills ' +
                'params: ' +
                JSON.stringify(params) +
                'res: ' +
                JSON.stringify(res),
            ),
          );
          return null;
        }
      } catch (e: any) {
        const isExpired = await judgeIsUserAgentIsExpired(e?.message || '');
        if (isExpired) {
          return null;
        }
        console.error('close position error', e);
        showToast(e?.message || 'close position error', 'error');
        Sentry.captureException(
          new Error(
            'PERPS close position error' +
              'params: ' +
              JSON.stringify(params) +
              'error: ' +
              JSON.stringify(e),
          ),
        );
        return null;
      }
    },
  );

  const handleOpenPosition = useMemoizedFn(
    async (params: {
      coin: string;
      size: string;
      leverage: number;
      marginMode: 'cross' | 'isolated';
      direction: 'Long' | 'Short';
      midPx: string;
      tpTriggerPx?: string;
      slTriggerPx?: string;
      isAddingPosition?: boolean;
    }) => {
      try {
        const sdk = apisPerps.getPerpsSDK();
        const {
          coin,
          leverage,
          marginMode,
          direction,
          size,
          midPx,
          tpTriggerPx,
          slTriggerPx,
        } = params;
        if (!params.isAddingPosition) {
          await sdk.exchange?.updateLeverage({
            coin,
            leverage,
            isCross: marginMode === 'cross',
          });
        }

        const promises = [
          sdk.exchange?.marketOrderOpen({
            coin,
            isBuy: direction === 'Long',
            size,
            midPx,
            builder: PERPS_BUILDER_INFO,
          }),
        ];

        // avoid '.15' input error from hy validator
        const formattedTpTriggerPx = formatTriggerPx(tpTriggerPx);
        const formattedSlTriggerPx = formatTriggerPx(slTriggerPx);

        if (tpTriggerPx || slTriggerPx) {
          promises.push(
            (async () => {
              await sleep(10); // little delay to ensure nonce is correct
              const result = await sdk.exchange?.bindTpslByOrderId({
                coin,
                isBuy: direction === 'Long',
                tpTriggerPx: formattedTpTriggerPx,
                slTriggerPx: formattedSlTriggerPx,
                builder: PERPS_BUILDER_INFO,
              });
              return result as OrderResponse;
            })(),
          );
        }

        const results = await Promise.all(promises);
        const res = results[0];
        const filled = res?.response?.data?.statuses[0]?.filled;
        if (filled) {
          const { totalSz, avgPx } = filled;
          const msg = `Opened ${direction} ${formatPerpsCoin(
            coin,
          )}-USD: Size ${totalSz} at Price $${avgPx}`;
          showToast(msg, 'success');
          return res?.response?.data?.statuses[0]?.filled as {
            totalSz: string;
            avgPx: string;
            oid: number;
          };
        } else {
          const msg = res?.response?.data?.statuses[0]?.error;
          showToast(msg || 'open position error', 'error');
          Sentry.captureException(
            new Error(
              'PERPS open position noFills' +
                'params: ' +
                JSON.stringify(params) +
                'res: ' +
                JSON.stringify(res),
            ),
          );
        }
      } catch (error: any) {
        const isExpired = await judgeIsUserAgentIsExpired(error?.message || '');
        if (isExpired) {
          return;
        }
        console.error(error);
        showToast(error?.message || 'open position error', 'error');
        Sentry.captureException(
          new Error(
            'PERPS open position error' +
              'params: ' +
              JSON.stringify(params) +
              'error: ' +
              JSON.stringify(error),
          ),
        );
      }
    },
  );

  const handleStableCoinOrder = useMemoizedFn(
    async (params: {
      coin: 'USDH' | 'USDT' | 'USDE';
      isBuy: boolean;
      size: string;
      limitPx: string;
    }) => {
      try {
        if (
          params.coin !== 'USDH' &&
          params.coin !== 'USDT' &&
          params.coin !== 'USDE'
        ) {
          throw new Error('Invalid stablecoin');
        }

        const sdk = apisPerps.getPerpsSDK();
        const res = await sdk.exchange?.stableCoinOrder({
          coin: params.coin,
          isBuy: params.isBuy,
          size: params.size,
          limitPx: params.limitPx,
        });
        const filled = res?.response?.data?.statuses[0]?.filled;
        if (filled) {
          showToast('Swap completed successfully', 'success');
          return filled;
        }
        const errorMsg = res?.response?.data?.statuses[0]?.error;
        showToast(errorMsg || 'Swap failed', 'error');
        return null;
      } catch (error: any) {
        const isExpired = await judgeIsUserAgentIsExpired(error?.message || '');
        if (isExpired) {
          return null;
        }
        showToast(error?.message || 'Swap failed', 'error');
        Sentry.captureException(
          new Error(
            'PERPS spot order error' +
              'params: ' +
              JSON.stringify(params) +
              'error: ' +
              JSON.stringify(error),
          ),
        );
        return null;
      }
    },
  );

  return {
    handleOpenPosition,
    handleClosePosition,
    handleSetAutoClose,
    handleUpdateMargin,
    handleCancelOrder,
    handleCancelLimitOrders,
    handleStableCoinOrder,
  };
};
