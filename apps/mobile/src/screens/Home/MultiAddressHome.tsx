import RcIconDoubleArrowCC from '@/assets2024/icons/common/double-arrow-cc.svg';
import RcIconApprovalsCC from '@/assets2024/icons/home/IconApprovalsCC.svg';
import RcIconBridgeCC from '@/assets2024/icons/home/IconBridgeCC.svg';
import RcIconGasAccountCC from '@/assets2024/icons/home/IconGasAccountCC.svg';
import IconGift from '@/assets2024/icons/home/IconGift.svg';
import RcIconHistoryCC from '@/assets2024/icons/home/IconHistoryCC.svg';
import RcIconPointsCC from '@/assets2024/icons/home/IconPointsCC.svg';
import RcIconReceiveCC from '@/assets2024/icons/home/IconReceiveCC.svg';
import RcIconSendCC from '@/assets2024/icons/home/IconSendCC.svg';
import RcIconSwapCC from '@/assets2024/icons/home/IconSwapCC.svg';
import RcIconWatchlistCC from '@/assets2024/icons/home/IconWatchlistCC.svg';
import RcIconDapps from '@/assets2024/icons/home/IconDapps.svg';
import { RootNames } from '@/constant/layout';
import { IS_ANDROID } from '@/core/native/utils';
import { useAppThemeConfig, useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { StackActions, useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo } from 'react';
import {
  AppState,
  Dimensions,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { MultiHomeFeatTitle } from '@/constant/newStyle';
import { apisAccount } from '@/core/apis';
import {
  browserService,
  currencyService,
  preferenceService,
} from '@/core/services';
import { useMyAccounts } from '@/hooks/account';
import { storeApiAccountsSwitcher } from '@/hooks/accountsSwitcher';
import {
  apisHomeTabIndex,
  resetNavigationTo,
  useRabbyAppNavigation,
} from '@/hooks/navigation';
import { useAccountsBalanceTrigger } from '@/hooks/useAccountsBalance';
import { matomoRequestEvent } from '@/utils/analytics';
import {
  getReadyNavigationInstance,
  navigateDeprecated,
} from '@/utils/navigation';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSortAddressList } from '../Address/useSortAddressList';
import { BadgeText } from './components/BadgeText';
import { useApprovalAlertCounts } from './hooks/approvals';

import RcIconLending from '@/assets2024/icons/home/IconLending.svg';
import RcIconPerps from '@/assets2024/icons/home/IconPerps.svg';
import { ScreenSpecificStatusBar } from '@/components/FocusAwareStatusBar';
import { FastTouchable } from '@/components/Perf/FastTouchable';
import { useRendererDetect } from '@/components/Perf/PerfDetector';
import { HomeGuidanceMultipleTabs } from '@/components2024/Animations/HomeGuidanceMultipleTabs';
import {
  HOME_REFRESH_INTERVAL,
  ITEM_GRID_GAP,
  ITEM_LAYOUT_PADDING_HORIZONTAL,
} from '@/constant/home';
import { perfEvents } from '@/core/utils/perf';
import { syncTop10History } from '@/databases/hooks/history';
import { useSubscribePosition } from '@/hooks/perps/usePerpsStore';
import { useFetchCexInfo } from '@/hooks/useAddrDesc';
import { useGasAccountEligibility } from '@/hooks/useGasAccountEligibility';
import { refreshDayCurve } from '@/hooks/useMultiCurve';
import {
  refresh24hAssets,
  useScene24hBalanceLightWeightData,
} from '@/hooks/useScene24hBalance';
import { deleteLongTimeCurveCache } from '@/utils/24balanceCurveCache';
import { deleteLongTime24hBalanceCache } from '@/utils/24hBalanceCache';
import { colord } from 'colord';
import dayjs from 'dayjs';
import { Tabs } from 'react-native-collapsible-tab-view';
import {
  isTabsSwiping,
  useAccountInfo,
} from '../Address/components/MultiAssets/hooks';
import { setIsFoldMultiChart } from '../Address/components/MultiAssets/RenderRow/CurveChart';
import {
  TAB_HEADER_MIN_HEIGHT,
  TabMultiAssetsProps,
  TabsMultiAssets,
} from '../Address/components/MultiAssets/TabsMultiAssets';
import { BrowserSearchEntry } from '../Browser/components/BrowserSearchEntry';
import { GasAccountBadge } from '../GasAccount/components/GasAccountBadge';
import { apisLending } from '../Lending/hooks';
import { PointsBadge } from '../Points/components/PointsBadge';
import { useInitDetectDBAssets } from '../Search/useAssets';
import { WatchListBadge } from '../Watchlist/components/WatchListBadge';
import { TABITEM_H } from './components/CustomTabBar';
import { HomeCenterArea } from './components/HomeCenterArea';
import { HomeDappDrawer } from './components/HomeDappDrawer';
import { HomePendingBadge } from './components/HomePending';
import { LendingHF } from './components/LendingHF';
import { MultiAddressHomeHeader } from './components/MultiAddressHomeHeader';
import { PerpsPnl } from './components/PerpsPnl';
import { TmpHomeRefresher } from './components/TmpHomeRefresher';
import {
  refreshSuccessAndFailList,
  resetFetchHistoryTxCount,
  useHomeHistoryStore,
} from './hooks/history';
import { useHomeAnimation } from './hooks/useHomeDrawerAnimate';
import { useBrowser, useHomeDisplayedTabs } from '@/hooks/browser/useBrowser';

const isInActiveRef = {
  current: AppState.isAvailable ? AppState.currentState !== 'active' : false,
};
AppState.addEventListener('change', state => {
  isInActiveRef.current = state !== 'active';
});
function couldDoRefresh() {
  return !isInActiveRef.current && apisHomeTabIndex.isHomeAtFirstTab();
}

const onIndexChange = (idx: number) => apisHomeTabIndex.setTabIndex(idx);

const OverViewComponent = React.memo(
  ({}: React.ComponentProps<TabMultiAssetsProps['OverViewComponent']>) => {
    const navigation = useRabbyAppNavigation();
    const { t } = useTranslation();
    const { styles, colors2024 } = useTheme2024({
      getStyle,
    });
    const { pendingTxCount, historyCount } = useHomeHistoryStore();

    const { width, height } = useWindowDimensions();
    const itemWidth =
      (width - ITEM_LAYOUT_PADDING_HORIZONTAL * 2 - ITEM_GRID_GAP - 2) / 2;

    const {
      alertInfo,
      forceUpdate,
      triggerUpdate: triggerUpdateAlert,
    } = useApprovalAlertCounts(HOME_REFRESH_INTERVAL);

    const { accounts } = useMyAccounts({ disableAutoFetch: true });
    const sortedAccounts = useSortAddressList(accounts);
    useSubscribePosition(sortedAccounts);

    const { isEligible, checkAddressesEligibility } =
      useGasAccountEligibility();

    useFocusEffect(
      React.useCallback(() => {
        if (!couldDoRefresh()) return;
        checkAddressesEligibility();
      }, [checkAddressesEligibility]),
    );

    const MENU_ARR = useMemo(
      () =>
        [
          {
            key: MultiHomeFeatTitle.Swap,
            title: t('page.home.services.swap'),
            icon: RcIconSwapCC,
          },
          {
            key: MultiHomeFeatTitle.Send,
            title: t('page.home.services.send'),
            icon: RcIconSendCC,
          },
          {
            key: MultiHomeFeatTitle.Receive,
            title: t('page.home.services.receive'),
            icon: RcIconReceiveCC,
          },
          {
            key: MultiHomeFeatTitle.Bridge,
            title: t('page.home.services.bridge'),
            icon: RcIconBridgeCC,
          },
          {
            key: MultiHomeFeatTitle.Perps,
            title: t('page.home.services.perps'),
            icon: RcIconPerps,
          },
          {
            key: MultiHomeFeatTitle.Lending,
            title: t('page.home.services.lending'),
            icon: RcIconLending,
            color: colors2024['brand-default-icon'],
          },
          {
            key: MultiHomeFeatTitle.Points,
            title: t('page.rabbyPoints.title'),
            icon: RcIconPointsCC,
          },
          {
            key: MultiHomeFeatTitle.History,
            title: t('page.home.services.history'),
            icon: RcIconHistoryCC,
            badge: historyCount?.fail || historyCount?.success,
            isSuccess: !historyCount?.fail,
          },
          {
            key: MultiHomeFeatTitle.Approvals,
            title: t('page.home.services.approvals'),
            icon: RcIconApprovalsCC,
            badge: alertInfo.total,
          },
          {
            key: MultiHomeFeatTitle.GasAccount,
            title: t('page.home.services.gasAccount'),
            icon: RcIconGasAccountCC,
            showGiftIcon: isEligible,
          },
          // __DEV__ && {
          //   title: MultiHomeFeatTitle.TEST_DAPP,
          //   icon: RcIconDapps,
          // },

          {
            key: MultiHomeFeatTitle.Watchlist,
            title: t('page.home.services.watchlist'),
            icon: RcIconWatchlistCC,
          },
          IS_ANDROID
            ? {
                key: MultiHomeFeatTitle.Dapps,
                title: t('page.home.services.dapps'),
                icon: RcIconDapps,
              }
            : null,
          // {
          //   title: MultiHomeFeatTitle.Ecosystem,
          //   icon: RcIconEcosystem,
          // },
        ].filter(Boolean) as {
          key: MultiHomeFeatTitle;
          title: string;
          icon: React.FC<import('react-native-svg').SvgProps>;
          color?: string;
          badge?: number;
          isSuccess?: boolean;
          showGiftIcon?: boolean;
        }[],
      [
        t,
        colors2024,
        historyCount?.fail,
        historyCount?.success,
        alertInfo.total,
        isEligible,
      ],
    );

    useFetchCexInfo();

    const { triggerUpdate } = useAccountsBalanceTrigger();

    useEffect(() => {
      setTimeout(() => {
        deleteLongTimeCurveCache();
        deleteLongTime24hBalanceCache();
      }, 0);
    }, []);

    useFocusEffect(
      useCallback(() => {
        if (!couldDoRefresh()) return;
        refreshSuccessAndFailList();
      }, []),
    );

    useFocusEffect(
      useCallback(() => {
        if (!couldDoRefresh()) return;
        resetFetchHistoryTxCount();
      }, []),
    );

    const { myTop10Addresses } = useAccountInfo();

    useFocusEffect(
      useCallback(() => {
        if (!couldDoRefresh()) return;
        triggerUpdate().then(balanceAccounts => {
          // console.debug('[perf] MultiAddressHome triggerUpdate refreshed:: balanceAccounts', balanceAccounts);
          refresh24hAssets({ balanceAccounts });
          refreshDayCurve({ balanceAccounts });
        });
        triggerUpdateAlert();
        // // leave here to measure perf impact
        // isNonPublicProductionEnv && apisLending.fetchLendingData({ persistOnly: true });
        syncTop10History(myTop10Addresses, false);
      }, [triggerUpdate, triggerUpdateAlert, myTop10Addresses]),
    );

    const onRefresh = useCallback(() => {
      if (!couldDoRefresh()) return;

      perfEvents.emit('HOME_WILL_BE_REFRESHED_MANUALLY');
      Promise.all([
        // force update balance from server api
        triggerUpdate(true).then(balanceAccounts => {
          refresh24hAssets({ force: true, balanceAccounts });
          refreshDayCurve({ force: true, balanceAccounts });
        }),
        checkAddressesEligibility(true),
      ]).finally(() => {
        // update at background
        forceUpdate();
        apisLending.fetchLendingData();
        syncTop10History(myTop10Addresses, true);
        currencyService.syncCurrencyList(true);
      });
    }, [
      triggerUpdate,
      checkAddressesEligibility,
      forceUpdate,
      myTop10Addresses,
    ]);

    // const { toggleUseAllAccountsOnScene } = useSwitchSceneCurrentAccount();
    const handlePressWatchlist = useCallback(() => {
      navigation.navigateDeprecated(RootNames.StackHomeNonTab, {
        screen: RootNames.Watchlist,
        params: {},
      });
    }, [navigation]);

    const { setPartialBrowserState } = useBrowser();

    const handleClickMenu = useCallback(
      (key: MultiHomeFeatTitle) => {
        if (!apisHomeTabIndex.isHomeAtFirstTab()) return;
        if (isTabsSwiping.value) {
          return;
        }
        switch (key) {
          case MultiHomeFeatTitle.Send:
            navigation.dispatch(
              StackActions.push(RootNames.StackTransaction, {
                screen: RootNames.Send,
                params: {},
              }),
            );
            break;
          case MultiHomeFeatTitle.Receive:
            navigation.dispatch(
              StackActions.push(RootNames.StackAddress, {
                screen: RootNames.ReceiveAddressList,
                params: {},
              }),
            );

            break;
          case MultiHomeFeatTitle.Swap:
            navigation.dispatch(
              StackActions.push(RootNames.StackTransaction, {
                screen: RootNames.MultiSwap,
                params: {},
              }),
            );

            break;
          case MultiHomeFeatTitle.Bridge:
            navigation.dispatch(
              StackActions.push(RootNames.StackTransaction, {
                screen: RootNames.MultiBridge,
                params: {},
              }),
            );
            break;
          case MultiHomeFeatTitle.History:
            storeApiAccountsSwitcher.toggleUseAllAccountsOnScene(
              'MultiHistory',
              true,
            );
            navigation.dispatch(
              StackActions.push(RootNames.StackTransaction, {
                screen: RootNames.MultiAddressHistory,
                params: {},
              }),
            );
            break;
          case MultiHomeFeatTitle.Approvals:
            navigateDeprecated(RootNames.StackAddress, {
              screen: RootNames.ApprovalAddressList,
            });
            break;
          case MultiHomeFeatTitle.GasAccount:
            navigation.dispatch(
              StackActions.push(RootNames.StackTransaction, {
                screen: RootNames.GasAccount,
                params: {},
              }),
            );
            break;
          case MultiHomeFeatTitle.Watchlist: {
            handlePressWatchlist();
            break;
          }
          case MultiHomeFeatTitle.Ecosystem:
            break;
          case MultiHomeFeatTitle.Perps:
            navigation.push(RootNames.StackTransaction, {
              screen: RootNames.Perps,
              params: {},
            });
            break;
          case MultiHomeFeatTitle.Lending:
            navigation.push(RootNames.StackTransaction, {
              screen: RootNames.Lending,
              params: {},
            });
            break;
          case MultiHomeFeatTitle.Points:
            navigation.push(RootNames.StackAddress, {
              screen: RootNames.Points,
              params: {},
            });
            break;

          case MultiHomeFeatTitle.Dapps:
            setPartialBrowserState({
              isShowBrowser: true,
              isShowSearch: true,
              searchText: '',
              searchTabId: '',
              trigger: 'home',
            });
            break;

          default:
            break;
        }
      },
      [handlePressWatchlist, navigation, setPartialBrowserState],
    );

    const generateCustomBadgeIcon = useCallback(
      (el: {
        key: MultiHomeFeatTitle;
        title: string;
        icon: React.FC<import('react-native-svg').SvgProps>;
        badge?: number;
        isSuccess?: boolean;
        showGiftIcon?: boolean;
      }) => {
        if (el.key === MultiHomeFeatTitle.Watchlist) {
          return <WatchListBadge />;
        }

        if (el.key === MultiHomeFeatTitle.Perps) {
          return <PerpsPnl />;
        }

        if (el.key === MultiHomeFeatTitle.History && pendingTxCount > 0) {
          return <HomePendingBadge number={pendingTxCount} />;
        }

        // 显示gift图标
        if (el.key === MultiHomeFeatTitle.GasAccount && el.showGiftIcon) {
          return <IconGift width={24} height={24} />;
        }

        if (el.key === MultiHomeFeatTitle.Lending) {
          return <LendingHF />;
        }

        if (el.key === MultiHomeFeatTitle.Points) {
          return <PointsBadge />;
        }

        if (el.key === MultiHomeFeatTitle.GasAccount) {
          return <GasAccountBadge />;
        }

        return (
          <>
            {!!el.badge && el.badge > 0 ? (
              <BadgeText
                count={el.badge}
                isSuccess={el.isSuccess}
                style={[styles.badgeStyle]}
              />
            ) : null}
          </>
        );
      },
      [pendingTxCount, styles.badgeStyle],
    );

    const { bottom } = useSafeAreaInsets();

    const {
      mainStyle,
      scrollableRef,
      panResponder,
      bounces,
      contentHeight,
      layoutHeight,
      showDappDrawer,
    } = useHomeAnimation();

    useRendererDetect({ name: 'MultiAddressHome::OverViewComponent' });
    const { homeDisplayedTabs: tabs } = useHomeDisplayedTabs();

    const SwipeUpHint = (
      <View style={styles.swipeUpHint}>
        <RcIconDoubleArrowCC color={colors2024['neutral-secondary']} />
        <Text style={styles.swipeUpHintText}>
          {IS_ANDROID
            ? tabs?.length
              ? t('page.home.swipeUp.descAndroidMore')
              : t('page.home.swipeUp.descAndroid')
            : tabs?.length
            ? t('page.home.swipeUp.descMore')
            : t('page.home.swipeUp.desc')}
        </Text>
      </View>
    );

    return (
      <View style={styles.pullUpWrapper}>
        <Animated.View style={mainStyle}>
          <Tabs.ScrollView
            ref={scrollableRef}
            {...(IS_ANDROID ? undefined : panResponder.panHandlers)}
            bounces={bounces}
            tvParallaxProperties={undefined}
            showsVerticalScrollIndicator={false}
            style={[styles.scroll, { flex: undefined }]}
            contentContainerStyle={[
              styles.scrollContainer,
              {
                // paddingBottom: bottom + 82,
                paddingBottom:
                  Platform.OS === 'android' ? Math.max(bottom, 16) : bottom,
              },
            ]}
            overScrollMode={'never'}
            scrollEventThrottle={16}
            onContentSizeChange={(_, heightValue) => {
              contentHeight.value = heightValue;
            }}
            onLayout={event => {
              layoutHeight.value = event.nativeEvent.layout.height;
            }}
            refreshControl={
              <RefreshControl refreshing={false} onRefresh={onRefresh} />
            }>
            <MultiAddressHomeHeader onRefresh={onRefresh} />

            <HomeCenterArea />

            <View style={styles.grid}>
              <View style={styles.gridItemsWrap}>
                {MENU_ARR.map((el, index) => {
                  return (
                    <FastTouchable
                      style={StyleSheet.flatten([
                        styles.gridItem,
                        { width: itemWidth },
                      ])}
                      key={index}
                      onPress={() => {
                        console.debug('[perf] touched menu', el.key);
                        requestAnimationFrame(() => {
                          handleClickMenu(el.key);
                        });
                        matomoRequestEvent({
                          category: 'Click_Services',
                          action: `Click_${el.key}`,
                        });
                      }}>
                      <View style={styles.badgeWrapper}>
                        <View style={styles.iconWrapper}>
                          <el.icon
                            width={28}
                            height={28}
                            color={el.color || colors2024['brand-default-icon']}
                          />
                        </View>
                        <View style={styles.rightBadgeWrapper}>
                          {generateCustomBadgeIcon(el)}
                        </View>
                      </View>
                      <Text style={styles.gridText}>{el.title}</Text>
                    </FastTouchable>
                  );
                })}
              </View>
              <BrowserSearchEntry />
              {IS_ANDROID ? (
                <TouchableOpacity onPress={showDappDrawer}>
                  {SwipeUpHint}
                </TouchableOpacity>
              ) : (
                SwipeUpHint
              )}
            </View>
          </Tabs.ScrollView>
        </Animated.View>
        <HomeDappDrawer />
      </View>
    );
  },
);

const detectHasAccounts = async () => {
  const result = { redirectAction: null as Function | null };
  const hasAccountsInKeyring = await apisAccount.hasVisibleAccounts();

  if (!hasAccountsInKeyring) {
    result.redirectAction = () => {
      const navigation = getReadyNavigationInstance();
      navigation &&
        resetNavigationTo(navigation, RootNames.GetStartedScreen2024);
    };
  }

  return result;
};

function MultiAddressHome(): JSX.Element {
  const { styles, colors2024, isLight } = useTheme2024({
    getStyle,
  });
  const appThemeConfig = useAppThemeConfig();

  const combinedData = useScene24hBalanceLightWeightData('Home');
  useRendererDetect({ name: 'MultiAddressHome' });

  useInitDetectDBAssets();

  useEffect(() => {
    setTimeout(() => {
      deleteLongTimeCurveCache();
      deleteLongTime24hBalanceCache();
    }, 0);
  }, []);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const { redirectAction } = await detectHasAccounts();
        if (redirectAction) {
          redirectAction();
        }
      })();
    }, []),
  );

  useEffect(() => {
    matomoRequestEvent({
      category: 'ThemeMode',
      action: `ThemeMode_${appThemeConfig}`,
    });
  }, [appThemeConfig]);

  useEffect(() => {
    const lastReportTime =
      preferenceService.getPreference('lastReportTime') || 0;
    if (!lastReportTime || !dayjs(lastReportTime).isToday()) {
      preferenceService.setPreference({
        lastReportTime: Date.now(),
      });

      matomoRequestEvent({
        category: 'Websites Usage',
        action: 'Website_LikeStatus',
        label: `LikeDapp:${
          browserService.bookmark.getState().ids?.length || 0
        }`,
      });

      matomoRequestEvent({
        category: 'Websites Usage',
        action: 'Website_TabStatus',
        label: `TabNumber:${
          browserService.getBrowserTabs()?.tabs?.length || 0
        }`,
      });

      matomoRequestEvent({
        category: 'Watchlist Usage',
        action: 'Watchlist_LikeStatus',
        label: `LikeToken:${
          preferenceService.getPreference('pinedQueue')?.length || 0
        }`,
      });
    }
  }, []);

  useEffect(() => {
    apisHomeTabIndex.setTabIndex(0);
  }, []);

  return (
    <NormalScreenContainer2024
      type="linear"
      noHeader
      bgImageSource={
        combinedData.isLoss
          ? require('@/assets2024/singleHome/loss-home.png')
          : require('@/assets2024/singleHome/up-home.png')
      }
      linearProp={{
        colors: isLight
          ? [colors2024['neutral-bg-1'], colors2024['neutral-bg-2']]
          : [colors2024['neutral-bg-1'], colors2024['neutral-bg-1']],
        locations: [0, 1],
        start: { x: 0.5, y: 0 },
        end: { x: 0.5, y: 0.26 },
      }}
      overwriteStyle={styles.screenContainer}>
      <ScreenSpecificStatusBar screenName={RootNames.Home} />

      <View
        style={[styles.paddingContainer]}
        onTouchStart={() => {
          setIsFoldMultiChart(true);
        }}>
        <TabsMultiAssets
          onIndexChange={onIndexChange}
          OverViewComponent={OverViewComponent}
        />
      </View>

      <HomeGuidanceMultipleTabs />

      <TmpHomeRefresher />
    </NormalScreenContainer2024>
  );
}

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  screenContainer: {
    paddingTop: 0,
  },
  paddingContainer: {
    paddingHorizontal: 0,
    flex: 1,
    flexGrow: 1,
  },
  container: {
    borderWidth: 1,
    borderColor: 'red',
    flexGrow: 1,
    minHeight: '100%',
  },
  headerContainer: {
    backgroundColor: 'transparent',
    paddingTop: 64,
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  redDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors2024['red-default'],
    position: 'absolute',
    top: 0,
    right: 13,
  },
  rootScreenContainer: {
    // ...makeDebugBorder(),
    // paddingHorizontal: 20,
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
    marginTop: TAB_HEADER_MIN_HEIGHT,
    marginBottom: -TABITEM_H - TAB_HEADER_MIN_HEIGHT,
  },
  scrollContainer: {
    // paddingTop: 88,
    flexGrow: 1,
    minHeight: '100%',
    marginTop: -TABITEM_H - TAB_HEADER_MIN_HEIGHT,
  },
  menuHeader: {
    height: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: ITEM_LAYOUT_PADDING_HORIZONTAL + 4,
    marginHorizontal: 4,
    margin: 12,
    marginBottom: 16,
    marginTop: 0,
  },
  pinHeader: {
    marginTop: -8,
  },
  pinGridText: {
    color: colors2024['neutral-body'],
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'left',
    fontFamily: 'SF Pro Rounded',
  },
  gridText: {
    color: colors2024['neutral-title-1'],
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'left',
    fontFamily: 'SF Pro Rounded',
  },
  badgeWrapper: {
    display: 'flex',
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconWrapper: {
    // height: 36,
    // width: 36,
    // backgroundColor: colors2024['brand-light-1'],
    // borderRadius: 12,
    // justifyContent: 'center',
    // alignItems: 'center',
  },
  rightBadgeWrapper: {
    position: 'relative',
    right: -4,
    alignSelf: 'flex-start',
  },
  badgeStyle: {},
  headerText: {
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
    fontSize: 17,
    lineHeight: 22,
    textAlign: 'left',
    fontFamily: 'SF Pro Rounded',
  },
  pinGrid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    borderRadius: 8,
    gap: 10,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    width: '100%',
    paddingHorizontal: ITEM_LAYOUT_PADDING_HORIZONTAL,
    marginTop: 20,
  },
  emptyItem: {
    backgroundColor: 'transparent',
  },
  pinGridItem: {
    backgroundColor: colord(
      isLight ? colors2024['neutral-bg-1'] : colors2024['neutral-bg-2'],
    )
      .alpha(0.6)
      .toRgbString(),
    borderRadius: 10,
    flexShrink: 0,
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    height: 42,
    gap: 10,
    position: 'relative',
    borderColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    borderWidth: 1,
  },
  menuContainer: {
    marginTop: 0,
  },
  grid: {
    marginTop: 0,
    // flexDirection: 'row',
    // flexWrap: 'wrap',
    // borderRadius: 8,
    // gap: ITEM_GRID_GAP,
    // justifyContent: 'space-between',
    // alignItems: 'flex-start',
    width: '100%',
    paddingHorizontal: ITEM_LAYOUT_PADDING_HORIZONTAL,
    // paddingHorizontal: 8,
    // paddingVertical: 12,
    // paddingTop: 16,re
  },
  gridGradientOutline: {
    backgroundColor: 'transparent',
    paddingHorizontal: 8,
    paddingTop: 16,
    paddingBottom: 12,
    width: '100%',
    gap: 16,
  },
  gridItemsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 8,
    rowGap: ITEM_GRID_GAP + 2,
    columnGap: ITEM_GRID_GAP,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
  },
  primaryActionsContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 10,
    height: 52,
    paddingHorizontal: 16,
  },
  primaryActionText: {
    color: colors2024['neutral-InvertHighlight'],
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
  },

  gridItem: {
    borderWidth: 2,
    borderColor: isLight
      ? colors2024['neutral-InvertHighlight']
      : 'transparent',
    backgroundColor: isLight
      ? colord(colors2024['neutral-bg-1']).alpha(0.86).toRgbString()
      : colors2024['neutral-bg-2'],
    width: '48%', // default
    minWidth: 0,
    borderRadius: 16,
    flexShrink: 0,
    padding: 16,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    height: 96,
    gap: 8,
    position: 'relative',
  },
  pendingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingBlur: {
    paddingLeft: 20,
    paddingRight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 0,
    width: 'auto',
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors2024['neutral-bg-1'],
    backgroundColor: colord(
      isLight ? colors2024['neutral-bg-1'] : colors2024['neutral-bg-2'],
    )
      .alpha(IS_ANDROID ? 1 : 0.89)
      .toRgbString(),
  },
  pendingText: {
    marginLeft: 2,
    color: colors2024['orange-default'],
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
  },
  floatBottom: {
    // position: 'absolute',
    // bottom: 0,
    // left: 0,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: Dimensions.get('window').width,
    paddingHorizontal: ITEM_LAYOUT_PADDING_HORIZONTAL,

    // height: 128,
  },
  search: {
    width: '100%',
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    height: 60,
    borderRadius: 100,
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    paddingHorizontal: 28,
    gap: 8,
  },
  searchText: {
    fontSize: 22,
    lineHeight: 28,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },

  noAssetsContainer: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    paddingHorizontal: 16,
    paddingBottom: 50,
    borderRadius: 50,
    overflow: 'hidden',
  },
  bgLeft: { position: 'absolute', top: 0, left: 0 },
  bgRight: { position: 'absolute', top: 35, right: 0 },
  bgb1: {
    position: 'absolute',
    top: 52,
    left: 16,
    transform: [{ scale: 0.5 }],
  },
  bgb2: {
    position: 'absolute',
    top: 76,
    right: 34,
    transform: [{ scale: 0.5 }],
  },
  noAssetsTitle: {
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 28,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 36,
    marginVertical: 42,
  },

  noAssetsItem: {
    paddingHorizontal: 16,
    paddingVertical: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  noAssetsIconWrapper: {
    width: 28,
    height: 28,
    backgroundColor: colors2024['brand-light-1'],
    borderRadius: 9.8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buyIcon: {
    alignSelf: 'flex-start',
  },
  noAssetsRight: {
    gap: 4,
    flexWrap: 'wrap',
    flex: 1,
  },
  noAssetsItemName: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 22,
  },
  noAssetsItemDesc: {
    maxWidth: '100%',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 20,
  },
  hidden: {
    display: 'none',
  },
  curveBox: {
    paddingHorizontal: 15,
    paddingTop: 12,
  },
  curveCard: {
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderWidth: 0,
    borderColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-line'],
    backgroundColor: 'transparent',
  },
  curveCardInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  shadowView: {
    ...Platform.select({
      ios: {
        shadowColor: colors2024['neutral-black'],
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 8,
      },
    }),
  },
  skeleton: {
    borderRadius: 8,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  curveContainer: {
    gap: 6,
  },
  arrow: {
    width: 42,
    height: 42,
    borderRadius: 30,
  },
  changePercent: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
  },
  netWorth: {
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  changeSection: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 4,
    alignItems: 'center',
  },
  changeTime: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    marginLeft: 4,
  },
  globalWarning: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: -16,
  },
  searchBarPlaceholder: {
    height: 80,
  },
  topWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
  },
  pullUpWrapper: {
    flex: 1,
    paddingBottom: IS_ANDROID ? 1 : 0,
  },
  pullUpPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  pullOverlay: {
    position: 'absolute',
    top: -90,
    transform: [{ translateX: -501 }],
    left: '50%',
    height: 1002,
    width: 1002,
    borderRadius: 10000,
    backgroundColor: colors2024['brand-light-1'],
    zIndex: 10,
    pointerEvents: 'none',
  },
  swipeUpHint: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 16,
  },
  swipeUpHintFixed: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  swipeUpHintText: {
    marginTop: 4,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
}));

export default MultiAddressHome;
