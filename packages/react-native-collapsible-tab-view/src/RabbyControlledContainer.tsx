import React from 'react';
import {
  LayoutChangeEvent,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  runOnUI,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Context, TabNameContext } from './Context';
import { Lazy } from './Lazy';
import { MaterialTabBar, TABBAR_HEIGHT } from './MaterialTabBar';
import { Tab } from './Tab';
import { IS_IOS, ONE_FRAME_MS, scrollToImpl } from './helpers';
import {
  useAnimatedDynamicRefs,
  useContainerRef,
  useTabProps,
} from './hooks';
import {
  CollapsibleProps,
  CollapsibleRef,
  ContextType,
  IndexChangeEventData,
  TabName,
} from './types';

const CONTROLLED_SWIPE_ACTIVE_OFFSET_X = 6;
const CONTROLLED_SWIPE_DIRECTION_RATIO = 1.15;
const CONTROLLED_SWIPE_DISTANCE_RATIO = 0.18;
const CONTROLLED_SWIPE_VELOCITY = 600;

type RabbyControlledContainerProps = CollapsibleProps & {
  workletOnIndexDecimalChange?: (ctx: {
    indexDecimal: number;
    tabName: TabName;
  }) => void;
};

const clamp = (value: number, min: number, max: number) => {
  'worklet';

  return Math.min(Math.max(value, min), max);
};

const workletNoop = () => {
  'worklet';
};

export const RabbyControlledContainer = React.memo(
  React.forwardRef<CollapsibleRef, RabbyControlledContainerProps>(
    (
      {
        initialTabName,
        workletOnIndexDecimalChange = workletNoop,
        headerHeight: initialHeaderHeight,
        minHeaderHeight = 0,
        tabBarHeight: initialTabBarHeight = TABBAR_HEIGHT,
        revealHeaderOnScroll = false,
        snapThreshold,
        children,
        renderHeader,
        renderTabBar = props => <MaterialTabBar {...props} />,
        headerContainerStyle,
        cancelTranslation,
        containerStyle,
        lazy,
        cancelLazyFadeIn,
        pagerProps,
        onIndexChange,
        onTabChange,
        width: customWidth,
        allowHeaderOverscroll,
      },
      ref,
    ) => {
    const containerRef = useContainerRef();

    const [tabProps, tabNamesArray] = useTabProps(children, Tab);

    const [refMap, setRef] = useAnimatedDynamicRefs();

    const windowWidth = useWindowDimensions().width;
    const width = customWidth ?? windowWidth;

    const containerHeight = useSharedValue<number | undefined>(undefined);

    const tabBarHeight = useSharedValue<number | undefined>(
      initialTabBarHeight,
    );

    const headerHeight = useSharedValue<number | undefined>(
      !renderHeader ? 0 : initialHeaderHeight,
    );

    const contentInset = useDerivedValue(() => {
      if (allowHeaderOverscroll) return 0;

      // necessary for the refresh control on iOS to be positioned underneath the header
      // this also adjusts the scroll bars to clamp underneath the header area
      return IS_IOS ? (headerHeight.value || 0) + (tabBarHeight.value || 0) : 0;
    });

    const snappingTo: ContextType['snappingTo'] = useSharedValue(0);
    const offset: ContextType['offset'] = useSharedValue(0);
    const accScrollY: ContextType['accScrollY'] = useSharedValue(0);
    const oldAccScrollY: ContextType['oldAccScrollY'] = useSharedValue(0);
    const accDiffClamp: ContextType['accDiffClamp'] = useSharedValue(0);
    const scrollYCurrent: ContextType['scrollYCurrent'] = useSharedValue(0);
    const scrollY: ContextType['scrollY'] = useSharedValue(
      tabNamesArray.map(() => 0),
    );

    const contentHeights: ContextType['contentHeights'] = useSharedValue(
      tabNamesArray.map(() => 0),
    );

    const initialIndex = initialTabName
      ? tabNamesArray.findIndex(n => n === initialTabName)
      : 0;

    const tabNames: ContextType['tabNames'] = useDerivedValue<TabName[]>(
      () => tabNamesArray,
      [tabNamesArray],
    );
    const index: ContextType['index'] = useSharedValue(
      initialIndex >= 0 ? initialIndex : 0,
    );

    const [data, setData] = React.useState(tabNamesArray);

    React.useEffect(() => {
      setData(tabNamesArray);
    }, [tabNamesArray]);

    const focusedTab: ContextType['focusedTab'] =
      useDerivedValue<TabName>(() => {
        return tabNames.value[index.value];
      }, [tabNames]);
    const calculateNextOffset = useSharedValue(index.value);
    const headerScrollDistance: ContextType['headerScrollDistance'] =
      useDerivedValue(() => {
        return headerHeight.value !== undefined
          ? headerHeight.value - minHeaderHeight
          : 0;
      }, [headerHeight, minHeaderHeight]);

    const indexDecimal: ContextType['indexDecimal'] = useSharedValue(
      index.value,
    );

    const afterRender = useSharedValue(0);
    React.useEffect(() => {
      afterRender.value = withDelay(
        ONE_FRAME_MS * 5,
        withTiming(1, { duration: 0 }),
      );
    }, [afterRender, tabNamesArray]);

    const resyncTabScroll = () => {
      'worklet';
      for (const name of tabNamesArray) {
        scrollToImpl(
          refMap[name],
          0,
          scrollYCurrent.value - contentInset.value,
          false,
        );
      }
    };

    // the purpose of this is to scroll to the proper position if dynamic tabs are changing
    useAnimatedReaction(
      () => {
        return afterRender.value === 1;
      },
      trigger => {
        if (trigger) {
          afterRender.value = 0;
          resyncTabScroll();
        }
      },
      [tabNamesArray, refMap, afterRender, contentInset],
    );

    useAnimatedReaction(
      () => {
        return indexDecimal.value;
      },
      value => {
        const nextIndex = clamp(
          Math.round(value),
          0,
          tabNames.value.length - 1,
        );
        const tabName = tabNames.value[nextIndex];
        if (tabName) {
          workletOnIndexDecimalChange({
            indexDecimal: value,
            tabName,
          });
        }
      },
      [],
    );

    const propagateTabChange = React.useCallback(
      (change: IndexChangeEventData<TabName>) => {
        onTabChange?.(change);
        onIndexChange?.(change.index);
      },
      [onIndexChange, onTabChange],
    );

    useAnimatedReaction(
      () => {
        return calculateNextOffset.value;
      },
      i => {
        if (i !== index.value) {
          offset.value =
            scrollY.value[index.value] - scrollY.value[i] + offset.value;
          runOnJS(propagateTabChange)({
            prevIndex: index.value,
            index: i,
            prevTabName: tabNames.value[index.value],
            tabName: tabNames.value[i],
          });
          index.value = i;
          scrollYCurrent.value = scrollY.value[index.value] || 0;
        }
      },
      [],
    );

    useAnimatedReaction(
      () => headerHeight.value,
      (_current, prev) => {
        if (prev === undefined) {
          // sync scroll if we started with undefined header height
          resyncTabScroll();
        }
      },
    );

    const headerTranslateY = useDerivedValue(() => {
      return revealHeaderOnScroll
        ? -accDiffClamp.value
        : -Math.min(scrollYCurrent.value, headerScrollDistance.value);
    }, [revealHeaderOnScroll]);

    const stylez = useAnimatedStyle(() => {
      return {
        transform: [
          {
            translateY: headerTranslateY.value,
          },
        ],
      };
    }, [revealHeaderOnScroll]);

    const getHeaderHeight = React.useCallback(
      (event: LayoutChangeEvent) => {
        const height = event.nativeEvent.layout.height;
        if (headerHeight.value !== height) {
          headerHeight.value = height;
        }
      },
      [headerHeight],
    );

    const getTabBarHeight = React.useCallback(
      (event: LayoutChangeEvent) => {
        const height = event.nativeEvent.layout.height;
        if (tabBarHeight.value !== height) tabBarHeight.value = height;
      },
      [tabBarHeight],
    );

    const onLayout = React.useCallback(
      (event: LayoutChangeEvent) => {
        const height = event.nativeEvent.layout.height;
        if (containerHeight.value !== height) containerHeight.value = height;
      },
      [containerHeight],
    );

    const settleToIndex = React.useCallback(
      (nextIndex: number) => {
        'worklet';

        const targetIndex = clamp(nextIndex, 0, tabNames.value.length - 1);
        indexDecimal.value = withTiming(
          targetIndex,
          { duration: 180 },
          finished => {
            if (finished) {
              calculateNextOffset.value = targetIndex;
            }
          },
        );
      },
      [calculateNextOffset, indexDecimal, tabNames],
    );

    const onTabPress = React.useCallback(
      (name: TabName) => {
        const i = tabNames.value.findIndex(n => n === name);
        if (i < 0) {
          return;
        }

        if (name === focusedTab.value) {
          const ref = refMap[name];
          runOnUI(scrollToImpl)(
            ref,
            0,
            headerScrollDistance.value - contentInset.value,
            true,
          );
        } else {
          runOnUI(settleToIndex)(i);
        }
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [refMap, contentInset, settleToIndex],
    );

    React.useEffect(() => {
      if (index.value >= tabNamesArray.length) {
        onTabPress(tabNamesArray[tabNamesArray.length - 1]);
      }
    }, [index.value, onTabPress, tabNamesArray]);

    const emitPageScrollState = React.useCallback(
      (pageScrollState: 'dragging' | 'idle') => {
        pagerProps?.onPageScrollStateChanged?.({
          nativeEvent: { pageScrollState },
        } as any);
      },
      [pagerProps],
    );

    const gestureStartIndex = useSharedValue(index.value);
    const touchStartX = useSharedValue(0);
    const touchStartY = useSharedValue(0);
    const rawGestureTranslationX = useSharedValue(0);
    const rawGestureActive = useSharedValue(0);
    const gestureSettledOnEnd = useSharedValue(0);

    const controlledPagerGesture = React.useMemo(
      () =>
        Gesture.Pan()
          .enabled(pagerProps?.scrollEnabled !== false)
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
            rawGestureTranslationX.value = 0;
            rawGestureActive.value = 0;
            gestureSettledOnEnd.value = 0;
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
            rawGestureTranslationX.value = diffX;

            if (
              rawGestureActive.value !== 1 &&
              absY > CONTROLLED_SWIPE_ACTIVE_OFFSET_X &&
              absY > absX * CONTROLLED_SWIPE_DIRECTION_RATIO
            ) {
              stateManager.fail();
              return;
            }

            if (
              absX > CONTROLLED_SWIPE_ACTIVE_OFFSET_X &&
              absX > absY * CONTROLLED_SWIPE_DIRECTION_RATIO
            ) {
              if (rawGestureActive.value !== 1) {
                rawGestureActive.value = 1;
                gestureStartIndex.value = index.value;
              }
              stateManager.activate();
              indexDecimal.value = clamp(
                gestureStartIndex.value - rawGestureTranslationX.value / width,
                0,
                tabNames.value.length - 1,
              );
            }
          })
          .onStart(() => {
            'worklet';

            if (rawGestureActive.value !== 1) {
              gestureStartIndex.value = index.value;
              rawGestureTranslationX.value = 0;
            }
            runOnJS(emitPageScrollState)('dragging');
          })
          .onUpdate(event => {
            'worklet';

            const translationX =
              rawGestureActive.value === 1 &&
              Math.abs(rawGestureTranslationX.value) >
                Math.abs(event.translationX)
                ? rawGestureTranslationX.value
                : event.translationX;
            indexDecimal.value = clamp(
              gestureStartIndex.value - translationX / width,
              0,
              tabNames.value.length - 1,
            );
          })
          .onEnd(event => {
            'worklet';

            gestureSettledOnEnd.value = 1;
            const swipeDistance = width * CONTROLLED_SWIPE_DISTANCE_RATIO;
            const translationX =
              Math.abs(rawGestureTranslationX.value) >
              Math.abs(event.translationX)
                ? rawGestureTranslationX.value
                : event.translationX;
            const shouldSwipeLeft =
              translationX < -swipeDistance ||
              event.velocityX < -CONTROLLED_SWIPE_VELOCITY;
            const shouldSwipeRight =
              translationX > swipeDistance ||
              event.velocityX > CONTROLLED_SWIPE_VELOCITY;
            let targetIndex = gestureStartIndex.value;

            if (shouldSwipeLeft) {
              targetIndex = Math.min(
                gestureStartIndex.value + 1,
                tabNames.value.length - 1,
              );
            } else if (shouldSwipeRight) {
              targetIndex = Math.max(gestureStartIndex.value - 1, 0);
            } else {
              targetIndex = Math.round(indexDecimal.value);
            }

            settleToIndex(targetIndex);
          })
          .onFinalize(() => {
            'worklet';

            if (
              rawGestureActive.value === 1 &&
              gestureSettledOnEnd.value !== 1
            ) {
              settleToIndex(Math.round(indexDecimal.value));
            }
            rawGestureActive.value = 0;
            rawGestureTranslationX.value = 0;
            gestureSettledOnEnd.value = 0;
            runOnJS(emitPageScrollState)('idle');
          }),
      [
        emitPageScrollState,
        gestureSettledOnEnd,
        gestureStartIndex,
        index,
        indexDecimal,
        pagerProps?.scrollEnabled,
        rawGestureActive,
        rawGestureTranslationX,
        settleToIndex,
        tabNames,
        touchStartX,
        touchStartY,
        width,
      ],
    );

    const pagerTrackStyle = useAnimatedStyle(
      () => ({
        transform: [{ translateX: -width * indexDecimal.value }],
      }),
      [width],
    );

    React.useImperativeHandle(
      ref,
      () => ({
        setIndex: index => {
          const name = tabNames.value[index];
          onTabPress(name);
          return true;
        },
        jumpToTab: name => {
          onTabPress(name);
          return true;
        },
        getFocusedTab: () => {
          return tabNames.value[index.value];
        },
        getCurrentIndex: () => {
          return index.value;
        },
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [onTabPress],
    );

    return (
      <Context.Provider
        value={{
          contentInset,
          tabBarHeight,
          headerHeight,
          refMap,
          tabNames,
          index,
          snapThreshold,
          revealHeaderOnScroll,
          focusedTab,
          accDiffClamp,
          indexDecimal,
          containerHeight,
          minHeaderHeight,
          scrollYCurrent,
          scrollY,
          setRef,
          headerScrollDistance,
          accScrollY,
          oldAccScrollY,
          offset,
          snappingTo,
          contentHeights,
          headerTranslateY,
          width,
          allowHeaderOverscroll,
        }}>
        <Animated.View
          style={[styles.container, { width }, containerStyle]}
          onLayout={onLayout}
          pointerEvents="box-none">
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.topContainer,
              headerContainerStyle,
              !cancelTranslation && stylez,
            ]}>
            <View
              style={[styles.container, styles.headerContainer]}
              onLayout={getHeaderHeight}
              pointerEvents="box-none">
              {renderHeader &&
                renderHeader({
                  containerRef,
                  index,
                  tabNames: tabNamesArray,
                  focusedTab,
                  indexDecimal,
                  onTabPress,
                  tabProps,
                })}
            </View>
            <View
              style={[styles.container, styles.tabBarContainer]}
              onLayout={getTabBarHeight}
              pointerEvents="box-none">
              {renderTabBar &&
                renderTabBar({
                  containerRef,
                  index,
                  tabNames: tabNamesArray,
                  focusedTab,
                  indexDecimal,
                  width,
                  onTabPress,
                  tabProps,
                })}
            </View>
          </Animated.View>

          <View
            style={[pagerProps?.style, StyleSheet.absoluteFill]}
            pointerEvents="box-none">
            <GestureDetector gesture={controlledPagerGesture}>
              <Animated.View
                style={[
                  styles.pagerTrack,
                  { width: width * data.length },
                  pagerTrackStyle,
                ]}>
                {data.map((tabName, i) => {
                  return (
                    <View
                      key={i}
                      collapsable={false}
                      style={[styles.pagerPage, { width }]}>
                      <TabNameContext.Provider value={tabName}>
                        <Lazy
                          startMounted={lazy ? undefined : true}
                          cancelLazyFadeIn={!lazy ? true : !!cancelLazyFadeIn}>
                          {
                            React.Children.toArray(children)[
                              i
                            ] as React.ReactElement<any>
                          }
                        </Lazy>
                      </TabNameContext.Provider>
                    </View>
                  );
                })}
              </Animated.View>
            </GestureDetector>
          </View>
        </Animated.View>
      </Context.Provider>
    );
    },
  ),
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topContainer: {
    position: 'absolute',
    zIndex: 100,
    width: '100%',
    backgroundColor: 'white',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  tabBarContainer: {
    zIndex: 1,
  },
  headerContainer: {
    zIndex: 2,
  },
  pagerTrack: {
    flex: 1,
    flexDirection: 'row',
  },
  pagerPage: {
    flex: 1,
  },
});
