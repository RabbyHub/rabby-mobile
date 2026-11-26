import React, { useMemo } from 'react';
import { PixelRatio, Pressable, TouchableOpacity, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { MaterialTabBar } from 'react-native-collapsible-tab-view';
import type { TabBarProps } from 'react-native-collapsible-tab-view';
import Animated, {
  Extrapolate,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import { Text } from '@/components/Typography';
import { HOME_TOP_HEADER_SIZES } from '@/constant/home';
import { IS_ANDROID } from '@/core/native/utils';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { homeDrawerAnimateMutable } from '../../hooks/useHomeDrawerAnimate';
import {
  DRAWER_CATEGORY_BAR_GAP,
  DRAWER_CATEGORY_BAR_HEIGHT,
  DRAWER_TOP_BAR_HEIGHT,
} from './constants';

const { drawerTabPosition } = homeDrawerAnimateMutable;

/** Same row geometry as the first floor's indicator: 20 + slot + 12 + slot + 20. */
const INDICATOR_PADDING_X = 20;
const INDICATOR_GAP = 12;
const INDICATOR_HIT_SLOP = { top: 8, bottom: 8, left: 0, right: 0 };
const PIXEL_RATIO = PixelRatio.get();

export type HomeDrawerTabBarAction = {
  label: string;
  disabled?: boolean;
  onPress: () => void;
};

type HomeDrawerTabBarProps = TabBarProps<string> & {
  moreTitle: string;
  websitesTitle: string;
  /** The text button on the right of the title row, if the tab has one. */
  action?: HomeDrawerTabBarAction | null;
  onPressMore: () => void;
  onPressWebsites: () => void;
  categoryBarStyle?: StyleProp<ViewStyle>;
  categoryBarContentStyle?: StyleProp<ViewStyle>;
  categoryIndicatorStyle?: StyleProp<ViewStyle>;
  categoryTabStyle?: StyleProp<ViewStyle>;
};

/**
 * The chrome of the second floor. Its pager is flat, like the first floor's:
 * page 0 is "More Features" and every later page is a website category. The
 * two-segment indicator and the title follow that split, and the category
 * strip only exists while a website page is on screen.
 */
export function HomeDrawerTabBar({
  tabNames,
  tabProps,
  index,
  indexDecimal,
  focusedTab,
  containerRef,
  onTabPress,
  width,
  moreTitle,
  websitesTitle,
  action,
  onPressMore,
  onPressWebsites,
  categoryBarStyle,
  categoryBarContentStyle,
  categoryIndicatorStyle,
  categoryTabStyle,
}: HomeDrawerTabBarProps) {
  const { styles } = useTheme2024({ getStyle });

  // The category strip is the same pager minus its first page, so its tabs,
  // index and position are all shifted by one.
  const categoryNames = useMemo(() => tabNames.slice(1), [tabNames]);
  const categoryTabProps = useMemo(() => {
    const result: typeof tabProps = new Map();
    categoryNames.forEach((name, categoryIndex) => {
      const props = tabProps.get(name);
      if (props) {
        result.set(name, { ...props, index: categoryIndex });
      }
    });
    return result;
  }, [categoryNames, tabProps]);
  const categoryIndex = useDerivedValue(() => Math.max(0, index.value - 1));
  const categoryIndexDecimal = useDerivedValue(() => indexDecimal.value - 1);

  useAnimatedReaction(
    () => indexDecimal.value,
    position => {
      drawerTabPosition.value = position;
    },
  );

  const slotWidth = Math.max(
    0,
    ((width ?? 0) - INDICATOR_PADDING_X * 2 - INDICATOR_GAP) / 2,
  );
  // Shuttle, as on the first floor: each slot clips its own plate, so the
  // fill never crosses the gap between the two segments. Offsets are snapped
  // to device pixels so the plates do not shimmer while they travel.
  const leftPlateStyle = useAnimatedStyle(() => {
    const progress = Math.min(Math.max(indexDecimal.value, 0), 1);
    const offset = Math.round(progress * slotWidth * PIXEL_RATIO) / PIXEL_RATIO;
    return { transform: [{ translateX: offset }] };
  }, [slotWidth]);
  const rightPlateStyle = useAnimatedStyle(() => {
    const progress = Math.min(Math.max(indexDecimal.value, 0), 1);
    const offset =
      Math.round((progress - 1) * slotWidth * PIXEL_RATIO) / PIXEL_RATIO;
    return { transform: [{ translateX: offset }] };
  }, [slotWidth]);

  const moreTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      indexDecimal.value,
      [0.38, 0.62],
      [1, 0],
      Extrapolate.CLAMP,
    ),
  }));
  const websitesTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      indexDecimal.value,
      [0.38, 0.62],
      [0, 1],
      Extrapolate.CLAMP,
    ),
  }));
  const categoryBarAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      indexDecimal.value,
      [0.38, 0.62],
      [0, 1],
      Extrapolate.CLAMP,
    );
    return {
      opacity,
      pointerEvents: opacity > 0.5 ? 'auto' : 'none',
    };
  });

  // Android only: claim sideways drags that start on the title row, so the
  // Home pager underneath cannot take them. Vertical drags still fall through
  // to the drawer.
  const headerGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(IS_ANDROID)
        .activeOffsetX([-6, 6])
        .failOffsetY([-8, 8]),
    [],
  );

  return (
    <View pointerEvents="box-none" style={styles.container}>
      <GestureDetector gesture={headerGesture}>
        <View pointerEvents="box-none" style={styles.header}>
          <View pointerEvents="none" style={styles.titleBox}>
            <Animated.View style={[styles.titleSlot, moreTitleStyle]}>
              <Text style={styles.title} numberOfLines={1}>
                {moreTitle}
              </Text>
            </Animated.View>
            <Animated.View style={[styles.titleSlot, websitesTitleStyle]}>
              <Text style={styles.title} numberOfLines={1}>
                {websitesTitle}
              </Text>
            </Animated.View>
          </View>
          {action ? (
            <TouchableOpacity
              testID="home-drawer-tab-action"
              disabled={action.disabled}
              hitSlop={ACTION_HIT_SLOP}
              style={action.disabled ? styles.actionDisabled : undefined}
              onPress={action.onPress}>
              <Text style={styles.action}>{action.label}</Text>
            </TouchableOpacity>
          ) : null}
          <View pointerEvents="box-none" style={styles.indicatorRow}>
            <Pressable
              testID="home-drawer-tab-more"
              style={styles.indicatorSlot}
              hitSlop={INDICATOR_HIT_SLOP}
              onPress={onPressMore}>
              <Animated.View style={[styles.indicatorPlate, leftPlateStyle]} />
            </Pressable>
            <Pressable
              testID="home-drawer-tab-websites"
              style={styles.indicatorSlot}
              hitSlop={INDICATOR_HIT_SLOP}
              onPress={onPressWebsites}>
              <Animated.View style={[styles.indicatorPlate, rightPlateStyle]} />
            </Pressable>
          </View>
        </View>
      </GestureDetector>
      <Animated.View style={[styles.categoryBar, categoryBarAnimatedStyle]}>
        <MaterialTabBar
          containerRef={containerRef}
          focusedTab={focusedTab}
          onTabPress={onTabPress}
          width={width}
          tabNames={categoryNames}
          tabProps={categoryTabProps}
          index={categoryIndex as SharedValue<number>}
          indexDecimal={categoryIndexDecimal as SharedValue<number>}
          scrollEnabled={true}
          keepActiveTabCentered
          style={categoryBarStyle}
          contentContainerStyle={categoryBarContentStyle}
          indicatorStyle={categoryIndicatorStyle}
          tabStyle={categoryTabStyle}
        />
      </Animated.View>
    </View>
  );
}

const ACTION_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    height:
      DRAWER_TOP_BAR_HEIGHT +
      DRAWER_CATEGORY_BAR_GAP +
      DRAWER_CATEGORY_BAR_HEIGHT,
  },
  // Title row and indicator share one box, laid out like the first floor's
  // header, so the two floors line up when one replaces the other.
  header: {
    height: DRAWER_TOP_BAR_HEIGHT,
    paddingHorizontal: INDICATOR_PADDING_X,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleBox: {
    flex: 1,
    height: '100%',
  },
  titleSlot: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
  },
  action: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  actionDisabled: {
    opacity: 0.5,
  },
  indicatorRow: {
    position: 'absolute',
    left: INDICATOR_PADDING_X,
    right: INDICATOR_PADDING_X,
    top: HOME_TOP_HEADER_SIZES.headerHeight,
    height: HOME_TOP_HEADER_SIZES.headerIndicatorHeight,
    flexDirection: 'row',
    gap: INDICATOR_GAP,
  },
  indicatorSlot: {
    flex: 1,
    height: '100%',
    borderRadius: 12,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: colors2024['neutral-line'],
  },
  indicatorPlate: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: isLight ? 'rgba(0, 0, 0, 1)' : colors2024['brand-default'],
  },
  categoryBar: {
    marginTop: DRAWER_CATEGORY_BAR_GAP,
    height: DRAWER_CATEGORY_BAR_HEIGHT,
  },
}));
