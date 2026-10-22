import React, { useCallback, useEffect, useRef } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';

import { useCollapsibleScene, type SceneTabKey } from './context';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

export type SceneScrollViewHandle = {
  scrollTo: (offset: number, animated?: boolean) => void;
};

export type SceneScrollViewProps = {
  children: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  contentInsetTop: number;
  onContentSizeChange?: (height: number) => void;
  ref?: React.Ref<SceneScrollViewHandle>;
  tabKey: SceneTabKey;
  testID?: string;
};

/**
 * The single vertical surface of one tab. It reserves `contentInsetTop` at the
 * top (the space occupied by the collapsing/scrolling layers) and publishes the
 * offset to the scene on the UI thread.
 */
export const SceneScrollView = ({
  children,
  contentContainerStyle,
  contentInsetTop,
  onContentSizeChange,
  ref,
  tabKey,
  testID,
}: SceneScrollViewProps) => {
  const internalRef = useRef<ScrollView | null>(null);
  const { activeTabIndex, getSavedOffset, reportScroll, scrollY, tabs } =
    useCollapsibleScene();
  const lastReported = useSharedValue(-1);
  const tabIndex = Math.max(tabs.indexOf(tabKey), 0);

  // Publish straight to the scene's shared value on the UI thread. This is the
  // whole point of the package: the layers read the same value in the same
  // frame, and JS is not involved while scrolling.
  const scrollHandler = useAnimatedScrollHandler(
    {
      onScroll: event => {
        const offset = Math.max(0, event.contentOffset.y);
        if (offset === lastReported.value) {
          return;
        }
        lastReported.value = offset;
        if (activeTabIndex.value === tabIndex) {
          scrollY.value = offset;
        }
      },
    },
    [tabIndex],
  );

  const publish = useCallback(
    (offset: number) => reportScroll(tabKey, offset),
    [reportScroll, tabKey],
  );

  // Restore this tab's offset when it becomes active again.
  useEffect(() => {
    const offset = getSavedOffset(tabKey);
    if (offset <= 0) {
      return;
    }
    internalRef.current?.scrollTo({ animated: false, x: 0, y: offset });
    publish(offset);
  }, [getSavedOffset, publish, tabKey]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      publish(event.nativeEvent.contentOffset.y);
    },
    [publish],
  );

  const handleLayout = useCallback((_event: LayoutChangeEvent) => {}, []);

  React.useImperativeHandle(
    ref,
    () => ({
      scrollTo(offset: number, animated = true) {
        internalRef.current?.scrollTo({ animated, x: 0, y: offset });
        publish(offset);
      },
    }),
    [publish],
  );

  return (
    <AnimatedScrollView
      contentContainerStyle={[
        contentContainerStyle,
        { paddingTop: contentInsetTop },
      ]}
      onContentSizeChange={(_w, h) => onContentSizeChange?.(h)}
      onLayout={handleLayout}
      onScroll={scrollHandler}
      onScrollEndDrag={handleScroll}
      onMomentumScrollEnd={handleScroll}
      ref={internalRef as never}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      testID={testID}>
      {children}
    </AnimatedScrollView>
  );
};
