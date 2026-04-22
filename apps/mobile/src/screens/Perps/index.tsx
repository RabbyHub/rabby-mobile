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
import { PerpsAgentsLimitModal } from './components/PerpsAgentsLimitModal';
import { PerpsGuidePopup } from './components/PerpsGuidePopup';
import { PerpsDepositPopup } from './components/PerpsDepositPopup';
import { PerpsWithdrawPopup } from './components/PerpsWithdrawPopup';
import { PerpsSpotSwapPopup } from './components/PerpsSpotSwapPopup';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { usePerpsState } from '@/hooks/perps/usePerpsState';
import { usePerpsAccount } from '@/hooks/perps/usePerpsAccount';
import RcIconBackTopCC from '@/assets2024/icons/perps/IconBackTopCC.svg';
import { usePerpsPopupState } from './hooks/usePerpsPopupState';
import { useMemoizedFn, useRequest } from 'ahooks';
import { Account } from '@/core/services/preference';
import { PerpsAccountLogoutPopup } from './components/PerpsAccountLogoutPopup';
import { usePerpsDeposit } from './hooks/usePerpsDeposit';
import { PerpsMarketItem } from './components/PerpsMarketSection/PerpsMarketItem';
import { PerpsCategorySectionHeader } from './components/PerpsMarketSection/PerpsCategorySectionHeader';
import { PerpsSearchInlineInput } from './components/PerpsMarketSection/PerpsSearchInlineInput';
import { PerpsPositionSection } from './components/PerpsPositionSection';
import { apisPerps } from '@/core/apis';
import { PerpsAccountSelectorPopup } from './components/PerpsAccountSelectorPopup';
import { PerpsRegionAlert } from './components/PerpsRegionAlert';
import { PerpsNativeHeader } from './components/PerpsHeaderTitle';
import { RootNames } from '@/constant/layout';
import { naviPush } from '@/utils/navigation';
import { calculateDistanceToLiquidation } from './components/PerpsPositionSection/utils';
import { PerpsRiskLevelPopup } from './components/PerpsPositionSection/PerpsRiskLevelPopup';
import { PerpsSkeletonLoader } from './components/PerpsSkeletonLoader';
import { usePerpsPosition } from '../PerpsMarketDetail/hooks/usePerpsPosition';
import { PerpsInvitePopup } from './components/PerpsInvitePopup';
import { checkPerpsReference, getStatsReportSide } from '@/utils/perps';
import { perpsService } from '@/core/services';
import { stats } from '@/utils/stats';
import { APP_VERSIONS } from '@/constant';
import BigNumber from 'bignumber.js';
import { usePerpsGroupedMarketData } from './hooks/usePerpsGroupedMarketData';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { useShallow } from 'zustand/react/shallow';

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
    marketData,
    userFills,
    marketDataMap,
    logout,
    login,
    handleWithdraw,
    homeHistoryList,
    handleDeleteAgent,
    hasPermission,
    refreshData,
    fetchMarketData,
    perpFee,

    localLoadingHistory,

    handleActionApproveStatus,
    handleSafeSetReference,
    setInitialized,

    favoriteMarkets,
  } = usePerpsState();
  const { handleClosePosition, handleStableCoinOrder } = usePerpsPosition();
  const { isUnifiedAccount } = usePerpsAccount();

  const [popupState, setPopupState] = usePerpsPopupState();

  const backendCategories = perpsStore(useShallow(s => s.categories));
  const { visibleHome } = usePerpsGroupedMarketData({
    marketData,
    favoriteMarkets,
    backendCategories,
  });

  const scrollViewRef = useRef<ScrollView>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [selectedCoin, setSelectedCoin] = useState<string | null>(null);

  const handleLogin = useMemoizedFn(async (v: Account) => {
    await login(v);
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

  const handleShowRiskPopup = useMemoizedFn((coin: string) => {
    setSelectedCoin(coin);
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

    const marketDataItem = marketDataMap[selectedCoin];
    const markPrice = Number(marketDataItem?.markPx || 0);
    const liquidationPrice = Number(
      selectedPosition.position.liquidationPx || 0,
    );

    const distanceLiquidation = calculateDistanceToLiquidation(
      selectedPosition.position.liquidationPx,
      marketDataItem?.markPx,
    );
    return {
      distanceLiquidation,
      isCross: selectedPosition.position.leverage.type === 'cross',
      direction:
        Number(selectedPosition.position.szi || 0) > 0
          ? 'Long'
          : ('Short' as 'Long' | 'Short'),
      currentPrice: markPrice,
      pxDecimals: marketDataItem?.pxDecimals || 2,
      liquidationPrice,
    };
  }, [selectedCoin, positionAndOpenOrders, marketDataMap]);

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
              <PerpsAccountCard />
              <PerpsPositionSection
                handleShowRiskPopup={handleShowRiskPopup}
                handleCloseRiskPopup={handleCloseRiskPopup}
                positionAndOpenOrders={positionAndOpenOrders}
                handleActionApproveStatus={handleActionApproveStatus}
                marketDataMap={marketDataMap}
                onClosePosition={async position => {
                  const marketDataItem = marketDataMap[position.coin];
                  const res = await handleClosePosition({
                    coin: position.coin,
                    size: Math.abs(Number(position.szi || 0)).toString() || '0',
                    direction: Number(position.szi || 0) > 0 ? 'Long' : 'Short',
                    price: marketDataItem?.markPx || '0',
                  });
                  if (res) {
                    const { avgPx, totalSz } = res;
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
                      size: totalSz,
                      price: avgPx,
                      trade_usd_value: new BigNumber(avgPx)
                        .times(totalSz)
                        .toFixed(2),
                      service_provider: 'hyperliquid',
                      app_version: APP_VERSIONS.fromNative || '0',
                      address_type: currentPerpsAccount?.type || '',
                    });
                  }
                }}
              />

              {visibleHome.map((cat, catIdx) => {
                return (
                  <View key={cat.id}>
                    <PerpsCategorySectionHeader cfg={cat.cfg} />
                    {cat.items.map((item, i) => (
                      <PerpsMarketItem
                        key={`${cat.id}-${item.name}`}
                        item={item}
                        rank={cat.cfg.showRankOnHome ? i + 1 : undefined}
                        onPress={() => {
                          scrollToTop();
                          naviPush(RootNames.StackTransaction, {
                            screen: RootNames.PerpsMarketDetail,
                            params: {
                              market: item.name,
                              fromSource: 'openPosition',
                              showOpenPosition: true,
                            },
                          });
                        }}
                      />
                    ))}
                    {catIdx === 0 && <PerpsSearchInlineInput />}
                  </View>
                );
              })}
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
      <PerpsAccountSelectorPopup
        visible={popupState.isShowLoginPopup}
        onClose={() => {
          setPopupState(prev => ({
            ...prev,
            isShowLoginPopup: false,
          }));
        }}
        value={currentPerpsAccount}
        onChange={handleLogin}
        title={t('page.perps.selectAccountTitle')}
      />
      <PerpsAccountLogoutPopup
        visible={popupState.isShowLogoutPopup}
        onClose={() => {
          setPopupState(prev => ({
            ...prev,
            isShowLogoutPopup: false,
          }));
        }}
        onLogout={handleLogout}
        account={currentPerpsAccount}
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
      <PerpsGuidePopup
        visible={popupState.isShowGuidePopup}
        onClose={async () => {
          setPopupState(prev => ({
            ...prev,
            isShowGuidePopup: false,
          }));
        }}
        onComplete={() => {
          apisPerps.setHasDoneNewUserProcess(true);
          setPopupState(prev => ({
            ...prev,
            isShowGuidePopup: false,
          }));
        }}
      />
      <PerpsDepositPopup
        account={currentPerpsAccount}
        visible={popupState.isShowDepositPopup}
        onClose={() => {
          setPopupState(prev => ({
            ...prev,
            isShowDepositPopup: false,
          }));
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
      <PerpsWithdrawPopup
        visible={popupState.isShowWithdrawPopup}
        marketDataMap={marketDataMap}
        onWithdraw={async (amount, isHypeWithdraw, targetAsset) => {
          await handleWithdraw(
            amount,
            isHypeWithdraw,
            isUnifiedAccount,
            targetAsset,
          );
          setPopupState(prev => ({
            ...prev,
            isShowWithdrawPopup: false,
          }));
        }}
        onClose={() => {
          setPopupState(prev => ({
            ...prev,
            isShowWithdrawPopup: false,
          }));
        }}
      />
      <PerpsSpotSwapPopup
        visible={popupState.isShowSwapPopup}
        onClose={() => {
          setPopupState(prev => ({
            ...prev,
            isShowSwapPopup: false,
          }));
        }}
        onSpotOrder={handleStableCoinOrder}
        onSwapSuccess={() => {
          // Balance refreshed via WebSocket subscription
        }}
        onDepositPress={() => {
          setPopupState(prev => ({
            ...prev,
            isShowDepositPopup: true,
          }));
        }}
      />
      {riskPopupData && (
        <PerpsRiskLevelPopup
          isCross={riskPopupData.isCross}
          direction={riskPopupData.direction}
          visible={!!riskPopupData}
          pxDecimals={riskPopupData?.pxDecimals || 2}
          onClose={handleCloseRiskPopup}
          distanceLiquidation={riskPopupData.distanceLiquidation}
          currentPrice={riskPopupData.currentPrice}
          liquidationPrice={riskPopupData.liquidationPrice}
        />
      )}
      <PerpsInvitePopup
        visible={isShowInvite}
        onClose={() => setIsShowInvite(false)}
        onInvite={async () => {
          await handleActionApproveStatus({
            isHideToast: true,
          });
          await handleSafeSetReference();
          setIsShowInvite(false);
        }}
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
