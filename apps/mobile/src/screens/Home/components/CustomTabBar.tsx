import { Dimensions, View } from 'react-native';
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
} from 'react-native-reanimated';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import {
  HOME_TABBAR_SIZES,
  useMeasureLayoutForHomeGuidanceMultipleTabs,
} from '@/components2024/Animations/HomeGuidanceMultipleTabs';
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

const screenWidth = Dimensions.get('window').width;

type ItemLayout = {
  width: number;
  x: number;
};
type IndicatorProps = {
  indexDecimal: Animated.SharedValue<number>;
  itemsLayout: ItemLayout[];
  style?: AnimatedStyle;
  fadeIn?: boolean;
  secondaryIndicatorViewRef?: React.RefObject<View>;
  // handleMeasureSecondaryIndicator?: ViewProps['onLayout'];
  handleMeasureSecondaryIndicator?: () => void;
};

const Indicator = ({
  indexDecimal,
  itemsLayout,
  style,
  fadeIn = false,
  secondaryIndicatorViewRef,
  handleMeasureSecondaryIndicator,
}: IndicatorProps) => {
  const { styles } = useTheme2024({ getStyle: indicatorStyles });
  const opacity = useSharedValue(fadeIn ? 0 : 1);

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
    <View style={[styles.indicatorContainer]}>
      <Animated.View style={[stylez, styles.indicator, style]} />
      <View style={styles.leftBackground} />
      <View
        ref={secondaryIndicatorViewRef}
        style={styles.rightBackground}
        onLayout={() => {
          handleMeasureSecondaryIndicator?.();
        }}
      />
    </View>
  );
};

const indicatorMarginTop = 14;
const indicatorHeight = 6;
const indicatorStyles = createGetStyles2024(({ isLight, colors2024 }) => ({
  indicator: {
    height: 6,
    backgroundColor: isLight ? 'rgba(0, 0, 0, 1)' : colors2024['brand-default'],
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
    width: (screenWidth - 52) / 2,
    height: 6,
    borderRadius: 12,
    backgroundColor: colors2024['neutral-line'],
    zIndex: 98,
  },
  rightBackground: {
    position: 'absolute',
    right: 20,
    top: indicatorMarginTop,
    width: (screenWidth - 52) / 2,
    height: 6,
    borderRadius: 12,
    backgroundColor: colors2024['neutral-line'],
    zIndex: 98,
  },
}));

function SideChainSelector() {
  const { styles, isLight, colors2024 } = useTheme2024({
    getStyle: getSideChainSelectorStyles,
  });

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

const getSideChainSelectorStyles = createGetStyles2024(() => ({
  container: {
    flex: 1,
    marginTop: 64,
  },
  headerContainer: {
    backgroundColor: 'transparent',
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
}));

type MaterialTabBarProps = React.ComponentProps<typeof MaterialTabBar>;
const renderTabItem: MaterialTabBarProps['TabItemComponent'] & object = _p => (
  <MaterialTabItem
    {..._p}
    pressOpacity={__DEV__ ? 0.5 : 1}
    inactiveOpacity={1}
  />
);

export const HomeCustomMaterialTabBar = (
  props: Omit<
    MaterialTabBarProps,
    | 'scrollEnabled'
    | 'tabStyle'
    | 'TabItemComponent'
    | 'style'
    | 'indicatorStyle'
    | 'contentContainerStyle'
  >,
) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  const indexDecimal = props.indexDecimal;

  const stylez = useAnimatedStyle(() => {
    return {
      opacity: indexDecimal.value <= 0.5 ? 0 : 1,
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

  return (
    <View
      style={styles.container}
      // ref={homeGuidanceMultipleTabsTargetViewRef}
      // onLayout={() => {
      //   measureTabBarWrapper();
      // }}
    >
      <Indicator
        indexDecimal={props.indexDecimal}
        itemsLayout={[
          {
            width: (screenWidth - 52) / 2,
            x: 20,
          },
          {
            width: (screenWidth - 52) / 2,
            x: 20 + (screenWidth - 52) / 2 + 12,
          },
          {
            width: (screenWidth - 52) / 2,
            x: 20 + (screenWidth - 52) / 2 + 12,
          },
          {
            width: (screenWidth - 52) / 2,
            x: 20 + (screenWidth - 52) / 2 + 12,
          },
        ]}
        fadeIn
        secondaryIndicatorViewRef={secondaryIndicatorViewRef}
        handleMeasureSecondaryIndicator={handleMeasureSecondaryIndicator}
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
        {/* {_props.externalContent} */}
      </Animated.View>
    </View>
  );
};

export const TABITEM_H = 54;
const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    position: 'relative',
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
    paddingHorizontal: HOME_TABBAR_SIZES.portfolioContainerPx,
    paddingTop: 2,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: TABITEM_H,
  },
  portfolioContainerBgBox: {
    backgroundColor: colors2024['neutral-bg-1'],
  },
}));
