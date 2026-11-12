import {
  Dimensions,
  useWindowDimensions,
  View,
  Pressable,
  ViewStyle,
} from 'react-native';
import {
  MaterialTabBar,
  MaterialTabItem,
  useFocusedTab,
} from 'react-native-collapsible-tab-view';

import React, { useCallback, useLayoutEffect, useRef } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolate,
  AnimatedStyle,
  Extrapolation,
  isWorkletFunction,
} from 'react-native-reanimated';
import {
  createGetStyles2024,
  makeDebugBorder,
  makeDevOnlyStyle,
} from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useMeasureLayoutForHomeGuidanceMultipleTabs } from '@/components2024/Animations/HomeGuidanceMultipleTabs';
import {
  CHAIN_SELECTOR_SLOT_WIDTH,
  ChainSelector,
} from '@/screens/Home/components/AssetRenderItems/SectionHeaders';
import { addressBalanceStore, balanceAccountsStore } from '@/store/balance';
import tokenStore from '@/store/tokens';
import { hasConfirmedAssetProjectionSources } from '@/store/assetProjectionAvailability';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import {
  getComputedChainInfo,
  getSelectChainItem,
  setSelectChainItem,
  useChainStatsLoading,
  useSelectedChainItem,
  useChainLength,
  useChainProjectionReady,
  useTop3Chains,
} from '../useChainInfo';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { ChainListItem } from '@/components2024/SelectChainWithDistribute';
import { useTranslation } from 'react-i18next';
import { useHomeDrawerOpacityStyle } from '../hooks/useHomeDrawerAnimate';
import { HOME_TOP_HEADER_SIZES } from '@/constant/home';
import { useValueFromSharedValue } from '@/hooks/reanimated';
import {
  apisHomeTabIndex,
  HomeTabName,
  TabbarLabels,
} from '@/hooks/navigation';
import CustomLabel from './Tabs/CustomLabel';
import { getHomeTabIndicatorWidth } from '../utils/homeTabIndicator';

type ItemLayout = {
  width: number;
  x: number;
};
type IndicatorProps = {
  indexDecimal: Animated.SharedValue<number>;
  itemsLayout: ItemLayout[];
  style?: AnimatedStyle;
  fadeIn?: boolean;
  animatedStyle?: AnimatedStyle<ViewStyle>;
  secondaryIndicatorViewRef?: React.RefObject<View | null>;
  onLeftPress?: () => void;
  onRightPress?: () => void;
  // handleMeasureSecondaryIndicator?: ViewProps['onLayout'];
  handleMeasureSecondaryIndicator?: () => void;
};

const Indicator = ({
  indexDecimal,
  itemsLayout,
  style,
  fadeIn = false,
  animatedStyle,
  secondaryIndicatorViewRef,
  onLeftPress,
  onRightPress,
  handleMeasureSecondaryIndicator,
}: IndicatorProps) => {
  const { styles, reanimatedStyles } = useTheme2024({
    getStyle: indicatorStyles,
  });
  const rStyles = {
    leftBackground: useAnimatedStyle(reanimatedStyles.leftBackground),
    rightBackground: useAnimatedStyle(reanimatedStyles.rightBackground),
  };
  const opacity = useSharedValue(fadeIn ? 0 : 1);
  const leftHitSlop = {
    top: leftHitSlopTop,
    bottom: leftHitSlopBottom,
    left: 0,
    right: 0,
  };
  const rightHitSlop = {
    top: rightHitSlopTop,
    bottom: rightHitSlopBottom,
    left: 0,
    right: 0,
  };

  const stylez = useAnimatedStyle(() => {
    const firstItemX = itemsLayout[0]?.x ?? 0;

    const transform = [
      {
        translateX:
          itemsLayout.length > 1
            ? interpolate(
                indexDecimal.value,
                itemsLayout.map((_, i) => i),
                itemsLayout.map(v => v.x),
              )
            : firstItemX,
      },
    ];

    const width =
      itemsLayout.length > 1
        ? interpolate(
            indexDecimal.value,
            itemsLayout.map((_, i) => i),
            itemsLayout.map(v => v.width),
          )
        : itemsLayout[0]?.width;

    return {
      transform,
      width,
      opacity: withTiming(opacity.value),
    };
  }, [indexDecimal, itemsLayout]);

  React.useEffect(() => {
    if (fadeIn) {
      opacity.value = 1;
    }
  }, [fadeIn, opacity]);

  return (
    <Animated.View style={[styles.indicatorContainer, animatedStyle]}>
      <Animated.View style={[stylez, styles.indicator, style]} />
      <Animated.View
        style={[rStyles.leftBackground /* , styles.leftBackground */]}
      />
      <Pressable
        onPress={onLeftPress}
        style={styles.leftPressable}
        hitSlop={leftHitSlop}
      />
      <Animated.View
        style={[rStyles.rightBackground /* , styles.rightBackground */]}
      />
      <Pressable
        ref={secondaryIndicatorViewRef}
        style={styles.rightPressable}
        onPress={onRightPress}
        hitSlop={rightHitSlop}
        onLayout={() => {
          handleMeasureSecondaryIndicator?.();
        }}
      />
    </Animated.View>
  );
};

const indicatorMarginTop = 0;
const indicatorHeight = HOME_TOP_HEADER_SIZES.headerIndicatorHeight;
// Keep the indicator hit regions below the header's eye/action buttons.
// Expanding 50pt upward overlaps those controls under Fabric hit testing.
const leftHitSlopTop = 4;
const leftHitSlopBottom = 4;
const rightHitSlopTop = 4;
const rightHitSlopBottom = 4;

const indicatorStyles = createGetStyles2024(
  {
    reanimatedStyles: {
      leftBackground: ({ colors2024, winLayout }) => {
        'worklet';
        const winWidth = Math.floor(winLayout.value.width);
        const indicatorWidth = getHomeTabIndicatorWidth(winWidth);

        return {
          position: 'absolute',
          top: indicatorMarginTop,
          left: 20,
          width: indicatorWidth,
          height: indicatorHeight,
          borderRadius: 12,
          backgroundColor: colors2024['neutral-line'],
          zIndex: 98,
        };
      },
      rightBackground: ({ colors2024, winLayout }) => {
        'worklet';
        const winWidth = Math.floor(winLayout.value.width);
        const indicatorWidth = getHomeTabIndicatorWidth(winWidth);

        return {
          position: 'absolute',
          top: indicatorMarginTop,
          right: 20,
          width: indicatorWidth,
          height: indicatorHeight,
          borderRadius: 12,
          backgroundColor: colors2024['neutral-line'],
          zIndex: 98,
        };
      },
    },
  },
  ({ isLight, colors2024 }) => {
    const winWidth = Dimensions.get('window').width;
    const indicatorWidth = getHomeTabIndicatorWidth(winWidth);
    const rightPressableWidth = indicatorWidth * 0.5;
    const rightPressableOffset = indicatorWidth - rightPressableWidth;
    return {
      indicator: {
        height: 6,
        backgroundColor: isLight
          ? 'rgba(0, 0, 0, 1)'
          : colors2024['brand-default'],
        position: 'absolute',
        borderRadius: 12,
        top: indicatorMarginTop,
        zIndex: 99,
      },
      indicatorContainer: {
        position: 'relative',
        paddingTop: indicatorMarginTop,
        height: indicatorMarginTop + indicatorHeight,
      },
      indicatorBgBox: {
        backgroundColor: colors2024['neutral-bg-1'],
      },
      leftPressable: {
        position: 'absolute',
        top: indicatorMarginTop,
        left: 20,
        width: indicatorWidth,
        height: indicatorHeight,
        zIndex: 99,
      },
      rightPressable: {
        position: 'absolute',
        right: 20 + rightPressableOffset,
        top: indicatorMarginTop,
        width: rightPressableWidth,
        height: indicatorHeight,
        zIndex: 99,
      },
      leftHitAreaDebug: {
        position: 'absolute',
        top: indicatorMarginTop - leftHitSlopTop,
        left: 20,
        width: indicatorWidth,
        height: indicatorHeight + leftHitSlopTop + leftHitSlopBottom,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 0, 0, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255, 0, 0, 0.4)',
        zIndex: 97,
      },
      rightHitAreaDebug: {
        position: 'absolute',
        top: indicatorMarginTop - rightHitSlopTop,
        right: 20 + rightPressableOffset,
        width: rightPressableWidth,
        height: indicatorHeight + rightHitSlopTop + rightHitSlopBottom,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 0, 0, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255, 0, 0, 0.4)',
        zIndex: 97,
      },
    };
  },
);
function SideChainSelector() {
  const { styles, isLight, colors2024 } = useTheme2024({ getStyle: getStyles });
  // Cold start: show the selector's loading state until the aggregate balance
  // load settles, instead of an empty pill that only fills in seconds later
  // (QA 1157).
  const { loadBalanceFromApiStage } =
    addressBalanceStore.useLoadBalanceFromApiStage();
  const chainStatsLoading = useChainStatsLoading();

  const chainSelectModalRef = useRef<
    ReturnType<typeof createGlobalBottomSheetModal2024> | undefined
  >(undefined);
  const { t } = useTranslation();
  const selectedChainItem = useSelectedChainItem();
  const handleOnChainClick = useCallback(
    (clear: boolean) => {
      if (clear) {
        setSelectChainItem(undefined);
        return;
      }

      if (chainSelectModalRef.current) {
        removeGlobalBottomSheetModal2024(chainSelectModalRef.current);
        chainSelectModalRef.current = undefined;
      }
      chainSelectModalRef.current = createGlobalBottomSheetModal2024({
        name: MODAL_NAMES.SELECT_CHAIN_WITH_DISTRIBUTE,
        value: getSelectChainItem(),
        bottomSheetModalProps: {
          enableContentPanningGesture: true,
          enablePanDownToClose: true,
          rootViewType: 'View',
          handleStyle: {
            backgroundColor: isLight
              ? colors2024['neutral-bg-0']
              : colors2024['neutral-bg-1'],
          },
        },
        chainList: getComputedChainInfo().chainAssets,
        titleText: t('page.receiveAddressList.selectChainTitle'),
        onChange: (v: ChainListItem) => {
          setSelectChainItem(v);
          if (chainSelectModalRef.current) {
            removeGlobalBottomSheetModal2024(chainSelectModalRef.current);
            chainSelectModalRef.current = undefined;
          }
        },
        onClose: () => {
          if (chainSelectModalRef.current) {
            removeGlobalBottomSheetModal2024(chainSelectModalRef.current);
            chainSelectModalRef.current = undefined;
          }
        },
      });
    },
    [colors2024, isLight, t],
  );

  const top3Chains = useTop3Chains();
  const chainLength = useChainLength();
  const projectionReady = useChainProjectionReady();
  // Identical loading state for every address; only the settled outcome differs
  // (chains -> keep the filter, none -> hide the pill, keep the slot).
  const hasResolvedSelection = balanceAccountsStore(
    state => state.hasResolvedSelection,
  );
  const isAnyBalanceLoading = balanceAccountsStore(
    state => state.isAnyBalanceLoadingWithoutValue,
  );
  const selectedAddresses = balanceAccountsStore(
    state => state.selectedAddresses,
  );
  const sourceSnapshotReady = useActivityStore(
    tokenStore,
    state => state.sourceSnapshotReadyByAddress,
    Object.is,
    { storeLabel: 'token-source-snapshot-ready' },
  );
  // True until every selected address's token source snapshot is confirmed.
  // The aggregate page does not populate `isLoadingByAddress`, so that flag can
  // never close this window.
  const tokensLoading = !hasConfirmedAssetProjectionSources(
    selectedAddresses,
    sourceSnapshotReady,
  );
  const loading =
    !projectionReady ||
    !hasResolvedSelection ||
    isAnyBalanceLoading ||
    tokensLoading ||
    loadBalanceFromApiStage === 'loading' ||
    chainStatsLoading;

  // Render the filter while the projection is pending (QA 1145), but once it
  // settles with no chain assets there is nothing to filter: hide the pill
  // (QA 1197). The slot itself must stay in the row, otherwise the three tabs
  // expand into the space the filter occupied.
  //
  // Hysteresis: a fast start can momentarily look "settled at 0" between two
  // projection updates. Holding the visible state for a short grace period and
  // cross-fading absorbs that blip instead of flashing hidden -> visible.
  const shouldHide = !loading && chainLength === 0;
  const [hidden, setHidden] = React.useState(shouldHide);
  const opacity = useSharedValue(shouldHide ? 0 : 1);

  React.useEffect(() => {
    if (!shouldHide) {
      setHidden(false);
      return undefined;
    }
    const timer = setTimeout(() => setHidden(true), 300);
    return () => clearTimeout(timer);
  }, [shouldHide]);

  React.useEffect(() => {
    opacity.value = withTiming(hidden ? 0 : 1, { duration: 180 });
  }, [hidden, opacity]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      pointerEvents={hidden ? 'none' : 'auto'}
      style={[fadeStyle, styles.chainSelectorSlot]}>
      <ChainSelector
        top3Chains={top3Chains}
        onChainClick={handleOnChainClick}
        chainServerId={selectedChainItem?.chain}
        loading={loading}
      />
    </Animated.View>
  );
}

type MaterialTabBarProps = React.ComponentProps<typeof MaterialTabBar>;

const AssetsTabLabels = [
  TabbarLabels[HomeTabName.token],
  TabbarLabels[HomeTabName.defi],
  TabbarLabels[HomeTabName.nft],
];

function AssetsTabBar() {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const indexDecimal = apisHomeTabIndex.svTabIndexDecimal;

  const stylez = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        indexDecimal.value,
        [0, 0.9, 0.99, 1],
        [0, 0.1, 0.5, 1],
        Extrapolation.CLAMP,
      ),
      translateY: interpolate(
        indexDecimal.value,
        [0, 0.5, 1],
        [
          -HOME_TOP_HEADER_SIZES.tabItemLineHeight,
          -HOME_TOP_HEADER_SIZES.tabItemLineHeight / 2,
          0,
        ],
        Extrapolation.CLAMP,
      ),
    };
  });

  const tabbarContainerStyle = useAnimatedStyle(() => {
    return {
      pointerEvents: indexDecimal.value < 1 ? 'none' : 'auto',
    };
  });

  const focusedTab = useValueFromSharedValue(apisHomeTabIndex.svTabName);

  return (
    <Animated.View
      // pointerEvents={focusedTab === HomeTabName.overview ? 'none' : 'auto'}
      style={[styles.portfolioContainer, stylez, tabbarContainerStyle]}>
      {/* <CustomLabel.Slider indexDecimal={indexDecimal} /> */}
      {AssetsTabLabels.map(({ index, label }) => {
        const key = `tab-label-${index}`;
        return (
          <Pressable
            key={key}
            style={styles.assetTabItem}
            onPress={() => {
              apisHomeTabIndex.setTabIndex(index, true);
            }}>
            <CustomLabel
              index={index}
              indexDecimal={indexDecimal}
              text={label}
            />
          </Pressable>
        );
      })}
      <SideChainSelector />
    </Animated.View>
  );
}

export const HomeCustomMaterialTabBar = ({}: Partial<
  Pick<MaterialTabBarProps, 'indexDecimal'>
>) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const indexDecimal = apisHomeTabIndex.svTabIndexDecimal;
  const { tabsOpacity } = useHomeDrawerOpacityStyle();

  // Keep the native sibling order stable while PagerView is settling. Changing
  // zIndex here can detach/reinsert the pager under Fabric and stop its scroll.
  // The transparent overlay must not consume touches outside its children.
  const containerStyle = useAnimatedStyle(() => {
    return {
      opacity: tabsOpacity.value,
      pointerEvents: tabsOpacity.value < 0.1 ? 'none' : 'box-none',
    };
  });

  const {
    // measureTabBarWrapper,
    // homeGuidanceMultipleTabsTargetViewRef,
    secondaryIndicatorViewRef,
    measureSecondaryIndicator,
  } = useMeasureLayoutForHomeGuidanceMultipleTabs();
  // const focusedTab = useFocusedTab();

  const handleMeasureSecondaryIndicator = useCallback(() => {
    measureSecondaryIndicator();
  }, [measureSecondaryIndicator]);

  // const winWidth = Dimensions.get('window').width;
  const { width: winWidth } = useWindowDimensions();

  return (
    <Animated.View
      style={[styles.container, containerStyle]}
      // ref={homeGuidanceMultipleTabsTargetViewRef}
      // onLayout={() => {
      //   measureTabBarWrapper();
      // }}
    >
      <Indicator
        indexDecimal={indexDecimal}
        itemsLayout={[
          {
            width: getHomeTabIndicatorWidth(winWidth),
            x: 20,
          },
          {
            width: getHomeTabIndicatorWidth(winWidth),
            x: 20 + getHomeTabIndicatorWidth(winWidth) + 12,
          },
          {
            width: getHomeTabIndicatorWidth(winWidth),
            x: 20 + getHomeTabIndicatorWidth(winWidth) + 12,
          },
          {
            width: getHomeTabIndicatorWidth(winWidth),
            x: 20 + getHomeTabIndicatorWidth(winWidth) + 12,
          },
        ]}
        fadeIn
        secondaryIndicatorViewRef={secondaryIndicatorViewRef}
        handleMeasureSecondaryIndicator={handleMeasureSecondaryIndicator}
        onLeftPress={() => {
          apisHomeTabIndex.setTabIndex(0, true);
        }}
        onRightPress={() => {
          if (indexDecimal.value < 1) {
            apisHomeTabIndex.setTabIndex(1, true);
          }
        }}
      />
      <AssetsTabBar />
    </Animated.View>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    position: 'absolute',
    top: HOME_TOP_HEADER_SIZES.headerHeight,
    left: 0,
    right: 0,
    paddingHorizontal: 0,
    maxHeight: HOME_TOP_HEADER_SIZES.tabItemLineHeight,
    zIndex: 10,
    // ...makeDevOnlyStyle({
    //   backgroundColor: colors2024['neutral-foot'],
    // }),
    // ...makeDebugBorder('green'),
  },
  hideInnerIndicator: {
    height: 0,
  },
  // Keep the slot (so the tabs do not grow) while hiding the empty filter.
  chainSelectorHidden: {
    opacity: 0,
  },
  chainSelectorSlot: {
    width: CHAIN_SELECTOR_SLOT_WIDTH,
    flexShrink: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  tabBar: {},
  contentContainerStyle: {
    width: '100%',
    // display: 'flex',
    // justifyContent: 'flex-end',
  },
  portfolioContainer: {
    position: 'relative',
    paddingHorizontal: HOME_TOP_HEADER_SIZES.portfolioContainerPx,
    paddingTop: HOME_TOP_HEADER_SIZES.headerOffsetAfterIndicator,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // ...makeDevOnlyStyle({
    //   backgroundColor: colors2024['red-light-1'],
    // }),
    // height: HOME_TOP_HEADER_SIZES.tabItemLineHeight,
  },
  assetTabItem: {
    paddingBottom: HOME_TOP_HEADER_SIZES.headerTabItemPaddingBottom,
  },
}));
