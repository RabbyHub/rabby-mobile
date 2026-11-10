import React from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  type StyleProp,
  type ScrollViewProps,
  type ViewStyle,
} from 'react-native';
import Animated, { type AnimatedRef } from 'react-native-reanimated';

import { type SceneTabKey } from './context';
import {
  useSceneScrollSurface,
  type SceneScrollSurfaceHandle,
} from './useSceneScrollSurface';

const AnimatedScrollView = Animated.createAnimatedComponent(
  ScrollView,
) as unknown as React.ComponentType<
  ScrollViewProps & { ref?: React.Ref<ScrollView> }
>;

export type SceneScrollViewHandle = SceneScrollSurfaceHandle;

export type SceneScrollViewProps = {
  children: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  contentInsetTop: number;
  keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps'];
  nativeRef?: AnimatedRef<any>;
  onLayout?: (event: LayoutChangeEvent) => void;
  onMomentumScrollEnd?: (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => void;
  onScrollBeginDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollEndDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onContentSizeChange?: (height: number) => void;
  ref?: React.Ref<SceneScrollViewHandle>;
  scrollEnabled?: boolean;
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
  keyboardShouldPersistTaps,
  nativeRef,
  onLayout,
  onMomentumScrollEnd,
  onContentSizeChange,
  onScrollBeginDrag,
  onScrollEndDrag,
  ref,
  scrollEnabled = true,
  tabKey,
  testID,
}: SceneScrollViewProps) => {
  const { resolvedRef, scrollHandler, scrollTo } = useSceneScrollSurface({
    nativeRef,
    tabKey,
  });

  React.useImperativeHandle(ref, () => ({ scrollTo }), [scrollTo]);

  return (
    <AnimatedScrollView
      contentContainerStyle={[
        contentContainerStyle,
        { paddingTop: contentInsetTop },
      ]}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      onContentSizeChange={(_w, h) => onContentSizeChange?.(h)}
      onLayout={onLayout}
      onMomentumScrollEnd={onMomentumScrollEnd}
      onScroll={scrollHandler}
      onScrollBeginDrag={onScrollBeginDrag}
      onScrollEndDrag={onScrollEndDrag}
      ref={resolvedRef as never}
      scrollEnabled={scrollEnabled}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      testID={testID}>
      {children}
    </AnimatedScrollView>
  );
};
