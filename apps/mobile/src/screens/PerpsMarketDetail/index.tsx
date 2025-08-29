/* eslint-disable react-native/no-inline-styles */
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { PerpsIntro } from './components/PerpsIntro';
import { PerpsHeaderTitle } from './components/PerpsHeaderTitle';
import { PerpsPosition } from './components/PerpsPosition';
import { PerpsInfo } from './components/PerpsInfo';
import { PerpsFooter } from './components/PerpsFooter';
import { PerpsOpenPositionPopup } from './components/PerpsOpenPositionPopup';
import { PerpsOpenPositionCheckPopup } from './components/PerpsOpenPositionCheckPopup';
import { PerpsClosePositionPopup } from './components/PerpsClosePositionPopup ';
import { PerpsAutoCloseModal } from './components/PerpsAutoCloseModal';
import { useRoute } from '@react-navigation/native';
import { GetNestedScreenNavigationProps } from '@/navigation-type';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { usePerpsState } from '@/hooks/perps/usePerpsState';
import { usePerpsStore } from '@/hooks/perps/usePerpsStore';
import { PerpsChart } from './components/PerpsChart';
import { useMemoizedFn } from 'ahooks';
import { apisPerps } from '@/core/apis';
import {
  CancelOrderParams,
  WsActiveAssetCtx,
} from '@rabby-wallet/hyperliquid-sdk';
import { usePerpsPosition } from './hooks/usePerpsPosition';
import { sortBy } from 'lodash';
import { PerpsHistorySection } from '../Perps/components/PerpsHistorySection';
import { PerpsDepositCard } from './components/PerpsDepositCard';
import { PerpsDepositPopup } from '../Perps/components/PerpsDepositPopup';
import { usePerpsDeposit } from '../Perps/hooks/usePerpsDeposit';

export const PerpsMarketDetailScreen = () => {
  const { t } = useTranslation();

  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });

  const navigation = useRabbyAppNavigation();

  const route =
    useRoute<
      GetNestedScreenNavigationProps<
        'TransactionNavigatorParamList',
        'PerpsMarketDetail'
      >['route']
    >();

  const marketName = route.params.market;
  const coin = marketName;

  const { state } = usePerpsStore();
  const { positionAndOpenOrders, accountSummary, marketDataMap, perpFee } =
    state;

  const {
    refreshData,
    handleOpenPosition,
    handleClosePosition,
    handleSetAutoClose,
    currentPerpsAccount,
    isLogin,
    userFills,
    hasPermission,
  } = usePerpsPosition();

  const {
    miniSignTx,
    clearMiniSignTx,
    updateMiniSignTx,
    handleDeposit,
    handleSignDepositDirect,
  } = usePerpsDeposit({
    currentPerpsAccount,
  });

  const [amountVisible, setAmountVisible] = useState(false);

  const market = useMemo(() => {
    return marketDataMap[marketName.toUpperCase()];
  }, [marketDataMap, marketName]);

  const singleCoinHistoryList = useMemo(() => {
    return sortBy(
      userFills.filter(fill => fill.coin.toLowerCase() === coin?.toLowerCase()),
      item => -item.time,
    );
  }, [userFills, coin]);

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

  // Subscribe to real-time candle updates
  useEffect(() => {
    const unsubscribe = subscribeActiveAssetCtx();

    return () => {
      // Cleanup WebSocket subscription
      unsubscribe?.();
    };
  }, [subscribeActiveAssetCtx]);

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
    return Boolean(tpPrice || slPrice);
  }, [tpPrice, slPrice]);

  const handleAutoCloseSwitch = useMemoizedFn(async (e: boolean) => {
    if (e) {
      setAutoCloseVisible(true);
    } else {
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
          coin: marketName,
        });
      }
      if (slOid) {
        cancelOrders.push({
          oid: slOid,
          coin: marketName,
        });
      }
      await sdk.exchange?.cancelOrder(cancelOrders);
      // message.success('Auto close position canceled successfully');
      refreshData();
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
      <NormalScreenContainer2024 type="bg2">
        <View style={styles.container}>
          <PerpsHistorySection
            ListHeaderComponent={
              <>
                <View style={styles.header}>
                  <PerpsChart
                    market={market}
                    markPrice={markPrice}
                    activeAssetCtx={activeAssetCtx}
                    currentAssetCtx={currentAssetCtx}
                  />
                  {isLogin ? (
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
                  slPrice={slPrice}
                  tpPrice={tpPrice}
                  onAutoCloseChange={handleAutoCloseSwitch}
                />
                <PerpsInfo market={market} />
              </>
            }
            ListFooterComponent={<PerpsIntro />}
            marketDataMap={marketDataMap}
            homeHistoryList={singleCoinHistoryList}
          />
        </View>
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
        onDeposit={async v => {
          await handleDeposit(v);
        }}
      />
      <PerpsOpenPositionPopup
        visible={openPositionVisible}
        direction={positionDirection}
        providerFee={providerFee}
        coin={coin}
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
      <PerpsClosePositionPopup
        visible={closePositionVisible}
        coin={coin}
        providerFee={providerFee}
        direction={positionDirection}
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
      <PerpsAutoCloseModal
        visible={autoCloseVisible}
        coin={coin}
        liqPrice={Number(currentPosition?.position.liquidationPx || 0)}
        type="hasPosition"
        price={positionData?.entryPrice || markPrice}
        direction={(positionData?.direction || 'Long') as 'Long' | 'Short'}
        size={Math.abs(positionData?.size || 0)}
        pxDecimals={currentAssetCtx?.szDecimals || 2}
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
        }}
      />
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
