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
} from 'react-native-reanimated';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useMeasureLayoutForHomeGuidanceMultipleTabs } from '@/components2024/Animations/HomeGuidanceMultipleTabs';
import { TabName } from '@/screens/Address/components/MultiAssets/TabsMultiAssets';
import { ChainSelector } from '@/screens/Home/components/AssetRenderItems/SectionHeaders';
import {
  getComputedChainInfo,
  getSelectChainItem,
  setSelectChainItem,
  useSelectedChainItem,
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
  secondaryIndicatorViewRef?: React.RefObject<View>;
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
  const { styles } = useTheme2024({ getStyle: indicatorStyles });
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
      <View style={styles.leftBackground} />
      <Pressable
        onPress={onLeftPress}
        style={styles.leftPressable}
        hitSlop={leftHitSlop}
      />
      <View style={styles.rightBackground} />
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
const leftHitSlopTop = 50;
const leftHitSlopBottom = 4;
const rightHitSlopTop = 50;
const rightHitSlopBottom = 4;

const indicatorStyles = createGetStyles2024(({ isLight, colors2024 }) => {
  const winWidth = Dimensions.get('window').width;
  const indicatorWidth = (winWidth - 52) / 2;
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
    leftBackground: {
      position: 'absolute',
      top: indicatorMarginTop,
      left: 20,
      width: indicatorWidth,
      height: 6,
      borderRadius: 12,
      backgroundColor: colors2024['neutral-line'],
      zIndex: 98,
    },
    rightBackground: {
      position: 'absolute',
      right: 20,
      top: indicatorMarginTop,
      width: indicatorWidth,
      height: 6,
      borderRadius: 12,
      backgroundColor: colors2024['neutral-line'],
      zIndex: 98,
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
});

function SideChainSelector() {
  const { isLight, colors2024 } = useTheme2024();

  const chainSelectModalRef = useRef<
    ReturnType<typeof createGlobalBottomSheetModal2024> | undefined
  >();
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

  return (
    <ChainSelector
      // top3Chains={chainAssets.map(item => item.chain).slice(0, 3)}
      top3Chains={top3Chains}
      onChainClick={handleOnChainClick}
      chainServerId={selectedChainItem?.chain}
    />
  );
}

type MaterialTabBarProps = React.ComponentProps<typeof MaterialTabBar>;
const renderTabItem: MaterialTabBarProps['TabItemComponent'] & object = _p => (
  <MaterialTabItem
    {..._p}
    pressOpacity={__DEV__ ? 0.5 : 1}
    inactiveOpacity={1}
  />
);

export const HomeCustomMaterialTabBar = ({
  style,
  ...props
}: Omit<
  MaterialTabBarProps,
  | 'scrollEnabled'
  | 'tabStyle'
  | 'TabItemComponent'
  | 'style'
  | 'indicatorStyle'
  | 'contentContainerStyle'
> &
  RNViewProps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  const indexDecimal = props.indexDecimal;

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
          -HOME_TOP_HEADER_SIZES.tabItemHeight,
          -HOME_TOP_HEADER_SIZES.tabItemHeight / 2,
          0,
        ],
        Extrapolation.CLAMP,
      ),
      // translateX: interpolate(
      //   indexDecimal.value,
      //   [0, 0.5, 1],
      //   [
      //     -(Dimensions.get('screen').width - HOME_TOP_HEADER_SIZES.portfolioContainerPx * 2),
      //     -(Dimensions.get('screen').width - HOME_TOP_HEADER_SIZES.portfolioContainerPx * 2 / 2),
      //     0,
      //   ],
      //   Extrapolation.CLAMP,
      // ),
    };
  });

  const {
    // measureTabBarWrapper,
    // homeGuidanceMultipleTabsTargetViewRef,
    secondaryIndicatorViewRef,
    measureSecondaryIndicator,
  } = useMeasureLayoutForHomeGuidanceMultipleTabs();
  const focusedTab = useFocusedTab();

  const handleMeasureSecondaryIndicator = useCallback(() => {
    measureSecondaryIndicator();
  }, [measureSecondaryIndicator]);
  const handleSwitchTab = useCallback(
    (name: TabName) => {
      if (!props.tabNames.includes(name)) {
        return;
      }
      props.onTabPress(name);
    },
    [props],
  );

  const { opacityStyle } = useHomeDrawerOpacityStyle();
  // const winWidth = Dimensions.get('window').width;
  const { width: winWidth } = useWindowDimensions();

  return (
    <Animated.View
      style={[styles.container, style, opacityStyle]}
      // ref={homeGuidanceMultipleTabsTargetViewRef}
      // onLayout={() => {
      //   measureTabBarWrapper();
      // }}
    >
      <Indicator
        indexDecimal={props.indexDecimal}
        itemsLayout={[
          {
            width: (winWidth - 52) / 2,
            x: 20,
          },
          {
            width: (winWidth - 52) / 2,
            x: 20 + (winWidth - 52) / 2 + 12,
          },
          {
            width: (winWidth - 52) / 2,
            x: 20 + (winWidth - 52) / 2 + 12,
          },
          {
            width: (winWidth - 52) / 2,
            x: 20 + (winWidth - 52) / 2 + 12,
          },
        ]}
        fadeIn
        secondaryIndicatorViewRef={secondaryIndicatorViewRef}
        handleMeasureSecondaryIndicator={handleMeasureSecondaryIndicator}
        onLeftPress={() => {
          handleSwitchTab(TabName.overview);
        }}
        onRightPress={() => {
          handleSwitchTab(TabName.token);
        }}
      />
      <Animated.View
        pointerEvents={focusedTab === TabName.overview ? 'none' : 'auto'}
        style={[styles.portfolioContainer, stylez]}>
        <MaterialTabBar
          {...props}
          scrollEnabled={false}
          tabStyle={styles.innerTabBar}
          TabItemComponent={renderTabItem}
          style={styles.tabBar}
          indicatorStyle={styles.hideInnerIndicator}
          contentContainerStyle={styles.contentContainerStyle}
        />
        <SideChainSelector />
      </Animated.View>
    </Animated.View>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    position: 'relative',
    // ...makeDebugBorder('green'),
    // backgroundColor: colors2024['neutral-bg-1'],
  },
  hideInnerIndicator: {
    height: 0,
  },
  tabBar: {},
  innerTabBar: {
    height: 32,
    width: 'auto',
    flexShrink: 0,
    flex: 0,
    paddingHorizontal: 0,
    // marginRight: 20,
  },
  contentContainerStyle: {
    width: '100%',
    // display: 'flex',
    // justifyContent: 'flex-end',
  },
  portfolioContainer: {
    paddingHorizontal: HOME_TOP_HEADER_SIZES.portfolioContainerPx,
    paddingTop: 2,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: HOME_TOP_HEADER_SIZES.tabItemHeight,
  },
}));
