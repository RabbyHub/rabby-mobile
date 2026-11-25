import type { PerpsProInfoTab } from '@/core/services/perpsService';
import React, {
  createContext,
  forwardRef,
  useContext,
  useImperativeHandle,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { Animated, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import {
  getPerpsProInfoStickyHeaderOffset,
  PERPS_PRO_INFO_TABS_HEIGHT,
} from './perpsProInfoTabsSticky';
import { PERPS_PRO_INFO_TABS } from './perpsProInfoTabOrder';
import type { PerpsProInfoScrollBridgeController } from './usePerpsProInfoScrollBridge';

/**
 * Where the tabs overlay is drawn. iOS moves it with native-driven Animated
 * scroll values; Android derives it on the UI runtime.
 */
export type PerpsProInfoStickyHeaderContextValue =
  | { platform: 'ios'; tabsTop: Animated.Animated }
  | {
      platform: 'android';
      scrollBridge: PerpsProInfoScrollBridgeController;
      tabsTop: SharedValue<number>;
    };

export const PerpsProInfoStickyHeaderContext =
  createContext<PerpsProInfoStickyHeaderContextValue | null>(null);

/** Set by the pager around each page's list. */
export const PerpsProInfoPageTabContext = createContext<PerpsProInfoTab | null>(
  null,
);

const UNMEASURED_ROW_Y = 1_000_000;

type StickyHeaderProps = PropsWithChildren<{
  onLayout: (event: LayoutChangeEvent) => void;
  scrollAnimatedValue: Animated.Value;
}>;

const IosStickyHeader: React.FC<
  StickyHeaderProps & { rowY: number; tabsTop: Animated.Animated }
> = ({ children, onLayout, rowY, scrollAnimatedValue, tabsTop }) => {
  // The list's own native scroll value keeps the row in the frame UIKit draws
  // it, for both the active page and a page revealed by a swipe.
  const translateY = useMemo(
    () =>
      Animated.add(
        Animated.add(tabsTop, scrollAnimatedValue),
        PERPS_PRO_INFO_TABS_HEIGHT - rowY,
      ).interpolate({
        extrapolateLeft: 'clamp',
        extrapolateRight: 'extend',
        inputRange: [0, 1],
        outputRange: [0, 1],
      }),
    [rowY, scrollAnimatedValue, tabsTop],
  );
  return (
    <Animated.View
      collapsable={false}
      onLayout={onLayout}
      style={[styles.sticky, { transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
};

const AndroidStickyHeader: React.FC<
  StickyHeaderProps & {
    rowY: SharedValue<number>;
    scrollOffset: SharedValue<number>;
    tabsTop: SharedValue<number>;
  }
> = ({ children, onLayout, rowY, scrollOffset, tabsTop }) => {
  const stickyStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: getPerpsProInfoStickyHeaderOffset(
          tabsTop.value,
          rowY.value,
          scrollOffset.value,
        ),
      },
    ],
  }));
  return (
    <Reanimated.View
      collapsable={false}
      onLayout={onLayout}
      style={[styles.sticky, stickyStyle]}>
      {children}
    </Reanimated.View>
  );
};

/**
 * `StickyHeaderComponent` for the info lists. The controls stay inside their
 * pager page, so horizontal swipes on them page natively and they travel with
 * the page, while still stopping under the tabs overlay.
 */
export const PerpsProInfoStickyHeader = forwardRef<
  { setNextHeaderY: (y: number) => void },
  StickyHeaderProps
>(({ children, onLayout, scrollAnimatedValue }, ref) => {
  // Only one sticky row per list, so the next-header push-off never applies.
  useImperativeHandle(ref, () => ({ setNextHeaderY: () => {} }), []);
  const context = useContext(PerpsProInfoStickyHeaderContext);
  const tab = useContext(PerpsProInfoPageTabContext);
  // Until measured, the row is treated as far below the tabs (no offset).
  const [rowY, setRowY] = useState(UNMEASURED_ROW_Y);
  const androidRowY = useSharedValue(UNMEASURED_ROW_Y);
  const handleLayout = (event: LayoutChangeEvent) => {
    const { y } = event.nativeEvent.layout;
    setRowY(y);
    androidRowY.value = y;
    onLayout(event);
  };

  if (context?.platform === 'ios') {
    return (
      <IosStickyHeader
        onLayout={handleLayout}
        rowY={rowY}
        scrollAnimatedValue={scrollAnimatedValue}
        tabsTop={context.tabsTop}>
        {children}
      </IosStickyHeader>
    );
  }
  const scrollOffset =
    context?.platform === 'android' && tab
      ? context.scrollBridge.targets[PERPS_PRO_INFO_TABS.indexOf(tab)]?.offset
      : undefined;
  if (context?.platform === 'android' && scrollOffset) {
    return (
      <AndroidStickyHeader
        onLayout={handleLayout}
        rowY={androidRowY}
        scrollAnimatedValue={scrollAnimatedValue}
        scrollOffset={scrollOffset}
        tabsTop={context.tabsTop}>
        {children}
      </AndroidStickyHeader>
    );
  }
  return (
    <Animated.View
      collapsable={false}
      onLayout={handleLayout}
      style={styles.sticky}>
      {children}
    </Animated.View>
  );
});

PerpsProInfoStickyHeader.displayName = 'PerpsProInfoStickyHeader';

const styles = StyleSheet.create({
  // Above the following cells, as RN's own sticky header.
  sticky: { zIndex: 10 },
});
