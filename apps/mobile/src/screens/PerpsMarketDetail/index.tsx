import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { apisPerps } from '@/core/apis';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { usePerpsStore } from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { GetNestedScreenRouteProp } from '@/navigation-type';
import { createGetStyles2024 } from '@/utils/styles';
import {
  CancelOrderParams,
  WsActiveAssetCtx,
} from '@rabby-wallet/hyperliquid-sdk';
import { useRoute } from '@react-navigation/native';
import { useMemoizedFn } from 'ahooks';
import { sortBy } from 'lodash';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { PerpsDepositPopup } from '../Perps/components/PerpsDepositPopup';
import { PerpsHistorySection } from '../Perps/components/PerpsHistorySection';
import { usePerpsDeposit } from '../Perps/hooks/usePerpsDeposit';
import { PerpsAutoCloseModal } from './components/PerpsAutoCloseModal';
import { PerpsChart } from './components/PerpsChart';
import { PerpsClosePositionPopup } from './components/PerpsClosePositionPopup ';
import { PerpsDepositCard } from './components/PerpsDepositCard';
import { PerpsFooter } from './components/PerpsFooter';
import { PerpsHeaderTitle } from './components/PerpsHeaderTitle';
import { PerpsInfo } from './components/PerpsInfo';
import { PerpsIntro } from './components/PerpsIntro';
import { PerpsOpenPositionPopup } from './components/PerpsOpenPositionPopup';
import { PerpsPosition } from './components/PerpsPosition';
import { usePerpsPosition } from './hooks/usePerpsPosition';
import { toast } from '@/components2024/Toast';
import * as Sentry from '@sentry/react-native';
import { PERPS_MAX_NTL_VALUE } from '@/constant/perps';
import { PerpsRegionAlert } from '../Perps/components/PerpsRegionAlert';
import { trigger } from 'react-native-haptic-feedback';
import { useAppState } from '@react-native-community/hooks';

export const PerpsMarketDetailScreen = () => {
  const { t } = useTranslation();

  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });

  const navigation = useRabbyAppNavigation();

  const route =
    useRoute<
      GetNestedScreenRouteProp<
        'TransactionNavigatorParamList',
        'PerpsMarketDetail'
      >
    >();

  const marketName = route.params.market;
  const coin = marketName;

  const { state, fetchPositionOpenOrders } = usePerpsStore();
  const { positionAndOpenOrders, accountSummary, marketDataMap, perpFee } =
    state;

  // const {
  //   refreshData,
  //   handleOpenPosition,
  //   handleClosePosition,
  //   handleSetAutoClose,
  //   currentPerpsAccount,
  //   isLogin,
  //   userFills,
  //   hasPermission,
  // } = usePerpsPosition();

  const [amountVisible, setAmountVisible] = useState(false);

  const market = useMemo(() => {
    return marketDataMap[marketName.toUpperCase()];
  }, [marketDataMap, marketName]);

  const [activeAssetCtx, setActiveAssetCtx] = React.useState<
    WsActiveAssetCtx['ctx'] | null
  >(null);

  const [openPositionVisible, setOpenPositionVisible] = React.useState(false);
  const [positionDirection, setPositionDirection] = React.useState<
    'Long' | 'Short'
  >('Long');
  const [closePositionVisible, setClosePositionVisible] = React.useState(false);
  const [autoCloseVisible, setAutoCloseVisible] = useState(false);

  // 查找当前币种的仓位信息
  const currentPosition = useMemo(() => {
    return positionAndOpenOrders?.find(
      asset => asset.position.coin.toLowerCase() === coin?.toLowerCase(),
    );
  }, [positionAndOpenOrders, coin]);

  const providerFee = React.useMemo(() => {
    return perpFee;
  }, [perpFee]);

  const currentAssetCtx = useMemo(() => {
    return marketDataMap[coin.toUpperCase()];
  }, [marketDataMap, coin]);

  const { tpPrice, slPrice, tpOid, slOid } = useMemo(() => {
    if (
      !currentPosition ||
      !currentPosition.openOrders ||
      !currentPosition.openOrders.length
    ) {
      return {
        tpPrice: undefined,
        slPrice: undefined,
        tpOid: undefined,
        slOid: undefined,
      };
    }

    const tpItem = currentPosition.openOrders.find(
      order =>
        order.orderType === 'Take Profit Market' &&
        order.isTrigger &&
        order.reduceOnly,
    );

    const slItem = currentPosition.openOrders.find(
      order =>
        order.orderType === 'Stop Market' &&
        order.isTrigger &&
        order.reduceOnly,
    );

    return {
      tpPrice: tpItem?.triggerPx,
      slPrice: slItem?.triggerPx,
      tpOid: tpItem?.oid,
      slOid: slItem?.oid,
    };
  }, [currentPosition]);

  const [currentTpOrSl, setCurrentTpOrSl] = useState<{
    tpPrice?: string;
    slPrice?: string;
  }>({
    tpPrice: tpPrice,
    slPrice: slPrice,
  });

  const {
    handleOpenPosition,
    handleClosePosition,
    handleSetAutoClose,
    currentPerpsAccount,
    isLogin,
    userFills,
    hasPermission,
  } = usePerpsPosition({
    setCurrentTpOrSl,
  });

  const { handleDeposit } = usePerpsDeposit({
    currentPerpsAccount,
  });

  const lineTagInfo = useMemo(() => {
    return {
      tpPrice: Number(currentTpOrSl.tpPrice || 0),
      slPrice: Number(currentTpOrSl.slPrice || 0),
      liquidationPrice: Number(currentPosition?.position.liquidationPx || 0),
      entryPrice: Number(currentPosition?.position.entryPx || 0),
    };
  }, [
    currentPosition?.position.entryPx,
    currentPosition?.position.liquidationPx,
    currentTpOrSl.slPrice,
    currentTpOrSl.tpPrice,
  ]);

  const singleCoinHistoryList = useMemo(() => {
    return sortBy(
      userFills.filter(fill => fill.coin.toLowerCase() === coin?.toLowerCase()),
      item => -item.time,
    );
  }, [userFills, coin]);

  const hasPosition = useMemo(() => {
    return !!currentPosition;
  }, [currentPosition]);

  const subscribeActiveAssetCtx = useMemoizedFn(() => {
    const sdk = apisPerps.getPerpsSDK();
    const { unsubscribe } = sdk.ws.subscribeToActiveAssetCtx(coin, data => {
      setActiveAssetCtx(data.ctx);
    });

    return () => {
      unsubscribe();
    };
  });

  const appState = useAppState();
  const unsubscribeActiveAssetRef = useRef<() => void>(() => {});

  // Subscribe to real-time candle updates
  useEffect(() => {
    if (appState === 'active') {
      const unsubscribe = subscribeActiveAssetCtx();
      unsubscribeActiveAssetRef.current = unsubscribe;
      return () => {
        unsubscribe?.();
      };
    } else {
      if (unsubscribeActiveAssetRef.current) {
        unsubscribeActiveAssetRef.current();
        unsubscribeActiveAssetRef.current = () => {};
      }
    }
  }, [subscribeActiveAssetCtx, appState]);

  // Available balance for trading
  const availableBalance = Number(accountSummary?.withdrawable || 0);

  const markPrice = useMemo(() => {
    return Number(activeAssetCtx?.markPx || currentAssetCtx?.markPx || 0);
  }, [activeAssetCtx?.markPx, currentAssetCtx?.markPx]);

  // Position data if exists
  const positionData = currentPosition
    ? {
        pnl: Number(currentPosition.position.unrealizedPnl || 0),
        positionValue: Number(currentPosition.position.positionValue || 0),
        size: Math.abs(Number(currentPosition.position.szi || 0)),
        marginUsed: Number(currentPosition.position.marginUsed || 0),
        side: Number(currentPosition.position.szi || 0) > 0 ? 'Long' : 'Short',
        type: currentPosition.position.leverage.type,
        leverage: Number(currentPosition.position.leverage.value || 1),
        entryPrice: Number(currentPosition.position.entryPx || 0),
        liquidationPrice: Number(
          currentPosition.position.liquidationPx || 0,
        ).toFixed(currentAssetCtx?.pxDecimals || 2),
        autoClose: false, // This would come from SDK
        direction:
          Number(currentPosition.position.szi || 0) > 0 ? 'Long' : 'Short',
        pnlPercent: Number(currentPosition.position.returnOnEquity || 0) * 100,
        fundingPayments: currentPosition.position.cumFunding.sinceOpen,
      }
    : null;

  const hasAutoClose = useMemo(() => {
    return Boolean(currentTpOrSl.tpPrice || currentTpOrSl.slPrice);
  }, [currentTpOrSl]);

  const handleAutoCloseSwitch = useMemoizedFn(async (e: boolean) => {
    trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    if (e) {
      setAutoCloseVisible(true);
    } else {
      try {
        // 取消所有止盈止损订单
        const sdk = apisPerps.getPerpsSDK();
        if (!tpOid && !slOid) {
          console.error('no find auto close order id');
          return;
        }

        const cancelOrders: CancelOrderParams[] = [];
        if (tpOid) {
          cancelOrders.push({
            oid: tpOid,
            coin,
          });
        }
        if (slOid) {
          cancelOrders.push({
            oid: slOid,
            coin,
          });
        }
        const res = await sdk.exchange?.cancelOrder(cancelOrders);
        if (
          res?.response.data.statuses.every(
            item => (item as unknown as string) === 'success',
          )
        ) {
          toast.success('Auto close canceled successfully');
          setCurrentTpOrSl({
            tpPrice: undefined,
            slPrice: undefined,
          });
          setTimeout(() => {
            fetchPositionOpenOrders();
          }, 1000);
        } else {
          toast.error('Auto close cancel error');
          Sentry.captureException(
            new Error(
              'Auto close cancel error' +
                'cancelOrders: ' +
                JSON.stringify(cancelOrders) +
                'res: ' +
                JSON.stringify(res),
            ),
          );
        }
      } catch (error) {
        toast.error('Auto close cancel error');
        Sentry.captureException(
          new Error(
            'Auto close position cancel error' +
              'error: ' +
              JSON.stringify(error),
          ),
        );
      }
    }
  });

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => <PerpsHeaderTitle market={market} />,
    });
  }, [market, navigation]);

  if (!market) {
    return null;
  }

  return (
    <>
      <NormalScreenContainer2024 type={isLight ? 'bg0' : 'bg1'}>
        {!hasPermission ? <PerpsRegionAlert /> : null}
        <ScrollView
          style={styles.container}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <PerpsChart
              market={market}
              markPrice={markPrice}
              activeAssetCtx={activeAssetCtx}
              currentAssetCtx={currentAssetCtx}
              lineTagInfo={lineTagInfo}
            />
            {isLogin && !hasPosition ? (
              <PerpsDepositCard
                availableBalance={availableBalance}
                onDepositPress={() => {
                  setAmountVisible(true);
                }}
              />
            ) : null}
          </View>
          <PerpsPosition
            positionData={positionData}
            coin={coin}
            hasAutoClose={hasAutoClose}
            slPrice={currentTpOrSl.slPrice}
            tpPrice={currentTpOrSl.tpPrice}
            onAutoCloseChange={handleAutoCloseSwitch}
          />
          <PerpsInfo market={market} activeAssetCtx={activeAssetCtx} />
          <PerpsHistorySection
            coin={coin}
            marketDataMap={marketDataMap}
            historyList={singleCoinHistoryList}
          />
          <PerpsIntro />
        </ScrollView>
        {isLogin ? (
          <PerpsFooter
            hasPermission={hasPermission}
            hasPosition={hasPosition}
            direction={positionData?.direction}
            onLongPress={() => {
              setPositionDirection('Long');
              setOpenPositionVisible(true);
            }}
            onShortPress={() => {
              setPositionDirection('Short');
              setOpenPositionVisible(true);
            }}
            onClosePress={() => {
              setClosePositionVisible(true);
            }}
          />
        ) : null}
      </NormalScreenContainer2024>

      <PerpsDepositPopup
        account={currentPerpsAccount}
        visible={amountVisible}
        onClose={() => {
          setAmountVisible(false);
        }}
        onDeposit={async (txs, amount, cacheBridgeHistory) => {
          try {
            await handleDeposit(txs, amount, cacheBridgeHistory);
          } catch (e) {
            console.error(e);
          }
          setAmountVisible(false);
        }}
      />
      <PerpsOpenPositionPopup
        visible={openPositionVisible}
        direction={positionDirection}
        providerFee={providerFee}
        maxNtlValue={Number(
          currentAssetCtx?.maxUsdValueSize || PERPS_MAX_NTL_VALUE,
        )}
        coin={coin}
        coinLogo={currentAssetCtx?.logoUrl}
        pxDecimals={currentAssetCtx?.pxDecimals || 2}
        szDecimals={currentAssetCtx?.szDecimals || 0}
        leverageRang={[1, currentAssetCtx?.maxLeverage || 5]}
        markPrice={markPrice}
        availableBalance={Number(accountSummary?.withdrawable || 0)}
        onCancel={() => setOpenPositionVisible(false)}
        handleOpenPosition={handleOpenPosition}
        onConfirm={() => {
          setOpenPositionVisible(false);
        }}
      />
      {positionData ? (
        <PerpsClosePositionPopup
          visible={closePositionVisible}
          coin={coin}
          providerFee={providerFee}
          direction={positionData?.direction as 'Long' | 'Short'}
          positionSize={positionData?.size.toString() || '0'}
          pnl={positionData?.pnl || 0}
          onCancel={() => setClosePositionVisible(false)}
          onConfirm={() => {
            setClosePositionVisible(false);
          }}
          handleClosePosition={async () => {
            await handleClosePosition({
              coin,
              size: positionData?.size.toString() || '0',
              direction: positionData?.direction as 'Long' | 'Short',
              price: (activeAssetCtx?.markPx as unknown as string) || '0',
            });
          }}
        />
      ) : null}

      {autoCloseVisible ? (
        <PerpsAutoCloseModal
          visible={autoCloseVisible}
          coin={coin}
          liqPrice={Number(currentPosition?.position.liquidationPx || 0) || 0}
          type="hasPosition"
          price={positionData?.entryPrice || markPrice}
          direction={(positionData?.direction || 'Long') as 'Long' | 'Short'}
          size={Math.abs(positionData?.size || 0)}
          pxDecimals={currentAssetCtx?.pxDecimals || 2}
          onClose={() => setAutoCloseVisible(false)}
          handleSetAutoClose={async (params: {
            tpPrice: string;
            slPrice: string;
          }) => {
            await handleSetAutoClose({
              coin,
              tpTriggerPx: params.tpPrice,
              slTriggerPx: params.slPrice,
              direction: positionData?.direction as 'Long' | 'Short',
            });
            setAutoCloseVisible(false);
          }}
        />
      ) : null}
    </>
  );
};

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 16,
    position: 'relative',
  },
  scrollContent: {
    paddingBottom: 56,
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 30,
  },
  chart: {
    backgroundColor: colors2024['neutral-bg-1'],
    height: 322,
    borderRadius: 20,
  },
}));
