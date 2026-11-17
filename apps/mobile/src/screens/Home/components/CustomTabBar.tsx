import {
  Dimensions,
  PixelRatio,
  useWindowDimensions,
  View,
  Pressable,
  ViewStyle,
} from 'react-native';
import { MaterialTabBar } from 'react-native-collapsible-tab-view';

import React, { useCallback, useRef } from 'react';
import Animated, {
  clamp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolate,
  AnimatedStyle,
  Extrapolation,
} from 'react-native-reanimated';
import { createGetStyles2024 } from '@/utils/styles';
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

  // Shuttle, not a bar crossing the gap: each slot clips its own plate. The
  // left plate slides out to the right while the right plate slides in from the
  // left, so the black fill is only ever visible inside a slot - the 12pt gap
  // between them never shows the indicator travelling across it.
  const slotWidth = itemsLayout[0]?.width ?? 0;
  const snapPixels = (value: number) => {
    'worklet';
    return Math.round(value * STRIP_PIXEL) / STRIP_PIXEL;
  };
  const leftPlateStyle = useAnimatedStyle(() => {
    const p = Math.min(Math.max(indexDecimal.value, 0), 1);
    return {
      transform: [{ translateX: snapPixels(p * slotWidth) }],
      opacity: withTiming(opacity.value),
    };
  }, [indexDecimal, slotWidth]);
  const rightPlateStyle = useAnimatedStyle(() => {
    const p = Math.min(Math.max(indexDecimal.value, 0), 1);
    return {
      transform: [{ translateX: snapPixels((p - 1) * slotWidth) }],
      opacity: withTiming(opacity.value),
    };
  }, [indexDecimal, slotWidth]);

  React.useEffect(() => {
    if (fadeIn) {
      opacity.value = 1;
    }
  }, [fadeIn, opacity]);

  return (
    <Animated.View style={[styles.indicatorContainer, animatedStyle]}>
      <View style={[styles.slotClip, styles.slotClipLeft]}>
        <Animated.View style={[styles.slotPlate, leftPlateStyle]} />
      </View>
      <View style={[styles.slotClip, styles.slotClipRight]}>
        <Animated.View style={[styles.slotPlate, rightPlateStyle]} />
      </View>
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
/**
 * Extra touch area above and below the indicator bars, in pt. The container
 * grows by twice this value and pulls the same amount back with negative
 * margins, so the bars keep their exact visual position while the tappable
 * height grows. Tapping slightly off the bar used to fall through to the pager.
 */
const indicatorHitPaddingY = 8;
// Keep the indicator hit regions below the header's eye/action buttons.
// Expanding 50pt upward overlaps those controls under Fabric hit testing.
// The vertical touch area is owned by `indicatorHitPaddingY` on the container
// now, so the pressables do not add their own slop on top of it.
const leftHitSlopTop = 0;
const leftHitSlopBottom = 0;
const rightHitSlopTop = 0;
const rightHitSlopBottom = 0;

const indicatorStyles = createGetStyles2024(
  {
    reanimatedStyles: {
      leftBackground: ({ colors2024, winLayout }) => {
        'worklet';
        const winWidth = Math.floor(winLayout.value.width);
        const indicatorWidth = getHomeTabIndicatorWidth(winWidth);

        return {
          position: 'absolute',
          top: indicatorMarginTop + indicatorHitPaddingY,
          left: 20,
          width: indicatorWidth,
          height: indicatorHeight,
          borderRadius: 12,
          borderCurve: 'continuous',
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
          top: indicatorMarginTop + indicatorHitPaddingY,
          right: 20,
          width: indicatorWidth,
          height: indicatorHeight,
          borderRadius: 12,
          borderCurve: 'continuous',
          backgroundColor: colors2024['neutral-line'],
          zIndex: 98,
        };
      },
    },
  },
  ({ isLight, colors2024 }) => {
    const winWidth = Dimensions.get('window').width;
    const indicatorWidth = getHomeTabIndicatorWidth(winWidth);
    // The right segment covers the whole right bar: half of it was dead before,
    // so tapping the right half of the grey bar did nothing.
    const rightPressableWidth = indicatorWidth;
    const rightPressableOffset = 0;
    return {
      indicator: {
        height: 6,
        backgroundColor: isLight
          ? 'rgba(0, 0, 0, 1)'
          : colors2024['brand-default'],
        position: 'absolute',
        borderRadius: 12,
        top: indicatorMarginTop + indicatorHitPaddingY,
        zIndex: 99,
        borderCurve: 'continuous',
      },
      slotClip: {
        position: 'absolute',
        top: indicatorMarginTop + indicatorHitPaddingY,
        width: indicatorWidth,
        height: indicatorHeight,
        borderRadius: 12,
        overflow: 'hidden',
        zIndex: 99,
      },
      slotClipLeft: {
        left: 20,
      },
      slotClipRight: {
        right: 20,
      },
      slotPlate: {
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        borderRadius: 12,
        backgroundColor: isLight
          ? 'rgba(0, 0, 0, 1)'
          : colors2024['brand-default'],
      },
      indicatorContainer: {
        position: 'relative',
        paddingTop: indicatorMarginTop,
        height: indicatorMarginTop + indicatorHeight + indicatorHitPaddingY * 2,
        marginTop: -indicatorHitPaddingY,
        marginBottom: -indicatorHitPaddingY,
      },
      indicatorBgBox: {
        backgroundColor: colors2024['neutral-bg-1'],
      },
      leftPressable: {
        position: 'absolute',
        top: indicatorMarginTop,
        left: 20,
        width: indicatorWidth,
        height: indicatorHeight + indicatorHitPaddingY * 2,
        zIndex: 99,
      },
      rightPressable: {
        position: 'absolute',
        right: 20 + rightPressableOffset,
        top: indicatorMarginTop,
        width: rightPressableWidth,
        height: indicatorHeight + indicatorHitPaddingY * 2,
        zIndex: 99,
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

// Snap the strip to whole device pixels: a sub-pixel translate makes the whole
// row shimmer while it rides in.
const STRIP_PIXEL = PixelRatio.get();

function AssetsTabBar() {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const indexDecimal = apisHomeTabIndex.svTabIndexDecimal;
  const { width: winWidth } = useWindowDimensions();

  // The strip belongs to the assets pages: it rides in from the right at the
  // same rate as the pages, so the tab row and the list below look like one
  // sheet instead of the labels fading in over the overview.
  const stylez = useAnimatedStyle(() => {
    const progress = clamp(indexDecimal.value, 0, 1);
    return {
      transform: [
        {
          translateX:
            Math.round((1 - progress) * winWidth * STRIP_PIXEL) / STRIP_PIXEL,
        },
      ],
      // Fallback version: the row still rides in 1:1 with the pager, and the
      // fade hides the fast-fling tail where the event stream trails the page.
      opacity: interpolate(
        progress,
        [0, 0.45, 0.85, 1],
        [0, 0.3, 0.8, 1],
        Extrapolation.CLAMP,
      ),
    };
  }, [winWidth]);

  const tabbarContainerStyle = useAnimatedStyle(() => {
    const progress = clamp(indexDecimal.value, 0, 1);
    return {
      pointerEvents: progress > 0.99 ? 'auto' : 'none',
    };
  });

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

const getStyles = createGetStyles2024(() => ({
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
