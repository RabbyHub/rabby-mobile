import { apisPerps } from '@/core/apis';
import {
  fetchAllDexsClearinghouseStateHttp,
  fetchClearinghouseStateHttp,
  fetchPositionOpenOrdersHttp,
  getDexByCoin,
  perpsStore,
} from '@/hooks/perps/usePerpsStore';
import { runPerpsAction } from '@/hooks/perps/perpsActionError';
import { useMemoizedFn } from 'ahooks';
import * as Sentry from '@sentry/react-native';
import { Dimensions, Platform } from 'react-native';
import {
  PERPS_BUILDER_INFO,
  PERPS_LIMIT_TIF_DEFAULT,
  type PerpsOpenOrderType,
} from '@/constant/perps';
import { sleep } from '@/utils/async';
import {
  AssetPosition,
  ClearinghouseState,
  OpenOrder,
  OrderResponse,
} from '@rabby-wallet/hyperliquid-sdk';
import { showToast } from '@/hooks/perps/showToast';
import { formatPerpsCoin } from '@/utils/perps';
import { Text } from '@/components/Typography';
import { useTranslation } from 'react-i18next';
import { executePerpsStableCoinOrder } from '@/hooks/perps/funding/perpsStableCoinOrder';
import type { PerpsStableCoinOrderParams } from '@/hooks/perps/funding/types';
import {
  buildPerpsCancelOrdersCommand,
  executePerpsCancelOrders,
} from '@/hooks/perps/actions/cancelOrders';

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
      return runPerpsAction(
        {
          fallback: undefined,
          label: actionText + ' cancel',
          getToastMessage: () => actionText + ' cancel error',
        },
        async () => {
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
        },
      );
    },
  );

  // Single round-trip for both single-cancel and "Cancel All". Returns the
  // oids that the SDK confirmed cancelled; callers use this to scope stats /
  // UI updates (empty array = all failed or agent expired).
  const handleCancelLimitOrders = useMemoizedFn(
    async (orders: OpenOrder[]): Promise<number[]> => {
      if (!orders.length) {
        return [];
      }
      return runPerpsAction(
        {
          fallback: [] as number[],
          label: 'cancel limit order',
          getToastMessage: () => t('page.perps.cancelOrderToast.failed'),
        },
        async () => {
          const account = perpsStore.getState().currentPerpsAccount;
          if (!account) {
            throw new Error('No currentPerpsAccount');
          }
          const command = buildPerpsCancelOrdersCommand(
            account,
            orders.map(order => ({ coin: order.coin, oid: order.oid })),
          );
          const result = await executePerpsCancelOrders(command);
          if (result.failureReason === 'userCancelled') {
            return [];
          }
          if (result.kind === 'staleContext') {
            throw new Error('Perps account changed');
          }
          const cancelledOids = result.items
            .filter(item => item.status === 'success')
            .map(item => item.oid);
          const okCount = cancelledOids.length;
          const failCount = result.items.length - okCount;

          if (okCount > 0 && failCount === 0) {
            showToast(
              orders.length === 1
                ? t('page.perps.cancelOrderToast.singleSuccess')
                : t('page.perps.cancelOrderToast.multiSuccess', {
                    count: okCount,
                  }),
              'success',
            );
            return cancelledOids;
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
                'cancel limit orders partial failure: ' +
                  JSON.stringify(result),
              ),
            );
            return cancelledOids;
          }
          throw new Error(
            result.items[0]?.error || t('page.perps.cancelOrderToast.failed'),
          );
        },
      );
    },
  );

  const handleUpdateMargin = useMemoizedFn(
    async (coin: string, action: 'add' | 'reduce', margin: number) => {
      const actionText = action === 'add' ? 'Add Margin' : 'Reduce Margin';
      return runPerpsAction(
        { fallback: undefined, label: actionText },
        async () => {
          const sdk = apisPerps.getPerpsSDK();
          const marginNormalized = action === 'add' ? margin : -margin;
          console.log('marginNormalized', marginNormalized);
          const res = await sdk.exchange?.updateIsolatedMargin({
            coin,
            value: marginNormalized,
          });
          if (res?.status === 'ok') {
            fetchClearinghouseStateHttp(getDexByCoin(coin));
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
        },
      );
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
      return runPerpsAction(
        { fallback: false, label: autoCloseText + ' set', context: params },
        async () => {
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

          fetchPositionOpenOrdersHttp(getDexByCoin(coin));
          showToast(autoCloseText + ' set successfully', 'success');
          return true;
        },
      );
    },
  );

  const handleClosePosition = useMemoizedFn(
    async (params: {
      coin: string;
      size: string;
      price: string;
      direction: 'Long' | 'Short';
      orderType?: PerpsOpenOrderType;
      limitPx?: string;
    }) => {
      return runPerpsAction(
        { fallback: null, label: 'close position', context: params },
        async () => {
          const sdk = apisPerps.getPerpsSDK();
          const { coin, direction, price, size, orderType, limitPx } = params;
          // Normalize like formatTriggerPx: the HL validator rejects
          // otherwise-valid inputs such as '.5' or '3000.'.
          const formattedLimitPx =
            orderType === 'limit' ? formatTriggerPx(limitPx) : undefined;
          if (orderType === 'limit' && !(Number(formattedLimitPx) > 0)) {
            // Fail loudly instead of silently degrading to a market close.
            throw new Error('Invalid Perps limit price');
          }
          // Close trades opposite the position: long -> sell, short -> buy.
          const res =
            orderType === 'limit' && formattedLimitPx
              ? await sdk.exchange?.limitOrderOpen({
                  coin,
                  isBuy: direction === 'Short',
                  size,
                  limitPx: formattedLimitPx,
                  tif: PERPS_LIMIT_TIF_DEFAULT,
                  reduceOnly: true,
                  builder: PERPS_BUILDER_INFO,
                })
              : await sdk.exchange?.marketOrderClose({
                  coin,
                  isBuy: direction === 'Short',
                  size,
                  midPx: price,
                  builder: PERPS_BUILDER_INFO,
                });

          const filled = res?.response?.data?.statuses[0]?.filled;
          const resting = res?.response?.data?.statuses[0]?.resting;
          if (orderType === 'limit' && resting) {
            // Limit closes usually rest in the book. Treat as success; fake an
            // avgPx from limitPx so callers' stats code keeps working, and set
            // `resting` so callers can tell nothing has filled yet.
            fetchPositionOpenOrdersHttp(getDexByCoin(coin));
            showToast(
              t(
                'page.perpsDetail.PerpsClosePositionPopup.limitClosePlacedToast',
                {
                  direction,
                  coin: formatPerpsCoin(coin),
                  size,
                  price: formattedLimitPx,
                },
              ),
              'success',
            );
            return {
              totalSz: size,
              avgPx: formattedLimitPx ?? '0',
              oid: resting.oid,
              resting: true,
            };
          }
          if (filled) {
            const { totalSz, avgPx } = filled;
            const msg = `Closed ${direction} ${formatPerpsCoin(
              coin,
            )}-USD: Size ${totalSz} at Price $${avgPx}`;
            fetchClearinghouseStateHttp(getDexByCoin(coin));
            showToast(msg, 'success');
            return res?.response?.data?.statuses[0]?.filled as {
              totalSz: string;
              avgPx: string;
              oid: number;
              resting?: boolean;
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
        },
      );
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
      orderType?: PerpsOpenOrderType;
      limitPx?: string;
    }) => {
      return runPerpsAction(
        { fallback: undefined, label: 'open position', context: params },
        async () => {
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
            orderType = 'market',
            limitPx,
          } = params;
          if (!params.isAddingPosition) {
            await sdk.exchange?.updateLeverage({
              coin,
              leverage,
              isCross: marginMode === 'cross',
            });
          }

          const formattedTpTriggerPx = formatTriggerPx(tpTriggerPx);
          const formattedSlTriggerPx = formatTriggerPx(slTriggerPx);

          const openCall =
            orderType === 'limit' && limitPx
              ? sdk.exchange?.limitOrderOpen({
                  coin,
                  isBuy: direction === 'Long',
                  size,
                  limitPx,
                  tif: PERPS_LIMIT_TIF_DEFAULT,
                  // Intentionally not forwarding tpTriggerPx / slTriggerPx in
                  // limit mode: TP/SL state may carry over from a previous
                  // market-mode session and the UI is hidden in limit mode, so
                  // the user has no chance to confirm them — passing them
                  // through would attach stale triggers to the limit order.
                  builder: PERPS_BUILDER_INFO,
                })
              : sdk.exchange?.marketOrderOpen({
                  coin,
                  isBuy: direction === 'Long',
                  size,
                  midPx,
                  builder: PERPS_BUILDER_INFO,
                });

          const promises = [openCall];

          // Market-open keeps the separate bindTpsl call. limitOrderOpen already
          // accepts tpTriggerPx / slTriggerPx natively, so no second call.
          if (orderType === 'market' && (tpTriggerPx || slTriggerPx)) {
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
          const resting = res?.response?.data?.statuses[0]?.resting;

          const dex = getDexByCoin(coin);
          if (filled) {
            const { totalSz, avgPx } = filled;
            const msg = `Opened ${direction} ${formatPerpsCoin(
              coin,
            )}: Size ${totalSz} at Price $${avgPx}`;
            fetchClearinghouseStateHttp(dex);
            showToast(msg, 'success');
            return res?.response?.data?.statuses[0]?.filled as {
              totalSz: string;
              avgPx: string;
              oid: number;
            };
          }

          if (orderType === 'limit' && resting) {
            // Limit orders frequently rest in the book instead of filling. Treat as
            // success and surface a "placed" toast; downstream stats code keys off
            // the returned shape so we fake an avgPx using limitPx.
            fetchPositionOpenOrdersHttp(dex);
            showToast(
              t(
                'page.perpsDetail.PerpsOpenPositionPopup.limitOrderPlacedToast',
                {
                  direction,
                  coin: formatPerpsCoin(coin),
                  size,
                  price: limitPx,
                },
              ),
              'success',
            );
            return {
              totalSz: size,
              avgPx: limitPx ?? '0',
              oid: resting.oid,
            };
          }

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
        },
      );
    },
  );

  const handleStableCoinOrder = useMemoizedFn(
    async (params: PerpsStableCoinOrderParams) =>
      executePerpsStableCoinOrder(currentPerpsAccount, params),
  );

  // One multiOrder of reduce-only IOC limits — one signature for all positions.
  const handleCloseAllPositions = useMemoizedFn(
    async (clearinghouseState: ClearinghouseState) => {
      return runPerpsAction(
        { fallback: null, label: 'close all positions' },
        async () => {
          const sdk = apisPerps.getPerpsSDK();
          const res = await sdk.exchange?.closeAllPositions(
            clearinghouseState,
            undefined,
            PERPS_BUILDER_INFO,
          );
          const statuses = res?.response?.data?.statuses ?? [];
          // SDK iterates assetPositions in order and skips szi === 0, so the
          // statuses array aligns 1:1 with this filtered list.
          const closableAssets: AssetPosition[] =
            clearinghouseState.assetPositions.filter(
              ap => parseFloat(ap.position.szi) !== 0,
            );
          const filledResults: {
            filled: { totalSz: string; avgPx: string; oid: number };
            position: AssetPosition['position'];
          }[] = [];
          statuses.forEach((s, i) => {
            const filled = (s as any).filled;
            const position = closableAssets[i]?.position;
            if (filled && position) {
              filledResults.push({ filled, position });
            }
          });

          if (filledResults.length === 0) {
            const firstErr = statuses.map(s => (s as any).error).find(Boolean);
            showToast(String(firstErr || 'close all error'), 'error');
            Sentry.captureException(
              new Error('PERPS close all noFills res: ' + JSON.stringify(res)),
            );
            return null;
          }

          // closeAllPositions can span all dexes — refresh the full set so
          // sub-dex positions also reflect the close.
          fetchAllDexsClearinghouseStateHttp();
          showToast('Closed all position successfully', 'success');
          return filledResults;
        },
      );
    },
  );

  return {
    handleOpenPosition,
    handleClosePosition,
    handleCloseAllPositions,
    handleSetAutoClose,
    handleUpdateMargin,
    handleCancelOrder,
    handleCancelLimitOrders,
    handleStableCoinOrder,
  };
};
