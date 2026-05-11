import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { apisPerps } from '@/core/apis';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { GetNestedScreenRouteProp } from '@/navigation-type';
import { createGetStyles2024 } from '@/utils/styles';
import { useRoute } from '@react-navigation/native';
import { useMemoizedFn } from 'ahooks';
import { sortBy } from 'lodash';
import { IS_IOS } from '@/core/native/utils';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { PerpsDepositPopup } from '../Perps/components/PerpsDepositPopup';
import { EnableUnifiedAccountPopup } from '../Perps/components/EnableUnifiedAccountPopup';
import { PerpsSpotSwapPopup } from '../Perps/components/PerpsSpotSwapPopup';
import BigNumber from 'bignumber.js';
import { PerpsHistorySection } from '../Perps/components/PerpsHistorySection';
import { usePerpsDeposit } from '../Perps/hooks/usePerpsDeposit';
import { PerpsChart } from './components/PerpsChart';
import { PerpsClosePositionPopup } from './components/PerpsClosePositionPopup';
import { PerpsDepositCard } from './components/PerpsDepositCard';
import { PerpsFooter } from './components/PerpsFooter';
import { PerpsHeaderTitle } from './components/PerpsHeaderTitle';
import { PerpsInfo } from './components/PerpsInfo';
import { PerpsAbout } from './components/PerpsAbout';
import { PerpsOpenPositionPopup } from './components/PerpsOpenPositionPopup';
import { PerpsPosition } from './components/PerpsPosition';
import { usePerpsPosition } from './hooks/usePerpsPosition';
import { useActiveAssetSubscription } from './hooks/useActiveAssetSubscription';
import { toast } from '@/components2024/Toast';
import { CANDLE_MENU_KEY_V2, PERPS_MAX_NTL_VALUE } from '@/constant/perps';
import { PerpsRegionAlert } from '../Perps/components/PerpsRegionAlert';

import { usePerpsPopupState } from '../Perps/hooks/usePerpsPopupState';

import Toast from 'react-native-root-toast';
import { naviReplace } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { PerpsAddPositionPopup } from './components/PerpsAddPositionPopup';
import { usePerpsState } from '@/hooks/perps/usePerpsState';
import { showToast } from '@/hooks/perps/showToast';
import { PerpsAgentsLimitModal } from '../Perps/components/PerpsAgentsLimitModal';
import { PerpsPositionSkeletonLoader } from '../Perps/components/PerpsSkeletonLoader';
import { usePerpsAccount } from '@/hooks/perps/usePerpsAccount';
import { stats } from '@/utils/stats';
import { getStatsReportSide } from '@/utils/perps';
import { APP_VERSIONS } from '@/constant';
import { Text } from '@/components/Typography';
import { PerpsGuideEntryPopup } from './components/PerpsGuideEntryPopup';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils/src/types';

export const PerpsMarketDetailScreen = () => {
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
  const [selectedInterval, setSelectedIntervalState] =
    React.useState<CANDLE_MENU_KEY_V2>(CANDLE_MENU_KEY_V2.FIFTEEN_MINUTES);
  useEffect(() => {
    apisPerps.getSelectedKlineInterval().then(v => {
      if (v) {
        setSelectedIntervalState(v);
      }
    });
  }, []);
  const setSelectedInterval = useMemoizedFn((v: CANDLE_MENU_KEY_V2) => {
    setSelectedIntervalState(v);
    apisPerps.setSelectedKlineInterval(v);
  });
  const [showGuideEntryPopup, setShowGuideEntryPopup] = useState(false);
  const coinNameRef = useRef(coin);
  useEffect(() => {
    coinNameRef.current = coin;
  }, [coin]);

  // Pre-fetch guide popup status on mount, then use synchronously in beforeRemove
  const hasShownGuideRef = useRef(true);
  useEffect(() => {
    if (IS_IOS || fromSource !== 'homePagePositionList') {
      return;
    }
    apisPerps.getHasShownPerpsGuidePopup().then(hasShown => {
      hasShownGuideRef.current = hasShown;
    });
  }, [fromSource]);

  // Intercept back navigation to show guide popup for homePagePositionList users
  // iOS: native-stack's swipe-back gesture ignores e.preventDefault() visually
  // but keeps the route in the stack, causing subsequent pushes to be blocked.
  useEffect(() => {
    if (IS_IOS || fromSource !== 'homePagePositionList') {
      return;
    }
    const unsubscribe = navigation.addListener('beforeRemove', e => {
      if (hasShownGuideRef.current) {
        return;
      }
      e.preventDefault();
      setShowGuideEntryPopup(true);
    });
    return unsubscribe;
  }, [navigation, fromSource]);

  useEffect(() => {
    const needDepositFirst =
      Number(accountValue) === 0 && Number(availableBalance) === 0;
    const isLocalWallet =
      currentPerpsAccount?.type === KEYRING_CLASS.PRIVATE_KEY ||
      currentPerpsAccount?.type === KEYRING_CLASS.MNEMONIC;
    if (isLocalWallet && !needDepositFirst) {
      // deposit first before approve agent
      handleActionApproveStatus({
        isHideToast: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { activeAssetCtx, activeAssetData } = useActiveAssetSubscription(coin);

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
        order.isPositionTpsl &&
        order.reduceOnly,
    );

    const slItem = currentPosition.openOrders.find(
      order =>
        order.orderType === 'Stop Market' &&
        order.isTrigger &&
        order.isPositionTpsl &&
        order.reduceOnly,
    );

    return {
      tpPrice: tpItem?.triggerPx,
      slPrice: slItem?.triggerPx,
      tpOid: tpItem?.oid,
      slOid: slItem?.oid,
    };
  }, [currentPosition]);

  const [currentTpOrSl, _setCurrentTpOrSl] = useState<{
    tpPrice?: string;
    slPrice?: string;
  }>({
    tpPrice: tpPrice,
    slPrice: slPrice,
  });
  const setCurrentTpOrSl = useMemoizedFn(
    (params: { tpPrice?: string; slPrice?: string }) => {
      _setCurrentTpOrSl(prev => ({
        ...prev,
        ...params,
      }));
    },
  );

  useEffect(() => {
    if (currentPosition) {
      _setCurrentTpOrSl({
        tpPrice: tpPrice,
        slPrice: slPrice,
      });
    }
  }, [currentPosition, tpPrice, slPrice]);

  const {
    handleOpenPosition,
    handleClosePosition,
    handleSetAutoClose,
    handleCancelOrder,
    handleUpdateMargin,
    handleStableCoinOrder,
  } = usePerpsPosition();

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
    return !isUnifiedAccount && currentAssetCtx?.quoteAsset !== 'USDC';
  }, [isUnifiedAccount, currentAssetCtx?.quoteAsset]);

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

  const [openPositionVisible, setOpenPositionVisible] = React.useState(
    fromSource === 'openPosition' && canOpenPosition,
  );
  const [isShowSwapPopup, setIsShowSwapPopup] = useState(false);
  const [isShowEnableUnifiedPopup, setIsShowEnableUnifiedPopup] =
    useState(false);

  const handleSwapPress = useCallback(async () => {
    await handleActionApproveStatus();

    if (!isUnifiedAccount && !accountNeedApproveAgent) {
      setIsShowEnableUnifiedPopup(true);
      return;
    }
    setIsShowSwapPopup(true);
  }, [isUnifiedAccount, handleActionApproveStatus, accountNeedApproveAgent]);

  const handleEnableUnifiedConfirm = useCallback(async () => {
    const success = await handleEnableUnifiedAccount();
    setIsShowEnableUnifiedPopup(false);
    if (success) {
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

  const handleCancelAutoClose = useMemoizedFn(
    async (actionType: 'tp' | 'sl') => {
      if (actionType === 'tp') {
        if (tpOid) {
          setCurrentTpOrSl({
            tpPrice: undefined,
          });
          await handleCancelOrder(tpOid, coin, 'tp');
        } else {
          toast.error('Take profit not found', {
            position: Toast.positions.CENTER,
          });
        }
      } else if (actionType === 'sl') {
        if (slOid) {
          setCurrentTpOrSl({
            slPrice: undefined,
          });
          await handleCancelOrder(slOid, coin, 'sl');
        } else {
          toast.error('Stop loss not found', {
            position: Toast.positions.CENTER,
          });
        }
      }
    },
  );

  const HeaderTitle = useCallback(() => {
    return (
      <PerpsHeaderTitle
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
        <ScrollView
          style={styles.container}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <PerpsChart
              selectedInterval={selectedInterval}
              setSelectedInterval={setSelectedInterval}
              coinNameRef={coinNameRef}
              marketName={coin}
              markPrice={markPrice}
              activeAssetCtx={activeAssetCtx}
              currentAssetCtx={currentAssetCtx}
              lineTagInfo={lineTagInfo}
            />
            {isLogin && isInitialized && !hasPosition ? (
              <PerpsDepositCard
                accountValue={accountValue}
                availableBalance={availableBalance}
                quoteAsset={currentAssetCtx?.quoteAsset}
                onDepositPress={() => {
                  setIsShowDepositPopup(true);
                }}
                onSwapPress={handleSwapPress}
              />
            ) : null}
          </View>
          {!isInitialized ? (
            <PerpsPositionSkeletonLoader />
          ) : (
            <PerpsPosition
              showRiskPopup={showRiskPopup}
              setShowRiskPopup={setShowRiskPopup}
              activeAssetCtx={activeAssetCtx}
              currentAssetCtx={currentAssetCtx || null}
              positionData={positionData}
              coin={coin}
              coinLogo={currentAssetCtx?.logoUrl || ''}
              markPrice={markPrice}
              slPrice={
                currentTpOrSl.slPrice
                  ? Number(currentTpOrSl.slPrice).toString()
                  : undefined
              }
              tpPrice={
                currentTpOrSl.tpPrice
                  ? Number(currentTpOrSl.tpPrice).toString()
                  : undefined
              }
              pxDecimals={currentAssetCtx?.pxDecimals || 2}
              szDecimals={currentAssetCtx?.szDecimals || 0}
              handleActionApproveStatus={handleActionApproveStatus}
              handleSetAutoClose={handleSetAutoClose}
              setCurrentTpOrSl={setCurrentTpOrSl}
              availableBalance={availableBalance}
              leverageMax={currentAssetCtx?.maxLeverage || 5}
              handleCancelAutoClose={handleCancelAutoClose}
              handleUpdateMargin={handleUpdateMargin}
            />
          )}
          {!hasPosition && <PerpsAbout coin={coin} />}
          <PerpsInfo market={currentAssetCtx} activeAssetCtx={activeAssetCtx} />

          <PerpsHistorySection
            coin={coin}
            historyList={singleCoinHistoryList}
          />
          {hasPosition && <PerpsAbout coin={coin} />}
        </ScrollView>
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

              await handleActionApproveStatus();
              setPositionDirection('Long');
              setOpenPositionVisible(true);
            }}
            onShortPress={async () => {
              if (needDepositFirst) {
                showToast(t('page.perpsDetail.needDepositFirst'), 'error');
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
        setCurrentTpOrSl={setCurrentTpOrSl}
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
          visible={closePositionVisible}
          coin={coin}
          marginUsed={positionData?.marginUsed || 0}
          markPrice={markPrice}
          entryPrice={positionData?.entryPrice || 0}
          providerFee={providerFee}
          direction={positionData?.direction as 'Long' | 'Short'}
          positionSize={positionData?.size.toString() || '0'}
          pnl={positionData?.pnl || 0}
          onCancel={() => setClosePositionVisible(false)}
          onConfirm={() => {
            setClosePositionVisible(false);
          }}
          handleClosePosition={async (closePercent: number) => {
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
              price: (activeAssetCtx?.markPx as unknown as string) || '0',
            });
            setCurrentTpOrSl({
              tpPrice: undefined,
              slPrice: undefined,
            });
            if (res) {
              const { avgPx, totalSz } = res;
              const isBuy = positionData?.direction === 'Long';
              stats.report('perpsTradeHistory', {
                created_at: new Date().getTime(),
                user_addr: currentPerpsAccount?.address || '',
                trade_type: 'close position',
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

      <PerpsGuideEntryPopup
        visible={showGuideEntryPopup}
        onClose={() => {
          apisPerps.setHasShownPerpsGuidePopup(true);
          setShowGuideEntryPopup(false);
          hasShownGuideRef.current = true;
          navigation.goBack();
        }}
      />
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

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 12,
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
