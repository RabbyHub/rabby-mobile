import { toast } from '@/components2024/Toast';
import { apisPerps } from '@/core/apis';
import { usePerpsState } from '@/hooks/perps/usePerpsState';
import { usePerpsStore } from '@/hooks/perps/usePerpsStore';
import { useMemoizedFn } from 'ahooks';
import * as Sentry from '@sentry/react-native';
import { Dimensions, Platform, Text } from 'react-native';
import { PERPS_BUILDER_INFO } from '@/constant/perps';
import { sleep } from '@/utils/async';
import { OrderResponse } from '@rabby-wallet/hyperliquid-sdk';

export const usePerpsPosition = ({
  setCurrentTpOrSl,
}: {
  setCurrentTpOrSl: (params: { tpPrice?: string; slPrice?: string }) => void;
}) => {
  const {
    fetchPositionOpenOrders,
    logout: _logout,
    fetchClearinghouseState,
    fetchUserHistoricalOrders,
  } = usePerpsStore();
  const {
    refreshData,
    userFills,
    currentPerpsAccount,
    isLogin,
    hasPermission,

    judgeIsUserAgentIsExpired,
  } = usePerpsState();

  const logout = useMemoizedFn((address: string) => {
    _logout();
    apisPerps.setPerpsCurrentAccount(null);
    apisPerps.setSendApproveAfterDeposit(address, []);
  });

  const handleSetAutoClose = useMemoizedFn(
    async (params: {
      coin: string;
      tpTriggerPx: string;
      slTriggerPx: string;
      direction: 'Long' | 'Short';
    }) => {
      try {
        const sdk = apisPerps.getPerpsSDK();
        const { coin, tpTriggerPx, slTriggerPx, direction } = params;
        const res = await sdk.exchange?.bindTpslByOrderId({
          coin,
          isBuy: direction === 'Long',
          tpTriggerPx,
          slTriggerPx,
          builder: PERPS_BUILDER_INFO,
        });

        setCurrentTpOrSl({
          tpPrice: tpTriggerPx,
          slPrice: slTriggerPx,
        });
        setTimeout(() => {
          fetchPositionOpenOrders();
        }, 1000);
        toast.success('Auto close set successfully');
      } catch (error: any) {
        const isExpired = await judgeIsUserAgentIsExpired(error?.message || '');
        if (isExpired) {
          return;
        }
        toast.error(error?.message || 'Set auto close error');
        Sentry.captureException(
          new Error(
            'Set auto close error' +
              'params: ' +
              JSON.stringify(params) +
              'error: ' +
              JSON.stringify(error),
          ),
        );
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
          // no need
          // fetchUserHistoricalOrders();
          const { totalSz, avgPx } = filled;
          const msg = `Closed ${direction} ${coin}-USD: Size ${totalSz} at Price $${avgPx}`;
          toast.success(
            Platform.OS === 'android'
              ? ({ textStyle }) => (
                  <Text
                    style={[
                      textStyle,
                      {
                        maxWidth: Dimensions.get('window').width - 100,
                      },
                    ]}>
                    {msg}
                  </Text>
                )
              : msg,
          );
          setCurrentTpOrSl({
            tpPrice: undefined,
            slPrice: undefined,
          });
          return res?.response?.data?.statuses[0]?.filled as {
            totalSz: string;
            avgPx: string;
            oid: number;
          };
        } else {
          const msg = res?.response?.data?.statuses[0]?.error;
          toast.error(msg || 'close position error');
          Sentry.captureException(
            new Error(
              'PERPS close position noFills' +
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
        toast.error(e?.message || 'close position error');
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
          direction,
          size,
          midPx,
          tpTriggerPx,
          slTriggerPx,
        } = params;
        await sdk.exchange?.updateLeverage({
          coin,
          leverage,
          isCross: false,
        });

        const promises = [
          sdk.exchange?.marketOrderOpen({
            coin,
            isBuy: direction === 'Long',
            size,
            midPx,
          }),
        ];

        if (tpTriggerPx || slTriggerPx) {
          promises.push(
            (async () => {
              await sleep(10); // little delay to ensure nonce is correct
              const result = await sdk.exchange?.bindTpslByOrderId({
                coin,
                isBuy: direction === 'Long',
                tpTriggerPx,
                slTriggerPx,
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
          toast.success(
            Platform.OS === 'android'
              ? ({ textStyle }) => (
                  <Text
                    style={[
                      textStyle,
                      {
                        maxWidth: Dimensions.get('window').width - 100,
                      },
                    ]}>
                    {msg}
                  </Text>
                )
              : msg,
          );
          setCurrentTpOrSl({
            tpPrice: tpTriggerPx,
            slPrice: slTriggerPx,
          });
          return res?.response?.data?.statuses[0]?.filled as {
            totalSz: string;
            avgPx: string;
            oid: number;
          };
        } else {
          const msg = res?.response?.data?.statuses[0]?.error;
          toast.error(msg || 'open position error');
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
        toast.error(error?.message || 'open position error');
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
    userFills,
    isLogin,
    currentPerpsAccount,
    hasPermission,
  };
};
