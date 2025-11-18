import { Dimensions, View } from 'react-native';
import {
  MaterialTabBar,
  MaterialTabItem,
} from 'react-native-collapsible-tab-view';

import React, { useCallback } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolate,
  AnimatedStyle,
} from 'react-native-reanimated';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

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
};

const Indicator: React.FC<IndicatorProps> = ({
  indexDecimal,
  itemsLayout,
  style,
  fadeIn = false,
}) => {
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

  return (
    <>
      <Animated.View style={[stylez, styles.indicator, style]} />
      <View style={styles.leftBackground} />
      <View style={styles.rightBackground} />
    </>
  );
};

const indicatorStyles = createGetStyles2024(({ isLight, colors2024 }) => ({
  indicator: {
    height: 6,
    backgroundColor: isLight ? 'rgba(0, 0, 0, 1)' : colors2024['brand-default'],
    position: 'absolute',
    borderRadius: 12,
    top: 0,
    zIndex: 99,
  },
  leftBackground: {
    position: 'absolute',
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
    width: (screenWidth - 52) / 2,
    height: 6,
    borderRadius: 12,
    backgroundColor: colors2024['neutral-line'],
    zIndex: 98,
  },
}));

export const HomeCustomMaterialTabBar = (_props: any) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  const props = _props.materialTabBarProps;
  const indexDecimal = props.indexDecimal;

  const stylez = useAnimatedStyle(() => {
    return {
      opacity: indexDecimal.value <= 0.5 ? 0 : 1,
      height: 42,
    };
  }, [indexDecimal]);
  const renderTabItem = useCallback(
    (_p: any) => (
      <MaterialTabItem {..._p} pressOpacity={1} inactiveOpacity={1} />
    ),
    [],
  );
  return (
    <View style={styles.container}>
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
      />
      <Animated.View style={[styles.portfolioContainer, stylez]}>
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

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    position: 'relative',
    color: colors2024['red-default'],
    marginTop: 26,
  },
  indicatorStyle: {
    height: 6,
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
    marginTop: 12,
    paddingHorizontal: 16,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
}));
