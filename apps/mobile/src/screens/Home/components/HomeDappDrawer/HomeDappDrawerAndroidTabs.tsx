import RcIconFavorite from '@/assets2024/icons/home/favorite.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { range } from 'lodash';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  FlatList,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  NativeGesture,
} from 'react-native-gesture-handler';
import Animated, {
  interpolateColor,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const AnimatedText = Animated.createAnimatedComponent(Text);
const AnimatedFavoriteIcon = Animated.createAnimatedComponent(RcIconFavorite);

const TAB_GAP = 8;
const FIRST_TAB_GAP = 12;

const clamp = (value: number, min: number, max: number) => {
  'worklet';

  return Math.min(Math.max(value, min), max);
};

type TabLayout = {
  x: number;
  width: number;
};

export type HomeDappDrawerAndroidTab<T extends string> = {
  id: T;
  label: string;
};

const AndroidTabItem: React.FC<{
  index: number;
  label: string;
  isFavorite?: boolean;
  onPress: () => void;
  progress: Animated.SharedValue<number>;
  styles: ReturnType<typeof useTheme2024>['styles'];
  colors2024: ReturnType<typeof useTheme2024>['colors2024'];
}> = ({ index, label, isFavorite, onPress, progress, styles, colors2024 }) => {
  const textStyle = useAnimatedStyle(() => {
    const distance = Math.min(Math.abs(progress.value - index), 1);

    return {
      color: interpolateColor(
        distance,
        [0, 1],
        [colors2024['neutral-title-1'], colors2024['neutral-info']],
      ),
    };
  });

  const activeIconProps = useAnimatedProps(() => {
    const distance = Math.min(Math.abs(progress.value - index), 1);

    return {
      color: interpolateColor(
        distance,
        [0, 1],
        [colors2024['orange-default'], colors2024['neutral-info']],
      ),
    };
  });

  const inactiveIconStyle = useAnimatedStyle(() => {
    const distance = Math.min(Math.abs(progress.value - index), 1);

    return {
      opacity: distance,
    };
  });

  return (
    <TouchableOpacity onPress={onPress} style={styles.androidTabButton}>
      {isFavorite ? (
        <View style={styles.favoriteLabelContainer}>
          <AnimatedFavoriteIcon
            width={18}
            height={18}
            animatedProps={activeIconProps}
            style={inactiveIconStyle}
          />
        </View>
      ) : (
        <AnimatedText style={[styles.androidTabLabel, textStyle]}>
          {label}
        </AnimatedText>
      )}
    </TouchableOpacity>
  );
};

export function HomeDappDrawerAndroidTabs<T extends string>({
  tabs,
  initialTabName,
  drawerScrollableGesture,
  onTabChange,
  renderTabContent,
}: {
  tabs: readonly HomeDappDrawerAndroidTab<T>[];
  initialTabName?: T;
  drawerScrollableGesture: NativeGesture;
  onTabChange?: (tab: T) => void;
  renderTabContent: (tab: T) => React.ReactNode;
}) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { width } = useWindowDimensions();
  const tabsScrollRef = useRef<ScrollView>(null);
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
  const touchStartX = useSharedValue(0);
  const touchStartY = useSharedValue(0);

  const initialTabLayouts = useMemo(() => {
    let x = 20;
    return tabs.map((tab, index) => {
      const itemWidth = Math.max(60, tab.label.length * 12 + 20);
      const item = { x, width: itemWidth };
      x += itemWidth + (index === 0 ? FIRST_TAB_GAP : TAB_GAP);
      return item;
    });
  }, [tabs]);

  const tabLayouts = useSharedValue<TabLayout[]>(initialTabLayouts);
  const tabsViewportWidth = useSharedValue(0);
  const tabsScrollX = useSharedValue(0);

  useEffect(() => {
    tabLayouts.value = initialTabLayouts;
  }, [initialTabLayouts, tabLayouts]);

  const scrollActiveTabIntoView = useCallback(
    (index: number) => {
      const layout = tabLayouts.value[index];
      const viewportWidth = tabsViewportWidth.value;

      if (!layout || viewportWidth <= 0) {
        return;
      }

      const targetX = Math.max(
        0,
        layout.x + layout.width / 2 - viewportWidth / 2,
      );

      tabsScrollRef.current?.scrollTo({
        x: targetX,
        animated: true,
      });
    },
    [tabLayouts, tabsViewportWidth],
  );

  useEffect(() => {
    scrollActiveTabIntoView(initialIndex);
  }, [initialIndex, scrollActiveTabIntoView]);

  const handleTabLayout = useCallback(
    (index: number, x: number, itemWidth: number) => {
      const next = [...tabLayouts.value];
      const current = next[index];
      if (current && current.x === x && current.width === itemWidth) {
        return;
      }
      next[index] = { x, width: itemWidth };
      tabLayouts.value = next;
    },
    [tabLayouts],
  );

  const notifyTabChange = useCallback(
    (index: number) => {
      const tab = tabs[index];
      if (!tab) {
        return;
      }
      onTabChange?.(tab.id);
      scrollActiveTabIntoView(index);
    },
    [onTabChange, scrollActiveTabIntoView, tabs],
  );

  const syncTab = useCallback(
    (targetIndex: number) => {
      if (targetIndex < 0 || targetIndex >= tabs.length) {
        return;
      }

      currentIndex.value = targetIndex;
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
    [currentIndex, indexDecimal, notifyTabChange, tabs],
  );

  const androidSwipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .manualActivation(true)
        // .simultaneousWithExternalGesture(drawerScrollableGesture)
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
          indexDecimal.value = withTiming(
            targetIndex,
            { duration: 180 },
            finished => {
              if (finished) {
                runOnJS(notifyTabChange)(targetIndex);
              }
            },
          );
        }),
    [
      currentIndex,
      // drawerScrollableGesture,
      indexDecimal,
      notifyTabChange,
      pageWidth,
      tabs.length,
      touchStartX,
      touchStartY,
    ],
  );

  const pagerTrackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -pageWidth * indexDecimal.value }],
  }));

  const indicatorStyle = useAnimatedStyle(() => {
    const progress = clamp(indexDecimal.value, 0, tabs.length - 1);
    const leftIndex = Math.floor(progress);
    const rightIndex = Math.min(leftIndex + 1, tabs.length - 1);
    const ratio = progress - leftIndex;
    const leftLayout =
      tabLayouts.value[leftIndex] || initialTabLayouts[leftIndex];
    const rightLayout =
      tabLayouts.value[rightIndex] || initialTabLayouts[rightIndex];
    const translateX =
      leftLayout.x + (rightLayout.x - leftLayout.x) * ratio - tabsScrollX.value;
    const indicatorWidth =
      leftLayout.width + (rightLayout.width - leftLayout.width) * ratio;

    return {
      transform: [{ translateX }],
      width: indicatorWidth,
    };
  });

  return (
    <>
      <View style={styles.tabBarWrap}>
        <ScrollView
          ref={tabsScrollRef}
          horizontal
          onLayout={event => {
            tabsViewportWidth.value = event.nativeEvent.layout.width;
            scrollActiveTabIntoView(currentIndex.value);
          }}
          onScroll={event => {
            tabsScrollX.value = event.nativeEvent.contentOffset.x;
          }}
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          contentContainerStyle={styles.androidTabsBarContainer}>
          {tabs.map((tabItem, index) => {
            return (
              <View
                key={tabItem.id}
                onLayout={event => {
                  const { x, width: itemWidth } = event.nativeEvent.layout;
                  handleTabLayout(index, x, itemWidth);
                }}
                style={[
                  index === 0
                    ? styles.androidFirstTabButton
                    : styles.androidRestTabButton,
                ]}>
                <AndroidTabItem
                  index={index}
                  label={tabItem.label}
                  isFavorite={tabItem.id === 'favorite'}
                  onPress={() => syncTab(index)}
                  progress={indexDecimal}
                  styles={styles}
                  colors2024={colors2024}
                />
              </View>
            );
          })}
        </ScrollView>
        <Animated.View style={[styles.androidIndicator, indicatorStyle]} />
      </View>
      <View style={styles.androidContent}>
        <GestureDetector gesture={androidSwipeGesture}>
          <Animated.View
            style={[
              styles.androidPagerTrack,
              { width: pageWidth * tabs.length },
              pagerTrackStyle,
            ]}>
            {/* {renderTabContent('favorite' as T)} */}

            {tabs.map(tab => (
              <View
                key={tab.id}
                // collapsable={false}
                // pointerEvents="box-none"
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

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  tabBarWrap: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
    borderBottomWidth: 1,
    backgroundColor: 'transparent',
    borderBottomColor: colors2024['neutral-bg-5'],
  },
  androidContent: {
    flex: 1,
    overflow: 'hidden',
  },
  androidPagerTrack: {
    // flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    height: '100%',
  },
  androidPagerPage: {
    height: '100%',
    overflow: 'hidden',
  },
  androidTabsBarContainer: {
    paddingLeft: 20,
    paddingRight: 20,
  },
  androidTabButton: {
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
    paddingBottom: 4,
  },
  androidFirstTabButton: {
    marginRight: FIRST_TAB_GAP,
  },
  androidRestTabButton: {
    marginRight: TAB_GAP,
  },
  androidIndicator: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: 4,
    borderRadius: 100,
    backgroundColor: colors2024['neutral-body'],
  },
  androidTabLabel: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  favoriteLabelContainer: {
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 4,
  },
}));
