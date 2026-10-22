import {
  createAccountHeaderPresentation,
  simplePositionPriceText,
  type AccountHeaderHandle,
} from './components/account/model';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { apisPerps } from '@/core/apis';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { GetNestedScreenRouteProp } from '@/navigation-type';
import { createGetStyles2024 } from '@/utils/styles';
import { useRoute } from '@react-navigation/native';
import { sortBy } from 'lodash';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { PerpsSimpleChartScrollView } from './components/chart/PerpsSimplePriceAxis';
import { PerpsDepositPopup } from '../Perps/components/PerpsDepositPopup';
import { EnableUnifiedAccountPopup } from '../Perps/components/EnableUnifiedAccountPopup';
import { PerpsSpotSwapPopup } from '../Perps/components/PerpsSpotSwapPopup';
import BigNumber from 'bignumber.js';
import { PerpsHistorySection } from '../Perps/components/PerpsHistorySection';
import { usePerpsDeposit } from '../Perps/hooks/usePerpsDeposit';
import { PerpsChart } from './components/PerpsChart';
import { PerpsSimpleChartSource } from './components/chart/PerpsSimpleChartSource';
import { PerpsClosePositionPopup } from './components/PerpsClosePositionPopup';
import { PerpsDepositCard } from './components/PerpsDepositCard';
import { PerpsFooter } from './components/PerpsFooter';
import { PerpsHeaderTitle } from './components/PerpsHeaderTitle';
import { PerpsAbout } from './components/PerpsAbout';
import { PerpsOpenPositionPopup } from './components/PerpsOpenPositionPopup';
import { PerpsPosition } from './components/PerpsPosition';
import { usePerpsPosition } from './hooks/usePerpsPosition';
import { useSimplePositionTpSl } from './hooks/useSimplePositionTpSl';
import { useActiveAssetSubscription } from './hooks/useActiveAssetSubscription';
import { PERPS_MAX_NTL_VALUE } from '@/constant/perps';
import { PerpsRegionAlert } from '../Perps/components/PerpsRegionAlert';

import { usePerpsPopupState } from '../Perps/hooks/usePerpsPopupState';

import { naviReplace } from '@/utils/navigation';
import { RootNames, getBottomButtonBottomOffset } from '@/constant/layout';
import { PerpsAddPositionPopup } from './components/PerpsAddPositionPopup';
import { PerpsLimitOrdersForCoin } from './components/PerpsLimitOrdersForCoin';
import { usePerpsState } from '@/hooks/perps/usePerpsState';
import { showToast } from '@/hooks/perps/showToast';
import { PerpsAgentsLimitModal } from '../Perps/components/PerpsAgentsLimitModal';
import { PerpsPositionSkeletonLoader } from '../Perps/components/PerpsSkeletonLoader';
import { usePerpsAccount } from '@/hooks/perps/usePerpsAccount';
import { stats } from '@/utils/stats';
import { getStatsReportSide, isLimitOrder } from '@/utils/perps';
import { APP_VERSIONS } from '@/constant';
import { Text } from '@/components/Typography';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils/src/types';
import { withWalletUnlock } from '@/utils/walletUnlockGuard';

export const PerpsMarketDetailScreen = () => {
  const scrollGesture = useMemo(
    () => (Platform.OS === 'ios' ? Gesture.Native() : undefined),
    [],
  );
  const { t } = useTranslation();

  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });
  const [popupState, setPopupState] = usePerpsPopupState();
  const [isShowDepositPopup, setIsShowDepositPopup] = useState(false);

  const navigation = useRabbyAppNavigation();

  const route =
    useRoute<
      GetNestedScreenRouteProp<
        'TransactionNavigatorParamList',
        'PerpsMarketDetail'
      >
    >();

  const {
    market: marketName,
    fromSource,
    showOpenPosition,
    direction,
  } = route.params;
  const [coin, setCoin] = useState(marketName);

  const {
    isInitialized,
    positionAndOpenOrders,
    perpFee,
    hasPermission,
    currentPerpsAccount,
    isLogin,
    userFills,
    accountNeedApproveAgent,
    accountNeedApproveBuilderFee,
    handleActionApproveStatus,

    handleDeleteAgent,
    handleEnableUnifiedAccount,
  } = usePerpsState();

  const currentAssetCtx = perpsStore(s => s.marketDataMap[coin]);
  // const hasPermission = true;
  const [showRiskPopup, setShowRiskPopup] = useState(false);
  // useEffect(() => {
  //   const needDepositFirst =
  //     Number(accountValue) === 0 && Number(availableBalance) === 0;
  //   const isLocalWallet =
  //     currentPerpsAccount?.type === KEYRING_CLASS.PRIVATE_KEY ||
  //     currentPerpsAccount?.type === KEYRING_CLASS.MNEMONIC;
  //   if (isLocalWallet && !needDepositFirst) {
  //     // deposit first before approve agent
  //     handleActionApproveStatus({
  //       isHideToast: true,
  //     });
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, []);

  const {
    activeAssetCtx,
    displayAssetCtx,
    activeAssetData,
    refreshActiveAssetData,
  } = useActiveAssetSubscription(coin, { trackContextFreshness: true });

  const [positionDirection, setPositionDirection] = React.useState<
    'Long' | 'Short'
  >(direction || 'Long');
  const [closePositionVisible, setClosePositionVisible] = React.useState(false);
  const [addPositionVisible, setAddPositionVisible] = React.useState(false);

  const currentPosition = useMemo(() => {
    return positionAndOpenOrders?.find(
      asset => asset.position.coin.toLowerCase() === coin?.toLowerCase(),
    );
  }, [positionAndOpenOrders, coin]);

  const providerFee = perpFee;

  const {
    handleOpenPosition,
    handleClosePosition,
    handleSetAutoClose: setTpSlOrder,
    handleCancelOrder,
    handleUpdateMargin,
    handleStableCoinOrder,
  } = usePerpsPosition();

  const {
    tpPrice,
    slPrice,
    tpPending,
    slPending,
    tpCancelling,
    slCancelling,
    contextKey: tpSlContextKey,
    handleSetAutoClose,
    handleCancelAutoClose,
  } = useSimplePositionTpSl({
    coin,
    orders: currentPosition?.openOrders,
    setOrder: setTpSlOrder,
    cancelOrder: handleCancelOrder,
  });

  const { handleDeposit } = usePerpsDeposit({
    currentPerpsAccount,
  });

  const lineTagInfo = useMemo(() => {
    return {
      tpPrice: Number(tpPrice || 0),
      slPrice: Number(slPrice || 0),
      liquidationPrice: Number(currentPosition?.position.liquidationPx || 0),
      liquidationPriceText: simplePositionPriceText(
        currentPosition?.position.liquidationPx,
        currentAssetCtx?.pxDecimals,
      ),
      entryPrice: Number(currentPosition?.position.entryPx || 0),
      entryPriceText: simplePositionPriceText(
        currentPosition?.position.entryPx,
        currentAssetCtx?.pxDecimals,
      ),
    };
  }, [
    currentPosition?.position.entryPx,
    currentPosition?.position.liquidationPx,
    currentAssetCtx?.pxDecimals,
    slPrice,
    tpPrice,
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

  const hasLimitOrders = perpsStore(s =>
    (s.openOrders || []).some(o => o.coin === coin && isLimitOrder(o)),
  );

  const { accountValue, isUnifiedAccount, getAvailableByAsset } =
    usePerpsAccount();

  const quoteAsset = currentAssetCtx?.quoteAsset;

  const availableBalance = useMemo(() => {
    if (activeAssetData?.availableToTrade) {
      const isShort = hasPosition && Number(currentPosition?.position.szi) < 0;

      // type availableToTrade : [longAvailable, shortAvailable]
      return Number(activeAssetData.availableToTrade[isShort ? 1 : 0]);
    }
    return getAvailableByAsset(quoteAsset || 'USDC') || 0;
  }, [
    activeAssetData?.availableToTrade,
    quoteAsset,
    getAvailableByAsset,
    hasPosition,
    currentPosition?.position.szi,
  ]);

  const needDepositFirst = useMemo(() => {
    return Number(accountValue) === 0 && Number(availableBalance) === 0;
  }, [accountValue, availableBalance]);

  const accountNeedApprove = useMemo(() => {
    return accountNeedApproveAgent || accountNeedApproveBuilderFee;
  }, [accountNeedApproveAgent, accountNeedApproveBuilderFee]);

  const needEnableUnifiedAccount = useMemo(() => {
    return !isUnifiedAccount && (!currentAssetCtx || !!currentAssetCtx.dexId);
  }, [isUnifiedAccount, currentAssetCtx]);

  const canOpenPosition = useMemo(() => {
    return (
      hasPermission &&
      isLogin &&
      !hasPosition &&
      !needDepositFirst &&
      !accountNeedApprove &&
      !needEnableUnifiedAccount &&
      showOpenPosition
    );
  }, [
    hasPermission,
    isLogin,
    hasPosition,
    needDepositFirst,
    showOpenPosition,
    accountNeedApprove,
    needEnableUnifiedAccount,
  ]);

  const [openPositionVisible, setOpenPositionVisible] = React.useState(false);
  const [isShowSwapPopup, setIsShowSwapPopup] = useState(false);
  const [isShowEnableUnifiedPopup, setIsShowEnableUnifiedPopup] =
    useState(false);

  const unifiedEnableSourceRef = useRef<'swap' | 'other'>('swap');

  const gateUnifiedForNonDefaultDex = useCallback((): boolean => {
    if (needEnableUnifiedAccount) {
      unifiedEnableSourceRef.current = 'other';
      setIsShowEnableUnifiedPopup(true);
      return false;
    }
    return true;
  }, [needEnableUnifiedAccount]);

  const initAutoOpenPositionRef = useRef(false);
  useEffect(() => {
    const autoOpenPosition = async () => {
      try {
        if (initAutoOpenPositionRef.current) {
          return;
        }
        initAutoOpenPositionRef.current = true;
        const isAutoOpen = fromSource === 'openPosition' && !!canOpenPosition;
        if (isAutoOpen) {
          await handleActionApproveStatus();
          setOpenPositionVisible(true);
        }
      } catch (e) {}
    };
    autoOpenPosition();
  }, [fromSource, canOpenPosition, handleActionApproveStatus]);

  const handleSwapPress = useCallback(async () => {
    await handleActionApproveStatus();

    if (!isUnifiedAccount && !accountNeedApproveAgent) {
      unifiedEnableSourceRef.current = 'swap';
      setIsShowEnableUnifiedPopup(true);
      return;
    }
    setIsShowSwapPopup(true);
  }, [isUnifiedAccount, handleActionApproveStatus, accountNeedApproveAgent]);

  const handleEnableUnifiedConfirm = useCallback(async () => {
    const success = await handleEnableUnifiedAccount();
    setIsShowEnableUnifiedPopup(false);
    if (success && unifiedEnableSourceRef.current === 'swap') {
      setIsShowSwapPopup(true);
    }
  }, [handleEnableUnifiedAccount]);

  const markPrice = useMemo(() => {
    return Number(activeAssetCtx?.markPx || currentAssetCtx?.markPx || 0);
  }, [activeAssetCtx?.markPx, currentAssetCtx?.markPx]);

  // Position data if exists
  const positionData = useMemo(
    () =>
      currentPosition
        ? {
            pnl: Number(currentPosition.position.unrealizedPnl || 0),
            positionValue: Number(currentPosition.position.positionValue || 0),
            size: Math.abs(Number(currentPosition.position.szi || 0)),
            marginUsed: Number(currentPosition.position.marginUsed || 0),
            type: currentPosition.position.leverage.type,
            leverage: Number(currentPosition.position.leverage.value || 1),
            entryPrice: Number(currentPosition.position.entryPx || 0),
            liquidationPrice: Number(
              currentPosition.position.liquidationPx || 0,
            ).toFixed(currentAssetCtx?.pxDecimals || 2),
            autoClose: false, // This would come from SDK
            direction: (Number(currentPosition.position.szi || 0) > 0
              ? 'Long'
              : 'Short') as 'Long' | 'Short',
            pnlPercent:
              Number(currentPosition.position.returnOnEquity || 0) * 100,
            fundingPayments: currentPosition.position.cumFunding.sinceOpen,
          }
        : null,
    [currentPosition, currentAssetCtx?.pxDecimals],
  );

  const accountHeaderRef = useRef<AccountHeaderHandle>(null);
  const headerPresentation = useMemo(
    () =>
      createAccountHeaderPresentation(snapshot =>
        accountHeaderRef.current?.update(snapshot),
      ),
    [],
  );
  const chartContainerRef = useRef<View>(null);
  const chartContainerY = useRef(0);
  const priceNodeRef = useRef<View | null>(null);
  const priceMeasureId = useRef(0);
  const onPriceLayout = useCallback(
    (node: View) => {
      priceNodeRef.current = node;
      const measureId = ++priceMeasureId.current;
      const container = chartContainerRef.current;
      if (container)
        node.measureLayout(
          container,
          (_x, y, _width, height) => {
            if (
              measureId !== priceMeasureId.current ||
              node !== priceNodeRef.current
            )
              return;
            headerPresentation.layout(chartContainerY.current + y + height);
          },
          () => {},
        );
    },
    [headerPresentation],
  );
  const onAccountScroll = useCallback(
    (
      event: import('react-native').NativeSyntheticEvent<
        import('react-native').NativeScrollEvent
      >,
    ) => {
      headerPresentation.scroll(event.nativeEvent.contentOffset.y);
    },
    [headerPresentation],
  );
  useLayoutEffect(() => {
    headerPresentation.reset();
    priceNodeRef.current = null;
    priceMeasureId.current += 1;
  }, [coin, headerPresentation]);

  const HeaderTitle = useCallback(() => {
    return (
      <PerpsHeaderTitle
        ref={accountHeaderRef}
        snapshotRef={headerPresentation.snapshot}
        // account={currentPerpsAccount}
        popupIsOpen={false}
        quoteCoin={currentAssetCtx?.quoteAsset}
        displayName={currentAssetCtx?.displayName || coin}
        coin={coin}
        logoUrl={currentAssetCtx?.logoUrl}
        onSelectCoin={() => {
          naviReplace(RootNames.StackTransaction, {
            screen: RootNames.PerpsSearch,
            params: {
              openFromSource: 'marketDetail',
              initialTab: 'topVolume',
            },
          });
        }}
      />
    );
  }, [
    coin,
    currentAssetCtx?.logoUrl,
    currentAssetCtx?.quoteAsset,
    currentAssetCtx?.displayName,
    headerPresentation,
    // currentPerpsAccount,
  ]);

  useEffect(() => {
    navigation.setOptions({
      header: HeaderTitle,
    });
  }, [navigation, HeaderTitle]);

  // if (!market) {
  //   navigation.goBack();
  //   toast.error('Market not found');
  //   return null;
  // }
  const displayName = currentAssetCtx?.displayName || coin;

  return (
    <>
      <NormalScreenContainer2024 type={isLight ? 'bg0' : 'bg1'}>
        {!hasPermission ? <PerpsRegionAlert /> : null}
        <PerpsSimpleChartScrollView
          scrollGesture={scrollGesture}
          onScroll={onAccountScroll}
          scrollEventThrottle={16}
          style={styles.container}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          <View
            ref={chartContainerRef}
            collapsable={false}
            style={styles.header}
            onLayout={event => {
              chartContainerY.current = event.nativeEvent.layout.y;
              if (priceNodeRef.current) onPriceLayout(priceNodeRef.current);
            }}>
            <PerpsChart
              onPriceLayout={onPriceLayout}
              onHeaderQuote={headerPresentation.quote}
              scrollGesture={scrollGesture}
              marketName={coin}
              activeAssetCtx={displayAssetCtx}
              currentAssetCtx={currentAssetCtx}
              lineTagInfo={lineTagInfo}
              accountKey={currentPerpsAccount?.address.toLowerCase() || ''}
              history={singleCoinHistoryList}
            />
            {isLogin && isInitialized && !hasPosition ? (
              <PerpsDepositCard
                accountValue={accountValue}
                availableBalance={availableBalance}
                quoteAsset={currentAssetCtx?.quoteAsset}
                onDepositPress={() => {
                  if (!needDepositFirst && !gateUnifiedForNonDefaultDex()) {
                    return;
                  }
                  setIsShowDepositPopup(true);
                }}
                onSwapPress={handleSwapPress}
              />
            ) : null}
          </View>
          {!hasPosition && (
            <PerpsLimitOrdersForCoin
              coin={coin}
              leverage={activeAssetData?.leverage ?? null}
              handleActionApproveStatus={handleActionApproveStatus}
            />
          )}
          {!isInitialized ? (
            <PerpsPositionSkeletonLoader />
          ) : (
            <PerpsPosition
              showRiskPopup={showRiskPopup}
              setShowRiskPopup={setShowRiskPopup}
              activeAssetCtx={activeAssetCtx}
              currentAssetCtx={currentAssetCtx || null}
              positionData={positionData}
              rawLiquidationPrice={currentPosition?.position.liquidationPx}
              liquidationPriceText={lineTagInfo.liquidationPriceText}
              entryPriceText={lineTagInfo.entryPriceText}
              rawMarkPrice={activeAssetCtx?.markPx || currentAssetCtx?.markPx}
              coin={coin}
              coinLogo={currentAssetCtx?.logoUrl || ''}
              markPrice={markPrice}
              slPrice={slPrice ? Number(slPrice).toString() : undefined}
              tpPrice={tpPrice ? Number(tpPrice).toString() : undefined}
              tpSlContextKey={tpSlContextKey}
              tpPending={tpPending}
              slPending={slPending}
              tpCancelling={tpCancelling}
              slCancelling={slCancelling}
              pxDecimals={currentAssetCtx?.pxDecimals || 2}
              szDecimals={currentAssetCtx?.szDecimals || 0}
              handleActionApproveStatus={handleActionApproveStatus}
              handleSetAutoClose={handleSetAutoClose}
              availableBalance={availableBalance}
              leverageMax={currentAssetCtx?.maxLeverage || 5}
              handleCancelAutoClose={handleCancelAutoClose}
              handleUpdateMargin={handleUpdateMargin}
            />
          )}
          {hasPosition && (
            <PerpsLimitOrdersForCoin
              coin={coin}
              leverage={currentPosition?.position.leverage ?? null}
              handleActionApproveStatus={handleActionApproveStatus}
            />
          )}
          {!hasPosition && !hasLimitOrders && <PerpsAbout coin={coin} />}

          <PerpsHistorySection
            coin={coin}
            historyList={singleCoinHistoryList}
          />
          {(hasPosition || hasLimitOrders) && <PerpsAbout coin={coin} />}
          <PerpsSimpleChartSource />
        </PerpsSimpleChartScrollView>
        {isLogin ? (
          <PerpsFooter
            hasPermission={hasPermission}
            hasPosition={hasPosition}
            direction={positionData?.direction}
            onAddPress={async () => {
              await handleActionApproveStatus();
              setAddPositionVisible(true);
            }}
            onLongPress={async () => {
              if (needDepositFirst) {
                showToast(t('page.perpsDetail.needDepositFirst'), 'error');
                return;
              }
              if (!gateUnifiedForNonDefaultDex()) {
                return;
              }

              await handleActionApproveStatus();
              setPositionDirection('Long');
              setOpenPositionVisible(true);
            }}
            onShortPress={async () => {
              if (needDepositFirst) {
                showToast(t('page.perpsDetail.needDepositFirst'), 'error');
                return;
              }
              if (!gateUnifiedForNonDefaultDex()) {
                return;
              }

              await handleActionApproveStatus();
              setPositionDirection('Short');
              setOpenPositionVisible(true);
            }}
            onClosePress={async () => {
              await handleActionApproveStatus();
              setClosePositionVisible(true);
            }}
          />
        ) : null}
      </NormalScreenContainer2024>

      <PerpsDepositPopup
        account={currentPerpsAccount}
        visible={isShowDepositPopup}
        onClose={() => {
          setIsShowDepositPopup(false);
        }}
        onDeposit={async (txs, amount, cacheBridgeHistory, options) => {
          try {
            return await handleDeposit(
              txs,
              amount,
              cacheBridgeHistory,
              options,
            );
          } catch (e) {
            console.error(e);
          }
        }}
      />
      <PerpsAgentsLimitModal
        visible={popupState.isShowDeleteAgentPopup}
        onCancel={() => {
          setPopupState(prev => ({
            ...prev,
            isShowDeleteAgentPopup: false,
          }));
        }}
        onConfirm={() => {
          handleDeleteAgent();
          setPopupState(prev => ({
            ...prev,
            isShowDeleteAgentPopup: false,
          }));
        }}
      />
      <PerpsOpenPositionPopup
        activeAssetCtx={activeAssetCtx}
        activeAssetData={activeAssetData}
        refreshActiveAssetData={refreshActiveAssetData}
        currentAssetCtx={currentAssetCtx}
        marketDataItem={currentAssetCtx}
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
        availableBalance={Number(availableBalance || 0)}
        onCancel={() => setOpenPositionVisible(false)}
        handleOpenPosition={handleOpenPosition}
        quoteAsset={currentAssetCtx?.quoteAsset}
        onDepositPress={() => {
          setOpenPositionVisible(false);
          setIsShowDepositPopup(true);
        }}
        onSwapPress={() => {
          setOpenPositionVisible(false);
          handleSwapPress();
        }}
        onConfirm={() => {
          setOpenPositionVisible(false);
          if (fromSource === 'openPosition') {
            navigation.goBack();
          }
        }}
      />
      {positionData ? (
        <PerpsClosePositionPopup
          displayName={displayName}
          visible={closePositionVisible}
          coin={coin}
          marginUsed={positionData?.marginUsed || 0}
          markPrice={markPrice}
          entryPrice={positionData?.entryPrice || 0}
          providerFee={providerFee}
          direction={positionData?.direction as 'Long' | 'Short'}
          positionSize={positionData?.size.toString() || '0'}
          pnl={positionData?.pnl || 0}
          szDecimals={currentAssetCtx?.szDecimals || 0}
          quoteAsset={currentAssetCtx?.quoteAsset}
          onCancel={() => setClosePositionVisible(false)}
          onConfirm={() => {
            setClosePositionVisible(false);
          }}
          handleClosePosition={async ({ closePercent, orderType, limitPx }) => {
            let sizeStr = '0';
            if (closePercent < 100) {
              const size = (positionData?.size * closePercent) / 100;
              sizeStr = size.toFixed(currentAssetCtx?.szDecimals || 0);
            } else {
              sizeStr = positionData?.size.toString() || '0';
            }
            const res = await handleClosePosition({
              coin,
              size: sizeStr,
              direction: positionData?.direction as 'Long' | 'Short',
              price: activeAssetCtx?.markPx || currentAssetCtx?.markPx || '0',
              orderType,
              limitPx,
            });
            if (res) {
              const { avgPx, totalSz } = res;
              const isBuy = positionData?.direction === 'Long';
              stats.report('perpsTradeHistory', {
                created_at: new Date().getTime(),
                user_addr: currentPerpsAccount?.address || '',
                trade_type:
                  orderType === 'limit'
                    ? 'close position limit'
                    : 'close position',
                leverage: positionData?.leverage.toString(),
                trade_side: getStatsReportSide(!isBuy, true),
                margin_mode:
                  positionData.type === 'cross' ? 'cross' : 'isolated',
                coin: coin,
                size: totalSz,
                price: avgPx,
                trade_usd_value: new BigNumber(avgPx).times(totalSz).toFixed(2),
                service_provider: 'hyperliquid',
                app_version: APP_VERSIONS.fromNative || '0',
                address_type: currentPerpsAccount?.type || '',
              });
            }
          }}
        />
      ) : null}

      {positionData ? (
        <PerpsAddPositionPopup
          visible={addPositionVisible}
          providerFee={providerFee}
          availableBalance={Number(availableBalance || 0)}
          pnl={Number(positionData?.pnl || 0)}
          pnlPercent={Number(positionData?.pnlPercent || 0)}
          liquidationPx={Number(positionData?.liquidationPrice || 0)}
          handlePressRiskTag={() => {
            setShowRiskPopup(true);
          }}
          coinLogo={currentAssetCtx?.logoUrl || ''}
          activeAssetCtx={activeAssetCtx}
          currentAssetCtx={currentAssetCtx || null}
          coin={coin}
          marginMode={positionData?.type as 'cross' | 'isolated'}
          marginUsed={positionData?.marginUsed || 0}
          markPrice={markPrice}
          direction={positionData?.direction as 'Long' | 'Short'}
          positionSize={positionData?.size.toString() || '0'}
          entryPrice={positionData?.entryPrice || 0}
          positionValue={positionData?.positionValue || 0}
          szDecimals={currentAssetCtx?.szDecimals || 0}
          pxDecimals={currentAssetCtx?.pxDecimals || 2}
          leverage={positionData?.leverage || 1}
          leverageRang={[1, currentAssetCtx?.maxLeverage || 5]}
          onCancel={() => setAddPositionVisible(false)}
          onConfirm={() => {
            setAddPositionVisible(false);
          }}
          quoteAsset={currentAssetCtx?.quoteAsset}
          onDepositPress={() => {
            setAddPositionVisible(false);
            setIsShowDepositPopup(true);
          }}
          onSwapPress={() => {
            setAddPositionVisible(false);
            handleSwapPress();
          }}
          handleAddPosition={async (tradeSize: string) => {
            const res = await handleOpenPosition({
              coin,
              size: tradeSize,
              leverage: positionData?.leverage || 1,
              marginMode: positionData.type,
              direction: positionData?.direction as 'Long' | 'Short',
              midPx: activeAssetCtx?.markPx || '0',
              isAddingPosition: true,
            });
            if (res) {
              const { avgPx, totalSz } = res;
              const isBuy = positionData?.direction === 'Long';
              stats.report('perpsTradeHistory', {
                created_at: new Date().getTime(),
                user_addr: currentPerpsAccount?.address || '',
                trade_type: 'add position',
                leverage: positionData?.leverage.toString(),
                trade_side: getStatsReportSide(isBuy, false),
                margin_mode:
                  positionData.type === 'cross' ? 'cross' : 'isolated',
                coin: coin,
                size: totalSz,
                price: avgPx,
                trade_usd_value: new BigNumber(avgPx).times(totalSz).toFixed(2),
                service_provider: 'hyperliquid',
                app_version: APP_VERSIONS.fromNative || '0',
                address_type: currentPerpsAccount?.type || '',
              });
            }
          }}
        />
      ) : null}

      <EnableUnifiedAccountPopup
        visible={isShowEnableUnifiedPopup}
        onClose={() => setIsShowEnableUnifiedPopup(false)}
        onConfirm={handleEnableUnifiedConfirm}
      />
      <PerpsSpotSwapPopup
        visible={isShowSwapPopup}
        disableSwitch={true}
        targetAsset={currentAssetCtx?.quoteAsset || 'USDT'}
        onClose={() => setIsShowSwapPopup(false)}
        onSpotOrder={handleStableCoinOrder}
        onSwapSuccess={() => {
          // Balance refreshed via WebSocket subscription
        }}
        onDepositPress={() => {
          setIsShowDepositPopup(true);
        }}
      />
    </>
  );
};

const getStyles = createGetStyles2024(ctx => {
  const { colors2024, isLight, safeAreaInsets } = ctx;
  return {
    container: {
      flex: 1,
      height: '100%',
      paddingHorizontal: 12,
      position: 'relative',
    },
    scrollContent: {
      // paddingBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom),
    },
    header: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      marginBottom: 30,
    },
    chart: {
      backgroundColor: isLight
        ? colors2024['neutral-bg-1']
        : colors2024['neutral-bg-2'],
      height: 322,
      borderRadius: 20,
    },
  };
});
