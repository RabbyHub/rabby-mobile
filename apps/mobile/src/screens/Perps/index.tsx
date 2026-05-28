import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ImageBackground,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Button } from '@/components2024/Button';
import { PerpsAccountCard } from './components/PerpsAccountCard';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { usePerpsState } from '@/hooks/perps/usePerpsState';
import RcIconBackTopCC from '@/assets2024/icons/perps/IconBackTopCC.svg';
import { usePerpsPopupState } from './hooks/usePerpsPopupState';
import { useMemoizedFn, useRequest } from 'ahooks';
import { Account } from '@/core/services/preference';
import { usePerpsDeposit } from './hooks/usePerpsDeposit';
import { PerpsMarketHomeList } from './components/PerpsMarketSection/PerpsMarketHomeList';
import { PerpsPositionSection } from './components/PerpsPositionSection';
import { PerpsLimitOrdersSection } from './components/PerpsLimitOrdersSection';
import { PerpsPopupGroup } from './components/PerpsPopupGroup';
import { PerpsRegionAlert } from './components/PerpsRegionAlert';
import { PerpsNativeHeader } from './components/PerpsHeaderTitle';
import { RootNames } from '@/constant/layout';
import { naviPush } from '@/utils/navigation';
import { calculateDistanceToLiquidation } from './components/PerpsPositionSection/utils';
import { PerpsSkeletonLoader } from './components/PerpsSkeletonLoader';
import { usePerpsPosition } from '../PerpsMarketDetail/hooks/usePerpsPosition';
import { checkPerpsReference, getStatsReportSide } from '@/utils/perps';
import { perpsService } from '@/core/services';
import { stats } from '@/utils/stats';
import { APP_VERSIONS } from '@/constant';
import BigNumber from 'bignumber.js';
import { perpsStore } from '@/hooks/perps/usePerpsStore';

export const PerpsOriginScreen = () => {
  const { t } = useTranslation();

  const { styles, isLight, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { width: screenWidth } = useWindowDimensions();

  const navigation = useRabbyAppNavigation();

  const {
    positionAndOpenOrders,
    currentPerpsAccount,
    isLogin,
    isInitialized,
    userFills,
    logout,
    login,
    handleWithdraw,
    handleDeleteAgent,
    hasPermission,
    refreshData,
    fetchMarketData,
    perpFee,

    localLoadingHistory,

    handleActionApproveStatus,
    handleSafeSetReference,
    setInitialized,
  } = usePerpsState();
  const { handleCloseAllPositions, handleStableCoinOrder } = usePerpsPosition();

  const [, setPopupState] = usePerpsPopupState();

  const scrollViewRef = useRef<ScrollView>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [selectedCoin, setSelectedCoin] = useState<string | null>(null);

  const handleLogin = useMemoizedFn(async (v: Account) => {
    const success = await login(v);
    if (!success) {
      return;
    }
    setPopupState(prev => ({
      ...prev,
      isShowLoginPopup: false,
    }));
  });

  const handleLogout = useMemoizedFn(() => {
    try {
      logout(currentPerpsAccount?.address || '');
      setPopupState(prev => ({
        ...prev,
        isShowLogoutPopup: false,
      }));
    } catch (e) {
      console.error(e);
    }
  });

  const { handleDeposit } = usePerpsDeposit({
    currentPerpsAccount,
  });

  const onRefresh = useMemoizedFn(() => {
    refreshData();
  });

  const handleScroll = useMemoizedFn((event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    const shouldShow = scrollY > 200;
    if (shouldShow !== showBackToTop) {
      setShowBackToTop(shouldShow);
    }
  });

  const scrollToTop = useMemoizedFn(() => {
    setShowBackToTop(false);
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  });

  const handleHomeItemPress = useMemoizedFn((market: string) => {
    scrollToTop();
    naviPush(RootNames.StackTransaction, {
      screen: RootNames.PerpsMarketDetail,
      params: {
        market,
        fromSource: 'searchPerps',
        showOpenPosition: true,
      },
    });
  });

  const handleShowRiskPopup = useMemoizedFn((coin: string) => {
    setSelectedCoin(coin);
  });

  const handleSwapPress = useMemoizedFn(async () => {
    await handleActionApproveStatus({ isHideToast: true });
    setPopupState(prev => ({
      ...prev,
      isShowSwapPopup: true,
    }));
  });

  const handleCloseRiskPopup = useMemoizedFn(() => {
    setSelectedCoin(null);
  });

  const { data: isShowInvite, mutate: setIsShowInvite } = useRequest(
    async () => {
      return checkPerpsReference({
        account: currentPerpsAccount,
        scene: 'invite',
      });
    },
    {
      refreshDeps: [currentPerpsAccount],
      ready: !!currentPerpsAccount?.address,
      onSuccess: shouldShow => {
        if (shouldShow) {
          perpsService.setInviteConfig(currentPerpsAccount?.address || '', {
            lastInvitedAt: Date.now(),
          });
        }
      },
    },
  );

  const selectedCoinMarketData = perpsStore(s =>
    selectedCoin ? s.marketDataMap[selectedCoin] : undefined,
  );

  const riskPopupData = useMemo(() => {
    if (!selectedCoin) {
      return null;
    }

    const selectedPosition = positionAndOpenOrders?.find(
      item => item.position.coin === selectedCoin,
    );
    if (!selectedPosition) {
      return null;
    }

    const markPrice = Number(selectedCoinMarketData?.markPx || 0);
    const liquidationPrice = Number(
      selectedPosition.position.liquidationPx || 0,
    );

    const distanceLiquidation = calculateDistanceToLiquidation(
      selectedPosition.position.liquidationPx,
      selectedCoinMarketData?.markPx,
    );
    return {
      distanceLiquidation,
      isCross: selectedPosition.position.leverage.type === 'cross',
      direction:
        Number(selectedPosition.position.szi || 0) > 0
          ? 'Long'
          : ('Short' as 'Long' | 'Short'),
      currentPrice: markPrice,
      pxDecimals: selectedCoinMarketData?.pxDecimals || 2,
      liquidationPrice,
    };
  }, [selectedCoin, positionAndOpenOrders, selectedCoinMarketData]);

  return (
    <>
      <NormalScreenContainer2024 type={'bg1'}>
        {!isLight && (
          <ImageBackground
            source={require('@/assets2024/icons/perps/ImgPerpsHomeBg.png')}
            resizeMode="cover"
            style={[styles.topBg, { width: screenWidth, height: screenWidth }]}
          />
        )}
        <PerpsNativeHeader
          account={currentPerpsAccount}
          localLoadingHistory={localLoadingHistory}
        />
        {!hasPermission ? <PerpsRegionAlert /> : null}
        {!isInitialized ? (
          <PerpsSkeletonLoader />
        ) : (
          <View style={styles.screenContainer}>
            <ScrollView
              ref={scrollViewRef}
              style={styles.container}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              refreshControl={
                <RefreshControl refreshing={false} onRefresh={onRefresh} />
              }>
              <PerpsAccountCard onSwapPress={handleSwapPress} />
              <PerpsPositionSection
                handleShowRiskPopup={handleShowRiskPopup}
                handleCloseRiskPopup={handleCloseRiskPopup}
                positionAndOpenOrders={positionAndOpenOrders}
                handleActionApproveStatus={handleActionApproveStatus}
                onCloseAllPositions={async () => {
                  const clearinghouseState =
                    perpsStore.getState().currentClearinghouseState;
                  if (!clearinghouseState) {
                    return;
                  }
                  const filledResults = await handleCloseAllPositions(
                    clearinghouseState,
                  );
                  if (!filledResults) {
                    return;
                  }
                  for (const { filled, position } of filledResults) {
                    const isBuy = Number(position.szi || 0) > 0;
                    stats.report('perpsTradeHistory', {
                      created_at: new Date().getTime(),
                      user_addr: currentPerpsAccount?.address || '',
                      trade_type: 'close all position',
                      leverage: position.leverage.value.toString(),
                      trade_side: getStatsReportSide(!isBuy, true),
                      margin_mode:
                        position.leverage.type === 'cross'
                          ? 'cross'
                          : 'isolated',
                      coin: position.coin,
                      size: filled.totalSz,
                      price: filled.avgPx,
                      trade_usd_value: new BigNumber(filled.avgPx)
                        .times(filled.totalSz)
                        .toFixed(2),
                      service_provider: 'hyperliquid',
                      app_version: APP_VERSIONS.fromNative || '0',
                      address_type: currentPerpsAccount?.type || '',
                    });
                  }
                }}
              />
              <PerpsLimitOrdersSection
                isHome={true}
                positionAndOpenOrders={positionAndOpenOrders}
                handleActionApproveStatus={handleActionApproveStatus}
              />

              <PerpsMarketHomeList onItemPress={handleHomeItemPress} />
              <View style={styles.emptyPadding} />
            </ScrollView>

            {hasPermission && isLogin && (
              <View style={styles.footer}>
                <View style={styles.footerBtns}>
                  <View style={styles.footerBtnItem}>
                    <Button
                      type="primary"
                      titleStyle={styles.openPositionBtn}
                      buttonStyle={styles.longBtn}
                      title={t('page.perpsDetail.action.long')}
                      onPress={() => {
                        naviPush(RootNames.StackTransaction, {
                          screen: RootNames.PerpsSearch,
                          params: {
                            openFromSource: 'openPosition',
                            direction: 'Long',
                            autoFocus: false,
                          },
                        });
                      }}
                    />
                  </View>
                  <View style={styles.footerBtnItem}>
                    <Button
                      type="primary"
                      titleStyle={styles.openPositionBtn}
                      buttonStyle={styles.shortBtn}
                      title={t('page.perpsDetail.action.short')}
                      onPress={() => {
                        naviPush(RootNames.StackTransaction, {
                          screen: RootNames.PerpsSearch,
                          params: {
                            openFromSource: 'openPosition',
                            direction: 'Short',
                            autoFocus: false,
                          },
                        });
                      }}
                    />
                  </View>
                </View>
              </View>
            )}
          </View>
        )}
      </NormalScreenContainer2024>
      <PerpsPopupGroup
        currentPerpsAccount={currentPerpsAccount}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onDeleteAgent={handleDeleteAgent}
        onDeposit={handleDeposit}
        onWithdraw={handleWithdraw}
        onSpotOrder={handleStableCoinOrder}
        onApproveStatus={handleActionApproveStatus}
        onSafeSetReference={handleSafeSetReference}
        riskPopupData={riskPopupData}
        onCloseRiskPopup={handleCloseRiskPopup}
        isShowInvite={isShowInvite}
        setIsShowInvite={setIsShowInvite}
      />
    </>
  );
};

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  topBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: -1,
  },
  container: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 12,
  },
  screenContainer: {
    position: 'relative',
    flex: 1,
    height: '100%',
  },
  webviewWrapper: {
    flex: 1,
  },
  scrollContent: {
    // paddingBottom: 10,
  },
  footer: {
    backgroundColor: colors2024['neutral-bg-1'],
    paddingTop: 16,
    paddingHorizontal: 12,
    paddingBottom: 48,
  },
  emptyPadding: {
    height: 40,
  },
  backToTopButton: {
    position: 'absolute',
    right: 12,
    bottom: 140,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors2024['neutral-bg-1'],
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  itemSeparator: {
    height: 8,
  },
  listFooter: {
    height: 56,
  },
  footerBtns: {
    flexDirection: 'row',
    gap: 12,
  },
  footerBtnItem: {
    flex: 1,
  },
  longBtn: {
    backgroundColor: colors2024['green-default'],
    height: 52,
  },
  shortBtn: {
    backgroundColor: colors2024['red-default'],
    height: 52,
  },
  openPositionBtn: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
  },
}));
