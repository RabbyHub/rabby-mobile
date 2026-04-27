import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import {
  Gesture,
  GestureDetector,
  NativeGesture,
} from 'react-native-gesture-handler';
import type {
  TabBarProps,
  TabItemProps,
} from 'react-native-collapsible-tab-view';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const clamp = (value: number, min: number, max: number) => {
  'worklet';

  return Math.min(Math.max(value, min), max);
};

export type HomeDappDrawerAndroidTab<T extends string> = {
  id: T;
  label?: TabItemProps<T>['label'];
};

export function HomeDappDrawerAndroidTabs<T extends string>({
  tabs,
  initialTabName,
  drawerScrollableGesture,
  renderTabBar,
  onTabChange,
  renderTabContent,
}: {
  tabs: readonly HomeDappDrawerAndroidTab<T>[];
  initialTabName?: T;
  drawerScrollableGesture: NativeGesture;
  renderTabBar?: (props: TabBarProps<T>) => React.ReactElement | null;
  onTabChange?: (tab: T) => void;
  renderTabContent: (tab: T) => React.ReactNode;
}) {
  const { styles } = useTheme2024({ getStyle });
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

  const androidSwipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .manualActivation(true)
        .simultaneousWithExternalGesture(drawerScrollableGesture)
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

          if (absY > 6 && absY > absX) {
            stateManager.fail();
            return;
          }

          if (absX > 18 && absX > absY * 1.2) {
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
            tabs.length - 1,
          );
        })
        .onEnd(event => {
          'worklet';

          const swipeDistance = pageWidth * 0.18;
          const swipeVelocity = 600;
          const shouldSwipeLeft =
            event.translationX < -swipeDistance ||
            event.velocityX < -swipeVelocity;
          const shouldSwipeRight =
            event.translationX > swipeDistance ||
            event.velocityX > swipeVelocity;
          let targetIndex = currentIndex.value;

          if (shouldSwipeLeft) {
            targetIndex = Math.min(currentIndex.value + 1, tabs.length - 1);
          } else if (shouldSwipeRight) {
            targetIndex = Math.max(currentIndex.value - 1, 0);
          } else {
            targetIndex = Math.round(indexDecimal.value);
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
        })
        .onFinalize(() => {
          'worklet';

          runOnJS(setPagerSwipeActive)(false);
        }),
    [
      currentIndex,
      drawerScrollableGesture,
      focusedTab,
      indexDecimal,
      notifyTabChange,
      pageWidth,
      setPagerSwipeActive,
      tabs,
      touchStartX,
      touchStartY,
    ],
  );

  const pagerTrackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -pageWidth * indexDecimal.value }],
  }));

  return (
    <>
      {renderTabBar?.(tabBarProps)}
      <View style={styles.androidContent}>
        <GestureDetector gesture={androidSwipeGesture}>
          <Animated.View
            style={[
              styles.androidPagerTrack,
              { width: pageWidth * tabs.length },
              pagerTrackStyle,
            ]}>
            {tabs.map(tab => (
              <View
                key={tab.id}
                collapsable={false}
                pointerEvents={isSwipingPager ? 'none' : 'box-none'}
                style={[styles.androidPagerPage, { width: pageWidth }]}>
                {renderTabContent(tab.id)}
              </View>
            ))}
          </Animated.View>
        </GestureDetector>
      </View>
    </>
  );
}

const getStyle = createGetStyles2024(() => ({
  androidContent: {
    flex: 1,
    overflow: 'hidden',
  },
  androidPagerTrack: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    height: '100%',
  },
  androidPagerPage: {
    height: '100%',
    overflow: 'hidden',
  },
}));
