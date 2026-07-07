import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleProp, StyleSheet, useWindowDimensions, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { TabBarProps, TabItemProps } from './types';

const SWIPE_ACTIVE_OFFSET_X = 4;
const SWIPE_ACTIVE_RATIO_Y = 0.25;

const clamp = (value: number, min: number, max: number) => {
  'worklet';

  return Math.min(Math.max(value, min), max);
};

export type RabbyControlledPagerTab<T extends string> = {
  id: T;
  label?: TabItemProps<T>['label'];
};

export function RabbyControlledPager<T extends string>({
  tabs,
  initialTabName,
  simultaneousGesture,
  renderTabBar,
  onTabChange,
  renderTabContent,
  contentStyle,
  trackStyle,
  pageStyle,
}: {
  tabs: readonly RabbyControlledPagerTab<T>[];
  initialTabName?: T;
  simultaneousGesture?: any;
  renderTabBar?: (props: TabBarProps<T>) => React.ReactElement | null;
  onTabChange?: (tab: T) => void;
  renderTabContent: (tab: T) => React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  trackStyle?: StyleProp<ViewStyle>;
  pageStyle?: StyleProp<ViewStyle>;
}) {
  const { width } = useWindowDimensions();
  const containerRef = useRef<any>(null);
  const [isSwipingPager, setIsSwipingPager] = useState(false);
  const pageWidth = Math.max(width, 1);
  const resolvedInitialIndex = useMemo(() => {
    const index = initialTabName
      ? tabs.findIndex(tab => tab.id === initialTabName)
      : 0;
    return index >= 0 ? index : 0;
  }, [initialTabName, tabs]);
  const initialIndex = useRef(resolvedInitialIndex).current;
  const currentIndex = useSharedValue(initialIndex);
  const indexDecimal = useSharedValue(initialIndex);
  const focusedTab = useSharedValue(
    (tabs[initialIndex]?.id ?? tabs[0]?.id) as T,
  );
  const touchStartX = useSharedValue(0);
  const touchStartY = useSharedValue(0);

  const tabIds = useMemo(() => tabs.map(tab => tab.id), [tabs]);
  const tabCount = tabs.length;
  const tabNames = useMemo(() => tabs.map(tab => tab.id), [tabs]);
  const tabProps = useMemo(
    () =>
      new Map(
        tabs.map((tab, index) => [
          tab.id,
          {
            index,
            label: tab.label,
            name: tab.id,
          },
        ]),
      ),
    [tabs],
  );

  const notifyTabChange = useCallback(
    (index: number) => {
      const tab = tabs[index];
      if (!tab) {
        return;
      }
      focusedTab.value = tab.id;
      onTabChange?.(tab.id);
    },
    [focusedTab, onTabChange, tabs],
  );

  const syncTab = useCallback(
    (targetIndex: number) => {
      if (targetIndex < 0 || targetIndex >= tabs.length) {
        return;
      }

      currentIndex.value = targetIndex;
      focusedTab.value = tabs[targetIndex].id;
      indexDecimal.value = withTiming(
        targetIndex,
        { duration: 180 },
        finished => {
          if (finished) {
            runOnJS(notifyTabChange)(targetIndex);
          }
        },
      );
    },
    [currentIndex, focusedTab, indexDecimal, notifyTabChange, tabs],
  );

  const onTabPress = useCallback(
    (name: T) => {
      const targetIndex = tabs.findIndex(tab => tab.id === name);
      syncTab(targetIndex);
    },
    [syncTab, tabs],
  );

  const tabBarProps = useMemo<TabBarProps<T>>(
    () => ({
      containerRef,
      focusedTab,
      index: currentIndex,
      indexDecimal,
      onTabPress,
      tabNames,
      tabProps,
      width: pageWidth,
    }),
    [
      currentIndex,
      focusedTab,
      indexDecimal,
      onTabPress,
      pageWidth,
      tabNames,
      tabProps,
    ],
  );

  const setPagerSwipeActive = useCallback((next: boolean) => {
    setIsSwipingPager(prev => (prev === next ? prev : next));
  }, []);

  const swipeGesture = useMemo(() => {
    const gesture = Gesture.Pan()
      .manualActivation(true)
      .maxPointers(1)
      .shouldCancelWhenOutside(false)
      .onTouchesDown(event => {
        'worklet';

        const touch = event.allTouches[0];
        if (!touch) {
          return;
        }

        touchStartX.value = touch.absoluteX;
        touchStartY.value = touch.absoluteY;
      })
      .onTouchesMove((event, stateManager) => {
        'worklet';

        const touch = event.allTouches[0];
        if (!touch) {
          stateManager.fail();
          return;
        }

        const diffX = touch.absoluteX - touchStartX.value;
        const diffY = touch.absoluteY - touchStartY.value;
        const absX = Math.abs(diffX);
        const absY = Math.abs(diffY);

        if (absX > SWIPE_ACTIVE_OFFSET_X && absX > absY * SWIPE_ACTIVE_RATIO_Y) {
          stateManager.activate();
        }
      })
      .onStart(() => {
        'worklet';

        runOnJS(setPagerSwipeActive)(true);
      })
      .onUpdate(event => {
        'worklet';

        indexDecimal.value = clamp(
          currentIndex.value - event.translationX / pageWidth,
          0,
          tabCount - 1,
        );
      })
      .onEnd(event => {
        'worklet';

        const swipeDistance = pageWidth * 0.18;
        const swipeVelocity = 600;
        const shouldSwipeLeft =
          event.translationX < -swipeDistance || event.velocityX < -swipeVelocity;
        const shouldSwipeRight =
          event.translationX > swipeDistance || event.velocityX > swipeVelocity;
        let targetIndex = currentIndex.value;

        if (shouldSwipeLeft) {
          targetIndex = Math.min(currentIndex.value + 1, tabCount - 1);
        } else if (shouldSwipeRight) {
          targetIndex = Math.max(currentIndex.value - 1, 0);
        } else {
          targetIndex = Math.round(indexDecimal.value);
        }

        currentIndex.value = targetIndex;
        focusedTab.value = tabIds[targetIndex] as T;
        indexDecimal.value = withTiming(
          targetIndex,
          { duration: 180 },
          finished => {
            if (finished) {
              runOnJS(notifyTabChange)(targetIndex);
            }
          },
        );
      })
      .onFinalize(() => {
        'worklet';

        runOnJS(setPagerSwipeActive)(false);
      });

    return simultaneousGesture
      ? gesture.simultaneousWithExternalGesture(simultaneousGesture)
      : gesture;
  }, [
    currentIndex,
    focusedTab,
    indexDecimal,
    notifyTabChange,
    pageWidth,
    setPagerSwipeActive,
    simultaneousGesture,
    tabCount,
    tabIds,
    touchStartX,
    touchStartY,
  ]);

  const pagerTrackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -pageWidth * indexDecimal.value }],
  }));

  return (
    <>
      {renderTabBar?.(tabBarProps)}
      <View style={[styles.content, contentStyle]}>
        <GestureDetector gesture={swipeGesture}>
          <Animated.View
            style={[
              styles.track,
              trackStyle,
              { width: pageWidth * tabs.length },
              pagerTrackStyle,
            ]}>
            {tabs.map(tab => (
              <View
                key={tab.id}
                collapsable={false}
                pointerEvents={isSwipingPager ? 'none' : 'box-none'}
                style={[styles.page, pageStyle, { width: pageWidth }]}>
                {renderTabContent(tab.id)}
              </View>
            ))}
          </Animated.View>
        </GestureDetector>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    overflow: 'hidden',
  },
  track: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    height: '100%',
  },
  page: {
    height: '100%',
    overflow: 'hidden',
  },
});
