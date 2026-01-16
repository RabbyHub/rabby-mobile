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
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { PerpsDepositPopup } from '../Perps/components/PerpsDepositPopup';
import { PerpsHistorySection } from '../Perps/components/PerpsHistorySection';
import { usePerpsDeposit } from '../Perps/hooks/usePerpsDeposit';
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
import {
  ARB_USDC_TOKEN_ID,
  ARB_USDC_TOKEN_SERVER_CHAIN,
  CANDLE_MENU_KEY_V2,
  PERPS_MAX_NTL_VALUE,
} from '@/constant/perps';
import { PerpsRegionAlert } from '../Perps/components/PerpsRegionAlert';
import { trigger } from 'react-native-haptic-feedback';
import { useAppState } from '@react-native-community/hooks';
import { PerpsSelectTokenPopup } from '../Perps/components/PerpsDepositPopup/PerpsSelectTokenPopup';
import {
  usePerpsPopupState,
  useSelectedToken,
} from '../Perps/hooks/usePerpsPopupState';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { openapi } from '@/core/request';
import { PerpsDepositTokenModal } from '../Perps/components/PerpsDepositPopup/PerpsDepositTokenModal';
import Toast from 'react-native-root-toast';
import { PerpSearchListPopup } from '../Perps/components/PerpSearchListPopup';
import { PerpsAddPositionPopup } from './components/PerpsAddPositionPopup';
import { usePerpsState } from '@/hooks/perps/usePerpsState';
import { showToast } from '@/hooks/perps/showToast';
import { PerpsAgentsLimitModal } from '../Perps/components/PerpsAgentsLimitModal';
import { PerpsPositionSkeletonLoader } from '../Perps/components/PerpsSkeletonLoader';
import { PerpsHeaderRight } from './components/PerpsHeaderRight';

export const PerpsMarketDetailScreen = () => {
  const { t } = useTranslation();

  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });
  const [popupState, setPopupState] = usePerpsPopupState();

  const navigation = useRabbyAppNavigation();

  const route =
    useRoute<
      GetNestedScreenRouteProp<
        'TransactionNavigatorParamList',
        'PerpsMarketDetail'
      >
    >();

  const { market: marketName, fromSource, showOpenPosition } = route.params;
  const [coin, setCoin] = useState(marketName);

  const {
    isInitialized,
    positionAndOpenOrders,
    accountSummary,
    marketDataMap,
    perpFee,
    marketData,
    hasPermission,
    currentPerpsAccount,
    isLogin,
    userFills,
    accountNeedApproveAgent,
    accountNeedApproveBuilderFee,
    handleActionApproveStatus,

    handleDeleteAgent,
  } = usePerpsState();
  // const hasPermission = true;
  const [isShowModal, setIsShowModal] = useState(false);
  const [amountVisible, setAmountVisible] = useState(false);
  const [selectedToken, setSelectedToken] = useSelectedToken();
  const [showRiskPopup, setShowRiskPopup] = useState(false);
  const [selectedInterval, setSelectedInterval] =
    React.useState<CANDLE_MENU_KEY_V2>(CANDLE_MENU_KEY_V2.FIFTEEN_MINUTES);
  const [showDepositTokenPopup, setShowDepositTokenPopup] = useState(false);
  const [showSearchListPopup, setShowSearchListPopup] = useState(false);
  const coinNameRef = useRef(coin);
  useEffect(() => {
    coinNameRef.current = coin;
  }, [coin]);

  const market = useMemo(() => {
    return marketDataMap[coin.toUpperCase()];
  }, [marketDataMap, coin]);

  const [activeAssetCtx, setActiveAssetCtx] = React.useState<
    WsActiveAssetCtx['ctx'] | null
  >(null);

  const [positionDirection, setPositionDirection] = React.useState<
    'Long' | 'Short'
  >('Long');
  const [closePositionVisible, setClosePositionVisible] = React.useState(false);
  const [addPositionVisible, setAddPositionVisible] = React.useState(false);

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

  const needDepositFirst = useMemo(() => {
    return (
      Number(accountSummary?.accountValue || 0) === 0 &&
      Number(accountSummary?.withdrawable || 0) === 0
    );
  }, [accountSummary]);

  const accountNeedApprove = useMemo(() => {
    return accountNeedApproveAgent || accountNeedApproveBuilderFee;
  }, [accountNeedApproveAgent, accountNeedApproveBuilderFee]);

  const canOpenPosition = useMemo(() => {
    return (
      hasPermission &&
      isLogin &&
      !hasPosition &&
      !needDepositFirst &&
      !accountNeedApprove &&
      showOpenPosition
    );
  }, [
    hasPermission,
    isLogin,
    hasPosition,
    needDepositFirst,
    showOpenPosition,
    accountNeedApprove,
  ]);

  const [openPositionVisible, setOpenPositionVisible] = React.useState(
    fromSource === 'openPosition' && canOpenPosition,
  );

  const subscribeActiveAssetCtx = useMemoizedFn(() => {
    const sdk = apisPerps.getPerpsSDK();
    const { unsubscribe } = sdk.ws.subscribeToActiveAssetCtx(coin, data => {
      if (coinNameRef.current?.toUpperCase() !== data.coin.toUpperCase()) {
        return;
      }
      setActiveAssetCtx(data.ctx);
    });

    return () => {
      unsubscribe();
    };
  });

  const unsubscribeActiveAssetRef = useRef<() => void>(() => {});

  // Subscribe to real-time candle updates
  useEffect(() => {
    if (unsubscribeActiveAssetRef.current) {
      unsubscribeActiveAssetRef.current();
    }
    const unsubscribe = subscribeActiveAssetCtx();
    unsubscribeActiveAssetRef.current = unsubscribe;
    return () => {
      unsubscribe?.();
    };
  }, [subscribeActiveAssetCtx, coin]);

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
        pnlPercent: Number(currentPosition.position.returnOnEquity || 0) * 100,
        fundingPayments: currentPosition.position.cumFunding.sinceOpen,
      }
    : null;

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
        popupIsOpen={showSearchListPopup}
        market={market}
        onSelectCoin={() => {
          setShowSearchListPopup(true);
        }}
      />
    );
  }, [
    market,
    setShowSearchListPopup,
    showSearchListPopup,
    // currentPerpsAccount,
  ]);

  const HeaderRight = useCallback(() => {
    return <PerpsHeaderRight marketName={coin} />;
  }, [coin]);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: HeaderTitle,
      headerRight: HeaderRight,
    });
  }, [market, navigation, HeaderTitle, HeaderRight]);

  if (!market) {
    navigation.goBack();
    toast.error('Market not found');
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
              selectedInterval={selectedInterval}
              setSelectedInterval={setSelectedInterval}
              coinNameRef={coinNameRef}
              market={market}
              markPrice={markPrice}
              activeAssetCtx={activeAssetCtx}
              currentAssetCtx={currentAssetCtx}
              lineTagInfo={lineTagInfo}
            />
            {isLogin && isInitialized && !hasPosition ? (
              <PerpsDepositCard
                availableBalance={availableBalance}
                onDepositPress={() => {
                  setShowDepositTokenPopup(true);
                }}
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
        visible={amountVisible}
        accountSummary={accountSummary}
        onClose={() => {
          setAmountVisible(false);
        }}
        showSelectTokenPopup={() => {
          setShowDepositTokenPopup(true);
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
      <PerpsSelectTokenPopup
        account={currentPerpsAccount}
        visible={showDepositTokenPopup}
        onClose={() => {
          setShowDepositTokenPopup(false);
        }}
        onSelect={async token => {
          setSelectedToken(token);
          if (
            token.chain === ARB_USDC_TOKEN_SERVER_CHAIN &&
            isSameAddress(token.id, ARB_USDC_TOKEN_ID)
          ) {
            setAmountVisible(true);
            setShowDepositTokenPopup(false);
            return;
          }

          const res = await openapi.getPerpsBridgeIsSupportToken({
            token_id: token.id,
            chain_id: token.chain,
          });

          if (res?.success) {
            // bridge token with liFi dex
            setAmountVisible(true);
            setShowDepositTokenPopup(false);
            // setClickLoading(false);
          } else {
            setIsShowModal(true);
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
      <PerpsDepositTokenModal
        visible={isShowModal}
        onCancel={() => {
          setIsShowModal(false);
        }}
        token={selectedToken}
        onNavigate={() => {
          setIsShowModal(false);
          setShowDepositTokenPopup(false);
          setAmountVisible(false);
        }}
      />
      <PerpsOpenPositionPopup
        activeAssetCtx={activeAssetCtx}
        currentAssetCtx={currentAssetCtx}
        marketDataItem={marketDataMap[coin.toUpperCase()]}
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
        setCurrentTpOrSl={setCurrentTpOrSl}
        handleOpenPosition={handleOpenPosition}
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
            await handleClosePosition({
              coin,
              size: sizeStr,
              direction: positionData?.direction as 'Long' | 'Short',
              price: (activeAssetCtx?.markPx as unknown as string) || '0',
            });
            setCurrentTpOrSl({
              tpPrice: undefined,
              slPrice: undefined,
            });
          }}
        />
      ) : null}

      {positionData ? (
        <PerpsAddPositionPopup
          visible={addPositionVisible}
          pnl={Number(positionData?.pnl || 0)}
          pnlPercent={Number(positionData?.pnlPercent || 0)}
          liquidationPx={Number(positionData?.liquidationPrice || 0)}
          handlePressRiskTag={() => {
            setShowRiskPopup(true);
          }}
          coinLogo={currentAssetCtx?.logoUrl || ''}
          activeAssetCtx={activeAssetCtx}
          currentAssetCtx={currentAssetCtx || null}
          availableBalance={Number(accountSummary?.withdrawable || 0)}
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
          handleAddPosition={async (tradeSize: string) => {
            await handleOpenPosition({
              coin,
              size: tradeSize,
              leverage: positionData?.leverage || 1,
              marginMode: positionData.type,
              direction: positionData?.direction as 'Long' | 'Short',
              midPx: activeAssetCtx?.markPx || '0',
            });
          }}
        />
      ) : null}

      <PerpSearchListPopup
        openFromSource="searchPerps"
        visible={showSearchListPopup}
        onSelect={item => {
          coinNameRef.current = item;
          const positionItem = positionAndOpenOrders?.find(
            asset => asset.position.coin.toLowerCase() === coin?.toLowerCase(),
          );
          const tpItem = positionItem?.openOrders?.find(
            order =>
              order.orderType === 'Take Profit Market' &&
              order.isTrigger &&
              order.reduceOnly,
          );
          const slItem = positionItem?.openOrders?.find(
            order =>
              order.orderType === 'Stop Market' &&
              order.isTrigger &&
              order.reduceOnly,
          );
          setCoin(item);
          setCurrentTpOrSl({
            tpPrice: tpItem?.triggerPx ?? undefined,
            slPrice: slItem?.triggerPx ?? undefined,
          });
        }}
        onCancel={() => {
          setShowSearchListPopup(false);
        }}
        marketData={marketData}
        positionAndOpenOrders={positionAndOpenOrders}
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
