import { apisPerps } from '@/core/apis';
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
import RcIconMarketCC from '@/assets2024/icons/home/IconMarketCC.svg';

import RcIconAsterCC from '@/assets2024/icons/home/IconAsterCC.svg';
import RcIconLighterCC from '@/assets2024/icons/home/IconLighterCC.svg';
import { RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
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
  ActivityIndicator,
  AppState,
  Dimensions,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewProps,
} from 'react-native';

import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  Extrapolate,
  interpolate,
  makeMutable,
  runOnJS,
  runOnUI,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { MultiHomeFeatTitle } from '@/constant/newStyle';
import { currencyService } from '@/core/services';
import { useMyAccounts } from '@/hooks/account';
import { storeApiAccountsSwitcher } from '@/hooks/accountsSwitcher';
import { apisHomeTabIndex, useRabbyAppNavigation } from '@/hooks/navigation';
import addressBalanceStore from '@/store/balance';
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
import { refreshDayCurve } from '@/store/curve24h';
import { scene24hBalanceStore } from '@/store/balance24h';
import { deleteLongTimeCurveCache } from '@/utils/24balanceCurveCache';
import { deleteLongTime24hBalanceCache } from '@/utils/24hBalanceCache';
import useTokenList from '@/store/tokens';
import useProtocol from '@/store/protocols';
import { colord } from 'colord';
import { isTabsSwiping } from '../../Address/components/MultiAssets/hooks';
import { BrowserOrPerpsPosition } from './BrowserOrPerpsPosition';
import { GasAccountBadge } from '../../GasAccount/components/GasAccountBadge';
import { apisLending } from '../../Lending/hooks';
import { PointsBadge } from '../../Points/components/PointsBadge';
import { HomeCenterArea } from '../components/HomeCenterArea';
import { HomeDappDrawer } from '../components/HomeDappDrawer';
import { HomePendingBadge } from '../components/HomePending';
import { ETHStatus, refreshETHStatus } from '../components/ETHStatus';
import { LendingHF } from '../components/LendingHF';
import { MultiAddressHomeHeader } from '../components/MultiAddressHomeHeader';
import { PerpsPnl } from '../components/PerpsPnl';
import {
  refreshSuccessAndFailList,
  resetFetchHistoryTxCount,
  useHomeHistoryStore,
} from '../hooks/history';
import { useHomePortfolioStore } from '../hooks/useHomePortfolioSummary';
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
import {
  SharedValue,
  WorkletFunction,
} from 'react-native-reanimated/lib/typescript/commonTypes';
import { IS_ANDROID, IS_IOS } from '@/core/native/utils';
import {
  HOME_TOP_HEADER_SIZES,
  SHOULD_SHOW_CUSTOM_INDICATOR_WHEN_LOADING,
} from '@/constant/home';
import { useInnerDappSelection } from '@/hooks/useInnerDappSelection';
import { NewTag } from './NewTag';
import { useHomeFeatureNewTag } from '../hooks/useHomeFeatureNewTag';
import { useMemoizedFn } from 'ahooks';
import { useValueFromSharedValue } from '@/hooks/reanimated';
import { sleep } from '@/utils/async';
import { getTop10MyAccounts } from '@/core/apis/account';
import { isEqual } from 'lodash';
import { useAccountInfo } from '@/screens/Address/components/MultiAssets/hooks';
import {
  isOverPulldownRefreshThreshold,
  OnRefreshOnJs,
  pulldownRefreshSizes,
  RefreshPlaceholderIOS,
  setPulldownRefreshStage,
  useIOSPulldownRefreshStates,
  usePulldownRefreshStyles,
} from '@/components/customized/ScrollViewLike/RefreshPlaceholderIOS';
import { Text } from '@/components/Typography';

function couldDoRefresh() {
  return apisHomeTabIndex.isHomeAtFirstTab();
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
  if (!scrollViewContentHeight || !scrollViewLayoutHeight) {
    ret;
  }

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

const homeGestureConfs = {
  activeY: Math.min(
    8,
    Math.round(Math.floor(getPullThreshold(scrHeight) * 0.1)),
  ),
};

const usePulldownRefreshGesture = <T extends ScrollView | RNGHScrollView>({
  onJsPulldownRefresh: prop_onJsPulldownRefresh,
}: {
  onJsPulldownRefresh?: OnRefreshOnJs;
} = {}) => {
  const scrollableRef = useAnimatedRef<T>();
  const scrollY = useCurrentTabScrollY();

  const scrollableStatus = useSharedValue<SCROLLABLE_STATUS>(
    SCROLLABLE_STATUS.UNLOCKED,
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
  const { pullDistance, svIsRefreshing, svIsManualRefreshing } =
    useIOSPulldownRefreshStates();

  const onJsPulldownRefresh = useMemoizedFn(async () => {
    await prop_onJsPulldownRefresh?.({ svIsManualRefreshing });
  });

  useEffect(() => {
    const remove = addressBalanceStore.subscribe(async (cur, prev) => {
      if (cur.metaMap === prev.metaMap || isEqual(cur.metaMap, prev.metaMap)) {
        return;
      }
      const { top10Addresses } = await getTop10MyAccounts();
      const isTop10BalanceLoading =
        addressBalanceStore.getAddressesFlowState(top10Addresses).isAnyLoading;

      if (!isTop10BalanceLoading) {
        runOnUI(setPulldownRefreshStage)({
          state: isTop10BalanceLoading ? 'refreshing' : 'finished',
          indicatorSpaceHeight: pulldownRefreshSizes.homeHeaderHeight,
          svIsRefreshing,
          pullDistance,
          svIsManualRefreshing,
        });
      }
    });

    return () => {
      remove();
    };
  }, [svIsRefreshing, pullDistance, svIsManualRefreshing]);

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
    onAnimatedScrollBeginDrag: useCallback<
      ScrollHandlerProps['onAnimatedScrollBeginDrag'] & object
    >(() => {
      // // leave here for debug on some android devices
      // console.debug(
      //   '[onScrollHandlers] onAnimatedScrollBeginDrag:: event.nativeEvent',
      //   event.nativeEvent,
      // );
    }, []),
    onScroll: useCallback<ScrollHandlerProps['onScroll'] & object>(event => {
      // console.debug(
      //   '[onScrollHandlers] onScroll:: event.nativeEvent',
      //   event.nativeEvent,
      // );
    }, []),
    onAnimatedScrollEndDrag: useCallback<
      ScrollHandlerProps['onAnimatedScrollEndDrag'] & object
    >(event => {
      // console.debug(
      //   '[onScrollHandlers] onAnimatedScrollEndDrag:: event.nativeEvent',
      //   event.nativeEvent,
      // );
    }, []),
  };

  const startValues = useSharedValue({
    startedAtTop: scrollY.value <= 5,
    restScrollOffset: 0,
    hasImpactOnPandown: false,
    hasImpactOnPanup: false,
  });

  const panGestureRef = useRef(
    Gesture.Pan()
      .shouldCancelWhenOutside(false)
      .activeOffsetY([-homeGestureConfs.activeY, homeGestureConfs.activeY])
      .maxPointers(1)
      .onStart(() => {
        startValues.value.restScrollOffset = getIsAtBottom(
          scrollY.value,
        ).restScrollOffset;
        startValues.value.startedAtTop = scrollY.value <= 5;
      })
      .onUpdate(event => {
        panUp: {
          const { isAtBottom } = getIsAtBottom(scrollY.value, translateY.value);
          const restScrollOffset = startValues.value.restScrollOffset;

          translateY.value = event.translationY + restScrollOffset;
          if (isAtBottom) {
            scrollableStatus.value = SCROLLABLE_STATUS.LOCKED;
          } else {
            scrollableStatus.value = SCROLLABLE_STATUS.UNLOCKED;
          }

          if (hasOverThreshold() && event.translationY < 0) {
            if (IS_ANDROID) {
              scrollToEnd(true, true);
            }
            !startValues.value.hasImpactOnPandown && runOnJS(triggerImpact)();
            startValues.value.hasImpactOnPandown = true;
          }
        }

        pullRefresh: {
          if (
            SHOULD_SHOW_CUSTOM_INDICATOR_WHEN_LOADING &&
            startValues.value.startedAtTop &&
            !svIsRefreshing.value
          ) {
            pullDistance.value = Math.max(0, event.translationY);
            if (isOverPulldownRefreshThreshold(pullDistance.value)) {
              !startValues.value.hasImpactOnPanup &&
                runOnJS(triggerImpact)({ __DEV_ONLY__: true });
              startValues.value.hasImpactOnPanup = true;
            }
          }
        }
      })
      .onEnd(() => {
        panUp: {
          const hasImpactOnPandown = startValues.value.hasImpactOnPandown;

          if (hasOverThreshold()) {
            translateY.value = withTiming(-scrHeight, undefined, () => {
              scrollableStatus.value = SCROLLABLE_STATUS.UNLOCKED;
            });
            !hasImpactOnPandown && runOnJS(triggerImpact)();
          } else {
            translateY.value = withTiming(0, undefined, () => {
              scrollableStatus.value = SCROLLABLE_STATUS.UNLOCKED;
            });
          }
          startValues.value.hasImpactOnPandown = false;
        }

        pullRefresh: {
          const hasImpactOnPanup = startValues.value.hasImpactOnPanup;
          if (
            SHOULD_SHOW_CUSTOM_INDICATOR_WHEN_LOADING &&
            startValues.value.startedAtTop &&
            !svIsRefreshing.value
          ) {
            if (isOverPulldownRefreshThreshold(pullDistance.value)) {
              // svIsRefreshing.value = true;
              setPulldownRefreshStage({
                state: 'refreshing',
                indicatorSpaceHeight: pulldownRefreshSizes.homeHeaderHeight,
                svIsRefreshing,
                svIsManualRefreshing,
                pullDistance,
              });
              runOnJS(onJsPulldownRefresh)();
              !hasImpactOnPanup &&
                runOnJS(triggerImpact)({ __DEV_ONLY__: true });
            } else {
              setPulldownRefreshStage({
                state: 'finished',
                indicatorSpaceHeight: pulldownRefreshSizes.homeHeaderHeight,
                svIsRefreshing,
                svIsManualRefreshing,
                pullDistance,
              });
            }
            startValues.value.hasImpactOnPanup = false;
          }
        }
      }),
  );

  const isRefreshing = useValueFromSharedValue(svIsRefreshing);

  return {
    panGestureRef,

    onScrollHandlers,
    uiOnScrollBack,
    scrollableRef,

    isRefreshing,
    pullDistance,
    svIsRefreshing,
    svIsManualRefreshing,
  };
};

const getStyle = createGetStyles2024(
  {
    reanimatedStyles: {},
  },
  ({ colors2024, isLight, safeAreaInsets }) => ({
    main: {
      height: '100%',
      overflow: 'hidden',

      // flex: 1,
      // ...makeDevOnlyStyle({
      //   backgroundColor: colors2024['red-light-2'],
      // }),
    },
    scroll: {
      flex: 1,
      paddingTop: 0,
    },
    scrollContainer: {
      flexGrow: 1,
      minHeight: '100%',
      paddingBottom: getScrollContainerPb(safeAreaInsets.bottom),
      // ...makeDebugBorder('orange'),
    },
    iosAbsIndicatorOffset: {
      paddingTop: 0,
    },
    scrollViewInner: {
      marginTop: !SHOULD_SHOW_CUSTOM_INDICATOR_WHEN_LOADING
        ? HOME_TOP_HEADER_SIZES.tabInnerHomeTopOffset
        : 0,
      // ...makeDebugBorder('orange'),
      // ...makeDevOnlyStyle({
      //   backgroundColor: colors2024['orange-light-2'],
      // }),
    },
    grid: {
      marginTop: 0,
      width: '100%',
      paddingHorizontal: ITEM_LAYOUT_PADDING_HORIZONTAL,
    },
    gridItemsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      borderRadius: 8,
      rowGap: ITEM_GRID_GAP,
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
      // height: 86,
      gap: 8,
      position: 'relative',
      // ...makeDebugBorder(),
    },
    gridText: {
      color: colors2024['neutral-title-1'],
      fontWeight: '500',
      fontSize: 16,
      lineHeight: 20,
      textAlign: 'left',
      fontFamily: 'SF Pro Rounded',
    },
    titleWithNewTagRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    newTagWrapper: {
      marginLeft: 4,
    },
    badgeWrapper: {
      display: 'flex',
      flexDirection: 'row',
      width: '100%',
      justifyContent: 'space-between',
      alignItems: 'center',
      // ...makeDebugBorder('purple'),
    },
    iconWrapper: {
      height: 28,
      width: 28,
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
      marginTop: 36,
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
  const { styles, reanimatedStyles, colors2024 } = useTheme2024({
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
      if (!couldDoRefresh()) {
        return;
      }
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
        // __DEV__ && {
        //   title: MultiHomeFeatTitle.TEST_DAPP,
        //   icon: RcIconDapps,
        // },

        {
          key: MultiHomeFeatTitle.Market,
          title: t('page.home.services.market'),
          icon: RcIconMarketCC,
        },
        {
          key: MultiHomeFeatTitle.GasAccount,
          title: t('page.home.services.gasDeposit'),
          icon: RcIconGasAccountCC,
          showGiftIcon: isEligible,
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

  const { triggerUpdate } = addressBalanceStore.useAccountsBalanceTrigger();
  const isFirstTriggerRef = useRef(true);

  useEffect(() => {
    setTimeout(() => {
      deleteLongTimeCurveCache();
      deleteLongTime24hBalanceCache();
    }, 0);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!couldDoRefresh()) {
        return;
      }
      refreshSuccessAndFailList();
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      if (!couldDoRefresh()) {
        return;
      }
      resetFetchHistoryTxCount();
    }, []),
  );

  const displayAddresses = useHomePortfolioStore(
    state => state.displayAddresses,
  );
  const { myTop10Addresses } = useAccountInfo();
  const myTop10AddressesRef = useRef(myTop10Addresses);

  useEffect(() => {
    myTop10AddressesRef.current = myTop10Addresses;
  }, [myTop10Addresses]);

  useFocusEffect(
    useCallback(() => {
      if (!couldDoRefresh()) {
        return;
      }
      const forceFirstTime = isFirstTriggerRef.current;
      if (isFirstTriggerRef.current) {
        isFirstTriggerRef.current = false;
      }
      triggerUpdate(forceFirstTime || undefined).then(balanceAccounts => {
        // console.debug('[perf] MultiAddressHome triggerUpdate refreshed:: balanceAccounts', balanceAccounts);
        scene24hBalanceStore.refresh24hAssets({
          balanceAccounts,
          reason: 'manual_refresh',
        });
        refreshDayCurve({ balanceAccounts, reason: 'manual_refresh' });
      });
      triggerUpdateAlert();
      // // leave here to measure perf impact
      // isNonPublicProductionEnv && apisLending.fetchLendingData({ persistOnly: true });
      syncTop10History(myTop10AddressesRef.current, false);
    }, [triggerUpdate, triggerUpdateAlert]),
  );

  const onRefresh = useCallback(async () => {
    if (!couldDoRefresh()) {
      return;
    }

    refreshETHStatus();
    perfEvents.emit('HOME_WILL_BE_REFRESHED_MANUALLY');
    return Promise.all([
      // force update balance from server api
      triggerUpdate(true).then(balanceAccounts => {
        scene24hBalanceStore.refresh24hAssets({
          force: true,
          balanceAccounts,
          reason: 'manual_refresh',
        });
        refreshDayCurve({
          force: true,
          balanceAccounts,
          reason: 'manual_refresh',
        });
      }),
      checkAddressesEligibility(true),
    ]).finally(() => {
      // update at background
      forceUpdate();
      apisLending.fetchLendingData();
      const forceRefresh = true;
      syncTop10History(myTop10Addresses, forceRefresh);
      currencyService.syncCurrencyList(forceRefresh);

      // refresh token/protocol list
      useTokenList.getState().batchGetTokenList(displayAddresses, forceRefresh);
      useProtocol.getState().batchGetProtocols(displayAddresses, forceRefresh);
    });
  }, [
    checkAddressesEligibility,
    displayAddresses,
    forceUpdate,
    myTop10Addresses,
    triggerUpdate,
  ]);

  // const { toggleUseAllAccountsOnScene } = useSwitchSceneCurrentAccount();
  const handlePressMarket = useCallback(() => {
    refreshETHStatus();
    navigation.navigateDeprecated(RootNames.StackHomeNonTab, {
      screen: RootNames.Market,
      params: {},
    });
  }, [navigation]);

  const handleClickMenu = useCallback(
    (key: MultiHomeFeatTitle) => {
      if (!apisHomeTabIndex.isHomeAtFirstTab()) {
        return;
      }
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
        case MultiHomeFeatTitle.Market: {
          handlePressMarket();
          break;
        }
        case MultiHomeFeatTitle.Ecosystem:
          break;
        case MultiHomeFeatTitle.Perps:
          apisPerps.setHasShownPerpsGuidePopup(true);
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
    [handlePressMarket, navigation],
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
      if (el.key === MultiHomeFeatTitle.Market) {
        return <ETHStatus />;
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
    onScrollHandlers,
    uiOnScrollBack,
    scrollableRef,
    panGestureRef,

    isRefreshing,
    pullDistance,
    svIsRefreshing,
    svIsManualRefreshing,
  } = usePulldownRefreshGesture<RNGHScrollView>({
    onJsPulldownRefresh: async ctx => {
      ctx.svIsManualRefreshing.value = true;
      await Promise.race([onRefresh(), sleep(3000)]);
    },
  });

  const pulldownRefreshReturns = usePulldownRefreshStyles({
    indicatorSpaceHeight: pulldownRefreshSizes.homeHeaderHeight,
    pullDistanceMaxValue: HOME_TOP_HEADER_SIZES.tabInnerHomeTopOffset,
    states: { pullDistance, svIsRefreshing, svIsManualRefreshing },
  });

  const mainStyle = useAnimatedStyle(() => {
    return {
      // overflow: 'hidden',
      transform: [
        {
          // translateY: Math.min(HOME_TOP_HEADER_SIZES.scrollableListTopOffset * 2, translateY.value),
          translateY: Math.min(0, translateY.value),
        },
      ],
    };
  });

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
            bounces={false}
            overScrollMode={'never'}
            scrollEventThrottle={16}
            onContentSizeChange={tabsScrollHandlers.onContentSizeChange}
            onLayout={tabsScrollHandlers.onLayout}
            onAnimatedScrollBeginDrag={
              onScrollHandlers.onAnimatedScrollBeginDrag
            }
            onAnimatedScrollEndDrag={onScrollHandlers.onAnimatedScrollEndDrag}
            onScroll={onScrollHandlers.onScroll}
            // scrollableEnabled={scrollableEnabled}
            simultaneousHandlers={[panGestureRef]}
            {...(!SHOULD_SHOW_CUSTOM_INDICATOR_WHEN_LOADING && {
              refreshControl: (
                <RNGHRefreshControl
                  style={{ paddingHorizontal: 16 }}
                  refreshing={isRefreshing}
                  onRefresh={onRefresh}
                />
              ),
            })}>
            <RefreshPlaceholderIOS
              hooksReturn={pulldownRefreshReturns}
              animatedStyle={pulldownRefreshReturns.refreshPlaceholderStyle}
              animatedIndicatorStyle={styles.iosAbsIndicatorOffset}
              __PICK_MANUAL__
            />
            <Animated.View style={[styles.scrollViewInner]}>
              <MultiAddressHomeHeader onRefresh={onRefresh} />

              <HomeCenterArea />
              <View style={styles.grid}>
                <View style={styles.gridItemsWrap}>
                  {MENU_ARR.map((el, index) => {
                    return (
                      <HomeMenuItem
                        key={index}
                        el={el}
                        itemWidth={itemWidth}
                        onPress={handleClickMenu}
                        renderBadge={generateCustomBadgeIcon}
                      />
                    );
                  })}
                </View>
                <BrowserOrPerpsPosition />
                <View
                  style={styles.swipeUpHint}
                  onLayout={swipeUpViewHandlers.onLayout}>
                  <RcIconDoubleArrowCC
                    color={colors2024['neutral-secondary']}
                  />
                  <Text style={styles.swipeUpHintText}>
                    {t('page.home.swipeUp.desc')}
                  </Text>
                </View>
              </View>
            </Animated.View>
          </TabsScrollView>
        </GestureDetector>
      </Animated.View>
      <HomeDappDrawer onScrollBack={uiOnScrollBack} />
    </View>
  );
});

type HomeMenuItemProps = {
  el: {
    key: MultiHomeFeatTitle;
    title: string;
    icon: React.FC<import('react-native-svg').SvgProps>;
    color?: string;
    badge?: number;
    isSuccess?: boolean;
    showGiftIcon?: boolean;
  };
  itemWidth: number;
  onPress: (key: MultiHomeFeatTitle) => void;
  renderBadge: (el: HomeMenuItemProps['el']) => React.ReactNode;
};

const HomeMenuItem: React.FC<HomeMenuItemProps> = ({
  el,
  itemWidth,
  onPress,
  renderBadge,
}) => {
  const { styles, colors2024 } = useTheme2024({
    getStyle,
  });
  const { shouldShowNewTag, markVisited } = useHomeFeatureNewTag(el.key);

  const handlePress = useCallback(() => {
    console.debug('[perf] touched menu', el.key);
    requestAnimationFrame(() => {
      markVisited();
      onPress(el.key);
    });
    matomoRequestEvent({
      category: 'Click_Services',
      action: `Click_${el.key}`,
    });
  }, [el.key, markVisited, onPress]);

  return (
    <FastTouchable
      style={StyleSheet.flatten([styles.gridItem, { width: itemWidth }])}
      onPress={handlePress}>
      <View style={styles.badgeWrapper}>
        <View style={styles.iconWrapper}>
          <el.icon
            width={28}
            height={28}
            color={el.color || colors2024['brand-default-icon']}
          />
        </View>
        <View style={styles.rightBadgeWrapper}>{renderBadge(el)}</View>
      </View>
      <View style={styles.titleWithNewTagRow}>
        <Text style={styles.gridText} numberOfLines={1} ellipsizeMode="tail">
          {el.title}
        </Text>
        {shouldShowNewTag ? (
          <View style={styles.newTagWrapper}>
            <NewTag />
          </View>
        ) : null}
      </View>
    </FastTouchable>
  );
};
