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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fadeIn]);

  // const measureRef = useRef(handleMeasureSecondaryIndicator);
  // useLayoutEffect(() => {
  //   measureRef.current = handleMeasureSecondaryIndicator;
  // }, [handleMeasureSecondaryIndicator]);
  // useLayoutEffect(() => {
  //   measureRef.current?.();
  // }, [measureRef.current]);

  return (
    <View style={styles.indicatorContainer}>
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

type MaterialTabBarProps = React.ComponentProps<typeof MaterialTabBar>;
export const HomeCustomMaterialTabBar = (_props: {
  materialTabBarProps: Omit<
    MaterialTabBarProps,
    | 'scrollEnabled'
    | 'tabStyle'
    | 'TabItemComponent'
    | 'style'
    | 'indicatorStyle'
    | 'contentContainerStyle'
  >;
  indexDecimal?: Animated.SharedValue<number>;
  externalContent?: React.ReactNode;
}) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  const props = _props.materialTabBarProps;
  const indexDecimal = props.indexDecimal;

  const stylez = useAnimatedStyle(() => {
    return {
      opacity: indexDecimal.value <= 0.5 ? 0 : 1,
    };
  });

  const renderTabItem = useCallback<
    MaterialTabBarProps['TabItemComponent'] & object
  >(
    _p => (
      <MaterialTabItem
        {..._p}
        // onSwitchTo={name => _p.onSwitchTo?.(name)}
        pressOpacity={__DEV__ ? 0.5 : 1}
        inactiveOpacity={1}
      />
    ),
    [],
  );

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
        {_props.externalContent}
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
