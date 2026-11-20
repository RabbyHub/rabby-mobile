import React from 'react';
import {
  Animated as NativeAnimated,
  FlatList,
  type FlatListProps,
  type LayoutChangeEvent,
  type ListRenderItem,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { type AnimatedRef } from 'react-native-reanimated';

import { type SceneTabKey } from './context';
import {
  useSceneScrollSurface,
  type SceneScrollSurfaceHandle,
} from './useSceneScrollSurface';

const AnimatedFlatList = Animated.createAnimatedComponent(
  FlatList as unknown as React.ComponentClass<FlatListProps<any>>,
) as unknown as React.ComponentType<
  FlatListProps<any> & { ref?: React.Ref<FlatList<any>> }
>;

// This is a public runtime API (also used by RN's own sticky headers), but
// React Native 0.81's legacy Animated typings do not declare it yet.
const nativeAnimated = NativeAnimated as typeof NativeAnimated & {
  attachNativeEvent: (
    target: unknown,
    eventName: 'onScroll',
    mapping: { nativeEvent: { contentOffset: { y: NativeAnimated.Value } } }[],
  ) => { detach: () => void };
};

export type SceneListHandle<ItemT> = SceneScrollSurfaceHandle & {
  scrollToOffset: (offset: number, animated?: boolean) => void;
};

export type SceneListProps<ItemT> = {
  ListHeaderComponent?: React.ComponentType | React.ReactElement | null;
  contentContainerStyle?: StyleProp<ViewStyle>;
  contentInsetTop: number;
  data: readonly ItemT[];
  initialNumToRender?: number;
  keyboardShouldPersistTaps?: FlatListProps<ItemT>['keyboardShouldPersistTaps'];
  keyExtractor?: (item: ItemT, index: number) => string;
  nativeRef?: AnimatedRef<any>;
  /** Optional native event clock for overlays, independent of worklet state. */
  nativeScrollY?: NativeAnimated.Value;
  onContentSizeChange?: (width: number, height: number) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  onMomentumScrollEnd?: (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => void;
  onScrollBeginDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollEndDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  ref?: React.Ref<SceneListHandle<ItemT>>;
  removeClippedSubviews?: boolean;
  renderItem: ListRenderItem<ItemT>;
  scrollEnabled?: boolean;
  scrollsToTop?: boolean;
  showsVerticalScrollIndicator?: boolean;
  style?: StyleProp<ViewStyle>;
  tabKey: SceneTabKey;
  testID?: string;
};

/**
 * Virtualized variant of `SceneScrollView`. The list reserves
 * `contentInsetTop` for the scene layers and publishes its offset on the UI
 * thread exactly like the plain scroll surface.
 */
export const SceneList = <ItemT,>({
  ListHeaderComponent,
  contentContainerStyle,
  contentInsetTop,
  data,
  initialNumToRender,
  keyboardShouldPersistTaps,
  keyExtractor,
  nativeRef,
  nativeScrollY,
  onContentSizeChange,
  onLayout,
  onMomentumScrollEnd,
  onScrollBeginDrag,
  onScrollEndDrag,
  ref,
  removeClippedSubviews,
  renderItem,
  scrollEnabled = true,
  scrollsToTop,
  showsVerticalScrollIndicator = false,
  style,
  tabKey,
  testID,
}: SceneListProps<ItemT>) => {
  const { resolvedRef, scrollHandler, scrollTo } = useSceneScrollSurface({
    nativeRef,
    tabKey,
  });
  const listInstance = React.useRef<FlatList<ItemT> | null>(null);
  const attachedRef = React.useRef(resolvedRef);
  const nativeScrollValue = React.useRef(nativeScrollY);
  const nativeScrollAttachment = React.useRef<{
    target: unknown;
    value: NativeAnimated.Value;
    detach: () => void;
  } | null>(null);
  const syncNativeScrollAttachment = React.useCallback(
    (instance: FlatList<ItemT> | null, value?: NativeAnimated.Value) => {
      const target = instance?.getNativeScrollRef() ?? null;
      const previous = nativeScrollAttachment.current;
      if (previous?.target === target && previous?.value === value) {
        return;
      }
      previous?.detach();
      nativeScrollAttachment.current = null;
      if (target && value) {
        const attachment = nativeAnimated.attachNativeEvent(
          target,
          'onScroll',
          [{ nativeEvent: { contentOffset: { y: value } } }],
        );
        nativeScrollAttachment.current = { ...attachment, target, value };
      }
    },
    [],
  );
  const setNativeListRef = React.useCallback(
    (instance: FlatList<ItemT> | null) => {
      listInstance.current = instance;
      attachedRef.current(instance as never);
      syncNativeScrollAttachment(instance, nativeScrollValue.current);
    },
    [syncNativeScrollAttachment],
  );

  React.useLayoutEffect(() => {
    nativeScrollValue.current = nativeScrollY;
    syncNativeScrollAttachment(listInstance.current, nativeScrollY);
    return () => {
      nativeScrollAttachment.current?.detach();
      nativeScrollAttachment.current = null;
    };
  }, [nativeScrollY, syncNativeScrollAttachment]);

  React.useLayoutEffect(() => {
    if (attachedRef.current === resolvedRef) {
      return;
    }
    // Reanimated keeps its inner ref callback stable and does not reattach a
    // changed forwardedRef on an existing FlatList. Transfer the same mounted
    // instance explicitly when a single list changes its logical tab owner.
    attachedRef.current(null as never);
    attachedRef.current = resolvedRef;
    if (listInstance.current) {
      resolvedRef(listInstance.current as never);
    }
  }, [resolvedRef]);

  React.useImperativeHandle(
    ref,
    () => ({ scrollTo, scrollToOffset: scrollTo }),
    [scrollTo],
  );

  return (
    <AnimatedFlatList
      ListHeaderComponent={ListHeaderComponent}
      contentContainerStyle={[
        contentContainerStyle,
        { paddingTop: contentInsetTop },
      ]}
      data={data as ItemT[]}
      initialNumToRender={initialNumToRender}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      keyExtractor={keyExtractor}
      onContentSizeChange={(width, height) =>
        onContentSizeChange?.(width, height)
      }
      onLayout={onLayout}
      onMomentumScrollEnd={onMomentumScrollEnd}
      onScroll={scrollHandler}
      onScrollBeginDrag={onScrollBeginDrag}
      onScrollEndDrag={onScrollEndDrag}
      ref={setNativeListRef as never}
      removeClippedSubviews={removeClippedSubviews}
      renderItem={renderItem}
      scrollEnabled={scrollEnabled}
      scrollEventThrottle={16}
      scrollsToTop={scrollsToTop}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      style={style}
      testID={testID}
    />
  );
};
