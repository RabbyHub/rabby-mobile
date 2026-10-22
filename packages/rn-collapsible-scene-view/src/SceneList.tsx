import React from 'react';
import {
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
  onContentSizeChange?: (width: number, height: number) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  onMomentumScrollEnd?: (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => void;
  onScrollBeginDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollEndDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  ref?: React.Ref<SceneListHandle<ItemT>>;
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
  onContentSizeChange,
  onLayout,
  onMomentumScrollEnd,
  onScrollBeginDrag,
  onScrollEndDrag,
  ref,
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
      ref={resolvedRef as never}
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
