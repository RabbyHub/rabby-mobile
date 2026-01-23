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
import { RootNames } from '@/constant/layout';
import { useAppThemeConfig, useTheme2024 } from '@/hooks/theme';
import {
  createGetStyles2024,
  makeDebugBorder,
  makeDevOnlyStyle,
} from '@/utils/styles';
import { StackActions, useFocusEffect } from '@react-navigation/native';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AppState,
  Dimensions,
  PanResponder,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewProps,
} from 'react-native';

import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  Extrapolate,
  interpolate,
  runOnJS,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { MultiHomeFeatTitle } from '@/constant/newStyle';
import { currencyService } from '@/core/services';
import { useMyAccounts } from '@/hooks/account';
import { storeApiAccountsSwitcher } from '@/hooks/accountsSwitcher';
import { apisHomeTabIndex, useRabbyAppNavigation } from '@/hooks/navigation';
import { useAccountsBalanceTrigger } from '@/hooks/useAccountsBalance';
import { matomoRequestEvent } from '@/utils/analytics';
import { navigateDeprecated } from '@/utils/navigation';
import { useTranslation } from 'react-i18next';
import { useSortAddressList } from '../../Address/useSortAddressList';
import { BadgeText } from '../components/BadgeText';
import { useApprovalAlertCounts } from '../hooks/approvals';

import RcIconLending from '@/assets2024/icons/home/IconLending.svg';
import RcIconPerps from '@/assets2024/icons/home/IconPerps.svg';
import { FastTouchable } from '@/components/Perf/FastTouchable';
import { useRendererDetect } from '@/components/Perf/PerfDetector';
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
import {
  isTabsSwiping,
  useAccountInfo,
} from '../../Address/components/MultiAssets/hooks';
import { BrowserSearchEntry } from '../../Browser/components/BrowserSearchEntry';
import { GasAccountBadge } from '../../GasAccount/components/GasAccountBadge';
import { apisLending } from '../../Lending/hooks';
import { PointsBadge } from '../../Points/components/PointsBadge';
import { useInitDetectDBAssets } from '../../Search/useAssets';
import { WatchListBadge } from '../../Watchlist/components/WatchListBadge';
import { HomeCenterArea } from '../components/HomeCenterArea';
import { HomeDappDrawer } from '../components/HomeDappDrawer';
import { HomePendingBadge } from '../components/HomePending';
import { LendingHF } from '../components/LendingHF';
import { MultiAddressHomeHeader } from '../components/MultiAddressHomeHeader';
import { PerpsPnl } from '../components/PerpsPnl';
import {
  refreshSuccessAndFailList,
  resetFetchHistoryTxCount,
  useHomeHistoryStore,
} from '../hooks/history';
import {
  TabsScrollView,
  TabsScrollViewProps,
} from '@/components/customized/react-native-collapsible-tab-view/ScrollView';
import {
  RNGHRefreshControl,
  RNGHScrollView,
} from '@/components/customized/reexports';
import {
  getPullThreshold,
  getScrollContainerPb,
  homeDrawerAnimateMutable,
  SCROLLABLE_STATUS,
  THRESHOLD_PERCENT,
} from '../hooks/useHomeDrawerAnimate';
import { useCurrentTabScrollY } from 'react-native-collapsible-tab-view';
import { ScrollHandlerProps } from '@/components/customized/react-native-collapsible-tab-view/hooks';
import { triggerImpact } from '@/utils/common';
import { WorkletFunction } from 'react-native-reanimated/lib/typescript/commonTypes';
import { IS_ANDROID, IS_IOS } from '@/core/native/utils';
import { HOME_TOP_HEADER_SIZES } from '@/constant/home';
import { debugLogService } from '@/core/services';

const isInActiveRef = {
  current: AppState.isAvailable
    ? AppState.currentState === 'background'
    : false,
};
AppState.addEventListener('change', state => {
  debugLogService.info('AppState change', state);
  isInActiveRef.current = state === 'background';
});

function couldDoRefresh() {
  debugLogService.info('AppState.currentState', AppState.currentState);
  debugLogService.info('AppState.isAvailable', AppState.isAvailable);
  debugLogService.info('isInActiveRef', isInActiveRef.current);
  debugLogService.info(
    'couldDoRefresh',
    !isInActiveRef.current && apisHomeTabIndex.isHomeAtFirstTab(),
  );
  return !isInActiveRef.current && apisHomeTabIndex.isHomeAtFirstTab();
}

const OFFSETS = {
  atBottomThreshold: 0,
  // homeSwipeThreadhold: 20,
};

const {
  isExpanded,
  translateY,
  pullPercent,
  tabsOpacity,
  scrollViewContentHeight,
  scrollViewLayoutHeight,
  swipeUpHintHeight,
} = homeDrawerAnimateMutable;

function getIsAtBottom(scrollY: number, translateY = 0) {
  'worklet';
  const ret = {
    isAtBottom: false,
  };
  if (!scrollViewContentHeight || !scrollViewLayoutHeight) ret;

  const scrollOffset = Math.max(
    0,
    scrollViewContentHeight.value - scrollViewLayoutHeight.value,
  );
  const restScrollOffset = clamp(scrollOffset - scrollY, 0, scrollOffset);
  ret.isAtBottom = restScrollOffset <= OFFSETS.atBottomThreshold;

  const absScrollY = scrollY - translateY;

  return {
    ...ret,
    absScrollY,
    scrollOffset,
    restScrollOffset,
  };
}

const scrHeight = Dimensions.get('screen').height;
const winHeight = Dimensions.get('window').height;
function hasOverThreshold() {
  'worklet';
  return translateY.value < getPullThreshold(scrHeight) * -1;
}

const tabsScrollHandlers = {
  onContentSizeChange: ((_, height) => {
    scrollViewContentHeight.value = height;
  }) as TabsScrollViewProps['onContentSizeChange'] & object,
  onLayout: (event => {
    scrollViewLayoutHeight.value = event.nativeEvent.layout.height;
  }) as TabsScrollViewProps['onLayout'] & object,
};

const swipeUpViewHandlers = {
  onLayout: (event => {
    swipeUpHintHeight.value = event.nativeEvent.layout.height;
  }) as ViewProps['onLayout'] & object,
};

const useHomeAnimation = <T extends ScrollView | RNGHScrollView>() => {
  const scrollableRef = useAnimatedRef<T>();
  const scrollY = useCurrentTabScrollY();

  const scrollableStatus = useSharedValue<SCROLLABLE_STATUS>(
    SCROLLABLE_STATUS.UNLOCKED,
  );
  const scrollableEnabled = useSharedValue(true);
  useAnimatedReaction(
    () => {
      return scrollableStatus.value;
    },
    (cur, prev) => {
      // scrollableEnabled.value = true;
    },
  );
  const scrollToEnd = useCallback(
    (toBottom: boolean, animated = true) => {
      'worklet';
      if (toBottom) {
        scrollTo(scrollableRef, 0, 9999, animated);
      } else {
        scrollTo(scrollableRef, 0, 0, animated);
      }
      scrollableStatus.value = SCROLLABLE_STATUS.UNLOCKED;
    },
    [scrollableRef, scrollableStatus],
  );

  const [iosBounces, setIosBounces] = useState(false);

  useAnimatedReaction(
    () => translateY.value,
    translateYValue => {
      pullPercent.value = (translateYValue / scrHeight) * 100;
      const percentValue = pullPercent.value;
      if (percentValue === -100) {
        isExpanded.value = true;
        scrollToEnd(true, false);
      } else if (percentValue === 0) {
        isExpanded.value = false;
      }

      tabsOpacity.value = interpolate(
        percentValue,
        [-THRESHOLD_PERCENT, -0],
        [0, 1],
        Extrapolate.CLAMP,
      );

      if (IS_IOS) {
        runOnJS(setIosBounces)(translateYValue >= 0);
      }
    },
  );

  const uiOnScrollBack = useCallback<WorkletFunction>(
    // @ts-expect-error
    () => {
      'worklet';
      scrollToEnd(false, true);
    },
    [scrollToEnd],
  );

  const onScrollHandlers = {
    onScroll: useCallback<ScrollHandlerProps['onScroll'] & object>(event => {},
    []),
  };

  const startValues = useSharedValue({
    restScrollOffset: 0,
    hasImpactOnUpdate: false,
  });

  const pullThreshold = getPullThreshold(scrHeight);
  const activeY = Math.min(8, Math.round(Math.floor(pullThreshold * 0.1)));
  const panGestureRef = useRef(
    Gesture.Pan()
      .shouldCancelWhenOutside(false)
      .activeOffsetY(-activeY)
      .maxPointers(1)
      .onStart(() => {
        // translateY.value = 0;
        // isExpanded.value = false;
        startValues.value.restScrollOffset = getIsAtBottom(
          scrollY.value,
        ).restScrollOffset;
      })
      .onUpdate(event => {
        const { isAtBottom } = getIsAtBottom(scrollY.value, translateY.value);

        translateY.value =
          event.translationY + startValues.value.restScrollOffset;
        if (isAtBottom) {
          scrollableStatus.value = SCROLLABLE_STATUS.LOCKED;
        } else {
          scrollableStatus.value = SCROLLABLE_STATUS.UNLOCKED;
        }

        if (hasOverThreshold() && event.translationY < 0) {
          if (IS_ANDROID) {
            scrollToEnd(true, true);
          }
          !startValues.value.hasImpactOnUpdate && runOnJS(triggerImpact)();
          startValues.value.hasImpactOnUpdate = true;
        }
      })
      .onEnd(() => {
        const hasImpactOnUpdate = startValues.value.hasImpactOnUpdate;

        if (hasOverThreshold()) {
          translateY.value = withTiming(-scrHeight, undefined, () => {
            scrollableStatus.value = SCROLLABLE_STATUS.UNLOCKED;
          });
          !hasImpactOnUpdate && runOnJS(triggerImpact)();
        } else {
          translateY.value = withTiming(0, undefined, () => {
            scrollableStatus.value = SCROLLABLE_STATUS.UNLOCKED;
          });
        }
        startValues.value.hasImpactOnUpdate = false;
      }),
  );

  const mainStyle = useAnimatedStyle(() => {
    return {
      // overflow: 'hidden',
      transform: [
        {
          translateY: Math.min(0, translateY.value),
        },
      ],
    };
  });

  const tabScrollViewBounces = IS_IOS && iosBounces;

  return {
    tabScrollViewBounces,
    panGestureRef,

    onScrollHandlers,
    uiOnScrollBack,
    scrollableRef,
    scrollableEnabled,
    scrollViewContentHeight,
    scrollViewLayoutHeight,
    mainStyle,
  };
};

const HEADER_MT_OFFSET = HOME_TOP_HEADER_SIZES.headerHeight;

const getStyle = createGetStyles2024(
  ({ colors2024, isLight, safeAreaInsets }) => ({
    main: {
      height: '100%',
      overflow: 'hidden',
      // ...makeDevOnlyStyle({
      //   backgroundColor: colors2024['orange-light-2'],
      // }),
    },
    scroll: {
      flex: 1,
      // marginBottom: -HOME_TOP_HEADER_SIZES.tabItemHeight,
      marginTop: HEADER_MT_OFFSET,
      marginBottom: -HOME_TOP_HEADER_SIZES.tabItemHeight - HEADER_MT_OFFSET,
      // marginBottom: -TAB_HEADER_FULL_HEIGHT,
      // ...makeDebugBorder('yellow'),
      // ...makeDevOnlyStyle({
      //   backgroundColor: colors2024['green-light-2'],
      // }),
    },
    scrollContainer: {
      flexGrow: 1,
      minHeight: '100%',
      // marginTop: -HOME_TOP_HEADER_SIZES.tabItemHeight,
      marginTop: -HOME_TOP_HEADER_SIZES.tabItemHeight - HEADER_MT_OFFSET,
      // paddingBottom:
      //   IS_ANDROID ? Math.max(safeAreaInsets.bottom, 16)
      //     : safeAreaInsets.bottom,
      paddingBottom: getScrollContainerPb(safeAreaInsets.bottom),
      // ...makeDebugBorder('orange'),
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
    pullUpWrapper: {
      flex: 1,
      position: 'relative',
      // ...makeDebugBorder(),
    },
    swipeUpHint: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 16,
      // ...makeDebugBorder('purple'),
    },
    swipeUpHintText: {
      marginTop: 4,
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '500',
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
    },
  }),
);

export const HomeOverview = React.memo(() => {
  const navigation = useRabbyAppNavigation();
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({
    getStyle,
  });
  const { pendingTxCount, historyCount } = useHomeHistoryStore();

  const { width } = useWindowDimensions();
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

  const { isEligible, checkAddressesEligibility } = useGasAccountEligibility();

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
  const isFirstTriggerRef = useRef(true);

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
      debugLogService.info('useFocusEffect triggered');
      if (!couldDoRefresh()) return;
      const forceFirstTime = isFirstTriggerRef.current;
      debugLogService.info('couldDoRefresh true', forceFirstTime);
      if (isFirstTriggerRef.current) {
        isFirstTriggerRef.current = false;
      }
      triggerUpdate(forceFirstTime || undefined).then(balanceAccounts => {
        debugLogService.info('triggerUpdate then', balanceAccounts);
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
  }, [triggerUpdate, checkAddressesEligibility, forceUpdate, myTop10Addresses]);

  // const { toggleUseAllAccountsOnScene } = useSwitchSceneCurrentAccount();
  const handlePressWatchlist = useCallback(() => {
    navigation.navigateDeprecated(RootNames.StackHomeNonTab, {
      screen: RootNames.Watchlist,
      params: {},
    });
  }, [navigation]);

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

        default:
          break;
      }
    },
    [handlePressWatchlist, navigation],
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

  const {
    tabScrollViewBounces,
    mainStyle,
    onScrollHandlers,
    uiOnScrollBack,
    scrollableRef,
    scrollableEnabled,
    panGestureRef,
  } = useHomeAnimation<RNGHScrollView>();

  useRendererDetect({ name: 'MultiAddressHome::HomeOverview' });

  return (
    <View style={styles.pullUpWrapper}>
      <Animated.View style={[styles.main, mainStyle]}>
        <GestureDetector gesture={panGestureRef.current}>
          <TabsScrollView
            ref={scrollableRef}
            showsVerticalScrollIndicator={false}
            style={[styles.scroll, { flex: undefined }]}
            contentContainerStyle={[styles.scrollContainer]}
            bounces={tabScrollViewBounces}
            overScrollMode={'never'}
            scrollEventThrottle={16}
            onContentSizeChange={tabsScrollHandlers.onContentSizeChange}
            onLayout={tabsScrollHandlers.onLayout}
            onScroll={onScrollHandlers.onScroll}
            scrollableEnabled={scrollableEnabled}
            simultaneousHandlers={[panGestureRef]}
            refreshControl={
              <RNGHRefreshControl refreshing={false} onRefresh={onRefresh} />
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
              <View
                style={styles.swipeUpHint}
                onLayout={swipeUpViewHandlers.onLayout}>
                <RcIconDoubleArrowCC color={colors2024['neutral-secondary']} />
                <Text style={styles.swipeUpHintText}>
                  {t('page.home.swipeUp.desc')}
                </Text>
              </View>
            </View>
          </TabsScrollView>
        </GestureDetector>
      </Animated.View>
      <HomeDappDrawer onScrollBack={uiOnScrollBack} />
    </View>
  );
});
