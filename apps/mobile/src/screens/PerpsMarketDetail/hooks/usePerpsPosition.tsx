import { apisPerps } from '@/core/apis';
import { usePerpsState } from '@/hooks/perps/usePerpsState';
import { perpsStore, usePerpsStore } from '@/hooks/perps/usePerpsStore';
import { useMemoizedFn } from 'ahooks';
import * as Sentry from '@sentry/react-native';
import { Dimensions, Platform, Text } from 'react-native';
import { PERPS_BUILDER_INFO } from '@/constant/perps';
import { sleep } from '@/utils/async';
import { OrderResponse } from '@rabby-wallet/hyperliquid-sdk';
import { showToast } from '@/hooks/perps/showToast';
import { useShallow } from 'zustand/react/shallow';

export const usePerpsPosition = () => {
  const {
    fetchPositionOpenOrders,
    fetchClearinghouseState,
    setAccountNeedApproveAgent,
  } = usePerpsStore();
  const { currentPerpsAccount } = perpsStore(
    useShallow(s => ({
      currentPerpsAccount: s.currentPerpsAccount,
    })),
  );

  const formatTriggerPx = (px?: string) => {
    // avoid '.15' input error from hy validator
    // '.15' -> '0.15'
    return px ? Number(px).toString() : undefined;
  };

  const judgeIsUserAgentIsExpired = useMemoizedFn(
    async (errorMessage: string) => {
      const masterAddress = currentPerpsAccount?.address;
      if (!masterAddress) {
        return false;
      }

      const agentWalletPreference = await apisPerps.getAgentWalletPreference(
        masterAddress,
      );
      const agentAddress = agentWalletPreference?.agentAddress;
      if (agentAddress && errorMessage.includes(agentAddress)) {
        console.warn('handle action agent is expired, logout');
        showToast('Agent is expired, please try again', 'error');
        setAccountNeedApproveAgent(true);
        return true;
      }
    },
  );

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
          fetchClearinghouseState();
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
        setTimeout(() => {
          fetchPositionOpenOrders();
        }, 1000);
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
          fetchClearinghouseState();
          const { totalSz, avgPx } = filled;
          const msg = `Closed ${direction} ${coin}-USD: Size ${totalSz} at Price $${avgPx}`;
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
        await sdk.exchange?.updateLeverage({
          coin,
          leverage,
          isCross: marginMode === 'cross',
        });

        const promises = [
          sdk.exchange?.marketOrderOpen({
            coin,
            isBuy: direction === 'Long',
            size,
            midPx,
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
          fetchClearinghouseState();

          const { totalSz, avgPx } = filled;
          const msg = `Opened ${direction} ${coin}-USD: Size ${totalSz} at Price $${avgPx}`;
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

  return {
    handleOpenPosition,
    handleClosePosition,
    handleSetAutoClose,
    handleUpdateMargin,
    handleCancelOrder,
  };
};
